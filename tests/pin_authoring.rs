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
