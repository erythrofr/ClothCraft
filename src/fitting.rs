//! Small reproducible fitting project, distinct from legacy single-panel Project.
use crate::{
    avatar::{MeshCollider, SurfaceMesh},
    garment::{
        CompiledGarment, GarmentTemplate,
        presets::{self, GarmentKind},
    },
    model::State,
    solver::{Metrics, ReferenceSolver, SolverSettings},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FittingProject {
    pub version: u32,
    pub template: GarmentTemplate,
    /// Relative paths are resolved against the fitting-project JSON directory.
    pub avatar_path: PathBuf,
    pub contact_stiffness: f64,
    #[serde(default)]
    pub contact_clearance: f64,
    #[serde(default)]
    pub prearrange: bool,
    /// Assembly relaxation: each incremental minimization starts at zero velocity.
    #[serde(default)]
    pub quasistatic: bool,
    pub solver: SolverSettings,
    /// Interactive backend settings. Absent in historical v1 documents.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub simulation: Option<crate::vbd::VbdSettings>,
    pub state: Option<State>,
    /// Detect stale vertex caches after remeshing or editing the template.
    #[serde(default)]
    pub mesh_signature: Option<String>,
    #[serde(default, rename = "printGraphics", alias = "print_graphics")]
    pub print_graphics: Vec<PrintGraphic>,
    #[serde(default, rename = "importedHardware", alias = "imported_hardware")]
    pub imported_hardware: Vec<ImportedHardware>,
}

/// Placement of a locally imported hardware asset; GLB bytes remain in the asset library.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedHardware {
    pub id: String,
    pub asset_id: String,
    pub panel: String,
    pub kind: String,
    pub position_mm: [f64; 3],
    pub rotation_degrees: [f64; 3],
    pub scale: [f64; 3],
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_roughness")]
    pub roughness: f64,
    #[serde(default)]
    pub metalness: f64,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    #[serde(default = "default_reflection_intensity")]
    pub reflection_intensity: f64,
    #[serde(default)]
    pub clearcoat: f64,
    #[serde(default)]
    pub weight_grams: f64,
    #[serde(default = "default_hardware_material_type")]
    pub material_type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrintGraphic {
    pub id: String,
    pub name: String,
    pub panel: String,
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub width_mm: f64,
    pub height_mm: f64,
    pub position_mm: [f64; 2],
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub center: Option<[f64; 2]>,
    #[serde(default = "default_true")]
    pub lock_aspect_ratio: bool,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_front")]
    pub side: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    #[serde(default)]
    pub reflectivity: f64,
    #[serde(default)]
    pub metalness: f64,
    #[serde(default = "default_roughness")]
    pub roughness: f64,
    #[serde(default)]
    pub ink_height_mm: f64,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_display_map", rename = "displayedMap", alias = "displayMap")]
    pub display_map: String,
    #[serde(default)]
    pub normal_map_data_url: Option<String>,
}
fn default_true() -> bool { true }
fn default_front() -> String { "front".into() }
fn default_opacity() -> f64 { 1.0 }
fn default_roughness() -> f64 { 0.88 }
fn default_reflection_intensity() -> f64 { 1.0 }
fn default_hardware_material_type() -> String { "original".into() }
fn default_color() -> String { "#ffffff".into() }
fn default_display_map() -> String { "texture".into() }

impl FittingProject {
    pub fn validate_imported_hardware(&self, placements: &[ImportedHardware]) -> Result<(), String> {
        if placements.len() > 2000 { return Err("Too many imported hardware placements".into()); }
        let mut ids = HashSet::new();
        for p in placements {
            if p.id.is_empty() || p.id.len() > 128 || p.id.chars().any(char::is_control)
                || !ids.insert(&p.id) || p.asset_id.is_empty() || p.asset_id.len() > 512
                || p.asset_id.contains("..") || p.asset_id.starts_with('/') || p.asset_id.contains('\\')
                || p.asset_id.chars().any(char::is_control) {
                return Err("Invalid hardware placement or asset identifier".into());
            }
            if !self.template.panels.iter().any(|panel| panel.id == p.panel) {
                return Err(format!("Unknown hardware placement panel: {}", p.panel));
            }
            if !["button", "buttonhole", "zipper", "slider", "stopper", "puller", "trim", "other"].contains(&p.kind.as_str()) {
                return Err("Unsupported imported hardware kind".into());
            }
            if !p.position_mm.iter().all(|v| v.is_finite() && v.abs() <= 100_000.0)
                || !p.rotation_degrees.iter().all(|v| v.is_finite() && v.abs() <= 360_000.0)
                || !p.scale.iter().all(|v| v.is_finite() && (0.0001..=1000.0).contains(v))
                || ![p.roughness, p.metalness, p.opacity, p.clearcoat].iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v))
                || !p.reflection_intensity.is_finite() || !(0.0..=3.0).contains(&p.reflection_intensity)
                || !p.weight_grams.is_finite() || !(0.0..=500.0).contains(&p.weight_grams)
                || !["original","metal","plastic","nylon","textile","ceramic","glass"].contains(&p.material_type.as_str())
                || p.color.len() != 7 || !p.color.starts_with('#') || !p.color[1..].bytes().all(|c| c.is_ascii_hexdigit()) {
                return Err("Invalid imported hardware transform or material".into());
            }
        }
        Ok(())
    }
    pub fn validate_print_graphics(&self, graphics: &[PrintGraphic]) -> Result<(), String> {
        if graphics.len() > 100 { return Err("Too many print graphics".into()); }
        let mut ids = HashSet::new();
        let mut encoded_bytes = 0usize;
        for g in graphics {
            if g.id.is_empty() || g.id.len() > 128 || !ids.insert(&g.id) || g.name.len() > 256 {
                return Err("Invalid or duplicate graphic identifier/name".into());
            }
            if !self.template.panels.iter().any(|p| p.id == g.panel) {
                return Err(format!("Unknown print graphic panel: {}", g.panel));
            }
            if g.width == 0 || g.height == 0 || g.width > 8192 || g.height > 8192 || (g.width as u64) * (g.height as u64) > 16_000_000 {
                return Err("Invalid graphic pixel dimensions".into());
            }
            if ![g.width_mm,g.height_mm,g.rotation,g.opacity,g.reflectivity,g.metalness,g.roughness,g.ink_height_mm,g.position_mm[0],g.position_mm[1]].iter().all(|v| v.is_finite())
                || g.width_mm < 0.1 || g.height_mm < 0.1 || g.width_mm > 10_000.0 || g.height_mm > 10_000.0
                || g.ink_height_mm < 0.0 || g.ink_height_mm > 10.0 || g.position_mm.iter().any(|v| v.abs() > 100_000.0) || g.rotation.abs() > 360.0
                || ![g.opacity,g.reflectivity,g.metalness,g.roughness].iter().all(|v| (0.0..=1.0).contains(v)) {
                return Err("Invalid physical graphic dimensions, placement or material".into());
            }
            if let Some(center) = g.center { if !center.iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v)) { return Err("Invalid legacy graphic center".into()); } }
            if g.width as f64 * 25.4 / g.width_mm < 1.0 || g.height as f64 * 25.4 / g.height_mm < 1.0 { return Err("Graphic pixel DPI below 1".into()); }
            if !["front","back","both"].contains(&g.side.as_str()) || !["texture","normal"].contains(&g.display_map.as_str())
                || g.color.len() != 7 || !g.color.starts_with('#') || !g.color[1..].bytes().all(|c| c.is_ascii_hexdigit()) { return Err("Invalid graphic material options".into()); }
            for url in std::iter::once(&g.data_url).chain(g.normal_map_data_url.iter()) {
                let payload = url.strip_prefix("data:image/png;base64,").ok_or("Graphics must be PNG data URLs")?;
                let padding = payload.bytes().rev().take_while(|c| *c == b'=').count();
                if payload.is_empty() || payload.len() % 4 != 0 || padding > 2
                    || !payload[..payload.len()-padding].bytes().all(|c| c.is_ascii_alphanumeric() || c == b'+' || c == b'/')
                    || !payload[payload.len()-padding..].bytes().all(|c| c == b'=') { return Err("Invalid PNG base64 characters".into()); }
                encoded_bytes = encoded_bytes.saturating_add(url.len());
                if encoded_bytes > 6 * 1024 * 1024 { return Err("Print graphics exceed 6 MiB".into()); }
                // PNG header: signature + IHDR chunk (13 bytes) must match declared pixels.
                let prefix = &payload[..payload.len().min(48)];
                let decode = |c: u8| -> Option<u32> { match c { b'A'..=b'Z' => Some((c-b'A') as u32), b'a'..=b'z' => Some((c-b'a'+26) as u32), b'0'..=b'9' => Some((c-b'0'+52) as u32), b'+' => Some(62), b'/' => Some(63), _ => None } };
                let mut bytes = Vec::new(); let mut chunk = 0u32; let mut n = 0;
                for c in prefix.bytes() { if c == b'=' { break; } chunk = (chunk << 6) | decode(c).ok_or("Invalid base64")?; n += 1; if n == 4 { bytes.extend_from_slice(&chunk.to_be_bytes()[1..]); chunk = 0; n = 0; } }
                if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" || &bytes[12..16] != b"IHDR" { return Err("Invalid PNG signature/IHDR".into()); }
                if std::ptr::eq(url, &g.data_url) && (u32::from_be_bytes(bytes[16..20].try_into().unwrap()) != g.width || u32::from_be_bytes(bytes[20..24].try_into().unwrap()) != g.height) { return Err("Graphic PNG header dimensions mismatch".into()); }
            }
        }
        Ok(())
    }
}
pub struct FittingScene {
    pub garment: Arc<CompiledGarment>,
    pub collider: Arc<MeshCollider>,
    pub state: State,
    pub quasistatic: bool,
    /// Conservative adaptive step cap for this run; reset when loading a project.
    pub next_dt: f64,
}
impl FittingScene {
    /// A failed Newton solve never silently advances time. Retry from the exact
    /// previous state with a smaller dt; the accepted dt is recorded in Metrics.
    pub fn step(&mut self, settings: &SolverSettings) -> Result<(Metrics, usize), String> {
        settings.validate()?;
        let previous = self.state.clone();
        let mut error = String::new();
        for attempt in 0..7 {
            self.state = previous.clone();
            if self.quasistatic {
                self.state.v.fill(glam::DVec3::ZERO);
            }
            let mut settings = settings.clone();
            settings.dt = settings.dt.min(self.next_dt) / 2.0_f64.powi(attempt as i32);
            match ReferenceSolver::step_garment_with_collider(
                &self.garment,
                &mut self.state,
                &settings,
                Some(self.collider.as_ref()),
            ) {
                Ok(mut m) if m.converged => {
                    self.next_dt = settings.dt;
                    if self.quasistatic {
                        self.state.v.fill(glam::DVec3::ZERO);
                        m.kinetic_j = 0.0;
                    }
                    return Ok((m, attempt));
                }
                Ok(m) => {
                    error = format!(
                        "Newton iteration limit: residual {} / {}",
                        m.residual_rms_n, m.tolerance_n
                    )
                }
                Err(e) => error = e,
            }
        }
        self.state = previous;
        Err(format!(
            "Fitting retries exhausted; state unchanged: {error}"
        ))
    }
}
impl FittingProject {
    pub fn basic(kind: GarmentKind, subdivisions: u32, avatar_path: PathBuf) -> Self {
        Self {
            version: 1,
            template: presets::basic(kind, subdivisions),
            avatar_path,
            contact_stiffness: 500_000.0,
            contact_clearance: 0.0,
            // Planar panels start outside the full avatar bounding box. The old
            // per-vertex silhouette warp could intersect face interiors.
            prearrange: false,
            quasistatic: true,
            solver: SolverSettings {
                dt: 1.0 / 240.0,
                damping: 20.0,
                newton_iterations: 30,
                pcg_iterations: 500,
                ..Default::default()
            },
            simulation: None,
            state: None,
            mesh_signature: None,
            print_graphics: Vec::new(),
            imported_hardware: Vec::new(),
        }
    }
    pub fn load(path: &Path) -> Result<Self, String> {
        let mut project: Self =
            serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if project.avatar_path.is_relative() {
            project.avatar_path = path
                .parent()
                .unwrap_or(Path::new("."))
                .join(&project.avatar_path);
        }
        project.validate_print_graphics(&project.print_graphics)?;
        project.validate_imported_hardware(&project.imported_hardware)?;
        Ok(project)
    }
    pub fn compile(&self) -> Result<FittingScene, String> {
        if self.version != 1 {
            return Err("Unsupported fitting project version".into());
        }
        self.solver.validate()?;
        if let Some(settings) = &self.simulation {
            settings.validate()?;
        }
        let garment = Arc::new(self.template.compile()?);
        if self.state.is_some()
            && self.mesh_signature.as_ref() != Some(&mesh_signature(&self.template, &garment)?)
        {
            return Err("Stale fitting cache: clear state and mesh_signature, then rebuild".into());
        }
        let surface = Arc::new(SurfaceMesh::load_obj(&self.avatar_path)?);
        let collider = Arc::new(MeshCollider::with_clearance(
            surface,
            self.contact_stiffness,
            self.contact_clearance,
        )?);
        let mut state = self
            .state
            .clone()
            .unwrap_or_else(|| garment.initial_state.clone());
        if self.state.is_none() && self.prearrange {
            for (panel, range) in self.template.panels.iter().zip(&garment.panels) {
                let Some(polygon) = &panel.polygon else {
                    continue;
                };
                let names: Vec<_> = self
                    .template
                    .seams
                    .iter()
                    .flat_map(|s| s.references())
                    .filter(|r| r.panel == panel.id)
                    .filter_map(|r| r.edge.as_ref())
                    .collect();
                let curves: Vec<_> = names
                    .iter()
                    .map(|name| {
                        polygon.edge_points(polygon.edges.iter().position(|e| e == *name).unwrap())
                    })
                    .collect::<Result<_, _>>()?;
                let side = panel.placement.translation.z.signum();
                for i in range.vertices.clone() {
                    let uv = garment.mesh.uv[i];
                    let mut distance = f64::INFINITY;
                    for curve in &curves {
                        for pair in curve.windows(2) {
                            let (a, b) = (pair[0], pair[1]);
                            let d = b - a;
                            let t = ((uv - a).dot(d) / d.length_squared()).clamp(0., 1.);
                            distance = distance.min(uv.distance(a + t * d));
                        }
                    }
                    let s = (distance / 0.075).clamp(0.0, 1.0);
                    let smooth = s * s * (3.0 - 2.0 * s);
                    let mut z = side * (0.004 + panel.placement.translation.z.abs() * smooth);
                    if let Some([lo, hi]) = collider.z_bounds(state.x[i].x, state.x[i].y) {
                        z = if side > 0.0 {
                            z.max(hi + 0.008)
                        } else {
                            z.min(lo - 0.008)
                        };
                    }
                    state.x[i].z = z;
                }
            }
        }
        if state.x.len() != garment.mesh.uv.len()
            || state.v.len() != state.x.len()
            || !state.time.is_finite()
            || state.x.iter().chain(&state.v).any(|p| !p.is_finite())
        {
            return Err("Invalid cached fitting state".into());
        }
        Ok(FittingScene {
            garment,
            collider,
            state,
            quasistatic: self.quasistatic,
            next_dt: self.solver.dt,
        })
    }
    pub fn save(&self, path: &Path) -> Result<(), String> {
        if self.version != 1 {
            return Err("Unsupported fitting project version".into());
        }
        self.solver.validate()?;
        if let Some(settings) = &self.simulation {
            settings.validate()?;
        }
        self.validate_print_graphics(&self.print_graphics)?;
        self.validate_imported_hardware(&self.imported_hardware)?;
        let mut copy = self.clone();
        let garment = copy.template.compile()?;
        copy.mesh_signature = if copy.state.is_some() {
            Some(mesh_signature(&copy.template, &garment)?)
        } else {
            None
        };
        // Validate cached data before replacing a previously valid document.
        if let Some(state) = &copy.state {
            let n = garment.mesh.uv.len();
            if state.x.len() != n
                || state.v.len() != n
                || !state.time.is_finite()
                || state.x.iter().chain(&state.v).any(|p| !p.is_finite())
            {
                return Err("Invalid fitting state; existing document was preserved".into());
            }
        }
        copy.avatar_path = crate::document::portable_avatar(&self.avatar_path, path)?;
        let bytes = serde_json::to_vec_pretty(&copy).map_err(|e| e.to_string())?;
        crate::document::atomic_write(path, &bytes)
    }
}

fn mesh_signature(template: &GarmentTemplate, g: &CompiledGarment) -> Result<String, String> {
    // Stable FNV-1a fingerprint, not a security/integrity hash.
    let mut hash = 0xcbf29ce484222325_u64;
    let mut append = |bytes: &[u8]| {
        for b in bytes {
            hash ^= u64::from(*b);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    };
    let mut physical_template = template.clone();
    for panel in &mut physical_template.panels {
        panel.layout_2d = None;
        panel.layout_rotation_degrees = 0.;
        if let Some(polygon) = panel.polygon.as_mut() {
            polygon.target_lengths.clear();
        }
    }
    append(&serde_json::to_vec(&physical_template).map_err(|e| e.to_string())?);
    for p in &g.mesh.uv {
        append(&p.x.to_le_bytes());
        append(&p.y.to_le_bytes());
    }
    for t in &g.mesh.triangles {
        for i in t.vertices {
            append(&(i as u64).to_le_bytes());
        }
    }
    Ok(format!("{hash:016x}"))
}

#[cfg(test)]
mod imported_hardware_tests {
    use super::*;
    #[test]
    fn placement_roundtrip_and_rejections() {
        let mut project=FittingProject::basic(GarmentKind::Tshirt,2,PathBuf::from("avatar.obj"));
        let item=ImportedHardware {
            id:"hw-1".into(),asset_id:"buttons/sample.glb".into(),panel:project.template.panels[0].id.clone(),
            kind:"button".into(),position_mm:[20.,30.,1.],rotation_degrees:[0.,0.,45.],scale:[1.,1.,1.],
            visible:true,color:"#ffbb00".into(),roughness:0.25,metalness:0.7,opacity:0.8,
            reflection_intensity:1.4,clearcoat:0.3,weight_grams:12.,material_type:"metal".into(),
        };
        project.validate_imported_hardware(&[item.clone()]).unwrap();
        project.imported_hardware.push(item.clone());
        let encoded=serde_json::to_string(&project).unwrap();
        assert!(encoded.contains("importedHardware"));
        let reopened: FittingProject=serde_json::from_str(&encoded).unwrap();
        assert_eq!(reopened.imported_hardware,vec![item.clone()]);
        assert!(project.validate_imported_hardware(&[item.clone(),item.clone()]).is_err());
        let mut invalid=item.clone();invalid.asset_id="../secret.glb".into();
        assert!(project.validate_imported_hardware(&[invalid]).is_err());
        let mut invalid=item.clone();invalid.scale=[f64::NAN,1.,1.];
        assert!(project.validate_imported_hardware(&[invalid]).is_err());
        let mut invalid=item;invalid.panel="missing".into();
        assert!(project.validate_imported_hardware(&[invalid]).is_err());
    }
}

#[cfg(test)]
mod print_graphics_tests {
    use super::*;
    fn sample() -> (FittingProject, PrintGraphic) {
        let project = FittingProject::basic(GarmentKind::Tshirt, 2, PathBuf::from("avatar.obj"));
        let graphic = PrintGraphic {
            id: "art-1".into(), name: "test".into(), panel: project.template.panels[0].id.clone(),
            data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XqkAAAAASUVORK5CYII=".into(),
            width: 1, height: 1, width_mm: 10., height_mm: 10., position_mm: [20., 30.],
            center: None, lock_aspect_ratio: true, rotation: 0., side: "front".into(), visible: true,
            opacity: 1., reflectivity: 0., metalness: 0., roughness: 0.88, ink_height_mm: 0.,
            color: "#ffffff".into(), display_map: "texture".into(), normal_map_data_url: None,
        };
        (project, graphic)
    }
    #[test]
    fn valid_graphics_roundtrip_and_reject_bad_dimensions() {
        let (mut p, graphic) = sample();
        p.validate_print_graphics(&[graphic.clone()]).unwrap();
        p.print_graphics.push(graphic.clone());
        let reopened: FittingProject = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        assert_eq!(reopened.print_graphics[0].position_mm, [20., 30.]);
        assert_eq!(reopened.print_graphics[0].width_mm, 10.);
        let encoded = serde_json::to_value(&p).unwrap();
        assert!(encoded["printGraphics"][0].get("displayedMap").is_some());
        assert!(encoded.get("print_graphics").is_none());
        let mut bad = graphic.clone(); bad.width_mm = f64::NAN;
        assert!(p.validate_print_graphics(&[bad]).is_err());
        let mut bad = graphic.clone(); bad.panel = "missing".into();
        assert!(p.validate_print_graphics(&[bad]).is_err());
        let mut bad = graphic.clone(); bad.data_url = "data:image/png;base64,AAAA".into();
        assert!(p.validate_print_graphics(&[bad]).is_err());
        assert!(p.validate_print_graphics(&[graphic.clone(), graphic]).is_err());
    }
}
