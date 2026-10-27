//! Physical prerequisites for authored holds. These exercise compiled constraints,
//! not a native pin tool or persistent target schema (both remain separate work).
use glam::DVec3;
use marvelous_cloth::{
    garment::{CompiledGarment, GarmentTemplate},
    vbd::{VbdSettings, VbdSolver},
};
use std::sync::Arc;

fn editable() -> GarmentTemplate {
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams.clear();
    for p in &mut t.panels {
        p.pins.clear();
        p.pattern.nx = 2;
        p.pattern.ny = 2;
    }
    t
}

#[test]
fn group_freeze_is_atomic_preserves_existing_targets_and_releases_cleanly() {
    use marvelous_cloth::authoring::{
        History, prepare_freeze_edit, prepare_freeze_group_edit, prepare_pin_edit,
    };
    let mut t = editable();
    t.panels[0]
        .pins
        .push(marvelous_cloth::garment::template::Corner::TopLeft);
    t.panels[1].placement.translation.x += 4.;
    let g = t.compile().unwrap();
    let mut state = g.initial_state.clone();
    state.time = 4.5;
    for (i, x) in state.x.iter_mut().enumerate() {
        if g.mesh.pins[i].is_none() {
            x.y += 0.2;
            state.v[i] = DVec3::X * 0.04;
        }
    }
    let first = g.panels[0].id.clone();
    let second = g.panels[1].id.clone();
    let vertex = g.panels[0].vertices.start + 1;
    let (pin, state) =
        prepare_pin_edit(&t, &g, &state, &first, &[g.mesh.uv[vertex]], true).unwrap();
    let (one, state) =
        prepare_freeze_edit(&pin.template, &pin.garment, &state, &first, true).unwrap();
    let old_freeze = serde_json::to_vec(&one.template.frozen_panels[0]).unwrap();
    let original = serde_json::to_vec(&one.template).unwrap();
    let before = state.clone();
    let panels = vec![first.clone(), second.clone()];
    let (noop_release, _) = prepare_freeze_group_edit(
        &one.template,
        &one.garment,
        &state,
        std::slice::from_ref(&second),
        false,
    )
    .unwrap();
    assert!(!noop_release.reset_simulation);
    assert_eq!(
        serde_json::to_vec(&noop_release.template).unwrap(),
        original
    );
    for invalid in [
        vec![],
        vec![first.clone(), first.clone()],
        vec![first.clone(), "missing".into()],
        (0..129).map(|i| format!("p{i}")).collect(),
    ] {
        assert!(
            prepare_freeze_group_edit(&one.template, &one.garment, &state, &invalid, true).is_err()
        );
        assert_eq!(serde_json::to_vec(&one.template).unwrap(), original);
        assert_eq!(state.x, before.x);
        assert_eq!(state.v, before.v);
    }
    let (both, frozen_state) =
        prepare_freeze_group_edit(&one.template, &one.garment, &state, &panels, true).unwrap();
    assert_eq!(both.template.frozen_panels.len(), 2);
    assert_eq!(
        serde_json::to_vec(&both.template.frozen_panels[0]).unwrap(),
        old_freeze
    );
    assert_eq!(frozen_state.x, before.x);
    assert_eq!(frozen_state.time, before.time);
    assert!(frozen_state.v.iter().all(|v| *v == DVec3::ZERO));
    assert_eq!(both.template.pin_targets.len(), 1);
    let (noop, _) =
        prepare_freeze_group_edit(&both.template, &both.garment, &frozen_state, &panels, true)
            .unwrap();
    assert!(!noop.reset_simulation);
    let mut history = History::default();
    history.record(one.template.clone());
    let undo = history.restore(&both.template, false).unwrap();
    assert_eq!(serde_json::to_vec(&undo.template).unwrap(), original);
    let (released, after) =
        prepare_freeze_group_edit(&both.template, &both.garment, &frozen_state, &panels, false)
            .unwrap();
    assert!(released.template.frozen_panels.is_empty());
    assert_eq!(released.template.pin_targets.len(), 1);
    assert_eq!(released.garment.legacy_pins, g.legacy_pins);
    assert_eq!(after.x, frozen_state.x);
    assert_eq!(after.v, frozen_state.v);
    assert_eq!(after.time, frozen_state.time);
    let mut stale = both.garment.clone();
    stale.mesh.uv[0].x += 0.01;
    assert!(
        prepare_freeze_group_edit(&both.template, &stale, &frozen_state, &panels, false).is_err()
    );
    let mut inconsistent = frozen_state.clone();
    inconsistent.x[both.garment.panels[0].vertices.start] += DVec3::X * 0.01;
    assert!(
        prepare_freeze_group_edit(&both.template, &both.garment, &inconsistent, &panels, false)
            .is_err()
    );
}

#[test]
fn authored_hold_coincident_with_legacy_pin_remains_distinguishable() {
    use marvelous_cloth::authoring::prepare_pin_edit;
    let t = GarmentTemplate::two_panel_demo();
    let g = t.compile().unwrap();
    let i = g.mesh.pins.iter().position(Option::is_some).unwrap();
    let panel = g.panels.iter().find(|p| p.vertices.contains(&i)).unwrap();
    let mut state = g.initial_state.clone();
    state.v[i] = DVec3::X;
    assert!(!g.authored_holds[i]);
    let (pin, state) = prepare_pin_edit(&t, &g, &state, &panel.id, &[g.mesh.uv[i]], true).unwrap();
    assert!(pin.garment.authored_holds[i]);
    assert!(
        marvelous_cloth::authoring::capture_pin_targets(
            &pin.template,
            &g,
            &state,
            &panel.id,
            Some(&[g.mesh.uv[i]])
        )
        .is_err()
    ); // Effective positions match, but constraint ownership is stale.
    assert_eq!(pin.garment.mesh.pins[i], pin.garment.legacy_pins[i]);
    assert_eq!(state.v[i], DVec3::ZERO);
    let (release, state) = prepare_pin_edit(
        &pin.template,
        &pin.garment,
        &state,
        &panel.id,
        &[g.mesh.uv[i]],
        false,
    )
    .unwrap();
    assert!(!release.garment.authored_holds[i]);
    assert_eq!(release.garment.mesh.pins[i], g.mesh.pins[i]);
    assert_eq!(state.x[i], g.initial_state.x[i]);
    assert_eq!(state.v[i], DVec3::ZERO);
}

#[test]
fn fitting_cache_roundtrip_includes_holds_and_preserves_empty_legacy_fields() {
    use marvelous_cloth::{
        authoring::prepare_freeze_edit, fitting::FittingProject, garment::presets::GarmentKind,
    };
    let dir = tempfile::tempdir().unwrap();
    let avatar = dir.path().join("avatar.obj");
    std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
    let file = dir.path().join("sample.clothcraft");
    let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
    project.template = editable();
    let g = project.template.compile().unwrap();
    project.state = Some(g.initial_state.clone());
    project.save(&file).unwrap();
    let old = FittingProject::load(&file).unwrap();
    old.compile().unwrap();
    let mut explicit_empty = serde_json::to_value(&old).unwrap();
    explicit_empty["template"]["pin_targets"] = serde_json::json!([]);
    explicit_empty["template"]["frozen_panels"] = serde_json::json!([]);
    let explicit_empty: FittingProject = serde_json::from_value(explicit_empty).unwrap();
    explicit_empty.compile().unwrap();
    assert_eq!(
        serde_json::to_vec(&old.template).unwrap(),
        serde_json::to_vec(&explicit_empty.template).unwrap()
    );
    let (frozen, mut state) = prepare_freeze_edit(
        &project.template,
        &g,
        &g.initial_state,
        &g.panels[0].id,
        true,
    )
    .unwrap();
    state.time = 7.;
    project.template = frozen.template;
    project.state = Some(state.clone());
    project.save(&file).unwrap();
    let mut reopened = FittingProject::load(&file).unwrap();
    let scene = reopened.compile().unwrap();
    assert_eq!(scene.state.x, state.x);
    assert_eq!(scene.state.v, state.v);
    assert_eq!(scene.state.time, state.time);
    assert_ne!(reopened.mesh_signature, old.mesh_signature);
    reopened.template.frozen_panels[0].targets[0].world.x += 0.01;
    assert!(
        reopened
            .compile()
            .err()
            .unwrap()
            .contains("Stale fitting cache")
    );
}

#[test]
fn frozen_panel_roundtrip_rejects_remesh_and_releases_without_reset() {
    use marvelous_cloth::authoring::{prepare_freeze_edit, prepare_pin_edit};
    let mut t = editable();
    for (i, panel) in t.panels.iter_mut().enumerate() {
        panel.placement.rotation_degrees = DVec3::new(90., 0., 0.);
        panel.placement.translation = DVec3::new(i as f64 * 4., 2., 0.);
    }
    let g = t.compile().unwrap();
    let p = &g.panels[0];
    let i = p.vertices.start;
    let uv = g.mesh.uv[i];
    let mut state = g.initial_state.clone();
    state.time = 2.;
    for x in &mut state.x {
        *x += DVec3::Y * 0.2;
    }
    state.v.fill(DVec3::X * 0.03);
    let (pin, state) = prepare_pin_edit(&t, &g, &state, &p.id, &[uv], true).unwrap();
    let (frozen, mut state) =
        prepare_freeze_edit(&pin.template, &pin.garment, &state, &p.id, true).unwrap();
    let before = state.clone();
    let saved = serde_json::to_string(&frozen.template).unwrap();
    let loaded: GarmentTemplate = serde_json::from_str(&saved).unwrap();
    let compiled = loaded.compile().unwrap();
    for j in p.vertices.clone() {
        assert_eq!(compiled.mesh.pins[j], Some(state.x[j]));
        assert_eq!(state.v[j], DVec3::ZERO);
    }
    let mut changed = loaded.clone();
    changed.panels[0].pattern.nx *= 2;
    assert!(changed.compile().unwrap_err().contains("release"));
    let mut changed = loaded.clone();
    changed.frozen_panels[0].targets.pop();
    assert!(changed.compile().is_err());
    let mut changed = loaded.clone();
    changed.frozen_panels[0].targets[1].world += DVec3::X;
    changed.frozen_panels[0].targets[1].uv = uv;
    assert!(changed.compile().is_err());
    assert!(prepare_pin_edit(&loaded, &compiled, &state, &p.id, &[uv], false).is_err());
    let settings = VbdSettings {
        iterations: 4,
        dt: 0.005,
        ..Default::default()
    };
    let mut solver = VbdSolver::new(Arc::new(compiled.clone()), None, &state).unwrap();
    for _ in 0..8 {
        solver.step(&mut state, &settings, None).unwrap();
    }
    assert_eq!(&state.x[p.vertices.clone()], &before.x[p.vertices.clone()]);
    assert!(state.x[g.panels[1].vertices.start].y < before.x[g.panels[1].vertices.start].y);
    let (released, next) = prepare_freeze_edit(&loaded, &compiled, &state, &p.id, false).unwrap();
    assert_eq!(next.x, state.x);
    assert_eq!(next.v, state.v);
    assert_eq!(next.time, state.time);
    assert_eq!(released.garment.mesh.pins[i], Some(state.x[i]));
    assert!(released.garment.mesh.pins[i + 1].is_none());
    assert_eq!(released.template.pin_targets.len(), 1);
    assert!(released.template.frozen_panels.is_empty());
    let mut moving = next;
    let mut solver = VbdSolver::new(Arc::new(released.garment), None, &moving).unwrap();
    for _ in 0..4 {
        solver.step(&mut moving, &settings, None).unwrap();
    }
    assert_eq!(moving.x[i], state.x[i]);
    assert!(moving.x[i + 1].distance(state.x[i + 1]) > 1e-6);
}

#[test]
fn authored_pin_save_release_and_history_preserve_drape() {
    use marvelous_cloth::authoring::{History, prepare_pin_edit};
    let t = editable();
    let g = t.compile().unwrap();
    let mut state = g.initial_state.clone();
    state.time = 3.5;
    for (i, (x, v)) in state.x.iter_mut().zip(&mut state.v).enumerate() {
        *x += DVec3::new(0.12, 0.3, 0.04);
        *v = DVec3::X * (i as f64 + 1.) * 0.01;
    }
    let p = &g.panels[0];
    let i = p.vertices.start;
    let uv = g.mesh.uv[i];
    let original = serde_json::to_string(&t).unwrap();
    assert!(!original.contains("pin_targets"));
    let (edit, held) = prepare_pin_edit(&t, &g, &state, &p.id, &[uv], true).unwrap();
    assert_eq!(held.x, state.x);
    assert_eq!(held.time, state.time);
    assert_eq!(held.v[i], DVec3::ZERO);
    assert_eq!(&held.v[i + 1..], &state.v[i + 1..]);
    assert_eq!(edit.garment.mesh.uv, g.mesh.uv);
    assert_eq!(edit.garment.mesh.masses, g.mesh.masses);
    assert!(edit.reset_simulation);
    let saved = serde_json::to_string(&edit.template).unwrap();
    let reopened: GarmentTemplate = serde_json::from_str(&saved).unwrap();
    let compiled = reopened.compile().unwrap();
    assert_eq!(compiled.mesh.pins[i], Some(state.x[i]));
    assert_eq!(compiled.initial_state.x[i], state.x[i]);
    let mut history = History::default();
    history.record(t.clone());
    assert!(
        history
            .restore_checked(&reopened, false, |_| Err("Initialization rejected".into()))
            .is_err()
    );
    assert!(history.can_undo());
    assert!(!history.can_redo());
    let undo = history
        .restore_checked(&reopened, false, |_| Ok(()))
        .unwrap();
    let released = undo.state_after(&compiled, &held);
    assert_eq!(released.x, held.x);
    assert_eq!(released.v, held.v);
    assert_eq!(released.time, held.time);
    let (release, next) =
        prepare_pin_edit(&reopened, &compiled, &held, &p.id, &[uv], false).unwrap();
    assert!(release.template.pin_targets.is_empty());
    assert_eq!(next.x, held.x);
    assert_eq!(next.v, held.v);
    assert_eq!(serde_json::to_string(&t).unwrap(), original);
}

#[test]
fn pin_remesh_and_unsupported_copy_fail_without_dropping_holds() {
    use marvelous_cloth::authoring::{
        Command, apply, clipboard::PatternClipboard, prepare_pin_edit,
    };
    let t = editable();
    let g = t.compile().unwrap();
    let p = &g.panels[0];
    let uv = g.mesh.uv[p.vertices.start + 4]; // Interior point of the 2x2 grid.
    let (edit, _) = prepare_pin_edit(&t, &g, &g.initial_state, &p.id, &[uv], true).unwrap();
    let mut refined = edit.template.clone();
    refined.panels[0].pattern.nx = 4;
    refined.panels[0].pattern.ny = 4;
    assert!(refined.compile().is_ok());
    refined.panels[0].pattern.nx = 3;
    assert!(refined.compile().is_err());
    let before = serde_json::to_string(&edit.template).unwrap();
    assert!(
        apply(
            &edit.template,
            Command::Duplicate {
                panel: p.id.clone()
            }
        )
        .is_err()
    );
    let clipboard = PatternClipboard::capture(&edit.template, std::slice::from_ref(&p.id)).unwrap();
    assert!(
        apply(
            &t,
            Command::Paste {
                clipboard,
                center: glam::DVec2::ZERO
            }
        )
        .is_err()
    );
    let deleted = apply(
        &edit.template,
        Command::RemovePanel {
            panel: p.id.clone(),
        },
    )
    .unwrap();
    assert!(deleted.template.pin_targets.is_empty());
    assert_eq!(serde_json::to_string(&edit.template).unwrap(), before);
    let mut invalid = edit.template.clone();
    invalid.version = 1;
    assert!(invalid.compile().is_err());
}

#[test]
fn material_targets_resolve_exactly_without_mutating_constraints() {
    use marvelous_cloth::garment::pins::{MaterialPinTarget, resolve_targets};
    let mut g = panels(false);
    let i = g.panels[0].vertices.start;
    let target = MaterialPinTarget {
        panel: g.panels[0].id.clone(),
        uv: g.mesh.uv[i],
        world: g.initial_state.x[i] + DVec3::Y,
    };
    let encoded = serde_json::to_string(&target).unwrap();
    let loaded: MaterialPinTarget = serde_json::from_str(&encoded).unwrap();
    assert_eq!(loaded, target);
    let before = g.mesh.pins.clone();
    assert_eq!(
        resolve_targets(&g, &[loaded]).unwrap(),
        vec![(i, target.world)]
    );
    assert_eq!(g.mesh.pins, before);
    let j = g.panels[1].vertices.start;
    let other = MaterialPinTarget {
        panel: g.panels[1].id.clone(),
        uv: g.mesh.uv[j],
        world: g.initial_state.x[j],
    };
    assert_eq!(target.uv, other.uv);
    assert_eq!(
        resolve_targets(&g, &[target.clone(), other.clone()]).unwrap(),
        vec![(i, target.world), (j, other.world)]
    );
    assert!(resolve_targets(&g, &vec![target.clone(); 65_537]).is_err());
    assert!(resolve_targets(&g, &[target.clone(), target.clone()]).is_err());
    let mut invalid = target.clone();
    invalid.uv.x += 1e-8;
    assert!(resolve_targets(&g, &[invalid]).is_err());
    let mut invalid = target.clone();
    invalid.world = DVec3::NAN;
    assert!(resolve_targets(&g, &[invalid]).is_err());
    let mut invalid = target.clone();
    invalid.panel = "missing".into();
    assert!(resolve_targets(&g, &[invalid]).is_err());
    g.mesh.pins[i] = Some(target.world);
    assert!(resolve_targets(&g, std::slice::from_ref(&target)).is_ok());
    g.mesh.pins[i] = Some(target.world + DVec3::X);
    assert!(resolve_targets(&g, std::slice::from_ref(&target)).is_err());
    assert_eq!(g.mesh.pins[i], Some(target.world + DVec3::X));
    g.mesh.pins[i] = None;
    g.mesh.uv[i + 1] = g.mesh.uv[i];
    assert!(resolve_targets(&g, &[target]).is_err());
}

#[test]
fn capture_uses_material_identity_and_rejects_stale_or_ambiguous_input() {
    use marvelous_cloth::authoring::capture_pin_targets;
    let t = GarmentTemplate::two_panel_demo();
    let g = t.compile().unwrap();
    let mut s = g.initial_state.clone();
    for x in &mut s.x {
        *x += DVec3::new(0.2, 0.1, -0.3);
    }
    let before = serde_json::to_vec(&s).unwrap();
    let panel = &g.panels[0];
    let i = panel.vertices.start;
    let uv = g.mesh.uv[i];
    assert_eq!(
        capture_pin_targets(&t, &g, &s, &panel.id, Some(&[uv])).unwrap(),
        vec![(uv, s.x[i])]
    );
    let full = capture_pin_targets(&t, &g, &s, &panel.id, None).unwrap();
    assert_eq!(full.len(), panel.vertices.len());
    for ((uv, world), i) in full.iter().zip(panel.vertices.clone()) {
        assert_eq!(*uv, g.mesh.uv[i]);
        assert_eq!(*world, s.x[i]);
    }
    assert!(capture_pin_targets(&t, &g, &s, &panel.id, Some(&[])).is_err());
    assert!(capture_pin_targets(&t, &g, &s, &panel.id, Some(&[uv, uv])).is_err());
    assert!(capture_pin_targets(&t, &g, &s, &panel.id, Some(&[glam::DVec2::NAN])).is_err());
    assert!(
        capture_pin_targets(
            &t,
            &g,
            &s,
            &panel.id,
            Some(&[uv + glam::DVec2::splat(1e-6)])
        )
        .is_err()
    );
    assert!(capture_pin_targets(&t, &g, &s, "missing", None).is_err());
    let mut stale = t.clone();
    stale.panels[0].placement.translation += DVec3::X;
    assert!(capture_pin_targets(&stale, &g, &s, &panel.id, None).is_err());
    assert_eq!(serde_json::to_vec(&s).unwrap(), before);
    s.v[0] = DVec3::NAN;
    assert!(capture_pin_targets(&t, &g, &s, &panel.id, None).is_err());
}

fn panels(stacked: bool) -> CompiledGarment {
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams.clear();
    for (i, p) in t.panels.iter_mut().enumerate() {
        p.pins.clear();
        p.pattern.nx = 2;
        p.pattern.ny = 2;
        p.placement.rotation_degrees = DVec3::new(90., 0., 0.);
        p.placement.translation = if stacked {
            DVec3::new(0., 1. + i as f64 * 0.04, 0.)
        } else {
            DVec3::new(i as f64 * 3., 1., 0.)
        };
    }
    t.compile().unwrap()
}

#[test]
fn displaced_hold_and_release_preserve_shape_time_and_free_motion() {
    let mut g = panels(false);
    let rest = g.mesh.uv.clone();
    let masses = g.mesh.masses.clone();
    let mut state = g.initial_state.clone();
    for x in &mut state.x {
        *x += DVec3::new(0.13, 0.27, 0.08);
    }
    state.time = 2.;
    let held = g.panels[0].vertices.clone();
    let free = g.panels[1].vertices.clone();
    for i in held.clone() {
        g.mesh.pins[i] = Some(state.x[i]);
        state.v[i] = DVec3::ZERO;
    }
    let before = state.clone();
    let settings = VbdSettings {
        dt: 0.005,
        damping: 0.,
        iterations: 4,
        ..Default::default()
    };
    let mut solver = VbdSolver::new(Arc::new(g.clone()), None, &state).unwrap();
    for _ in 0..8 {
        solver.step(&mut state, &settings, None).unwrap();
        for i in held.clone() {
            assert_eq!(state.x[i], before.x[i]);
            assert_eq!(state.v[i], DVec3::ZERO);
        }
    }
    for i in free.clone() {
        assert!((state.v[i] - settings.gravity * settings.dt * 8.).length() < 1e-8);
        assert!(
            (state.x[i] - before.x[i] - settings.gravity * settings.dt.powi(2) * 36.).length()
                < 1e-9
        );
    }
    for i in held.clone() {
        g.mesh.pins[i] = None;
    }
    let released = state.clone();
    let mut solver = VbdSolver::new(Arc::new(g.clone()), None, &state).unwrap();
    assert_eq!(state.x, released.x);
    assert_eq!(state.time, released.time);
    solver.step(&mut state, &settings, None).unwrap();
    for i in held {
        assert!((state.v[i] - settings.gravity * settings.dt).length() < 1e-9);
        assert!(
            (state.x[i] - released.x[i] - settings.gravity * settings.dt.powi(2)).length() < 1e-10
        );
    }
    for i in free {
        assert!((state.v[i] - released.v[i] - settings.gravity * settings.dt).length() < 1e-8);
    }
    assert_eq!(g.mesh.uv, rest);
    assert_eq!(g.mesh.masses, masses);
    assert!(state.x.iter().chain(&state.v).all(|v| v.is_finite()));
}

#[test]
fn held_panel_remains_in_self_contact_detection() {
    let mut g = panels(true);
    let mut state = g.initial_state.clone();
    let held = g.panels[0].vertices.clone();
    let free = g.panels[1].vertices.clone();
    for i in held.clone() {
        g.mesh.pins[i] = Some(state.x[i]);
    }
    let before = state.clone();
    let settings = VbdSettings {
        dt: 0.005,
        iterations: 8,
        ..Default::default()
    };
    let mut solver = VbdSolver::new(Arc::new(g), None, &state).unwrap();
    for _ in 0..80 {
        solver.step(&mut state, &settings, None).unwrap();
        for i in held.clone() {
            assert_eq!(state.x[i], before.x[i]);
        }
        for i in free.clone() {
            assert!(state.x[i].is_finite() && state.v[i].is_finite());
            assert!(state.x[i].y > 1., "free cloth crossed held panel");
        }
    }
    assert!(free.clone().any(|i| state.x[i].y < before.x[i].y - 0.01));
}

#[test]
fn single_pin_supports_deformation_then_releases_without_reset() {
    let mut g = panels(false);
    let mut state = g.initial_state.clone();
    for x in &mut state.x {
        *x += DVec3::Y * 0.3;
    }
    let point = g.panels[0].vertices.start;
    let target = state.x[point];
    let other = g.panels[0].vertices.end - 1;
    let old_other = state.x[other];
    g.mesh.pins[point] = Some(target);
    let settings = VbdSettings {
        dt: 0.005,
        iterations: 8,
        ..Default::default()
    };
    let mut solver = VbdSolver::new(Arc::new(g.clone()), None, &state).unwrap();
    for _ in 0..20 {
        solver.step(&mut state, &settings, None).unwrap();
        assert_eq!(state.x[point], target);
        assert_eq!(state.v[point], DVec3::ZERO);
    }
    assert!(state.x[other].distance(old_other) > 1e-4);
    let before_release = state.clone();
    g.mesh.pins[point] = None;
    let mut solver = VbdSolver::new(Arc::new(g), None, &state).unwrap();
    assert_eq!(state.x, before_release.x);
    assert_eq!(state.v, before_release.v);
    assert_eq!(state.time, before_release.time);
    for _ in 0..4 {
        solver.step(&mut state, &settings, None).unwrap();
        assert!(state.x.iter().chain(&state.v).all(|v| v.is_finite()));
    }
    assert!(state.x[point].distance(target) > 1e-6);
    assert!(state.time > before_release.time);
}

#[test]
fn inconsistent_pin_target_is_rejected_before_initialization() {
    let mut g = panels(false);
    let state = g.initial_state.clone();
    g.mesh.pins[0] = Some(state.x[0] + DVec3::Y * 0.1);
    assert!(VbdSolver::new(Arc::new(g), None, &state).is_err());
}

#[test]
fn grouped_holds_preserve_drape_and_undo_as_one_edit() {
    use marvelous_cloth::authoring::{History, prepare_pin_group_edit};
    use std::collections::BTreeMap;
    let t = editable();
    let g = t.compile().unwrap();
    let mut state = g.initial_state.clone();
    state.time = 4.;
    for (x, v) in state.x.iter_mut().zip(&mut state.v) {
        x.y += 0.2;
        *v = DVec3::X;
    }
    let indices: Vec<_> = g.panels.iter().map(|p| p.vertices.start).collect();
    let selections: BTreeMap<_, _> = g
        .panels
        .iter()
        .map(|p| (p.id.clone(), vec![g.mesh.uv[p.vertices.start]]))
        .collect();
    let (edit, held) = prepare_pin_group_edit(&t, &g, &state, &selections, true).unwrap();
    assert_eq!(edit.template.pin_targets.len(), 2);
    assert_eq!(held.x, state.x);
    assert_eq!(held.time, state.time);
    assert_eq!(edit.garment.mesh.uv, g.mesh.uv);
    for (i, v) in held.v.iter().enumerate() {
        assert_eq!(
            *v,
            if indices.contains(&i) {
                DVec3::ZERO
            } else {
                DVec3::X
            }
        );
    }
    let mut history = History::default();
    history.record(t.clone());
    let restored = history.restore(&edit.template, false).unwrap();
    assert_eq!(
        serde_json::to_value(restored.template).unwrap(),
        serde_json::to_value(&t).unwrap()
    );
    assert!(!history.can_undo());
    let (released, next) =
        prepare_pin_group_edit(&edit.template, &edit.garment, &held, &selections, false).unwrap();
    assert!(released.template.pin_targets.is_empty());
    assert_eq!(next.x, held.x);
    assert_eq!(next.v, held.v);
    assert_eq!(next.time, held.time);
}

#[test]
fn grouped_holds_reject_invalid_or_frozen_member_atomically() {
    use marvelous_cloth::authoring::{prepare_freeze_edit, prepare_pin_group_edit};
    use std::collections::BTreeMap;
    let t = editable();
    let g = t.compile().unwrap();
    let state = g.initial_state.clone();
    let before = serde_json::to_value((&t, &state)).unwrap();
    let selections: BTreeMap<_, _> = g
        .panels
        .iter()
        .map(|p| (p.id.clone(), vec![g.mesh.uv[p.vertices.start]]))
        .collect();
    let second = &g.panels[1].id;
    let mut invalid = selections.clone();
    invalid.get_mut(second).unwrap()[0] += glam::DVec2::splat(0.0001);
    assert!(prepare_pin_group_edit(&t, &g, &state, &invalid, true).is_err());
    invalid.insert(second.clone(), vec![]);
    assert!(prepare_pin_group_edit(&t, &g, &state, &invalid, true).is_err());
    assert_eq!(serde_json::to_value((&t, &state)).unwrap(), before);
    let (frozen, held) = prepare_freeze_edit(&t, &g, &state, second, true).unwrap();
    assert!(
        prepare_pin_group_edit(&frozen.template, &frozen.garment, &held, &selections, true)
            .is_err()
    );
    assert!(frozen.template.pin_targets.is_empty());
    assert_eq!(frozen.template.frozen_panels.len(), 1);
}
