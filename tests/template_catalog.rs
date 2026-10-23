use marvelous_cloth::{
    fitting::FittingProject,
    garment::presets::GarmentKind,
    template_catalog::{ENTRIES, Selection},
};

#[test]
fn bundled_catalog_has_unique_ids_provenance_and_finite_previews() {
    let mut ids = std::collections::BTreeSet::new();
    for entry in ENTRIES {
        assert!(ids.insert(entry.id));
        assert_eq!(entry.license, "MIT");
        assert!(entry.source.starts_with("ClothCraft / examples/templates/"));
        let selection = Selection::bundled(entry.id).unwrap();
        assert!(selection.panel_count > 0);
        assert!(!selection.preview.is_empty());
        for path in selection.preview {
            assert!(path.points_m.len() >= 2);
            assert!(path.points_m.iter().all(|p| p.is_finite()));
        }
    }
    assert!(Selection::bundled("missing").is_err());
}
#[test]
fn external_templates_are_validated_and_never_inherit_bundled_license() {
    let bytes = include_bytes!("../examples/templates/two-panel.json");
    let selection = Selection::external(bytes, "user-pattern.json".into()).unwrap();
    assert!(selection.license.contains("Unverified"));
    assert_eq!(selection.source, "user-pattern.json");
    assert!(Selection::external(b"{}", "broken".into()).is_err());
    let mut invalid: serde_json::Value = serde_json::from_slice(bytes).unwrap();
    invalid["panels"][0]["pattern"]["width"] = serde_json::json!(-1);
    assert!(Selection::external(&serde_json::to_vec(&invalid).unwrap(), "broken".into()).is_err());
}
#[test]
fn preparation_preserves_avatar_and_settings_but_discards_old_state() {
    let directory = tempfile::tempdir().unwrap();
    let avatar = directory.path().join("avatar.obj");
    std::fs::write(&avatar, "v 0 0 -10\nv 1 0 -10\nv 0 1 -10\nf 1 2 3\n").unwrap();
    let mut current = FittingProject::basic(GarmentKind::Dress, 1, avatar.clone());
    current.state = Some(current.compile().unwrap().state);
    current.mesh_signature = Some("deliberately-stale".into());
    current.prearrange = true;
    let before = serde_json::to_vec(&current).unwrap();
    let candidate = Selection::bundled("two-panel")
        .unwrap()
        .prepare(&current)
        .unwrap();
    assert_eq!(candidate.project.avatar_path, avatar);
    assert_eq!(
        candidate.project.contact_stiffness,
        current.contact_stiffness
    );
    assert_eq!(
        serde_json::to_value(&candidate.project.solver).unwrap(),
        serde_json::to_value(&current.solver).unwrap()
    );
    assert!(candidate.project.state.is_none());
    assert!(candidate.project.mesh_signature.is_none());
    assert!(!candidate.project.prearrange);
    assert_eq!(before, serde_json::to_vec(&current).unwrap());
    current.avatar_path = directory.path().join("missing.obj");
    let before = serde_json::to_vec(&current).unwrap();
    assert!(
        Selection::bundled("two-panel")
            .unwrap()
            .prepare(&current)
            .is_err()
    );
    assert_eq!(before, serde_json::to_vec(&current).unwrap());
}

#[test]
fn candidate_uses_live_simulation_settings_and_rejects_invalid_ones() {
    let directory = tempfile::tempdir().unwrap();
    let avatar = directory.path().join("avatar.obj");
    std::fs::write(&avatar, "v 0 0 -10\nv 1 0 -10\nv 0 1 -10\nf 1 2 3\n").unwrap();
    let current = FittingProject::basic(GarmentKind::Dress, 1, avatar);
    let selection = Selection::bundled("two-panel").unwrap();
    let mut settings = marvelous_cloth::vbd::VbdSettings {
        iterations: 7,
        ..Default::default()
    };
    let candidate = selection
        .prepare_with_simulation(&current, Some(settings.clone()))
        .unwrap();
    assert_eq!(candidate.project.simulation.as_ref().unwrap().iterations, 7);
    assert!(current.simulation.is_none());
    settings.dt = f64::NAN;
    assert!(
        selection
            .prepare_with_simulation(&current, Some(settings))
            .is_err()
    );
}
