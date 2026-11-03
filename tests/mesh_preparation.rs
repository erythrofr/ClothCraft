//! Simulation-side static preparation, independent of native rendering.
use glam::{DVec2, DVec3};
use marvelous_cloth::{
    fitting::FittingProject,
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        polygon::PolygonPattern,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
    },
    mesh_resolution::preparation,
    vbd::{VbdSettings, VbdSolver},
};
use std::{collections::BTreeMap, sync::Arc};
fn fixture() -> GarmentTemplate {
    let mut t = presets::basic(GarmentKind::Tshirt, 0);
    t.panels.truncate(1);
    t.seams.clear();
    t.mirror_links.clear();
    let p = &mut t.panels[0];
    p.pins.clear();
    p.pin_points.clear();
    p.pattern.width = 0.16;
    p.pattern.height = 0.20;
    p.polygon = Some(PolygonPattern {
        points: vec![
            DVec2::ZERO,
            DVec2::new(0.16, 0.),
            DVec2::new(0.16, 0.20),
            DVec2::new(0., 0.20),
        ],
        edges: ["a", "b", "c", "d"].map(str::to_owned).to_vec(),
        subdivisions: 0,
        meshing: Some(MeshingSettings {
            target_edge_m: 0.04,
            ..Default::default()
        }),
        curves: BTreeMap::new(),
        holes: vec![],
        lines: vec![],
        target_lengths: BTreeMap::new(),
    });
    t
}
fn prepare(t: &GarmentTemplate) -> GarmentTemplate {
    preparation::configure(
        t,
        &t.panels.iter().map(|p| p.id.clone()).collect::<Vec<_>>(),
        [110000.; 2],
        0.5,
        0.04,
        true,
    )
    .unwrap()
}
#[test]
fn physical_compile_preserves_material_geometry_mass_seams_and_boundary_identity() {
    let mut t = fixture();
    let mut p = t.panels[0].clone();
    p.id = "other".into();
    p.placement.translation.x += 0.3;
    t.panels.push(p);
    let boundary = |p: &str| BoundaryRef {
        panel: p.into(),
        edge: Some("a".into()),
        side: Side::Top,
        range: [0.2, 0.8],
        reversed: false,
    };
    t.seams.push(SeamSpec {
        id: "sew".into(),
        a: boundary(&t.panels[0].id),
        b: boundary("other"),
        a_tail: vec![],
        b_tail: vec![],
        reverse_b: true,
        allow_ease: false,
        notches: vec![],
        stiffness: 50000.,
    });
    let original = serde_json::to_value(&t).unwrap();
    let before = t.compile().unwrap();
    let ready = prepare(&t);
    let after = ready.compile().unwrap();
    assert_eq!(original, serde_json::to_value(&t).unwrap());
    assert_ne!(before.mesh.uv.len(), after.mesh.uv.len());
    assert!(
        (before.mesh.masses.iter().sum::<f64>() - after.mesh.masses.iter().sum::<f64>()).abs()
            < 1e-12
    );
    assert!((before.seams[0].measure() - after.seams[0].measure()).abs() < 1e-12);
    for (a, b) in before.panels.iter().zip(&after.panels) {
        assert_eq!(a.id, b.id);
        assert_eq!(
            a.boundaries.keys().collect::<Vec<_>>(),
            b.boundaries.keys().collect::<Vec<_>>()
        );
        for name in a.boundaries.keys() {
            let length = |g: &marvelous_cloth::garment::CompiledGarment, ids: &Vec<usize>| {
                ids.windows(2)
                    .map(|w| g.mesh.uv[w[0]].distance(g.mesh.uv[w[1]]))
                    .sum::<f64>()
            };
            assert!(
                (length(&before, &a.boundaries[name]) - length(&after, &b.boundaries[name])).abs()
                    < 1e-12
            );
        }
    }
    assert!(after.mesh.hinges.len() > before.mesh.hinges.len());
    for (panel, range) in ready.panels.iter().zip(&after.panels) {
        let settings = panel.polygon.as_ref().unwrap().meshing_settings();
        let quality = marvelous_cloth::garment::meshing::quality(
            &after.mesh.triangles[range.triangles.clone()],
            &settings,
        );
        assert!(quality.min_metric_angle_degrees >= 24.999, "{quality:?}");
        assert!(
            quality.max_metric_triangle_area <= 3_f64.sqrt() / 4. + 1e-9,
            "{quality:?}"
        );
    }
}
#[test]
fn prepared_mesh_roundtrips_and_rebinds_fabric_and_grain() {
    let prepared = prepare(&fixture());
    let a = prepared.compile().unwrap();
    let read: GarmentTemplate =
        serde_json::from_slice(&serde_json::to_vec(&prepared).unwrap()).unwrap();
    assert_eq!(a.mesh.uv, read.compile().unwrap().mesh.uv);
    let mut changed = read;
    changed.panels[0].grain_degrees += 37.;
    changed.fabrics[0].properties.bend_warp *= 4.;
    let b = changed.compile().unwrap();
    assert_ne!(a.mesh.uv, b.mesh.uv);
    assert!((a.mesh.masses.iter().sum::<f64>() - b.mesh.masses.iter().sum::<f64>()).abs() < 1e-12);
}
#[test]
fn legacy_defaults_stay_unchanged_and_invalid_preparation_is_atomic() {
    let t = fixture();
    let before = serde_json::to_value(&t).unwrap();
    assert!(!before.to_string().contains("physics_sizing"));
    let ids = vec![t.panels[0].id.clone()];
    assert!(preparation::configure(&t, &ids, [f64::NAN; 2], 0.5, 0.04, true).is_err());
    let mut bad = prepare(&t);
    bad.panels[0]
        .polygon
        .as_mut()
        .unwrap()
        .meshing
        .as_mut()
        .unwrap()
        .max_vertices = 64;
    assert!(bad.compile().is_err());
    assert_eq!(before, serde_json::to_value(&t).unwrap());
    let restored = preparation::configure(&prepare(&t), &ids, [1.; 2], 1., 0.04, false).unwrap();
    assert_eq!(
        t.compile().unwrap().mesh.uv,
        restored.compile().unwrap().mesh.uv
    );
}
#[test]
fn fitting_cache_includes_preparation_and_reset_rebuilds_same_mesh() {
    let avatar =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
    let mut p = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
    p.template = prepare(&fixture());
    p.prearrange = false;
    let scene = p.compile().unwrap();
    p.state = Some(scene.state);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("prepared.json");
    p.save(&path).unwrap();
    let mut read = FittingProject::load(&path).unwrap();
    let uv = read.compile().unwrap().garment.mesh.uv.clone();
    read.template.panels[0]
        .polygon
        .as_mut()
        .unwrap()
        .meshing
        .as_mut()
        .unwrap()
        .physics_sizing
        .as_mut()
        .unwrap()
        .young_pa = [220000.; 2];
    assert!(
        read.compile()
            .err()
            .unwrap()
            .contains("Stale fitting cache")
    );
    read.state = None;
    read.mesh_signature = None;
    assert_ne!(uv, read.compile().unwrap().garment.mesh.uv);
    let a = read.compile().unwrap();
    let b = read.compile().unwrap();
    assert_eq!(a.garment.mesh.uv, b.garment.mesh.uv);
}

#[test]
fn prepared_mesh_runs_cpu_vbd_with_fixed_topology_and_expected_free_fall() {
    let template = prepare(&fixture());
    let garment = Arc::new(template.compile().unwrap());
    let uv = garment.mesh.uv.clone();
    let triangles: Vec<_> = garment.mesh.triangles.iter().map(|t| t.vertices).collect();
    let mut state = garment.initial_state.clone();
    let initial = state.x.clone();
    let mut solver = VbdSolver::new(garment.clone(), None, &state).unwrap();
    let settings = VbdSettings {
        dt: 0.002,
        damping: 0.,
        iterations: 3,
        ..Default::default()
    };
    for n in 1..=5 {
        solver.step(&mut state, &settings, None).unwrap();
        for (x, rest) in state.x.iter().zip(&initial) {
            let expected =
                *rest + settings.gravity * settings.dt.powi(2) * (n * (n + 1) / 2) as f64;
            assert!(x.distance(expected) < 1e-9);
        }
        for v in &state.v {
            assert!(v.distance(settings.gravity * settings.dt * n as f64) < 1e-9);
        }
        assert_eq!(uv, garment.mesh.uv);
        assert_eq!(
            triangles,
            garment
                .mesh
                .triangles
                .iter()
                .map(|t| t.vertices)
                .collect::<Vec<_>>()
        );
    }
    assert!(state.v.iter().all(|v| v.distance(DVec3::ZERO) > 0.));
}

#[test]
fn gathered_simulation_example_has_real_eased_sewing_and_retains_pins() {
    let project = preparation::simulation_demo(std::path::PathBuf::from("unused.obj")).unwrap();
    let garment = Arc::new(project.template.compile().unwrap());
    assert_eq!(garment.seams.len(), 1);
    assert!(project.template.seams[0].allow_ease);
    let pins: Vec<_> = garment
        .mesh
        .pins
        .iter()
        .enumerate()
        .filter_map(|(i, p)| p.map(|p| (i, p)))
        .collect();
    assert_eq!(pins.len(), 2);
    let mut state = garment.initial_state.clone();
    let mut solver = VbdSolver::new(garment.clone(), None, &state).unwrap();
    let triangles = garment.mesh.triangles.len();
    for _ in 0..3 {
        solver
            .step(&mut state, project.simulation.as_ref().unwrap(), None)
            .unwrap();
    }
    assert!(state.time > 0.);
    assert_eq!(triangles, garment.mesh.triangles.len());
    for (i, position) in pins {
        assert!(state.x[i].distance(position) < 1e-12);
    }
}

#[test]
fn preparation_adapter_preserves_even_generated_looking_names_and_curves() {
    let mut t = fixture();
    let poly = t.panels[0].polygon.as_mut().unwrap();
    poly.edges = ["prepared_1", "prepared_0", "prepared_2", "prepared_3"]
        .map(str::to_owned)
        .to_vec();
    poly.curves.insert(
        "prepared_1".into(),
        [DVec2::new(0.05, 0.01), DVec2::new(0.12, 0.01)],
    );
    let before = t.compile().unwrap();
    let after = prepare(&t).compile().unwrap();
    for name in &t.panels[0].polygon.as_ref().unwrap().edges {
        let a = &before.panels[0].boundaries[name];
        let b = &after.panels[0].boundaries[name];
        assert!(before.mesh.uv[a[0]].distance(after.mesh.uv[b[0]]) < 1e-12);
        assert!(
            before.mesh.uv[*a.last().unwrap()].distance(after.mesh.uv[*b.last().unwrap()]) < 1e-12
        );
    }
    assert!(
        (before.mesh.triangles.iter().map(|t| t.area).sum::<f64>()
            - after.mesh.triangles.iter().map(|t| t.area).sum::<f64>())
        .abs()
            < 1e-12
    );
}

#[test]
fn preparation_is_one_reversible_document_edit() {
    let t = fixture();
    let prepared = prepare(&t);
    let mut history = marvelous_cloth::authoring::History::default();
    history.record(t.clone());
    let undo = history.restore(&prepared, false).unwrap();
    assert_eq!(
        serde_json::to_value(&undo.template).unwrap(),
        serde_json::to_value(&t).unwrap()
    );
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(
        serde_json::to_value(&redo.template).unwrap(),
        serde_json::to_value(&prepared).unwrap()
    );
    assert_eq!(redo.garment.mesh.uv, prepared.compile().unwrap().mesh.uv);
}
