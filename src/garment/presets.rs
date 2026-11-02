//! Independently drafted engineering fixtures, not production sewing patterns.
use super::{
    GarmentTemplate,
    polygon::PolygonPattern,
    seam::{BoundaryRef, SeamSpec, Side},
    template::{Fabric, FabricProperties, Panel, Placement},
};
use crate::model::Pattern;
use clap::ValueEnum;
use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GarmentKind {
    Tshirt,
    Dress,
}
impl GarmentKind {
    pub fn name(self) -> &'static str {
        match self {
            Self::Tshirt => "tshirt",
            Self::Dress => "dress",
        }
    }
}
pub fn basic(kind: GarmentKind, subdivisions: u32) -> GarmentTemplate {
    let (points, edges, sewn, height): (Vec<[f64; 2]>, Vec<&str>, Vec<usize>, f64) = match kind {
        GarmentKind::Tshirt => (
            vec![
                [0.42, 0.0],
                [0.46, 0.065],
                [0.54, 0.065],
                [0.58, 0.0],
                [0.72, 0.04],
                [0.98, 0.24],
                [0.84, 0.40],
                [0.72, 0.29],
                [0.78, 0.66],
                [0.22, 0.66],
                [0.28, 0.29],
                [0.16, 0.40],
                [0.02, 0.24],
                [0.28, 0.04],
            ],
            vec![
                "neck-left",
                "neck-bottom",
                "neck-right",
                "shoulder-right",
                "sleeve-top-right",
                "cuff-right",
                "sleeve-under-right",
                "side-right",
                "hem",
                "side-left",
                "sleeve-under-left",
                "cuff-left",
                "sleeve-top-left",
                "shoulder-left",
            ],
            vec![3, 4, 6, 7, 9, 10, 12, 13],
            0.66,
        ),
        GarmentKind::Dress => (
            vec![
                [0.42, 0.0],
                [0.46, 0.065],
                [0.54, 0.065],
                [0.58, 0.0],
                [0.72, 0.035],
                [0.74, 0.23],
                [0.94, 1.08],
                [0.06, 1.08],
                [0.26, 0.23],
                [0.28, 0.035],
            ],
            vec![
                "neck-left",
                "neck-bottom",
                "neck-right",
                "shoulder-right",
                "armhole-right",
                "side-right",
                "hem",
                "side-left",
                "armhole-left",
                "shoulder-left",
            ],
            vec![3, 5, 7, 9],
            1.08,
        ),
    };
    let polygon = PolygonPattern {
        holes: vec![],
        lines: vec![],
        curves: Default::default(),
        target_lengths: Default::default(),
        seam_allowances: Default::default(),
        notches: Default::default(),
        measurements: Default::default(),
        points: points.into_iter().map(DVec2::from_array).collect(),
        edges: edges.iter().map(|s| s.to_string()).collect(),
        subdivisions,
        meshing: Some(super::meshing::MeshingSettings {
            target_edge_m: 0.1 / 2.0_f64.powi(subdivisions as i32),
            ..Default::default()
        }),
    };
    let panels = [("front", 0.38), ("back", -0.15)]
        .into_iter()
        .map(|(id, z)| Panel {
            id: id.into(),
            name: format!("{} {id}", kind.name()),
            pattern: Pattern {
                width: 1.0,
                height,
                nx: 1,
                ny: 1,
            },
            polygon: Some(polygon.clone()),
            fabric: "woven-reference".into(),
            grain_degrees: 90.0,
            placement: Placement {
                translation: DVec3::new(-0.5, 1.50, z),
                ..Default::default()
            },
            pins: vec![],
            pin_points: vec![],
            layout_2d: None,
            layout_rotation_degrees: 0.,
        })
        .collect();
    let seams = sewn
        .into_iter()
        .map(|i| SeamSpec {
            a_tail: vec![],
            b_tail: vec![],
            id: edges[i].into(),
            a: BoundaryRef {
                reversed: false,
                panel: "front".into(),
                side: Side::Top,
                edge: Some(edges[i].into()),
                range: [0.0, 1.0],
            },
            b: BoundaryRef {
                reversed: false,
                panel: "back".into(),
                side: Side::Top,
                edge: Some(edges[i].into()),
                range: [0.0, 1.0],
            },
            reverse_b: false,
            notches: vec![],
            stiffness: 50_000.0,
            allow_ease: false,
        })
        .collect();
    GarmentTemplate {
        format: "marvelous-cloth-template".into(),
        mirror_links: vec![],
        pin_targets: vec![],
        frozen_panels: vec![],
        version: 2,
        name: format!("{} / MakeHuman 1.75 m engineering fixture", kind.name()),
        fabric_appearance: Default::default(),
        graphics: vec![],
        trims: vec![],
        fabrics: vec![Fabric {
            id: "woven-reference".into(),
            name: "Uncalibrated woven reference".into(),
            properties: FabricProperties::default(),
        }],
        panels,
        seams,
    }
}
