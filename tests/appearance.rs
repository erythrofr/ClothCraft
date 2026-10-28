use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        GarmentTemplate,
        appearance::{self, FabricAppearance},
    },
};

#[test]
#[ignore = "opt-in CPU texture validation microbenchmark"]
fn benchmark_texture_validation_cpu() {
    use marvelous_cloth::garment::appearance::AlbedoTexture;
    let map = AlbedoTexture {
        width: 256,
        height: 256,
        rgba_srgb: vec![255; 256 * 256 * 4].into(),
        tile_m: [0.1, 0.1],
        rotation_degrees: 0.,
    };
    let start = std::time::Instant::now();
    for _ in 0..100 {
        for _ in 0..16 {
            std::hint::black_box(&map).validate().unwrap();
        }
    }
    eprintln!(
        "texture validation: 16 full 256x256 images, 100 rounds: {:?}",
        start.elapsed()
    );
    let cached = map.clone();
    let start = std::time::Instant::now();
    for _ in 0..100 {
        for _ in 0..16 {
            assert!(std::sync::Arc::ptr_eq(
                &std::hint::black_box(&map).rgba_srgb,
                &cached.rgba_srgb,
            ));
        }
    }
    eprintln!(
        "shared pixel identity check only, same loop: {:?}",
        start.elapsed()
    );
}

#[test]
fn optics_are_validated_and_do_not_change_mechanics_or_legacy_bytes() {
    let source = GarmentTemplate::two_panel_demo();
    let old = serde_json::to_value(&source).unwrap();
    assert!(old.get("fabric_appearance").is_none());
    let g = source.compile().unwrap();
    let optics = FabricAppearance {
        color_srgb: [255, 0, 128],
        roughness: 0.3,
        albedo: None,
    };
    let edit = authoring::apply(
        &source,
        Command::FabricAppearance {
            fabric: source.fabrics[0].id.clone(),
            appearance: Some(optics.clone()),
        },
    )
    .unwrap();
    assert!(!edit.reset_simulation);
    assert!(authoring::only_appearance_changed(&source, &edit.template));
    assert_eq!(edit.garment.mesh.uv, g.mesh.uv);
    assert_eq!(edit.garment.mesh.masses, g.mesh.masses);
    assert_eq!(edit.garment.initial_state.x, g.initial_state.x);
    assert_eq!(
        appearance::bind(&edit.template, &g),
        vec![Some(&optics); g.materials.len()]
    );
    for roughness in [f64::NAN, -0.1, 1.1] {
        assert!(
            authoring::apply(
                &source,
                Command::FabricAppearance {
                    fabric: source.fabrics[0].id.clone(),
                    appearance: Some(FabricAppearance {
                        roughness,
                        ..Default::default()
                    })
                }
            )
            .is_err()
        );
    }
    assert_eq!(serde_json::to_value(&source).unwrap(), old);
    let reset = authoring::apply(
        &edit.template,
        Command::FabricAppearance {
            fabric: source.fabrics[0].id.clone(),
            appearance: None,
        },
    )
    .unwrap();
    assert_eq!(serde_json::to_value(reset.template).unwrap(), old);
    let color = FabricAppearance {
        color_srgb: [0, 255, 128],
        ..Default::default()
    }
    .linear_color();
    assert_eq!(color[0], 0.);
    assert_eq!(color[1], 1.);
    assert!((color[2] - 0.21586).abs() < 0.00001);
}

#[test]
fn embedded_albedo_roundtrips_and_preserves_physics() {
    use marvelous_cloth::garment::appearance::AlbedoTexture;
    let source = GarmentTemplate::two_panel_demo();
    let texture = AlbedoTexture {
        width: 2,
        height: 1,
        rgba_srgb: vec![255, 0, 0, 255, 0, 128, 255, 255].into(),
        tile_m: [0.1, 0.2],
        rotation_degrees: 45.,
    };
    let mut copied = texture.clone();
    assert!(std::sync::Arc::ptr_eq(
        &texture.rgba_srgb,
        &copied.rgba_srgb
    ));
    std::sync::Arc::make_mut(&mut copied.rgba_srgb)[3] = 0;
    assert!(!std::sync::Arc::ptr_eq(
        &texture.rgba_srgb,
        &copied.rgba_srgb
    ));
    assert!(copied.validate().is_err());
    assert!(texture.validate().is_ok());
    let mapped = texture.material_uv(glam::DVec2::new(0.1, 0.));
    assert!((mapped.x - 2f64.sqrt() * 0.5).abs() < 1e-12);
    assert!((mapped.y - 2f64.sqrt() * 0.25).abs() < 1e-12);
    let optics = FabricAppearance {
        albedo: Some(texture.clone()),
        ..Default::default()
    };
    let edit = authoring::apply(
        &source,
        Command::FabricAppearance {
            fabric: source.fabrics[0].id.clone(),
            appearance: Some(optics.clone()),
        },
    )
    .unwrap();
    assert!(!edit.reset_simulation);
    assert!(authoring::only_appearance_changed(&source, &edit.template));
    let json = serde_json::to_string(&edit.template).unwrap();
    let loaded: GarmentTemplate = serde_json::from_str(&json).unwrap();
    assert_eq!(loaded.fabric_appearance[&source.fabrics[0].id], optics);
    assert!(loaded.compile().is_ok());
    for invalid in [
        AlbedoTexture {
            width: 0,
            ..texture.clone()
        },
        AlbedoTexture {
            width: 257,
            ..texture.clone()
        },
        AlbedoTexture {
            rgba_srgb: vec![0; 7].into(),
            ..texture.clone()
        },
        AlbedoTexture {
            rgba_srgb: vec![0; 8].into(),
            ..texture.clone()
        },
        AlbedoTexture {
            tile_m: [0., 1.],
            ..texture.clone()
        },
        AlbedoTexture {
            rotation_degrees: f64::NAN,
            ..texture.clone()
        },
    ] {
        assert!(invalid.validate().is_err());
    }
    let mut over_limit = source.clone();
    for i in 0..17 {
        let mut fabric = source.fabrics[0].clone();
        fabric.id = format!("textured_{i}");
        over_limit
            .fabric_appearance
            .insert(fabric.id.clone(), optics.clone());
        over_limit.fabrics.push(fabric);
    }
    assert!(over_limit.compile().is_err());
}

#[test]
fn oversized_embedded_pixel_array_is_rejected_during_deserialization() {
    use marvelous_cloth::garment::appearance::AlbedoTexture;
    let maximum = AlbedoTexture::MAX_DIMENSION as usize * AlbedoTexture::MAX_DIMENSION as usize * 4;
    let valid = AlbedoTexture {
        width: AlbedoTexture::MAX_DIMENSION,
        height: AlbedoTexture::MAX_DIMENSION,
        rgba_srgb: vec![255; maximum].into(),
        tile_m: [0.1, 0.1],
        rotation_degrees: 0.,
    };
    let encoded = serde_json::to_string(&valid).unwrap();
    let decoded: AlbedoTexture = serde_json::from_str(&encoded).unwrap();
    decoded.validate().unwrap();
    let oversized = format!(
        "{{\"width\":1,\"height\":1,\"rgba_srgb\":[{}0],\"tile_m\":[0.1,0.1],\"rotation_degrees\":0}}",
        "0,".repeat(maximum)
    );
    assert!(serde_json::from_str::<AlbedoTexture>(&oversized).is_err());
}

#[test]
fn compact_pixels_roundtrip_legacy_arrays_and_reject_bad_base64() {
    use marvelous_cloth::garment::appearance::AlbedoTexture;
    let make_json = |pixels: serde_json::Value| {
        serde_json::json!({
            "width": 1, "height": 1, "rgba_srgb": pixels,
            "tile_m": [0.1, 0.1], "rotation_degrees": 0.0
        })
    };
    let legacy: AlbedoTexture =
        serde_json::from_value(make_json(serde_json::json!([1, 2, 3, 255]))).unwrap();
    legacy.validate().unwrap();
    let compact = serde_json::to_value(&legacy).unwrap();
    assert_eq!(compact["rgba_srgb"], "AQID/w==");
    assert_eq!(
        serde_json::from_value::<AlbedoTexture>(compact).unwrap(),
        legacy
    );
    for (input, expected) in [
        ("", ""),
        ("f", "Zg=="),
        ("fo", "Zm8="),
        ("foo", "Zm9v"),
        ("foob", "Zm9vYg=="),
        ("fooba", "Zm9vYmE="),
        ("foobar", "Zm9vYmFy"),
    ] {
        let mut texture = legacy.clone();
        texture.rgba_srgb = input.as_bytes().into();
        let encoded = serde_json::to_value(&texture).unwrap();
        assert_eq!(encoded["rgba_srgb"], expected);
        assert_eq!(
            serde_json::from_value::<AlbedoTexture>(encoded)
                .unwrap()
                .rgba_srgb
                .as_ref(),
            input.as_bytes()
        );
    }
    for length in 0..=256 {
        let mut texture = legacy.clone();
        texture.rgba_srgb = (0..length).map(|i| i as u8).collect::<Vec<_>>().into();
        let encoded = serde_json::to_string(&texture).unwrap();
        let decoded: AlbedoTexture = serde_json::from_str(&encoded).unwrap();
        assert_eq!(decoded.rgba_srgb, texture.rgba_srgb);
    }
    for invalid in [
        "A", "A===", "A=AA", "AB==", "AAB=", "AA==AAAA", "AAAA====", "A?AA",
    ] {
        assert!(
            serde_json::from_value::<AlbedoTexture>(make_json(invalid.into())).is_err(),
            "accepted {invalid}"
        );
    }
    let too_large = "A".repeat(
        (AlbedoTexture::MAX_DIMENSION as usize * AlbedoTexture::MAX_DIMENSION as usize * 4)
            .div_ceil(3)
            * 4
            + 4,
    );
    assert!(serde_json::from_value::<AlbedoTexture>(make_json(too_large.into())).is_err());
}

#[test]
fn cached_drape_reopens_after_appearance_change_with_identical_signature() {
    use marvelous_cloth::{fitting::FittingProject, garment::presets::GarmentKind};
    let dir = tempfile::tempdir().unwrap();
    let avatar = dir.path().join("avatar.obj");
    std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
    let file = dir.path().join("garment.clothcraft");
    let mut p = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
    p.template = GarmentTemplate::two_panel_demo();
    let mut state = p.template.compile().unwrap().initial_state;
    state.time = 3.;
    state.v.fill(glam::DVec3::X);
    p.state = Some(state.clone());
    p.save(&file).unwrap();
    let mut before = FittingProject::load(&file).unwrap();
    let signature = before.mesh_signature.clone();
    let textured = FabricAppearance {
        albedo: Some(appearance::AlbedoTexture {
            width: 1,
            height: 1,
            rgba_srgb: vec![120, 140, 160, 255].into(),
            tile_m: [0.2, 0.15],
            rotation_degrees: 30.,
        }),
        ..Default::default()
    };
    before
        .template
        .fabric_appearance
        .insert(before.template.fabrics[0].id.clone(), textured);
    let scene = before.compile().unwrap();
    assert_eq!(scene.state.x, state.x);
    assert_eq!(scene.state.v, state.v);
    assert_eq!(scene.state.time, state.time);
    before.save(&file).unwrap();
    let reopened = FittingProject::load(&file).unwrap();
    assert_eq!(reopened.mesh_signature, signature);
    assert_eq!(
        reopened.template.fabric_appearance,
        before.template.fabric_appearance
    );
}

#[test]
fn clipboard_keeps_optical_identity_and_material_split_inherits_it() {
    use marvelous_cloth::authoring::clipboard::PatternClipboard;
    let source = GarmentTemplate::two_panel_demo();
    let id = source.fabrics[0].id.clone();
    let colored = authoring::apply(
        &source,
        Command::FabricAppearance {
            fabric: id.clone(),
            appearance: Some(FabricAppearance {
                color_srgb: [220, 30, 60],
                roughness: 0.4,
                albedo: Some(appearance::AlbedoTexture {
                    width: 1,
                    height: 1,
                    rgba_srgb: vec![4, 5, 6, 255].into(),
                    tile_m: [0.1, 0.2],
                    rotation_degrees: 30.,
                }),
            }),
        },
    )
    .unwrap()
    .template;
    let clip = PatternClipboard::capture(&colored, &[colored.panels[0].id.clone()]).unwrap();
    let clip = PatternClipboard::from_text(&clip.to_text().unwrap()).unwrap();
    let pasted = authoring::apply(
        &source,
        Command::Paste {
            clipboard: clip,
            center: glam::DVec2::new(2., 0.),
        },
    )
    .unwrap();
    let copy = pasted.template.panels.last().unwrap();
    assert_ne!(
        copy.fabric, id,
        "equal mechanics/name must not merge distinct optics"
    );
    assert_eq!(
        pasted.template.fabric_appearance.get(&copy.fabric),
        colored.fabric_appearance.get(&id)
    );
    assert!(!pasted.template.fabric_appearance.contains_key(&id));
    let edited = authoring::apply(
        &colored,
        Command::Fabric {
            panel: colored.panels[0].id.clone(),
            name: "Custom mechanical fabric".into(),
            properties: colored.fabrics[0].properties.clone(),
            all_panels: false,
        },
    )
    .unwrap();
    let split = &edited.template.panels[0].fabric;
    assert_ne!(split, &id);
    assert_eq!(
        edited.template.fabric_appearance.get(split),
        colored.fabric_appearance.get(&id)
    );
    let clip = PatternClipboard::capture(&edited.template, &[edited.template.panels[1].id.clone()])
        .unwrap();
    let text: serde_json::Value = serde_json::from_str(&clip.to_text().unwrap()).unwrap();
    assert!(text["template"]["fabric_appearance"].get(split).is_none());
}

#[test]
fn two_textured_panels_fit_clipboard_and_preserve_pixels() {
    use marvelous_cloth::authoring::{Command, clipboard::PatternClipboard};
    let mut template = GarmentTemplate::two_panel_demo();
    let mut other = template.fabrics[0].clone();
    other.id = "another_texture".into();
    template.panels[1].fabric = other.id.clone();
    template.fabrics.push(other);
    let optics = FabricAppearance {
        albedo: Some(appearance::AlbedoTexture {
            width: 256,
            height: 256,
            rgba_srgb: vec![255; 256 * 256 * 4].into(),
            tile_m: [0.1, 0.1],
            rotation_degrees: 0.,
        }),
        ..Default::default()
    };
    for fabric in &template.fabrics {
        template
            .fabric_appearance
            .insert(fabric.id.clone(), optics.clone());
    }
    let ids: Vec<_> = template.panels.iter().map(|p| p.id.clone()).collect();
    let clipboard = PatternClipboard::capture(&template, &ids).unwrap();
    let text = clipboard.to_text().unwrap();
    assert!(text.len() < 2 * 1024 * 1024);
    let decoded = PatternClipboard::from_text(&text).unwrap();
    let result = authoring::apply(
        &template,
        Command::Paste {
            clipboard: decoded,
            center: glam::DVec2::ZERO,
        },
    )
    .unwrap();
    assert_eq!(result.template.panels.len(), template.panels.len() + 2);
    for panel in &result.template.panels[template.panels.len()..] {
        assert_eq!(result.template.fabric_appearance[&panel.fabric], optics);
    }
    assert_eq!(template.fabric_appearance.len(), template.fabrics.len());
    assert!(
        template
            .fabric_appearance
            .values()
            .all(|a| a.albedo.is_some())
    );
}

#[test]
fn compact_texture_clipboard_still_rejects_overall_size_limit() {
    use marvelous_cloth::authoring::clipboard::PatternClipboard;
    let mut template = GarmentTemplate::two_panel_demo();
    let source_panel = template.panels[0].clone();
    let source_fabric = template.fabrics[0].clone();
    template.panels.clear();
    template.fabrics.clear();
    template.seams.clear();
    let optics = FabricAppearance {
        albedo: Some(appearance::AlbedoTexture {
            width: 256,
            height: 256,
            rgba_srgb: vec![255; 256 * 256 * 4].into(),
            tile_m: [0.1, 0.1],
            rotation_degrees: 0.,
        }),
        ..Default::default()
    };
    for i in 0..6 {
        let mut fabric = source_fabric.clone();
        fabric.id = format!("fabric_{i}");
        let mut panel = source_panel.clone();
        panel.id = format!("panel_{i}");
        panel.fabric = fabric.id.clone();
        template
            .fabric_appearance
            .insert(fabric.id.clone(), optics.clone());
        template.fabrics.push(fabric);
        template.panels.push(panel);
    }
    let ids: Vec<_> = template.panels.iter().map(|p| p.id.clone()).collect();
    let clip = PatternClipboard::capture(&template, &ids).unwrap();
    assert!(clip.to_text().is_err());
    assert_eq!(template.fabric_appearance.len(), 6);
}
