//! Seam allowance and notches (`MARK-01`): draft markings that change the
//! printed cutting line and never the physics.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        GarmentTemplate,
        domain::Hole,
        export,
        markings::{Notch, NotchKind, polyline_length},
        meshing::MeshingSettings,
        polygon::PolygonPattern,
        presets::{self, GarmentKind},
        shapes::{self, BooleanOp, MirrorAxis, Primitive},
    },
    model::Material,
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

    let sheet = export::print_pattern_svg(&t).unwrap();
    assert!(
        sheet.contains("data-role=\"cutting-contour\""),
        "sheet has no cutting line"
    );
    assert!(
        sheet.contains("data-role=\"notch\""),
        "sheet has no notch marker"
    );
    assert!(sheet.contains("100 mm ruler"), "sheet has no scale ruler");
    // Millimetre page sizing is what makes the page true scale.
    assert!(sheet.contains("mm\""), "sheet is not sized in millimetres");
}

fn with_hole(t: &GarmentTemplate, allowance_m: Option<f64>) -> GarmentTemplate {
    let mut out = t.clone();
    let polygon = out.panels[0].polygon.as_mut().unwrap();
    let edges: Vec<_> = (0..4).map(|i| format!("hole_{i}")).collect();
    polygon.holes.push(Hole {
        // Clockwise, as stored for a hole. Its material is outside the hole.
        points: vec![
            DVec2::new(0.1, 0.1),
            DVec2::new(0.1, 0.2),
            DVec2::new(0.2, 0.2),
            DVec2::new(0.2, 0.1),
        ],
        edges: edges.clone(),
    });
    if let Some(width) = allowance_m {
        for edge in edges {
            polygon.seam_allowances.insert(edge, width);
        }
    }
    out
}

#[test]
fn an_unchanged_hole_remains_in_a_partial_cutting_contour() {
    let t = with_hole(&rectangle(), None);
    let polygon = t.panels[0].polygon.as_ref().unwrap();
    let mut outer = t.clone();
    outer.panels[0]
        .polygon
        .as_mut()
        .unwrap()
        .seam_allowances
        .insert("edge_1".into(), 0.01);
    let contour = outer.panels[0]
        .polygon
        .as_ref()
        .unwrap()
        .cutting_contour()
        .unwrap()
        .unwrap();
    assert_eq!(contour.holes.len(), 1);
    assert_eq!(contour.holes[0], polygon.holes[0].points);
}

#[test]
fn a_hole_allowance_cannot_collapse_or_reappear_after_crossing_its_width() {
    let valid = with_hole(&rectangle(), Some(0.04));
    let contour = valid.panels[0]
        .polygon
        .as_ref()
        .unwrap()
        .cutting_contour()
        .unwrap()
        .unwrap();
    assert_eq!(contour.holes.len(), 1);
    assert!(ring_area(&contour.holes[0]) < 0.);
    assert!(contour.holes[0].iter().all(|p| p.x > 0.1 && p.x < 0.2));

    // At 50 mm the inset hole is a point. At 60 mm both axes have crossed and
    // the naive offset re-forms a simple, positively wound square; both must
    // be refused rather than printed as a spurious 20 mm hole.
    for width in [0.05, 0.06] {
        let t = with_hole(&rectangle(), Some(width));
        let polygon = t.panels[0].polygon.as_ref().unwrap();
        let error = polygon.cutting_contour().unwrap_err();
        assert!(error.contains("hole"), "{error}");
    }
}

#[test]
fn splitting_next_to_a_notch_is_refused_before_the_half_open_interval_breaks() {
    let base = rectangle();
    let panel = panel_id(&base);
    let marked = authoring::apply(
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
    // The notch is exactly at 300 mm on a 600 mm edge.
    let error = authoring::apply(
        &marked,
        Command::SplitBoundary {
            panel: panel.clone(),
            edge: "edge_1".into(),
            at_m: 0.3,
        },
    )
    .err()
    .expect("expected an error");
    assert!(error.contains("within 1 mm"), "{error}");

    let near = authoring::apply(
        &marked,
        Command::SplitBoundary {
            panel,
            edge: "edge_1".into(),
            at_m: 0.3005,
        },
    )
    .err()
    .expect("expected an error");
    assert!(near.contains("within 1 mm"), "{near}");
}

#[test]
fn a_curved_boundary_uses_its_sampled_arclength_for_markings() {
    let base = rectangle();
    let mut t = base.clone();
    t.panels[0].polygon =
        Some(shapes::primitive(Primitive::Ellipse, DVec2::splat(0.4), 360., settings()).unwrap());
    let panel = panel_id(&t);
    let t = authoring::apply(
        &t,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.5, 0.006, NotchKind::Slit),
        },
    )
    .unwrap()
    .template;
    let polygon = t.panels[0].polygon.as_ref().unwrap();
    assert!(polygon.curves.contains_key("edge_1"));
    let marker = polygon
        .notch_marker("edge_1", &polygon.notches["edge_1"][0])
        .unwrap();
    assert!(marker.iter().all(|p| p.is_finite()));
    assert!(polygon.validate_markings().is_ok());

    let t = authoring::apply(
        &t,
        Command::SeamAllowance {
            panel,
            edge: "edge_1".into(),
            width_m: 0.005,
        },
    )
    .unwrap()
    .template;
    assert!(
        t.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .cutting_contour()
            .unwrap()
            .is_some()
    );
}

#[test]
fn a_long_notch_is_inside_the_physical_page() {
    let mut t = rectangle();
    let panel = panel_id(&t);
    t = authoring::apply(
        &t,
        Command::SetNotch {
            panel,
            edge: "edge_4".into(),
            index: None,
            // edge_4 runs down the left side; this marker extends 50 mm left.
            notch: Notch::new(0.5, 0.05, NotchKind::V),
        },
    )
    .unwrap()
    .template;
    let sheet = export::print_pattern_svg(&t).unwrap();
    assert!(sheet.contains("data-role=\"notch\""));
    let width_mm: f64 = sheet
        .split_once("width=\"")
        .unwrap()
        .1
        .split_once("mm\"")
        .unwrap()
        .0
        .parse()
        .unwrap();
    // A 600 mm panel needs 640 mm with 20 mm margins. The 50 mm left marker
    // must expand that, rather than being clipped away by the page edge.
    assert!(width_mm > 680., "notch was clipped: page width {width_mm}");
}

#[test]
fn every_notch_marker_stays_inside_the_physical_page_on_all_four_sides() {
    let mut t = authoring::apply(
        &rectangle(),
        Command::Primitive {
            kind: Primitive::Rectangle,
            size: DVec2::new(0.4, 0.6),
            origin: DVec2::ZERO,
            sweep_degrees: 180.,
            replace: true,
            meshing: settings(),
            fabric: "woven-reference".into(),
        },
    )
    .unwrap()
    .template;
    let panel = panel_id(&t);
    // edge_1..edge_4 are bottom, right, top and left in this counter-clockwise
    // rectangle. A 50 mm marker therefore extends beyond each side of the
    // 400 x 600 mm panel.
    for edge in ["edge_1", "edge_2", "edge_3", "edge_4"] {
        t = authoring::apply(
            &t,
            Command::SetNotch {
                panel: panel.clone(),
                edge: edge.into(),
                index: None,
                notch: Notch::new(0.5, 0.05, NotchKind::V),
            },
        )
        .unwrap()
        .template;
    }
    let sheet = export::print_pattern_svg(&t).unwrap();
    let page = |key: &str| -> f64 {
        sheet
            .split_once(&format!("{key}=\""))
            .unwrap()
            .1
            .split_once("mm\"")
            .unwrap()
            .0
            .parse()
            .unwrap()
    };
    let (page_w, page_h) = (page("width"), page("height"));
    // Marker points are stored in the panel's local material millimetres and
    // translated by the group. Apply that transform before checking the page.
    let translate = sheet
        .split_once("transform=\"translate(")
        .unwrap()
        .1
        .split_once(')')
        .unwrap()
        .0;
    let (tx, ty) = translate.split_once(' ').unwrap();
    let (tx, ty): (f64, f64) = (tx.parse().unwrap(), ty.parse().unwrap());
    let mut seen = 0;
    let mut rest = sheet.as_str();
    while let Some((_, tail)) = rest.split_once("data-role=\"notch\" points=\"") {
        let (points, next) = tail.split_once('"').unwrap();
        seen += 1;
        for pair in points.split_whitespace() {
            let (x, y) = pair.split_once(',').unwrap();
            let x: f64 = x.parse().unwrap();
            let y: f64 = y.parse().unwrap();
            let (page_x, page_y) = (x + tx, y + ty);
            assert!(
                (0.5..=page_w - 0.5).contains(&page_x) && (0.5..=page_h - 0.5).contains(&page_y),
                "notch point ({page_x}, {page_y}) is outside the {page_w} x {page_h} page"
            );
        }
        rest = next;
    }
    assert_eq!(seen, 4, "expected four exported notch markers");
}

#[test]
fn a_legacy_document_without_marking_keys_loads_with_empty_maps() {
    let t = rectangle();
    let mut value = serde_json::to_value(&t).unwrap();
    for panel in value["panels"].as_array_mut().unwrap() {
        if let Some(polygon) = panel.get_mut("polygon").and_then(|v| v.as_object_mut()) {
            polygon.remove("seam_allowances");
            polygon.remove("notches");
        }
    }
    let parsed: GarmentTemplate = serde_json::from_value(value).unwrap();
    parsed.compile().unwrap();
    let polygon = parsed.panels[0].polygon.as_ref().unwrap();
    assert!(polygon.seam_allowances.is_empty());
    assert!(polygon.notches.is_empty());
}

#[test]
fn a_curved_notch_keeps_its_material_marker_through_split_and_mirror() {
    let mut t = rectangle();
    t.panels[0].pattern.width = 0.4;
    t.panels[0].pattern.height = 0.4;
    t.panels[0].polygon =
        Some(shapes::primitive(Primitive::Ellipse, DVec2::splat(0.4), 360., settings()).unwrap());
    let panel = panel_id(&t);
    let t = authoring::apply(
        &t,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.35, 0.006, NotchKind::Slit),
        },
    )
    .unwrap()
    .template;
    let original = t.panels[0]
        .polygon
        .as_ref()
        .unwrap()
        .notch_marker(
            "edge_1",
            &t.panels[0].polygon.as_ref().unwrap().notches["edge_1"][0],
        )
        .unwrap();

    let mirrored = authoring::apply(
        &t,
        Command::Mirror {
            panel: panel.clone(),
            axis: MirrorAxis::X,
            copy_side: None,
        },
    )
    .unwrap()
    .template;
    let mirrored_polygon = mirrored.panels[0].polygon.as_ref().unwrap();
    let reflected = mirrored_polygon
        .notch_marker("edge_1", &mirrored_polygon.notches["edge_1"][0])
        .unwrap();
    let reflect = |p: DVec2| DVec2::new(0.4 - p.x, p.y);
    assert!(reflected[1].distance(reflect(original[1])) < 1e-9);

    let total = polyline_length(
        &t.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .closed_boundary("edge_1")
            .unwrap(),
    );
    let split = authoring::apply(
        &t,
        Command::SplitBoundary {
            panel,
            edge: "edge_1".into(),
            at_m: total * 0.2,
        },
    )
    .unwrap()
    .template;
    let split_polygon = split.panels[0].polygon.as_ref().unwrap();
    let (edge, notch) = split_polygon
        .notches
        .iter()
        .find_map(|(edge, notches)| notches.first().map(|notch| (edge, notch)))
        .unwrap();
    let moved = split_polygon.notch_marker(edge, notch).unwrap();
    // The cubic split is exact, but the two halves are flattened separately.
    // Keep the marker within the same sub-0.2 mm curve-sampling tolerance as
    // the contour itself, rather than a visible jump.
    assert!(moved[1].distance(original[1]) < 2e-4);
}

#[test]
fn malformed_holes_are_rejected_before_any_marking_helper_indexes_them() {
    // The reported fixture: a four-point hole with no edge names plus an outer
    // allowance used to panic at markings.rs because `cutting_contour` indexed
    // `hole.edges[i]` before the domain validator ran.
    let empty_edges: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a","b","c","d"],
            "subdivisions": 0,
            "holes": [{
                "points": [[0.2,0.2],[0.2,0.4],[0.4,0.4],[0.4,0.2]],
                "edges": []
            }],
            "seam_allowances": {"a": 0.01}
        }"#,
    )
    .unwrap();
    let error = empty_edges
        .build(&Material::default())
        .err()
        .expect("malformed hole must not build");
    assert!(error.contains("Invalid hole"), "{error}");
    assert!(empty_edges.cutting_contour().is_err());
    assert!(empty_edges.validate_markings().is_err());

    // A short edge list, an empty point list, and a non-finite coordinate must
    // each fail before `closed_boundary`/`named_boundary` can wrap a modulo.
    let short_edges: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a","b","c","d"],
            "subdivisions": 0,
            "holes": [{
                "points": [[0.2,0.2],[0.2,0.4],[0.4,0.4],[0.4,0.2]],
                "edges": ["h1"]
            }],
            "seam_allowances": {"a": 0.01}
        }"#,
    )
    .unwrap();
    assert!(short_edges.build(&Material::default()).is_err());
    assert!(short_edges.cutting_contour().is_err());
    assert!(short_edges.named_boundary("h1").is_none());
    assert!(short_edges.closed_boundary("h1").is_none());

    let empty_points: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a","b","c","d"],
            "subdivisions": 0,
            "holes": [{"points": [], "edges": ["h1"]}],
            "seam_allowances": {"a": 0.01}
        }"#,
    )
    .unwrap();
    assert!(empty_points.build(&Material::default()).is_err());
    assert!(empty_points.cutting_contour().is_err());
    assert!(empty_points.named_boundary("h1").is_none());
    assert!(empty_points.closed_boundary("h1").is_none());

    let mut nonfinite: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a","b","c","d"],
            "subdivisions": 0,
            "holes": [{
                "points": [[0.2,0.2],[0.2,0.4],[0.4,0.4],[0.4,0.2]],
                "edges": ["h1","h2","h3","h4"]
            }],
            "seam_allowances": {"a": 0.01, "h1": 0.01}
        }"#,
    )
    .unwrap();
    nonfinite.holes[0].points[0].x = f64::NAN;
    assert!(nonfinite.build(&Material::default()).is_err());
    assert!(nonfinite.validate_markings().is_err());
}

#[test]
fn malformed_outer_contours_are_rejected_before_any_marking_helper_indexes_them() {
    // The reported fixture: four points with a single edge name reached
    // `cutting_contour` through `outer_points`/`edge_points` and panicked at
    // `edges[i]`. The public helpers must refuse the structure instead.
    let short_edges: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a"],
            "subdivisions": 0,
            "seam_allowances": {"a": 0.01}
        }"#,
    )
    .unwrap();
    assert!(short_edges.build(&Material::default()).is_err());
    assert!(short_edges.cutting_contour().is_err());
    assert!(short_edges.validate_markings().is_err());
    assert!(short_edges.named_boundary("a").is_none());
    assert!(short_edges.closed_boundary("a").is_none());
    assert!(
        short_edges
            .notch_marker("a", &Notch::new(0.5, 0.005, NotchKind::V))
            .is_err()
    );
    assert!(short_edges.edge_points(0).is_err());

    // A malformed outer contour also makes hole-boundary lookup unusable: the
    // whole polygon is refused by `build`, so a public helper must not answer
    // from a hole rim as if the panel were valid.
    let hole_under_bad_outer: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a"],
            "subdivisions": 0,
            "holes": [{
                "points": [[0.2,0.2],[0.2,0.4],[0.4,0.4],[0.4,0.2]],
                "edges": ["h1","h2","h3","h4"]
            }]
        }"#,
    )
    .unwrap();
    assert!(hole_under_bad_outer.build(&Material::default()).is_err());
    assert!(hole_under_bad_outer.named_boundary("h1").is_none());
    assert!(hole_under_bad_outer.closed_boundary("h1").is_none());
    assert!(hole_under_bad_outer.validate_markings().is_err());

    // More edge names than points, an empty point list and a non-finite outer
    // coordinate must fail the same way rather than wrap a modulo or index OOB.
    let long_edges: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a","b","c","d","e"],
            "subdivisions": 0,
            "seam_allowances": {"a": 0.01}
        }"#,
    )
    .unwrap();
    assert!(long_edges.build(&Material::default()).is_err());
    assert!(long_edges.cutting_contour().is_err());
    assert!(long_edges.validate_markings().is_err());
    assert!(long_edges.named_boundary("e").is_none());
    assert!(long_edges.closed_boundary("e").is_none());
    assert!(long_edges.edge_points(4).is_err());

    let empty_points: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [],
            "edges": [],
            "subdivisions": 0,
            "seam_allowances": {"a": 0.01}
        }"#,
    )
    .unwrap();
    assert!(empty_points.build(&Material::default()).is_err());
    assert!(empty_points.cutting_contour().is_err());
    assert!(empty_points.validate_markings().is_err());
    assert!(empty_points.named_boundary("a").is_none());
    assert!(empty_points.closed_boundary("a").is_none());
    assert!(empty_points.edge_points(0).is_err());

    let mut nonfinite: PolygonPattern = serde_json::from_str(
        r#"{
            "points": [[0,0],[1,0],[1,1],[0,1]],
            "edges": ["a","b","c","d"],
            "subdivisions": 0,
            "notches": {"a": [{"at": 0.5, "length_m": 0.005, "kind": "v"}]}
        }"#,
    )
    .unwrap();
    nonfinite.points[2].y = f64::INFINITY;
    assert!(nonfinite.build(&Material::default()).is_err());
    assert!(nonfinite.validate_markings().is_err());
    assert!(nonfinite.named_boundary("a").is_none());
    assert!(nonfinite.closed_boundary("a").is_none());
    assert!(
        nonfinite
            .notch_marker("a", &Notch::new(0.5, 0.005, NotchKind::V))
            .is_err()
    );

    // A well-formed outline still answers the same helpers.
    let square = rectangle();
    let polygon = square.panels[0].polygon.as_ref().unwrap();
    assert_eq!(polygon.edge_points(0).unwrap().len(), 2);
    assert!(polygon.named_boundary("edge_1").is_some());
    assert!(polygon.closed_boundary("edge_1").is_some());
    assert!(polygon.validate_markings().is_ok());
}

#[test]
fn a_cut_segment_that_crosses_the_material_between_samples_is_refused() {
    // Reduced synthetic counterexample from review: the returned cut segment
    // dips into the material between its endpoints and midpoint. Sampling only
    // endpoints and a midpoint accepted it; splitting at the original outline
    // and testing every interval must refuse it. The polygon itself builds.
    let points = [
        (-0.23781658167832687, 0.0),
        (-0.11162669208330665, -0.05375658168876376),
        (-0.12716714147910968, -0.15946255166874515),
        (-0.2189210346534498, -0.959155722801674),
        (0.8733837133813913, -0.42059942884434665),
    ];
    let edges = ["e7", "e8", "e9", "e10", "e13"];
    let widths = [
        0.08832042383857361,
        0.0911695583710256,
        0.08490421522684255,
        0.06072986170816645,
        0.07793546751260007,
    ];
    let polygon = PolygonPattern {
        points: points.map(|(x, y)| DVec2::new(x, y)).to_vec(),
        edges: edges.map(String::from).to_vec(),
        subdivisions: 1,
        meshing: None,
        curves: Default::default(),
        holes: vec![],
        lines: vec![],
        target_lengths: Default::default(),
        seam_allowances: edges
            .iter()
            .zip(widths)
            .map(|(edge, width)| ((*edge).to_string(), width))
            .collect(),
        notches: Default::default(),
        measurements: Default::default(),
    };
    // The unmarked outline is valid; only its cut line is refusable.
    let mut unmarked = polygon.clone();
    unmarked.seam_allowances.clear();
    assert!(unmarked.build(&Material::default()).is_ok());
    let error = polygon
        .cutting_contour()
        .expect_err("a cut segment crossing the material must be refused");
    assert!(error.contains("Seam allowance"), "{error}");
    // `build` validates markings, so the same polygon is refused there too.
    assert!(polygon.build(&Material::default()).is_err());
}

#[test]
fn notches_mark_the_sewing_line_and_stop_short_of_the_cut_edge() {
    // Contract clarified after review: a stored notch is a sewing-line guide,
    // not a cut-edge mark. With a 10 mm allowance on the bottom edge, a 5 mm
    // slit at the midpoint ends at y = -0.005 m while the cut edge runs at
    // y = -0.010 m, so both exports leave a 5 mm gap instead of drawing a
    // second mark on the allowance.
    let mut seam_allowances = std::collections::BTreeMap::new();
    seam_allowances.insert("e0".to_string(), 0.010);
    let polygon = PolygonPattern {
        points: vec![
            DVec2::new(0., 0.),
            DVec2::new(0.6, 0.),
            DVec2::new(0.6, 0.6),
            DVec2::new(0., 0.6),
        ],
        edges: ["e0", "e1", "e2", "e3"].map(String::from).to_vec(),
        subdivisions: 1,
        meshing: None,
        curves: Default::default(),
        holes: vec![],
        lines: vec![],
        target_lengths: Default::default(),
        seam_allowances,
        notches: Default::default(),
        measurements: Default::default(),
    };
    assert!(polygon.build(&Material::default()).is_ok());
    let marker = polygon
        .notch_marker("e0", &Notch::new(0.5, 0.005, NotchKind::Slit))
        .unwrap();
    assert_eq!(marker.len(), 2);
    assert!((marker[0] - DVec2::new(0.3, 0.0)).length() < 1e-12);
    assert!((marker[1] - DVec2::new(0.3, -0.005)).length() < 1e-12);
    let contour = polygon.cutting_contour().unwrap().unwrap();
    let cut_y = contour
        .outer
        .iter()
        .map(|point| point.y)
        .fold(f64::INFINITY, f64::min);
    assert!((cut_y + 0.010).abs() < 1e-12, "cut edge moved to {cut_y}");
    assert!((marker[1].y - cut_y - 0.005).abs() < 1e-12);
    // No marker vertex lies on the cut edge: the contract is sewing-line only.
    assert!(marker.iter().all(|point| point.y > cut_y + 1e-12));
}

fn plain_square(size_m: f64) -> PolygonPattern {
    PolygonPattern {
        points: vec![
            DVec2::ZERO,
            DVec2::new(size_m, 0.),
            DVec2::new(size_m, size_m),
            DVec2::new(0., size_m),
        ],
        edges: ["e0", "e1", "e2", "e3"].map(String::from).to_vec(),
        subdivisions: 1,
        meshing: None,
        curves: Default::default(),
        holes: vec![],
        lines: vec![],
        target_lengths: Default::default(),
        seam_allowances: Default::default(),
        notches: Default::default(),
        measurements: Default::default(),
    }
}

fn distance_to_polyline(points: &[DVec2], point: DVec2) -> f64 {
    points
        .windows(2)
        .map(|pair| {
            let direction = pair[1] - pair[0];
            let t = ((point - pair[0]).dot(direction) / direction.length_squared()).clamp(0., 1.);
            point.distance(pair[0] + direction * t)
        })
        .fold(f64::INFINITY, f64::min)
}

#[test]
fn v_notches_keep_their_whole_span_inside_the_boundary() {
    // Reported from review: a 50 mm V at 2 mm from either end of a 600 mm edge
    // passed the center-only 1 mm rule and drew 23 mm past the corner. The V
    // footprint is center +/- length/2, so the whole span must keep the 1 mm
    // clearance; a slit keeps the center-only rule.
    let polygon = plain_square(0.6);
    for at in [0.002 / 0.6, 1.0 - 0.002 / 0.6] {
        let error = polygon
            .notch_marker("e0", &Notch::new(at, 0.05, NotchKind::V))
            .unwrap_err();
        assert!(error.contains("full span"), "{error}");
        assert!(error.contains("1 mm"), "{error}");
    }
    // The stored form is refused by the same validation, so a bake cannot emit
    // the corner-crossing marker either.
    let mut stored = polygon.clone();
    stored.notches.insert(
        "e0".into(),
        vec![Notch::new(0.002 / 0.6, 0.05, NotchKind::V)],
    );
    let error = stored
        .build(&Material::default())
        .err()
        .expect("a stored corner-crossing V must be refused");
    assert!(error.contains("full span"), "{error}");
    // A 10 mm V centered 6 mm from the start leaves each base exactly 1 mm from
    // the boundary end, the smallest accepted placement.
    let marker = polygon
        .notch_marker("e0", &Notch::new(0.006 / 0.6, 0.01, NotchKind::V))
        .unwrap();
    assert_eq!(marker.len(), 4);
    assert!((marker[0] - DVec2::new(0.001, 0.)).length() < 1e-12);
    assert!((marker[2] - DVec2::new(0.011, 0.)).length() < 1e-12);
    // Slits are a single outward segment: only the center rule applies.
    polygon
        .notch_marker("e0", &Notch::new(0.002 / 0.6, 0.005, NotchKind::Slit))
        .unwrap();
    // A short boundary cannot host a V whose span does not fit, at any position.
    let short = plain_square(0.04);
    let error = short
        .notch_marker("e0", &Notch::new(0.5, 0.039, NotchKind::V))
        .unwrap_err();
    assert!(error.contains("full span"), "{error}");
    short
        .notch_marker("e0", &Notch::new(0.5, 0.005, NotchKind::Slit))
        .unwrap();
}

#[test]
fn v_notch_bases_follow_a_curved_sewing_boundary() {
    // Reported from review: the two V bases were straight tangent offsets, so on
    // a curved edge they floated off the sewing line. Each base must be the
    // point at its own arclength on the sampled boundary.
    let mut polygon = plain_square(0.6);
    polygon.curves.insert(
        "e0".into(),
        [DVec2::new(0.2, -0.12), DVec2::new(0.4, -0.12)],
    );
    let boundary = polygon.closed_boundary("e0").unwrap();
    assert!(boundary.len() > 2, "the edge is not curved");
    let marker = polygon
        .notch_marker("e0", &Notch::new(0.5, 0.02, NotchKind::V))
        .unwrap();
    assert_eq!(marker.len(), 4);
    for base in [marker[0], marker[2]] {
        let off_boundary = distance_to_polyline(&boundary, base);
        assert!(
            off_boundary < 1e-9,
            "V base is {off_boundary} m off the sewing line"
        );
    }
    assert!(marker[0].distance(marker[2]) > 0.015);
}

#[test]
fn splitting_inside_a_v_span_is_refused() {
    let base = rectangle();
    let panel = panel_id(&base);
    let marked = authoring::apply(
        &base,
        Command::SetNotch {
            panel: panel.clone(),
            edge: "edge_1".into(),
            index: None,
            notch: Notch::new(0.5, 0.02, NotchKind::V),
        },
    )
    .unwrap()
    .template;
    // 5 mm from the 300 mm center: the old center-only rule allowed this, but the
    // right base would cross the split and become a new boundary end.
    let error = authoring::apply(
        &marked,
        Command::SplitBoundary {
            panel: panel.clone(),
            edge: "edge_1".into(),
            at_m: 0.305,
        },
    )
    .err()
    .expect("expected a V-span refusal");
    assert!(error.contains("V span"), "{error}");
    // 15 mm away keeps the whole 20 mm V on one half, 10 mm clear of the split.
    let split = authoring::apply(
        &marked,
        Command::SplitBoundary {
            panel,
            edge: "edge_1".into(),
            at_m: 0.315,
        },
    )
    .unwrap()
    .template;
    assert!(
        split.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .validate_markings()
            .is_ok()
    );
}
