//! Physical prerequisites for authored holds. These exercise compiled constraints,
//! not a native pin tool or persistent target schema (both remain separate work).
use glam::DVec3;
use marvelous_cloth::{
    garment::{CompiledGarment, GarmentTemplate},
    vbd::{VbdSettings, VbdSolver},
};
use std::sync::Arc;

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
