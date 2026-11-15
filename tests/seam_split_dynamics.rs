//! Diagnostic: after splitting a sewn edge of the dress, does the CPU solver still
//! produce a finite, on-body garment? Prints one line per split.
use glam::DVec3;
use marvelous_cloth::{
    authoring::{self, Command, edge_length},
    fitting::FittingProject,
    garment::presets::GarmentKind,
    vbd::{VbdSettings, VbdSolver},
};
use std::path::PathBuf;

fn run(kind: GarmentKind, panel: &str, edge: &str, steps: usize) -> Result<String, String> {
    let mut project =
        FittingProject::basic(kind, 0, PathBuf::from("assets/makehuman/mannequin.obj"));
    let polygon = project
        .template
        .panels
        .iter()
        .find(|p| p.id == panel)
        .and_then(|p| p.polygon.clone())
        .ok_or("no polygon")?;
    let length = edge_length(&polygon, edge)?;
    project.template = authoring::apply(
        &project.template,
        Command::SplitBoundary {
            panel: panel.into(),
            edge: edge.into(),
            at_m: length * 0.5,
        },
    )
    .map_err(|e| format!("apply: {e}"))?
    .template;
    project.state = None;
    project.mesh_signature = None;
    let mut scene = project.compile().map_err(|e| format!("compile: {e}"))?;
    let mut solver = VbdSolver::new(
        scene.garment.clone(),
        Some(&scene.collider.surface),
        &scene.state,
    )
    .map_err(|e| format!("solver: {e}"))?;
    let settings = VbdSettings {
        dt: 1. / 60.,
        ..Default::default()
    };
    for step in 0..steps {
        if let Err(error) = solver.step(&mut scene.state, &settings, None) {
            return Err(format!("step {step}: {error}"));
        }
    }
    let finite = scene.state.x.iter().all(|p| p.is_finite());
    let (mut lo, mut hi) = (DVec3::splat(f64::INFINITY), DVec3::splat(f64::NEG_INFINITY));
    for p in &scene.state.x {
        lo = lo.min(*p);
        hi = hi.max(*p);
    }
    Ok(format!(
        "finite={finite} extent_m={:?}..{:?}",
        lo.to_array(),
        hi.to_array()
    ))
}

#[test]
fn report_dress_dynamics_after_split() {
    let kind = GarmentKind::Dress;
    let baseline = run(kind, "front", "hem", 0);
    eprintln!("baseline (no split, 0 steps): {baseline:?}");
    for edge in [
        "shoulder-right",
        "side-right",
        "side-left",
        "shoulder-left",
        "hem",
    ] {
        eprintln!("front/{edge} 30 steps: {:?}", run(kind, "front", edge, 30));
    }
}
