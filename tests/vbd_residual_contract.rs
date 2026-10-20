//! Check reported VBD stationarity against an independent finite-difference
//! derivative of the accepted implicit-Euler physical objective.
use glam::DVec3;
use marvelous_cloth::{
    energy,
    garment::{CompiledGarment, GarmentTemplate},
    model::State,
    vbd::{Grab, VbdSettings, VbdSolver},
};
use std::sync::Arc;

fn potential(
    garment: &CompiledGarment,
    old: &State,
    x: &[DVec3],
    settings: &VbdSettings,
    grab: &Grab,
) -> f64 {
    let membrane: f64 = garment.mesh.triangles.iter().map(|t| {
        energy::membrane(t.vertices.map(|i| x[i].to_array()), t, &garment.materials[t.material])
    }).sum();
    let bending: f64 = garment.mesh.hinges.iter().map(|h| {
        energy::bending(h.vertices.map(|i| x[i].to_array()), h, &garment.materials[h.material])
    }).sum();
    let damp = 1. + settings.damping * settings.dt;
    let inertia: f64 = x.iter().enumerate().map(|(i, p)| {
        let target = old.x[i] + (old.v[i] * settings.dt + settings.gravity * settings.dt.powi(2)) / damp;
        0.5 * garment.mesh.masses[i] * damp / settings.dt.powi(2) * p.distance_squared(target)
    }).sum();
    let attachment: DVec3 = grab.vertices.iter().zip(grab.weights)
        .map(|(v, w)| x[*v] * w).sum();
    membrane + bending + inertia + 0.5 * grab.stiffness * attachment.distance_squared(grab.target)
}

#[test]
fn reported_residual_matches_final_accepted_state_not_stale_color_gradients() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels.truncate(1);
    template.seams.clear();
    template.panels[0].pins.clear();
    template.panels[0].pattern.nx = 2;
    template.panels[0].pattern.ny = 2;
    let garment = Arc::new(template.compile().unwrap());
    let mut state = garment.initial_state.clone();
    let before = state.clone();
    let center_vertices = garment.mesh.triangles[0].vertices;
    let centroid = center_vertices.iter().map(|v| state.x[*v] / 3.).sum::<DVec3>();
    let grab = Grab {
        vertices: center_vertices,
        weights: [1. / 3.; 3],
        target: centroid + DVec3::new(0., 0., 0.02),
        stiffness: 250.,
    };
    let settings = VbdSettings {
        gravity: DVec3::ZERO,
        dt: 0.005,
        iterations: 1,
        ..Default::default()
    };
    let mut solver = VbdSolver::new(garment.clone(), None, &state).unwrap();
    let metrics = solver.step(&mut state, &settings, Some(&grab)).unwrap();
    assert_eq!(metrics.contacts, 0, "fixture must isolate the elastic and grab objective");
    let h = 1e-7;
    let mut norm2 = 0.;
    for vertex in 0..state.x.len() {
        for axis in 0..3 {
            let mut plus = state.x.clone();
            let mut minus = state.x.clone();
            plus[vertex][axis] += h;
            minus[vertex][axis] -= h;
            let grad = (potential(&garment, &before, &plus, &settings, &grab)
                - potential(&garment, &before, &minus, &settings, &grab)) / (2. * h);
            norm2 += grad * grad;
        }
    }
    let expected = (norm2 / (3 * state.x.len()) as f64).sqrt();
    let reported = metrics.residual_rms_n.expect("CPU VBD residual metric");
    assert!((expected - reported).abs() < 1e-4 + 0.001 * expected,
        "final-state RMS residual differs: finite difference {expected}, reported {reported}");
}
