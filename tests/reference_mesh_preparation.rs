//! Static mesh preparation in the default cloth-over-sphere Project v1.
use glam::DVec3;
use marvelous_cloth::{
    mesh_resolution::preparation::PhysicsSizing,
    model::{Pattern, Scene},
    project::Project,
    solver::ReferenceSolver,
};

fn prepared() -> Project {
    Project {
        pattern: Pattern {
            width: 0.12,
            height: 0.16,
            ..Default::default()
        },
        physics_sizing: Some(PhysicsSizing {
            young_pa: [110000.; 2],
            // Compilation must bind these to the current material and grain.
            bending_nm: [1e-6; 2],
            axis_degrees: 0.,
            boundary_ratio: 0.5,
            transition_m: 0.04,
            seed: 42,
        }),
        ..Default::default()
    }
}

#[test]
fn default_project_retains_the_original_uniform_sphere_mesh() {
    let project = Project::default();
    assert_eq!(project.scene, Scene::Sphere);
    assert!(project.sphere.is_some());
    assert!(project.physics_sizing.is_none());
    let json = serde_json::to_value(&project).unwrap();
    assert!(json.get("physics_sizing").is_none());
    let loaded: Project = serde_json::from_value(json).unwrap();
    let (mesh, state) = loaded.build().unwrap();
    let (original, start) = project
        .pattern
        .build(&project.material, project.scene)
        .unwrap();
    assert_eq!(mesh.uv, original.uv);
    assert_eq!(mesh.masses, original.masses);
    assert_eq!(mesh.pins, original.pins);
    assert_eq!(state.x, start.x);
    assert_eq!(
        mesh.triangles
            .iter()
            .map(|t| t.vertices)
            .collect::<Vec<_>>(),
        original
            .triangles
            .iter()
            .map(|t| t.vertices)
            .collect::<Vec<_>>()
    );
}

#[test]
fn prepared_sphere_mesh_preserves_area_mass_pose_and_project_roundtrip() {
    let project = prepared();
    let (mesh, state) = project.build().unwrap();
    let area = project.pattern.width * project.pattern.height;
    assert!((mesh.triangles.iter().map(|t| t.area).sum::<f64>() - area).abs() < 1e-12);
    assert!((mesh.masses.iter().sum::<f64>() - area * project.material.density).abs() < 1e-12);
    assert!(!mesh.hinges.is_empty());
    assert!(mesh.masses.iter().all(|m| m.is_finite() && *m > 0.));
    assert!(mesh.pins.iter().all(Option::is_none));
    for (uv, x) in mesh.uv.iter().zip(&state.x) {
        assert_eq!(
            *x,
            DVec3::new(
                uv.x - project.pattern.width * 0.5,
                0.65,
                uv.y - project.pattern.height * 0.5
            )
        );
    }
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("sphere.json");
    project.save(&path).unwrap();
    let mut loaded = Project::load(&path).unwrap();
    assert_eq!(loaded.version, 1);
    let (again, reset) = loaded.build().unwrap();
    assert_eq!(again.uv, mesh.uv);
    assert_eq!(reset.x, state.x);
    assert_eq!(
        again
            .triangles
            .iter()
            .map(|t| t.vertices)
            .collect::<Vec<_>>(),
        mesh.triangles
            .iter()
            .map(|t| t.vertices)
            .collect::<Vec<_>>()
    );
    loaded.physics_sizing = None;
    let (uniform, _) = loaded.build().unwrap();
    assert_ne!(uniform.uv, mesh.uv);
    assert_eq!(
        uniform.uv.len(),
        (loaded.pattern.nx + 1) * (loaded.pattern.ny + 1)
    );
}

#[test]
fn prepared_hanging_mesh_retains_both_corner_pins_and_fixed_topology() {
    let mut project = prepared();
    project.scene = Scene::Hanging;
    project.sphere = None;
    project.material.grain_degrees = 37.;
    let (mesh, mut state) = project.build().unwrap();
    let pins: Vec<_> = mesh.pins.iter().flatten().copied().collect();
    assert_eq!(pins.len(), 2);
    for x in [DVec3::new(-0.06, 1.3, 0.), DVec3::new(0.06, 1.3, 0.)] {
        assert!(pins.contains(&x));
    }
    let uv = mesh.uv.clone();
    for _ in 0..2 {
        let metrics =
            ReferenceSolver::step(&mesh, &mut state, &project.material, &project.solver, None)
                .unwrap();
        assert!(metrics.objective_final_j <= metrics.objective_initial_j + 1e-12);
        for (i, pin) in mesh.pins.iter().enumerate() {
            if let Some(pin) = pin {
                assert_eq!(state.x[i], *pin);
                assert_eq!(state.v[i], DVec3::ZERO);
            }
        }
    }
    assert_eq!(mesh.uv, uv);
    assert_eq!(state.x.len(), uv.len());
}

#[test]
fn prepared_sphere_mesh_runs_the_reference_contact_solver() {
    let project = prepared();
    let (mesh, mut state) = project.build().unwrap();
    let mut contact = false;
    for _ in 0..25 {
        let metrics = ReferenceSolver::step(
            &mesh,
            &mut state,
            &project.material,
            &project.solver,
            project.sphere.as_ref(),
        )
        .unwrap();
        contact |= metrics.contacting_vertices > 0;
        assert!(state.x.iter().all(|p| p.is_finite()));
        assert!(metrics.objective_final_j <= metrics.objective_initial_j + 1e-12);
        assert_eq!(state.x.len(), mesh.uv.len());
    }
    assert!(contact);
}

#[test]
fn material_and_grain_are_rebound_and_invalid_estimates_fail() {
    let mut project = prepared();
    let original = project.build().unwrap().0.uv;
    project.material.bend_warp *= 3.;
    project.material.grain_degrees = 37.;
    let changed = project.build().unwrap().0.uv;
    assert_ne!(original, changed);
    let plan = project.physics_sizing.as_mut().unwrap();
    plan.bending_nm = [project.material.bend_warp, project.material.bend_weft];
    plan.axis_degrees = project.material.grain_degrees;
    assert_eq!(project.build().unwrap().0.uv, changed);
    project.physics_sizing.as_mut().unwrap().young_pa[0] = f64::NAN;
    assert!(project.build().is_err());
}
