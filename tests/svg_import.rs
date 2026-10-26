use glam::{DVec2, DVec3};
use marvelous_cloth::garment::{
    GarmentTemplate,
    meshing::MeshingSettings,
    svg_import::{self, Drawing, Outline},
};

fn template() -> GarmentTemplate {
    serde_json::from_str(include_str!("../examples/templates/two-panel.json")).unwrap()
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
