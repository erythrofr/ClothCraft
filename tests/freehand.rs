use glam::DVec2;
use marvelous_cloth::garment::{
    curves,
    freehand::{FitError, FitOptions, MAX_INPUT_SAMPLES, MAX_OUTPUT_SEGMENTS, fit_freehand},
};

fn opts(max_error_m: f64) -> FitOptions {
    FitOptions {
        max_error_m,
        ..FitOptions::default()
    }
}

// Independently recompute the declared parameterization and sample residuals.
fn check_bound(points: &[DVec2], tolerance: f64) {
    let fitted = fit_freehand(points, opts(tolerance)).unwrap();
    assert!(!fitted.segments.is_empty());
    assert!(fitted.max_sample_error_m <= tolerance);
    let mut observed: f64 = 0.;
    let mut previous_end = 0;
    for span in &fitted.segments {
        let start = *span.source_samples.start();
        let end = *span.source_samples.end();
        assert!(start < end);
        assert_eq!(start, previous_end);
        assert!(span.controls.iter().all(|p| p.is_finite()));
        assert_eq!(span.controls[0], fitted.samples[start]);
        assert_eq!(span.controls[3], fitted.samples[end]);
        let total: f64 = fitted.samples[start..=end]
            .windows(2)
            .map(|pair| pair[0].distance(pair[1]))
            .sum();
        let mut progress = 0.;
        for i in start..=end {
            if i > start {
                progress += fitted.samples[i - 1].distance(fitted.samples[i]);
            }
            let parameter = if i == end { 1. } else { progress / total };
            let actual = curves::cubic(span.controls, parameter);
            let residual = actual.distance(fitted.samples[i]);
            observed = observed.max(residual);
            assert!(
                residual <= tolerance + 1e-12,
                "sample {i}, residual {residual}"
            );
        }
        previous_end = end;
    }
    assert_eq!(previous_end, fitted.samples.len() - 1);
    assert!((observed - fitted.max_sample_error_m).abs() <= 1e-10);
}

#[test]
fn straight_line_is_one_exact_cubic() {
    let points: Vec<DVec2> = (0..=40)
        .map(|i| DVec2::new(i as f64 * 0.0025, i as f64 * 0.001))
        .collect();
    let result = fit_freehand(&points, opts(1e-8)).unwrap();
    assert_eq!(result.segments.len(), 1);
    check_bound(&points, 1e-8);
}

#[test]
fn smooth_arc_is_fitted_with_measured_tolerance() {
    let arc: Vec<DVec2> = (0..=70)
        .map(|i| {
            let a = std::f64::consts::PI * i as f64 / 70.;
            DVec2::new(0.1 * a.cos(), 0.1 * a.sin())
        })
        .collect();
    let fitted = fit_freehand(&arc, opts(0.00005)).unwrap();
    assert!(
        fitted.segments.len() <= 12,
        "segments: {}",
        fitted.segments.len()
    );
    check_bound(&arc, 0.00005);
}

#[test]
fn sharp_corner_is_a_shared_endpoint_not_smoothed() {
    let mut points: Vec<DVec2> = (0..=10).map(|i| DVec2::new(i as f64 * 0.01, 0.)).collect();
    points.extend((1..=10).map(|i| DVec2::new(0.1, i as f64 * 0.01)));
    let result = fit_freehand(&points, opts(1e-5)).unwrap();
    assert_eq!(result.segments.len(), 2);
    assert_eq!(*result.segments[0].source_samples.end(), 10);
    assert_eq!(*result.segments[1].source_samples.start(), 10);
    assert_eq!(result.segments[0].controls[3], DVec2::new(0.1, 0.));
    check_bound(&points, 1e-5);
}

#[test]
fn duplicate_points_and_tiny_strokes_are_deterministic() {
    let a = DVec2::new(-1e-6, 2e-6);
    let b = DVec2::new(1e-6, 2e-6);
    let result = fit_freehand(&[a, a, b, b], opts(1e-9)).unwrap();
    assert_eq!(result.samples, vec![a, b]);
    assert_eq!(result.segments.len(), 1);
    assert_eq!(
        fit_freehand(&[a, a], opts(1e-9)),
        Err(FitError::TooFewDistinctSamples)
    );
    check_bound(&[a, a, b, b], 1e-9);
}

#[test]
fn rejects_nonfinite_and_unreasonable_geometry_and_configuration() {
    let good = [DVec2::ZERO, DVec2::X];
    assert_eq!(
        fit_freehand(&good, opts(0.)),
        Err(FitError::InvalidTolerance)
    );
    assert_eq!(
        fit_freehand(&good, opts(f64::NAN)),
        Err(FitError::InvalidTolerance)
    );
    assert_eq!(
        fit_freehand(
            &good,
            FitOptions {
                max_segments: 0,
                ..opts(0.01)
            }
        ),
        Err(FitError::InvalidSegmentLimit)
    );
    assert_eq!(
        fit_freehand(
            &good,
            FitOptions {
                max_segments: MAX_OUTPUT_SEGMENTS + 1,
                ..opts(0.01)
            }
        ),
        Err(FitError::InvalidSegmentLimit)
    );
    assert_eq!(
        fit_freehand(&[DVec2::ZERO, DVec2::new(f64::INFINITY, 0.)], opts(0.01)),
        Err(FitError::NonFiniteSample)
    );
    assert_eq!(
        fit_freehand(&[DVec2::ZERO, DVec2::new(1e10, 0.)], opts(0.01)),
        Err(FitError::CoordinateOutOfRange)
    );
    assert_eq!(
        fit_freehand(&vec![DVec2::ZERO; MAX_INPUT_SAMPLES + 1], opts(0.01)),
        Err(FitError::TooManySamples)
    );
}

#[test]
fn hits_explicit_segment_budget_on_dense_zigzag() {
    let samples: Vec<DVec2> = (0..=20)
        .map(|i| DVec2::new(i as f64 * 0.01, (i % 2) as f64 * 0.01))
        .collect();
    assert_eq!(
        fit_freehand(
            &samples,
            FitOptions {
                max_segments: 3,
                ..opts(1e-6)
            }
        ),
        Err(FitError::SegmentLimitExceeded)
    );
}

#[test]
fn translated_and_rotated_stroke_preserves_fit() {
    let stroke: Vec<DVec2> = (0..=50)
        .map(|i| {
            let x = i as f64 * 0.002;
            DVec2::new(x, x * x * 3.)
        })
        .collect();
    let transformed: Vec<DVec2> = stroke
        .iter()
        .map(|p| DVec2::new(-p.y, p.x) + DVec2::new(17., -9.))
        .collect();
    let a = fit_freehand(&stroke, opts(0.00002)).unwrap();
    let b = fit_freehand(&transformed, opts(0.00002)).unwrap();
    assert_eq!(a.segments.len(), b.segments.len());
    assert!((a.max_sample_error_m - b.max_sample_error_m).abs() < 1e-10);
    check_bound(&stroke, 0.00002);
    check_bound(&transformed, 0.00002);
}
