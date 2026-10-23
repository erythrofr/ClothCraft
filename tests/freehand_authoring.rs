use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        presets::{self, GarmentKind},
    },
};

fn settings() -> MeshingSettings {
    MeshingSettings {
        target_edge_m: 0.06,
        ..Default::default()
    }
}
fn stroke() -> Vec<DVec2> {
    (0..=48)
        .map(|i| {
            let t = std::f64::consts::TAU * i as f64 / 48.;
            DVec2::new(2. + 0.25 * t.cos(), 2. + 0.35 * t.sin())
        })
        .collect()
}
fn source() -> GarmentTemplate {
    serde_json::from_str(include_str!("../examples/templates/two-panel.json")).unwrap()
}
fn command(samples: Vec<DVec2>, source: &GarmentTemplate) -> Command {
    Command::Freehand {
        samples,
        tolerance_m: 0.002,
        meshing: settings(),
        fabric: source.fabrics[0].id.clone(),
    }
}

#[test]
fn freehand_adds_a_panel_preserving_existing_panels_and_seams() {
    let source = source();
    let mut samples = stroke();
    // Exact closure: no duplicated polygon anchor or microscopic closing edge.
    *samples.last_mut().unwrap() = samples[0];
    let preview = authoring::freehand_contour(&samples, 0.002, settings()).unwrap();
    let edit = authoring::apply(&source, command(samples, &source)).unwrap();
    assert_eq!(edit.template.panels.len(), source.panels.len() + 1);
    assert_eq!(
        serde_json::to_value(&edit.template.panels[..source.panels.len()]).unwrap(),
        serde_json::to_value(&source.panels).unwrap()
    );
    assert_eq!(
        serde_json::to_value(&edit.template.seams).unwrap(),
        serde_json::to_value(&source.seams).unwrap()
    );
    let panel = edit.template.panels.last().unwrap();
    let polygon = panel.polygon.as_ref().unwrap();
    for (edge, controls) in &preview.curves {
        let actual = polygon.curves[edge];
        for i in 0..2 {
            assert!((actual[i] + panel.layout_2d.unwrap()).distance(controls[i]) < 1e-12);
        }
    }
    assert!(edit.reset_simulation);
}

#[test]
fn freehand_accepts_both_directions_and_explicit_open_closure() {
    let samples: Vec<_> = stroke().into_iter().take(40).collect();
    let forward = authoring::freehand_contour(&samples, 0.002, settings()).unwrap();
    let mut reverse = samples.clone();
    reverse.reverse();
    let backward = authoring::freehand_contour(&reverse, 0.002, settings()).unwrap();
    assert!(forward.points.len() >= 3 && backward.points.len() >= 3);
    let last = forward.points.len() - 1;
    let c = forward.curves[&forward.edges[last]];
    let a = *samples.last().unwrap();
    let b = samples[0];
    assert!(c[0].distance(a + (b - a) / 3.) < 1e-12);
    assert!(c[1].distance(a + (b - a) * 2. / 3.) < 1e-12);
}

#[test]
fn freehand_invalid_input_is_atomic() {
    let source = source();
    let before = serde_json::to_vec(&source).unwrap();
    for samples in [
        vec![DVec2::ZERO, DVec2::ONE, DVec2::Y, DVec2::X],
        vec![DVec2::ZERO, DVec2::X],
        vec![DVec2::NAN, DVec2::X, DVec2::Y],
        vec![DVec2::ZERO; 4097],
        (0..80)
            .map(|i| DVec2::new(i as f64 * 0.01, if i % 2 == 0 { 0. } else { 0.1 }))
            .collect(),
    ] {
        assert!(authoring::apply(&source, command(samples, &source)).is_err());
        assert_eq!(serde_json::to_vec(&source).unwrap(), before);
    }
}

#[test]
fn freehand_history_and_reload_keep_exact_boundaries() {
    let source = presets::basic(GarmentKind::Tshirt, 0);
    let mut samples = stroke();
    *samples.last_mut().unwrap() = samples[0];
    let edit = authoring::apply(&source, command(samples, &source)).unwrap();
    let mut history = History::default();
    history.record(source.clone());
    let undo = history.restore(&edit.template, false).unwrap();
    assert_eq!(
        serde_json::to_vec(&undo.template).unwrap(),
        serde_json::to_vec(&source).unwrap()
    );
    let redo = history.restore(&undo.template, true).unwrap();
    let read: GarmentTemplate =
        serde_json::from_slice(&serde_json::to_vec(&redo.template).unwrap()).unwrap();
    assert_eq!(
        serde_json::to_vec(&read).unwrap(),
        serde_json::to_vec(&edit.template).unwrap()
    );
    assert_eq!(read.compile().unwrap().mesh.uv, edit.garment.mesh.uv);
}
