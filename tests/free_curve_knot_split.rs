//! Contract for converting an authored free knot into a persistent boundary vertex.
//! Runs entirely on disposable in-memory templates.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        meshing::MeshingSettings,
        polygon::{EdgeNotch, FreeCurvePoint, PolygonPattern},
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
        GarmentTemplate,
    },
};

const EDGE: &str = "edge_1";
const CHILD: &str = "edge_1_2";
const KNOT: &str = "center-knot";

fn fixture(extras: bool, sewn: bool) -> GarmentTemplate {
    let base = presets::basic(GarmentKind::Tshirt, 0);
    let mut source = authoring::apply(&base, Command::Polygon {
        points: vec![DVec2::ZERO, DVec2::new(0.4, 0.), DVec2::new(0.4, 0.3), DVec2::new(0., 0.3)],
        tangents: vec![],
        meshing: MeshingSettings { target_edge_m: 0.05, ..Default::default() },
        fabric: "woven-reference".into(),
        replace: true,
    }).unwrap().template;
    if sewn {
        source = authoring::apply(&source, Command::Duplicate {
            panel: source.panels[0].id.clone(),
        }).unwrap().template;
        source.seams.push(SeamSpec {
            id: "knot-seam".into(),
            a: BoundaryRef { panel: source.panels[0].id.clone(), side: Side::Top, edge: Some(EDGE.into()), range: [0., 1.] },
            b: BoundaryRef { panel: source.panels[1].id.clone(), side: Side::Top, edge: Some(EDGE.into()), range: [0., 1.] },
            reverse_b: false, notches: vec![], stiffness: 50_000., allow_ease: false,
        });
    }
    for p in &mut source.panels {
        let poly = p.polygon.as_mut().unwrap();
        poly.curves.insert(EDGE.into(), [DVec2::new(0.1, 0.), DVec2::new(0.3, 0.)]);
        let mut knots = vec![FreeCurvePoint {
            id: KNOT.into(), t: 0.5, position: DVec2::new(0.2, -0.02),
            derivative: Some(DVec2::new(0.4, 0.)), derivative_in:None, derivative_out:None, mirror_group: None,
        }];
        if extras {
            knots.insert(0, FreeCurvePoint {
                id: "left-knot".into(), t: 0.25, position: DVec2::new(0.1, -0.012),
                derivative: None, derivative_in:None, derivative_out:None, mirror_group: None,
            });
            knots.push(FreeCurvePoint {
                id: "right-knot".into(), t: 0.75, position: DVec2::new(0.3, -0.012),
                derivative: None, derivative_in:None, derivative_out:None, mirror_group: None,
            });
        }
        poly.free_curve_points.insert(EDGE.into(), knots);
        poly.notches.insert(EDGE.into(), vec![
            EdgeNotch { t: 0.16, depth_m: 0.003 },
            EdgeNotch { t: 0.84, depth_m: 0.003 },
        ]);
        poly.seam_allowances.insert(EDGE.into(), 0.012);
    }
    // Shape normalizes all local material coordinates and compensates layout.
    let shapes: Vec<_> = source.panels.iter().map(|p| (p.id.clone(), p.polygon.as_ref().unwrap().clone())).collect();
    for (panel, polygon) in shapes {
        source = authoring::apply(&source, Command::Shape { panel, polygon }).unwrap().template;
    }
    let length = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), EDGE).unwrap();
    for p in &mut source.panels {
        p.polygon.as_mut().unwrap().target_lengths.insert(EDGE.into(), length);
    }
    source.compile().unwrap();
    source
}

fn path(poly: &PolygonPattern, edge: &str) -> Vec<DVec2> {
    poly.edge_points(poly.edges.iter().position(|id| id == edge).unwrap()).unwrap()
}

fn distance_to_path(point: DVec2, path: &[DVec2]) -> f64 {
    path.windows(2).map(|p| {
        let delta = p[1] - p[0];
        let t = ((point - p[0]).dot(delta) / delta.length_squared()).clamp(0., 1.);
        point.distance(p[0] + delta * t)
    }).fold(f64::INFINITY, f64::min)
}

fn split_exact_knot(extras: bool, sewn: bool) {
    let original = fixture(extras, sewn);
    let unchanged = serde_json::to_vec(&original).unwrap();
    let panel = &original.panels[0];
    let before = panel.polygon.as_ref().unwrap();
    let old_path = path(before, EDGE);
    let old_notches: Vec<_> = before.notches[EDGE].iter()
        .map(|notch| before.notch_segment(EDGE, notch).unwrap()[0]).collect();
    let old_length = authoring::edge_length(before, EDGE).unwrap();
    // Symmetric authored shape gives the center knot exactly half the arclength.
    let mut history = History::default();
    history.record(original.clone());
    let updated = authoring::apply(&original, Command::SplitBoundary {
        panel: panel.id.clone(), edge: EDGE.into(), at_m: old_length * 0.5,
    }).expect("splitting exactly at a free knot must consume the knot into a vertex").template;
    assert_eq!(serde_json::to_vec(&original).unwrap(), unchanged);
    let new_panel = &updated.panels[0];
    let poly = new_panel.polygon.as_ref().unwrap();
    assert_eq!(poly.edges.len(), before.edges.len() + 1);
    assert_eq!(poly.edges[0], EDGE);
    assert_eq!(poly.edges[1], CHILD);
    // The consumed knot must persist as the exact identity of the inserted vertex.
    // This JSON-level assertion makes the required persisted API contract explicit.
    let json = serde_json::to_value(poly).unwrap();
    let ids = json.get("vertex_ids").and_then(|v| v.as_object())
        .expect("persist stable vertex_ids map keyed by outgoing edge");
    assert_eq!(ids.get(CHILD).and_then(|v| v.as_str()), Some(KNOT));
    let remaining: Vec<_> = poly.free_curve_points.values().flatten().collect();
    assert_eq!(remaining.len(), if extras { 2 } else { 0 });
    assert!(!remaining.iter().any(|k| k.id == KNOT));
    if extras {
        assert!(remaining.iter().any(|k| k.id == "left-knot"));
        assert!(remaining.iter().any(|k| k.id == "right-knot"));
    }
    let displacement = poly.points[0] - before.points[0];
    let old_layout = panel.layout_2d.unwrap_or_default();
    let new_layout = new_panel.layout_2d.unwrap_or_default();
    assert!((old_layout - new_layout - displacement).length() < 1e-12);
    let knot_position = before.free_curve_points[EDGE].iter().find(|k| k.id == KNOT).unwrap().position;
    assert!(poly.points[1].distance(knot_position + displacement) < 0.00001);
    let mut joined = path(poly, EDGE);
    let second = path(poly, CHILD);
    assert!(joined.last().unwrap().distance(second[0]) < 1e-12);
    joined.extend_from_slice(&second[1..]);
    for point in &old_path {
        assert!(distance_to_path(*point + displacement, &joined) < 0.00055, "contour drift at {point:?}");
    }
    for point in &joined {
        assert!(distance_to_path(*point - displacement, &old_path) < 0.00055, "reverse contour drift at {point:?}");
    }
    let lengths = authoring::edge_length(poly, EDGE).unwrap() + authoring::edge_length(poly, CHILD).unwrap();
    assert!((lengths - old_length).abs() < 0.00035);
    assert_eq!(poly.seam_allowances.get(EDGE), Some(&0.012));
    assert_eq!(poly.seam_allowances.get(CHILD), Some(&0.012));
    assert!((poly.target_lengths[EDGE] + poly.target_lengths[CHILD] - old_length).abs() < 1e-9);
    let migrated_notches: Vec<_> = [EDGE, CHILD].into_iter().flat_map(|edge|
        poly.notches.get(edge).into_iter().flatten().map(move |n| poly.notch_segment(edge, n).unwrap()[0])
    ).collect();
    assert_eq!(migrated_notches.len(), 2);
    for point in old_notches {
        assert!(migrated_notches.iter().any(|new| new.distance(point + displacement) < 0.00055));
    }
    if sewn {
        assert_eq!(updated.seams.len(), 2);
        assert_eq!(updated.seams.iter().map(|seam| seam.id.as_str())
            .collect::<std::collections::BTreeSet<_>>().len(), 2);
    }
    updated.compile().expect("sewn/allowanced split must compile");
    let json = serde_json::to_vec(&updated).unwrap();
    let reopened: GarmentTemplate = serde_json::from_slice(&json).unwrap();
    assert_eq!(serde_json::to_vec(&reopened).unwrap(), json);
    reopened.compile().unwrap();
    let undone = history.restore(&updated, false).unwrap().template;
    assert_eq!(serde_json::to_vec(&undone).unwrap(), unchanged);
    let redone = history.restore(&undone, true).unwrap().template;
    assert_eq!(serde_json::to_vec(&redone).unwrap(), json);
}

#[test]
fn exact_knot_consumption_retains_identity_curve_references_and_history() {
    for extras in [false, true] {
        for sewn in [false, true] {
            split_exact_knot(extras, sewn);
        }
    }
}

#[test]
fn knot_at_notch_station_rolls_back_atomically() {
    let mut source = fixture(false, false);
    let knot = source.panels[0].polygon.as_ref().unwrap().free_curve_points[EDGE][0].clone();
    // For symmetric geometry 50% material arclength is the exact knot station.
    let length = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), EDGE).unwrap();
    for offset in [-5e-10, 0., 5e-10] {
        source.panels[0].polygon.as_mut().unwrap().notches.get_mut(EDGE).unwrap()[0].t = 0.5 + offset;
        let before = serde_json::to_vec(&source).unwrap();
        assert!(authoring::apply(&source, Command::SplitBoundary {
            panel: source.panels[0].id.clone(), edge: EDGE.into(), at_m: length * 0.5,
        }).is_err(), "near-colliding physical notch must fail closed: offset={offset}");
        assert_eq!(serde_json::to_vec(&source).unwrap(), before);
    }
    assert_eq!(source.panels[0].polygon.as_ref().unwrap().free_curve_points[EDGE][0], knot);
}

#[test]
fn linked_mirror_knot_is_guarded_and_source_unchanged() {
    let mut source = fixture(false, false);
    source.panels[0].polygon.as_mut().unwrap().free_curve_points.get_mut(EDGE).unwrap()[0]
        .mirror_group = Some("linked-pair".into());
    let before = serde_json::to_vec(&source).unwrap();
    let length = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), EDGE).unwrap();
    assert!(authoring::apply(&source, Command::SplitBoundary {
        panel: source.panels[0].id.clone(), edge: EDGE.into(), at_m: length * 0.5,
    }).is_err());
    assert_eq!(serde_json::to_vec(&source).unwrap(), before);
}
