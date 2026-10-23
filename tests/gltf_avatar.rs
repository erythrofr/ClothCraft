use glam::DVec3;
use marvelous_cloth::gltf_avatar::{Limits, import, load};
use serde_json::{Value, json};
use std::path::Path;

fn fixture() -> (Value, Vec<u8>) {
    let mut bytes = Vec::new();
    for p in [[0f32, 0., 0.], [1., 0., 0.], [0., 1., 0.]] {
        for value in p {
            bytes.extend(value.to_le_bytes());
        }
    }
    bytes.extend([0u8, 1, 2]);
    (
        json!({
            "asset":{"version":"2.0"}, "scene":0, "scenes":[{"nodes":[0]}],
            "nodes":[{"mesh":0}], "meshes":[{"primitives":[{"attributes":{"POSITION":0},"indices":1}]}],
            "buffers":[{"byteLength":39}],
            "bufferViews":[{"buffer":0,"byteLength":36},{"buffer":0,"byteOffset":36,"byteLength":3}],
            "accessors":[{"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":[0,0,0],"max":[1,1,0]},
                {"bufferView":1,"componentType":5121,"count":3,"type":"SCALAR"}]
        }),
        bytes,
    )
}
fn glb(doc: &Value, bin: &[u8]) -> Vec<u8> {
    let mut json = serde_json::to_vec(doc).unwrap();
    while !json.len().is_multiple_of(4) {
        json.push(b' ');
    }
    let mut binary = bin.to_vec();
    while !binary.len().is_multiple_of(4) {
        binary.push(0);
    }
    let mut out = b"glTF".to_vec();
    out.extend(2u32.to_le_bytes());
    out.extend((28u32 + json.len() as u32 + binary.len() as u32).to_le_bytes());
    out.extend((json.len() as u32).to_le_bytes());
    out.extend(0x4e4f534au32.to_le_bytes());
    out.extend(json);
    out.extend((binary.len() as u32).to_le_bytes());
    out.extend(0x004e4942u32.to_le_bytes());
    out.extend(binary);
    out
}
fn parse(doc: &Value, bin: &[u8]) -> Result<marvelous_cloth::gltf_avatar::ImportedAvatar, String> {
    import(&glb(doc, bin), Path::new("unused"), None, Limits::default())
}
#[test]
fn static_triangle_keeps_metres_and_reports_geometry_only_loss() {
    let (doc, bin) = fixture();
    let asset = parse(&doc, &bin).unwrap();
    assert_eq!(asset.mesh.vertices, vec![DVec3::ZERO, DVec3::X, DVec3::Y]);
    assert_eq!(asset.mesh.triangles, vec![[0, 1, 2]]);
    assert_eq!(asset.scene, 0);
    assert!(!asset.warnings.is_empty());
}
#[test]
fn hierarchy_applies_parent_rotation_then_translation_and_mirrored_instances() {
    let (mut doc, bin) = fixture();
    let q = std::f64::consts::FRAC_1_SQRT_2;
    doc["nodes"] = json!([
        {"translation":[10,20,30],"rotation":[0,0,q,q],"children":[1,2]},
        {"mesh":0,"translation":[2,0,0]},
        {"mesh":0,"scale":[-1,2,1]}
    ]);
    let mesh = parse(&doc, &bin).unwrap().mesh;
    let expected = [
        DVec3::new(10., 22., 30.),
        DVec3::new(10., 23., 30.),
        DVec3::new(9., 22., 30.),
        DVec3::new(10., 20., 30.),
        DVec3::new(10., 19., 30.),
        DVec3::new(8., 20., 30.),
    ];
    for (a, b) in mesh.vertices.iter().zip(expected) {
        assert!((*a - b).length() < 1e-12);
    }
    assert_eq!(mesh.triangles, vec![[0, 1, 2], [3, 5, 4]]);
    for t in mesh.triangles {
        let [a, b, c] = t.map(|i| mesh.vertices[i]);
        assert!((b - a).cross(c - a).z > 0.);
    }
}
#[test]
fn column_major_matrix_and_unindexed_geometry() {
    let (mut doc, bin) = fixture();
    doc["nodes"][0]["matrix"] = json!([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);
    doc["meshes"][0]["primitives"][0]
        .as_object_mut()
        .unwrap()
        .remove("indices");
    let mesh = parse(&doc, &bin).unwrap().mesh;
    assert_eq!(
        mesh.vertices,
        vec![
            DVec3::new(5., 6., 7.),
            DVec3::new(7., 6., 7.),
            DVec3::new(5., 9., 7.)
        ]
    );
}
#[test]
fn interleaved_positions_and_u16_u32_indices() {
    for kind in [5123, 5125] {
        let (mut doc, _) = fixture();
        let mut bin = vec![];
        for p in [[0f32, 0., 0.], [1., 0., 0.], [0., 1., 0.]] {
            for x in p {
                bin.extend(x.to_le_bytes());
            }
            bin.extend(99u32.to_le_bytes());
        }
        for i in 0..3 {
            if kind == 5123 {
                bin.extend((i as u16).to_le_bytes());
            } else {
                bin.extend((i as u32).to_le_bytes());
            }
        }
        doc["buffers"][0]["byteLength"] = json!(bin.len());
        doc["bufferViews"][0]["byteLength"] = json!(48);
        doc["bufferViews"][0]["byteStride"] = json!(16);
        doc["bufferViews"][1]["byteOffset"] = json!(48);
        doc["bufferViews"][1]["byteLength"] = json!(bin.len() - 48);
        doc["accessors"][1]["componentType"] = json!(kind);
        assert_eq!(
            parse(&doc, &bin).unwrap().mesh.vertices,
            vec![DVec3::ZERO, DVec3::X, DVec3::Y]
        );
    }
}
#[test]
fn malformed_accessors_and_nonfinite_positions_fail() {
    let (doc, bin) = fixture();
    for (key, value) in [
        ("count", json!(4)),
        ("byteOffset", json!(1)),
        ("componentType", json!(5123)),
        ("normalized", json!(true)),
        ("sparse", json!({})),
        ("max", json!([2, 2, 2])),
    ] {
        let mut bad = doc.clone();
        bad["accessors"][0][key] = value;
        assert!(parse(&bad, &bin).is_err(), "accepted {key}");
    }
    let mut bad = bin.clone();
    bad[0..4].copy_from_slice(&f32::NAN.to_le_bytes());
    assert!(parse(&doc, &bad).is_err());
    let mut bad = bin.clone();
    bad[38] = 9;
    assert!(parse(&doc, &bad).is_err());
    let mut bad = doc.clone();
    bad["bufferViews"][0]["byteLength"] = json!(999);
    assert!(parse(&bad, &bin).is_err());
}
#[test]
fn unsupported_deformations_and_required_extensions_are_explicit_errors() {
    let (doc, bin) = fixture();
    for (key, value) in [
        ("skins", json!([{}])),
        ("animations", json!([{}])),
        ("extensionsRequired", json!(["KHR_draco_mesh_compression"])),
    ] {
        let mut bad = doc.clone();
        bad[key] = value;
        assert!(parse(&bad, &bin).is_err());
    }
    let mut bad = doc.clone();
    bad["meshes"][0]["primitives"][0]["targets"] = json!([{}]);
    assert!(parse(&bad, &bin).is_err());
    let mut bad = doc.clone();
    bad["meshes"][0]["primitives"][0]["mode"] = json!(5);
    assert!(parse(&bad, &bin).is_err());
}
#[test]
fn ambiguous_scene_requires_selection_and_graph_errors_fail() {
    let (mut doc, bin) = fixture();
    doc.as_object_mut().unwrap().remove("scene");
    doc["scenes"] = json!([{"nodes":[0]},{"nodes":[0]}]);
    assert!(parse(&doc, &bin).is_err());
    assert_eq!(
        import(
            &glb(&doc, &bin),
            Path::new("unused"),
            Some(1),
            Limits::default()
        )
        .unwrap()
        .scene,
        1
    );
    doc["scene"] = json!(0);
    for nodes in [
        json!([{"mesh":0,"children":[0]}]),
        json!([{"children":[1,1]},{"mesh":0}]),
        json!([{"children":[9]}]),
    ] {
        doc["nodes"] = nodes;
        assert!(parse(&doc, &bin).is_err());
    }
}
#[test]
fn expansion_and_resource_limits_are_enforced() {
    let (doc, bin) = fixture();
    let bytes = glb(&doc, &bin);
    for limits in [
        Limits {
            vertices: 2,
            ..Default::default()
        },
        Limits {
            triangles: 0,
            ..Default::default()
        },
        Limits {
            buffer_bytes: 38,
            ..Default::default()
        },
        Limits {
            nodes: 0,
            ..Default::default()
        },
        Limits {
            depth: 0,
            ..Default::default()
        },
        Limits {
            document_bytes: 10,
            ..Default::default()
        },
    ] {
        assert!(import(&bytes, Path::new("unused"), None, limits).is_err());
    }
}
#[test]
fn external_buffers_and_file_loading_are_bounded_and_local() {
    let temp = tempfile::tempdir().unwrap();
    let (mut doc, bin) = fixture();
    doc["buffers"][0]["uri"] = json!("body%20mesh.bin");
    std::fs::write(temp.path().join("body mesh.bin"), &bin).unwrap();
    let path = temp.path().join("avatar.gltf");
    std::fs::write(&path, serde_json::to_vec(&doc).unwrap()).unwrap();
    assert_eq!(
        load(&path, None, Limits::default()).unwrap().mesh.triangles,
        vec![[0, 1, 2]]
    );
    std::fs::write(temp.path().join("body mesh.bin"), vec![0; 40]).unwrap();
    assert!(load(&path, None, Limits::default()).is_err());
    doc["buffers"][0]["uri"] = json!("../outside.bin");
    assert!(
        import(
            &serde_json::to_vec(&doc).unwrap(),
            temp.path(),
            None,
            Limits::default()
        )
        .is_err()
    );
}

#[test]
fn invalid_transforms_and_degenerate_triangles_are_rejected() {
    let (doc, bin) = fixture();
    for node in [
        json!({"mesh":0,"scale":[1,0,1]}),
        json!({"mesh":0,"rotation":[0,0,0,2]}),
        json!({"mesh":0,"matrix":[1,0,0,0, 1,1,0,0, 0,0,1,0, 0,0,0,1]}),
        json!({"mesh":0,"matrix":[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],"translation":[0,0,0]}),
    ] {
        let mut bad = doc.clone();
        bad["nodes"][0] = node;
        assert!(parse(&bad, &bin).is_err());
    }
    let mut bad = bin;
    bad[38] = 1;
    assert!(parse(&doc, &bad).is_err());
}

#[test]
fn skinning_attributes_and_overflowing_geometry_are_rejected() {
    let (mut doc, bin) = fixture();
    doc["meshes"][0]["primitives"][0]["attributes"]["JOINTS_0"] = json!(0);
    assert!(parse(&doc, &bin).is_err());
    doc["meshes"][0]["primitives"][0]["attributes"]
        .as_object_mut()
        .unwrap()
        .remove("JOINTS_0");
    doc["nodes"][0]["scale"] = json!([1e150, 1e150, 1e-150]);
    assert!(parse(&doc, &bin).is_err());
}
