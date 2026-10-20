//! Cubic Bézier subdivision in material metres. Independent of mesh resolution.
use glam::DVec2;

pub const FLATNESS_M: f64 = 0.00025;
pub fn cubic(p: [DVec2; 4], t: f64) -> DVec2 {
    let a = p[0].lerp(p[1], t);
    let b = p[1].lerp(p[2], t);
    let c = p[2].lerp(p[3], t);
    a.lerp(b, t).lerp(b.lerp(c, t), t)
}
/// Exact derivative with respect to the cubic's unit parameter.
pub fn cubic_derivative(p: [DVec2; 4], t: f64) -> DVec2 {
    let u = 1. - t;
    3. * (u * u * (p[1] - p[0]) + 2. * u * t * (p[2] - p[1]) + t * t * (p[3] - p[2]))
}
fn distance_to_segment(p: DVec2, a: DVec2, b: DVec2) -> f64 {
    let d = b - a;
    p.distance(a + d * ((p - a).dot(d) / d.length_squared().max(1e-30)).clamp(0., 1.))
}
pub fn flatten(p: [DVec2; 4], tolerance: f64) -> Result<Vec<DVec2>, String> {
    if p.iter().any(|v| !v.is_finite()) || !tolerance.is_finite() || tolerance <= 0. {
        return Err("Invalid Bézier controls or tolerance".into());
    }
    fn split(
        p: [DVec2; 4],
        tolerance: f64,
        depth: u32,
        out: &mut Vec<DVec2>,
    ) -> Result<(), String> {
        // Distance to the segment (not the infinite line) also catches collinear
        // overshoot/backtracking. The convex hull bounds curve-to-chord error.
        if distance_to_segment(p[1], p[0], p[3]).max(distance_to_segment(p[2], p[0], p[3]))
            <= tolerance
        {
            out.push(p[3]);
            return Ok(());
        }
        if depth == 16 || out.len() > 4096 {
            return Err("Bézier subdivision budget exceeded".into());
        }
        let a = (p[0] + p[1]) * 0.5;
        let b = (p[1] + p[2]) * 0.5;
        let c = (p[2] + p[3]) * 0.5;
        let d = (a + b) * 0.5;
        let e = (b + c) * 0.5;
        let f = (d + e) * 0.5;
        split([p[0], a, d, f], tolerance, depth + 1, out)?;
        split([f, e, c, p[3]], tolerance, depth + 1, out)
    }
    let mut out = vec![p[0]];
    split(p, tolerance, 0, &mut out)?;
    Ok(out)
}

pub fn arclength_point(points: &[DVec2], fraction: f64) -> DVec2 {
    let length: f64 = points.windows(2).map(|p| p[0].distance(p[1])).sum();
    let mut remaining = length * fraction.clamp(0., 1.);
    for pair in points.windows(2) {
        let d = pair[0].distance(pair[1]);
        if remaining <= d {
            return pair[0].lerp(pair[1], remaining / d.max(1e-30));
        }
        remaining -= d;
    }
    points.last().copied().unwrap_or_default()
}
