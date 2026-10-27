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
fn persistent_placements_validate_and_keep_legacy_and_physics() {
    use marvelous_cloth::{
        authoring::{self, Command},
        garment::GarmentTemplate,
    };
    let source = GarmentTemplate::two_panel_demo();
    let legacy = serde_json::to_value(&source).unwrap();
    assert!(legacy.get("graphics").is_none());
    let graphic = GraphicPlacement {
        panel_id: source.panels[0].id.clone(),
        ..placement()
    };
    let edit = authoring::apply(
        &source,
        Command::SetGraphic {
            placement: graphic.clone(),
        },
    )
    .unwrap();
    assert!(!edit.reset_simulation);
    assert!(authoring::same_physics(&source, &edit.template));
    assert!(authoring::only_appearance_changed(&source, &edit.template));
    let encoded = serde_json::to_string(&edit.template).unwrap();
    let restored: GarmentTemplate = serde_json::from_str(&encoded).unwrap();
    restored.compile().unwrap();
    assert_eq!(restored.graphics, vec![graphic.clone()]);
    let before = serde_json::to_vec(&restored).unwrap();
    let unchanged = authoring::apply(
        &restored,
        Command::SetGraphic {
            placement: graphic.clone(),
        },
    );
    assert_eq!(
        unchanged.err().as_deref(),
        Some("Graphic placement is unchanged")
    );
    assert_eq!(serde_json::to_vec(&restored).unwrap(), before);
    let mut moved = graphic.clone();
    moved.center_m.x += 0.01;
    let changed = authoring::apply(
        &restored,
        Command::SetGraphic {
            placement: moved.clone(),
        },
    )
    .unwrap();
    assert!(!changed.reset_simulation);
    assert!(authoring::only_appearance_changed(
        &restored,
        &changed.template
    ));
    assert_eq!(changed.template.graphics, vec![moved]);
    let mut invalid = restored.clone();
    invalid.graphics.push(graphic.clone());
    assert!(invalid.compile().is_err());
    invalid.graphics[1].id = "other".into();
    invalid.graphics[1].panel_id = "missing".into();
    assert!(invalid.compile().is_err());
    let removed = authoring::apply(&restored, Command::RemoveGraphic { id: graphic.id }).unwrap();
    assert_eq!(serde_json::to_value(removed.template).unwrap(), legacy);
}

#[test]
fn saved_drape_reopens_after_graphic_metadata_change() {
    use marvelous_cloth::{
        fitting::FittingProject,
        garment::{GarmentTemplate, presets::GarmentKind},
    };
    let dir = tempfile::tempdir().unwrap();
    let avatar = dir.path().join("avatar.obj");
    std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
    let file = dir.path().join("garment.clothcraft");
    let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
    project.template = GarmentTemplate::two_panel_demo();
    let mut state = project.template.compile().unwrap().initial_state;
    state.time = 3.;
    state.v.fill(glam::DVec3::X);
    project.state = Some(state.clone());
    project.save(&file).unwrap();
    let mut loaded = FittingProject::load(&file).unwrap();
    let signature = loaded.mesh_signature.clone();
    loaded.template.graphics.push(GraphicPlacement {
        panel_id: loaded.template.panels[0].id.clone(),
        ..placement()
    });
    let scene = loaded.compile().unwrap();
    assert_eq!(scene.state.x, state.x);
    assert_eq!(scene.state.v, state.v);
    assert_eq!(scene.state.time, state.time);
    loaded.save(&file).unwrap();
    let mut reopened = FittingProject::load(&file).unwrap();
    assert_eq!(reopened.mesh_signature, signature);
    assert_eq!(reopened.template.graphics, loaded.template.graphics);
    let original_uv = reopened.template.graphics[0]
        .triangle_uvs(&scene.garment)
        .unwrap();
    // Swap the resolution so the vertex count stays the same; a length-only
    // check would wrongly accept this stale drape on different material points.
    reopened.template.panels[0].pattern.nx = 4;
    reopened.template.panels[0].pattern.ny = 3;
    let error = reopened.compile().err().unwrap();
    assert!(error.contains("Stale fitting cache"));
    assert_eq!(reopened.state.as_ref().unwrap().x, state.x);
    reopened.state = None;
    reopened.mesh_signature = None;
    let rebuilt = reopened.compile().unwrap();
    assert_eq!(rebuilt.state.x.len(), state.x.len());
    let new_uv = reopened.template.graphics[0]
        .triangle_uvs(&rebuilt.garment)
        .unwrap();
    assert_ne!(new_uv, original_uv);
    assert_eq!(reopened.template.graphics, loaded.template.graphics);
}

#[test]
fn copy_paste_and_delete_preserve_graphic_identity_and_ownership() {
    use marvelous_cloth::{
        authoring::{self, Command, clipboard::PatternClipboard},
        garment::GarmentTemplate,
    };
    let source = GarmentTemplate::two_panel_demo();
    let graphic = GraphicPlacement {
        panel_id: source.panels[0].id.clone(),
        ..placement()
    };
    let source = authoring::apply(
        &source,
        Command::SetGraphic {
            placement: graphic.clone(),
        },
    )
    .unwrap()
    .template;
    let duplicate = authoring::apply(
        &source,
        Command::Duplicate {
            panel: graphic.panel_id.clone(),
        },
    )
    .unwrap();
    assert_eq!(duplicate.template.graphics.len(), 2);
    assert_ne!(
        duplicate.template.graphics[0].id,
        duplicate.template.graphics[1].id
    );
    assert_eq!(
        duplicate.template.graphics[1].panel_id,
        duplicate.selected.unwrap()
    );
    let clip = PatternClipboard::capture(&source, std::slice::from_ref(&graphic.panel_id)).unwrap();
    let clip = PatternClipboard::from_text(&clip.to_text().unwrap()).unwrap();
    let pasted = authoring::apply(
        &source,
        Command::Paste {
            clipboard: clip,
            center: DVec2::ZERO,
        },
    )
    .unwrap();
    assert_eq!(pasted.template.graphics.len(), 2);
    assert_ne!(
        pasted.template.graphics[0].id,
        pasted.template.graphics[1].id
    );
    assert_eq!(
        pasted.template.graphics[1].panel_id,
        pasted.selected.unwrap()
    );
    let deleted = authoring::apply(
        &source,
        Command::RemovePanel {
            panel: graphic.panel_id,
        },
    )
    .unwrap();
    assert!(deleted.template.graphics.is_empty());
}

#[test]
fn material_frame_changes_and_mirror_fail_atomically_but_remeshing_is_valid() {
    use marvelous_cloth::{
        authoring::{self, Command},
        garment::{
            GarmentTemplate,
            shapes::{MirrorAxis, Primitive, primitive},
        },
    };
    let mut source = GarmentTemplate::two_panel_demo();
    source.version = 2;
    source.panels[0].polygon = Some(
        primitive(
            Primitive::Rectangle,
            DVec2::splat(0.4),
            90.,
            Default::default(),
        )
        .unwrap(),
    );
    source.panels[0].pattern.height = 0.4;
    source.panels[0].pins.clear();
    source.seams.clear();
    assert!(
        authoring::apply(
            &source,
            Command::Dimensions {
                panel: source.panels[0].id.clone(),
                width: 0.5,
                height: 0.5
            }
        )
        .is_ok()
    );
    let graphic = GraphicPlacement {
        panel_id: source.panels[0].id.clone(),
        ..placement()
    };
    let source = authoring::apply(
        &source,
        Command::SetGraphic {
            placement: graphic.clone(),
        },
    )
    .unwrap()
    .template;
    let before = serde_json::to_vec(&source).unwrap();
    assert!(
        authoring::apply(
            &source,
            Command::Mirror {
                panel: graphic.panel_id.clone(),
                axis: MirrorAxis::X,
                copy_side: Some(1)
            }
        )
        .is_err()
    );
    assert!(
        authoring::apply(
            &source,
            Command::Primitive {
                kind: Primitive::Rectangle,
                size: DVec2::splat(0.4),
                sweep_degrees: 90.,
                origin: DVec2::ZERO,
                meshing: Default::default(),
                fabric: source.fabrics[0].id.clone(),
                replace: true,
            }
        )
        .err()
        .unwrap()
        .contains("Remove graphics before replacing the garment")
    );
    assert!(
        authoring::apply(
            &source,
            Command::Dimensions {
                panel: graphic.panel_id.clone(),
                width: 0.5,
                height: 0.5
            }
        )
        .err()
        .unwrap()
        .contains("Remove graphics before changing")
    );
    assert_eq!(serde_json::to_vec(&source).unwrap(), before);
    let mut remeshed = source.clone();
    remeshed.panels[0]
        .polygon
        .as_mut()
        .unwrap()
        .meshing
        .as_mut()
        .unwrap()
        .target_edge_m = 0.04;
    let via_edit = authoring::apply(
        &source,
        Command::Shape {
            panel: graphic.panel_id.clone(),
            polygon: remeshed.panels[0].polygon.clone().unwrap(),
        },
    )
    .unwrap();
    assert_eq!(via_edit.template.graphics, source.graphics);
    let mesh = remeshed.compile().unwrap();
    assert_ne!(
        mesh.panels[0].vertices.len(),
        source.compile().unwrap().panels[0].vertices.len()
    );
    assert_eq!(remeshed.graphics, source.graphics);
    assert!(!graphic.triangle_uvs(&mesh).unwrap().is_empty());
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

#[test]
fn triangle_uv_conversion_preserves_detail_before_f32_cast() {
    use marvelous_cloth::garment::GarmentTemplate;
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels.truncate(1);
    template.seams.clear();
    template.panels[0].pattern.width = 100.;
    template.panels[0].pattern.nx = 1;
    template.panels[0].pattern.ny = 1;
    let garment = template.compile().unwrap();
    let graphic = GraphicPlacement {
        panel_id: template.panels[0].id.clone(),
        center_m: DVec2::new(99.999995, 0.),
        size_m: DVec2::new(0.001, 1.),
        rotation_degrees: 0.,
        ..placement()
    };
    let triangles = graphic.triangle_uvs(&garment).unwrap();
    let mut measured = None;
    for triangle in triangles {
        for (index, image_uv) in triangle.vertices.into_iter().zip(triangle.image_uv) {
            if garment.mesh.uv[index].x == 100. {
                measured = Some(image_uv.x as f32);
                break;
            }
        }
    }
    let actual = measured.expect("compiled panel has a 100 m corner");
    let expected = 0.505_f32;
    // Emulates an alternative upload that casts the absolute material
    // coordinate and center to f32 before computing image coordinates.
    let premature = (100_f32 - graphic.center_m.x as f32) / graphic.size_m.x as f32 + 0.5;
    assert!((actual - expected).abs() < 1e-6);
    assert!((premature - expected).abs() > 0.002);
}
