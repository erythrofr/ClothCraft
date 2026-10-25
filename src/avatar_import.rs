//! CPU preparation for replacing a static avatar without changing project v1.
use crate::{
    avatar::SurfaceMesh,
    fitting::{FittingProject, FittingScene},
    gltf_avatar,
    vbd::VbdSettings,
};
use glam::DVec3;
use std::{
    io::{Read, Write},
    path::Path,
    sync::Arc,
};

/// Keeps the canonical OBJ alive while the editable project refers to it.
/// Portable project saves copy it into their own content-addressed asset folder.
#[derive(Clone, Debug)]
pub struct StagedAvatar(Arc<tempfile::TempDir>);

impl StagedAvatar {
    fn path(&self) -> std::path::PathBuf {
        self.0.path().join("avatar.obj")
    }
}

#[derive(Debug)]
pub struct Candidate {
    pub source: std::path::PathBuf,
    pub vertices: usize,
    pub triangles: usize,
    pub bounds: [DVec3; 2],
    pub warnings: Vec<String>,
    asset: StagedAvatar,
}

impl Candidate {
    /// Geometry only. No implicit scene selection, scale normalization or source writes.
    pub fn load(path: &Path) -> Result<Self, String> {
        let limits = gltf_avatar::Limits::default();
        let extension = path
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let (mesh, mut warnings) = match extension.as_str() {
            "gltf" | "glb" => {
                let imported = gltf_avatar::load(path, None, limits)?;
                (imported.mesh, imported.warnings)
            }
            "obj" => {
                let mut bytes = Vec::new();
                std::fs::File::open(path)
                    .map_err(|e| e.to_string())?
                    .take(limits.document_bytes as u64 + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|e| e.to_string())?;
                if bytes.len() > limits.document_bytes {
                    return Err("Avatar document exceeds the byte limit".into());
                }
                let text =
                    std::str::from_utf8(&bytes).map_err(|e| format!("OBJ must be UTF-8: {e}"))?;
                let mesh = SurfaceMesh::parse_obj(text)?;
                if mesh.vertices.len() > limits.vertices || mesh.triangles.len() > limits.triangles
                {
                    return Err("Avatar geometry exceeds the import limit".into());
                }
                (mesh, vec!["OBJ has no declared units: coordinates are interpreted as metres, Y-up. No rescaling is applied.".into(),
                    "Geometry only: materials, textures, UVs, authored normals and object groups are not retained. Polygon faces use the existing fan triangulation; use triangulated OBJ for unambiguous geometry.".into()])
            }
            _ => return Err("Choose a static OBJ, glTF or GLB avatar".into()),
        };
        mesh.validate()?;
        warnings.push("Import does not repair intersections, open surfaces or inconsistent winding. Check placement before simulating.".into());
        let mut bounds = [DVec3::splat(f64::INFINITY), DVec3::splat(f64::NEG_INFINITY)];
        for &p in &mesh.vertices {
            bounds[0] = bounds[0].min(p);
            bounds[1] = bounds[1].max(p);
        }
        if !(bounds[1] - bounds[0]).is_finite()
            || mesh.triangles.iter().any(|triangle| {
                let [a, b, c] = triangle.map(|i| mesh.vertices[i]);
                !(b - a).cross(c - a).length_squared().is_finite()
            })
        {
            return Err("Avatar dimensions overflow geometry calculations".into());
        }
        let asset = StagedAvatar(Arc::new(tempfile::tempdir().map_err(|e| e.to_string())?));
        let mut out = std::io::BufWriter::new(
            std::fs::File::create(asset.path()).map_err(|e| e.to_string())?,
        );
        writeln!(out, "# ClothCraft static avatar; metres; Y-up").map_err(|e| e.to_string())?;
        for p in &mesh.vertices {
            writeln!(out, "v {} {} {}", p.x, p.y, p.z).map_err(|e| e.to_string())?;
        }
        for [a, b, c] in &mesh.triangles {
            writeln!(out, "f {} {} {}", a + 1, b + 1, c + 1).map_err(|e| e.to_string())?;
        }
        out.flush().map_err(|e| e.to_string())?;
        Ok(Self {
            source: path.to_owned(),
            vertices: mesh.vertices.len(),
            triangles: mesh.triangles.len(),
            bounds,
            warnings,
            asset,
        })
    }

    /// Validate the whole candidate before any active workspace field changes.
    /// Authored rest geometry, placement and seams are copied verbatim.
    pub fn prepare(
        &self,
        current: &FittingProject,
        settings: VbdSettings,
    ) -> Result<Prepared, String> {
        let mut project = current.clone();
        project.avatar_path = self.asset.path();
        project.state = None;
        project.mesh_signature = None;
        project.prearrange = false;
        project.simulation = Some(settings);
        let scene = project.compile()?;
        Ok(Prepared {
            project,
            scene,
            asset: self.asset.clone(),
        })
    }
}

pub struct Prepared {
    project: FittingProject,
    scene: FittingScene,
    asset: StagedAvatar,
}
impl Prepared {
    pub fn into_parts(self) -> (FittingProject, FittingScene, StagedAvatar) {
        (self.project, self.scene, self.asset)
    }
}
