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
    physical_template.mirror_links.clear();
    physical_template.fabric_appearance.clear();
    physical_template.graphics.clear();
    physical_template.trims.clear();
    for panel in &mut physical_template.panels {
        panel.layout_2d = None;
        panel.layout_rotation_degrees = 0.;
        if let Some(polygon) = panel.polygon.as_mut() {
            polygon.target_lengths.clear();
            polygon.seam_allowances.clear();
            polygon.notches.clear();
            polygon.measurements.clear();
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
