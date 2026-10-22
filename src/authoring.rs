//! Transactional authoring in material coordinates, independent of UI and solver.
//! Compile before accepting an edit. Reset physical state only when Edit requests it.
use crate::{
    garment::{
        CompiledGarment, GarmentTemplate, curves,
        meshing::MeshingSettings,
        polygon::PolygonPattern,
        seam::{BoundaryRef, SeamSpec},
        template::{Fabric, FabricProperties, Panel, Placement},
    },
    model::{Pattern, State},
};
use glam::{DQuat, DVec2, DVec3, EulerRot};
pub mod clipboard;
pub mod constructions;
mod geometry;
mod linked;
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
    LinkedMirror {
        panel: String,
        axis: MirrorAxis,
    },
    UnlinkMirror {
        panel: String,
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
    /// Move contour selections on several panels by one board-space delta.
    /// Panel presentation rotations are inverted independently; compilation is atomic.
    MovePointGroups {
        groups: Vec<(String, Vec<usize>)>,
        board_delta: DVec2,
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
    RemovePanels {
        panels: Vec<String>,
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
        t.mirror_links.clear();
        for p in &mut t.panels {
            p.layout_2d = None;
            p.layout_rotation_degrees = 0.;
            // A required boundary length is a 2D specification, not rest
            // geometry: storing or clearing it must not invalidate the drape.
            if let Some(polygon) = p.polygon.as_mut() {
                polygon.target_lengths.clear();
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
        .copied()
        .fold(DVec2::splat(f64::INFINITY), DVec2::min);
    let hi = poly
        .points
        .iter()
        .chain(poly.curves.values().flatten())
        .copied()
        .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max);
    poly.translate_material(-lo);
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
    if polygon.points.len() != 4 || !polygon.curves.is_empty() {
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

/// Whether a seam references one named boundary of a panel.
fn seam_uses(template: &GarmentTemplate, panel: &str, edge: &str) -> bool {
    template.seams.iter().any(|seam| {
        seam.references()
            .any(|r| r.panel == panel && r.edge.as_deref() == Some(edge))
    })
}

/// An error leaves the input byte-for-byte unchanged; no partial edit is visible.
pub fn apply(source: &GarmentTemplate, command: Command) -> Result<Edit, String> {
    linked::check_command(source, &command)?;
    let mut template = source.clone();
    let mut selected = None;
    let mut new_point = None;
    match command {
        Command::LinkedMirror { panel, axis } => {
            let copy = geometry::mirror(&mut template, &panel, axis, Some(1))?;
            template
                .mirror_links
                .push(crate::garment::template::MirrorLink {
                    a: panel,
                    b: copy.clone(),
                    axis,
                });
            selected = Some(copy);
        }
        Command::UnlinkMirror { panel } => {
            template
                .mirror_links
                .retain(|l| l.a != panel && l.b != panel);
            selected = Some(panel);
        }
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
                .ok_or("Panel not found")?;
            let poly = p
                .polygon
                .as_mut()
                .ok_or("Internal lines require a v2 polygonal panel")?;
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
                return Err("Remove the seam before deleting its internal line".into());
            }
            let p = template
                .panels
                .iter_mut()
                .find(|p| p.id == panel)
                .ok_or("Panel not found")?;
            let poly = p
                .polygon
                .as_mut()
                .ok_or("A v2 polygonal panel is required")?;
            if !poly.lines.iter().any(|l| l.id == line) {
                return Err("Internal line not found".into());
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
                    holes: vec![],
                    lines: vec![],
                    target_lengths: Default::default(),
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
        Command::MovePointGroups {
            groups,
            board_delta,
        } => {
            if !board_delta.is_finite() || groups.is_empty() {
                return Err("Select points and use a finite move delta".into());
            }
            // Freeze derived board origins before any panel changes its extent.
            let origins: Vec<_> = (0..source.panels.len())
                .map(|i| layout(source, i))
                .collect();
            for (p, origin) in template.panels.iter_mut().zip(origins) {
                p.layout_2d = Some(origin);
            }
            let mut seen = std::collections::BTreeSet::new();
            for (id, points) in groups {
                if !seen.insert(id.clone()) {
                    return Err("A panel may occur only once in a point move".into());
                }
                let index = template
                    .panels
                    .iter()
                    .position(|p| p.id == id)
                    .ok_or("Panel not found")?;
                let origin = layout(&template, index);
                let p = &mut template.panels[index];
                p.layout_2d = Some(origin);
                let delta = rotate_2d(board_delta, -p.layout_rotation_degrees);
                remap_anchors(p, &points, |point| point + delta)?;
                normalize(p);
            }
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
            if seam_uses(&template, &panel, &edge) {
                return Err(
                    "This boundary belongs to a seam; delete the seam before splitting it".into(),
                );
            }
            if template
                .panels
                .iter()
                .find(|p| p.id == panel)
                .and_then(|p| p.polygon.as_ref())
                .is_some_and(|polygon| polygon.target_lengths.contains_key(&edge))
            {
                return Err(
                    "This boundary has a target length; clear the target before splitting it"
                        .into(),
                );
            }
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
                let (point, first, second) = match controls {
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
                };
                polygon.points.insert(index + 1, point);
                let name = split_edge_name(&polygon.edges, &edge);
                polygon.edges.insert(index + 1, name.clone());
                if controls.is_some() {
                    polygon.curves.insert(edge, first);
                    polygon.curves.insert(name, second);
                }
                index + 1
            };
            normalize(p);
            selected = Some(panel);
            new_point = Some(index);
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
        Command::RemovePanels { panels } => {
            let ids: std::collections::BTreeSet<_> = panels.into_iter().collect();
            if ids.is_empty()
                || ids
                    .iter()
                    .any(|id| !template.panels.iter().any(|p| &p.id == id))
            {
                return Err("Select existing panels to delete".into());
            }
            if ids.len() >= template.panels.len() {
                return Err("Keep at least one panel".into());
            }
            template.panels.retain(|p| !ids.contains(&p.id));
            template
                .seams
                .retain(|s| s.references().all(|r| !ids.contains(&r.panel)));
        }
        Command::Sew {
            a,
            b,
            reverse,
            ease,
        } => {
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
    linked::synchronize(source, &mut template)?;
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
