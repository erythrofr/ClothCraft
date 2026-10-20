//! Four bounded 2D construction acceptance fixtures. These are simplified flat
//! engineering pieces, not validated production patterns or fit simulations.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{GarmentTemplate, meshing::MeshingSettings, presets::{self, GarmentKind}, seam::{BoundaryRef, Side}},
};

fn boundary(panel: &str, edge: &str) -> BoundaryRef {
    BoundaryRef { panel: panel.into(), edge: Some(edge.into()), side: Side::Top, range: [0., 1.] }
}

fn drawing(width: f64, height: f64) -> GarmentTemplate {
    authoring::apply(&presets::basic(GarmentKind::Tshirt, 0), Command::Polygon {
        points: vec![DVec2::ZERO, DVec2::new(width, 0.), DVec2::new(width, height), DVec2::new(0., height)],
        tangents: vec![],
        meshing: MeshingSettings { target_edge_m: 0.13, ..Default::default() },
        fabric: "woven-reference".into(), replace: true,
    }).expect("draft rectangle").template
}

fn add_piece(template: GarmentTemplate) -> GarmentTemplate {
    let id = template.panels[0].id.clone();
    authoring::apply(&template, Command::Duplicate { panel: id }).expect("duplicate panel").template
}

fn sew(template: GarmentTemplate, left: usize, right: usize, edge: &str) -> GarmentTemplate {
    let a = boundary(&template.panels[left].id, edge);
    let b = boundary(&template.panels[right].id, edge);
    authoring::apply(&template, Command::Sew { a, b, reverse: false, ease: false })
        .expect("matched seam authoring").template
}

fn acceptance(template: &GarmentTemplate, panel_count: usize, seam_count: usize) {
    assert_eq!(template.panels.len(), panel_count);
    assert_eq!(template.seams.len(), seam_count);
    let ids: std::collections::HashSet<_> = template.panels.iter().map(|p| &p.id).collect();
    assert_eq!(ids.len(), panel_count, "each piece needs a persistent ID");
    let initial = template.compile().expect("compile authored seams and mesh");
    assert_eq!(initial.panels.len(), panel_count);
    assert_eq!(initial.seams.len(), seam_count);
    assert!(!initial.mesh.triangles.is_empty());
    let snapshot = serde_json::to_vec(template).expect("serialize");
    let loaded: GarmentTemplate = serde_json::from_slice(&snapshot).expect("deserialize");
    assert_eq!(snapshot, serde_json::to_vec(&loaded).unwrap(), "stable snapshot bytes");
    let compiled = loaded.compile().expect("compile after reload");
    assert_eq!(initial.mesh.uv, compiled.mesh.uv, "rest mesh coordinates survive reload");
    assert_eq!(initial.mesh.triangles.len(), compiled.mesh.triangles.len());
    assert_eq!(template.seams.iter().map(|s| &s.id).collect::<Vec<_>>(),
               loaded.seams.iter().map(|s| &s.id).collect::<Vec<_>>());
}

#[test]
fn tshirt_preset_construction_and_snapshot() {
    let template = presets::basic(GarmentKind::Tshirt, 0);
    acceptance(&template, 2, 8);
}

#[test]
fn trousers_simplified_four_flat_pieces() {
    // Four rectangular leg pieces test transactional construction plumbing;
    // crotch curves, waistband shaping and fit still require separate fixtures.
    let mut t = drawing(0.28, 0.88);
    for _ in 0..3 { t = add_piece(t); }
    t = sew(t, 0, 1, "edge_1");
    t = sew(t, 2, 3, "edge_1");
    acceptance(&t, 4, 2);
}

#[test]
fn hoodie_simplified_body_and_two_sleeve_pieces() {
    // This geometry does not claim a shaped hood or production armholes.
    let mut t = drawing(0.52, 0.65);
    for _ in 0..3 { t = add_piece(t); }
    t = sew(t, 0, 1, "edge_1");
    t = sew(t, 2, 3, "edge_1");
    acceptance(&t, 4, 2);
}

#[test]
fn paneled_jacket_simplified_six_piece_sewing_graph() {
    let mut t = drawing(0.22, 0.64);
    for _ in 0..5 { t = add_piece(t); }
    for pair in [(0, 1), (2, 3), (4, 5)] { t = sew(t, pair.0, pair.1, "edge_1"); }
    acceptance(&t, 6, 3);
}

#[test]
fn single_size_resize_and_history_do_not_prove_multisize_grading() {
    let original = drawing(0.28, 0.88);
    let mut history = History::default();
    history.record(original.clone());
    let resized = authoring::apply(&original, Command::Dimensions {
        panel: original.panels[0].id.clone(), width: 0.30, height: 0.92,
    }).expect("single-size numeric resize").template;
    assert_eq!(resized.panels[0].pattern.width, 0.30);
    assert_eq!(resized.panels[0].pattern.height, 0.92);
    let restored = history.restore(&resized, false).expect("undo size edit");
    assert_eq!(serde_json::to_vec(&restored.template).unwrap(), serde_json::to_vec(&original).unwrap());
    // No Command::Grade or multi-size rule model exists in this API.
    // A persisted size-family acceptance case must be added once implemented.
}

#[test]
fn sewing_different_length_edges_requires_easing_and_is_atomic() {
    let mut t = drawing(0.28, 0.88);
    t = add_piece(t);
    let original = serde_json::to_vec(&t).unwrap();
    let outcome = authoring::apply(&t, Command::Sew {
        a: boundary(&t.panels[0].id, "edge_1"),
        b: boundary(&t.panels[1].id, "edge_2"),
        reverse: false, ease: false,
    });
    assert!(outcome.is_err(), "unequal seam lengths must fail explicitly");
    assert_eq!(original, serde_json::to_vec(&t).unwrap(), "failure is atomic");
}
