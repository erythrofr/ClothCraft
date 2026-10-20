use glam::DVec3;
use marvelous_cloth::vbd::{VbdSettings, VbdSolver};
mod common;

#[test]
fn published_contact_metrics_describe_accepted_positions() {
    let (garment, floor) = common::resting_patch(DVec3::ZERO);
    let mut state = garment.initial_state.clone();
    let mut solver = VbdSolver::new(garment, Some(&floor), &state).unwrap();
    let settings = VbdSettings { dt: 1. / 60., ..Default::default() };
    let pre_positions = solver.world.positions(&state.x);
    let rq = 2. * settings.contact.radius;
    let pre = solver.world.clone().detect(&pre_positions, rq, &settings.contact).unwrap();
    let metrics = solver.step(&mut state, &settings, None).unwrap();
    let accepted = solver.world.positions(&state.x);
    let mut verifier = solver.world.clone();
    let final_contact = verifier.detect(&accepted, rq, &settings.contact).unwrap();
    assert!((metrics.minimum_distance_m - final_contact.minimum_distance).abs() < 1e-12);
    assert_eq!(metrics.contacts, final_contact.active_contacts);
    assert_eq!(metrics.contact_terms, final_contact.contacts.len());
    assert!(metrics.detection_updates >= 2, "must include final accepted-position detection");
    assert!((pre.minimum_distance - final_contact.minimum_distance).abs() > 1e-8,
        "fixture must actually move relative to its collider");
    assert!(metrics.detection_ms.is_finite() && metrics.step_ms >= metrics.detection_ms);
}
