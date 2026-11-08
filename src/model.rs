use glam::{DMat2, DVec2, DVec3};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Material {
    /// Membrane coefficients (N/m); axial values are asymptotic tension moduli.
    /// Shear uses engineering shear Fw dot Ff. See docs/research.md for the smoothing.
    pub warp: f64,
    pub weft: f64,
    pub shear: f64,
    pub compression_ratio: f64,
    /// Smooth transition width in Green strain; gives C2 energy at rest.
    pub compression_transition: f64,
    /// Flexural rigidities (N m), phenomenological directional hinge model.
    pub bend_warp: f64,
    pub bend_weft: f64,
    pub density: f64,
    pub thickness: f64,
    pub grain_degrees: f64,
}
impl Default for Material {
    fn default() -> Self {
        Self {
            warp: 350.0,
            weft: 180.0,
            shear: 45.0,
            compression_ratio: 0.15,
            compression_transition: 0.005,
            bend_warp: 0.00008,
            bend_weft: 0.00004,
            density: 0.2,
            thickness: 0.001,
            grain_degrees: 0.0,
        }
    }
}
impl Material {
    pub fn validate(&self) -> Result<(), String> {
        for (name, v) in [
            ("warp", self.warp),
            ("weft", self.weft),
            ("shear", self.shear),
            ("density", self.density),
            ("thickness", self.thickness),
            ("compression_transition", self.compression_transition),
        ] {
            if !v.is_finite() || v <= 0.0 {
                return Err(format!("{name} must be finite and positive"));
            }
        }
        if !self.grain_degrees.is_finite()
            || !self.compression_ratio.is_finite()
            || !(0.0..=1.0).contains(&self.compression_ratio)
            || [self.bend_warp, self.bend_weft]
                .iter()
                .any(|v| !v.is_finite() || *v < 0.0)
        {
            return Err("Invalid bending, compression or grain parameter".into());
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, clap::ValueEnum)]
pub enum Scene {
    Hanging,
    Sphere,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Pattern {
    pub width: f64,
    pub height: f64,
    pub nx: usize,
    pub ny: usize,
}
impl Default for Pattern {
    fn default() -> Self {
        Self {
            width: 1.0,
            height: 1.0,
            nx: 10,
            ny: 10,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Triangle {
    pub vertices: [usize; 3],
    pub rest: [DVec2; 3],
    pub inv_dm: DMat2,
    pub area: f64,
    pub material: usize,
}
#[derive(Clone, Debug)]
pub struct Hinge {
    /// Shared edge a,b then opposite vertices c,d. Normals: ab x ac, ad x ab.
    pub vertices: [usize; 4],
    pub weight: f64,
    pub across: DVec2,
    pub material: usize,
}
#[derive(Clone, Debug)]
pub struct Mesh {
    pub uv: Vec<DVec2>,
    pub triangles: Vec<Triangle>,
    pub hinges: Vec<Hinge>,
    pub rest_area: Vec<f64>,
    pub masses: Vec<f64>,
    pub pins: Vec<Option<DVec3>>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct State {
    pub x: Vec<DVec3>,
    pub v: Vec<DVec3>,
    pub time: f64,
}

impl Pattern {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if !self.width.is_finite()
            || !self.height.is_finite()
            || !(0.01..=100.0).contains(&self.width)
            || !(0.01..=100.0).contains(&self.height)
            || self.nx == 0
            || self.ny == 0
            || self.nx > 128
            || self.ny > 128
        {
            return Err(
                "Pattern requires dimensions in 0.01..100 m and 1..128 cells per axis".into(),
            );
        }
        Ok(())
    }
    pub fn build(&self, material: &Material, scene: Scene) -> Result<(Mesh, State), String> {
        material.validate()?;
        self.validate()?;
        let n = (self.nx + 1) * (self.ny + 1);
        let mut mesh = Mesh {
            uv: Vec::with_capacity(n),
            triangles: vec![],
            hinges: vec![],
            rest_area: vec![0.0; n],
            masses: vec![0.0; n],
            pins: vec![None; n],
        };
        let mut x = vec![];
        for j in 0..=self.ny {
            for i in 0..=self.nx {
                let p = DVec2::new(
                    self.width * i as f64 / self.nx as f64,
                    self.height * j as f64 / self.ny as f64,
                );
                mesh.uv.push(p);
                x.push(match scene {
                    Scene::Hanging => DVec3::new(p.x - self.width * 0.5, 1.3 - p.y, 0.0),
                    Scene::Sphere => {
                        DVec3::new(p.x - self.width * 0.5, 0.65, p.y - self.height * 0.5)
                    }
                });
            }
        }
        for j in 0..self.ny {
            for i in 0..self.nx {
                let a = j * (self.nx + 1) + i;
                let b = a + 1;
                let c = a + self.nx + 1;
                let d = c + 1;
                // Alternate diagonals to reduce systematic directional mesh bias.
                let faces = if (i + j) % 2 == 0 {
                    [[a, b, d], [a, d, c]]
                } else {
                    [[a, b, c], [b, d, c]]
                };
                for vertices in faces {
                    let rest = vertices.map(|v| mesh.uv[v]);
                    let dm = DMat2::from_cols(rest[1] - rest[0], rest[2] - rest[0]);
                    let area = 0.5 * dm.determinant().abs();
                    for v in vertices {
                        mesh.rest_area[v] += area / 3.0;
                    }
                    mesh.triangles.push(Triangle {
                        vertices,
                        rest,
                        inv_dm: dm.inverse(),
                        area,
                        material: 0,
                    });
                }
            }
        }
        let mut edges = BTreeMap::<(usize, usize), (usize, f64)>::new();
        for t in &mesh.triangles {
            let [a, b, c] = t.vertices;
            for (a, b, c) in [(a, b, c), (b, c, a), (c, a, b)] {
                let key = (a.min(b), a.max(b));
                if let Some((d, area)) = edges.remove(&key) {
                    let edge = mesh.uv[b] - mesh.uv[a];
                    let across = DVec2::new(-edge.y, edge.x).normalize();
                    mesh.hinges.push(Hinge {
                        vertices: [a, b, c, d],
                        weight: 3.0 * edge.length_squared() / (area + t.area),
                        across,
                        material: 0,
                    });
                } else {
                    edges.insert(key, (c, t.area));
                }
            }
        }
        for i in 0..n {
            mesh.masses[i] = mesh.rest_area[i] * material.density;
        }
        if scene == Scene::Hanging {
            mesh.pins[0] = Some(x[0]);
            mesh.pins[self.nx] = Some(x[self.nx]);
        }
        Ok((
            mesh,
            State {
                x,
                v: vec![DVec3::ZERO; n],
                time: 0.0,
            },
        ))
    }
}
