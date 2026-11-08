use super::polygon::PolygonPattern;
use super::seam::{BoundaryCurve, BoundaryRef, CompiledSeam, SeamSpec, Side};
use crate::{
    energy,
    model::{Material, Mesh, Pattern, Scene, State},
};
use glam::{DQuat, DVec2, DVec3, EulerRot};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    ops::Range,
    path::Path,
};

/// Fabric properties are independent of how an individual panel is cut on the roll.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FabricProperties {
    pub warp: f64,
    pub weft: f64,
    pub shear: f64,
    pub compression_ratio: f64,
    pub compression_transition: f64,
    pub bend_warp: f64,
    pub bend_weft: f64,
    pub density: f64,
    pub thickness: f64,
}
impl Default for FabricProperties {
    fn default() -> Self {
        Self::from(&Material::default())
    }
}
impl From<&Material> for FabricProperties {
    fn from(m: &Material) -> Self {
        Self {
            warp: m.warp,
            weft: m.weft,
            shear: m.shear,
            compression_ratio: m.compression_ratio,
            compression_transition: m.compression_transition,
            bend_warp: m.bend_warp,
            bend_weft: m.bend_weft,
            density: m.density,
            thickness: m.thickness,
        }
    }
}
impl FabricProperties {
    pub fn bind(&self, grain_degrees: f64) -> Material {
        Material {
            warp: self.warp,
            weft: self.weft,
            shear: self.shear,
            compression_ratio: self.compression_ratio,
            compression_transition: self.compression_transition,
            bend_warp: self.bend_warp,
            bend_weft: self.bend_weft,
            density: self.density,
            thickness: self.thickness,
            grain_degrees,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fabric {
    pub id: String,
    pub name: String,
    pub properties: FabricProperties,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Placement {
    pub translation: DVec3,
    /// R = Rx * Ry * Rz (column vectors); rotates the local (u,-v,0) panel.
    pub rotation_degrees: DVec3,
}
impl Default for Placement {
    fn default() -> Self {
        Self {
            translation: DVec3::ZERO,
            rotation_degrees: DVec3::ZERO,
        }
    }
}
impl Placement {
    pub fn transform(&self, p: DVec3) -> DVec3 {
        let r = self.rotation_degrees * (std::f64::consts::PI / 180.0);
        DQuat::from_euler(EulerRot::XYZ, r.x, r.y, r.z) * p + self.translation
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Corner {
    TopLeft,
    TopRight,
    BottomRight,
    BottomLeft,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Panel {
    pub id: String,
    pub name: String,
    pub pattern: Pattern,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polygon: Option<PolygonPattern>,
    pub fabric: String,
    pub grain_degrees: f64,
    pub placement: Placement,
    /// Position of the local material origin on the unified 2D drafting board.
    /// Presentation only: it never transforms rest geometry or 3D placement.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_2d: Option<DVec2>,
    /// Board presentation only; material coordinates and grain are unchanged.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub layout_rotation_degrees: f64,
    #[serde(default)]
    pub pins: Vec<Corner>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pin_points: Vec<DVec2>,
}
fn is_zero(value: &f64) -> bool {
    *value == 0.
}
impl Panel {
    pub fn boundary_vertices(&self, side: Side, offset: usize) -> Vec<usize> {
        let (nx, ny) = (self.pattern.nx, self.pattern.ny);
        let vertices: Vec<_> = match side {
            Side::Top => (0..=nx).collect(),
            Side::Right => (0..=ny).map(|j| j * (nx + 1) + nx).collect(),
            Side::Bottom => (0..=nx).rev().map(|i| ny * (nx + 1) + i).collect(),
            Side::Left => (0..=ny).rev().map(|j| j * (nx + 1)).collect(),
        };
        vertices.into_iter().map(|i| i + offset).collect()
    }
    fn corner(&self, corner: Corner) -> usize {
        let (nx, ny) = (self.pattern.nx, self.pattern.ny);
        match corner {
            Corner::TopLeft => 0,
            Corner::TopRight => nx,
            Corner::BottomRight => ny * (nx + 1) + nx,
            Corner::BottomLeft => ny * (nx + 1),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GarmentTemplate {
    pub format: String,
    pub version: u32,
    pub name: String,
    pub fabrics: Vec<Fabric>,
    /// Optional visual metadata keyed by stable fabric ID, excluded from physics.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub fabric_appearance: BTreeMap<String, super::appearance::FabricAppearance>,
    /// Nonphysical artwork placements; asset IDs are opaque, not file paths.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub graphics: Vec<super::graphics::GraphicPlacement>,
    /// Construction annotations only; they do not create physical fasteners.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub trims: Vec<super::trims::Trim>,
    pub panels: Vec<Panel>,
    pub seams: Vec<SeamSpec>,
    /// Editable two-piece relations, never a solver constraint.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mirror_links: Vec<MirrorLink>,
    /// Authored world holds, identified by exact material coordinates.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pin_targets: Vec<super::pins::MaterialPinTarget>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub frozen_panels: Vec<super::pins::FrozenPanel>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MirrorLink {
    pub a: String,
    pub b: String,
    pub axis: super::shapes::MirrorAxis,
}
#[derive(Clone, Debug)]
pub struct PanelRange {
    pub id: String,
    pub vertices: Range<usize>,
    pub triangles: Range<usize>,
    pub material: usize,
    pub boundaries: BTreeMap<String, Vec<usize>>,
}
#[derive(Clone, Debug)]
pub struct CompiledGarment {
    pub mesh: Mesh,
    pub initial_state: State,
    /// Flat arrangement before authored world targets; not material rest shape.
    pub arrangement_positions: Vec<DVec3>,
    /// Legacy constraints before adding authored world targets.
    pub legacy_pins: Vec<Option<DVec3>>,
    /// Membership remains explicit when an authored target coincides with a legacy pin.
    pub authored_holds: Vec<bool>,
    /// One orientation-bound material per panel, derived from shared fabric properties.
    pub materials: Vec<Material>,
    pub vertex_material: Vec<usize>,
    pub seams: Vec<CompiledSeam>,
    pub panels: Vec<PanelRange>,
    pub warnings: Vec<String>,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn unique_ids<'a>(ids: impl Iterator<Item = &'a str>, kind: &str) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    for id in ids {
        if !valid_id(id) || !seen.insert(id) {
            return Err(format!("Invalid or duplicate {kind} id: {id}"));
        }
    }
    Ok(())
}
impl GarmentTemplate {
    pub fn load(path: &Path) -> Result<Self, String> {
        let template: Self =
            serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        template.compile()?;
        Ok(template)
    }
    pub fn save(&self, path: &Path) -> Result<(), String> {
        self.compile()?;
        fs::write(
            path,
            serde_json::to_string_pretty(self).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())
    }
    pub fn compile(&self) -> Result<CompiledGarment, String> {
        if self.format != "marvelous-cloth-template" || !(1..=2).contains(&self.version) {
            return Err("Unsupported garment template format/version".into());
        }
        if self.version == 1
            && (!self.pin_targets.is_empty()
                || !self.frozen_panels.is_empty()
                || self
                    .panels
                    .iter()
                    .any(|p| p.polygon.is_some() || !p.pin_points.is_empty())
                || self
                    .seams
                    .iter()
                    .any(|s| s.references().any(|r| r.edge.is_some())))
        {
            return Err("Polygon geometry and material pins require template version 2".into());
        }
        if self.panels.is_empty()
            || self.panels.len() > 128
            || self.fabrics.is_empty()
            || self.seams.len() > 512
        {
            return Err("Template needs 1..128 panels, fabrics and at most 512 seams".into());
        }
        unique_ids(self.panels.iter().map(|p| p.id.as_str()), "panel")?;
        unique_ids(self.fabrics.iter().map(|f| f.id.as_str()), "fabric")?;
        unique_ids(self.seams.iter().map(|s| s.id.as_str()), "seam")?;
        if self.graphics.len() > 4096 {
            return Err("At most 4096 graphic placements are supported".into());
        }
        unique_ids(self.graphics.iter().map(|g| g.id.as_str()), "graphic")?;
        for graphic in &self.graphics {
            graphic.validate_panel(self)?;
        }
        if self.trims.len() > 4096 {
            return Err("At most 4096 trims are supported".into());
        }
        unique_ids(self.trims.iter().map(|t| t.id.as_str()), "trim")?;
        for trim in &self.trims {
            trim.validate()?;
            if !self.panels.iter().any(|p| p.id == trim.panel_id) {
                return Err("Trim references a missing panel".into());
            }
        }
        let mut linked = std::collections::BTreeSet::new();
        for link in &self.mirror_links {
            for id in [&link.a, &link.b] {
                if !linked.insert(id)
                    || !self
                        .panels
                        .iter()
                        .any(|p| &p.id == id && p.polygon.is_some())
                {
                    return Err("Mirror links require distinct polygon panels, with at most one partner per panel".into());
                }
            }
        }
        for (id, appearance) in &self.fabric_appearance {
            if !self.fabrics.iter().any(|f| &f.id == id) {
                return Err(format!("Appearance references missing fabric {id}"));
            }
            appearance.validate()?;
        }
        for f in &self.fabrics {
            f.properties.bind(0.0).validate()?;
        }
        let mut out = CompiledGarment {
            arrangement_positions: vec![],
            legacy_pins: vec![],
            authored_holds: vec![],
            mesh: Mesh {
                uv: vec![],
                triangles: vec![],
                hinges: vec![],
                rest_area: vec![],
                masses: vec![],
                pins: vec![],
            },
            initial_state: State {
                x: vec![],
                v: vec![],
                time: 0.0,
            },
            materials: vec![],
            vertex_material: vec![],
            seams: vec![],
            panels: vec![],
            warnings: vec![],
        };
        for panel in &self.panels {
            if panel.layout_2d.is_some_and(|p| !p.is_finite())
                || !panel.layout_rotation_degrees.is_finite()
            {
                return Err("Non-finite 2D layout".into());
            }
            let f = self
                .fabrics
                .iter()
                .find(|f| f.id == panel.fabric)
                .ok_or_else(|| {
                    format!(
                        "Panel {} references missing fabric {}",
                        panel.id, panel.fabric
                    )
                })?;
            if !panel.placement.translation.is_finite()
                || !panel.placement.rotation_degrees.is_finite()
            {
                return Err(format!("Non-finite placement for {}", panel.id));
            }
            if panel
                .pins
                .iter()
                .enumerate()
                .any(|(i, p)| panel.pins[..i].contains(p))
            {
                return Err(format!("Duplicate pin in {}", panel.id));
            }
            let material = f.properties.bind(panel.grain_degrees);
            let (mut mesh, mut boundaries) = if let Some(polygon) = &panel.polygon {
                if !panel.pins.is_empty() {
                    return Err("Polygon panels use pin_points, not rectangle corners".into());
                }
                if polygon.points.iter().any(|p| {
                    p.x < 0.0
                        || p.y < 0.0
                        || p.x > panel.pattern.width + 1e-9
                        || p.y > panel.pattern.height + 1e-9
                }) {
                    return Err("Polygon outside declared pattern bounds".into());
                }
                let built = if polygon
                    .meshing
                    .as_ref()
                    .is_some_and(|m| m.physics_sizing.is_some())
                {
                    // Rebind estimates whenever the shared fabric or panel grain
                    // changes. No material values are changed by mesh sizing.
                    let mut prepared = polygon.clone();
                    let plan = prepared
                        .meshing
                        .as_mut()
                        .unwrap()
                        .physics_sizing
                        .as_mut()
                        .unwrap();
                    plan.bending_nm = [material.bend_warp, material.bend_weft];
                    plan.axis_degrees = panel.grain_degrees;
                    prepared.build(&material)?
                } else {
                    polygon.build(&material)?
                };
                (built.mesh, built.boundaries)
            } else {
                (
                    panel.pattern.build(&material, Scene::Sphere)?.0,
                    BTreeMap::new(),
                )
            };
            let vertex_start = out.mesh.uv.len();
            let tri_start = out.mesh.triangles.len();
            let material_id = out.materials.len();
            let x: Vec<_> = mesh
                .uv
                .iter()
                .map(|p| panel.placement.transform(DVec3::new(p.x, -p.y, 0.0)))
                .collect();
            if x.iter().any(|p| !p.is_finite()) {
                return Err("Placement overflow".into());
            }
            mesh.pins.fill(None);
            for corner in &panel.pins {
                let i = panel.corner(*corner);
                mesh.pins[i] = Some(x[i]);
            }
            for point in &panel.pin_points {
                let i = mesh
                    .uv
                    .iter()
                    .position(|p| p.distance(*point) < 1e-9)
                    .ok_or("Pin point must coincide with a rest mesh vertex")?;
                mesh.pins[i] = Some(x[i]);
            }
            for ids in boundaries.values_mut() {
                for i in ids {
                    *i += vertex_start;
                }
            }
            for t in &mut mesh.triangles {
                t.vertices = t.vertices.map(|i| i + vertex_start);
                t.material = material_id;
            }
            for h in &mut mesh.hinges {
                h.vertices = h.vertices.map(|i| i + vertex_start);
                h.material = material_id;
            }
            out.vertex_material
                .extend(std::iter::repeat_n(material_id, x.len()));
            out.initial_state
                .v
                .extend(std::iter::repeat_n(DVec3::ZERO, x.len()));
            out.initial_state.x.extend(x);
            out.mesh.uv.extend(mesh.uv);
            out.mesh.triangles.extend(mesh.triangles);
            out.mesh.hinges.extend(mesh.hinges);
            out.mesh.rest_area.extend(mesh.rest_area);
            out.mesh.masses.extend(mesh.masses);
            out.mesh.pins.extend(mesh.pins);
            out.materials.push(material);
            out.panels.push(PanelRange {
                id: panel.id.clone(),
                vertices: vertex_start..out.mesh.uv.len(),
                triangles: tri_start..out.mesh.triangles.len(),
                material: material_id,
                boundaries,
            });
        }
        let curve = |reference: &BoundaryRef, reverse: bool| -> Result<BoundaryCurve, String> {
            let i = self
                .panels
                .iter()
                .position(|p| p.id == reference.panel)
                .ok_or_else(|| format!("Missing seam panel {}", reference.panel))?;
            let vertices = if let Some(edge) = &reference.edge {
                out.panels[i]
                    .boundaries
                    .get(edge)
                    .cloned()
                    .ok_or_else(|| format!("Unknown boundary {edge} on {}", reference.panel))?
            } else {
                if self.panels[i].polygon.is_some() {
                    return Err("Polygon seam requires a named edge".into());
                }
                self.panels[i].boundary_vertices(reference.side, out.panels[i].vertices.start)
            };
            BoundaryCurve::new(
                &out.mesh,
                vertices,
                reference.range,
                reverse ^ reference.reversed,
            )
        };
        for (i, spec) in self.seams.iter().enumerate() {
            if spec.a_tail.len() >= 128 || spec.b_tail.len() >= 128 {
                return Err("Sewing side needs 1..128 segments".into());
            }
            // Reject overlapping seam ownership, including sewing an interval to itself.
            let refs: Vec<_> = spec.references().collect();
            let previous: Vec<_> = self.seams[..i]
                .iter()
                .flat_map(|s| s.references())
                .collect();
            for (j, r) in refs.iter().enumerate() {
                for other in previous.iter().copied().chain(refs[..j].iter().copied()) {
                    if r.panel == other.panel
                        && (if r.edge.is_some() || other.edge.is_some() {
                            r.edge == other.edge
                        } else {
                            r.side == other.side
                        })
                        && r.range[0].max(other.range[0]) < r.range[1].min(other.range[1]) - 1e-12
                    {
                        return Err(format!(
                            "Overlapping seam ownership on {} {:?}",
                            r.panel, r.side
                        ));
                    }
                }
            }
            let seam = CompiledSeam::compile(
                spec,
                BoundaryCurve::concatenate(
                    spec.side(false)
                        .map(|r| curve(r, false))
                        .collect::<Result<_, _>>()?,
                    false,
                )?,
                BoundaryCurve::concatenate(
                    spec.side(true)
                        .map(|r| curve(r, false))
                        .collect::<Result<_, _>>()?,
                    spec.reverse_b,
                )?,
            )?;
            if (seam.lengths[0] - seam.lengths[1]).abs()
                > 1e-8 * seam.lengths[0].max(seam.lengths[1])
                || seam.notches.iter().any(|k| (k[0] - k[1]).abs() > 1e-8)
            {
                out.warnings.push(format!(
                    "{}: unequal total or notch-interval lengths ({:.3} / {:.3} m total); no physical gathering model",
                    seam.id, seam.lengths[0], seam.lengths[1]
                ));
            }
            out.seams.push(seam);
        }
        out.arrangement_positions = out.initial_state.x.clone();
        out.legacy_pins = out.mesh.pins.clone();
        out.authored_holds = vec![false; out.mesh.uv.len()];
        for (i, target) in super::pins::resolve_targets(&out, &self.pin_targets)? {
            out.authored_holds[i] = true;
            out.mesh.pins[i] = Some(target);
            out.initial_state.x[i] = target;
        }
        for (i, target) in super::pins::resolve_frozen(&out, &self.frozen_panels)? {
            out.authored_holds[i] = true;
            out.mesh.pins[i] = Some(target);
            out.initial_state.x[i] = target;
        }
        Ok(out)
    }

    /// Deterministic small fixture: 3x4 and 4x7 cells, independent 3D placements.
    pub fn two_panel_demo() -> Self {
        let properties = FabricProperties::default();
        Self {
            format: "marvelous-cloth-template".into(),
            version: 1,
            name: "Two panels / nonmatching seam".into(),
            mirror_links: vec![],
            pin_targets: vec![],
            frozen_panels: vec![],
            fabric_appearance: Default::default(),
            graphics: vec![],
            trims: vec![],
            fabrics: vec![Fabric {
                id: "woven-demo".into(),
                name: "Uncalibrated woven reference".into(),
                properties,
            }],
            panels: vec![
                Panel {
                    polygon: None,
                    pin_points: vec![],
                    layout_2d: None,
                    layout_rotation_degrees: 0.,
                    id: "left".into(),
                    name: "Left panel".into(),
                    pattern: Pattern {
                        width: 0.4,
                        height: 0.6,
                        nx: 3,
                        ny: 4,
                    },
                    fabric: "woven-demo".into(),
                    grain_degrees: 0.0,
                    placement: Placement {
                        translation: DVec3::new(-0.4, 1.0, 0.0),
                        ..Default::default()
                    },
                    pins: vec![Corner::TopLeft, Corner::TopRight],
                },
                Panel {
                    polygon: None,
                    pin_points: vec![],
                    layout_2d: None,
                    layout_rotation_degrees: 0.,
                    id: "right".into(),
                    name: "Right panel".into(),
                    pattern: Pattern {
                        width: 0.4,
                        height: 0.6,
                        nx: 4,
                        ny: 7,
                    },
                    fabric: "woven-demo".into(),
                    grain_degrees: 45.0,
                    placement: Placement {
                        translation: DVec3::new(0.08, 1.0, 0.03),
                        rotation_degrees: DVec3::new(8.0, 12.0, 0.0),
                    },
                    pins: vec![],
                },
            ],
            seams: vec![SeamSpec {
                a_tail: vec![],
                b_tail: vec![],
                id: "centre-seam".into(),
                a: BoundaryRef {
                    reversed: false,
                    edge: None,
                    panel: "left".into(),
                    side: Side::Right,
                    range: [0.0, 1.0],
                },
                b: BoundaryRef {
                    reversed: false,
                    edge: None,
                    panel: "right".into(),
                    side: Side::Left,
                    range: [0.0, 1.0],
                },
                reverse_b: true,
                notches: vec![[0.5, 0.5]],
                stiffness: 5000.0,
                allow_ease: false,
            }],
        }
    }
}

impl CompiledGarment {
    pub fn max_seam_gap(&self, x: &[DVec3]) -> f64 {
        self.seams.iter().map(|s| s.max_gap(x)).fold(0.0, f64::max)
    }
    pub fn fiber_frames(&self, x: &[DVec3]) -> Vec<energy::FiberFrame> {
        self.mesh
            .triangles
            .iter()
            .map(|t| energy::fiber_frame(x, t, &self.materials[t.material]))
            .collect()
    }
}
