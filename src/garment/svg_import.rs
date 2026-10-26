//! SVG outline geometry in physical metres, with +Y down like material V.
//! Parsing and prepared edits must never infer seams from adjacent contours.
use super::{
    GarmentTemplate, domain,
    meshing::MeshingSettings,
    polygon::PolygonPattern,
    template::{Panel, Placement},
};
use crate::{
    authoring::{self, Edit},
    model::Pattern,
};
use glam::{DVec2, DVec3};
use std::collections::{BTreeMap, BTreeSet};

const MAX_PIECES: usize = 128;
const MAX_CONTOUR_POINTS: usize = 4096;
const MAX_COMPARISONS: usize = 2_000_000;

/// One explicitly closed source contour; the first vertex is not repeated.
#[derive(Clone, Debug)]
pub struct Outline {
    pub name: String,
    pub points: Vec<DVec2>,
}

/// Source geometry and explicit conversion losses, for review before applying.
#[derive(Clone, Debug)]
pub struct Drawing {
    pub outlines: Vec<Outline>,
    pub losses: Vec<String>,
}

fn edge_intersection(a: DVec2, b: DVec2, c: DVec2, d: DVec2) -> bool {
    let eps = 1e-12;
    if a.min(b).x > c.max(d).x + eps
        || c.min(d).x > a.max(b).x + eps
        || a.min(b).y > c.max(d).y + eps
        || c.min(d).y > a.max(b).y + eps
    {
        return false;
    }
    let cross = |p: DVec2, q: DVec2, r: DVec2| (q - p).perp_dot(r - p);
    cross(a, b, c) * cross(a, b, d) <= eps * eps && cross(c, d, a) * cross(c, d, b) <= eps * eps
}

/// Append reviewed contours as separated, unsewn panels. Source coordinates are
/// already physical metres; SVG +Y is not flipped as it would be for CAD DXF.
/// No live document/history is changed. The caller installs this fully compiled
/// edit as one transaction, preserving unchanged panels via `Edit::state_after`.
/// `origin` is chosen by the caller outside its current avatar/drape bounds.
pub fn prepare(
    source: &GarmentTemplate,
    drawing: &Drawing,
    selected: &[usize],
    fabric: &str,
    meshing: MeshingSettings,
    origin: DVec3,
) -> Result<Edit, String> {
    meshing.validate()?;
    if !origin.is_finite() {
        return Err("Import placement must be finite".into());
    }
    if selected.is_empty()
        || selected.len() > MAX_PIECES
        || source.panels.len().saturating_add(selected.len()) > MAX_PIECES
    {
        return Err("Choose 1..128 SVG outlines within the garment panel limit".into());
    }
    if !source.fabrics.iter().any(|f| f.id == fabric) {
        return Err("Choose an existing fabric".into());
    }
    let mut seen = BTreeSet::new();
    let mut contours = Vec::with_capacity(selected.len());
    for &index in selected {
        if !seen.insert(index) {
            return Err("An SVG outline was selected twice".into());
        }
        let outline = drawing
            .outlines
            .get(index)
            .ok_or("Stale SVG outline selection")?;
        if !(3..=MAX_CONTOUR_POINTS).contains(&outline.points.len())
            || outline
                .points
                .iter()
                .any(|p| !p.is_finite() || p.abs().max_element() > 1000.)
        {
            return Err("SVG contour needs 3..4096 finite points within 1000 metres".into());
        }
        contours.push(outline);
    }
    // Separate selected paths may be hole/cut/sew alternatives. Do not guess.
    // Closed polygon validity (including self-intersection) is checked by compile.
    let mut comparisons = 0;
    for (i, a) in contours.iter().enumerate() {
        for b in contours.iter().skip(i + 1) {
            if domain::inside(a.points[0], &b.points) || domain::inside(b.points[0], &a.points) {
                return Err("Selected SVG outlines are nested or overlapping".into());
            }
            for j in 0..a.points.len() {
                for k in 0..b.points.len() {
                    comparisons += 1;
                    if comparisons > MAX_COMPARISONS {
                        return Err(
                            "SVG contour comparison budget exceeded; select fewer outlines".into(),
                        );
                    }
                    if edge_intersection(
                        a.points[j],
                        a.points[(j + 1) % a.points.len()],
                        b.points[k],
                        b.points[(k + 1) % b.points.len()],
                    ) {
                        return Err("Selected SVG outlines touch or overlap".into());
                    }
                }
            }
        }
    }
    let mut template = source.clone();
    let board_x = source
        .panels
        .iter()
        .enumerate()
        .map(|(i, p)| authoring::layout(source, i).x + p.pattern.width)
        .fold(0., f64::max)
        + 0.15;
    let mut offset = 0.;
    let mut selected_id = None;
    for outline in contours {
        let lo = outline
            .points
            .iter()
            .copied()
            .fold(DVec2::splat(f64::INFINITY), DVec2::min);
        let hi = outline
            .points
            .iter()
            .copied()
            .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max);
        let size = hi - lo;
        let mut points: Vec<_> = outline.points.iter().map(|p| *p - lo).collect();
        if domain::area(&points) < 0. {
            points.reverse();
        }
        let mut serial = 1;
        let id = loop {
            let id = format!("svg_{serial}");
            if !template.panels.iter().any(|p| p.id == id) {
                break id;
            }
            serial += 1;
        };
        let polygon = PolygonPattern {
            edges: (0..points.len())
                .map(|i| format!("edge_{}", i + 1))
                .collect(),
            points,
            subdivisions: 0,
            meshing: Some(meshing.clone()),
            curves: BTreeMap::new(),
            holes: vec![],
            lines: vec![],
            target_lengths: BTreeMap::new(),
        };
        template.panels.push(Panel {
            id: id.clone(),
            name: format!("{} · {}", outline.name, id),
            pattern: Pattern {
                width: size.x,
                height: size.y,
                nx: 1,
                ny: 1,
            },
            polygon: Some(polygon),
            fabric: fabric.into(),
            grain_degrees: 90.,
            placement: Placement {
                translation: origin + DVec3::new(offset, 0., 0.),
                ..Default::default()
            },
            layout_2d: Some(DVec2::new(board_x + offset, 0.)),
            layout_rotation_degrees: 0.,
            pins: vec![],
            pin_points: vec![],
        });
        offset += size.x + 0.1;
        selected_id = Some(id);
    }
    template.version = 2;
    let garment = template.compile()?;
    Ok(Edit {
        template,
        garment,
        selected: selected_id,
        reset_simulation: true,
        new_point: None,
    })
}
