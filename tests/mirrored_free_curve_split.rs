//! A linked pair of free curve points must become two stable contour vertices
//! in one atomic material-space split, regardless of the initiating side.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        meshing::MeshingSettings,
        polygon::{EdgeNotch, FreeCurvePoint, MeasurementAnchor, PatternMeasurement, PolygonPattern},
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
        GarmentTemplate,
    },
};

const RIGHT: &str = "edge_2";
const LEFT: &str = "edge_4";
const RIGHT_KNOT: &str = "right-linked-knot";
const LEFT_KNOT: &str = "left-linked-knot";

fn fixture() -> GarmentTemplate {
    let original = presets::basic(GarmentKind::Tshirt, 0);
    let mut template = authoring::apply(&original, Command::Polygon {
        points: vec![DVec2::ZERO, DVec2::new(0.4, 0.), DVec2::new(0.4, 0.3), DVec2::new(0., 0.3)],
        tangents: vec![],
        meshing: MeshingSettings { target_edge_m: 0.05, ..Default::default() },
        fabric: "woven-reference".into(),
        replace: true,
    }).unwrap().template;
    let panel = template.panels[0].id.clone();
    let poly = template.panels[0].polygon.as_mut().unwrap();
    for (edge, id, position) in [
        (RIGHT, RIGHT_KNOT, DVec2::new(0.38, 0.15)),
        (LEFT, LEFT_KNOT, DVec2::new(0.02, 0.15)),
    ] {
        poly.free_curve_points.insert(edge.into(), vec![FreeCurvePoint {
            id: id.into(), t: 0.5, position, derivative: None, derivative_in:None, derivative_out:None,
            mirror_group: Some("linked-sides".into()),
        }]);
        poly.seam_allowances.insert(edge.into(), 0.012);
        poly.notches.insert(edge.into(), vec![
            EdgeNotch { t: 0.2, depth_m: 0.003 },
            EdgeNotch { t: 0.8, depth_m: 0.003 },
        ]);
    }
    let authored = poly.clone();
    template = authoring::apply(&template, Command::Shape { panel, polygon: authored }).unwrap().template;
    template.compile().expect("symmetric material fixture compiles");
    template
}

fn points(poly: &PolygonPattern, edge: &str) -> Vec<DVec2> {
    poly.edge_points(poly.edges.iter().position(|e| e == edge).unwrap()).unwrap()
}

fn distance_to_path(p: DVec2, path: &[DVec2]) -> f64 {
    path.windows(2).map(|segment| {
        let delta = segment[1] - segment[0];
        let t = ((p - segment[0]).dot(delta) / delta.length_squared().max(1e-30)).clamp(0., 1.);
        p.distance(segment[0] + delta * t)
    }).fold(f64::INFINITY, f64::min)
}

fn assert_preserved(before: &PolygonPattern, after: &PolygonPattern, edge: &str, knot_id: &str) {
    let child = format!("{edge}_2");
    assert_eq!(after.vertex_ids.get(&child).map(String::as_str), Some(knot_id));
    assert_eq!(after.vertex_mirror_groups.get(&child).map(String::as_str), Some("linked-sides"));
    assert!(!after.free_curve_points.values().flatten().any(|k| k.id == knot_id));
    assert_eq!(after.seam_allowances.get(edge), Some(&0.012));
    assert_eq!(after.seam_allowances.get(&child), Some(&0.012));
    let shift = after.points[0] - before.points[0];
    let old = points(before, edge);
    let mut joined = points(after, edge);
    let second = points(after, &child);
    assert!(joined.last().unwrap().distance(second[0]) < 1e-12);
    joined.extend_from_slice(&second[1..]);
    for p in &old {
        assert!(distance_to_path(*p + shift, &joined) < 0.00055, "{edge} original contour drift at {p:?}");
    }
    for p in &joined {
        assert!(distance_to_path(*p - shift, &old) < 0.00055, "{edge} new contour drift at {p:?}");
    }
    let old_marks: Vec<_> = before.notches[edge].iter().map(|n| before.notch_segment(edge, n).unwrap()[0]).collect();
    let new_marks: Vec<_> = [edge, child.as_str()].into_iter().flat_map(|e|
        after.notches.get(e).into_iter().flatten().map(move |n| after.notch_segment(e, n).unwrap()[0])
    ).collect();
    assert_eq!(new_marks.len(), old_marks.len());
    for mark in old_marks {
        assert!(new_marks.iter().any(|p| p.distance(mark + shift) < 0.00055), "{edge} notch station moved");
    }
}

fn sewn_fixture() -> GarmentTemplate {
    let original = fixture();
    let mut source = authoring::apply(&original, Command::Duplicate {
        panel: original.panels[0].id.clone(),
    }).unwrap().template;
    let first = source.panels[0].id.clone();
    let second = source.panels[1].id.clone();
    for (edge, name) in [(RIGHT, "right-side-seam"), (LEFT, "left-side-seam")] {
        let boundary = |panel: String| BoundaryRef {
            panel, side: Side::Top, edge: Some(edge.into()), range: [0., 1.],
        };
        source.seams.push(SeamSpec {
            id: name.into(), a: boundary(first.clone()), b: boundary(second.clone()),
            reverse_b: false, notches: vec![], stiffness: 50_000., allow_ease: false,
        });
        let measured = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), edge).unwrap();
        source.panels[0].polygon.as_mut().unwrap().target_lengths.insert(edge.into(), measured);
    }
    source.compile().expect("paired side seams and measured targets compile");
    source
}

#[test]
fn mirrored_sewn_split_preserves_pom_station_ids_and_exact_material_positions() {
    for initiator in [RIGHT, LEFT] {
        let mut original=sewn_fixture();
        let p=&mut original.panels[0];
        let poly=p.polygon.as_mut().unwrap();
        let pom=PatternMeasurement {
            id:"side-depth".into(),
            label:"Side panel depth".into(),
            a:MeasurementAnchor{edge:RIGHT.into(),t:0.73},
            b:MeasurementAnchor{edge:LEFT.into(),t:0.27},
        };
        poly.measurements.push(pom.clone());
        let old_stations=poly.measurement_points(&pom).unwrap();
        let old_mm=poly.measurement_length(&pom).unwrap()*1000.;
        original.compile().unwrap();
        let unchanged=serde_json::to_vec(&original).unwrap();
        let length=authoring::edge_length(original.panels[0].polygon.as_ref().unwrap(),initiator).unwrap();
        let edited=authoring::apply(&original,Command::SplitBoundary{
            panel:original.panels[0].id.clone(),edge:initiator.into(),at_m:length*0.5,
        }).expect("atomic mirrored sewn split must retain both POM stations");
        assert_eq!(serde_json::to_vec(&original).unwrap(),unchanged);
        let after=edited.template.panels[0].polygon.as_ref().unwrap();
        let promoted=after.measurements.iter().find(|m|m.id=="side-depth").unwrap();
        assert_eq!(promoted.label,pom.label);
        assert_ne!(promoted.a.edge,RIGHT);
        assert_eq!(promoted.b.edge,LEFT);
        assert_eq!(after.measurements.len(),1);
        let new_stations=after.measurement_points(promoted).unwrap();
        let offset=edited.template.panels[0].layout_2d.unwrap_or_default()
            -original.panels[0].layout_2d.unwrap_or_default();
        for (old,new) in old_stations.into_iter().zip(new_stations){
            assert!((old-new-offset).length()<0.00055,
                "mirrored paired split changed the physical POM station");
        }
        assert!((after.measurement_length(promoted).unwrap()*1000.-old_mm).abs()<0.55);
        let json=serde_json::to_vec(&edited.template).unwrap();
        let opened:GarmentTemplate=serde_json::from_slice(&json).unwrap();
        assert_eq!(opened.panels[0].polygon.as_ref().unwrap().measurements[0],*promoted);
        opened.compile().unwrap();
    }
}

#[test]
fn sewn_mirrored_split_migrates_both_sewing_edges_targets_and_persisted_vertex_groups() {
    for initiator in [RIGHT, LEFT] {
        let original = sewn_fixture();
        let original_bytes = serde_json::to_vec(&original).unwrap();
        let original_poly = original.panels[0].polygon.as_ref().unwrap();
        let mut history = History::default();
        history.record(original.clone());
        let length = authoring::edge_length(original_poly, initiator).unwrap();
        let updated = authoring::apply(&original, Command::SplitBoundary {
            panel: original.panels[0].id.clone(), edge: initiator.into(), at_m: length * 0.5,
        }).expect("both sewn reflected boundaries should split atomically").template;
        assert_eq!(serde_json::to_vec(&original).unwrap(), original_bytes);
        let polygon = updated.panels[0].polygon.as_ref().unwrap();
        assert_eq!(updated.seams.len(), 4, "both original seams should split into two correspondences");
        assert_eq!(polygon.edges.len(), original_poly.edges.len() + 2);
        for (edge, id, seam_id) in [(RIGHT, RIGHT_KNOT, "right-side-seam"), (LEFT, LEFT_KNOT, "left-side-seam")] {
            let successor = format!("{edge}_2");
            assert_preserved(original_poly, polygon, edge, id);
            let target = original_poly.target_lengths[edge];
            assert!((polygon.target_lengths[edge] + polygon.target_lengths[&successor] - target).abs() < 1e-9);
            assert!((polygon.target_lengths[edge] - target * 0.5).abs() < 1e-8);
            let corresponding: Vec<_> = updated.seams.iter().filter(|s|
                s.a.edge.as_deref() == Some(edge) || s.a.edge.as_deref() == Some(successor.as_str())
            ).collect();
            assert_eq!(corresponding.len(), 2, "{edge} must retain both sewing subintervals");
            assert!(corresponding.iter().any(|s| s.id == seam_id));
            let mut ranges: Vec<_> = corresponding.iter().map(|s| s.b.range).collect();
            ranges.sort_by(|a, b| a[0].total_cmp(&b[0]));
            assert!(ranges[0][0].abs() < 1e-9);
            assert!((ranges[0][1] - ranges[1][0]).abs() < 1e-6);
            assert!((ranges[1][1] - 1.).abs() < 1e-9);
            assert!(corresponding.iter().all(|s| s.b.panel == original.panels[1].id));
        }
        let json_value = serde_json::to_value(polygon).unwrap();
        assert_eq!(json_value["vertex_mirror_groups"]["edge_2_2"], "linked-sides");
        assert_eq!(json_value["vertex_mirror_groups"]["edge_4_2"], "linked-sides");
        updated.compile().expect("sewn split compilation");
        let json = serde_json::to_vec(&updated).unwrap();
        let reopened: GarmentTemplate = serde_json::from_slice(&json).unwrap();
        reopened.compile().unwrap();
        assert_eq!(serde_json::to_vec(&reopened).unwrap(), json);
        let undone = history.restore(&updated, false).unwrap().template;
        assert_eq!(serde_json::to_vec(&undone).unwrap(), original_bytes);
        let redone = history.restore(&undone, true).unwrap().template;
        assert_eq!(serde_json::to_vec(&redone).unwrap(), json);
    }
}

#[test]
fn either_mirrored_knot_split_promotes_both_vertices_preserves_geometry_and_history() {
    for initiator in [RIGHT, LEFT] {
        let original = fixture();
        let snapshot = serde_json::to_vec(&original).unwrap();
        let old_panel = &original.panels[0];
        let before = old_panel.polygon.as_ref().unwrap();
        let length = authoring::edge_length(before, initiator).unwrap();
        let mut history = History::default();
        history.record(original.clone());
        let updated = authoring::apply(&original, Command::SplitBoundary {
            panel: old_panel.id.clone(), edge: initiator.into(), at_m: length * 0.5,
        }).expect("linked mirrored split is a single transaction").template;
        assert_eq!(serde_json::to_vec(&original).unwrap(), snapshot);
        let after_panel = &updated.panels[0];
        let after = after_panel.polygon.as_ref().unwrap();
        assert_eq!(after.edges.len(), before.edges.len() + 2);
        assert_preserved(before, after, RIGHT, RIGHT_KNOT);
        assert_preserved(before, after, LEFT, LEFT_KNOT);
        let shift = after.points[0] - before.points[0];
        let old_layout = old_panel.layout_2d.unwrap_or_default();
        let new_layout = after_panel.layout_2d.unwrap_or_default();
        assert!((old_layout - new_layout - shift).length() < 1e-12);
        let right = after.points[after.edges.iter().position(|e| e == "edge_2_2").unwrap()];
        let left = after.points[after.edges.iter().position(|e| e == "edge_4_2").unwrap()];
        assert!(((right.x + left.x) - (0.4 + 2. * shift.x)).abs() < 0.00055);
        assert!((right.y - left.y).abs() < 0.00055);
        updated.compile().unwrap();
        let json = serde_json::to_vec(&updated).unwrap();
        let restored: GarmentTemplate = serde_json::from_slice(&json).unwrap();
        restored.compile().unwrap();
        assert_eq!(serde_json::to_vec(&restored).unwrap(), json);
        let undone = history.restore(&updated, false).unwrap().template;
        assert_eq!(serde_json::to_vec(&undone).unwrap(), snapshot);
        let redone = history.restore(&undone, true).unwrap().template;
        assert_eq!(serde_json::to_vec(&redone).unwrap(), json);
    }
}

#[test]
fn notch_collision_on_either_side_rejects_both_splits_atomically() {
    for colliding_side in [RIGHT, LEFT] {
        let mut source = fixture();
        source.panels[0].polygon.as_mut().unwrap().notches.get_mut(colliding_side).unwrap()[0].t = 0.5;
        let unchanged = serde_json::to_vec(&source).unwrap();
        for initiator in [RIGHT, LEFT] {
            let length = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), initiator).unwrap();
            assert!(authoring::apply(&source, Command::SplitBoundary {
                panel: source.panels[0].id.clone(), edge: initiator.into(), at_m: length * 0.5,
            }).is_err(), "{initiator} must reject collision on {colliding_side}");
            assert_eq!(serde_json::to_vec(&source).unwrap(), unchanged);
        }
    }
}

#[test]
fn orphaned_or_geometrically_invalid_mirror_rejects_atomically() {
    for orphan in [true, false] {
        let mut source = fixture();
        let partner = &mut source.panels[0].polygon.as_mut().unwrap().free_curve_points.get_mut(LEFT).unwrap()[0];
        if orphan { partner.mirror_group = Some("wrong-group".into()); }
        else { partner.position.x += 0.03; }
        let unchanged = serde_json::to_vec(&source).unwrap();
        for initiator in [RIGHT, LEFT] {
            let length = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), initiator).unwrap();
            assert!(authoring::apply(&source, Command::SplitBoundary {
                panel: source.panels[0].id.clone(), edge: initiator.into(), at_m: length * 0.5,
            }).is_err(), "invalid reflected pair must fail on {initiator}");
            assert_eq!(serde_json::to_vec(&source).unwrap(), unchanged);
        }
    }
}
