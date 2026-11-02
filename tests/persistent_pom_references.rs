//! First isolated EXO-REV-002 slice: cut-and-sewn dart identity and transactions.
//! Measurement resolution is tested independently of the retained dart cases.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
    },
};

fn fixture() -> GarmentTemplate {
    authoring::apply(
        &presets::basic(GarmentKind::Tshirt, 0),
        Command::Polygon {
            points: vec![
                DVec2::ZERO,
                DVec2::new(0.4, 0.),
                DVec2::new(0.4, 0.3),
                DVec2::new(0., 0.3),
            ],
            tangents: vec![],
            meshing: MeshingSettings {
                target_edge_m: 0.05,
                ..Default::default()
            },
            fabric: "woven-reference".into(),
            replace: true,
        },
    )
    .unwrap()
    .template
}

fn dart(t: &GarmentTemplate) -> Command {
    Command::DartCutSew {
        panel: t.panels[0].id.clone(),
        edge: "edge_1".into(),
        left_t: 0.35,
        right_t: 0.45,
        apex: DVec2::new(0.16, 0.08),
    }
}

fn area(t: &GarmentTemplate) -> f64 {
    let p = &t.panels[0].polygon.as_ref().unwrap().points;
    (0..p.len())
        .map(|i| p[i].perp_dot(p[(i + 1) % p.len()]))
        .sum::<f64>()
        * 0.5
}

#[test]
fn cut_removes_analytic_wedge_and_creates_equal_reversed_legs() {
    let t = fixture();
    let edit = authoring::apply(&t, dart(&t)).unwrap();
    assert!(edit.reset_simulation);
    assert!((area(&t) - area(&edit.template) - 0.04 * 0.08 / 2.).abs() < 1e-12);
    let mass_before: f64 = t.compile().unwrap().mesh.masses.iter().sum();
    let mass_after: f64 = edit.garment.mesh.masses.iter().sum();
    assert!((mass_after / mass_before - area(&edit.template) / area(&t)).abs() < 1e-10);
    let seam = &edit.template.seams[0];
    assert!(seam.reverse_b);
    assert!(!seam.allow_ease);
    assert_eq!(seam.a.panel, seam.b.panel);
    let p = edit.template.panels[0].polygon.as_ref().unwrap();
    let path = |r: &BoundaryRef| {
        p.edge_points(
            p.edges
                .iter()
                .position(|e| Some(e) == r.edge.as_ref())
                .unwrap(),
        )
        .unwrap()
    };
    let a = path(&seam.a);
    let b = path(&seam.b);
    assert_eq!(a[1], b[0]); // Shared apex: reverse B matches apex to apex.
    assert!((a[0].distance(a[1]) - b[0].distance(b[1])).abs() < 1e-12);
    assert!(t.seams.is_empty());
    assert!(
        t.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .edges
            .iter()
            .all(|e| p.edges.contains(e))
    );
}

#[test]
fn dart_roundtrip_and_one_step_history_preserve_document() {
    let t = fixture();
    let before = serde_json::to_value(&t).unwrap();
    let edit = authoring::apply(&t, dart(&t)).unwrap();
    let after = serde_json::to_value(&edit.template).unwrap();
    let loaded: GarmentTemplate = serde_json::from_value(after.clone()).unwrap();
    loaded.compile().unwrap();
    let mut history = History::default();
    history.record(t);
    let undo = history.restore(&loaded, false).unwrap();
    assert_eq!(serde_json::to_value(&undo.template).unwrap(), before);
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(serde_json::to_value(&redo.template).unwrap(), after);
}

#[test]
fn sewn_chain_heads_and_tails_on_either_side_are_protected() {
    for slot in 0..4 {
        let mut t = fixture();
        let panel = t.panels[0].id.clone();
        let boundary = |edge: &str| BoundaryRef {
            panel: panel.clone(),
            edge: Some(edge.into()),
            side: Side::Top,
            range: [0., 1.],
            reversed: false,
        };
        let mut refs = [
            boundary("edge_1"),
            boundary("edge_2"),
            boundary("edge_3"),
            boundary("edge_4"),
        ];
        refs.swap(0, slot);
        t.seams.push(SeamSpec {
            id: "chain".into(),
            a: refs[0].clone(),
            a_tail: vec![refs[1].clone()],
            b: refs[2].clone(),
            b_tail: vec![refs[3].clone()],
            reverse_b: true,
            notches: vec![],
            stiffness: 50_000.,
            allow_ease: true,
        });
        t.compile().unwrap();
        let before = serde_json::to_value(&t).unwrap();
        let err = authoring::apply(&t, dart(&t)).err().unwrap();
        assert!(err.contains("already sewn"), "{err}");
        assert_eq!(serde_json::to_value(&t).unwrap(), before);
    }
}

#[test]
fn invalid_apex_or_cut_crossing_contour_is_atomic() {
    let t = fixture();
    let before = serde_json::to_value(&t).unwrap();
    for apex in [
        DVec2::new(0.16, -0.08),
        DVec2::new(0.16, 0.4),
        DVec2::new(0.17, 0.08),
        DVec2::NAN,
    ] {
        let command = Command::DartCutSew {
            panel: t.panels[0].id.clone(),
            edge: "edge_1".into(),
            left_t: 0.35,
            right_t: 0.45,
            apex,
        };
        assert!(authoring::apply(&t, command).is_err());
        assert_eq!(serde_json::to_value(&t).unwrap(), before);
    }
}

#[test]
fn targeted_boundary_requires_explicit_migration() {
    let mut t = fixture();
    t.panels[0]
        .polygon
        .as_mut()
        .unwrap()
        .target_lengths
        .insert("edge_1".into(), 0.4);
    let err = authoring::apply(&t, dart(&t)).err().unwrap();
    assert!(err.contains("reference remapping"), "{err}");
}

#[test]
fn unrelated_panel_and_existing_seam_remain_identical() {
    let t = fixture();
    let mut t = authoring::apply(
        &t,
        Command::Duplicate {
            panel: t.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template;
    let boundary = |edge: &str| BoundaryRef {
        panel: t.panels[1].id.clone(),
        edge: Some(edge.into()),
        side: Side::Top,
        range: [0.2, 0.8],
        reversed: true,
    };
    t.seams.push(SeamSpec {
        id: "unrelated".into(),
        a: boundary("edge_2"),
        b: boundary("edge_4"),
        a_tail: vec![],
        b_tail: vec![],
        reverse_b: true,
        notches: vec![],
        stiffness: 50_000.,
        allow_ease: false,
    });
    t.compile().unwrap();
    let panel = serde_json::to_value(&t.panels[1]).unwrap();
    let seam = serde_json::to_value(&t.seams[0]).unwrap();
    let edit = authoring::apply(&t, dart(&t)).unwrap();
    assert_eq!(
        serde_json::to_value(&edit.template.panels[1]).unwrap(),
        panel
    );
    assert_eq!(serde_json::to_value(&edit.template.seams[0]).unwrap(), seam);
}

#[test]
fn linked_mirror_and_curved_boundary_are_rejected_without_editing() {
    let t = fixture();
    let mirrored = authoring::apply(
        &t,
        Command::LinkedMirror {
            panel: t.panels[0].id.clone(),
            axis: marvelous_cloth::garment::shapes::MirrorAxis::X,
        },
    )
    .unwrap()
    .template;
    let before = serde_json::to_value(&mirrored).unwrap();
    let err = authoring::apply(&mirrored, dart(&mirrored)).err().unwrap();
    assert!(err.contains("Unlink"), "{err}");
    assert_eq!(serde_json::to_value(&mirrored).unwrap(), before);
    let mut curved = t;
    curved.panels[0].polygon.as_mut().unwrap().curves.insert(
        "edge_1".into(),
        [DVec2::new(0.1, -0.03), DVec2::new(0.3, -0.03)],
    );
    curved.compile().unwrap();
    let before = serde_json::to_value(&curved).unwrap();
    assert!(
        authoring::apply(&curved, dart(&curved))
            .err()
            .unwrap()
            .contains("reference remapping")
    );
    assert_eq!(serde_json::to_value(&curved).unwrap(), before);
}

mod measurement_resolution {
    use super::*;
    use marvelous_cloth::garment::polygon::{MeasurementAnchor, PatternMeasurement};

    fn measurement() -> PatternMeasurement {
        PatternMeasurement {
            id: "width".into(),
            label: "Width".into(),
            a: MeasurementAnchor {
                edge: "edge_1".into(),
                t: 0.25,
            },
            b: MeasurementAnchor {
                edge: "edge_3".into(),
                t: 0.75,
            },
        }
    }

    #[test]
    fn rest_measurement_has_analytic_endpoints_and_distance() {
        let template = fixture();
        let polygon = template.panels[0].polygon.as_ref().unwrap();
        let measurement = measurement();
        let points = polygon.measurement_points(&measurement).unwrap();
        assert!(points[0].distance(DVec2::new(0.1, 0.)) < 1e-12);
        assert!(points[1].distance(DVec2::new(0.1, 0.3)) < 1e-12);
        assert!((polygon.measurement_length(&measurement).unwrap() - 0.3).abs() < 1e-12);
        polygon
            .validate_measurement_records(&[measurement])
            .unwrap();
        for (t, expected) in [(0., DVec2::ZERO), (1., DVec2::new(0.4, 0.))] {
            let actual = polygon
                .measurement_anchor_position(&MeasurementAnchor {
                    edge: "edge_1".into(),
                    t,
                })
                .unwrap();
            assert_eq!(actual, expected);
        }
    }

    #[test]
    fn curved_station_matches_independently_sampled_cubic_arclength() {
        let mut template = fixture();
        let polygon = template.panels[0].polygon.as_mut().unwrap();
        let control = [DVec2::new(0.02, -0.18), DVec2::new(0.32, -0.04)];
        polygon.curves.insert("edge_1".into(), control);
        let station = MeasurementAnchor {
            edge: "edge_1".into(),
            t: 0.37,
        };
        let actual = polygon.measurement_anchor_position(&station).unwrap();
        // A dense direct Bernstein evaluation is independent of flatten(), its
        // subdivision decisions and the production arclength walker.
        let evaluate = |t: f64| {
            let u = 1. - t;
            polygon.points[0] * u.powi(3)
                + control[0] * (3. * u * u * t)
                + control[1] * (3. * u * t * t)
                + polygon.points[1] * t.powi(3)
        };
        let points: Vec<_> = (0..=20_000).map(|i| evaluate(i as f64 / 20_000.)).collect();
        let total: f64 = points.windows(2).map(|p| p[0].distance(p[1])).sum();
        let wanted = station.t * total;
        let mut walked = 0.;
        let expected = points
            .windows(2)
            .find_map(|pair| {
                let length = pair[0].distance(pair[1]);
                let contains = walked + length >= wanted;
                let result = contains.then(|| pair[0].lerp(pair[1], (wanted - walked) / length));
                walked += length;
                result
            })
            .unwrap();
        assert!(
            actual.distance(expected) <= 0.00025,
            "station drift: {} m",
            actual.distance(expected)
        );
        assert!(
            actual.distance(evaluate(station.t)) > 0.001,
            "fixture must distinguish arclength from cubic parameter"
        );
    }

    #[test]
    fn invalid_or_ambiguous_measurement_data_is_rejected() {
        let template = fixture();
        let polygon = template.panels[0].polygon.as_ref().unwrap();
        for t in [f64::NAN, f64::INFINITY, -0.01, 1.01] {
            let mut measurement = measurement();
            measurement.a.t = t;
            assert!(
                polygon
                    .validate_measurement_records(&[measurement])
                    .is_err()
            );
        }
        let mut dangling = measurement();
        dangling.a.edge = "deleted".into();
        assert!(polygon.validate_measurement_records(&[dangling]).is_err());
        assert!(
            polygon
                .validate_measurement_records(&[measurement(), measurement()])
                .is_err()
        );
        let mut empty = measurement();
        empty.label = "   ".into();
        assert!(polygon.validate_measurement_records(&[empty]).is_err());
        let mut duplicate_boundary = polygon.clone();
        duplicate_boundary.edges[1] = "edge_1".into();
        assert!(
            duplicate_boundary
                .measurement_length(&measurement())
                .is_err()
        );
        let mut malformed = polygon.clone();
        malformed.points.clear();
        assert!(malformed.measurement_length(&measurement()).is_err());
        assert!(
            polygon
                .validate_measurement_records(&vec![measurement(); 257])
                .is_err()
        );
    }
}
