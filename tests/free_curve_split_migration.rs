//! Acceptance contracts for transactional splitting of authored free-curve boundaries.
//! These intentionally fail until the native migration implementation is complete.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        meshing::MeshingSettings,
        polygon::{EdgeNotch, FreeCurvePoint, PolygonPattern},
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
        GarmentTemplate,
    },
};

const EDGE: &str = "edge_1";
const NEXT: &str = "edge_1_2";

fn fixture(sewn: bool) -> GarmentTemplate {
    let original = presets::basic(GarmentKind::Tshirt, 0);
    let mut garment = authoring::apply(&original, Command::Polygon {
        points: vec![DVec2::ZERO, DVec2::new(0.4, 0.), DVec2::new(0.4, 0.3), DVec2::new(0., 0.3)],
        tangents: vec![],
        meshing: MeshingSettings { target_edge_m: 0.05, ..Default::default() },
        fabric: "woven-reference".into(),
        replace: true,
    }).unwrap().template;
    if sewn {
        garment = authoring::apply(&garment, Command::Duplicate {
            panel: garment.panels[0].id.clone(),
        }).unwrap().template;
        garment.seams.push(SeamSpec {
            id: "free-curve-seam".into(),
            a: BoundaryRef { panel: garment.panels[0].id.clone(), side: Side::Top, edge: Some(EDGE.into()), range: [0., 1.] },
            b: BoundaryRef { panel: garment.panels[1].id.clone(), side: Side::Top, edge: Some(EDGE.into()), range: [0., 1.] },
            reverse_b: false, notches: vec![], stiffness: 50_000., allow_ease: false,
        });
    }
    for panel in &mut garment.panels {
        let poly = panel.polygon.as_mut().unwrap();
        poly.curves.insert(EDGE.into(), [DVec2::new(0.10, -0.022), DVec2::new(0.30, -0.018)]);
        poly.free_curve_points.insert(EDGE.into(), vec![
            FreeCurvePoint { id: "knot-a".into(), t: 0.27, position: DVec2::new(0.106, -0.034), derivative: None, derivative_in:None, derivative_out:None, mirror_group: None },
            FreeCurvePoint { id: "knot-b".into(), t: 0.72, position: DVec2::new(0.294, -0.029), derivative: None, derivative_in:None, derivative_out:None, mirror_group: None },
        ]);
        poly.seam_allowances.insert(EDGE.into(), 0.012);
        poly.notches.insert(EDGE.into(), vec![
            EdgeNotch { t: 0.17, depth_m: 0.003 },
            EdgeNotch { t: 0.86, depth_m: 0.003 },
        ]);
    }
    // Shape is the authored transaction that normalizes the material origin.
    // Direct fixture mutation leaves negative-y knots unnormalized and would
    // compare two different local coordinate frames after SplitBoundary.
    let shapes: Vec<_> = garment.panels.iter().map(|panel| {
        (panel.id.clone(), panel.polygon.as_ref().unwrap().clone())
    }).collect();
    for (panel, polygon) in shapes {
        garment = authoring::apply(&garment, Command::Shape { panel, polygon })
            .expect("normalize authored source shape").template;
    }
    let length = authoring::edge_length(garment.panels[0].polygon.as_ref().unwrap(), EDGE).unwrap();
    for panel in &mut garment.panels {
        panel.polygon.as_mut().unwrap().target_lengths.insert(EDGE.into(), length);
    }
    garment.compile().expect("valid two-knot material fixture");
    garment
}

fn path(poly: &PolygonPattern, edge: &str) -> Vec<DVec2> {
    let i = poly.edges.iter().position(|e| e == edge).unwrap();
    poly.edge_points(i).unwrap()
}

fn point_distance_to_path(point: DVec2, path: &[DVec2]) -> f64 {
    path.windows(2).map(|s| {
        let delta = s[1] - s[0];
        let t = ((point - s[0]).dot(delta) / delta.length_squared().max(1e-30)).clamp(0., 1.);
        point.distance(s[0] + delta * t)
    }).fold(f64::INFINITY, f64::min)
}

fn assert_migrated(source: &GarmentTemplate, fraction: f64) -> GarmentTemplate {
    let panel = source.panels[0].id.clone();
    let before = source.panels[0].polygon.as_ref().unwrap();
    let length = authoring::edge_length(before, EDGE).unwrap();
    let original_path = path(before, EDGE);
    let original_notches: Vec<_> = before.notches[EDGE].iter()
        .map(|n| before.notch_segment(EDGE, n).unwrap()[0]).collect();
    let bytes = serde_json::to_vec(source).unwrap();
    let updated = authoring::apply(source, Command::SplitBoundary {
        panel, edge: EDGE.into(), at_m: length * fraction,
    }).expect("split must migrate independent curve points and all references").template;
    assert_eq!(serde_json::to_vec(source).unwrap(), bytes, "source mutated");
    let poly = updated.panels[0].polygon.as_ref().unwrap();
    let shift = poly.points[0] - before.points[0];
    // normalize() can translate local material coordinates again if a newly
    // inserted split control becomes the polygon's minimum. The corresponding
    // layout offset must absorb that change, preserving displayed geometry.
    let old_layout = source.panels[0].layout_2d.unwrap_or_default();
    let new_layout = updated.panels[0].layout_2d.unwrap_or_default();
    assert!((old_layout - new_layout - shift).length() < 1e-12,
        "material frame translation lacks matching layout compensation: {shift:?}");
    assert_eq!(poly.edges.len(), before.edges.len() + 1);
    assert_eq!(poly.seam_allowances.get(EDGE), Some(&0.012));
    assert_eq!(poly.seam_allowances.get(NEXT), Some(&0.012));
    assert!((poly.target_lengths[EDGE] + poly.target_lengths[NEXT] - length).abs() < 1e-9);
    assert!((poly.target_lengths[EDGE] - length * fraction).abs() < 1e-9);
    let left_length = authoring::edge_length(poly, EDGE).unwrap();
    let right_length = authoring::edge_length(poly, NEXT).unwrap();
    assert!((left_length + right_length - length).abs() < 0.00035,
        "curve length changed by more than 0.35 mm");
    let mut joined = path(poly, EDGE);
    let right = path(poly, NEXT);
    assert!(joined.last().unwrap().distance(right[0]) < 1e-12);
    joined.extend_from_slice(&right[1..]);
    // Flattened Bézier paths have a conservative 0.25 mm tolerance per side.
    for point in &original_path {
        let distance = point_distance_to_path(*point + shift, &joined);
        assert!(distance < 0.00055,
            "sampled contour moved more than 0.55 mm at {point:?}; distance={distance}");
    }
    for point in &joined {
        let distance = point_distance_to_path(*point - shift, &original_path);
        assert!(distance < 0.00055,
            "sampled contour moved more than 0.55 mm at {point:?}; distance={distance}");
    }
    let controls: Vec<_> = [EDGE, NEXT].into_iter()
        .flat_map(|edge| poly.free_curve_points.get(edge).into_iter().flatten()).collect();
    assert_eq!(controls.len(), 2, "both persistent free knots must survive");
    for knot in &before.free_curve_points[EDGE] {
        let found = controls.iter().find(|c| c.id == knot.id).unwrap();
        assert!(found.position.distance(knot.position + shift) < 1e-12);
        assert_eq!(found.mirror_group, knot.mirror_group);
    }
    let new_notches: Vec<_> = [EDGE, NEXT].into_iter()
        .flat_map(|edge| poly.notches.get(edge).into_iter().flatten()
            .map(move |n| poly.notch_segment(edge, n).unwrap()[0])).collect();
    assert_eq!(new_notches.len(), original_notches.len());
    for old in original_notches {
        assert!(new_notches.iter().any(|new| (old + shift).distance(*new) < 0.00055),
            "physical notch station drifted during migration");
    }
    if !source.seams.is_empty() {
        assert_eq!(updated.seams.len(), 2);
        let mut ranges: Vec<_> = updated.seams.iter().map(|s| s.b.range).collect();
        ranges.sort_by(|a, b| a[0].total_cmp(&b[0]));
        assert!((ranges[0][0]).abs() < 1e-9);
        assert!((ranges[0][1] - ranges[1][0]).abs() < 1e-6);
        assert!((ranges[1][1] - 1.).abs() < 1e-9);
    }
    updated.compile().expect("manufacturing and sewing references must compile");
    let reopened: GarmentTemplate = serde_json::from_slice(&serde_json::to_vec(&updated).unwrap()).unwrap();
    reopened.compile().unwrap();
    assert_eq!(serde_json::to_vec(&reopened).unwrap(), serde_json::to_vec(&updated).unwrap());
    updated
}

#[test]
fn split_between_two_free_knots_preserves_curve_and_references() {
    for sewn in [false, true] {
        let original = fixture(sewn);
        assert_migrated(&original, 0.5);
    }
}

#[test]
fn split_before_and_after_free_knots_preserves_ids_and_stations() {
    for fraction in [0.08, 0.93] {
        assert_migrated(&fixture(false), fraction);
    }
}

#[test]
fn malformed_mirror_group_fails_atomically() {
    let mut source = fixture(false);
    source.panels[0].polygon.as_mut().unwrap().free_curve_points.get_mut(EDGE).unwrap()[0]
        .mirror_group = Some("orphan-pair".into());
    let snapshot = serde_json::to_vec(&source).unwrap();
    let length = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), EDGE).unwrap();
    assert!(authoring::apply(&source, Command::SplitBoundary {
        panel: source.panels[0].id.clone(), edge: EDGE.into(), at_m: length * 0.5,
    }).is_err());
    assert_eq!(serde_json::to_vec(&source).unwrap(), snapshot);
}

#[test]
fn adversarial_split_positions_and_notch_collision_are_atomic() {
    let original = fixture(false);
    let length = authoring::edge_length(original.panels[0].polygon.as_ref().unwrap(), EDGE).unwrap();
    let snapshot = serde_json::to_vec(&original).unwrap();
    for position in [f64::NAN, f64::INFINITY, -0.01, 0., length, length * 1.1] {
        assert!(authoring::apply(&original, Command::SplitBoundary {
            panel: original.panels[0].id.clone(), edge: EDGE.into(), at_m: position,
        }).is_err());
        assert_eq!(serde_json::to_vec(&original).unwrap(), snapshot);
    }
    let collision = length * original.panels[0].polygon.as_ref().unwrap().notches[EDGE][0].t;
    assert!(authoring::apply(&original, Command::SplitBoundary {
        panel: original.panels[0].id.clone(), edge: EDGE.into(), at_m: collision,
    }).is_err(), "notch at split station must fail closed");
}
