use glam::DVec2;
use marvelous_cloth::garment::graphics::{GraphicPlacement, GraphicSide};

fn placement() -> GraphicPlacement {
    GraphicPlacement {
        id: "graphic_1".into(),
        panel_id: "front".into(),
        asset_id: "asset_1".into(),
        center_m: DVec2::new(0.2, 0.3),
        size_m: DVec2::new(0.1, 0.2),
        rotation_degrees: 90.,
        side: GraphicSide::Front,
    }
}

#[test]
fn rotated_artwork_uses_material_metres_and_is_invertible() {
    let p = placement();
    let expected = [
        (DVec2::ZERO, DVec2::new(0.3, 0.25)),
        (DVec2::ONE, DVec2::new(0.1, 0.35)),
        (DVec2::splat(0.5), p.center_m),
    ];
    for (uv, point) in expected {
        let mapped = p.uv_to_material(uv).unwrap();
        assert!(mapped.distance(point) < 1e-12);
        assert!(p.material_to_uv(mapped).unwrap().distance(uv) < 1e-12);
    }
    for angle in [-1080., -33., 0., 17., 360., 1080.] {
        let p = GraphicPlacement {
            rotation_degrees: angle,
            side: GraphicSide::Back,
            ..placement()
        };
        for uv in [DVec2::ZERO, DVec2::ONE, DVec2::new(-0.2, 1.4)] {
            let point = p.uv_to_material(uv).unwrap();
            assert!(p.material_to_uv(point).unwrap().distance(uv) < 1e-12);
        }
    }
}

#[test]
fn rejects_bad_identifiers_degenerate_and_nonfinite_transforms() {
    let mut p = placement();
    for id in ["", "../asset", "https://host", "white space", "é"] {
        p.asset_id = id.into();
        assert!(p.validate().is_err(), "accepted {id:?}");
    }
    for size in [
        DVec2::ZERO,
        DVec2::new(-1., 1.),
        DVec2::splat(f64::NAN),
        DVec2::splat(f64::INFINITY),
        DVec2::splat(1e-12),
        DVec2::splat(1e7),
    ] {
        let p = GraphicPlacement {
            size_m: size,
            ..placement()
        };
        assert!(p.validate().is_err());
        assert!(p.uv_to_material(DVec2::ZERO).is_err());
    }
    assert!(
        GraphicPlacement {
            center_m: DVec2::splat(f64::NAN),
            ..placement()
        }
        .validate()
        .is_err()
    );
    assert!(
        GraphicPlacement {
            rotation_degrees: f64::INFINITY,
            ..placement()
        }
        .validate()
        .is_err()
    );
    assert!(placement().uv_to_material(DVec2::splat(f64::NAN)).is_err());
    assert!(
        placement()
            .material_to_uv(DVec2::splat(f64::INFINITY))
            .is_err()
    );
    assert!(
        GraphicPlacement {
            size_m: DVec2::splat(1e6),
            ..placement()
        }
        .uv_to_material(DVec2::splat(f64::MAX))
        .is_err()
    );
}

#[test]
fn roundtrip_is_data_only_and_rejects_unknown_fields() {
    let p = GraphicPlacement {
        side: GraphicSide::Back,
        ..placement()
    };
    let json = serde_json::to_value(&p).unwrap();
    assert_eq!(json["side"], "back");
    assert_eq!(
        serde_json::from_value::<GraphicPlacement>(json.clone()).unwrap(),
        p
    );
    let mut invalid = json;
    invalid["extra"] = serde_json::json!(true);
    assert!(serde_json::from_value::<GraphicPlacement>(invalid).is_err());
}

#[test]
fn panel_references_are_checked_without_mutating_template() {
    use marvelous_cloth::garment::GarmentTemplate;
    let template = GarmentTemplate::two_panel_demo();
    let before = serde_json::to_vec(&template).unwrap();
    let p = GraphicPlacement {
        panel_id: template.panels[0].id.clone(),
        ..placement()
    };
    p.validate_panel(&template).unwrap();
    let missing = GraphicPlacement {
        panel_id: "removed_panel".into(),
        ..p
    };
    assert!(missing.validate_panel(&template).is_err());
    assert_eq!(before, serde_json::to_vec(&template).unwrap());
}

#[test]
fn extreme_position_and_aspect_ratio_do_not_silently_collapse_uv() {
    let distant_tiny = GraphicPlacement {
        center_m: DVec2::splat(1e6),
        size_m: DVec2::splat(1e-9),
        ..placement()
    };
    assert!(distant_tiny.validate().is_err());
    let thin = GraphicPlacement {
        center_m: DVec2::ZERO,
        size_m: DVec2::new(1e-9, 1e6),
        rotation_degrees: 45.,
        ..placement()
    };
    assert!(thin.validate().is_err());
    let p = GraphicPlacement {
        center_m: DVec2::splat(1e6),
        size_m: DVec2::splat(1e-6),
        rotation_degrees: 45.,
        ..placement()
    };
    let uv = DVec2::new(0.55, 0.9);
    let actual = p.material_to_uv(p.uv_to_material(uv).unwrap()).unwrap();
    assert!(actual.distance(uv) < 0.001, "actual {actual:?}");
}

#[test]
fn triangle_uvs_follow_named_panel_rest_coordinates_and_rebuild_after_remeshing() {
    use marvelous_cloth::garment::GarmentTemplate;
    let mut template = GarmentTemplate::two_panel_demo();
    assert_eq!(template.panels[0].fabric, template.panels[1].fabric);
    let p = GraphicPlacement {
        panel_id: template.panels[0].id.clone(),
        ..placement()
    };
    let garment = template.compile().unwrap();
    let panel = &garment.panels[0];
    let uv = p.triangle_uvs(&garment).unwrap();
    assert_eq!(uv.len(), panel.triangles.len());
    for record in &uv {
        for i in 0..3 {
            let v = record.vertices[i];
            assert!(panel.vertices.contains(&v));
            assert!(
                p.uv_to_material(record.image_uv[i])
                    .unwrap()
                    .distance(garment.mesh.uv[v])
                    < 1e-12
            );
        }
    }
    let other = GraphicPlacement {
        panel_id: template.panels[1].id.clone(),
        ..p.clone()
    };
    let other_uv = other.triangle_uvs(&garment).unwrap();
    assert!(!other_uv.is_empty());
    assert!(other_uv.iter().all(|triangle| {
        triangle
            .vertices
            .iter()
            .all(|v| garment.panels[1].vertices.contains(v))
    }));
    let mut draped = garment.clone();
    for (i, point) in draped.initial_state.x.iter_mut().enumerate() {
        point.z += (i as f64) * 0.001;
    }
    assert_eq!(p.triangle_uvs(&draped).unwrap(), uv);
    template.panels[0].pattern.nx += 1;
    let remeshed = template.compile().unwrap();
    let rebuilt = p.triangle_uvs(&remeshed).unwrap();
    assert_eq!(rebuilt.len(), remeshed.panels[0].triangles.len());
    assert_ne!(rebuilt.len(), uv.len());
    assert!(rebuilt.iter().all(|triangle| {
        triangle
            .vertices
            .iter()
            .all(|v| remeshed.panels[0].vertices.contains(v))
    }));
}

#[test]
fn triangle_uvs_reject_missing_or_malformed_compiled_data() {
    use marvelous_cloth::garment::GarmentTemplate;
    let template = GarmentTemplate::two_panel_demo();
    let garment = template.compile().unwrap();
    let mut p = GraphicPlacement {
        panel_id: template.panels[0].id.clone(),
        ..placement()
    };
    let mut damaged = garment.clone();
    damaged.panels[0].triangles.end = usize::MAX;
    assert!(p.triangle_uvs(&damaged).is_err());
    damaged = garment.clone();
    damaged.mesh.triangles[damaged.panels[0].triangles.start].vertices[0] =
        damaged.panels[1].vertices.start;
    assert!(p.triangle_uvs(&damaged).is_err());
    damaged = garment.clone();
    damaged.mesh.uv.clear();
    assert!(p.triangle_uvs(&damaged).is_err());
    damaged = garment.clone();
    let vertex = damaged.mesh.triangles[damaged.panels[0].triangles.start].vertices[0];
    damaged.mesh.uv[vertex] = DVec2::splat(f64::NAN);
    assert!(p.triangle_uvs(&damaged).is_err());
    p.panel_id = "absent".into();
    assert!(p.triangle_uvs(&garment).is_err());
}
