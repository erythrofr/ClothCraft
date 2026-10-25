use glam::DVec3;
use marvelous_cloth::{
    avatar_import::Candidate, fitting::FittingProject, garment::presets::GarmentKind,
    vbd::VbdSettings,
};

fn project(dir: &std::path::Path) -> FittingProject {
    let path = dir.join("old.obj");
    std::fs::write(&path, "v 0 0 -10\nv 1 0 -10\nv 0 1 -10\nf 1 2 3\n").unwrap();
    FittingProject::basic(GarmentKind::Dress, 1, path)
}
fn transformed_gltf(dir: &std::path::Path) -> std::path::PathBuf {
    let mut bytes = Vec::new();
    for p in [[0f32, 0., 0.], [1., 0., 0.], [0., 1., 0.]] {
        for value in p {
            bytes.extend(value.to_le_bytes());
        }
    }
    std::fs::write(dir.join("mesh.bin"), bytes).unwrap();
    let doc = serde_json::json!({
        "asset":{"version":"2.0"}, "scene":0, "scenes":[{"nodes":[0]}],
        "nodes":[{"mesh":0,"translation":[5,6,7],"scale":[-2,3,4]}],
        "meshes":[{"primitives":[{"attributes":{"POSITION":0}}]}],
        "buffers":[{"byteLength":36,"uri":"mesh.bin"}],
        "bufferViews":[{"buffer":0,"byteLength":36}],
        "accessors":[{"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":[0,0,0],"max":[1,1,0]}]
    });
    let path = dir.join("new avatar.gltf");
    std::fs::write(&path, serde_json::to_vec(&doc).unwrap()).unwrap();
    path
}
#[test]
fn transformed_geometry_survives_staging_cleanup_and_portable_reload() {
    let dir = tempfile::tempdir().unwrap();
    let current = project(dir.path());
    let source = transformed_gltf(dir.path());
    let source_bytes = std::fs::read(&source).unwrap();
    let candidate = Candidate::load(&source).unwrap();
    assert_eq!(
        candidate.bounds,
        [DVec3::new(3., 6., 7.), DVec3::new(5., 9., 7.)]
    );
    assert_eq!((candidate.vertices, candidate.triangles), (3, 1));
    assert!(!candidate.warnings.is_empty());
    let prepared = candidate.prepare(&current, VbdSettings::default()).unwrap();
    let (imported, scene, lifetime) = prepared.into_parts();
    let expected = vec![
        DVec3::new(5., 6., 7.),
        DVec3::new(3., 6., 7.),
        DVec3::new(5., 9., 7.),
    ];
    assert_eq!(scene.collider.surface.vertices, expected);
    assert_eq!(scene.collider.surface.triangles, vec![[0, 2, 1]]);
    let staged = imported.avatar_path.clone();
    drop(candidate);
    assert!(staged.exists());
    let saved = dir.path().join("saved dress.clothcraft.json");
    imported.save(&saved).unwrap();
    drop(lifetime);
    assert!(!staged.exists());
    let restored = FittingProject::load(&saved).unwrap();
    assert_ne!(restored.avatar_path, staged);
    let scene = restored.compile().unwrap();
    assert_eq!(scene.collider.surface.vertices, expected);
    assert_eq!(scene.collider.surface.triangles, vec![[0, 2, 1]]);
    assert_eq!(std::fs::read(source).unwrap(), source_bytes);
}
#[test]
fn replacement_resets_motion_not_authored_geometry_and_preserves_live_settings() {
    let dir = tempfile::tempdir().unwrap();
    let mut current = project(dir.path());
    current.state = Some(current.compile().unwrap().state);
    current.mesh_signature = Some("old cache".into());
    current.state.as_mut().unwrap().time = 50.;
    current.prearrange = true;
    let before = serde_json::to_vec(&current).unwrap();
    let candidate = Candidate::load(&current.avatar_path).unwrap();
    let settings = VbdSettings {
        iterations: 7,
        ..Default::default()
    };
    let (next, scene, _asset) = candidate
        .prepare(&current, settings.clone())
        .unwrap()
        .into_parts();
    assert_eq!(serde_json::to_vec(&current).unwrap(), before);
    assert_eq!(
        serde_json::to_value(&next.template).unwrap(),
        serde_json::to_value(&current.template).unwrap()
    );
    assert_eq!(next.simulation, Some(settings));
    assert!(next.state.is_none() && next.mesh_signature.is_none());
    assert!(!next.prearrange);
    assert_eq!(scene.state.time, scene.garment.initial_state.time);
    assert_eq!(scene.state.x, scene.garment.initial_state.x);
    assert_eq!(scene.state.v, scene.garment.initial_state.v);
}
#[test]
fn preparation_failure_and_cancel_do_not_change_document_or_source() {
    let dir = tempfile::tempdir().unwrap();
    let current = project(dir.path());
    let before = serde_json::to_vec(&current).unwrap();
    let source_bytes = std::fs::read(&current.avatar_path).unwrap();
    let candidate = Candidate::load(&current.avatar_path).unwrap();
    let settings = VbdSettings {
        dt: f64::NAN,
        ..Default::default()
    };
    assert!(candidate.prepare(&current, settings).is_err());
    drop(candidate);
    assert_eq!(serde_json::to_vec(&current).unwrap(), before);
    assert_eq!(std::fs::read(&current.avatar_path).unwrap(), source_bytes);
    assert!(current.compile().is_ok());
    let invalid = dir.path().join("invalid.obj");
    std::fs::write(&invalid, "v NaN 0 0\nf 1 1 1").unwrap();
    assert!(Candidate::load(&invalid).is_err());
    std::fs::write(&invalid, "v -1e308 0 0\nv 1e308 0 0\nv 0 1e308 0\nf 1 2 3").unwrap();
    assert!(Candidate::load(&invalid).is_err());
    assert!(Candidate::load(&dir.path().join("missing.obj")).is_err());
    assert!(Candidate::load(&dir.path().join("mesh.fbx")).is_err());
}
#[test]
fn ambiguous_gltf_is_rejected_instead_of_choosing_first_scene() {
    let dir = tempfile::tempdir().unwrap();
    let path = transformed_gltf(dir.path());
    let mut doc: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    doc.as_object_mut().unwrap().remove("scene");
    doc["scenes"] = serde_json::json!([{"nodes":[0]}, {"nodes":[0]}]);
    std::fs::write(&path, serde_json::to_vec(&doc).unwrap()).unwrap();
    assert!(Candidate::load(&path).unwrap_err().contains("scene"));
}

#[test]
fn glb_uses_the_same_static_import_and_staging_path() {
    let dir = tempfile::tempdir().unwrap();
    let source = transformed_gltf(dir.path());
    let mut doc: serde_json::Value =
        serde_json::from_slice(&std::fs::read(source).unwrap()).unwrap();
    doc["buffers"][0].as_object_mut().unwrap().remove("uri");
    let mut json = serde_json::to_vec(&doc).unwrap();
    while !json.len().is_multiple_of(4) {
        json.push(b' ');
    }
    let bin = std::fs::read(dir.path().join("mesh.bin")).unwrap();
    let mut bytes = b"glTF".to_vec();
    bytes.extend(2u32.to_le_bytes());
    bytes.extend(((28 + json.len() + bin.len()) as u32).to_le_bytes());
    bytes.extend((json.len() as u32).to_le_bytes());
    bytes.extend(0x4e4f534au32.to_le_bytes());
    bytes.extend(json);
    bytes.extend((bin.len() as u32).to_le_bytes());
    bytes.extend(0x004e4942u32.to_le_bytes());
    bytes.extend(bin);
    let path = dir.path().join("avatar.glb");
    std::fs::write(&path, &bytes).unwrap();
    let candidate = Candidate::load(&path).unwrap();
    let current = project(dir.path());
    let (_, scene, _owner) = candidate
        .prepare(&current, VbdSettings::default())
        .unwrap()
        .into_parts();
    assert_eq!(scene.collider.surface.vertices[0], DVec3::new(5., 6., 7.));
    assert_eq!(scene.collider.surface.triangles, vec![[0, 2, 1]]);
    assert_eq!(std::fs::read(path).unwrap(), bytes);
}
