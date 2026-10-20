//! Regression boundary: an internal dart-looking line is drafting geometry,
//! not a structural folded dart. Keep this distinction explicit until a real
//! dart command, rest topology and solver coupling are implemented.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{meshing::MeshingSettings, presets::{self, GarmentKind}},
};

#[test]
fn internal_guide_roundtrips_and_undoes_without_consuming_boundary_intake() {
    let original = authoring::apply(&presets::basic(GarmentKind::Tshirt, 0), Command::Polygon {
        points: vec![DVec2::new(0., 0.), DVec2::new(0.3, 0.), DVec2::new(0.3, 0.2), DVec2::new(0., 0.2)],
        tangents: vec![], meshing: MeshingSettings::default(),
        fabric: "woven-reference".into(), replace: true,
    }).unwrap().template;
    let panel = original.panels.iter().find(|p| p.polygon.is_some()).unwrap();
    let id = panel.id.clone();
    let before = panel.polygon.as_ref().unwrap().points.clone();
    let mut history = History::default();
    let edit = authoring::apply(&original, Command::InternalLine {
        panel: id.clone(),
        points: vec![DVec2::new(0.05, 0.05), DVec2::new(0.08, 0.12)],
        tangents: vec![DVec2::ZERO; 2],
    }).unwrap();
    history.record(original.clone());
    let poly = edit.template.panels.iter().find(|p| p.id == id).unwrap().polygon.as_ref().unwrap();
    assert_eq!(poly.points, before, "drafting guide must not claim to remove a dart wedge");
    assert_eq!(poly.lines.len(), 1);
    let loaded: marvelous_cloth::garment::GarmentTemplate =
        serde_json::from_str(&serde_json::to_string(&edit.template).unwrap()).unwrap();
    let reopened = loaded.panels.iter().find(|p| p.id == id).unwrap().polygon.as_ref().unwrap();
    assert_eq!(reopened.lines.len(), 1);
    assert_eq!(reopened.points, before);
    let undone = history.restore(&edit.template, false).unwrap();
    let poly = undone.template.panels.iter().find(|p| p.id == id).unwrap().polygon.as_ref().unwrap();
    assert!(poly.lines.is_empty());
    assert_eq!(poly.points, before);
}
