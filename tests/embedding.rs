use glam::{DVec2, DVec3};
use marvelous_cloth::garment::{GarmentTemplate, embedding::MaterialPath, export};

#[test]
fn dense_multisegment_path_matches_exhaustive() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels[0].pattern.nx = 100;
    template.panels[0].pattern.ny = 100;
    let garment = template.compile().unwrap();
    let path = MaterialPath {
        panel: "left".into(),
        points: (0..=80)
            .map(|i| {
                DVec2::new(
                    0.10 + i as f64 * 0.002,
                    0.3 + if i % 2 == 0 { 0.0005 } else { -0.0005 },
                )
            })
            .collect(),
    };
    let start = std::time::Instant::now();
    let expected = garment.embed_path(&path).unwrap();
    let exhaustive = start.elapsed();
    let start = std::time::Instant::now();
    let actual = garment.embed_path_bounded(&path).unwrap();
    eprintln!(
        "dense 20k triangles / 80 segments: {} attachments; exhaustive {exhaustive:?}; indexed including build {:?}",
        actual.len(),
        start.elapsed()
    );
    assert_eq!(actual.len(), expected.len());
    for (a, b) in actual.iter().zip(&expected) {
        assert_eq!(a.vertices, b.vertices);
        assert_eq!(a.weights, b.weights);
        assert_eq!(a.uv, b.uv);
    }
}

#[test]
fn path_rejects_resolvable_narrow_gap_between_triangles() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.panels[0].pattern.nx = 100;
    t.panels[0].pattern.ny = 2;
    let mut g = t.compile().unwrap();
    let continuous = g.clone();
    let gap = 2e-11;
    for triangle in &mut g.mesh.triangles[g.panels[0].triangles.clone()] {
        if triangle.rest.iter().all(|p| p.x >= 0.2 - 1e-12) {
            for p in &mut triangle.rest {
                p.x += gap;
            }
            triangle.inv_dm = glam::DMat2::from_cols(
                triangle.rest[1] - triangle.rest[0],
                triangle.rest[2] - triangle.rest[0],
            )
            .inverse();
        }
    }
    let middle = DVec2::new(0.2 + gap / 2., 0.29);
    assert!(g.embed_point("left", middle).is_err());
    for points in [
        vec![DVec2::new(0.001, 0.29), DVec2::new(0.399, 0.29)],
        vec![DVec2::new(0.399, 0.29), DVec2::new(0.001, 0.29)],
    ] {
        let path = MaterialPath {
            panel: "left".into(),
            points,
        };
        assert!(continuous.embed_path(&path).is_ok(), "continuous reference");
        assert!(
            continuous.embed_path_bounded(&path).is_ok(),
            "continuous indexed"
        );
        assert!(g.embed_path(&path).is_err(), "exhaustive accepted gap");
        assert!(g.embed_path_bounded(&path).is_err(), "indexed accepted gap");
    }
}

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
fn paths_reject_crossing_narrow_rotated_holes_but_allow_nearby_material() {
    use marvelous_cloth::garment::{
        domain::Hole,
        shapes::{Primitive, primitive},
    };
    for (center, angle, width) in [
        (DVec2::new(0.14, 0.24), 0.42, 0.005),
        (DVec2::new(0.27, 0.4), -0.71, 0.02),
    ] {
        let mut template = GarmentTemplate::two_panel_demo();
        template.version = 2;
        template.seams.clear();
        template.panels[0].pins.clear();
        let mut polygon = primitive(
            Primitive::Rectangle,
            DVec2::new(0.4, 0.6),
            90.,
            Default::default(),
        )
        .unwrap();
        let transform = glam::DMat2::from_angle(angle);
        let point = |x, y| center + transform * DVec2::new(x, y);
        polygon.holes.push(Hole {
            points: vec![
                point(-width / 2., -0.06),
                point(-width / 2., 0.06),
                point(width / 2., 0.06),
                point(width / 2., -0.06),
            ],
            edges: (0..4).map(|i| format!("hole_{i}")).collect(),
        });
        template.panels[0].polygon = Some(polygon);
        let garment = template.compile().unwrap();
        for (offset, reverse) in [(-0.04, false), (0., false), (0., true), (0.04, false)] {
            let mut points = vec![point(-0.04, offset), point(0.04, offset)];
            if reverse {
                points.reverse();
            }
            let path = MaterialPath {
                panel: "left".into(),
                points,
            };
            assert!(garment.embed_path(&path).is_err(), "{path:?}");
            assert!(garment.embed_path_bounded(&path).is_err(), "{path:?}");
        }
        let control = MaterialPath {
            panel: "left".into(),
            points: vec![point(-0.04, 0.09), point(0.04, 0.09)],
        };
        assert!(garment.embed_path(&control).is_ok(), "{control:?}");
        assert!(garment.embed_path_bounded(&control).is_ok(), "{control:?}");
    }
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
fn indexed_paths_match_exhaustive_near_triangle_boundaries() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels[0].pattern.nx = 8;
    template.panels[0].pattern.ny = 9;
    let garment = template.compile().unwrap();
    let mut comparisons = 0;
    let mut successes = 0;
    for triangle in &garment.mesh.triangles[garment.panels[0].triangles.clone()] {
        let [a, b, c] = triangle.rest;
        let center = (a + b + c) / 3.0;
        for (start, end) in [(a, b), (b, c), (c, a)] {
            let midpoint = (start + end) * 0.5;
            let inward = (center - midpoint).normalize();
            for delta in [-1e-8, -1e-11, 0.0, 1e-11, 1e-8] {
                let path = MaterialPath {
                    panel: "left".into(),
                    points: vec![midpoint + inward * delta, center],
                };
                let exhaustive = garment.embed_path(&path);
                let indexed = garment.embed_path_bounded(&path);
                comparisons += 1;
                match (exhaustive, indexed) {
                    (Ok(a), Ok(b)) => {
                        successes += 1;
                        assert_eq!(a.len(), b.len(), "{path:?}");
                        for (a, b) in a.iter().zip(&b) {
                            assert_eq!(a.vertices, b.vertices, "{path:?}");
                            assert_eq!(a.weights, b.weights, "{path:?}");
                            assert_eq!(a.uv, b.uv, "{path:?}");
                        }
                    }
                    (Err(_), Err(_)) => {}
                    (a, b) => {
                        panic!("different result for {path:?}: exhaustive={a:?}, indexed={b:?}")
                    }
                }
            }
        }
    }
    assert!(comparisons >= 2000);
    assert!(successes >= 1800);
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
fn bounded_path_rejects_invalid_compiled_panel_triangle_ranges() {
    let original = GarmentTemplate::two_panel_demo().compile().unwrap();
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
    };
    assert!(original.embed_path_bounded(&path).is_ok());
    let triangle_count = original.mesh.triangles.len();
    for range in [
        0..triangle_count + 1,
        triangle_count + 1..triangle_count + 2,
        std::ops::Range { start: 2, end: 1 },
        0..0,
    ] {
        let mut garment = original.clone();
        garment.panels[0].triangles = range.clone();
        let error = garment
            .embed_path_bounded(&path)
            .expect_err(&format!("invalid range {range:?} must fail"));
        assert!(error.contains("triangle range"), "{error}");
    }
}

#[test]
fn exhaustive_embedding_rejects_invalid_compiled_panel_triangle_ranges() {
    let original = GarmentTemplate::two_panel_demo().compile().unwrap();
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
    };
    assert!(original.embed_point("left", path.points[0]).is_ok());
    assert!(original.embed_path(&path).is_ok());
    let count = original.mesh.triangles.len();
    for range in [
        0..count + 1,
        count + 1..count + 2,
        std::ops::Range { start: 2, end: 1 },
        0..0,
    ] {
        let mut garment = original.clone();
        garment.panels[0].triangles = range.clone();
        let path_error = garment
            .embed_path(&path)
            .expect_err("invalid range must not embed a path");
        assert!(
            path_error.contains("triangle range"),
            "{range:?}: {path_error}"
        );
        let point_error = garment
            .embed_point("left", path.points[0])
            .expect_err("invalid range must not embed a point");
        assert!(
            point_error.contains("triangle range"),
            "{range:?}: {point_error}"
        );
    }
}

#[test]
fn indexed_path_rejects_finite_inverse_with_nonfinite_products() {
    let mut garment = GarmentTemplate::two_panel_demo().compile().unwrap();
    let index = garment.panels[0].triangles.start;
    let triangle = &mut garment.mesh.triangles[index];
    triangle.rest = [DVec2::ZERO, DVec2::splat(2.), DVec2::new(2., 3.)];
    triangle.inv_dm = glam::DMat2::from_cols(DVec2::splat(f64::MAX), DVec2::splat(-f64::MAX));
    assert!(triangle.inv_dm.is_finite());
    assert!(!(triangle.inv_dm * (triangle.rest[1] - triangle.rest[0])).is_finite());
    let path = MaterialPath {
        panel: "left".into(),
        points: vec![DVec2::new(0.2, 0.2), DVec2::new(0.3, 0.3)],
    };
    assert!(garment.embed_path_bounded(&path).is_err());
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
fn close_triangle_crossings_follow_non_affine_surface() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.seams.clear();
    template.panels[0].pattern.nx = 2;
    template.panels[0].pattern.ny = 2;
    let garment = template.compile().unwrap();
    let mut x = garment.initial_state.x.clone();
    for i in garment.panels[0].vertices.clone() {
        let uv = garment.mesh.uv[i];
        x[i] = DVec3::new(
            uv.x,
            uv.y,
            if uv.distance(DVec2::new(0.2, 0.3)) < 1e-12 {
                1.
            } else {
                0.
            },
        );
    }
    let y = 0.3 + 1e-11;
    for (start, end) in [(0.01, 0.39), (0.39, 0.01)] {
        let path = MaterialPath {
            panel: "left".into(),
            points: vec![DVec2::new(start, y), DVec2::new(end, y)],
        };
        for embedded in [
            garment.embed_path(&path).unwrap(),
            garment.embed_path_bounded(&path).unwrap(),
        ] {
            for k in -30..=30 {
                let u = 0.2 + k as f64 * 1e-12;
                let uv = DVec2::new(u, y);
                let expected = garment.mesh.triangles[garment.panels[0].triangles.clone()]
                    .iter()
                    .find_map(|triangle| {
                        let b = triangle.inv_dm * (uv - triangle.rest[0]);
                        let w = [1. - b.x - b.y, b.x, b.y];
                        w.iter().all(|weight| *weight >= -1e-14).then(|| {
                            triangle
                                .vertices
                                .iter()
                                .zip(w)
                                .map(|(index, weight)| x[*index] * weight)
                                .sum::<DVec3>()
                        })
                    })
                    .expect("sample belongs to mesh");
                let pair = embedded
                    .windows(2)
                    .find(|pair| {
                        let a = pair[0].uv.x;
                        let b = pair[1].uv.x;
                        u >= a.min(b) && u <= a.max(b) && a != b
                    })
                    .expect("sample covered by embedded path");
                let ratio = (u - pair[0].uv.x) / (pair[1].uv.x - pair[0].uv.x);
                let actual = pair[0]
                    .evaluate(&x)
                    .unwrap()
                    .lerp(pair[1].evaluate(&x).unwrap(), ratio);
                assert!(
                    actual.distance(expected) < 1e-13,
                    "u={u:.15} actual={actual:?} expected={expected:?}"
                );
            }
        }
    }
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
