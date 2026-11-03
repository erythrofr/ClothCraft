//! Independent research implementation of Zhang et al. (SIGGRAPH 2025),
//! sections 4.1--4.3. See docs/pie-resolution.md for deliberate differences.
use glam::DVec2;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Calibration {
    /// Eq. 4, units m^-3 and m^-1 respectively (E is in Pa).
    pub c1: f64,
    pub c2: f64,
    pub min_m: f64,
    pub max_m: f64,
}
impl Default for Calibration {
    fn default() -> Self {
        // Published rounded coefficients; do not silently fit our solver to them.
        Self {
            c1: 32.08,
            c2: -1.876e-4,
            min_m: 0.0025,
            max_m: 0.05,
        }
    }
}
impl Calibration {
    pub fn validate(&self) -> Result<(), String> {
        if ![self.c1, self.c2, self.min_m, self.max_m]
            .iter()
            .all(|v| v.is_finite())
            || self.c1 <= 0.
            || self.min_m < 1e-6
            || self.max_m > 1.
            || self.min_m >= self.max_m
            || self.c1 * self.min_m.powi(2) + self.c2 <= 0.
            || 6. * self.c1 * self.min_m.powi(2) + 4. * self.c2 <= 0.
        {
            return Err(
                "Calibration needs a finite positive, monotone Eq. 4 branch over 1 um..1 m".into(),
            );
        }
        Ok(())
    }
    /// Positive monotone root of Eq. 4, clamped to the declared interval.
    /// Uses bisection, avoiding unstable closed-form cubic branch selection.
    pub fn resolution(&self, bending_nm: f64, young_pa: f64) -> Result<f64, String> {
        self.validate()?;
        positive(bending_nm, "Bending stiffness (N m)")?;
        positive(young_pa, "Young's modulus (Pa)")?;
        let y = bending_nm / young_pa;
        positive(y, "B/E ratio (m^3)")?;
        let f = |r: f64| r.powi(4) * (self.c1 * r * r + self.c2);
        if y <= f(self.min_m) {
            return Ok(self.min_m);
        }
        if y >= f(self.max_m) {
            return Ok(self.max_m);
        }
        let (mut lo, mut hi) = (self.min_m, self.max_m);
        for _ in 0..80 {
            let mid = (lo + hi) * 0.5;
            if f(mid) < y {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        Ok((lo + hi) * 0.5)
    }
}

pub fn positive(x: f64, what: &str) -> Result<(), String> {
    if !x.is_finite() || x <= 0. {
        Err(format!("{what} must be finite and positive"))
    } else {
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fabric {
    pub young_pa: [f64; 2],
    pub bending_nm: [f64; 2],
    pub axis_degrees: f64,
}
impl Fabric {
    pub fn resolution(&self, calibration: &Calibration) -> Result<[f64; 2], String> {
        if !self.axis_degrees.is_finite() {
            return Err("Material axis must be finite".into());
        }
        Ok([
            calibration.resolution(self.bending_nm[0], self.young_pa[0])?,
            calibration.resolution(self.bending_nm[1], self.young_pa[1])?,
        ])
    }
    /// Section 4.2.2; rho is sewn/rest length, NOT 1-rho. No force is added.
    pub fn shirring(
        &self,
        calibration: &Calibration,
        added_young_pa: [f64; 2],
        rho: f64,
        n: f64,
    ) -> Result<[f64; 2], String> {
        if !rho.is_finite()
            || !(0. ..=1.).contains(&rho)
            || rho == 0.
            || !n.is_finite()
            || n <= 0.
            || added_young_pa.iter().any(|v| !v.is_finite() || *v < 0.)
        {
            return Err(
                "Shirring needs 0 < sewn/rest ratio <= 1, n > 0 and nonnegative added Pa".into(),
            );
        }
        self.resolution(calibration)?;
        let mut r = [0.; 2];
        for i in 0..2 {
            r[i] = rho.powf(n)
                * calibration
                    .resolution(self.bending_nm[i], self.young_pa[i] + added_young_pa[i])?;
        }
        if r.iter().any(|r| !r.is_finite() || *r < 1e-6) {
            return Err("Shirring requests spacing below the 1 um research limit".into());
        }
        Ok(r)
    }
}

/// Explicit prefactor exposes the proportionality omitted by the scaling law.
/// lambda, thickness and result are metres; T is N/m; B is N m.
pub fn tension_doubling_distance(
    lambda_m: f64,
    tension_n_per_m: f64,
    bending_nm: f64,
    prefactor: f64,
) -> Result<f64, String> {
    for (x, name) in [
        (lambda_m, "Wavelength"),
        (tension_n_per_m, "Tension"),
        (bending_nm, "Bending"),
        (prefactor, "Prefactor"),
    ] {
        positive(x, name)?;
    }
    let result = prefactor * lambda_m.powi(2) * (tension_n_per_m / bending_nm).sqrt();
    positive(result, "Transition distance")?;
    Ok(result)
}
pub fn compression_doubling_distance(
    lambda_m: f64,
    delta: f64,
    thickness_m: f64,
    prefactor: f64,
) -> Result<f64, String> {
    for (x, name) in [
        (lambda_m, "Wavelength"),
        (delta, "Compression"),
        (thickness_m, "Thickness"),
        (prefactor, "Prefactor"),
    ] {
        positive(x, name)?;
    }
    if delta > 1. {
        return Err("Compression fraction must be <= 1".into());
    }
    let result = prefactor * lambda_m.powf(1.5) * (delta / thickness_m.powi(2)).powf(0.25);
    positive(result, "Transition distance")?;
    Ok(result)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Feature {
    Polyline {
        points: Vec<DVec2>,
    },
    Region {
        center: DVec2,
        radius_m: f64,
    },
    /// Section 4.2.3's forward-only fold influence. This is a half-plane gate.
    DirectedPoint {
        origin: DVec2,
        direction: DVec2,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Source {
    pub feature: Feature,
    pub spacing_m: [f64; 2],
    pub doubling_distance_m: f64,
    pub exponent: f64,
}
impl Source {
    fn distance(&self, p: DVec2, radius: f64) -> Option<f64> {
        let distance = match &self.feature {
            Feature::Polyline { points } => points
                .windows(2)
                .map(|w| {
                    let d = w[1] - w[0];
                    p.distance(w[0] + d * ((p - w[0]).dot(d) / d.length_squared()).clamp(0., 1.))
                })
                .fold(f64::INFINITY, f64::min),
            Feature::Region { center, radius_m } => (p.distance(*center) - radius_m).max(0.),
            Feature::DirectedPoint { origin, direction } => {
                if (p - *origin).dot(direction.normalize()) < -radius {
                    return None;
                }
                p.distance(*origin)
            }
        };
        Some((distance - radius).max(0.))
    }
}

/// A material-space field, fixed for the life of the generated mesh.
/// Construction validates it; fields are private to prevent invalid later edits.
#[derive(Clone, Debug)]
pub struct SizingMap {
    base: [f64; 2],
    axis: f64,
    sources: Vec<Source>,
}
impl SizingMap {
    pub fn new(base: [f64; 2], axis_degrees: f64, sources: Vec<Source>) -> Result<Self, String> {
        if !axis_degrees.is_finite()
            || base
                .iter()
                .any(|r| !r.is_finite() || !(1e-6..=1.).contains(r))
            || sources.len() > 128
        {
            return Err(
                "Sizing map needs finite axes, 1 um..1 m spacings and at most 128 sources".into(),
            );
        }
        let mut points = 0;
        for s in &sources {
            if s.spacing_m
                .iter()
                .any(|r| !r.is_finite() || !(1e-6..=1.).contains(r))
                || !s.exponent.is_finite()
                || !(0.1..=2.).contains(&s.exponent)
            {
                return Err("Invalid source spacing or transition exponent (0.1..2)".into());
            }
            positive(s.doubling_distance_m, "Source doubling distance")?;
            match &s.feature {
                Feature::Polyline { points: p } => {
                    points += p.len();
                    if p.len() < 2
                        || p.iter()
                            .any(|p| !p.is_finite() || p.abs().max_element() > 1e4)
                        || p.windows(2).any(|w| w[0].distance(w[1]) < 1e-9)
                    {
                        return Err(
                            "Source polyline needs distinct finite points in material metres"
                                .into(),
                        );
                    }
                }
                Feature::Region { center, radius_m } => {
                    if !center.is_finite()
                        || center.abs().max_element() > 1e4
                        || !radius_m.is_finite()
                        || !(0. ..=1e4).contains(radius_m)
                    {
                        return Err("Invalid feature region".into());
                    }
                }
                Feature::DirectedPoint { origin, direction } => {
                    if !origin.is_finite()
                        || origin.abs().max_element() > 1e4
                        || !direction.is_finite()
                        || direction.length() < 1e-9
                        || !direction.length().is_finite()
                    {
                        return Err(
                            "Fold source needs a finite origin and nonzero direction".into()
                        );
                    }
                }
            }
        }
        if points > 8192 {
            return Err("Source point budget exceeded".into());
        }
        Ok(Self {
            base,
            axis: axis_degrees.to_radians(),
            sources,
        })
    }
    pub fn base(&self) -> [f64; 2] {
        self.base
    }
    pub fn finest(&self) -> f64 {
        self.sources
            .iter()
            .flat_map(|s| s.spacing_m)
            .chain(self.base)
            .fold(f64::INFINITY, f64::min)
    }
    pub fn spacing(&self, p: DVec2) -> [f64; 2] {
        self.lower_bound(p, 0.)
    }
    /// Conservative componentwise field bound over a closed ball. Distance to
    /// a feature is 1-Lipschitz; even tiny sources between samples are covered.
    pub fn lower_bound(&self, center: DVec2, radius_m: f64) -> [f64; 2] {
        let mut r = self.base;
        for s in &self.sources {
            if let Some(d) = s.distance(center, radius_m) {
                let factor = 1. + (d / s.doubling_distance_m).powf(s.exponent);
                for (i, r) in r.iter_mut().enumerate() {
                    *r = r.min(s.spacing_m[i] * factor);
                }
            }
        }
        r
    }
    pub fn to_axes(&self, p: DVec2) -> DVec2 {
        let (s, c) = self.axis.sin_cos();
        DVec2::new(c * p.x + s * p.y, -s * p.x + c * p.y)
    }
    pub fn material_vector(&self, p: DVec2) -> DVec2 {
        let (s, c) = self.axis.sin_cos();
        DVec2::new(c * p.x - s * p.y, s * p.x + c * p.y)
    }
    pub fn metric_delta(&self, delta: DVec2, spacing: [f64; 2]) -> DVec2 {
        self.to_axes(delta) / DVec2::from_array(spacing)
    }
}
