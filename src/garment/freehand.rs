//! Bounded sample fitting for freehand strokes in material-space metres.
//!
//! This is a pure CPU drafting operation. It does not create a panel, modify
//! a document, or use simulated/draped geometry. The error bound applies to
//! the distance from every retained input sample to its cubic evaluated at
//! that sample's *chord-length parameter*. It does not bound the curve between
//! samples or claim a Hausdorff bound for the original continuous pen motion.

use glam::DVec2;
use std::ops::RangeInclusive;

/// Hard caps keep a single pen stroke from consuming unbounded time or memory.
pub const MAX_INPUT_SAMPLES: usize = 4096;
pub const MAX_OUTPUT_SEGMENTS: usize = 1024;
const MAX_COORDINATE_M: f64 = 1.0e9;
const CORNER_DOT_THRESHOLD: f64 = 0.5; // A turn sharper than 60 degrees.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FitOptions {
    /// Maximum sampled residual, in material metres (strictly positive).
    pub max_error_m: f64,
    /// Maximum number of cubics to return, between 1 and 1024.
    pub max_segments: usize,
}

impl Default for FitOptions {
    fn default() -> Self {
        Self {
            max_error_m: 0.001,
            max_segments: 256,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FitError {
    InvalidTolerance,
    InvalidSegmentLimit,
    TooManySamples,
    NonFiniteSample,
    CoordinateOutOfRange,
    TooFewDistinctSamples,
    DegenerateStroke,
    SegmentLimitExceeded,
}

/// A cubic and its inclusive indices into [`FittedStroke::samples`].
#[derive(Clone, Debug, PartialEq)]
pub struct FittedCubic {
    pub controls: [DVec2; 4],
    pub source_samples: RangeInclusive<usize>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FittedStroke {
    /// Validated samples with *consecutive exact duplicates* removed.
    pub samples: Vec<DVec2>,
    pub segments: Vec<FittedCubic>,
    /// Worst residual at the documented per-span chord-length parameter.
    pub max_sample_error_m: f64,
}

/// Approximate a finite 2D pen stroke with cubic Bézier segments.
///
/// Adjacent points with exactly equal coordinates are coalesced. Turns over
/// 60 degrees are hard breakpoints (not smoothed across). Each span first
/// attempts a straight cubic, then a least-squares cubic with endpoints fixed
/// and endpoint tangent directions defined by its first and last edges.
/// Spans exceeding the error budget are split at their worst sample. No
/// geometry is returned on a failed input or exceeded output budget.
pub fn fit_freehand(samples: &[DVec2], options: FitOptions) -> Result<FittedStroke, FitError> {
    if !options.max_error_m.is_finite() || options.max_error_m <= 0. {
        return Err(FitError::InvalidTolerance);
    }
    if options.max_segments == 0 || options.max_segments > MAX_OUTPUT_SEGMENTS {
        return Err(FitError::InvalidSegmentLimit);
    }
    if samples.len() > MAX_INPUT_SAMPLES {
        return Err(FitError::TooManySamples);
    }

    let mut unique = Vec::with_capacity(samples.len());
    for &sample in samples {
        if !sample.is_finite() {
            return Err(FitError::NonFiniteSample);
        }
        if sample.abs().max_element() > MAX_COORDINATE_M {
            return Err(FitError::CoordinateOutOfRange);
        }
        if unique.last() != Some(&sample) {
            unique.push(sample);
        }
    }
    if unique.len() < 2 {
        return Err(FitError::TooFewDistinctSamples);
    }

    let mut cuts = vec![0];
    for i in 1..unique.len() - 1 {
        let incoming = unique[i] - unique[i - 1];
        let outgoing = unique[i + 1] - unique[i];
        let len_a = incoming.length();
        let len_b = outgoing.length();
        if !len_a.is_finite() || !len_b.is_finite() || len_a == 0. || len_b == 0. {
            return Err(FitError::DegenerateStroke);
        }
        if (incoming / len_a).dot(outgoing / len_b) < CORNER_DOT_THRESHOLD {
            cuts.push(i);
        }
    }
    cuts.push(unique.len() - 1);

    let mut result = Vec::new();
    let mut max_sample_error_m: f64 = 0.;
    for corners in cuts.windows(2) {
        // LIFO, right first, so finished spans remain in source order.
        let mut pending = vec![(corners[0], corners[1])];
        while let Some((start, end)) = pending.pop() {
            let (controls, error, worst_index) = fit_span(&unique, start, end)?;
            if error <= options.max_error_m {
                if result.len() >= options.max_segments {
                    return Err(FitError::SegmentLimitExceeded);
                }
                max_sample_error_m = max_sample_error_m.max(error);
                result.push(FittedCubic {
                    controls,
                    source_samples: start..=end,
                });
            } else {
                // Span endpoints always interpolate exactly. Every failure
                // therefore has a strictly interior, reproducible split.
                if worst_index <= start || worst_index >= end {
                    return Err(FitError::DegenerateStroke);
                }
                if result.len() + pending.len() + 2 > options.max_segments {
                    return Err(FitError::SegmentLimitExceeded);
                }
                pending.push((worst_index, end));
                pending.push((start, worst_index));
            }
        }
    }

    Ok(FittedStroke {
        samples: unique,
        segments: result,
        max_sample_error_m,
    })
}

fn fit_span(
    samples: &[DVec2],
    start: usize,
    end: usize,
) -> Result<([DVec2; 4], f64, usize), FitError> {
    let p0 = samples[start];
    let p3 = samples[end];
    let distances: Vec<f64> = samples[start..=end]
        .windows(2)
        .map(|pair| pair[0].distance(pair[1]))
        .collect();
    let total: f64 = distances.iter().sum();
    if !total.is_finite() || total == 0. {
        return Err(FitError::DegenerateStroke);
    }

    let mut t = Vec::with_capacity(end - start + 1);
    t.push(0.);
    let mut along = 0.;
    for &distance in &distances {
        along += distance;
        t.push((along / total).min(1.));
    }
    *t.last_mut().expect("nonempty span") = 1.;

    // An exact straight cubic is always preferable if it meets the bound.
    let delta = p3 - p0;
    let line = [p0, p0 + delta / 3., p0 + delta * (2. / 3.), p3];
    let (line_error, line_worst) = sampled_error(samples, start, &t, line);
    if end == start + 1 || line_error == 0. {
        return Ok((line, line_error, line_worst));
    }

    // Three-point one-sided chord-length derivatives avoid the systematic
    // half-sample tangent error of using only the first/last edge. This
    // matters especially for arcs sampled with a pen/tablet.
    let tangent0 = endpoint_tangent(
        samples[start + 1] - p0,
        samples[start + 2] - samples[start + 1],
        distances[0],
        distances[1],
    );
    let tangent1 = endpoint_tangent(
        p3 - samples[end - 1],
        samples[end - 1] - samples[end - 2],
        distances[distances.len() - 1],
        distances[distances.len() - 2],
    );
    let (mut aa, mut ab, mut bb, mut ar, mut br) = (0., 0., 0., 0., 0.);
    for (i, &parameter) in t.iter().enumerate().skip(1).take(end - start - 1) {
        let u = 1. - parameter;
        let a = 3. * u * u * parameter;
        let b = -3. * u * parameter * parameter;
        let basis_a = tangent0 * a;
        let basis_b = tangent1 * b;
        let base = p0 * (u * u * (u + 3. * parameter))
            + p3 * (parameter * parameter * (3. * u + parameter));
        let residual = samples[start + i] - base;
        aa += basis_a.dot(basis_a);
        ab += basis_a.dot(basis_b);
        bb += basis_b.dot(basis_b);
        ar += basis_a.dot(residual);
        br += basis_b.dot(residual);
    }
    let determinant: f64 = aa * bb - ab * ab;
    // Poorly conditioned fits use the deterministic line candidate instead.
    if !determinant.is_finite() || determinant <= 1e-12 * aa * bb {
        return Ok((line, line_error, line_worst));
    }
    let alpha: f64 = (ar * bb - br * ab) / determinant;
    let beta: f64 = (br * aa - ar * ab) / determinant;
    if !alpha.is_finite() || !beta.is_finite() || alpha < 0. || beta < 0. {
        return Ok((line, line_error, line_worst));
    }
    let candidate = [
        p0,
        p0 + tangent0 * alpha.min(2. * total),
        p3 - tangent1 * beta.min(2. * total),
        p3,
    ];
    let (error, worst) = sampled_error(samples, start, &t, candidate);
    if error < line_error {
        Ok((candidate, error, worst))
    } else {
        Ok((line, line_error, line_worst))
    }
}

fn endpoint_tangent(first: DVec2, second: DVec2, h1: f64, h2: f64) -> DVec2 {
    // Derivative of the quadratic through three successive chord-length
    // samples, expressed in dimensionless unit directions to avoid
    // overflows for sub-millimetre geometry.
    let fraction = h1 / (h1 + h2);
    let derivative = (first / h1) * (1. + fraction) - (second / h2) * fraction;
    if derivative.length_squared() > 1e-16 && derivative.is_finite() {
        derivative.normalize()
    } else {
        first / h1
    }
}

fn sampled_error(
    samples: &[DVec2],
    start: usize,
    params: &[f64],
    cubic: [DVec2; 4],
) -> (f64, usize) {
    let mut worst_error = 0.;
    let mut worst_index = start;
    for (offset, &t) in params.iter().enumerate() {
        // de Casteljau avoids cancellation in the Bernstein polynomial.
        let a = cubic[0].lerp(cubic[1], t);
        let b = cubic[1].lerp(cubic[2], t);
        let c = cubic[2].lerp(cubic[3], t);
        let point = a.lerp(b, t).lerp(b.lerp(c, t), t);
        let error = point.distance(samples[start + offset]);
        if error > worst_error {
            worst_error = error;
            worst_index = start + offset;
        }
    }
    (worst_error, worst_index)
}
