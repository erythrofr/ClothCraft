use glam::{DQuat, DVec3};
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::GarmentTemplate,
};

fn template() -> GarmentTemplate {
    serde_json::from_str(include_str!("../examples/templates/two-panel.json")).unwrap()
}

#[test]
fn zero_motion_does_not_reset_drape_or_rewrite_angles() {
    let mut t = template();
    t.panels[0].placement.rotation_degrees = DVec3::new(390., -400., 12.);
    let e = authoring::apply(
        &t,
        Command::PlaceGroup {
            panels: vec![t.panels[0].id.clone()],
            pivot: DVec3::splat(0.5),
            translation: DVec3::ZERO,
            rotation: DQuat::IDENTITY,
        },
    )
    .unwrap();
    assert!(!e.reset_simulation);
    assert_eq!(
        serde_json::to_value(&t).unwrap(),
        serde_json::to_value(&e.template).unwrap()
    );
}

#[test]
fn linked_pair_keeps_its_relation_and_independent_material_geometry() {
    use glam::DVec2;
    use marvelous_cloth::garment::{
        meshing::MeshingSettings,
        shapes::{MirrorAxis, Primitive},
    };
    let t = authoring::apply(
        &template(),
        Command::Primitive {
            kind: Primitive::Rectangle,
            size: DVec2::new(0.3, 0.4),
            sweep_degrees: 180.,
            origin: DVec2::ZERO,
            meshing: MeshingSettings::default(),
            fabric: template().fabrics[0].id.clone(),
            replace: true,
        },
    )
    .unwrap()
    .template;
    let t = authoring::apply(
        &t,
        Command::LinkedMirror {
            panel: t.panels[0].id.clone(),
            axis: MirrorAxis::X,
        },
    )
    .unwrap()
    .template;
    let e = authoring::apply(
        &t,
        command(
            t.panels.iter().map(|p| p.id.clone()).collect(),
            DQuat::from_rotation_y(0.4),
        ),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(&t.mirror_links).unwrap(),
        serde_json::to_value(&e.template.mirror_links).unwrap()
    );
    for (a, b) in t.panels.iter().zip(&e.template.panels) {
        assert_eq!(
            serde_json::to_value(&a.polygon).unwrap(),
            serde_json::to_value(&b.polygon).unwrap()
        );
        assert_eq!(a.grain_degrees, b.grain_degrees);
        assert_eq!(a.fabric, b.fabric);
    }
}
fn command(panels: Vec<String>, rotation: DQuat) -> Command {
    Command::PlaceGroup {
        panels,
        pivot: DVec3::new(0.2, 0.8, -0.1),
        translation: DVec3::new(0.1, -0.2, 0.4),
        rotation,
    }
}

#[test]
fn shared_world_pivot_preserves_material_and_relative_geometry() {
    let mut t = template();
    t.panels[0].placement.rotation_degrees = DVec3::new(25., -35., 12.);
    t.panels[1].placement.rotation_degrees = DVec3::new(-15., 45., 72.);
    let old = t.compile().unwrap();
    let rotation = DQuat::from_axis_angle(DVec3::new(1., 2., 3.).normalize(), 0.7);
    let e = authoring::apply(
        &t,
        command(t.panels.iter().map(|p| p.id.clone()).collect(), rotation),
    )
    .unwrap();
    assert_eq!(old.mesh.uv, e.garment.mesh.uv);
    assert_eq!(old.mesh.rest_area, e.garment.mesh.rest_area);
    assert_eq!(
        serde_json::to_value(&t.seams).unwrap(),
        serde_json::to_value(&e.template.seams).unwrap()
    );
    for (a, b) in old.initial_state.x.iter().zip(&e.garment.initial_state.x) {
        let expected = DVec3::new(0.2, 0.8, -0.1)
            + rotation * (*a - DVec3::new(0.2, 0.8, -0.1))
            + DVec3::new(0.1, -0.2, 0.4);
        assert!(expected.distance(*b) < 1e-12);
    }
    let mut h = History::default();
    h.record(t.clone());
    let undo = h.restore(&e.template, false).unwrap();
    assert_eq!(
        serde_json::to_value(&undo.template).unwrap(),
        serde_json::to_value(&t).unwrap()
    );
    assert!(!h.can_undo());
    let redo = h.restore(&undo.template, true).unwrap();
    assert_eq!(
        serde_json::to_value(&redo.template).unwrap(),
        serde_json::to_value(&e.template).unwrap()
    );
}

#[test]
fn invalid_group_is_atomic_and_unselected_drape_is_preserved() {
    let t = template();
    let before = serde_json::to_value(&t).unwrap();
    let id = t.panels[0].id.clone();
    for panels in [
        vec![],
        vec![id.clone(), id.clone()],
        vec![id.clone(), "missing".into()],
    ] {
        assert!(authoring::apply(&t, command(panels, DQuat::IDENTITY)).is_err());
        assert_eq!(serde_json::to_value(&t).unwrap(), before);
    }
    for rotation in [
        DQuat::from_xyzw(0., 0., 0., 0.),
        DQuat::from_xyzw(0., 0., 0., 2.),
        DQuat::from_xyzw(f64::NAN, 0., 0., 1.),
    ] {
        assert!(authoring::apply(&t, command(vec![id.clone()], rotation)).is_err());
    }
    let old = t.compile().unwrap();
    let mut state = old.initial_state.clone();
    state.time = 3.;
    for p in &mut state.x {
        *p += DVec3::splat(0.03);
    }
    state.v.fill(DVec3::new(0.1, 0.2, 0.3));
    let e = authoring::apply(&t, command(vec![id], DQuat::IDENTITY)).unwrap();
    let next = e.state_after(&old, &state);
    assert!(e.reset_simulation);
    assert_eq!(next.time, state.time);
    let unchanged = old.panels[1].vertices.clone();
    assert_eq!(next.x[unchanged.clone()], state.x[unchanged.clone()]);
    assert_eq!(next.v[unchanged.clone()], state.v[unchanged]);
    let moved = old.panels[0].vertices.clone();
    assert_eq!(next.x[moved.clone()], e.garment.initial_state.x[moved]);
}
