use glam::{DVec2, DVec3};
use marvelous_cloth::garment::{GarmentTemplate, embedding::MaterialPath, export};

#[test]
fn bounded_path_matches_exhaustive_on_edges_interior_and_dense_mesh() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.panels[0].pattern.nx = 100;
    t.panels[0].pattern.ny = 100;
    let g = t.compile().unwrap();
    let paths = [
        vec![DVec2::new(0., 0.), DVec2::new(0.4, 0.6)],
        vec![DVec2::new(0., 0.3), DVec2::new(0.4, 0.3)],
        vec![
            DVec2::new(0.04, 0.12),
            DVec2::new(0.31, 0.47),
            DVec2::new(0.02, 0.55),
        ],
        vec![DVec2::new(-1e-13, 0.3), DVec2::new(0.4, 0.3)],
    ];
    for points in paths {
        let path = MaterialPath {
            panel: "left".into(),
            points,
        };
        let start = std::time::Instant::now();
        let reference = g.embed_path(&path).unwrap();
        let direct = start.elapsed();
        let start = std::time::Instant::now();
        let bounded = g.embed_path_bounded(&path).unwrap();
        eprintln!(
            "embedding: {} triangles, {} points; exhaustive={direct:?}, indexed including build={:?}",
            g.panels[0].triangles.len(),
            bounded.len(),
            start.elapsed()
        );
        assert_eq!(reference.len(), bounded.len());
        for (a, b) in reference.iter().zip(&bounded) {
            assert_eq!(a.vertices, b.vertices);
            assert_eq!(a.weights, b.weights);
            assert_eq!(a.uv, b.uv);
        }
    }
    for points in [
        vec![DVec2::new(-0.1, 0.2), DVec2::new(0.2, 0.2)],
        vec![DVec2::NAN, DVec2::new(0.2, 0.2)],
    ] {
        let path = MaterialPath {
            panel: "left".into(),
            points,
        };
        assert!(g.embed_path(&path).is_err());
        assert!(g.embed_path_bounded(&path).is_err());
    }
    let mut corrupted = t.compile().unwrap();
    let first_triangle = corrupted.panels[0].triangles.start;
    corrupted.mesh.triangles[first_triangle].inv_dm = glam::DMat2::ZERO;
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
    };
    assert!(corrupted.embed_path_bounded(&path).is_err());
}

#[test]
fn bounded_path_rejects_crossing_panel_holes() {
    use marvelous_cloth::garment::{
        domain::Hole,
        shapes::{Primitive, primitive},
    };
    let mut t = GarmentTemplate::two_panel_demo();
    t.version = 2;
    t.seams.clear();
    t.panels[0].pins.clear();
    let mut polygon = primitive(
        Primitive::Rectangle,
        DVec2::new(0.4, 0.6),
        90.,
        Default::default(),
    )
    .unwrap();
    polygon.holes.push(Hole {
        points: vec![
            DVec2::new(0.15, 0.2),
            DVec2::new(0.15, 0.4),
            DVec2::new(0.25, 0.4),
            DVec2::new(0.25, 0.2),
        ],
        edges: (0..4).map(|i| format!("hole_{i}")).collect(),
    });
    t.panels[0].polygon = Some(polygon);
    let g = t.compile().unwrap();
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.05, 0.3), DVec2::new(0.35, 0.3)],
    };
    assert!(g.embed_path(&path).is_err());
    assert!(g.embed_path_bounded(&path).is_err());
}

#[test]
fn bounded_paths_match_exhaustive_for_deterministic_varied_segments() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels[0].pattern.nx = 12;
    template.panels[0].pattern.ny = 13;
    let g = template.compile().unwrap();
    let mut seed = 0x123456789abcdef_u64;
    let mut sample = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        (seed >> 11) as f64 / ((1_u64 << 53) as f64)
    };
    for _ in 0..100 {
        let path = MaterialPath {
            panel: "left".into(),
            points: vec![
                DVec2::new(sample() * 0.4, sample() * 0.6),
                DVec2::new(sample() * 0.4, sample() * 0.6),
            ],
        };
        let a = g.embed_path(&path).unwrap();
        let b = g.embed_path_bounded(&path).unwrap();
        assert_eq!(a.len(), b.len());
        for (a, b) in a.iter().zip(&b) {
            assert_eq!(a.vertices, b.vertices);
            assert_eq!(a.weights, b.weights);
            assert_eq!(a.uv, b.uv);
        }
    }
}

#[test]
fn indexed_paths_match_exhaustive_on_transformed_and_anisotropic_rest_meshes() {
    use glam::DMat2;
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels[0].pattern.nx = 12;
    template.panels[0].pattern.ny = 13;
    let cases = [
        (
            DVec2::new(200_000., -300_000.),
            DMat2::from_angle(0.61) * DMat2::from_diagonal(DVec2::new(0.1, 0.2)),
        ),
        (
            DVec2::new(-100., 200.),
            DMat2::from_angle(-0.43) * DMat2::from_diagonal(DVec2::new(1., 0.001)),
        ),
        (
            DVec2::ZERO,
            DMat2::from_angle(1.1) * DMat2::from_diagonal(DVec2::new(0.02, 2.)),
        ),
    ];
    for (offset, transform) in cases {
        let mut garment = template.compile().unwrap();
        for triangle in &mut garment.mesh.triangles[garment.panels[0].triangles.clone()] {
            triangle.rest = triangle.rest.map(|point| offset + transform * point);
            triangle.inv_dm = DMat2::from_cols(
                triangle.rest[1] - triangle.rest[0],
                triangle.rest[2] - triangle.rest[0],
            )
            .inverse();
        }
        let mut seed = 0x142857_u64;
        let mut sample = || {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            (seed >> 11) as f64 / ((1_u64 << 53) as f64)
        };
        let mut segments = vec![
            [DVec2::new(0., 0.), DVec2::new(0.4, 0.6)],
            [DVec2::new(0., 0.3), DVec2::new(0.4, 0.3)],
            [DVec2::new(-0.01, 0.3), DVec2::new(0.3, 0.3)],
        ];
        segments.extend((0..50).map(|_| {
            [
                DVec2::new(sample() * 0.4, sample() * 0.6),
                DVec2::new(sample() * 0.4, sample() * 0.6),
            ]
        }));
        let mut successful = 0;
        for segment in segments {
            let path = MaterialPath {
                panel: "left".into(),
                points: segment
                    .into_iter()
                    .map(|p| offset + transform * p)
                    .collect(),
            };
            let a = garment.embed_path(&path);
            let b = garment.embed_path_bounded(&path);
            match (a, b) {
                (Ok(a), Ok(b)) => {
                    successful += 1;
                    assert_eq!(a.len(), b.len());
                    for (a, b) in a.iter().zip(&b) {
                        assert_eq!(a.vertices, b.vertices);
                        assert_eq!(a.weights, b.weights);
                        assert_eq!(a.uv, b.uv);
                    }
                }
                (Err(_), Err(_)) => {}
                (a, b) => panic!("different result for {path:?}: exhaustive={a:?}, indexed={b:?}"),
            }
        }
        assert!(
            successful >= 40,
            "only {successful} paths succeeded for {offset:?}"
        );
    }
}

#[test]
fn indexed_path_refuses_near_degenerate_material_triangles() {
    let mut garment = GarmentTemplate::two_panel_demo().compile().unwrap();
    for triangle in &mut garment.mesh.triangles[garment.panels[0].triangles.clone()] {
        triangle.rest = triangle.rest.map(|p| DVec2::new(p.x, p.y * 1e-9));
        triangle.inv_dm = glam::DMat2::from_cols(
            triangle.rest[1] - triangle.rest[0],
            triangle.rest[2] - triangle.rest[0],
        )
        .inverse();
    }
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.05, 0.05e-9), DVec2::new(0.1, 0.1e-9)],
    };
    assert!(garment.embed_path(&path).is_ok());
    assert!(
        garment
            .embed_path_bounded(&path)
            .err()
            .unwrap()
            .contains("well-conditioned")
    );
}

#[test]
fn attachments_reproduce_material_coordinates_and_affine_deformations() {
    let g = GarmentTemplate::two_panel_demo().compile().unwrap();
    let mut x = g.initial_state.x.clone();
    for i in g.panels[1].vertices.clone() {
        let u = g.mesh.uv[i];
        x[i] = DVec3::new(1.0 + 2.0 * u.x, -2.0 + 3.0 * u.y, u.x - u.y);
    }
    for uv in [DVec2::ZERO, DVec2::new(0.4, 0.6), DVec2::new(0.123, 0.371)] {
        let p = g.embed_point("right", uv).unwrap();
        let reconstructed = p
            .vertices
            .iter()
            .zip(p.weights)
            .map(|(i, w)| g.mesh.uv[*i] * w)
            .sum::<DVec2>();
        assert!(reconstructed.distance(uv) < 1e-13);
        assert!(
            p.evaluate(&x).unwrap().distance(DVec3::new(
                1.0 + 2.0 * uv.x,
                -2.0 + 3.0 * uv.y,
                uv.x - uv.y
            )) < 1e-13
        );
        assert!(p.evaluate(&[]).is_err());
    }
    assert!(g.embed_point("missing", DVec2::ZERO).is_err());
    assert!(g.embed_point("right", DVec2::new(-0.01, 0.2)).is_err());
    assert!(g.embed_point("right", DVec2::NAN).is_err());
}

#[test]
fn material_path_splits_at_fold_instead_of_cutting_through_surface() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.panels.truncate(1);
    t.seams.clear();
    t.panels[0].pattern.nx = 2;
    t.panels[0].pattern.ny = 1;
    let g = t.compile().unwrap();
    let mut x = g.initial_state.x.clone();
    // Fold right half by 90 degrees around u=.2.
    for (i, p) in x.iter_mut().enumerate() {
        let uv = g.mesh.uv[i];
        *p = if uv.x <= 0.2 {
            DVec3::new(uv.x, uv.y, 0.0)
        } else {
            DVec3::new(0.2, uv.y, uv.x - 0.2)
        };
    }
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.0, 0.3), DVec2::new(0.4, 0.3)],
    };
    let embedded = g.embed_path(&path).unwrap();
    assert!(embedded.iter().any(|p| (p.uv.x - 0.2).abs() < 1e-13));
    let points: Vec<_> = embedded.iter().map(|p| p.evaluate(&x).unwrap()).collect();
    let length: f64 = points.windows(2).map(|p| p[0].distance(p[1])).sum();
    assert!((length - 0.4).abs() < 1e-12);
    assert!(points[0].distance(*points.last().unwrap()) < length - 0.1);
}

#[test]
fn material_paths_recompile_after_remeshing_and_export_guides() {
    let mut t = GarmentTemplate::two_panel_demo();
    let path = MaterialPath {
        panel: "right".into(),
        points: vec![DVec2::new(0.03, 0.08), DVec2::new(0.38, 0.57)],
    };
    let original = t.compile().unwrap();
    let a = original.embed_path(&path).unwrap();
    t.panels[1].pattern.nx = 7;
    t.panels[1].pattern.ny = 9;
    let fine = t.compile().unwrap();
    let b = fine.embed_path(&path).unwrap();
    for (a, b) in [
        (a.first().unwrap(), b.first().unwrap()),
        (a.last().unwrap(), b.last().unwrap()),
    ] {
        assert!(
            a.evaluate(&original.initial_state.x)
                .unwrap()
                .distance(b.evaluate(&fine.initial_state.x).unwrap())
                < 1e-13
        );
    }
    let obj = export::grain_guides_obj(&t, &fine, &fine.initial_state).unwrap();
    assert_eq!(obj.lines().filter(|l| l.starts_with("l ")).count(), 4);
    assert!(obj.contains("g right_weft"));
}
