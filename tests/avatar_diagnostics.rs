use glam::DVec3;
use marvelous_cloth::{
    avatar::{SurfaceMesh, diagnostics},
    garment::GarmentTemplate,
};
use std::sync::Arc;

fn tetra() -> SurfaceMesh {
    SurfaceMesh {
        vertices: vec![DVec3::ZERO, DVec3::X, DVec3::Y, DVec3::Z],
        triangles: vec![[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]],
    }
}

#[test]
fn closed_surface_identity_bounds_and_unused_vertices() {
    let mut mesh = tetra();
    let a = diagnostics::inspect(&mesh).unwrap();
    assert_eq!((a.vertices, a.used_vertices, a.triangles), (4, 4, 4));
    assert_eq!(
        (
            a.boundary_edges,
            a.nonmanifold_edges,
            a.inconsistent_two_face_edges,
            a.duplicate_triangles
        ),
        (0, 0, 0, 0)
    );
    assert_eq!((a.min, a.max), (DVec3::ZERO, DVec3::ONE));
    assert_eq!(
        a.fingerprint,
        diagnostics::inspect(&mesh).unwrap().fingerprint
    );
    mesh.vertices.push(DVec3::splat(100.));
    let b = diagnostics::inspect(&mesh).unwrap();
    assert_eq!((b.vertices, b.used_vertices), (5, 4));
    assert_eq!((a.min, a.max), (b.min, b.max)); // Unreferenced data is not collision coverage.
    assert_ne!(a.fingerprint, b.fingerprint);
    mesh.vertices[1].x = 2.;
    let c = diagnostics::inspect(&mesh).unwrap();
    assert_eq!(c.max.x, 2.);
    assert_ne!(b.fingerprint, c.fingerprint);
}

#[test]
fn open_nonmanifold_inconsistent_and_duplicate_faces_are_distinguished() {
    let mut mesh = tetra();
    mesh.triangles.pop();
    assert_eq!(diagnostics::inspect(&mesh).unwrap().boundary_edges, 3);
    let mut mesh = tetra();
    mesh.triangles[0].swap(1, 2);
    let r = diagnostics::inspect(&mesh).unwrap();
    assert_eq!(r.inconsistent_two_face_edges, 3);
    assert_eq!(r.nonmanifold_edges, 0);
    assert_ne!(
        r.fingerprint,
        diagnostics::inspect(&tetra()).unwrap().fingerprint
    );
    let mut mesh = tetra();
    mesh.triangles.push([1, 2, 0]);
    let r = diagnostics::inspect(&mesh).unwrap();
    assert_eq!(r.nonmanifold_edges, 3);
    assert_eq!(r.duplicate_triangles, 1);
}

#[test]
fn invalid_meshes_fail_without_panics_or_fabricated_bounds() {
    let extreme = SurfaceMesh {
        vertices: vec![
            DVec3::new(-f64::MAX, 0., 0.),
            DVec3::new(f64::MAX, 0., 0.),
            DVec3::Y,
        ],
        triangles: vec![[0, 1, 2]],
    };
    assert!(diagnostics::inspect(&extreme).is_err());
    let mut mesh = tetra();
    mesh.vertices[0].x = f64::NAN;
    assert!(diagnostics::inspect(&mesh).is_err());
    let mut mesh = tetra();
    mesh.triangles[0][0] = 100;
    assert!(diagnostics::inspect(&mesh).is_err());
    let mut mesh = tetra();
    mesh.triangles[0] = [0, 0, 1];
    assert!(diagnostics::inspect(&mesh).is_err());
    assert!(
        diagnostics::inspect(&SurfaceMesh {
            vertices: vec![],
            triangles: vec![]
        })
        .is_err()
    );
}

#[test]
fn bundled_mannequin_matches_independent_index_topology_count() {
    let mesh = SurfaceMesh::parse_obj(include_str!("../assets/makehuman/mannequin.obj")).unwrap();
    let r = diagnostics::inspect(&mesh).unwrap();
    assert_eq!((r.vertices, r.triangles), (13380, 26756));
    assert_eq!(
        (
            r.boundary_edges,
            r.nonmanifold_edges,
            r.inconsistent_two_face_edges
        ),
        (0, 0, 0)
    );
    assert!((r.max.y - r.min.y - 1.75).abs() < 1e-10);
}

#[test]
fn initialization_check_is_read_only_and_rejects_a_touching_avatar() {
    let template: GarmentTemplate =
        serde_json::from_str(include_str!("../examples/templates/two-panel.json")).unwrap();
    let garment = Arc::new(template.compile().unwrap());
    let state = garment.initial_state.clone();
    let saved = serde_json::to_vec(&state).unwrap();
    let mut far = tetra();
    for v in &mut far.vertices {
        *v += DVec3::splat(20.);
    }
    diagnostics::check_vbd_initialization(garment.clone(), &far, &state).unwrap();
    assert_eq!(serde_json::to_vec(&state).unwrap(), saved);
    let t = garment.mesh.triangles[0].vertices;
    let touching = SurfaceMesh {
        vertices: t.map(|v| state.x[v]).to_vec(),
        triangles: vec![[0, 1, 2]],
    };
    assert!(diagnostics::check_vbd_initialization(garment, &touching, &state).is_err());
    assert_eq!(serde_json::to_vec(&state).unwrap(), saved);
}
