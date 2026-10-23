//! Static glTF 2.0 avatar geometry import.
//!
//! Independently implemented from the Khronos glTF 2.0.1 specification:
//! https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
//! Container decoding is separate from geometry and never initializes a GPU.
//!
//! # Supported subset
//! `load` accepts local `.gltf` JSON or GLB v2, selecting one scene and flattening
//! static triangle primitives into the existing `SurfaceMesh` representation.
//! Positions are float32 VEC3 data, with optional u8/u16/u32 triangle indices;
//! interleaved vertex buffers, node TRS/matrices and repeated mesh instances are
//! supported. Coordinates remain metres, right-handed and Y-up. Negative scale
//! reverses triangle winding. No guessed human height or rescaling is applied.
//!
//! Local buffer URIs (including percent-encoded UTF-8 paths) and base64 binary
//! data URIs are supported. File paths are canonicalized beneath the asset
//! directory; this is a local importer, not a sandbox against concurrent file
//! replacement. Each resource and expanded geometry has an explicit limit.
//!
//! # Losses and limits
//! This is a CPU library API, not an editor file-picker integration or a project
//! format change. The caller must display `ImportedAvatar::warnings` before
//! accepting the geometry. It discards UVs, authored normals, materials, textures
//! and scene object identities. Required extensions, geometry/node extensions,
//! animation, skinning, morphs, sparse accessors and non-triangle topology are
//! rejected explicitly. Singular/sheared node matrices are rejected. Validation
//! detects malformed indices and degenerate/nonfinite triangles; it does not
//! prove that an avatar is closed, consistently oriented or self-intersection-free.

const JSON_CHUNK: u32 = 0x4e4f534a;
const BIN_CHUNK: u32 = 0x004e4942;

struct Container<'a> {
    json: &'a [u8],
    binary: Option<&'a [u8]>,
}

fn word(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let end = offset.checked_add(4).ok_or("GLB offset overflow")?;
    let value = bytes.get(offset..end).ok_or("Truncated GLB header")?;
    Ok(u32::from_le_bytes(value.try_into().unwrap()))
}

fn container(bytes: &[u8], max_bytes: usize) -> Result<Container<'_>, String> {
    if bytes.len() > max_bytes {
        return Err("Avatar document exceeds the byte limit".into());
    }
    if !bytes.starts_with(b"glTF") {
        return Ok(Container {
            json: bytes,
            binary: None,
        });
    }
    if word(bytes, 4)? != 2 {
        return Err("Only GLB container version 2 is supported".into());
    }
    if word(bytes, 8)? as usize != bytes.len() {
        return Err("GLB declared length does not match the document".into());
    }
    let mut offset = 12usize;
    let mut index = 0usize;
    let mut json = None;
    let mut binary = None;
    while offset < bytes.len() {
        let length = word(bytes, offset)? as usize;
        let kind = word(bytes, offset.checked_add(4).ok_or("GLB offset overflow")?)?;
        if !length.is_multiple_of(4) {
            return Err("GLB chunks must be aligned to four bytes".into());
        }
        let start = offset.checked_add(8).ok_or("GLB offset overflow")?;
        let end = start
            .checked_add(length)
            .ok_or("GLB chunk length overflow")?;
        let data = bytes.get(start..end).ok_or("Truncated GLB chunk")?;
        if index == 0 && kind != JSON_CHUNK {
            return Err("The first GLB chunk must contain JSON".into());
        }
        match kind {
            JSON_CHUNK => {
                if index != 0 {
                    return Err("Duplicate or misplaced GLB JSON chunk".into());
                }
                json = Some(data);
            }
            BIN_CHUNK => {
                if index != 1 {
                    return Err("The GLB binary chunk must be second".into());
                }
                binary = Some(data);
            }
            // Unknown extension chunks are ignored, as required by section 4.4.3.
            _ => {}
        }
        offset = end;
        index += 1;
    }
    Ok(Container {
        json: json.ok_or("Missing GLB JSON chunk")?,
        binary,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn glb(chunks: &[(u32, &[u8])]) -> Vec<u8> {
        let mut out = b"glTF".to_vec();
        out.extend(2u32.to_le_bytes());
        let length = 12 + chunks.iter().map(|(_, data)| 8 + data.len()).sum::<usize>();
        out.extend((length as u32).to_le_bytes());
        for (kind, data) in chunks {
            out.extend((data.len() as u32).to_le_bytes());
            out.extend(kind.to_le_bytes());
            out.extend_from_slice(data);
        }
        out
    }

    #[test]
    fn glb_container_borrows_payload_and_skips_unknown_extensions() {
        let bytes = glb(&[
            (JSON_CHUNK, b"{}  "),
            (BIN_CHUNK, &[1, 2, 3, 0]),
            (7, &[9; 4]),
        ]);
        let parsed = container(&bytes, bytes.len()).unwrap();
        assert_eq!(parsed.json, b"{}  ");
        assert_eq!(parsed.binary.unwrap(), &[1, 2, 3, 0]);
        assert!(container(&bytes, bytes.len() - 1).is_err());
        assert!(container(b"{}", 2).unwrap().binary.is_none());
    }

    #[test]
    fn glb_container_rejects_truncation_order_and_unaligned_lengths() {
        let valid = glb(&[(JSON_CHUNK, b"{}  "), (BIN_CHUNK, &[0; 4])]);
        for end in 4..valid.len() {
            assert!(container(&valid[..end], 1000).is_err());
        }
        for chunks in [
            vec![(BIN_CHUNK, &[0; 4][..])],
            vec![(JSON_CHUNK, &b"{}  "[..]), (JSON_CHUNK, &b"{}  "[..])],
            vec![
                (JSON_CHUNK, &b"{}  "[..]),
                (7, &[0; 4][..]),
                (BIN_CHUNK, &[0; 4][..]),
            ],
            vec![(JSON_CHUNK, &b"{}"[..])],
        ] {
            assert!(container(&glb(&chunks), 1000).is_err());
        }
        let mut wrong_version = valid;
        wrong_version[4] = 1;
        assert!(container(&wrong_version, 1000).is_err());
        assert!(container(&glb(&[]), 1000).is_err());
    }
}

fn read_bounded(path: &std::path::Path, limit: usize) -> Result<Vec<u8>, String> {
    use std::io::Read;
    let file =
        std::fs::File::open(path).map_err(|e| format!("Cannot open avatar resource: {e}"))?;
    let cap = u64::try_from(limit)
        .map_err(|_| "Resource limit overflow")?
        .checked_add(1)
        .ok_or("Resource limit overflow")?;
    let mut bytes = Vec::new();
    file.take(cap)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Cannot read avatar resource: {e}"))?;
    if bytes.len() > limit {
        return Err("Avatar resource exceeds the byte limit".into());
    }
    Ok(bytes)
}

fn base64(text: &str, limit: usize) -> Result<Vec<u8>, String> {
    fn digit(b: u8) -> Result<u8, String> {
        match b {
            b'A'..=b'Z' => Ok(b - b'A'),
            b'a'..=b'z' => Ok(b - b'a' + 26),
            b'0'..=b'9' => Ok(b - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err("Invalid base64 buffer character".into()),
        }
    }
    let input = text.as_bytes();
    if !input.len().is_multiple_of(4) {
        return Err("Base64 buffer requires complete padded groups".into());
    }
    let padding = input.iter().rev().take_while(|b| **b == b'=').count();
    if padding > 2 {
        return Err("Invalid base64 padding".into());
    }
    let length = (input.len() / 4)
        .checked_mul(3)
        .and_then(|n| n.checked_sub(padding))
        .ok_or("Base64 size overflow")?;
    if length > limit {
        return Err("Embedded buffer exceeds the byte limit".into());
    }
    let mut out = Vec::with_capacity(length);
    for (index, chunk) in input.as_chunks::<4>().0.iter().enumerate() {
        let last = index + 1 == input.len() / 4;
        let pad = if last { padding } else { 0 };
        let a = digit(chunk[0])?;
        let b = digit(chunk[1])?;
        let c = if pad == 2 { 0 } else { digit(chunk[2])? };
        let d = if pad != 0 { 0 } else { digit(chunk[3])? };
        if (pad == 2 && b & 15 != 0) || (pad == 1 && c & 3 != 0) {
            return Err("Nonzero base64 padding bits".into());
        }
        out.push((a << 2) | (b >> 4));
        if pad < 2 {
            out.push((b << 4) | (c >> 2));
        }
        if pad == 0 {
            out.push((c << 6) | d);
        }
    }
    Ok(out)
}

fn local_uri(uri: &str) -> Result<std::path::PathBuf, String> {
    // Decode URI escapes before checking components, including encoded traversal.
    let mut bytes = Vec::with_capacity(uri.len());
    let mut input = uri.as_bytes().iter().copied();
    while let Some(b) = input.next() {
        if b == b'%' {
            let hi = input
                .next()
                .and_then(|x| (x as char).to_digit(16))
                .ok_or("Invalid URI escape")?;
            let lo = input
                .next()
                .and_then(|x| (x as char).to_digit(16))
                .ok_or("Invalid URI escape")?;
            bytes.push((hi * 16 + lo) as u8);
        } else {
            bytes.push(b);
        }
    }
    let decoded = String::from_utf8(bytes).map_err(|_| "Resource URI must decode to UTF-8")?;
    if decoded.is_empty()
        || decoded
            .chars()
            .any(|c| c.is_control() || matches!(c, ':' | '\\' | '?' | '#'))
        || decoded
            .split('/')
            .any(|p| p.is_empty() || p == "." || p == "..")
    {
        return Err("Avatar resource must be a relative path inside its directory".into());
    }
    Ok(std::path::PathBuf::from(decoded))
}

fn resource(uri: &str, root: &std::path::Path, limit: usize) -> Result<Vec<u8>, String> {
    if let Some(data) = uri.strip_prefix("data:") {
        let (kind, encoded) = data.split_once(',').ok_or("Invalid buffer data URI")?;
        if !matches!(
            kind,
            "application/octet-stream;base64" | "application/gltf-buffer;base64"
        ) {
            return Err("Only base64 binary buffer data URIs are supported".into());
        }
        return base64(encoded, limit);
    }
    let relative = local_uri(uri)?;
    let root = root
        .canonicalize()
        .map_err(|e| format!("Invalid avatar directory: {e}"))?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|e| format!("Missing avatar buffer: {e}"))?;
    if !path.starts_with(&root) {
        return Err("Avatar buffer resolves outside its directory".into());
    }
    read_bounded(&path, limit)
}

#[cfg(test)]
mod resource_tests {
    use super::*;

    #[test]
    fn embedded_buffers_decode_exactly_and_obey_limits() {
        for (encoded, expected) in [
            ("", ""),
            ("Zg==", "f"),
            ("Zm8=", "fo"),
            ("Zm9v", "foo"),
            ("Zm9vYmFy", "foobar"),
        ] {
            assert_eq!(
                base64(encoded, expected.len()).unwrap(),
                expected.as_bytes()
            );
            if !expected.is_empty() {
                assert!(base64(encoded, expected.len() - 1).is_err());
            }
        }
        for bad in [
            "Zg", "Zh==", "Zm9=", "Z===", "====", "Zg==AAAA", "Zg=+", "Zm 8", "éé",
        ] {
            assert!(base64(bad, 100).is_err(), "accepted {bad}");
        }
        assert_eq!(
            resource(
                "data:application/gltf-buffer;base64,AQID",
                std::path::Path::new("unused"),
                3
            )
            .unwrap(),
            [1, 2, 3]
        );
        assert!(
            resource(
                "data:text/html;base64,AQID",
                std::path::Path::new("unused"),
                3
            )
            .is_err()
        );
    }

    #[test]
    fn resource_paths_reject_network_absolute_and_encoded_traversal() {
        for bad in [
            "",
            "/x.bin",
            "../x.bin",
            "%2e%2e/x",
            "a/%2f../x",
            "https://a/x",
            "C:/x",
            "a\\x",
            "a%5cx",
            "a?x",
            "a%00x",
            "a%2",
            "//server/x",
            "a/./x",
        ] {
            assert!(local_uri(bad).is_err(), "accepted {bad}");
        }
        assert_eq!(
            local_uri("buffers/body%20mesh.bin").unwrap(),
            std::path::PathBuf::from("buffers/body mesh.bin")
        );
    }
}

use crate::avatar::SurfaceMesh;
use glam::{DMat4, DQuat, DVec3};
use serde::Deserialize;
use std::{collections::BTreeMap, path::Path};

/// Resource and expanded-geometry limits, applied before allocations where possible.
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub document_bytes: usize,
    pub buffer_bytes: usize,
    pub vertices: usize,
    pub triangles: usize,
    pub nodes: usize,
    pub depth: usize,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            document_bytes: 64 * 1024 * 1024,
            buffer_bytes: 256 * 1024 * 1024,
            vertices: 2_000_000,
            triangles: 4_000_000,
            nodes: 100_000,
            depth: 256,
        }
    }
}

/// A flattened static scene, in metres and glTF's right-handed Y-up frame.
/// This geometry can feed both display and collision consumers. Materials,
/// normals, UVs and textures are not preserved; see `warnings` before applying.
#[derive(Debug)]
pub struct ImportedAvatar {
    pub mesh: SurfaceMesh,
    pub scene: usize,
    pub warnings: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document {
    asset: Asset,
    #[serde(default)]
    buffers: Vec<Buffer>,
    #[serde(default)]
    buffer_views: Vec<View>,
    #[serde(default)]
    accessors: Vec<Accessor>,
    #[serde(default)]
    meshes: Vec<Mesh>,
    #[serde(default)]
    nodes: Vec<Node>,
    #[serde(default)]
    scenes: Vec<Scene>,
    scene: Option<usize>,
    #[serde(default)]
    skins: Vec<serde_json::Value>,
    #[serde(default)]
    animations: Vec<serde_json::Value>,
    #[serde(default)]
    extensions_required: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Asset {
    version: String,
    min_version: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Buffer {
    byte_length: usize,
    uri: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct View {
    buffer: usize,
    #[serde(default)]
    byte_offset: usize,
    byte_length: usize,
    byte_stride: Option<usize>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Accessor {
    buffer_view: Option<usize>,
    #[serde(default)]
    byte_offset: usize,
    component_type: u32,
    count: usize,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    normalized: bool,
    sparse: Option<serde_json::Value>,
    min: Option<Vec<f64>>,
    max: Option<Vec<f64>>,
}
#[derive(Deserialize)]
struct Mesh {
    primitives: Vec<Primitive>,
    weights: Option<Vec<f64>>,
}
#[derive(Deserialize)]
struct Primitive {
    attributes: BTreeMap<String, usize>,
    indices: Option<usize>,
    mode: Option<u32>,
    #[serde(default)]
    targets: Vec<serde_json::Value>,
    #[serde(default)]
    extensions: BTreeMap<String, serde_json::Value>,
}
#[derive(Deserialize)]
struct Node {
    mesh: Option<usize>,
    skin: Option<usize>,
    weights: Option<Vec<f64>>,
    #[serde(default)]
    children: Vec<usize>,
    matrix: Option<[f64; 16]>,
    translation: Option<[f64; 3]>,
    rotation: Option<[f64; 4]>,
    scale: Option<[f64; 3]>,
    #[serde(default)]
    extensions: BTreeMap<String, serde_json::Value>,
}
#[derive(Deserialize)]
struct Scene {
    #[serde(default)]
    nodes: Vec<usize>,
}

/// Load a selected static scene. `None` uses the declared default, or the only
/// scene; ambiguous files require an explicit selection. Skins, animations,
/// morph targets, sparse accessors and geometry extensions are rejected.
/// No network, image decoding, automatic size normalization or document mutation.
pub fn load(path: &Path, scene: Option<usize>, limits: Limits) -> Result<ImportedAvatar, String> {
    let bytes = read_bounded(path, limits.document_bytes)?;
    import(
        &bytes,
        path.parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or(Path::new(".")),
        scene,
        limits,
    )
}

/// Parse glTF JSON or GLB bytes. External buffers resolve under `directory`.
pub fn import(
    bytes: &[u8],
    directory: &Path,
    scene: Option<usize>,
    limits: Limits,
) -> Result<ImportedAvatar, String> {
    let packed = container(bytes, limits.document_bytes)?;
    let doc: Document =
        serde_json::from_slice(packed.json).map_err(|e| format!("Invalid glTF JSON: {e}"))?;
    if doc.asset.version != "2.0" || doc.asset.min_version.as_deref().is_some_and(|v| v != "2.0") {
        return Err("Only glTF asset version 2.0 is supported".into());
    }
    if !doc.extensions_required.is_empty() {
        return Err(format!(
            "Required glTF extensions are unsupported: {:?}",
            doc.extensions_required
        ));
    }
    if !doc.skins.is_empty() || !doc.animations.is_empty() {
        return Err("Skinned or animated avatars are unsupported; export a static mesh".into());
    }
    if doc.nodes.len() > limits.nodes {
        return Err("Avatar node limit exceeded".into());
    }
    let selected = scene
        .or(doc.scene)
        .or_else(|| (doc.scenes.len() == 1).then_some(0))
        .ok_or("Select an explicit glTF scene")?;
    let selected_scene = doc.scenes.get(selected).ok_or("Invalid selected scene")?;
    let mut buffers = Vec::with_capacity(doc.buffers.len());
    let mut used = 0usize;
    for (i, b) in doc.buffers.iter().enumerate() {
        if b.byte_length == 0 {
            return Err("Empty glTF buffer".into());
        }
        used = used
            .checked_add(b.byte_length)
            .ok_or("Buffer size overflow")?;
        if used > limits.buffer_bytes {
            return Err("Combined avatar buffer limit exceeded".into());
        }
        let data = if let Some(uri) = &b.uri {
            resource(uri, directory, b.byte_length)?
        } else {
            if i != 0 {
                return Err("Only the first buffer may reference GLB binary data".into());
            }
            let bin = packed.binary.ok_or("Missing GLB binary buffer")?;
            if bin.len() < b.byte_length
                || bin.len() - b.byte_length > 3
                || bin[b.byte_length..].iter().any(|v| *v != 0)
            {
                return Err("GLB binary length or padding is invalid".into());
            }
            bin[..b.byte_length].to_vec()
        };
        if data.len() != b.byte_length {
            return Err("Buffer length differs from byteLength".into());
        }
        buffers.push(data);
    }
    let mut parents = vec![None; doc.nodes.len()];
    for (parent, node) in doc.nodes.iter().enumerate() {
        if node.skin.is_some() || node.weights.is_some() || !node.extensions.is_empty() {
            return Err("Node skinning, morph weights or extensions are unsupported".into());
        }
        for &child in &node.children {
            let slot = parents.get_mut(child).ok_or("Invalid child node index")?;
            if slot.replace(parent).is_some() {
                return Err("Node hierarchy has multiple parents".into());
            }
        }
    }
    // Check all nodes, including those outside the selected scene, for cycles.
    let mut marks = vec![0u8; doc.nodes.len()];
    for start in 0..doc.nodes.len() {
        let mut current = Some(start);
        let mut chain = Vec::new();
        while let Some(i) = current {
            if marks[i] == 2 {
                break;
            }
            if marks[i] == 1 {
                return Err("Cycle in glTF node hierarchy".into());
            }
            marks[i] = 1;
            chain.push(i);
            if chain.len() > limits.depth {
                return Err("Avatar hierarchy depth limit exceeded".into());
            }
            current = parents[i];
        }
        for i in chain {
            marks[i] = 2;
        }
    }
    let mut stack = Vec::new();
    let mut seen = vec![false; doc.nodes.len()];
    for &root in selected_scene.nodes.iter().rev() {
        if parents.get(root).ok_or("Invalid scene root")?.is_some() {
            return Err("Scene references a non-root node".into());
        }
        stack.push((root, DMat4::IDENTITY, 1usize));
    }
    let mut mesh = SurfaceMesh {
        vertices: vec![],
        triangles: vec![],
    };
    while let Some((index, parent, depth)) = stack.pop() {
        if depth > limits.depth {
            return Err("Avatar hierarchy depth limit exceeded".into());
        }
        if std::mem::replace(&mut seen[index], true) {
            return Err("Repeated scene root or node".into());
        }
        let node = &doc.nodes[index];
        let world = parent * transform(node)?;
        if !world.is_finite() || !world.determinant().is_finite() || world.determinant() == 0. {
            return Err("Invalid accumulated node transform".into());
        }
        if let Some(id) = node.mesh {
            let source = doc.meshes.get(id).ok_or("Invalid node mesh index")?;
            if source.weights.is_some() {
                return Err("Morph meshes are unsupported".into());
            }
            if source.primitives.is_empty() {
                return Err("Empty glTF mesh".into());
            }
            for primitive in &source.primitives {
                append_primitive(&doc, &buffers, primitive, world, &mut mesh, limits)?;
            }
        }
        for &child in node.children.iter().rev() {
            stack.push((child, world, depth + 1));
        }
    }
    mesh.validate()?;
    for t in &mesh.triangles {
        let [a, b, c] = t.map(|i| mesh.vertices[i]);
        if !(b - a).cross(c - a).length_squared().is_finite() {
            return Err("Transformed triangle exceeds finite geometric range".into());
        }
    }
    Ok(ImportedAvatar { mesh, scene: selected, warnings: vec!["Static geometry only: normals, UVs, materials, textures, cameras and lights are not imported.".into()] })
}

fn transform(node: &Node) -> Result<DMat4, String> {
    if let Some(m) = node.matrix {
        if node.translation.is_some() || node.rotation.is_some() || node.scale.is_some() {
            return Err("Node combines matrix and TRS".into());
        }
        let matrix = DMat4::from_cols_array(&m);
        if !matrix.is_finite() || m[3] != 0. || m[7] != 0. || m[11] != 0. || m[15] != 1. {
            return Err("Node matrix must be finite and affine".into());
        }
        let axes = [
            matrix.x_axis.truncate(),
            matrix.y_axis.truncate(),
            matrix.z_axis.truncate(),
        ];
        if axes
            .iter()
            .any(|a| !a.length().is_finite() || a.length() == 0.)
        {
            return Err("Singular node matrix".into());
        }
        let axes = axes.map(|a| a.normalize());
        if axes[0].dot(axes[1]).abs() > 1e-6
            || axes[0].dot(axes[2]).abs() > 1e-6
            || axes[1].dot(axes[2]).abs() > 1e-6
        {
            return Err("Sheared node matrices are not glTF TRS transforms".into());
        }
        return Ok(matrix);
    }
    let t = DVec3::from_array(node.translation.unwrap_or([0.; 3]));
    let s = DVec3::from_array(node.scale.unwrap_or([1.; 3]));
    let q = DQuat::from_array(node.rotation.unwrap_or([0., 0., 0., 1.]));
    if !t.is_finite()
        || !s.is_finite()
        || s.to_array().contains(&0.)
        || !q.is_finite()
        || (q.length_squared() - 1.).abs() > 1e-6
    {
        return Err("Invalid node translation, scale or unit quaternion".into());
    }
    Ok(DMat4::from_scale_rotation_translation(s, q.normalize(), t))
}

fn accessor<'a>(
    doc: &Document,
    buffers: &'a [Vec<u8>],
    id: usize,
    position: bool,
) -> Result<(&'a [u8], usize, usize, u32), String> {
    let a = doc.accessors.get(id).ok_or("Invalid accessor index")?;
    if a.sparse.is_some() || a.normalized || a.count == 0 {
        return Err("Sparse, normalized or empty geometry accessors are unsupported".into());
    }
    let component = match a.component_type {
        5121 => 1,
        5123 => 2,
        5125 | 5126 => 4,
        _ => return Err("Unsupported geometry component type".into()),
    };
    if (position && (a.kind != "VEC3" || a.component_type != 5126))
        || (!position && (a.kind != "SCALAR" || a.component_type == 5126))
    {
        return Err("Invalid position or index accessor type".into());
    }
    let width = component * if position { 3 } else { 1 };
    let view = doc
        .buffer_views
        .get(
            a.buffer_view
                .ok_or("Geometry accessor requires a buffer view")?,
        )
        .ok_or("Invalid buffer view index")?;
    let buffer = buffers.get(view.buffer).ok_or("Invalid buffer index")?;
    if view.byte_length == 0
        || view
            .byte_offset
            .checked_add(view.byte_length)
            .is_none_or(|n| n > buffer.len())
    {
        return Err("Buffer view exceeds buffer bounds".into());
    }
    let stride = view.byte_stride.unwrap_or(width);
    if (!position && view.byte_stride.is_some())
        || view
            .byte_stride
            .is_some_and(|s| !(4..=252).contains(&s) || !s.is_multiple_of(4))
        || stride < width
    {
        return Err("Invalid geometry byteStride".into());
    }
    let start = view
        .byte_offset
        .checked_add(a.byte_offset)
        .ok_or("Accessor offset overflow")?;
    if !a.byte_offset.is_multiple_of(component)
        || !start.is_multiple_of(component)
        || (position && !a.byte_offset.is_multiple_of(4))
    {
        return Err("Misaligned geometry accessor".into());
    }
    let size = (a.count - 1)
        .checked_mul(stride)
        .and_then(|n| n.checked_add(width))
        .ok_or("Accessor size overflow")?;
    if a.byte_offset
        .checked_add(size)
        .is_none_or(|n| n > view.byte_length)
    {
        return Err("Accessor exceeds buffer view".into());
    }
    Ok((
        &buffer[start..start + size],
        stride,
        a.count,
        a.component_type,
    ))
}

fn append_primitive(
    doc: &Document,
    buffers: &[Vec<u8>],
    p: &Primitive,
    world: DMat4,
    mesh: &mut SurfaceMesh,
    limits: Limits,
) -> Result<(), String> {
    if p.attributes
        .keys()
        .any(|name| name.starts_with("JOINTS_") || name.starts_with("WEIGHTS_"))
    {
        return Err("Skinning attributes are unsupported; export a static mesh".into());
    }
    if p.mode.unwrap_or(4) != 4 || !p.targets.is_empty() || !p.extensions.is_empty() {
        return Err(
            "Only static triangle primitives without geometry extensions are supported".into(),
        );
    }
    let id = *p
        .attributes
        .get("POSITION")
        .ok_or("Primitive has no POSITION")?;
    let (data, stride, count, _) = accessor(doc, buffers, id, true)?;
    if mesh
        .vertices
        .len()
        .checked_add(count)
        .is_none_or(|n| n > limits.vertices)
    {
        return Err("Expanded avatar vertex limit exceeded".into());
    }
    let offset = mesh.vertices.len();
    let mut min = DVec3::splat(f64::INFINITY);
    let mut max = DVec3::splat(f64::NEG_INFINITY);
    for i in 0..count {
        let v = DVec3::from_array(std::array::from_fn(|axis| {
            let j = i * stride + axis * 4;
            f32::from_le_bytes(data[j..j + 4].try_into().unwrap()) as f64
        }));
        if !v.is_finite() {
            return Err("Nonfinite avatar position".into());
        }
        min = min.min(v);
        max = max.max(v);
        mesh.vertices.push(world.transform_point3(v));
    }
    let a = &doc.accessors[id];
    for (declared, actual) in [(&a.min, min), (&a.max, max)] {
        let declared = declared
            .as_ref()
            .ok_or("POSITION requires min and max bounds")?;
        if declared.len() != 3
            || declared
                .iter()
                .enumerate()
                .any(|(i, v)| !v.is_finite() || (*v as f32 as f64) != actual[i])
        {
            return Err("POSITION bounds differ from buffer data".into());
        }
    }
    let indices = if let Some(id) = p.indices {
        let (bytes, stride, n, component) = accessor(doc, buffers, id, false)?;
        if !n.is_multiple_of(3)
            || mesh
                .triangles
                .len()
                .checked_add(n / 3)
                .is_none_or(|n| n > limits.triangles)
        {
            return Err("Triangle index count or limit is invalid".into());
        }
        let mut indices = Vec::with_capacity(n);
        for i in 0..n {
            let j = i * stride;
            let value = match component {
                5121 => bytes[j] as usize,
                5123 => u16::from_le_bytes(bytes[j..j + 2].try_into().unwrap()) as usize,
                _ => u32::from_le_bytes(bytes[j..j + 4].try_into().unwrap()) as usize,
            };
            let restart = match component {
                5121 => 255,
                5123 => 65535,
                _ => u32::MAX as usize,
            };
            if value >= count || value == restart {
                return Err("Invalid primitive vertex index".into());
            }
            indices.push(value);
        }
        indices
    } else {
        if !count.is_multiple_of(3)
            || mesh
                .triangles
                .len()
                .checked_add(count / 3)
                .is_none_or(|n| n > limits.triangles)
        {
            return Err("Unindexed triangle count or limit is invalid".into());
        }
        (0..count).collect()
    };
    let mirrored = world.determinant() < 0.;
    for triangle in indices.as_chunks::<3>().0 {
        let mut t = [
            offset + triangle[0],
            offset + triangle[1],
            offset + triangle[2],
        ];
        if mirrored {
            t.swap(1, 2);
        }
        mesh.triangles.push(t);
    }
    Ok(())
}
