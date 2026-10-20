//! Transactional authoring in material coordinates, independent of UI and solver.
//! Compile before accepting an edit. Reset physical state only when Edit requests it.
use crate::{
    garment::{
        CompiledGarment, GarmentTemplate, curves,
        meshing::MeshingSettings,
        polygon::{EdgeNotch, PatternAnnotation, PatternMeasurement, PolygonPattern},
        seam::{BoundaryRef, SeamSpec},
        template::{Fabric, FabricProperties, Panel, Placement},
    },
    model::{Pattern, State},
};
use glam::{DQuat, DVec2, DVec3, EulerRot};
pub mod clipboard;
mod geometry;
use crate::garment::shapes::{BooleanOp, MirrorAxis, Primitive};

pub enum Command {
    Paste {
        clipboard: clipboard::PatternClipboard,
        center: DVec2,
    },
    LayoutGroup {
        panels: Vec<String>,
        delta: DVec2,
    },
    /// Store or replace a measured span between named material cutline stations.
    SetMeasurement { panel: String, measurement: PatternMeasurement },
    RemoveMeasurement { panel: String, id: String },
    Annotation { panel: String, id: Option<String>, text: String, position: DVec2 },
    RemoveAnnotation { panel: String, id: String },
    Primitive {
        kind: Primitive,
        size: DVec2,
        sweep_degrees: f64,
        origin: DVec2,
        meshing: MeshingSettings,
        fabric: String,
        replace: bool,
    },
    Mirror {
        panel: String,
        axis: MirrorAxis,
        copy_side: Option<i8>,
    },
    Boolean {
        a: String,
        b: String,
        op: BooleanOp,
        keep_tool: bool,
    },
    InternalLine {
        panel: String,
        points: Vec<DVec2>,
        tangents: Vec<DVec2>,
    },
    RemoveLine {
        panel: String,
        line: String,
    },
    Ruffle {
        panel: String,
        line: String,
        width: f64,
        ratio: f64,
    },
    Polygon {
        points: Vec<DVec2>,
        tangents: Vec<DVec2>,
        meshing: MeshingSettings,
        fabric: String,
        replace: bool,
    },
    Place {
        panel: String,
        placement: Placement,
    },
    Shape {
        panel: String,
        polygon: PolygonPattern,
    },
    /// Exact numeric size of a rectangular panel, in metres.
    Dimensions {
        panel: String,
        width: f64,
        height: f64,
    },
    /// Place one contour point at exact material coordinates, in metres.
    Anchor {
        panel: String,
        anchor: usize,
        position: DVec2,
    },
    /// Translate a selection of contour points by a material delta, in metres.
    MovePoints {
        panel: String,
        points: Vec<usize>,
        delta: DVec2,
    },
    /// Move contour points by an exact metric step given in millimetres.
    Nudge {
        panel: String,
        points: Vec<usize>,
        delta_mm: DVec2,
    },
    /// Insert one contour point on a named boundary at a material arclength in
    /// metres from its first endpoint. The first half keeps the boundary name;
    /// the second half receives a deterministic derived name.
    SplitBoundary {
        panel: String,
        edge: String,
        at_m: f64,
    },
    /// Create an actual V-shaped cut-and-sewn dart along an unsewn straight
    /// boundary. The triangular material wedge is cut away and the two new
    /// equal-length dart legs become a persistent same-panel solver seam.
    /// This is NOT the uncut folded-tuck model used in some garments.
    DartCutSew {
        panel: String,
        edge: String,
        left_t: f64,
        right_t: f64,
        apex: DVec2,
    },
    /// Remove one contour point and rejoin its two neighbouring boundaries.
    RemovePoint {
        panel: String,
        point: usize,
    },
    /// Curve (true) or straighten (false) both boundaries incident to a point.
    CurvePoint {
        panel: String,
        anchor: usize,
        curved: bool,
    },
    /// Required length of a named boundary, in metres. `0.0` clears the stored
    /// target without moving geometry; a positive value stores and enforces it.
    TargetLength {
        panel: String,
        edge: String,
        target_m: f64,
    },
    /// Add or replace a notch marker at fractional boundary arclength.
    Notch {
        panel: String,
        edge: String,
        t: f64,
        depth_m: f64,
    },
    /// Two physical matching notches, symmetrical around one arclength
    /// station, added as one atomic authoring/history transaction.
    NotchPair {
        panel: String,
        edge: String,
        center_t: f64,
        spacing_m: f64,
        depth_m: f64,
    },
    /// Remove the notch at fractional boundary arclength (within 1e-9).
    RemoveNotch {
        panel: String,
        edge: String,
        t: f64,
    },
    /// Set a per-boundary cutting guide width; zero clears it.
    SeamAllowance {
        panel: String,
        edge: String,
        width_m: f64,
    },
    Layout {
        panel: String,
        origin: DVec2,
    },
    BoardTransform {
        panel: String,
        origin: DVec2,
        rotation_degrees: f64,
    },
    Duplicate {
        panel: String,
    },
    RemovePanel {
        panel: String,
    },
    Sew {
        a: BoundaryRef,
        b: BoundaryRef,
        reverse: bool,
        ease: bool,
    },
    /// Replace an existing seam or create one ordered M:N rest-arclength relation.
    SewChain {
        seam: Option<String>,
        a: Vec<BoundaryRef>,
        b: Vec<BoundaryRef>,
        reverse: bool,
        ease: bool,
    },
    RemoveSeam {
        seam: String,
    },
    Fabric {
        panel: String,
        name: String,
        properties: FabricProperties,
        all_panels: bool,
    },
}

pub struct Edit {
    pub template: GarmentTemplate,
    pub garment: CompiledGarment,
    pub selected: Option<String>,
    pub reset_simulation: bool,
    /// Contour point index created by this edit, when the command inserted one.
    pub new_point: Option<usize>,
}

impl Edit {
    /// Keep the drape of panels whose compiled rest geometry and arrangement
    /// are unchanged. Match by panel ID and local indices, never global offsets.
    /// New/remeshed/moved panels start from their new arrangement. Solver/contact
    /// caches must still be rebuilt, even when all positions are preserved.
    pub fn state_after(&self, previous: &CompiledGarment, state: &State) -> State {
        let mut next = self.garment.initial_state.clone();
        next.time = state.time;
        if state.x.len() != previous.mesh.uv.len() || state.v.len() != state.x.len() {
            return next;
        }
        for new in &self.garment.panels {
            let Some(old) = previous.panels.iter().find(|p| p.id == new.id) else {
                continue;
            };
            let a = old.vertices.clone();
            let b = new.vertices.clone();
            if previous.mesh.uv[a.clone()] != self.garment.mesh.uv[b.clone()]
                || previous.initial_state.x[a.clone()] != self.garment.initial_state.x[b.clone()]
                || previous.mesh.pins[a.clone()] != self.garment.mesh.pins[b.clone()]
                || !previous.mesh.triangles[old.triangles.clone()]
                    .iter()
                    .map(|t| t.vertices.map(|i| i - a.start))
                    .eq(self.garment.mesh.triangles[new.triangles.clone()]
                        .iter()
                        .map(|t| t.vertices.map(|i| i - b.start)))
            {
                continue;
            }
            next.x[b.clone()].copy_from_slice(&state.x[a.clone()]);
            next.v[b].copy_from_slice(&state.v[a]);
        }
        next
    }
}

pub fn layout(template: &GarmentTemplate, index: usize) -> DVec2 {
    template.panels[index].layout_2d.unwrap_or_else(|| {
        DVec2::new(
            template.panels[..index]
                .iter()
                .map(|p| p.pattern.width + 0.15)
                .sum(),
            0.,
        )
    })
}
pub fn same_physics(a: &GarmentTemplate, b: &GarmentTemplate) -> bool {
    let without_layout = |t: &GarmentTemplate| {
        let mut t = t.clone();
        for p in &mut t.panels {
            p.layout_2d = None;
            p.layout_rotation_degrees = 0.;
            // A required boundary length is a 2D specification, not rest
            // geometry: storing or clearing it must not invalidate the drape.
            if let Some(polygon) = p.polygon.as_mut() {
                polygon.target_lengths.clear();
                polygon.notches.clear();
                polygon.seam_allowances.clear();
                polygon.annotations.clear();
                polygon.measurements.clear();
            }
        }
        serde_json::to_vec(&t).unwrap()
    };
    without_layout(a) == without_layout(b)
}
pub fn rotate_2d(p: DVec2, degrees: f64) -> DVec2 {
    let (s, c) = degrees.to_radians().sin_cos();
    DVec2::new(c * p.x - s * p.y, s * p.x + c * p.y)
}
fn normalize(panel: &mut Panel) {
    let poly = panel.polygon.as_mut().unwrap();
    let lo = poly
        .points
        .iter()
        .chain(poly.curves.values().flatten())
        .chain(poly.free_curve_points.values().flatten().map(|mark| &mark.position))
        .copied()
        .fold(DVec2::splat(f64::INFINITY), DVec2::min);
    let hi = poly
        .points
        .iter()
        .chain(poly.curves.values().flatten())
        .chain(poly.free_curve_points.values().flatten().map(|mark| &mark.position))
        .copied()
        .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max);
    poly.translate_material(-lo);
    for annotation in &mut poly.annotations { annotation.position -= lo; }
    for p in &mut panel.pin_points {
        *p -= lo;
    }
    panel.layout_2d =
        Some(panel.layout_2d.unwrap_or_default() + rotate_2d(lo, panel.layout_rotation_degrees));
    panel.placement.translation = panel.placement.transform(DVec3::new(lo.x, -lo.y, 0.));
    panel.pattern.width = (hi - lo).x;
    panel.pattern.height = (hi - lo).y;
}

/// Exact rectangle resize. The four corners are assigned the requested
/// coordinates directly instead of being scaled, so 400 x 600 mm stays exactly
/// 0.4 x 0.6 m in memory and through a JSON round trip. Only an axis-aligned
/// four-corner contour can carry an exact numeric size; a curved or general
/// polygon keeps its shape and is resized by editing its points.
fn resize_rectangle(panel: &mut Panel, width: f64, height: f64) -> Result<(), String> {
    const TOL: f64 = 1e-9;
    let polygon = panel
        .polygon
        .as_mut()
        .ok_or("This panel has no editable contour")?;
    if polygon.points.len() != 4 || !polygon.curves.is_empty() || !polygon.free_curve_points.is_empty() {
        return Err("Exact dimensions require a four-corner rectangle".into());
    }
    let lo = polygon
        .points
        .iter()
        .copied()
        .fold(DVec2::splat(f64::INFINITY), DVec2::min);
    let hi = polygon
        .points
        .iter()
        .copied()
        .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max);
    if hi.x - lo.x <= TOL || hi.y - lo.y <= TOL {
        return Err("Exact dimensions require a non-degenerate rectangle".into());
    }
    let on_axis =
        |value: f64, low: f64, high: f64| (value - low).abs() < TOL || (value - high).abs() < TOL;
    if !polygon
        .points
        .iter()
        .all(|p| on_axis(p.x, lo.x, hi.x) && on_axis(p.y, lo.y, hi.y))
    {
        return Err("Exact dimensions require an axis-aligned four-corner rectangle".into());
    }
    let mid = (lo + hi) * 0.5;
    let snapped = |p: DVec2| {
        DVec2::new(
            if p.x <= mid.x { 0. } else { width },
            if p.y <= mid.y { 0. } else { height },
        )
    };
    for p in &mut polygon.points {
        *p = snapped(*p);
    }
    let scale = DVec2::new(width, height) / (hi - lo);
    for hole in &mut polygon.holes {
        for point in &mut hole.points {
            *point = (*point - lo) * scale;
        }
    }
    for line in &mut polygon.lines {
        for point in &mut line.points {
            *point = (*point - lo) * scale;
        }
        for tangent in &mut line.tangents {
            *tangent *= scale;
        }
    }
    for annotation in &mut polygon.annotations {
        annotation.position = (annotation.position - lo) * scale;
    }
    for point in &mut panel.pin_points {
        *point = (*point - lo) * scale;
    }
    Ok(())
}

fn unused_id(prefix: &str, ids: impl Iterator<Item = String>) -> String {
    let ids: std::collections::BTreeSet<_> = ids.collect();
    (1..)
        .map(|i| format!("{prefix}_{i}"))
        .find(|s| !ids.contains(s))
        .unwrap()
}

/// Millimetres to metres. Division by 1000 is correctly rounded, so 400 mm is
/// the exact f64 0.4; `mm * 0.001` is not.
pub fn mm_to_m(mm: f64) -> f64 {
    mm / 1000.0
}
/// Metres to millimetres. For readouts only; never feed this back into the model.
pub fn m_to_mm(metres: f64) -> f64 {
    metres * 1000.0
}
/// Sampled rest arclength of one named boundary in metres, using the same
/// sampling as the mesher and the seam compiler.
pub fn edge_length(polygon: &PolygonPattern, edge: &str) -> Result<f64, String> {
    let index = polygon
        .edges
        .iter()
        .position(|name| name == edge)
        .ok_or("Boundary not found")?;
    Ok(polygon
        .edge_points(index)?
        .windows(2)
        .map(|pair| pair[0].distance(pair[1]))
        .sum())
}
/// Signed deviation of a measured length from a target, in millimetres.
pub fn deviation_mm(measured_m: f64, target_m: f64) -> f64 {
    m_to_mm(measured_m - target_m)
}

/// Keep material pin points attached to the contour anchors they coincide with.
fn follow_pins(panel: &mut Panel, moved: &[(usize, DVec2)]) {
    let Some(polygon) = panel.polygon.as_ref() else {
        return;
    };
    let deltas: Vec<(DVec2, DVec2)> = moved
        .iter()
        .map(|(index, before)| (*before, polygon.points[*index] - *before))
        .collect();
    for pin in &mut panel.pin_points {
        for (before, delta) in &deltas {
            if pin.distance(*before) < 1e-9 {
                *pin += *delta;
                break;
            }
        }
    }
}

/// Assign new local coordinates to contour anchors. The selection is deduplicated
/// and validated; absolute coordinates are assigned directly, so no rounding is
/// introduced for a typed position.
fn remap_anchors(
    panel: &mut Panel,
    indices: &[usize],
    map: impl Fn(DVec2) -> DVec2,
) -> Result<(), String> {
    let count = panel
        .polygon
        .as_ref()
        .ok_or("This panel has no editable contour")?
        .points
        .len();
    let mut unique = indices.to_vec();
    unique.sort_unstable();
    unique.dedup();
    if unique.is_empty() {
        return Err("Select at least one point".into());
    }
    if unique.iter().any(|index| *index >= count) {
        return Err("Point index out of range".into());
    }
    let before: Vec<DVec2> = {
        let polygon = panel.polygon.as_ref().unwrap();
        unique.iter().map(|index| polygon.points[*index]).collect()
    };
    let after: Vec<DVec2> = before.iter().map(|point| map(*point)).collect();
    {
        let polygon = panel.polygon.as_mut().unwrap();
        for ((index, position), old) in unique.iter().zip(&after).zip(&before) {
            let delta = *position - *old;
            polygon.points[*index] = *position;
            if let Some(controls) = polygon.curves.get_mut(&polygon.edges[*index]) {
                controls[0] += delta;
            }
            let previous = (*index + count - 1) % count;
            if let Some(controls) = polygon.curves.get_mut(&polygon.edges[previous]) {
                controls[1] += delta;
            }
        }
    }
    let moved: Vec<(usize, DVec2)> = unique.into_iter().zip(before).collect();
    follow_pins(panel, &moved);
    Ok(())
}

/// Deterministic successor name for the second half of a split boundary. The
/// first half keeps the existing name, so no unrelated identifier changes.
fn split_edge_name(edges: &[String], base: &str) -> String {
    let prefix: String = base.chars().take(60).collect();
    (2..)
        .map(|suffix| format!("{prefix}_{suffix}"))
        .find(|candidate| !edges.iter().any(|name| name == candidate))
        .expect("a free split name exists")
}

/// de Casteljau split: the two cubics that together reproduce the input exactly.
fn split_cubic(cubic: [DVec2; 4], t: f64) -> ([DVec2; 4], [DVec2; 4]) {
    let p01 = cubic[0].lerp(cubic[1], t);
    let p12 = cubic[1].lerp(cubic[2], t);
    let p23 = cubic[2].lerp(cubic[3], t);
    let p012 = p01.lerp(p12, t);
    let p123 = p12.lerp(p23, t);
    let middle = p012.lerp(p123, t);
    ([cubic[0], p01, p012, middle], [middle, p123, p23, cubic[3]])
}

/// Cubic parameter whose sampled arclength from the curve start is `at_m`. Any
/// parameter splits a cubic exactly; bisection only chooses where the point lands.
fn parameter_at_arclength(cubic: [DVec2; 4], at_m: f64) -> Result<f64, String> {
    let mut low = 0.0;
    let mut high = 1.0;
    for _ in 0..48 {
        let middle = (low + high) * 0.5;
        let (left, _) = split_cubic(cubic, middle);
        let length: f64 = curves::flatten(left, curves::FLATNESS_M)?
            .windows(2)
            .map(|pair| pair[0].distance(pair[1]))
            .sum();
        if length < at_m {
            low = middle;
        } else {
            high = middle;
        }
    }
    Ok((low + high) * 0.5)
}

/// Find a physical station that is already a saved free-knot endpoint.
/// The UI may express the clicked station through the meshed boundary rather
/// than the analytically identical cubic; snapping within 0.50 mm promotes the
/// existing knot instead of creating a nearly coincident duplicate vertex.
/// The geometric split and all attached sewing/notch station maps must use
/// this same canonical arclength.
fn canonical_free_split_station(
    polygon: &PolygonPattern,
    edge: &str,
    at_m: f64,
) -> Result<f64, String> {
    let Some(marks) = polygon.free_curve_points.get(edge) else {
        return Ok(at_m);
    };
    if marks.is_empty() { return Ok(at_m); }
    let index = polygon.edges.iter().position(|name| name == edge)
        .ok_or("Boundary not found")?;
    let spans = polygon.edge_cubic_spans(index)?;
    let mut distance = 0.;
    let mut nearest = None;
    for (k, (_, cubic)) in spans.iter().enumerate() {
        let sample = curves::flatten(*cubic, curves::FLATNESS_M)?;
        distance += sample.windows(2).map(|pair| pair[0].distance(pair[1])).sum::<f64>();
        if k >= marks.len() { break; }
        let error = (distance - at_m).abs();
        if error <= 0.0005 && nearest.is_none_or(|(_, closest_error)| error < closest_error) {
            nearest = Some((distance, error));
        }
    }
    Ok(nearest.map_or(at_m, |(position, _)| position))
}

/// A linked reflected cutline cannot be edited one side at a time. Select the
/// unique mirrored partner and its *physical* station before either boundary
/// is touched; Bézier parameters are not distance fractions. Refuse purported
/// mirror metadata if the two actual cubic contours do not match under
/// reflection, even when the saved control points happen to match.
fn mirrored_split_partner(
    polygon: &PolygonPattern, edge: &str, at_m: f64,
) -> Result<Option<(String, f64)>, String> {
    let Some(marks) = polygon.free_curve_points.get(edge) else { return Ok(None); };
    let groups: Vec<&str> = marks.iter().filter_map(|p| p.mirror_group.as_deref()).collect();
    if groups.is_empty() { return Ok(None); }
    let mut partner: Option<&str> = None;
    for group in &groups {
        let owners: Vec<_> = polygon.free_curve_points.iter().flat_map(|(owner, marks)|
            marks.iter().filter(move |mark| mark.mirror_group.as_deref() == Some(group))
                .map(move |_| owner.as_str())).collect();
        if owners.len() != 2 || owners[0] == owners[1] {
            return Err("Mirrored split requires exactly two controls on different boundaries".into());
        }
        let other = owners.iter().copied().find(|owner| *owner != edge)
            .ok_or("Mirrored curve partner boundary not found")?;
        if partner.is_some_and(|existing| existing != other) {
            return Err("Mirrored controls on one edge reference multiple partner boundaries".into());
        }
        partner = Some(other);
    }
    let other = partner.ok_or("Mirrored curve partner boundary not found")?;
    if polygon.free_curve_points.get(other).is_some_and(|points| points.iter()
        .filter_map(|p| p.mirror_group.as_deref()).any(|group| !groups.contains(&group))) {
        return Err("Mirrored partner has unrelated linked controls".into());
    }
    let a = polygon.edges.iter().position(|candidate| candidate == edge)
        .ok_or("Mirrored source boundary not found")?;
    let b = polygon.edges.iter().position(|candidate| candidate == other)
        .ok_or("Mirrored partner boundary not found")?;
    let first = polygon.edge_cubic_spans(a)?;
    let second = polygon.edge_cubic_spans(b)?;
    let at = |spans: &Vec<([f64; 2], [DVec2; 4])>, t: f64| -> Result<DVec2, String> {
        let (range, cubic) = spans.iter().find(|(range,_)| t >= range[0] - 1e-12 && t <= range[1] + 1e-12)
            .ok_or("Mirrored boundary has no enclosing cubic span")?;
        Ok(curves::cubic(*cubic, ((t - range[0]) / (range[1] - range[0])).clamp(0., 1.)))
    };
    let left = polygon.points.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
    let right = polygon.points.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
    for sample in 0..=64 {
        let t = sample as f64 / 64.;
        let x = at(&first, t)?;
        let y = at(&second, 1. - t)?;
        if !x.is_finite() || !y.is_finite()
            || (x.x + y.x - left - right).abs() > 1e-6
            || (x.y - y.y).abs() > 1e-6 {
            return Err("Linked mirror cutlines differ; repair the symmetric geometry before splitting".into());
        }
    }
    let primary_length = edge_length(polygon, edge)?;
    let other_length = edge_length(polygon, other)?;
    if (primary_length - other_length).abs() > 0.00025 {
        return Err("Linked mirrored edges have inconsistent physical lengths".into());
    }
    let primary_station = canonical_free_split_station(polygon, edge, at_m)?;
    let reflected_station = canonical_free_split_station(polygon, other, other_length-primary_station)?;
    if primary_station <= 1e-6 || primary_station >= primary_length-1e-6
        || reflected_station <= 1e-6 || reflected_station >= other_length-1e-6
        || (primary_station + reflected_station - other_length).abs() > 0.0005 {
        return Err("Mirrored split station cannot be safely paired".into());
    }
    Ok(Some((other.to_owned(), reflected_station)))
}

/// Split an authored piecewise-cubic cutline at a physical distance. The
/// original curve is a chain of exact Hermite cubics, with knot derivatives
/// measured against the source edge's unit parameter. A child needs its own
/// normalized parameter, so both endpoint and retained knot derivatives are
/// scaled by the corresponding source parameter interval. This preserves the
/// *entire cubic trajectory* (including free-knot positions and tangents)
/// independently of mesh sampling, rather than merely preserving a polyline.
fn split_free_curve_geometry(
    polygon: &PolygonPattern,
    index: usize,
    at_m: f64,
) -> Result<
    (DVec2, [DVec2; 2], [DVec2; 2],
        Vec<crate::garment::polygon::FreeCurvePoint>,
        Vec<crate::garment::polygon::FreeCurvePoint>, Option<String>),
    String,
> {
    let spans = polygon.edge_cubic_spans(index)?;
    let edge = &polygon.edges[index];
    let old_marks = polygon.free_curve_points.get(edge).ok_or("Free curve point list not found")?;
    if old_marks.is_empty() {
        return Err("Free curve split requires authored points".into());
    }
    // Mirrored controls must remain reflected pairs. Splitting only one side
    // changes its topology and would silently invalidate their relationship.
    if old_marks.iter().any(|mark| mark.mirror_group.is_some()) {
        return Err("Unlink mirrored curve points before splitting the boundary".into());
    }
    let lengths: Vec<f64> = spans.iter()
        .map(|(_, cubic)| curves::flatten(*cubic, curves::FLATNESS_M)
            .map(|sample| sample.windows(2).map(|pair| pair[0].distance(pair[1])).sum()))
        .collect::<Result<_, _>>()?;
    let total: f64 = lengths.iter().sum();
    if !total.is_finite() || total <= 0. || at_m <= 0. || at_m >= total {
        return Err("Invalid free curve split arclength".into());
    }
    let mut consumed = 0.;
    let mut chosen = None;
    for (i, length) in lengths.iter().enumerate() {
        if consumed + length >= at_m {
            chosen = Some((i, at_m - consumed));
            break;
        }
        consumed += length;
    }
    let (span_i, local_m) = chosen.ok_or("Free curve split station out of range")?;
    // A physical station on a knot promotes the free-point ID to a real
    // vertex, keyed by the new outgoing edge. No ID is discarded and there
    // are never illegal t=0/1 free-point records on either child.
    let promoted = if (lengths[span_i] - local_m).abs() <= 1e-7 {
        old_marks.get(span_i)
    } else if local_m <= 1e-7 && span_i > 0 {
        old_marks.get(span_i-1)
    } else {
        None
    };
    if promoted.is_none() && (local_m <= 1e-7 || lengths[span_i] - local_m <= 1e-7) {
        return Err("Split would create an ambiguous free curve endpoint".into());
    }
    let (range, cubic) = spans[span_i];
    let q = if promoted.is_some() {
        if local_m <= 1e-7 { 0. } else { 1. }
    } else {
        parameter_at_arclength(cubic, local_m)?
    };
    if promoted.is_none() && (q <= 1e-6 || q >= 1. - 1e-6) {
        return Err("Split would leave an unstable free curve span".into());
    }
    let t = range[0] + (range[1] - range[0]) * q;
    if t <= 1e-6 || t >= 1. - 1e-6 {
        return Err("Split would create a degenerate free curve child".into());
    }
    let (l, _) = split_cubic(cubic, q);
    let point = l[3];
    let derivative = |at: f64, outgoing: bool| -> Result<DVec2, String> {
        // A hard corner has two distinct derivatives at the same knot. Take
        // the succeeding span for its outgoing handle and the preceding span
        // for its incoming handle, including at an exact split station.
        let (interval, controls) = spans.iter()
            .find(|(interval,_)| at >= interval[0] - 1e-10
                && (at < interval[1] - 1e-10 || (!outgoing && at <= interval[1] + 1e-10)))
            .or_else(|| spans.last().filter(|_| (at - 1.).abs() <= 1e-10))
            .ok_or("Free curve knot is outside the source boundary")?;
        let width = interval[1] - interval[0];
        if width <= 1e-6 {
            return Err("Degenerate free curve derivative interval".into());
        }
        let q = ((at - interval[0]) / width).clamp(0., 1.);
        let derivative = curves::cubic_derivative(*controls, q) / width;
        if !derivative.is_finite() {
            return Err("Invalid free curve derivative".into());
        }
        Ok(derivative)
    };
    let a = polygon.points[index];
    let b = polygon.points[(index + 1) % polygon.points.len()];
    let start_tangent = derivative(0., true)?;
    let cut_in = derivative(t, false)?;
    let cut_out = derivative(t, true)?;
    let end_tangent = derivative(1., false)?;
    let first = [a + start_tangent * (t / 3.), point - cut_in * (t / 3.)];
    let second = [
        point + cut_out * ((1. - t) / 3.),
        b - end_tangent * ((1. - t) / 3.),
    ];
    let mut before = Vec::new();
    let mut after = Vec::new();
    for mark in old_marks {
        if (mark.t - t).abs() <= 1e-6 {
            if promoted.is_some_and(|item| item.id == mark.id) { continue; }
            return Err("Ambiguous free curve knot at split station".into());
        }
        let mut copy = mark.clone();
        if mark.t < t {
            copy.t /= t;
            copy.derivative = None;
            copy.derivative_in = Some(derivative(mark.t, false)? * t);
            copy.derivative_out = Some(derivative(mark.t, true)? * t);
            if copy.t <= 1e-6 || copy.t >= 1.-1e-6 {
                return Err("Split would crowd a free curve point near a child endpoint".into());
            }
            before.push(copy);
        } else {
            copy.t = (copy.t - t) / (1. - t);
            copy.derivative = None;
            copy.derivative_in = Some(derivative(mark.t, false)? * (1. - t));
            copy.derivative_out = Some(derivative(mark.t, true)? * (1. - t));
            if copy.t <= 1e-6 || copy.t >= 1.-1e-6 {
                return Err("Split would crowd a free curve point near a child endpoint".into());
            }
            after.push(copy);
        }
    }
    Ok((point, first, second, before, after, promoted.map(|mark| mark.id.clone())))
}

/// Promote a genuinely mirrored free-knot pair into two contour vertices in
/// one native authoring transaction. Each intermediate SplitBoundary uses the
/// existing (already tested) sewing, notch, allowance and target migration;
/// only a fully compiled result is returned to the UI/history. The original
/// template is never modified on an error.
fn split_linked_mirror_knot(
    source: &GarmentTemplate, panel: &str, edge: &str, at_m: f64,
) -> Result<Option<Edit>, String> {
    let original = source.panels.iter().find(|p| p.id == panel)
        .ok_or("Panel not found")?.polygon.as_ref()
        .ok_or("Editable polygon required")?;
    let Some((partner_edge, partner_at)) = mirrored_split_partner(original, edge, at_m)? else {
        return Ok(None);
    };
    let primary_at = canonical_free_split_station(original, edge, at_m)?;
    let primary_successor = split_edge_name(&original.edges, edge);

    // Record every mirror pairing and the original owning edge before the
    // children are reparameterized. Other mirrored groups survive a split of
    // either pair and must remain linked in the final authored template.
    let mut linked = std::collections::BTreeMap::<String, Vec<(String, String)>>::new();
    for owner in [edge, partner_edge.as_str()] {
        if let Some(points) = original.free_curve_points.get(owner) {
            for mark in points {
                if let Some(group) = &mark.mirror_group {
                    linked.entry(group.clone()).or_default()
                        .push((owner.into(), mark.id.clone()));
                }
            }
        }
    }
    if linked.values().any(|members| members.len() != 2
        || members[0].0 == members[1].0) {
        return Err("Linked mirror split needs complete symmetric point pairs".into());
    }

    // Apply both existing, tested sewing/notch/allowance/target migrations to
    // a detached in-memory clone. The two intermediate edits are not exposed
    // to the UI, history, or caller. If either rejects, the source is intact.
    let mut detached = source.clone();
    let detached_poly = detached.panels.iter_mut().find(|p| p.id == panel)
        .ok_or("Panel not found")?.polygon.as_mut()
        .ok_or("Editable polygon required")?;
    for owner in [edge, partner_edge.as_str()] {
        if let Some(points) = detached_poly.free_curve_points.get_mut(owner) {
            for mark in points { mark.mirror_group = None; }
        }
    }
    let first = apply(&detached, Command::SplitBoundary {
        panel: panel.into(), edge: edge.into(), at_m: primary_at,
    })?;
    let other_successor = {
        let polygon = first.template.panels.iter().find(|p| p.id == panel)
            .ok_or("Panel not found")?.polygon.as_ref()
            .ok_or("Editable polygon required")?;
        split_edge_name(&polygon.edges, &partner_edge)
    };
    let second = apply(&first.template, Command::SplitBoundary {
        panel: panel.into(), edge: partner_edge.clone(), at_m: partner_at,
    })?;
    let mut finished = second.template;
    let polygon = finished.panels.iter_mut().find(|p| p.id == panel)
        .ok_or("Panel not found")?.polygon.as_mut()
        .ok_or("Editable polygon required")?;

    for (group, members) in &linked {
        let mut promoted = Vec::new();
        let mut still_free = Vec::new();
        for (owner, id) in members {
            let child = if owner == edge { &primary_successor } else { &other_successor };
            if polygon.vertex_ids.get(child) == Some(id) {
                promoted.push(child.clone());
                continue;
            }
            let actual = [owner.as_str(), child.as_str()].into_iter()
                .find(|name| polygon.free_curve_points.get(*name)
                    .is_some_and(|points| points.iter().any(|mark| mark.id == *id)))
                .ok_or("Linked point identity lost during mirrored split")?;
            let live = polygon.free_curve_points.get_mut(actual)
                .and_then(|points| points.iter_mut().find(|mark| mark.id == *id))
                .ok_or("Linked point identity lost during mirrored split")?;
            live.mirror_group = Some(group.clone());
            still_free.push(id);
        }
        if promoted.len() == 2 {
            for edge_name in promoted {
                if polygon.vertex_mirror_groups.insert(edge_name, group.clone()).is_some() {
                    return Err("Mirrored vertex already belongs to a different pair".into());
                }
            }
        } else if !promoted.is_empty() || still_free.len() != 2 {
            return Err("Mirrored split promoted only one member of a linked pair".into());
        }
    }
    let new_point = polygon.edges.iter().position(|name| name == &primary_successor);
    let garment = finished.compile()?;
    Ok(Some(Edit {
        reset_simulation: !same_physics(source, &finished),
        selected: Some(panel.into()),
        new_point,
        template: finished,
        garment,
    }))
}

/// Whether a seam references one named boundary of a panel.
fn seam_uses(template: &GarmentTemplate, panel: &str, edge: &str) -> bool {
    template.seams.iter().any(|seam| {
        seam.references()
            .any(|r| r.panel == panel && r.edge.as_deref() == Some(edge))
    })
}

/// Remap a normalized physical-arclength interval onto its child edge.
/// A crossing interval is returned as two consecutive child intervals.
fn split_boundary_interval(range: [f64; 2], fraction: f64, child: &str, successor: &str)
    -> Result<Vec<(String, [f64; 2])>, String>
{
    let [start, end] = range;
    if ![start, end, fraction].iter().all(|v| v.is_finite())
        || start < 0. || end > 1. || start >= end
        || fraction <= 0. || fraction >= 1.
    {
        return Err("Invalid sewing interval during boundary split".into());
    }
    let left = fraction;
    let right = 1. - fraction;
    if end <= fraction {
        Ok(vec![(child.into(), [start / left, end / left])])
    } else if start >= fraction {
        Ok(vec![(successor.into(), [(start - fraction) / right, (end - fraction) / right])])
    } else {
        Ok(vec![
            (child.into(), [start / left, 1.]),
            (successor.into(), [0., (end - fraction) / right]),
        ])
    }
}

/// Build a complete replacement seam graph before committing any contour edit.
/// Seam ranges are normalized physical arclength, not cubic parameter fractions.
fn remap_split_seams(template: &GarmentTemplate, panel: &str, edge: &str,
    successor: &str, fraction: f64) -> Result<Vec<SeamSpec>, String>
{
    let mut out = Vec::new();
    for original in &template.seams {
        let on_a = original.a.panel == panel && original.a.edge.as_deref() == Some(edge);
        let on_b = original.b.panel == panel && original.b.edge.as_deref() == Some(edge);
        if !on_a && !on_b {
            out.push(original.clone());
            continue;
        }
        if on_a && on_b {
            return Err("Cannot split a boundary used on both sides of one seam".into());
        }
        // Both notch coordinates run in sewing order: B's coordinate is
        // already reversed by the seam compiler when reverse_b is set.
        let mut knots = vec![[0., 0.]];
        for notch in &original.notches {
            if (0..2).any(|i| !notch[i].is_finite()
                || notch[i] <= knots.last().unwrap()[i] + 1e-9
                || notch[i] >= 1. - 1e-9) {
                return Err("Invalid monotone seam notch correspondence".into());
            }
            knots.push(*notch);
        }
        knots.push([1., 1.]);
        let target = if on_a { &original.a } else { &original.b };
        let pieces = split_boundary_interval(target.range, fraction, edge, successor)?;
        if pieces.len() == 1 {
            let mut updated = original.clone();
            let target = if on_a { &mut updated.a } else { &mut updated.b };
            target.edge = Some(pieces[0].0.clone());
            target.range = pieces[0].1;
            out.push(updated);
            continue;
        }
        // Split the opposite sew interval at matching fabric arclength. Reverse
        // sewing changes which end of B is matched to the beginning of A.
        let progress = (fraction - target.range[0]) / (target.range[1] - target.range[0]);
        if !progress.is_finite() || progress <= 0. || progress >= 1. {
            return Err("Invalid interior seam split position".into());
        }
        let other = if on_a { &original.b } else { &original.a };
        let [other_start, other_end] = other.range;
        let mut first = original.clone();
        let mut second = original.clone();
        second.id = unused_id("seam_split", template.seams.iter().map(|s| s.id.clone())
            .chain(out.iter().map(|s: &SeamSpec| s.id.clone())));
        // Derive the cut on the opposite side by inverting/interpolating the
        // monotone correspondence, including local ease between notch pairs.
        let interpolation = |coordinate: f64, from: usize, to: usize| -> Result<f64, String> {
            let pair = knots.windows(2).find(|pair| coordinate >= pair[0][from] && coordinate <= pair[1][from])
                .ok_or("Seam notch correspondence has no enclosing interval")?;
            let amount = (coordinate - pair[0][from]) / (pair[1][from] - pair[0][from]);
            let mapped = pair[0][to] + amount * (pair[1][to] - pair[0][to]);
            if !mapped.is_finite() || mapped <= 1e-9 || mapped >= 1. - 1e-9 {
                return Err("Corresponding seam split is too near an endpoint".into());
            }
            Ok(mapped)
        };
        let (cut_a, cut_b) = if on_a {
            (progress, interpolation(progress, 0, 1)?)
        } else {
            let cut_b = if original.reverse_b { 1. - progress } else { progress };
            (interpolation(cut_b, 1, 0)?, cut_b)
        };
        let remap = |u: f64, cut: f64, child: usize| {
            if child == 0 { u / cut } else { (u - cut) / (1. - cut) }
        };
        let mut first_notches = Vec::new();
        let mut second_notches = Vec::new();
        for [na, nb] in &original.notches {
            if !na.is_finite() || !nb.is_finite() || *na <= 0. || *na >= 1.
                || *nb <= 0. || *nb >= 1. {
                return Err("Invalid seam pairing notch during split".into());
            }
            if (*na - cut_a).abs() <= 1e-9 || (*nb - cut_b).abs() <= 1e-9 {
                // This point becomes the implicit meeting endpoint; it does
                // not need an interior correspondence in either new seam.
                if (*na - cut_a).abs() > 1e-9 || (*nb - cut_b).abs() > 1e-9 {
                    return Err("Seam notch correspondence does not meet the new split".into());
                }
                continue;
            }
            let a_child = usize::from(*na > cut_a);
            let b_child = usize::from(*nb > cut_b);
            if a_child != b_child {
                return Err("Seam correspondence crosses the split and cannot be migrated safely".into());
            }
            let pair = [remap(*na, cut_a, a_child), remap(*nb, cut_b, b_child)];
            if pair.iter().any(|v| !v.is_finite() || *v <= 0. || *v >= 1.) {
                return Err("Invalid remapped seam notch coordinate".into());
            }
            if a_child == 0 {first_notches.push(pair)} else {second_notches.push(pair)}
        }
        if on_a {
            first.a.edge = Some(pieces[0].0.clone());
            first.a.range = pieces[0].1;
            second.a.edge = Some(pieces[1].0.clone());
            second.a.range = pieces[1].1;
            let cut = if original.reverse_b {
                other_end - (other_end - other_start) * cut_b
            } else {
                other_start + (other_end - other_start) * cut_b
            };
            first.b.range = if original.reverse_b { [cut, other_end] } else { [other_start, cut] };
            second.b.range = if original.reverse_b { [other_start, cut] } else { [cut, other_end] };
        } else {
            let cut = other_start + (other_end - other_start) * cut_a;
            first.a.range = [other_start, cut];
            second.a.range = [cut, other_end];
            first.b.edge = Some(if original.reverse_b { pieces[1].0.clone() } else { pieces[0].0.clone() });
            first.b.range = if original.reverse_b { pieces[1].1 } else { pieces[0].1 };
            second.b.edge = Some(if original.reverse_b { pieces[0].0.clone() } else { pieces[1].0.clone() });
            second.b.range = if original.reverse_b { pieces[0].1 } else { pieces[1].1 };
        }
        first.notches = first_notches;
        second.notches = second_notches;
        out.push(first);
        out.push(second);
    }
    // A seam that was split repeatedly must have unique IDs. If a generated
    // name collides with a later untouched seam, reject rather than corrupt.
    let mut seen = std::collections::BTreeSet::new();
    if out.iter().any(|seam| !seen.insert(&seam.id)) {
        return Err("A split created conflicting sewing IDs".into());
    }
    Ok(out)
}

/// An error leaves the input byte-for-byte unchanged; no partial edit is visible.
pub fn apply(source: &GarmentTemplate, command: Command) -> Result<Edit, String> {
    if let Command::SplitBoundary{panel,edge,at_m}=&command {
        if let Some(result)=split_linked_mirror_knot(source,panel,edge,*at_m)?{
            return Ok(result);
        }
    }
    let mut template = source.clone();
    let mut selected = None;
    let mut new_point = None;
    match command {
        Command::Paste { clipboard, center } => {
            selected = clipboard.paste(&mut template, center)?.first().cloned();
        }
        Command::LayoutGroup { panels, delta } => {
            if !delta.is_finite() || panels.is_empty() {
                return Err("Select panels and a finite layout offset".into());
            }
            let ids: std::collections::BTreeSet<_> = panels.iter().collect();
            if ids
                .iter()
                .any(|id| !template.panels.iter().any(|p| &p.id == *id))
            {
                return Err("Panel not found".into());
            }
            // Resolve implicit layouts before mutating any panel.
            let origins: Vec<_> = (0..template.panels.len())
                .map(|i| layout(&template, i))
                .collect();
            for (p, origin) in template.panels.iter_mut().zip(origins) {
                if ids.contains(&p.id) {
                    p.layout_2d = Some(origin + delta);
                }
            }
        }
        Command::SetMeasurement { panel, measurement } => {
            let p=template.panels.iter_mut().find(|p|p.id==panel).ok_or("Panel not found")?;
            let polygon=p.polygon.as_mut().ok_or("A POM requires an editable polygon")?;
            // Validate on a tentative clone so invalid updates are atomic.
            let mut preview=polygon.clone();
            if let Some(existing)=preview.measurements.iter_mut().find(|m|m.id==measurement.id){
                *existing=measurement;
            } else {
                preview.measurements.push(measurement);
            }
            preview.validate_measurements()?;
            polygon.measurements=preview.measurements;
            selected=Some(panel);
        }
        Command::RemoveMeasurement { panel, id } => {
            let p=template.panels.iter_mut().find(|p|p.id==panel).ok_or("Panel not found")?;
            let polygon=p.polygon.as_mut().ok_or("Editable polygon required")?;
            let previous=polygon.measurements.len();
            polygon.measurements.retain(|m|m.id!=id);
            if polygon.measurements.len()==previous {return Err("POM identifier not found".into())}
            selected=Some(panel);
        }
        Command::Annotation { panel, id, text, position } => {
            if !position.is_finite() || text.trim().is_empty() || text.chars().count() > 500 || text.chars().any(|c| c.is_control() && c != '\n') {
                return Err("Annotation needs finite coordinates and 1–500 printable characters".into());
            }
            let p = template.panels.iter_mut().find(|p| p.id == panel).ok_or("Panel not found")?;
            let poly = p.polygon.as_mut().ok_or("Editable polygon required for annotation")?;
            if let Some(id) = id {
                let existing = poly.annotations.iter_mut().find(|a| a.id == id).ok_or("Annotation not found")?;
                existing.text = text;
                existing.position = position;
            } else {
                let id = unused_id("annotation", poly.annotations.iter().map(|a| a.id.clone()));
                poly.annotations.push(PatternAnnotation { id, text, position });
            }
            selected = Some(panel);
        }
        Command::RemoveAnnotation { panel, id } => {
            let p = template.panels.iter_mut().find(|p| p.id == panel).ok_or("Panel not found")?;
            let poly = p.polygon.as_mut().ok_or("Editable polygon required for annotation")?;
            let before = poly.annotations.len();
            poly.annotations.retain(|a| a.id != id);
            if before == poly.annotations.len() { return Err("Annotation not found".into()); }
            selected = Some(panel);
        }
        Command::Primitive {
            kind,
            size,
            sweep_degrees,
            origin,
            meshing,
            fabric,
            replace,
        } => {
            let polygon = crate::garment::shapes::primitive(kind, size, sweep_degrees, meshing)?;
            selected = Some(geometry::add_polygon(
                &mut template,
                polygon,
                origin,
                fabric,
                replace,
            )?);
        }
        Command::Mirror {
            panel,
            axis,
            copy_side,
        } => selected = Some(geometry::mirror(&mut template, &panel, axis, copy_side)?),
        Command::Boolean {
            a,
            b,
            op,
            keep_tool,
        } => selected = Some(geometry::boolean(&mut template, &a, &b, op, keep_tool)?),
        Command::InternalLine {
            panel,
            points,
            tangents,
        } => {
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panneau absent")?;
            let poly = p
                .polygon
                .as_mut()
                .ok_or("Les lignes demandent un panneau v2")?;
            let id = unused_id("line", poly.paths()?.into_iter().map(|(name, _)| name));
            poly.lines.push(crate::garment::domain::InternalLine {
                id,
                points,
                tangents,
            });
            selected = Some(panel);
        }
        Command::RemoveLine { panel, line } => {
            if template.seams.iter().any(|s| {
                s.references()
                    .any(|r| r.panel == panel && r.edge.as_ref() == Some(&line))
            }) {
                return Err("Supprimer la couture avant de supprimer sa ligne intérieure".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panneau absent")?;
            let poly = p.polygon.as_mut().ok_or("Panneau v2 requis")?;
            if !poly.lines.iter().any(|l| l.id == line) {
                return Err("Ligne absente".into());
            }
            poly.lines.retain(|l| l.id != line);
            selected = Some(panel);
        }
        Command::Ruffle {
            panel,
            line,
            width,
            ratio,
        } => {
            selected = Some(geometry::ruffle(
                &mut template,
                &panel,
                &line,
                width,
                ratio,
            )?)
        }
        Command::Fabric {
            panel,
            name,
            properties,
            all_panels,
        } => {
            properties.bind(0.).validate()?;
            if name.trim().is_empty() {
                return Err("Fabric name is empty".into());
            }
            let index = template
                .panels
                .iter()
                .position(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let old_id = template.panels[index].fabric.clone();
            let shared = template
                .panels
                .iter()
                .filter(|p| p.fabric == old_id)
                .count()
                > 1;
            let id = if shared && !all_panels {
                let id = unused_id("fabric", template.fabrics.iter().map(|f| f.id.clone()));
                template.fabrics.push(Fabric {
                    id: id.clone(),
                    name,
                    properties,
                });
                id
            } else {
                let f = template
                    .fabrics
                    .iter_mut()
                    .find(|f| f.id == old_id)
                    .ok_or("Fabric not found")?;
                f.name = name;
                f.properties = properties;
                old_id
            };
            for (i, p) in template.panels.iter_mut().enumerate() {
                if all_panels || i == index {
                    p.fabric = id.clone();
                }
            }
            selected = Some(panel);
        }
        Command::Polygon {
            mut points,
            mut tangents,
            meshing,
            fabric,
            replace,
        } => {
            if !(3..=64).contains(&points.len()) || points.iter().any(|p| !p.is_finite()) {
                return Err("Draw 3 to 64 finite points".into());
            }
            if tangents.is_empty() {
                tangents.resize(points.len(), DVec2::ZERO);
            }
            if tangents.len() != points.len() || tangents.iter().any(|p| !p.is_finite()) {
                return Err("Invalid drawing tangents".into());
            }
            let lo = points
                .iter()
                .copied()
                .fold(DVec2::splat(f64::INFINITY), DVec2::min);
            for p in &mut points {
                *p -= lo;
            }
            let size = points.iter().copied().fold(DVec2::ZERO, DVec2::max);
            let area: f64 = (0..points.len())
                .map(|i| points[i].perp_dot(points[(i + 1) % points.len()]))
                .sum();
            if area < 0. {
                points.reverse();
                tangents.reverse();
                for t in &mut tangents {
                    *t = -*t;
                }
            }
            if replace {
                template.name = "Custom garment".into();
                template.panels.clear();
                template.seams.clear();
            }
            let id = unused_id("panel", template.panels.iter().map(|p| p.id.clone()));
            let curves = (0..points.len())
                .filter_map(|i| {
                    let j = (i + 1) % points.len();
                    (tangents[i].length_squared() + tangents[j].length_squared() > 1e-20).then(
                        || {
                            (
                                format!("edge_{}", i + 1),
                                [points[i] + tangents[i], points[j] - tangents[j]],
                            )
                        },
                    )
                })
                .collect();
            template.panels.push(Panel {
                id: id.clone(),
                name: id.clone(),
                pattern: Pattern {
                    width: size.x,
                    height: size.y,
                    nx: 1,
                    ny: 1,
                },
                polygon: Some(PolygonPattern {
                    edges: (0..points.len())
                        .map(|i| format!("edge_{}", i + 1))
                        .collect(),
                    points,
                    subdivisions: 0,
                    meshing: Some(meshing),
                    curves,
                    free_curve_points: Default::default(),
                    vertex_ids: Default::default(),
                    vertex_mirror_groups: Default::default(),
                    holes: vec![],
                    lines: vec![],
                    target_lengths: Default::default(),
                    notches: Default::default(),
                    seam_allowances: Default::default(),
                    annotations: vec![],
                    measurements: vec![],
                }),
                fabric,
                grain_degrees: 90.,
                placement: Placement {
                    translation: if let Some(first) = template.panels.first() {
                        let delta = lo - layout(&template, 0);
                        first.placement.translation + DVec3::new(delta.x, -delta.y, 0.12)
                    } else {
                        DVec3::new(-size.x * 0.5, 1.5, 0.45)
                    },
                    ..Default::default()
                },
                pins: vec![],
                pin_points: vec![],
                layout_2d: Some(lo),
                layout_rotation_degrees: 0.,
            });
            normalize(template.panels.last_mut().unwrap());
            template.version = 2;
            selected = Some(id);
        }
        Command::Place { panel, placement } => {
            template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?
                .placement = placement;
            selected = Some(panel);
        }
        Command::Shape { panel, polygon } => {
            let index = template
                .panels
                .iter()
                .position(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let origin = layout(&template, index);
            let p = &mut template.panels[index];
            let old = p
                .polygon
                .as_ref()
                .ok_or("Convert the rectangular pattern before editing")?;
            if polygon.edges != old.edges || polygon.points.len() != old.points.len() {
                return Err("Named boundaries must stay stable".into());
            }
            if polygon.measurements != old.measurements {
                return Err("Use native SetMeasurement/RemoveMeasurement; a Shape edit cannot silently replace POM references".into());
            }
            p.layout_2d = Some(origin);
            p.polygon = Some(polygon);
            normalize(p);
            selected = Some(panel);
        }
        Command::Dimensions {
            panel,
            width,
            height,
        } => {
            if !width.is_finite() || !height.is_finite() || width <= 0. || height <= 0. {
                return Err("Dimensions must be positive finite values".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            if p.polygon.is_some() {
                resize_rectangle(p, width, height)?;
                normalize(p);
            }
            // Re-assert the requested size after normalization: the stored value
            // must be the exact input, never a rounded copy of the contour.
            p.pattern.width = width;
            p.pattern.height = height;
            selected = Some(panel);
        }
        Command::Anchor {
            panel,
            anchor,
            position,
        } => {
            if !position.is_finite() {
                return Err("Point coordinates must be finite".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            // Absolute coordinates are assigned directly, never reconstructed
            // from a delta, so the typed value is stored bit-for-bit.
            remap_anchors(p, &[anchor], |_| position)?;
            // Re-basing the local origin keeps every untouched point at the same
            // board and world position, exactly like a dragged contour edit.
            normalize(p);
            selected = Some(panel);
        }
        Command::MovePoints {
            panel,
            points,
            delta,
        } => {
            if !delta.is_finite() {
                return Err("Move delta must be finite".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            remap_anchors(p, &points, |point| point + delta)?;
            normalize(p);
            selected = Some(panel);
        }
        Command::Nudge {
            panel,
            points,
            delta_mm,
        } => {
            if !delta_mm.is_finite() {
                return Err("Nudge step must be finite".into());
            }
            // Metric steps convert once, by division, so 1 mm and 10 mm are the
            // exact f64 0.001 and 0.01.
            let delta = delta_mm / 1000.0;
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            remap_anchors(p, &points, |point| point + delta)?;
            normalize(p);
            selected = Some(panel);
        }
        Command::SplitBoundary { panel, edge, at_m } => {
            if !at_m.is_finite() || at_m <= 0. {
                return Err("Insert position must be a positive finite length".into());
            }
            // Plan the entire reference migration before changing the polygon.
            // Source cloning makes a failed edit byte-for-byte non-destructive.
            let source_polygon = template.panels.iter().find(|p| p.id == panel)
                .ok_or("Panel not found")?.polygon.as_ref()
                .ok_or("This panel has no editable contour")?;
            let original_length = edge_length(source_polygon, &edge)?;
            if at_m >= original_length {
                return Err("Insert position is beyond the boundary".into());
            }
            let at_m = canonical_free_split_station(source_polygon, &edge, at_m)?;
            let fraction = at_m / original_length;
            let successor = split_edge_name(&source_polygon.edges, &edge);
            let replacement_seams = remap_split_seams(&template, &panel, &edge, &successor, fraction)?;
            // Reject corrupt saved manufacturing metadata before creating a
            // second boundary. Copying a non-finite allowance or partitioning
            // an invalid target would make both resulting cutlines ambiguous.
            if source_polygon.seam_allowances.get(&edge)
                .is_some_and(|v| !v.is_finite() || *v < 0.)
                || source_polygon.target_lengths.get(&edge)
                    .is_some_and(|v| !v.is_finite() || *v <= 0.)
            {
                return Err("Invalid manufacturing specification on split boundary".into());
            }
            let prior_notches = source_polygon.notches.get(&edge).cloned().unwrap_or_default();
            let original_measurements=source_polygon.measurements.clone();
            let mut left_notches = Vec::new();
            let mut right_notches = Vec::new();
            for mut notch in prior_notches {
                if !notch.t.is_finite() || notch.t <= 0. || notch.t >= 1.
                    || !notch.depth_m.is_finite() || notch.depth_m <= 0.
                {
                    return Err("Invalid stored notch on split boundary".into());
                }
                if (notch.t - fraction).abs() <= 1e-9 {
                    return Err("A notch lies exactly on the split point; move it first".into());
                }
                if notch.t < fraction {
                    notch.t /= fraction;
                    left_notches.push(notch);
                } else {
                    notch.t = (notch.t - fraction) / (1. - fraction);
                    right_notches.push(notch);
                }
            }
            let old_allowance = source_polygon.seam_allowances.get(&edge).copied();
            let old_target = source_polygon.target_lengths.get(&edge).copied();
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let index = {
                let polygon = p
                    .polygon
                    .as_mut()
                    .ok_or("This panel has no editable contour")?;
                let index = polygon
                    .edges
                    .iter()
                    .position(|name| name == &edge)
                    .ok_or("Boundary not found")?;
                let current = edge_length(polygon, &edge)?;
                if at_m >= current {
                    return Err("Insert position is beyond the boundary".into());
                }
                let count = polygon.points.len();
                let a = polygon.points[index];
                let b = polygon.points[(index + 1) % count];
                let controls = polygon.curves.get(&edge).copied();
                let authored_free = polygon.free_curve_points.get(&edge)
                    .is_some_and(|marks| !marks.is_empty());
                let migrated = if authored_free {
                    Some(split_free_curve_geometry(polygon, index, at_m)?)
                } else {
                    None
                };
                let (point, first, second) = if let Some((point, first, second, _, _, _)) = &migrated {
                    (*point, *first, *second)
                } else { match controls {
                    // Any cubic parameter splits the outline exactly; the point
                    // is placed at the requested material arclength.
                    Some([c1, c2]) => {
                        let cubic = [a, c1, c2, b];
                        let parameter = parameter_at_arclength(cubic, at_m)?;
                        let (left, right) = split_cubic(cubic, parameter);
                        (left[3], [left[1], left[2]], [right[1], right[2]])
                    }
                    None => {
                        let t = at_m / current;
                        (a.lerp(b, t), [DVec2::ZERO; 2], [DVec2::ZERO; 2])
                    }
                }};
                polygon.points.insert(index + 1, point);
                polygon.edges.insert(index + 1, successor.clone());
                if controls.is_some() || authored_free {
                    polygon.curves.insert(edge.clone(), first);
                    polygon.curves.insert(successor.clone(), second);
                }
                if let Some((_, _, _, before, after, promoted)) = migrated {
                    if before.is_empty() {
                        polygon.free_curve_points.remove(&edge);
                    } else {
                        polygon.free_curve_points.insert(edge.clone(), before);
                    }
                    if !after.is_empty() {
                        polygon.free_curve_points.insert(successor.clone(), after);
                    }
                    if let Some(id) = promoted {
                        if polygon.vertex_ids.insert(successor.clone(), id).is_some() {
                            return Err("Split destination already owns a promoted vertex ID".into());
                        }
                    }
                }
                // These are manufacturing annotations, not independent drape
                // geometry; both children inherit the source width.
                if let Some(width) = old_allowance {
                    polygon.seam_allowances.insert(successor.clone(), width);
                }
                if let Some(target) = old_target {
                    polygon.target_lengths.insert(edge.clone(), target * fraction);
                    polygon.target_lengths.insert(successor.clone(), target * (1. - fraction));
                }
                if !left_notches.is_empty() {
                    polygon.notches.insert(edge.clone(), left_notches);
                } else {
                    polygon.notches.remove(&edge);
                }
                if !right_notches.is_empty() {
                    polygon.notches.insert(successor.clone(), right_notches);
                }
                for pom in &mut polygon.measurements {
                    for anchor in [&mut pom.a, &mut pom.b] {
                        if anchor.edge==edge {
                            // A station exactly at the physical split is
                            // attached to the new outgoing edge's endpoint.
                            if anchor.t < fraction - 1e-9 {
                                anchor.t /= fraction;
                            } else {
                                anchor.t=((anchor.t-fraction)/(1.-fraction)).clamp(0.,1.);
                                anchor.edge=successor.clone();
                            }
                        }
                    }
                }
                if polygon.measurements.len()!=original_measurements.len() {
                    return Err("Split must preserve all POM identifiers".into());
                }
                polygon.validate_measurements()?;
                index + 1
            };
            template.seams = replacement_seams;
            normalize(p);
            selected = Some(panel);
            new_point = Some(index);
        }
        Command::DartCutSew { panel, edge, left_t, right_t, apex } => {
            if !left_t.is_finite() || !right_t.is_finite()
                || left_t <= 0.01 || right_t >= 0.99 || right_t-left_t < 0.005
                || !apex.is_finite()
            {return Err("Dart requires two distinct interior edge stations and a finite apex".into())}
            if template.seams.iter().any(|s| [ &s.a, &s.b ].iter()
                .any(|r| r.panel==panel && r.edge.as_deref()==Some(edge.as_str()))) {
                return Err("Dart placement on an already sewn edge is not supported; select an unsewn boundary".into());
            }
            let p=template.panels.iter_mut().find(|p|p.id==panel).ok_or("Dart panel not found")?;
            let polygon=p.polygon.as_mut().ok_or("Dart requires an editable physical polygon")?;
            let i=polygon.edges.iter().position(|name|name==&edge).ok_or("Dart source edge not found")?;
            if polygon.curves.contains_key(&edge) || polygon.free_curve_points.contains_key(&edge)
                || polygon.notches.contains_key(&edge) || polygon.target_lengths.contains_key(&edge)
                || polygon.measurements.iter().any(|m|m.a.edge==edge||m.b.edge==edge)
                || polygon.lines.iter().any(|line|line.id==edge)
            {return Err("Dart on a curved or annotated boundary needs explicit reference remapping".into())}
            let a=polygon.points[i];let b=polygon.points[(i+1)%polygon.points.len()];
            let delta=b-a;let length=delta.length();
            if length<0.02 {return Err("Dart source edge must be at least 20 mm".into())}
            let left=a.lerp(b,left_t);let right=a.lerp(b,right_t);
            let intake=left.distance(right);
            if intake<0.003 || intake>0.15 {return Err("Dart intake must be between 3 and 150 mm".into())}
            let inward=DVec2::new(-delta.y,delta.x)/length;
            let mid=(left+right)*0.5;
            let height=(apex-mid).dot(inward);
            if height<0.008 || height>0.5 || (apex-mid).dot(delta/length).abs()>1e-6 {
                return Err("Dart apex must lie 8–500 mm inward on the intake perpendicular bisector".into());
            }
            if !polygon.holes.is_empty() || !polygon.lines.is_empty() {
                return Err("Darts on existing holes/internal lines need topology-aware migration".into());
            }
            let suffix=unused_id("dart",template.seams.iter().map(|s|s.id.clone()));
            let first=format!("{suffix}_leg_a");let second=format!("{suffix}_leg_b");
            let trailing=format!("{suffix}_after");
            if [ &first,&second,&trailing ].iter().any(|candidate|polygon.edges.contains(candidate)) {
                return Err("Dart edge identifier collision".into());
            }
            polygon.points.splice((i+1)..(i+1),[left,apex,right]);
            polygon.edges.splice((i+1)..(i+1),[first.clone(),second.clone(),trailing.clone()]);
            // The original sew side before the first leg retains its name.
            // Existing source allowances follow the newly created legs and
            // trailing segment, preserving a consistent physical specification.
            // If no original allowance exists, do NOT invent a default: the
            // engineering cutting export must remain blocked until specified.
            if let Some(width)=polygon.seam_allowances.get(&edge).copied() {
                polygon.seam_allowances.insert(trailing,width);
                polygon.seam_allowances.insert(first.clone(),width);
                polygon.seam_allowances.insert(second.clone(),width);
            }
            template.seams.push(SeamSpec {
                id:suffix,
                a:BoundaryRef{panel:panel.clone(),side:crate::garment::seam::Side::Top,edge:Some(first),range:[0.,1.],reversed:false},
                b:BoundaryRef{panel:panel.clone(),side:crate::garment::seam::Side::Top,edge:Some(second),range:[0.,1.],reversed:false},
                a_tail:vec![],b_tail:vec![],
                reverse_b:true,notches:vec![],stiffness:50_000.,allow_ease:false,
            });
            normalize(p);
            selected=Some(panel);
        }
        Command::RemovePoint { panel, point } => {
            let (removed, incoming, outgoing) = {
                let p = template
                    .panels
                    .iter()
                    .find(|p| p.id == panel)
                    .ok_or("Panel not found")?;
                let polygon = p
                    .polygon
                    .as_ref()
                    .ok_or("This panel has no editable contour")?;
                let count = polygon.points.len();
                if count <= 3 {
                    return Err("A contour needs at least three points".into());
                }
                if point >= count {
                    return Err("Point index out of range".into());
                }
                let previous = (point + count - 1) % count;
                (
                    polygon.points[point],
                    polygon.edges[previous].clone(),
                    polygon.edges[point].clone(),
                )
            };
            for name in [&incoming, &outgoing] {
                if seam_uses(&template, &panel, name) {
                    return Err("A seam uses this point's boundaries; delete the seam first".into());
                }
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            if p.polygon.as_ref().is_some_and(|polygon| {
                polygon.target_lengths.contains_key(&incoming)
                    || polygon.target_lengths.contains_key(&outgoing)
                    || polygon.free_curve_points.contains_key(&incoming)
                    || polygon.free_curve_points.contains_key(&outgoing)
                    || polygon.vertex_ids.contains_key(&outgoing)
                    || polygon.notches.contains_key(&incoming)
                    || polygon.notches.contains_key(&outgoing)
                    || polygon.seam_allowances.contains_key(&incoming)
                    || polygon.seam_allowances.contains_key(&outgoing)
                    || polygon.measurements.iter().any(|pom|
                        [&pom.a,&pom.b].iter().any(|anchor|
                            anchor.edge==incoming || anchor.edge==outgoing))
            }) {
                return Err(
                    "A target length uses this point's boundaries; clear the target first".into(),
                );
            }
            {
                let polygon = p.polygon.as_mut().unwrap();
                if polygon.curves.contains_key(&incoming) || polygon.curves.contains_key(&outgoing)
                {
                    return Err("Remove the Bézier handles before deleting this point".into());
                }
                polygon.points.remove(point);
                // The outgoing name disappears with its point; the incoming name
                // becomes the rejoined boundary.
                polygon.edges.remove(point);
            }
            // A pin on the removed vertex cannot survive that vertex.
            p.pin_points.retain(|pin| pin.distance(removed) >= 1e-9);
            normalize(p);
            selected = Some(panel);
        }
        Command::CurvePoint {
            panel,
            anchor,
            curved,
        } => {
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let polygon = p
                .polygon
                .as_mut()
                .ok_or("This panel has no editable contour")?;
            let count = polygon.points.len();
            if anchor >= count {
                return Err("Point index out of range".into());
            }
            let previous = (anchor + count - 1) % count;
            let outgoing = polygon.edges[anchor].clone();
            let incoming = polygon.edges[previous].clone();
            for (name, start) in [(&outgoing, anchor), (&incoming, previous)] {
                if curved {
                    if !polygon.curves.contains_key(name) {
                        let a = polygon.points[start];
                        let b = polygon.points[(start + 1) % count];
                        // Collinear controls at 1/3 and 2/3 trace the straight
                        // segment exactly, so becoming a curve changes nothing.
                        polygon
                            .curves
                            .insert(name.clone(), [a.lerp(b, 1. / 3.), a.lerp(b, 2. / 3.)]);
                    }
                } else {
                    polygon.curves.remove(name);
                }
            }
            normalize(p);
            selected = Some(panel);
        }
        Command::TargetLength {
            panel,
            edge,
            target_m,
        } => {
            if !target_m.is_finite() || target_m < 0. {
                return Err("Target length must be a positive finite value".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let index = p
                .polygon
                .as_ref()
                .ok_or("This panel has no editable contour")?
                .edges
                .iter()
                .position(|name| name == &edge)
                .ok_or("Boundary not found")?;
            if target_m == 0. {
                // Clearing a specification never moves geometry.
                p.polygon.as_mut().unwrap().target_lengths.remove(&edge);
                selected = Some(panel);
            } else {
                let count = p.polygon.as_ref().unwrap().points.len();
                let end = (index + 1) % count;
                let fixed = p.polygon.as_ref().unwrap().points[index];
                let before_end = p.polygon.as_ref().unwrap().points[end];
                for _ in 0..4 {
                    let current = edge_length(p.polygon.as_ref().unwrap(), &edge)?;
                    if current <= 0. {
                        return Err("Boundary has zero length".into());
                    }
                    if (current - target_m).abs() <= target_m * 1e-12 {
                        break;
                    }
                    // The first anchor stays put; the rest of the boundary scales
                    // about it, so the direction is preserved.
                    let factor = target_m / current;
                    let polygon = p.polygon.as_mut().unwrap();
                    let scale = |point: DVec2| fixed + (point - fixed) * factor;
                    polygon.points[end] = scale(polygon.points[end]);
                    if let Some([first, second]) = polygon.curves.get(&edge).copied() {
                        polygon
                            .curves
                            .insert(edge.clone(), [scale(first), scale(second)]);
                    }
                }
                let polygon = p.polygon.as_mut().unwrap();
                let delta = polygon.points[end] - before_end;
                if let Some(controls) = polygon.curves.get_mut(&polygon.edges[end]) {
                    controls[0] += delta;
                }
                follow_pins(p, &[(end, before_end)]);
                normalize(p);
                p.polygon
                    .as_mut()
                    .unwrap()
                    .target_lengths
                    .insert(edge, target_m);
                selected = Some(panel);
            }
        }
        Command::Notch {
            panel,
            edge,
            t,
            depth_m,
        } => {
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let poly = p
                .polygon
                .as_mut()
                .ok_or("This panel has no editable contour")?;
            let notch = EdgeNotch { t, depth_m };
            poly.notch_segment(&edge, &notch)?;
            let entries = poly.notches.entry(edge).or_default();
            if let Some(existing) = entries.iter_mut().find(|n| (n.t - t).abs() < 1e-9) {
                *existing = notch;
            } else {
                entries.push(notch);
                entries.sort_by(|a, b| a.t.total_cmp(&b.t));
            }
            selected = Some(panel);
        }
        Command::NotchPair {
            panel,
            edge,
            center_t,
            spacing_m,
            depth_m,
        } => {
            if !center_t.is_finite() || !(0.0..1.0).contains(&center_t) || center_t == 0.
                || !spacing_m.is_finite() || spacing_m <= 0. || spacing_m > 0.2
            {
                return Err("Paired notches need an interior station and 0–200 mm physical spacing".into());
            }
            let p = template.panels.iter_mut().find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let poly = p.polygon.as_mut().ok_or("This panel has no editable contour")?;
            let length = edge_length(poly, &edge)?;
            let half_fraction = spacing_m / (2. * length);
            let first = center_t - half_fraction;
            let second = center_t + half_fraction;
            if first <= 0. || second >= 1. || second - first <= 1e-9 {
                return Err("Paired notches exceed the physical edge; choose a station farther from the endpoint".into());
            }
            let candidates = [
                EdgeNotch { t: first, depth_m },
                EdgeNotch { t: second, depth_m },
            ];
            // Validate both before changing either notch. No half-pair remains
            // after a failed command, including invalid notch depth.
            for notch in &candidates {
                poly.notch_segment(&edge, notch)?;
            }
            let entries = poly.notches.entry(edge).or_default();
            for notch in candidates {
                if let Some(existing) = entries.iter_mut().find(|n| (n.t - notch.t).abs() < 1e-9) {
                    *existing = notch;
                } else {
                    entries.push(notch);
                }
            }
            entries.sort_by(|a, b| a.t.total_cmp(&b.t));
            selected = Some(panel);
        }
        Command::RemoveNotch { panel, edge, t } => {
            if !t.is_finite() {
                return Err("Notch position must be finite".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let poly = p
                .polygon
                .as_mut()
                .ok_or("This panel has no editable contour")?;
            let entries = poly
                .notches
                .get_mut(&edge)
                .ok_or("No notches on boundary")?;
            let before = entries.len();
            entries.retain(|n| (n.t - t).abs() >= 1e-9);
            if entries.len() == before {
                return Err("Notch not found".into());
            }
            if entries.is_empty() {
                poly.notches.remove(&edge);
            }
            selected = Some(panel);
        }
        Command::SeamAllowance {
            panel,
            edge,
            width_m,
        } => {
            if !width_m.is_finite() || !(0.0..=0.5).contains(&width_m) {
                return Err("Seam allowance must be finite and 0..500 mm".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let poly = p
                .polygon
                .as_mut()
                .ok_or("This panel has no editable contour")?;
            if !poly.edges.contains(&edge) {
                return Err("Boundary not found".into());
            }
            if width_m == 0. {
                poly.seam_allowances.remove(&edge);
            } else {
                poly.seam_allowances.insert(edge, width_m);
            }
            selected = Some(panel);
        }
        Command::Layout { panel, origin } => {
            template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?
                .layout_2d = Some(origin);
            selected = Some(panel);
        }
        Command::BoardTransform {
            panel,
            origin,
            rotation_degrees,
        } => {
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            if !rotation_degrees.is_finite() {
                return Err("Invalid 2D rotation".into());
            }
            p.layout_2d = Some(origin);
            p.layout_rotation_degrees = rotation_degrees.rem_euclid(360.);
            selected = Some(panel);
        }
        Command::Duplicate { panel } => {
            let mut copy = template
                .panels
                .iter()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?
                .clone();
            copy.id = unused_id("panel", template.panels.iter().map(|p| p.id.clone()));
            copy.name = format!("{} copy", copy.name);
            copy.placement.translation.x += copy.pattern.width + 0.05;
            let i = template.panels.iter().position(|p| p.id == panel).unwrap();
            copy.layout_2d = Some(layout(&template, i) + DVec2::new(copy.pattern.width + 0.15, 0.));
            selected = Some(copy.id.clone());
            template.panels.push(copy);
        }
        Command::RemovePanel { panel } => {
            if template.panels.len() <= 1 {
                return Err("Keep at least one panel".into());
            }
            if !template.panels.iter().any(|p| p.id == panel) {
                return Err("Panel not found".into());
            }
            template.panels.retain(|p| p.id != panel);
            template
                .seams
                .retain(|s| s.references().all(|r| r.panel != panel));
        }
        Command::Sew {
            a,
            b,
            reverse,
            ease,
        } => {
            let same_edge = |x: &BoundaryRef, y: &BoundaryRef| {
                x.panel == y.panel
                    && if x.edge.is_some() || y.edge.is_some() {
                        x.edge == y.edge
                    } else {
                        x.side == y.side
                    }
            };
            if same_edge(&a, &b) {
                return Err("Choose two distinct boundaries".into());
            }
            // Free Sewing authors normalized rest-arclength subranges of named
            // cutlines. The compiler already interpolates the exact trimmed
            // boundary and rejects ownership overlaps; validate here as well
            // so a failed operation remains atomic before meshing.
            for end in [&a, &b] {
                if !end.range.iter().all(|value| value.is_finite())
                    || end.range[0] < 0.
                    || end.range[1] > 1.
                    || end.range[1] - end.range[0] < 1e-9
                {
                    return Err("Sewing needs a valid start and end along each boundary".into());
                }
                if template
                    .seams
                    .iter()
                    .any(|s| [&s.a, &s.b].iter().any(|other|
                        same_edge(end, other)
                        && end.range[0].max(other.range[0])
                            < end.range[1].min(other.range[1]) - 1e-12))
                {
                    return Err("This boundary range is already sewn".into());
                }
            }
            let id = unused_id("seam", template.seams.iter().map(|s| s.id.clone()));
            template.seams.push(SeamSpec {
                a_tail: vec![],
                b_tail: vec![],
                id,
                a,
                b,
                reverse_b: reverse,
                allow_ease: ease,
                notches: vec![],
                stiffness: 50_000.,
            });
        }
        Command::SewChain {
            seam,
            mut a,
            mut b,
            reverse,
            ease,
        } => {
            if a.is_empty() || b.is_empty() || a.len() > 128 || b.len() > 128 {
                return Err("Choose 1..128 segments on each sewing side".into());
            }
            let old = if let Some(id) = &seam {
                Some(
                    template
                        .seams
                        .iter()
                        .find(|s| &s.id == id)
                        .ok_or("Seam not found")?
                        .clone(),
                )
            } else {
                None
            };
            let id = seam
                .unwrap_or_else(|| unused_id("seam", template.seams.iter().map(|s| s.id.clone())));
            template.seams.retain(|s| s.id != id);
            template.seams.push(SeamSpec {
                id,
                a: a.remove(0),
                b: b.remove(0),
                a_tail: a,
                b_tail: b,
                reverse_b: reverse,
                allow_ease: ease,
                stiffness: old.as_ref().map_or(50_000., |s| s.stiffness),
                notches: old.map_or_else(Vec::new, |s| s.notches),
            });
        }
        Command::RemoveSeam { seam } => {
            if !template.seams.iter().any(|s| s.id == seam) {
                return Err("Seam not found".into());
            }
            template.seams.retain(|s| s.id != seam);
        }
    }
    let garment = template.compile()?;
    Ok(Edit {
        reset_simulation: !same_physics(source, &template),
        template,
        garment,
        selected,
        new_point,
    })
}

/// Rigid rotation around a material-space pivot. Rest UV and area never change.
pub fn rotate_about(placement: &Placement, pivot: DVec3, axis: DVec3, angle: f64) -> Placement {
    let r = placement.rotation_degrees * std::f64::consts::PI / 180.;
    let old = DQuat::from_euler(EulerRot::XYZ, r.x, r.y, r.z);
    let new = DQuat::from_axis_angle(axis, angle) * old;
    let (x, y, z) = new.to_euler(EulerRot::XYZ);
    Placement {
        translation: placement.transform(pivot) - new * pivot,
        rotation_degrees: DVec3::new(x, y, z) * 180. / std::f64::consts::PI,
    }
}

/// History stores editable templates, never GPU resources or transient indices.
#[derive(Default)]
pub struct History {
    undo: Vec<GarmentTemplate>,
    redo: Vec<GarmentTemplate>,
}
impl History {
    pub fn record(&mut self, old: GarmentTemplate) {
        if self.undo.len() == 32 {
            self.undo.remove(0);
        }
        self.undo.push(old);
        self.redo.clear();
    }
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
    pub fn restore(&mut self, current: &GarmentTemplate, redo: bool) -> Result<Edit, String> {
        let (from, to) = if redo {
            (&mut self.redo, &mut self.undo)
        } else {
            (&mut self.undo, &mut self.redo)
        };
        let template = from.last().ok_or("History is empty")?;
        let garment = template.compile()?;
        let template = from.pop().unwrap();
        to.push(current.clone());
        Ok(Edit {
            reset_simulation: !same_physics(current, &template),
            template,
            garment,
            selected: None,
            new_point: None,
        })
    }
}

#[cfg(test)]
mod annotation_tests {
    use super::*;
    use crate::garment::presets::{basic, GarmentKind};

    #[test]
    fn create_edit_delete_undo_and_json_reopen_annotations() {
        let original = basic(GarmentKind::Tshirt, 0);
        let panel = original.panels[0].id.clone();
        let mut history = History::default();
        let at = DVec2::new(0.2, 0.3);
        let make = |id, text: &str| Command::Annotation {
            panel: panel.clone(), id, text: text.into(), position: at,
        };
        let added = apply(&original, make(None, "CUT ON FOLD")).unwrap();
        assert!(!added.reset_simulation);
        assert_eq!(added.template.panels[0].polygon.as_ref().unwrap().annotations.len(), 1);
        let reopened: GarmentTemplate = serde_json::from_str(&serde_json::to_string(&added.template).unwrap()).unwrap();
        assert_eq!(reopened.panels[0].polygon.as_ref().unwrap().annotations[0].text, "CUT ON FOLD");
        let id = reopened.panels[0].polygon.as_ref().unwrap().annotations[0].id.clone();
        history.record(original.clone());
        let changed = apply(&reopened, make(Some(id.clone()), "SEW GUIDE")).unwrap();
        assert_eq!(changed.template.panels[0].polygon.as_ref().unwrap().annotations[0].text, "SEW GUIDE");
        history.record(changed.template.clone());
        let gone = apply(&changed.template, Command::RemoveAnnotation { panel: panel.clone(), id }).unwrap();
        assert!(gone.template.panels[0].polygon.as_ref().unwrap().annotations.is_empty());
        let undo = history.restore(&gone.template, false).unwrap();
        assert_eq!(undo.template.panels[0].polygon.as_ref().unwrap().annotations[0].text, "SEW GUIDE");
        assert!(apply(&original, make(None, " \n")).is_err());
    }
}
