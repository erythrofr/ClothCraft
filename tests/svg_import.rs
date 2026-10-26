use glam::{DVec2, DVec3};
use marvelous_cloth::garment::{
    GarmentTemplate,
    meshing::MeshingSettings,
    svg_import::{self, Drawing, Outline},
};

fn template() -> GarmentTemplate {
    serde_json::from_str(include_str!("../examples/templates/two-panel.json")).unwrap()
}

fn svg(body: &str, root: &str) -> Result<Drawing, String> {
    svg_import::read_svg(
        &format!(r#"<svg xmlns="http://www.w3.org/2000/svg" {root}>{body}</svg>"#),
        svg_import::Options::default(),
    )
}

#[test]
fn physical_units_viewbox_alignment_and_nested_transforms() {
    for (width, height) in [("100mm", "200mm"), ("10cm", "20cm")] {
        let d = svg(
            r#"<rect width="100" height="200"/>"#,
            &format!(r#"width="{width}" height="{height}" viewBox="0 0 100 200""#),
        )
        .unwrap();
        assert!(d.outlines[0].points[2].distance(DVec2::new(0.1, 0.2)) < 1e-12);
        let t = template();
        let e = prepare(&t, d.outlines, &[0]).unwrap();
        assert!((e.template.panels.last().unwrap().pattern.width - 0.1).abs() < 1e-12);
    }
    let d = svg(r#"<g transform="translate(10 20)"><g transform="scale(2)"><polygon points="0,0 10,0 0,10"/></g></g>"#,
        r#"width="200mm" height="100mm" viewBox="10 20 100 100""#).unwrap();
    assert!(d.outlines[0].points[0].distance(DVec2::new(0.05, 0.)) < 1e-12);
    assert!(d.outlines[0].points[1].distance(DVec2::new(0.07, 0.)) < 1e-12);
    let d = svg(
        r#"<rect width="1in" height="72pt"/>"#,
        r#"width="2in" height="2in""#,
    )
    .unwrap();
    assert!(d.outlines[0].points[2].distance(DVec2::splat(0.0254)) < 1e-12);
    let d = svg(
        r#"<rect width="100" height="100"/>"#,
        r#"width="200mm" height="100mm" viewBox="0 0 100 100" preserveAspectRatio="none""#,
    )
    .unwrap();
    assert!(d.outlines[0].points[2].distance(DVec2::new(0.2, 0.1)) < 1e-12);
}

#[test]
fn curves_and_arcs_have_bounded_physical_chords() {
    let d = svg(r#"<circle cx="50" cy="50" r="40"/><path d="M 90 50 A 40 40 0 1 1 10 50 A 40 40 0 1 1 90 50 Z"/>"#,
        r#"width="100mm" height="100mm" viewBox="0 0 100 100""#).unwrap();
    for outline in &d.outlines {
        assert!(outline.points.len() > 20);
        for i in 0..outline.points.len() {
            let a = outline.points[i] - DVec2::splat(0.05);
            let b = outline.points[(i + 1) % outline.points.len()] - DVec2::splat(0.05);
            assert!((a.length() - 0.04).abs() < 1e-12);
            assert!(0.04 - ((a + b) * 0.5).length() <= 0.0001 + 1e-12);
        }
    }
    for path in [
        "M0 0 C0 50 100 50 100 0 L100 100 H0 Z",
        "m0 0 q50 100 100 0 t100 0 v100 h-200 z",
        "M0 0 C0 50 50 50 50 0 S100 -50 100 0 L100 100 L0 100 Z",
    ] {
        let d = svg(
            &format!(r#"<path d="{path}"/>"#),
            r#"width="200mm" height="200mm" viewBox="0 0 200 200""#,
        )
        .unwrap();
        assert!(d.outlines[0].points.len() > 8);
        assert!(d.outlines[0].points.iter().all(|p| p.is_finite()));
    }
}

#[test]
fn unsupported_or_ambiguous_svg_never_silently_imports() {
    let root = r#"width="100mm" height="100mm" viewBox="0 0 100 100""#;
    for body in [
        "<script/>",
        "<use href='other.svg#piece'/>",
        "<image/>",
        "<foreignObject/>",
        "<path d='M0 0 L10 0 L0 10'/>",
        "<path d='M0 0 L10 0 L0 10 Z M2 2 L3 2 L2 3 Z'/>",
        "<rect width='10' height='10' rx='1'/>",
        "<rect width='10' height='10' style='clip-path:url(#x)'/>",
        "<rect width='10' height='10' transform='scale(0)'/>",
        "<rect width='10%' height='10'/>",
        "<svg width='10' height='10'/>",
        "<g><rect width='10' height='10'/></path>",
    ] {
        assert!(svg(body, root).is_err(), "accepted {body}");
    }
    for root in [
        "width='100' height='100'",
        "width='100%' height='100mm'",
        "width='100mm' height='100mm' transform='scale(2)'",
        "width='100mm' height='100mm' viewBox='0 0 100 100 5'",
        "width='100mm' height='100mm' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid slice'",
    ] {
        assert!(
            svg("<rect width='10' height='10'/>", root).is_err(),
            "accepted {root}"
        );
    }
    for prefix in [
        "<!DOCTYPE svg [<!ENTITY x SYSTEM 'file:///secret'>]>",
        "<?xml version='1.1'?>",
        "<?xml version='1.0'?><?xml version='1.0'?>",
    ] {
        assert!(svg_import::read_svg(&format!("{prefix}<svg xmlns='http://www.w3.org/2000/svg' {root}><rect width='10' height='10'/></svg>"), svg_import::Options::default()).is_err());
    }
    assert!(
        svg_import::read_svg(
            &" ".repeat(3 * 1024 * 1024 + 1),
            svg_import::Options::default()
        )
        .is_err()
    );
}

#[test]
fn hidden_shapes_and_names_are_explicit() {
    let d = svg("<g display='none'><rect width='10' height='10'/></g><polygon id='A&amp;B' points='0,0 10,0 0,10'/>",
        "width='100mm' height='100mm' viewBox='0 0 100 100'").unwrap();
    assert_eq!(d.outlines.len(), 1);
    assert_eq!(d.outlines[0].name, "A&B");
    assert!(d.losses.iter().any(|s| s.contains("Hidden")));
}

#[test]
fn transformed_ellipses_and_beziers_meet_physical_error_budget() {
    let root = "width='100mm' height='100mm' viewBox='0 0 100 100'";
    let d = svg("<g transform='translate(80 10) scale(-2 0.5)'><circle cx='20' cy='20' r='10'/><path d='M0 0 C0 40 40 40 40 0 L40 50 L0 50 Z'/></g>", root).unwrap();
    let distance = |p: DVec2, outline: &Outline| {
        (0..outline.points.len())
            .map(|i| {
                let a = outline.points[i];
                let b = outline.points[(i + 1) % outline.points.len()];
                let ab = b - a;
                p.distance(a + ab * ((p - a).dot(ab) / ab.length_squared()).clamp(0., 1.))
            })
            .fold(f64::INFINITY, f64::min)
    };
    let transform = |p: DVec2| DVec2::new(0.08 - 0.002 * p.x, 0.01 + 0.0005 * p.y);
    for i in 0..=2000 {
        let t = i as f64 / 2000.;
        let angle = t * std::f64::consts::TAU;
        let circle = transform(DVec2::new(20. + 10. * angle.cos(), 20. + 10. * angle.sin()));
        assert!(distance(circle, &d.outlines[0]) <= 0.0001 + 1e-12);
        let cubic = transform(DVec2::new(
            120. * (1. - t) * t * t + 40. * t.powi(3),
            120. * (1. - t) * t,
        ));
        assert!(distance(cubic, &d.outlines[1]) <= 0.0001 + 1e-12);
    }
}

#[test]
fn resource_limits_reject_instead_of_relaxing_tolerance() {
    let root = "width='100mm' height='100mm' viewBox='0 0 100 100'";
    let nested = format!(
        "{}<rect width='10' height='10'/>{}",
        "<g>".repeat(64),
        "</g>".repeat(64)
    );
    assert!(svg(&nested, root).is_err());
    assert!(svg(&"<rect width='10' height='10'/>".repeat(129), root).is_err());
    let source = format!("<svg xmlns='http://www.w3.org/2000/svg' {root}><circle r='40'/></svg>");
    for tolerance in [0., -0.1, f64::NAN, 0.02, 1e-20] {
        assert!(
            svg_import::read_svg(
                &source,
                svg_import::Options {
                    chord_error_m: tolerance
                }
            )
            .is_err()
        );
    }
}
fn triangle(x: f64) -> Outline {
    Outline {
        name: "asymmetric".into(),
        points: vec![
            DVec2::new(x, 0.),
            DVec2::new(x + 0.1, 0.),
            DVec2::new(x, 0.2),
        ],
    }
}
fn prepare(
    t: &GarmentTemplate,
    outlines: Vec<Outline>,
    selected: &[usize],
) -> Result<marvelous_cloth::authoring::Edit, String> {
    svg_import::prepare(
        t,
        &Drawing {
            outlines,
            losses: vec![],
        },
        selected,
        &t.fabrics[0].id,
        MeshingSettings::default(),
        DVec3::new(2., 1.5, 0.5),
    )
}

#[test]
fn svg_down_direction_and_physical_area_survive_editable_conversion() {
    let t = template();
    let old = t.compile().unwrap();
    let mut state = old.initial_state.clone();
    state.time = 4.;
    state.v.fill(DVec3::new(0.01, 0.02, 0.03));
    for p in &mut state.x {
        *p += DVec3::new(0.02, -0.01, 0.03);
    }
    let e = prepare(&t, vec![triangle(3.)], &[0]).unwrap();
    let panel = e.template.panels.last().unwrap();
    let p = panel.polygon.as_ref().unwrap();
    assert_eq!(panel.id, "svg_1");
    for q in [DVec2::ZERO, DVec2::new(0.1, 0.), DVec2::new(0., 0.2)] {
        assert!(p.points.iter().any(|v| v.distance(q) < 1e-12));
    }
    assert!(
        !p.points
            .iter()
            .any(|v| v.distance(DVec2::new(0.1, 0.2)) < 1e-12)
    );
    assert!((marvelous_cloth::garment::domain::area(&p.points) - 0.01).abs() < 1e-12);
    let added_area =
        e.garment.mesh.rest_area.iter().sum::<f64>() - old.mesh.rest_area.iter().sum::<f64>();
    assert!((added_area - 0.01).abs() < 1e-12);
    assert_eq!(
        serde_json::to_value(&e.template.seams).unwrap(),
        serde_json::to_value(&t.seams).unwrap()
    );
    let next = e.state_after(&old, &state);
    assert_eq!(next.time, state.time);
    assert_eq!(&next.x[..state.x.len()], &state.x);
    assert_eq!(&next.v[..state.v.len()], &state.v);
    let saved = serde_json::to_string(&e.template).unwrap();
    let reload: GarmentTemplate = serde_json::from_str(&saved).unwrap();
    assert_eq!(reload.compile().unwrap().mesh.uv, e.garment.mesh.uv);
    let second = prepare(&reload, vec![triangle(0.)], &[0]).unwrap();
    assert_eq!(second.template.panels.last().unwrap().id, "svg_2");
}

#[test]
fn prepared_import_is_one_reversible_template_edit() {
    let t = template();
    let edit = prepare(&t, vec![triangle(0.), triangle(1.)], &[0, 1]).unwrap();
    let mut history = marvelous_cloth::authoring::History::default();
    history.record(t.clone());
    let undo = history.restore(&edit.template, false).unwrap();
    assert_eq!(
        serde_json::to_value(&undo.template).unwrap(),
        serde_json::to_value(&t).unwrap()
    );
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(
        serde_json::to_value(&redo.template).unwrap(),
        serde_json::to_value(&edit.template).unwrap()
    );
    assert_eq!(redo.garment.mesh.uv, edit.garment.mesh.uv);
}

#[test]
fn invalid_or_ambiguous_outlines_do_not_change_source() {
    let t = template();
    let before = serde_json::to_vec(&t).unwrap();
    assert!(prepare(&t, vec![triangle(0.)], &[]).is_err());
    assert!(prepare(&t, vec![triangle(0.)], &[1]).is_err());
    assert!(prepare(&t, vec![triangle(0.)], &[0, 0]).is_err());
    assert!(prepare(&t, vec![triangle(0.), triangle(0.02)], &[0, 1]).is_err());
    assert!(prepare(&t, vec![triangle(0.), triangle(0.1)], &[0, 1]).is_err());
    assert!(prepare(&t, vec![triangle(0.), triangle(1.)], &[0, 1]).is_ok());
    let mut invalid = triangle(0.);
    invalid.points[0].x = f64::NAN;
    assert!(prepare(&t, vec![invalid], &[0]).is_err());
    let mut degenerate = triangle(0.);
    degenerate.points[2] = degenerate.points[0];
    assert!(prepare(&t, vec![degenerate], &[0]).is_err());
    let crossed = Outline {
        name: "crossed".into(),
        points: vec![
            DVec2::ZERO,
            DVec2::new(0.1, 0.2),
            DVec2::new(0., 0.2),
            DVec2::new(0.1, 0.),
        ],
    };
    assert!(prepare(&t, vec![crossed], &[0]).is_err());
    let too_many = Outline {
        name: "oversized".into(),
        points: vec![DVec2::ZERO; 4097],
    };
    assert!(prepare(&t, vec![too_many], &[0]).is_err());
    assert_eq!(serde_json::to_vec(&t).unwrap(), before);
}
