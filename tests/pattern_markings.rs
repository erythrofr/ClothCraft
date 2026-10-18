//! Seam allowance and notches (`MARK-01`): draft markings that change the
//! printed cutting line and never the physics.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        GarmentTemplate, export,
        markings::{Notch, NotchKind},
        meshing::MeshingSettings,
        presets::{self, GarmentKind},
        shapes::{BooleanOp, MirrorAxis, Primitive},
    },
};

fn settings() -> MeshingSettings {
    MeshingSettings {
        target_edge_m: 0.05,
        ..Default::default()
    }
}

/// One 600 x 600 mm rectangular panel named "panel1" with edges edge_1..edge_4.
fn rectangle() -> GarmentTemplate {
    authoring::apply(
        &presets::basic(GarmentKind::Tshirt, 1),
        Command::Primitive {
            kind: Primitive::Rectangle,
            size: DVec2::splat(0.6),
            origin: DVec2::ZERO,
            sweep_degrees: 180.,
            replace: true,
            meshing: settings(),
            fabric: "woven-reference".into(),
        },
    )
    .unwrap()
    .template
}

fn panel_id(t: &GarmentTemplate) -> String {
    t.panels[0].id.clone()
}

fn ring_area(points: &[DVec2]) -> f64 {
    (0..points.len())
        .map(|i| points[i].perp_dot(points[(i + 1) % points.len()]))
        .sum::<f64>()
        * 0.5
}

fn mesh_area(t: &GarmentTemplate) -> f64 {
    t.compile()
        .unwrap()
        .mesh
        .triangles
        .iter()
        .map(|triangle| triangle.area)
        .sum()
}

fn with_allowance(t: &GarmentTemplate, edges: &[&str], width_m: f64) -> GarmentTemplate {
    let mut out = t.clone();
    for edge in edges {
        out = authoring::apply(
            &out,
            Command::SeamAllowance {
                panel: panel_id(&out),
                edge: (*edge).into(),
                width_m,
            },
        )
        .unwrap()
        .template;
    }
    out
}

#[test]
fn allowance_changes_the_cutting_line_and_not_the_physics() {
    let before = rectangle();
    let mut after = before.clone();
    let panel = panel_id(&after);
    for edge in ["edge_1", "edge_2", "edge_3", "edge_4"] {
        let edit = authoring::apply(
            &after,
            Command::SeamAllowance {
                panel: panel.clone(),
                edge: edge.into(),
                width_m: 0.01,
            },
        )
        .unwrap();
        assert!(
            !edit.reset_simulation,
            "a seam allowance must not reset the drape"
        );
        after = edit.template;
    }

    // The physical model is untouched: same meshed area and the same physical
    // fingerprint once the draft markings are ignored.
    assert!((mesh_area(&before) - mesh_area(&after)).abs() < 1e-12);
    assert!(authoring::same_physics(&before, &after));
    assert!(
        serde_json::to_string(&after)
            .unwrap()
            .contains("seam_allowances")
    );

    // The cutting contour is the rectangle grown by 10 mm on every side.
    let polygon = after.panels[0].polygon.as_ref().unwrap();
    let contour = polygon.cutting_contour().unwrap().unwrap();
    let sewing = ring_area(&polygon.outer_points().unwrap());
    assert!(ring_area(&contour.outer) > sewing);
    assert!((ring_area(&contour.outer) - 0.62 * 0.62).abs() < 1e-9);
    assert!(contour.holes.is_empty());
}

#[test]
fn a_one_sided_allowance_only_moves_that_edge() {
    let t = with_allowance(&rectangle(), &["edge_1"], 0.012);
    let polygon = t.panels[0].polygon.as_ref().unwrap();
    let contour = polygon.cutting_contour().unwrap().unwrap();
    // edge_1 is (0,0) -> (600 mm, 0), so the cutting line sits at y = -12 mm.
    assert!(contour.outer.iter().any(|p| (p.y + 0.012).abs() < 1e-9));
    // The opposite edge keeps the sewing line.
    assert!(contour.outer.iter().any(|p| (p.y - 0.6).abs() < 1e-9));
}

#[test]
fn an_allowance_that_would_close_on_itself_is_refused_transactionally() {
    // A horseshoe: 4 mm arms with a 2 mm gap. An allowance wider than the gap
    // makes the offset fold over itself, so it must be refused before it is
    // written to the document.
    let base = rectangle();
    let points = vec![
        DVec2::new(0., 0.),
        DVec2::new(0.010, 0.),
        DVec2::new(0.010, 0.02),
        DVec2::new(0.006, 0.02),
        DVec2::new(0.006, 0.004),
        DVec2::new(0.004, 0.004),
        DVec2::new(0.004, 0.02),
        DVec2::new(0., 0.02),
    ];
    let horseshoe = authoring::apply(
        &base,
        Command::Polygon {
            tangents: vec![DVec2::ZERO; points.len()],
            points,
            meshing: settings(),
            fabric: "woven-reference".into(),
            replace: true,
        },
    )
    .unwrap()
    .template;
    let panel = panel_id(&horseshoe);

    // edge_4 is the inner wall at x = 6 mm. A 3 mm allowance reaches x = 3 mm,
    // inside the opposite arm.
    let error = authoring::apply(
        &horseshoe,
        Command::SeamAllowance {
            panel: panel.clone(),
            edge: "edge_4".into(),
            width_m: 0.003,
        },
    )
    .err()
    .expect("expected an error");
    assert!(error.contains("self-intersects"), "{error}");
    assert!(
        horseshoe.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .seam_allowances
            .is_empty()
    );

    // A 1 mm allowance stays inside the gap.
    assert!(
        authoring::apply(
            &horseshoe,
            Command::SeamAllowance {
                panel,
                edge: "edge_4".into(),
                width_m: 0.001,
            },
        )
        .is_ok()
    );
}

#[test]
fn a_notch_survives_a_document_round_trip() {
    let base = rectangle();
    let panel = panel_id(&base);
    let with_notch = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.5, 0.005, NotchKind::V),
        },
    )
    .unwrap()
    .template;

    let json = serde_json::to_string_pretty(&with_notch).unwrap();
    assert!(json.contains("notches"));
    let reloaded: GarmentTemplate = serde_json::from_str(&json).unwrap();
    reloaded.compile().unwrap();
    let notches = &reloaded.panels[0].polygon.as_ref().unwrap().notches["edge_1"];
    assert_eq!(notches.len(), 1);
    assert!((notches[0].at - 0.5).abs() < 1e-12);
    assert!((notches[0].length_m - 0.005).abs() < 1e-12);
    assert_eq!(notches[0].kind, NotchKind::V);

    // A dangling reference is rejected at compile time, not silently dropped.
    let broken = json.replacen("\"edge_1\": [", "\"ghost\": [", 1);
    assert_ne!(broken, json);
    let parsed: GarmentTemplate = serde_json::from_str(&broken).unwrap();
    assert!(parsed.compile().is_err());
}

#[test]
fn a_notch_must_clear_each_boundary_end() {
    let base = rectangle();
    let panel = panel_id(&base);
    let length =
        authoring::edge_length(base.panels[0].polygon.as_ref().unwrap(), "edge_1").unwrap();
    let near_end = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            // 0.5 mm from the start of a 600 mm edge.
            notch: Notch::new(0.0005 / length, 0.005, NotchKind::V),
        },
    )
    .err()
    .expect("expected an error");
    assert!(near_end.contains("1 mm"), "{near_end}");

    let butting_the_end = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(1.0, 0.005, NotchKind::V),
        },
    );
    assert!(butting_the_end.is_err());

    // Midway is accepted, and a second notch can be appended and removed.
    let two = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.5, 0.005, NotchKind::Slit),
        },
    )
    .unwrap()
    .template;
    let two = authoring::apply(
        &two,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.8, 0.008, NotchKind::V),
        },
    )
    .unwrap()
    .template;
    assert_eq!(
        two.panels[0].polygon.as_ref().unwrap().notches["edge_1"].len(),
        2
    );
    let one = authoring::apply(
        &two,
        Command::RemoveNotch {
            panel,
            edge: "edge_1".into(),
            index: 0,
        },
    )
    .unwrap()
    .template;
    let remaining = &one.panels[0].polygon.as_ref().unwrap().notches["edge_1"];
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].kind, NotchKind::V);
}

#[test]
fn splitting_a_boundary_carries_allowance_and_notches() {
    let base = with_allowance(&rectangle(), &["edge_1"], 0.008);
    let panel = panel_id(&base);
    let mut t = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.25, 0.005, NotchKind::V),
        },
    )
    .unwrap()
    .template;
    t = authoring::apply(
        &t,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.9, 0.005, NotchKind::V),
        },
    )
    .unwrap()
    .template;

    // Split the 600 mm edge in half; both notches keep their material position.
    let split = authoring::apply(
        &t,
        Command::SplitBoundary {
            panel,
            edge: "edge_1".into(),
            at_m: 0.3,
        },
    )
    .unwrap()
    .template;
    split.compile().unwrap();
    let polygon = split.panels[0].polygon.as_ref().unwrap();
    let new_edge = polygon.edges[1].clone();
    assert_ne!(new_edge, "edge_1");
    assert!((polygon.allowance_of("edge_1") - 0.008).abs() < 1e-12);
    assert!((polygon.allowance_of(&new_edge) - 0.008).abs() < 1e-12);
    assert!((polygon.notches["edge_1"][0].at - 0.5).abs() < 1e-9);
    assert!((polygon.notches[&new_edge][0].at - 0.8).abs() < 1e-9);
}

#[test]
fn mirroring_reflects_a_notch_position() {
    let base = rectangle();
    let panel = panel_id(&base);
    let t = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.25, 0.005, NotchKind::V),
        },
    )
    .unwrap()
    .template;
    let mirrored = authoring::apply(
        &t,
        Command::Mirror {
            panel,
            axis: MirrorAxis::X,
            copy_side: None,
        },
    )
    .unwrap()
    .template;
    mirrored.compile().unwrap();
    let stored = &mirrored.panels[0].polygon.as_ref().unwrap().notches["edge_1"];
    assert!((stored[0].at - 0.75).abs() < 1e-9);
}

#[test]
fn operations_that_cannot_carry_markings_refuse_them() {
    let marked = with_allowance(&rectangle(), &["edge_1"], 0.01);
    // Removing a point merges two boundaries; a marking on either is ambiguous.
    let err = authoring::apply(
        &marked,
        Command::RemovePoint {
            panel: panel_id(&marked),
            point: 0,
        },
    )
    .err()
    .expect("expected an error");
    assert!(err.contains("clear them first"), "{err}");

    // A boolean cannot preserve per-boundary markings either.
    let mut two = authoring::apply(
        &rectangle(),
        Command::Primitive {
            kind: Primitive::Rectangle,
            size: DVec2::splat(0.2),
            origin: DVec2::new(0.1, 0.1),
            sweep_degrees: 180.,
            replace: false,
            meshing: settings(),
            fabric: "woven-reference".into(),
        },
    )
    .unwrap()
    .template;
    let second = two.panels[1].id.clone();
    two = authoring::apply(
        &two,
        Command::SeamAllowance {
            panel: second.clone(),
            edge: "edge_1".into(),
            width_m: 0.01,
        },
    )
    .unwrap()
    .template;
    let err = authoring::apply(
        &two,
        Command::Boolean {
            a: two.panels[0].id.clone(),
            b: second,
            op: BooleanOp::Union,
            keep_tool: false,
        },
    )
    .err()
    .expect("expected an error");
    assert!(err.contains("seam allowances"), "{err}");
}

#[test]
fn the_markings_appear_in_the_preview_and_the_true_scale_sheet() {
    let mut t = with_allowance(&rectangle(), &["edge_1", "edge_2"], 0.01);
    let panel = panel_id(&t);
    t = authoring::apply(
        &t,
        Command::SetNotch {
            panel,
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.5, 0.005, NotchKind::V),
        },
    )
    .unwrap()
    .template;

    let preview = export::pattern_svg(&t);
    assert!(
        preview.contains("Cutting line"),
        "preview has no cutting line"
    );
    assert!(preview.contains("notch 1"), "preview has no notch marker");

    let sheet = export::pattern_print_svg(&t);
    assert!(sheet.contains("Cutting line"), "sheet has no cutting line");
    assert!(sheet.contains("notch 1"), "sheet has no notch marker");
    assert!(sheet.contains("100 mm ruler"), "sheet has no scale ruler");
    // Millimetre page sizing is what makes the page true scale.
    assert!(sheet.contains("mm\""), "sheet is not sized in millimetres");
}
