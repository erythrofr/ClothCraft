use crate::{
    contact::Sphere,
    garment::{meshing::MeshingSettings, polygon::PolygonPattern},
    mesh_resolution::preparation::PhysicsSizing,
    model::{Material, Mesh, Pattern, Scene, State},
    solver::SolverSettings,
};
use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fmt::Write as _, fs, path::Path};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Project {
    pub version: u32,
    pub pattern: Pattern,
    pub material: Material,
    pub solver: SolverSettings,
    pub scene: Scene,
    pub sphere: Option<Sphere>,
    /// Optional one-time rest meshing; absent in historical v1 projects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub physics_sizing: Option<PhysicsSizing>,
}
impl Default for Project {
    fn default() -> Self {
        Self {
            version: 1,
            pattern: Pattern::default(),
            material: Material::default(),
            solver: SolverSettings::default(),
            scene: Scene::Sphere,
            sphere: Some(Sphere::default()),
            physics_sizing: None,
        }
    }
}
impl Project {
    pub fn build(&self) -> Result<(Mesh, State), String> {
        if self.version != 1 {
            return Err(format!("Unsupported project version {}", self.version));
        }
        self.solver.validate()?;
        if let Some(s) = &self.sphere {
            s.validate()?;
        }
        let Some(plan) = &self.physics_sizing else {
            return self.pattern.build(&self.material, self.scene);
        };
        self.pattern.validate()?;
        let mut plan = plan.clone();
        plan.bending_nm = [self.material.bend_warp, self.material.bend_weft];
        plan.axis_degrees = self.material.grain_degrees;
        let pattern = PolygonPattern {
            points: vec![
                DVec2::ZERO,
                DVec2::new(self.pattern.width, 0.),
                DVec2::new(self.pattern.width, self.pattern.height),
                DVec2::new(0., self.pattern.height),
            ],
            edges: ["top", "right", "bottom", "left"]
                .map(str::to_owned)
                .to_vec(),
            subdivisions: 0,
            meshing: Some(MeshingSettings {
                physics_sizing: Some(plan),
                ..Default::default()
            }),
            curves: BTreeMap::new(),
            holes: vec![],
            lines: vec![],
            target_lengths: BTreeMap::new(),
        };
        let compiled = pattern.build(&self.material)?;
        let mut mesh = compiled.mesh;
        let x: Vec<_> = mesh
            .uv
            .iter()
            .map(|p| match self.scene {
                Scene::Hanging => DVec3::new(p.x - self.pattern.width * 0.5, 1.3 - p.y, 0.),
                Scene::Sphere => DVec3::new(
                    p.x - self.pattern.width * 0.5,
                    0.65,
                    p.y - self.pattern.height * 0.5,
                ),
            })
            .collect();
        if self.scene == Scene::Hanging {
            let top = &compiled.boundaries["top"];
            for &i in [top.first().unwrap(), top.last().unwrap()] {
                mesh.pins[i] = Some(x[i]);
            }
        }
        let v = vec![DVec3::ZERO; x.len()];
        Ok((mesh, State { x, v, time: 0. }))
    }
    pub fn load(path: &Path) -> Result<Self, String> {
        let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let project: Self = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        project.build()?;
        Ok(project)
    }
    /// Stores the editable rest model and settings, not a transient simulation cache.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        self.build()?;
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())
    }
}

pub fn obj(mesh: &Mesh, state: &State) -> String {
    let mut out = String::from(
        "# MARVELOUS CLOTH; positions in metres; vt = pattern coordinates in metres\no cloth\n",
    );
    for p in &state.x {
        writeln!(out, "v {:.12} {:.12} {:.12}", p.x, p.y, p.z).unwrap();
    }
    for p in &mesh.uv {
        writeln!(out, "vt {:.12} {:.12}", p.x, p.y).unwrap();
    }
    for t in &mesh.triangles {
        let [a, b, c] = t.vertices.map(|i| i + 1);
        writeln!(out, "f {a}/{a} {b}/{b} {c}/{c}").unwrap();
    }
    out
}
