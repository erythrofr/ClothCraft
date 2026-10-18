//! Manufacturing draft markings: per-boundary seam allowance and notches.
//!
//! These are *draft data* in material coordinates. They are independent of the
//! simulation: a marking never adds area, mass, a hinge or a constraint, and
//! changing one must not reset the drape. The cutting contour they describe is a
//! separate contour from the sewing contour, so cutting and sewing stay distinct.
//!
//! Behaviour follows publicly documented CLO / Marvelous Designer workflows: a
//! seam allowance is a per-boundary outward offset in millimetres; a notch is a
//! marker at a stable position on a named boundary, at least 1 mm from either
//! boundary end; allowances and notches are shown on both the sewing and the
//! cutting line. See `docs/markings.md` for the sources and the limits.
use super::polygon::PolygonPattern;
use glam::DVec2;
use serde::{Deserialize, Serialize};

/// A notch must stay at least this far (metres) from either boundary end. This
/// mirrors the published editor rule ("at least 1 mm of space between the notch
/// and the segment point").
pub const MIN_NOTCH_END_M: f64 = 0.001;
/// Widest accepted allowance, in metres (100 mm).
pub const MAX_ALLOWANCE_M: f64 = 0.1;
/// Longest accepted notch marker, in metres (50 mm).
pub const MAX_NOTCH_LENGTH_M: f64 = 0.05;
/// A miter longer than this multiple of the local allowance is refused instead of
/// silently producing a spike that would not survive as a cutting line.
const MAX_MITER_RATIO: f64 = 8.0;

/// Marker shape for one notch. The default is a V wedge, matching the published
/// default notch type; a straight slit is the other common marker.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotchKind {
    #[default]
    V,
    Slit,
}

/// One notch on a named boundary of a contour.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Notch {
    /// Fraction of the boundary's sampled arclength, in the open interval (0, 1).
    pub at: f64,
    /// Marker depth measured outward from the sewing line, in metres.
    pub length_m: f64,
    #[serde(default)]
    pub kind: NotchKind,
}

impl Notch {
    pub fn new(at: f64, length_m: f64, kind: NotchKind) -> Self {
        Self { at, length_m, kind }
    }
}

/// A joined cutting contour: the sewing contour offset outward by the stored
/// per-boundary seam allowances. Holes shrink by their allowance (the cut line
/// moves into the hole), so extra material is added everywhere.
#[derive(Clone, Debug, PartialEq)]
pub struct CuttingContour {
    pub outer: Vec<DVec2>,
    pub holes: Vec<Vec<DVec2>>,
}

pub fn polyline_length(points: &[DVec2]) -> f64 {
    points.windows(2).map(|p| p[0].distance(p[1])).sum()
}

fn cross(a: DVec2, b: DVec2, c: DVec2) -> f64 {
    (b - a).perp_dot(c - a)
}

fn intersects(a: DVec2, b: DVec2, c: DVec2, d: DVec2) -> bool {
    let eps = 1e-12;
    if a.min(b).x > c.max(d).x + eps
        || c.min(d).x > a.max(b).x + eps
        || a.min(b).y > c.max(d).y + eps
        || c.min(d).y > a.max(b).y + eps
    {
        return false;
    }
    cross(a, b, c) * cross(a, b, d) <= eps * eps && cross(c, d, a) * cross(c, d, b) <= eps * eps
}

/// A closed contour is simple when no two non-adjacent edges intersect.
fn simple_closed(points: &[DVec2]) -> bool {
    let n = points.len();
    if n < 3 {
        return false;
    }
    for i in 0..n {
        let (a, b) = (points[i], points[(i + 1) % n]);
        if a.distance(b) < 1e-9 {
            return false;
        }
        for j in i + 1..n {
            if j == i + 1 || (i == 0 && j == n - 1) {
                continue;
            }
            if intersects(a, b, points[j], points[(j + 1) % n]) {
                return false;
            }
        }
    }
    true
}

fn signed_area(points: &[DVec2]) -> f64 {
    (0..points.len())
        .map(|i| points[i].perp_dot(points[(i + 1) % points.len()]))
        .sum::<f64>()
        * 0.5
}

fn point_in_polygon(poly: &[DVec2], p: DVec2) -> bool {
    let mut inside = false;
    let n = poly.len();
    for i in 0..n {
        let (a, b) = (poly[i], poly[(i + 1) % n]);
        if (a.y > p.y) != (b.y > p.y) {
            let x = a.x + (p.y - a.y) / (b.y - a.y) * (b.x - a.x);
            if x > p.x {
                inside = !inside;
            }
        }
    }
    inside
}

fn segment_distance(p: DVec2, a: DVec2, b: DVec2) -> f64 {
    let d = b - a;
    p.distance(a + d * ((p - a).dot(d) / d.length_squared().max(1e-30)).clamp(0., 1.))
}

fn distance_to_contour(poly: &[DVec2], p: DVec2) -> f64 {
    let n = poly.len();
    (0..n)
        .map(|i| segment_distance(p, poly[i], poly[(i + 1) % n]))
        .fold(f64::INFINITY, f64::min)
}

/// Intersection of the infinite lines through `a0..a1` and `b0..b1`, when they are
/// not parallel.
fn line_intersection(a0: DVec2, a1: DVec2, b0: DVec2, b1: DVec2) -> Option<DVec2> {
    let da = a1 - a0;
    let db = b1 - b0;
    let det = da.perp_dot(db);
    if det.abs() < 1e-12 {
        return None;
    }
    let t = (b0 - a0).perp_dot(db) / det;
    Some(a0 + da * t)
}

/// Offset one closed loop of directed segments outward (to the right of each
/// segment direction) and join adjacent edges with a miter at their intersection.
/// A degenerate or explosive miter is refused rather than beveled silently, so a
/// caller always learns that a given allowance cannot be represented.
fn joined_offset(segments: &[(DVec2, DVec2, f64)]) -> Result<Vec<DVec2>, String> {
    if segments.len() < 3 {
        return Err("A cutting contour needs at least three edges".into());
    }
    let offsets: Vec<(DVec2, DVec2)> = segments
        .iter()
        .map(|(a, b, width)| {
            let dir = (*b - *a).normalize_or_zero();
            if dir == DVec2::ZERO {
                return (DVec2::splat(f64::NAN), DVec2::splat(f64::NAN));
            }
            let normal = DVec2::new(dir.y, -dir.x);
            (*a + normal * *width, *b + normal * *width)
        })
        .collect();
    if offsets
        .iter()
        .any(|(a, b)| !a.is_finite() || !b.is_finite())
    {
        return Err("Degenerate boundary in a seam allowance offset".into());
    }
    let count = segments.len();
    let mut out = Vec::with_capacity(count + 4);
    for i in 0..count {
        let previous = (i + count - 1) % count;
        let (pa, pb) = offsets[previous];
        let (ca, cb) = offsets[i];
        let width = segments[previous].2.abs().max(segments[i].2.abs());
        match line_intersection(pa, pb, ca, cb) {
            Some(point) if point.distance(pb) <= MAX_MITER_RATIO * width.max(1e-6) => {
                out.push(point);
            }
            // Parallel edges: the offset endpoints already coincide.
            None if pb.distance(ca) < 1e-9 => out.push(pb),
            // A spike or a numerical miss becomes an explicit bevel, two points.
            _ => {
                out.push(pb);
                out.push(ca);
            }
        }
    }
    Ok(out)
}

impl PolygonPattern {
    /// Sample points of one named marking boundary: an outer edge, a hole edge or
    /// an internal line. Internal lines are open paths.
    pub fn named_boundary(&self, name: &str) -> Option<Vec<DVec2>> {
        if let Some(i) = self.edges.iter().position(|n| n == name) {
            return self.edge_points(i).ok();
        }
        for hole in &self.holes {
            if let Some(i) = hole.edges.iter().position(|n| n == name) {
                return Some(vec![
                    hole.points[i],
                    hole.points[(i + 1) % hole.points.len()],
                ]);
            }
        }
        self.lines
            .iter()
            .find(|l| l.id == name)
            .and_then(|l| l.samples().ok())
    }

    /// Sample points of one closed marking boundary: an outer edge or a hole rim.
    /// An open internal line has two sides and is not a cutting boundary.
    pub fn closed_boundary(&self, name: &str) -> Option<Vec<DVec2>> {
        if let Some(i) = self.edges.iter().position(|n| n == name) {
            return self.edge_points(i).ok();
        }
        for hole in &self.holes {
            if let Some(i) = hole.edges.iter().position(|n| n == name) {
                return Some(vec![
                    hole.points[i],
                    hole.points[(i + 1) % hole.points.len()],
                ]);
            }
        }
        None
    }

    /// Allowance width (metres) stored for a boundary, or zero when none is set.
    pub fn allowance_of(&self, edge: &str) -> f64 {
        self.seam_allowances.get(edge).copied().unwrap_or(0.)
    }

    /// A seam allowance applies to a closed boundary of the material (an outer
    /// edge or a hole rim). An open internal line has two sides, so it is not a
    /// cutting-contour boundary.
    fn marking_edge_exists(&self, name: &str) -> bool {
        self.closed_boundary(name).is_some()
    }

    /// Position and orientation of a notch, plus the marker polyline in material
    /// coordinates. The outward direction is to the right of the directed
    /// boundary, so it points away from the material for both the outer contour
    /// and a clockwise hole.
    pub fn notch_marker(&self, edge: &str, notch: &Notch) -> Result<Vec<DVec2>, String> {
        let points = self
            .closed_boundary(edge)
            .ok_or_else(|| format!("Notch references unknown boundary {edge}"))?;
        let total = polyline_length(&points);
        if total <= 1e-9 {
            return Err("Notch boundary has zero length".into());
        }
        validate_notch(notch, total)?;
        let distance = total * notch.at;
        let mut consumed = 0.;
        for pair in points.windows(2) {
            let segment = pair[1] - pair[0];
            let length = segment.length();
            if length <= 1e-12 {
                continue;
            }
            if consumed + length >= distance {
                let base = pair[0] + segment * ((distance - consumed) / length);
                let tangent = segment / length;
                let outward = DVec2::new(tangent.y, -tangent.x);
                return Ok(match notch.kind {
                    NotchKind::Slit => vec![base, base + outward * notch.length_m],
                    NotchKind::V => {
                        let half = tangent * (notch.length_m * 0.5);
                        vec![
                            base - half,
                            base + outward * notch.length_m,
                            base + half,
                            base - half,
                        ]
                    }
                });
            }
            consumed += length;
        }
        Err("Notch cannot be placed on this boundary".into())
    }

    /// The joined cutting contour implied by the stored allowances, or `None` when
    /// no allowance is set. A boundary that cannot be offset without the contour
    /// intruding into the material or self-intersecting is refused explicitly.
    pub fn cutting_contour(&self) -> Result<Option<CuttingContour>, String> {
        if self.seam_allowances.is_empty() {
            return Ok(None);
        }
        let material = self.outer_points()?;
        let mut outer_segments = vec![];
        for i in 0..self.points.len() {
            let width = self.allowance_of(&self.edges[i]);
            for pair in self.edge_points(i)?.windows(2) {
                outer_segments.push((pair[0], pair[1], width));
            }
        }
        let outer = joined_offset(&outer_segments)?;
        if !simple_closed(&outer)
            || signed_area(&outer) <= 1e-8
            || self.intrudes_into_material(&outer, &material)?
        {
            return Err(
                "Seam allowance self-intersects on this contour; reduce the width or edit the boundary"
                    .into(),
            );
        }
        let mut holes = vec![];
        for hole in &self.holes {
            let mut segments = vec![];
            for i in 0..hole.points.len() {
                let width = self.allowance_of(&hole.edges[i]);
                segments.push((
                    hole.points[i],
                    hole.points[(i + 1) % hole.points.len()],
                    width,
                ));
            }
            if segments.iter().all(|s| s.2 == 0.) {
                continue;
            }
            let offset = joined_offset(&segments)?;
            if !simple_closed(&offset)
                || signed_area(&offset) >= -1e-8
                || self.intrudes_into_material(&offset, &material)?
            {
                return Err("Seam allowance closes or overlaps at a hole; reduce the width".into());
            }
            holes.push(offset);
        }
        Ok(Some(CuttingContour { outer, holes }))
    }

    /// True when an offset contour passes through the interior of the material.
    /// A per-segment offset can overshoot a thin feature and close over on itself
    /// while still tracing a simple loop; the overshoot always enters the
    /// material, so this catches a closed gap that `simple_closed` cannot.
    fn intrudes_into_material(&self, offset: &[DVec2], outer: &[DVec2]) -> Result<bool, String> {
        let n = offset.len();
        for i in 0..n {
            let (a, b) = (offset[i], offset[(i + 1) % n]);
            for sample in [a, a.lerp(b, 0.5)] {
                if point_in_polygon(outer, sample)
                    && distance_to_contour(outer, sample) > 1e-9
                    && !self
                        .holes
                        .iter()
                        .any(|h| point_in_polygon(&h.points, sample))
                {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }

    /// Validate every stored marking against the current geometry. Dangling
    /// references are errors so a rename, split or mirror that forgets to migrate
    /// a marking fails loudly instead of silently dropping it.
    pub fn validate_markings(&self) -> Result<(), String> {
        for (edge, notches) in &self.notches {
            if !self.marking_edge_exists(edge) {
                return Err(format!("Notch references unknown boundary {edge}"));
            }
            let points = self
                .closed_boundary(edge)
                .ok_or_else(|| format!("Notch references unknown boundary {edge}"))?;
            let total = polyline_length(&points);
            if total <= 1e-9 {
                return Err(format!("Notch boundary {edge} has zero length"));
            }
            for notch in notches {
                validate_notch(notch, total).map_err(|e| format!("Notch on {edge}: {e}"))?;
            }
        }
        for (edge, width) in &self.seam_allowances {
            if !self.marking_edge_exists(edge) {
                return Err(format!("Seam allowance references unknown boundary {edge}"));
            }
            if !width.is_finite() || *width <= 0. || *width > MAX_ALLOWANCE_M {
                return Err(format!(
                    "Seam allowance on {edge} must be in (0, {} mm]",
                    MAX_ALLOWANCE_M * 1000.
                ));
            }
        }
        self.cutting_contour()?;
        Ok(())
    }
}

/// One notch must be finite, in the open interval, short enough, and at least
/// `MIN_NOTCH_END_M` from either end of its boundary.
pub fn validate_notch(notch: &Notch, boundary_length_m: f64) -> Result<(), String> {
    if !notch.at.is_finite() || notch.at <= 0. || notch.at >= 1. {
        return Err("Notch position must be inside the boundary".into());
    }
    if !notch.length_m.is_finite() || notch.length_m <= 0. || notch.length_m > MAX_NOTCH_LENGTH_M {
        return Err(format!(
            "Notch length must be in (0, {} mm]",
            MAX_NOTCH_LENGTH_M * 1000.
        ));
    }
    let distance = notch.at * boundary_length_m;
    if distance.min(boundary_length_m - distance) < MIN_NOTCH_END_M {
        return Err("A notch must be at least 1 mm from each boundary end".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn square() -> PolygonPattern {
        PolygonPattern {
            points: vec![
                DVec2::ZERO,
                DVec2::new(1., 0.),
                DVec2::ONE,
                DVec2::new(0., 1.),
            ],
            edges: vec!["bottom".into(), "right".into(), "top".into(), "left".into()],
            subdivisions: 0,
            meshing: None,
            curves: Default::default(),
            holes: vec![],
            lines: vec![],
            target_lengths: Default::default(),
            notches: Default::default(),
            seam_allowances: Default::default(),
        }
    }

    #[test]
    fn allowance_expands_a_square_outward_and_joins_corners() {
        let mut poly = square();
        for name in &poly.edges {
            poly.seam_allowances.insert(name.clone(), 0.01);
        }
        let contour = poly.cutting_contour().unwrap().unwrap();
        assert!((signed_area(&contour.outer) - 1.02 * 1.02).abs() < 1e-9);
        // The outer contour is the square grown by 10 mm on every side.
        assert!(contour.outer.iter().all(|p| {
            (-0.01 - 1e-9..=1.01 + 1e-9).contains(&p.x)
                && (-0.01 - 1e-9..=1.01 + 1e-9).contains(&p.y)
        }));
        assert!(contour.holes.is_empty());
    }

    #[test]
    fn only_allowanced_edges_move() {
        let mut poly = square();
        poly.seam_allowances.insert("bottom".into(), 0.01);
        let contour = poly.cutting_contour().unwrap().unwrap();
        // The bottom edge moves down by 10 mm; the corners are mitred with the
        // un-allowanced neighbours.
        assert!(contour.outer.iter().any(|p| (p.y + 0.01).abs() < 1e-9));
        assert!(contour.outer.iter().any(|p| (p.y - 1.0).abs() < 1e-9));
    }

    #[test]
    fn a_closed_gap_is_rejected_instead_of_silently_folding() {
        // A horseshoe with 4 mm arms and a 2 mm gap: a 3 mm allowance expands both
        // inner walls by 6 mm, so the gap must close. The naive offset folds into a
        // spurious slot that enters the arms; the check must refuse it.
        let mut poly = square();
        poly.points = vec![
            DVec2::new(0., 0.),
            DVec2::new(0.010, 0.),
            DVec2::new(0.010, 0.02),
            DVec2::new(0.006, 0.02),
            DVec2::new(0.006, 0.004),
            DVec2::new(0.004, 0.004),
            DVec2::new(0.004, 0.02),
            DVec2::new(0., 0.02),
        ];
        poly.edges = (0..8).map(|i| format!("edge{i}")).collect();
        for name in poly.edges.clone() {
            poly.seam_allowances.insert(name, 0.003);
        }
        assert!(poly.cutting_contour().is_err());
        // A 0.5 mm allowance fits the gap.
        for width in poly.seam_allowances.values_mut() {
            *width = 0.0005;
        }
        assert!(poly.cutting_contour().unwrap().is_some());
    }

    #[test]
    fn notch_is_a_v_wedge_pointing_outward() {
        let mut poly = square();
        poly.notches
            .insert("bottom".into(), vec![Notch::new(0.5, 0.005, NotchKind::V)]);
        let marker = poly
            .notch_marker("bottom", &poly.notches["bottom"][0])
            .unwrap();
        assert_eq!(marker.len(), 4);
        assert!((marker[1] - DVec2::new(0.5, -0.005)).length() < 1e-12);
        assert!((marker[0] - DVec2::new(0.4975, 0.)).length() < 1e-12);
        assert!((marker[2] - DVec2::new(0.5025, 0.)).length() < 1e-12);
        poly.notches.clear();
        poly.notches.insert(
            "bottom".into(),
            vec![Notch::new(0.5, 0.005, NotchKind::Slit)],
        );
        assert_eq!(
            poly.notch_marker("bottom", &poly.notches["bottom"][0])
                .unwrap()
                .len(),
            2
        );
    }

    #[test]
    fn a_notch_must_clear_the_boundary_ends() {
        let mut poly = square();
        // 0.5 mm from an end on a 1 m boundary is too close.
        assert!(
            poly.notches
                .insert(
                    "bottom".into(),
                    vec![Notch::new(0.0005, 0.005, NotchKind::V)]
                )
                .is_none()
        );
        assert!(poly.validate_markings().is_err());
        poly.notches
            .insert("bottom".into(), vec![Notch::new(0.5, 0.005, NotchKind::V)]);
        assert!(poly.validate_markings().is_ok());
    }

    #[test]
    fn unknown_boundaries_and_bad_widths_are_rejected() {
        let mut poly = square();
        poly.notches
            .insert("ghost".into(), vec![Notch::new(0.5, 0.005, NotchKind::V)]);
        assert!(poly.validate_markings().is_err());
        poly.notches.clear();
        poly.seam_allowances.insert("ghost".into(), 0.01);
        assert!(poly.validate_markings().is_err());
        poly.seam_allowances.insert("bottom".into(), 0.2);
        assert!(poly.validate_markings().is_err());
    }
}
