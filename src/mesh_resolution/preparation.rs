//! Static simulation mesh preparation. The normal garment compiler constructs
//! masses, hinges, seams, pins and arrangement from these material-space results.
use super::{
    mesh::{self, Domain, Options, Ring},
    sizing::{Calibration, Fabric, Feature, SizingMap, Source},
};
use crate::garment::{
    GarmentTemplate,
    domain::{Hole, InternalLine},
    meshing::{MeshingSettings, TriangulatedContour},
};
use glam::DVec2;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PhysicsSizing {
    /// Explicit volumetric modulus estimates, not the solver's N/m coefficients.
    pub young_pa: [f64; 2],
    pub bending_nm: [f64; 2],
    pub axis_degrees: f64,
    pub boundary_ratio: f64,
    pub transition_m: f64,
    pub seed: u64,
}
impl PhysicsSizing {
    pub fn validate(&self) -> Result<(), String> {
        self.base()?;
        if !self.boundary_ratio.is_finite()
            || !(0.1..=1.).contains(&self.boundary_ratio)
            || !self.transition_m.is_finite()
            || !(0.001..=1.).contains(&self.transition_m)
        {
            return Err(
                "Physics sizing needs boundary spacing ratio 0.1..1 and transition 1..1000 mm"
                    .into(),
            );
        }
        Ok(())
    }
    pub fn base(&self) -> Result<[f64; 2], String> {
        Fabric {
            young_pa: self.young_pa,
            bending_nm: self.bending_nm,
            axis_degrees: self.axis_degrees,
        }
        .resolution(&Calibration::default())
    }
    pub fn map(&self, paths: &[Vec<DVec2>]) -> Result<SizingMap, String> {
        self.validate()?;
        let base = self.base()?;
        let sources = if self.boundary_ratio < 1. {
            paths
                .iter()
                .map(|points| Source {
                    feature: Feature::Polyline {
                        points: points.clone(),
                    },
                    spacing_m: base.map(|r| r * self.boundary_ratio),
                    doubling_distance_m: self.transition_m,
                    exponent: 0.5,
                })
                .collect()
        } else {
            vec![]
        };
        SizingMap::new(base, self.axis_degrees, sources)
    }
}

/// Create a tentative template; callers compile it before installing anything.
/// The same explicit E estimates are used on selected panels, while each panel
/// keeps its real fabric bending parameters and its own grain orientation.
pub fn configure(
    template: &GarmentTemplate,
    selected: &[String],
    young_pa: [f64; 2],
    boundary_ratio: f64,
    transition_m: f64,
    enabled: bool,
) -> Result<GarmentTemplate, String> {
    if selected.is_empty() {
        return Err("Select at least one polygon panel".into());
    }
    let mut result = template.clone();
    for id in selected {
        let panel = result
            .panels
            .iter_mut()
            .find(|p| p.id == *id)
            .ok_or("Selected panel disappeared")?;
        let polygon = panel
            .polygon
            .as_mut()
            .ok_or("Physics mesh preparation requires editable polygon panels")?;
        let fabric = result
            .fabrics
            .iter()
            .find(|f| f.id == panel.fabric)
            .ok_or("Missing panel fabric")?;
        let mut settings = polygon.meshing_settings();
        settings.physics_sizing = if enabled {
            let plan = PhysicsSizing {
                young_pa,
                bending_nm: [fabric.properties.bend_warp, fabric.properties.bend_weft],
                axis_degrees: panel.grain_degrees,
                boundary_ratio,
                transition_m,
                seed: 42,
            };
            plan.validate()?;
            Some(plan)
        } else {
            None
        };
        polygon.meshing = Some(settings);
    }
    Ok(result)
}

pub fn triangulate(
    points: &[DVec2],
    names: &[String],
    holes: &[Hole],
    lines: &[InternalLine],
    settings: &MeshingSettings,
    plan: &PhysicsSizing,
) -> Result<TriangulatedContour, String> {
    if points.len() != names.len() {
        return Err("Mismatched prepared boundary names".into());
    }
    let mut used: BTreeSet<String> = holes
        .iter()
        .flat_map(|h| h.edges.clone())
        .chain(lines.iter().map(|l| l.id.clone()))
        .chain(names.iter().cloned())
        .collect();
    // Polygon compilation supplies temporary @part names; keep the research
    // domain's validator strict, then map chains back to those exact identities.
    let mut safe = vec![];
    for i in 0..points.len() {
        let mut name = format!("prepared_{i}");
        while used.contains(&name) {
            name.push('_');
        }
        used.insert(name.clone());
        safe.push(name);
    }
    let line_paths: BTreeMap<_, _> = lines
        .iter()
        .map(|l| Ok((l.id.clone(), l.samples()?)))
        .collect::<Result<_, String>>()?;
    let domain = Domain {
        outer: Ring {
            points: points.to_vec(),
            edges: safe.clone(),
        },
        holes: holes
            .iter()
            .map(|h| Ring {
                points: h.points.clone(),
                edges: h.edges.clone(),
            })
            .collect(),
        lines: line_paths,
    };
    let closed = |p: &[DVec2]| {
        let mut p = p.to_vec();
        p.push(p[0]);
        p
    };
    let mut paths = vec![closed(points)];
    paths.extend(holes.iter().map(|h| closed(&h.points)));
    paths.extend(domain.lines.values().cloned());
    let map = plan.map(&paths)?;
    let options = Options {
        seed: plan.seed,
        max_vertices: settings.max_vertices,
        ..Default::default()
    };
    let output = mesh::generate_with_quality(
        &domain,
        &map,
        &options,
        &|| false,
        Some(settings.min_angle_degrees),
    )?;
    let mut boundaries = output.boundaries;
    for (safe, name) in safe.iter().zip(names) {
        let ids = boundaries.remove(safe).ok_or("Missing prepared boundary")?;
        boundaries.insert(name.clone(), ids);
    }
    Ok(TriangulatedContour {
        uv: output.uv,
        faces: output.faces,
        boundaries,
    })
}

/// Original hanging gathered-panel example, already configured for one-time
/// mesh preparation. The short band is pinned; its lower edge gathers a skirt
/// waist twice as long through the existing physical sewing objective.
pub fn simulation_demo(
    avatar_path: std::path::PathBuf,
) -> Result<crate::fitting::FittingProject, String> {
    use crate::garment::{
        polygon::PolygonPattern,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
    };
    use glam::DVec3;
    let mut template = presets::basic(GarmentKind::Tshirt, 0);
    template.panels.truncate(1);
    template.seams.clear();
    template.mirror_links.clear();
    template.pin_targets.clear();
    template.frozen_panels.clear();
    template.name = "One-time mesh preparation: gathered hanging panel".into();
    let polygon = |points: Vec<DVec2>, edges: Vec<String>| PolygonPattern {
        points,
        edges,
        subdivisions: 0,
        meshing: Some(MeshingSettings {
            target_edge_m: 0.025,
            ..Default::default()
        }),
        curves: BTreeMap::new(),
        holes: vec![],
        lines: vec![],
        target_lengths: BTreeMap::new(),
    };
    let skirt = &mut template.panels[0];
    skirt.id = "skirt".into();
    skirt.name = "Gathered skirt panel".into();
    skirt.pins.clear();
    skirt.pin_points.clear();
    skirt.grain_degrees = 90.;
    skirt.pattern.width = 0.46;
    skirt.pattern.height = 0.40;
    skirt.placement.translation = DVec3::new(-0.23, 1.46, 0.46);
    skirt.placement.rotation_degrees = DVec3::new(3., 0., 0.);
    skirt.layout_2d = Some(DVec2::ZERO);
    skirt.layout_rotation_degrees = 0.;
    skirt.polygon = Some(polygon(
        vec![
            DVec2::new(0.10, 0.),
            DVec2::new(0.36, 0.),
            DVec2::new(0.46, 0.40),
            DVec2::new(0., 0.40),
        ],
        ["waist", "right", "hem", "left"]
            .map(str::to_owned)
            .to_vec(),
    ));
    let mut band = skirt.clone();
    band.id = "waistband".into();
    band.name = "Pinned short waistband".into();
    band.pattern.width = 0.13;
    band.pattern.height = 0.03;
    band.placement.translation = DVec3::new(-0.065, 1.50, 0.45);
    band.layout_2d = Some(DVec2::new(0.55, 0.));
    band.polygon = Some(polygon(
        vec![
            DVec2::ZERO,
            DVec2::new(0.13, 0.),
            DVec2::new(0.13, 0.03),
            DVec2::new(0., 0.03),
        ],
        ["top", "right", "bottom", "left"]
            .map(str::to_owned)
            .to_vec(),
    ));
    band.pin_points = vec![DVec2::ZERO, DVec2::new(0.13, 0.)];
    template.panels.push(band);
    let reference = |panel: &str, edge: &str| BoundaryRef {
        panel: panel.into(),
        edge: Some(edge.into()),
        side: Side::Top,
        range: [0., 1.],
        reversed: false,
    };
    template.seams.push(SeamSpec {
        id: "gathered_waist".into(),
        a: reference("skirt", "waist"),
        b: reference("waistband", "bottom"),
        a_tail: vec![],
        b_tail: vec![],
        reverse_b: true,
        allow_ease: true,
        notches: vec![],
        stiffness: 50000.,
    });
    let ids = template
        .panels
        .iter()
        .map(|p| p.id.clone())
        .collect::<Vec<_>>();
    let template = configure(&template, &ids, [110000.; 2], 0.5, 0.04, true)?;
    let mut project = crate::fitting::FittingProject::basic(GarmentKind::Tshirt, 0, avatar_path);
    project.template = template;
    project.quasistatic = false;
    project.prearrange = false;
    project.simulation = Some(crate::vbd::VbdSettings {
        dt: 1. / 120.,
        iterations: 16,
        damping: 2.,
        ..Default::default()
    });
    Ok(project)
}
