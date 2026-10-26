use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        GarmentTemplate,
        appearance::{self, FabricAppearance},
    },
};

#[test]
fn optics_are_validated_and_do_not_change_mechanics_or_legacy_bytes() {
    let source = GarmentTemplate::two_panel_demo();
    let old = serde_json::to_value(&source).unwrap();
    assert!(old.get("fabric_appearance").is_none());
    let g = source.compile().unwrap();
    let optics = FabricAppearance {
        color_srgb: [255, 0, 128],
        roughness: 0.3,
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
        vec![Some(optics); g.materials.len()]
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
    before
        .template
        .fabric_appearance
        .insert(before.template.fabrics[0].id.clone(), Default::default());
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
