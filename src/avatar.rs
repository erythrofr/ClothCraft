//! Static OBJ avatar and BVH-accelerated vertex/surface penalty.
//! Sign uses local oriented normals: reliable near an oriented surface, not a
//! global inside/outside oracle for arbitrary open/intersecting meshes. No CCD.
pub mod diagnostics;
use crate::{contact::Collider, energy::Element};
use glam::{DMat3, DVec3};
use std::{fs, path::Path, sync::Arc};

#[derive(Clone, Debug)]
pub struct SurfaceMesh {
    pub vertices: Vec<DVec3>,
    pub triangles: Vec<[usize; 3]>,
}
impl SurfaceMesh {
    pub fn load_obj(path: &Path) -> Result<Self, String> {
        Self::parse_obj(&fs::read_to_string(path).map_err(|e| e.to_string())?)
    }
    pub fn parse_obj(text: &str) -> Result<Self, String> {
        let mut mesh = Self {
            vertices: vec![],
            triangles: vec![],
        };
        for (line_index, line) in text.lines().enumerate() {
            let tokens: Vec<_> = line
                .split('#')
                .next()
                .unwrap_or("")
                .split_whitespace()
                .collect();
            if tokens.is_empty() {
                continue;
            }
            let err = || format!("Invalid OBJ at line {}", line_index + 1);
            match tokens[0] {
                "v" => {
                    if tokens.len() < 4 {
                        return Err(err());
                    }
                    let x: Result<Vec<f64>, _> = tokens[1..4].iter().map(|v| v.parse()).collect();
                    let x = x.map_err(|_| err())?;
                    let p = DVec3::new(x[0], x[1], x[2]);
                    if !p.is_finite() {
                        return Err(err());
                    }
                    mesh.vertices.push(p);
                }
                "f" => {
                    if tokens.len() < 4 {
                        return Err(err());
                    }
                    let ids: Result<Vec<_>, String> = tokens[1..]
                        .iter()
                        .map(|v| {
                            let raw: isize = v
                                .split('/')
                                .next()
                                .unwrap_or("")
                                .parse()
                                .map_err(|_| err())?;
                            let i = if raw > 0 {
                                raw - 1
                            } else {
                                mesh.vertices.len() as isize + raw
                            };
                            if raw == 0 || i < 0 || i as usize >= mesh.vertices.len() {
                                return Err(err());
                            }
                            Ok(i as usize)
                        })
                        .collect();
                    let ids = ids?;
                    for k in 1..ids.len() - 1 {
                        mesh.triangles.push([ids[0], ids[k], ids[k + 1]]);
                    }
                }
                _ => {}
            }
        }
        mesh.validate()?;
        Ok(mesh)
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.vertices.is_empty()
            || self.triangles.is_empty()
            || self.vertices.iter().any(|v| !v.is_finite())
        {
            return Err("Empty/non-finite avatar".into());
        }
        for t in &self.triangles {
            if t.iter().any(|i| *i >= self.vertices.len()) {
                return Err("Invalid avatar index".into());
            }
            let [a, b, c] = t.map(|i| self.vertices[i]);
            if (b - a).cross(c - a).length_squared() < 1e-24 {
                return Err("Degenerate avatar triangle".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug)]
struct Node {
    min: DVec3,
    max: DVec3,
    start: usize,
    end: usize,
    children: Option<[usize; 2]>,
}
impl Node {
    fn intersects_ray(&self, origin: DVec3, direction: DVec3, max_t: f64) -> bool {
        let (mut near, mut far) = (0_f64, max_t);
        for axis in 0..3 {
            // Inclusive slabs keep silhouette and zero-thickness triangle boxes.
            let pad = 1e-10 * self.min[axis].abs().max(self.max[axis].abs()).max(1.);
            let (lo, hi) = (self.min[axis] - pad, self.max[axis] + pad);
            if direction[axis] == 0. {
                if origin[axis] < lo || origin[axis] > hi {
                    return false;
                }
            } else {
                let a = (lo - origin[axis]) / direction[axis];
                let b = (hi - origin[axis]) / direction[axis];
                near = near.max(a.min(b));
                far = far.min(a.max(b));
                if near > far {
                    return false;
                }
            }
        }
        true
    }
    fn distance2(&self, p: DVec3) -> f64 {
        (self.min - p)
            .max(p - self.max)
            .max(DVec3::ZERO)
            .length_squared()
    }
}
#[derive(Clone, Copy, Debug)]
enum Feature {
    Face,
    Edge(usize, usize),
    Vertex(usize),
}
#[derive(Clone, Copy, Debug)]
struct Closest {
    point: DVec3,
    triangle: usize,
    feature: Feature,
}

pub struct MeshCollider {
    pub surface: Arc<SurfaceMesh>,
    pub stiffness: f64,
    /// Additional numerical contact envelope outside the visible body, in metres.
    pub clearance: f64,
    order: Vec<usize>,
    nodes: Vec<Node>,
    face_normals: Vec<DVec3>,
    vertex_normals: Vec<DVec3>,
}
fn outer(v: DVec3) -> DMat3 {
    DMat3::from_cols(v * v.x, v * v.y, v * v.z)
}
impl MeshCollider {
    pub fn new(surface: Arc<SurfaceMesh>, stiffness: f64) -> Result<Self, String> {
        Self::with_clearance(surface, stiffness, 0.0)
    }
    pub fn with_clearance(
        surface: Arc<SurfaceMesh>,
        stiffness: f64,
        clearance: f64,
    ) -> Result<Self, String> {
        surface.validate()?;
        if !clearance.is_finite() || clearance < 0.0 {
            return Err("Invalid avatar clearance".into());
        }
        if !stiffness.is_finite() || stiffness <= 0.0 {
            return Err("Invalid avatar contact stiffness".into());
        }
        let mut normals = vec![DVec3::ZERO; surface.vertices.len()];
        let face_normals = surface
            .triangles
            .iter()
            .map(|t| {
                let [a, b, c] = t.map(|i| surface.vertices[i]);
                let normal = (b - a).cross(c - a);
                for i in t {
                    normals[*i] += normal;
                }
                normal.normalize()
            })
            .collect();
        for n in &mut normals {
            *n = n.normalize_or_zero();
        }
        let mut collider = Self {
            order: (0..surface.triangles.len()).collect(),
            surface,
            stiffness,
            clearance,
            nodes: vec![],
            face_normals,
            vertex_normals: normals,
        };
        collider.build_node(0, collider.order.len());
        Ok(collider)
    }
    fn build_node(&mut self, start: usize, end: usize) -> usize {
        let mut min = DVec3::splat(f64::INFINITY);
        let mut max = -min;
        for &i in &self.order[start..end] {
            for v in self.surface.triangles[i] {
                min = min.min(self.surface.vertices[v]);
                max = max.max(self.surface.vertices[v]);
            }
        }
        let id = self.nodes.len();
        self.nodes.push(Node {
            min,
            max,
            start,
            end,
            children: None,
        });
        if end - start > 8 {
            let extent = max - min;
            let axis = if extent.x >= extent.y && extent.x >= extent.z {
                0
            } else if extent.y >= extent.z {
                1
            } else {
                2
            };
            let middle = (start + end) / 2;
            let surface = &self.surface;
            self.order[start..end].select_nth_unstable_by(middle - start, |a, b| {
                let centroid = |i: usize| {
                    surface.triangles[i]
                        .iter()
                        .map(|v| surface.vertices[*v][axis])
                        .sum::<f64>()
                };
                centroid(*a).total_cmp(&centroid(*b)).then(a.cmp(b))
            });
            let left = self.build_node(start, middle);
            let right = self.build_node(middle, end);
            self.nodes[id].children = Some([left, right]);
        }
        id
    }
    fn triangle_closest(&self, i: usize, p: DVec3) -> Closest {
        let ids = self.surface.triangles[i];
        let [a, b, c] = ids.map(|i| self.surface.vertices[i]);
        let n = self.face_normals[i];
        let q = p - n * n.dot(p - a);
        let ab = b - a;
        let ac = c - a;
        let aq = q - a;
        let det = ab.cross(ac).length_squared();
        let u = (aq.dot(ab) * ac.length_squared() - aq.dot(ac) * ab.dot(ac)) / det;
        let v = (aq.dot(ac) * ab.length_squared() - aq.dot(ab) * ab.dot(ac)) / det;
        if u >= 0.0 && v >= 0.0 && u + v <= 1.0 {
            return Closest {
                point: q,
                triangle: i,
                feature: Feature::Face,
            };
        }
        let mut best = Closest {
            point: a,
            triangle: i,
            feature: Feature::Vertex(ids[0]),
        };
        let mut d = p.distance_squared(a);
        for (a, b) in [(ids[0], ids[1]), (ids[1], ids[2]), (ids[2], ids[0])] {
            let edge = self.surface.vertices[b] - self.surface.vertices[a];
            let t = (p - self.surface.vertices[a]).dot(edge) / edge.length_squared();
            let t = t.clamp(0.0, 1.0);
            let q = self.surface.vertices[a] + t * edge;
            let distance = p.distance_squared(q);
            if distance < d {
                d = distance;
                best = Closest {
                    point: q,
                    triangle: i,
                    feature: if t == 0.0 {
                        Feature::Vertex(a)
                    } else if t == 1.0 {
                        Feature::Vertex(b)
                    } else {
                        Feature::Edge(a, b)
                    },
                };
            }
        }
        best
    }
    fn nearest(&self, p: DVec3) -> Closest {
        let mut stack = vec![0];
        let mut best = self.triangle_closest(0, p);
        let mut distance = p.distance_squared(best.point);
        while let Some(i) = stack.pop() {
            let node = &self.nodes[i];
            if node.distance2(p) > distance {
                continue;
            }
            if let Some([a, b]) = node.children {
                if self.nodes[a].distance2(p) < self.nodes[b].distance2(p) {
                    stack.extend([b, a]);
                } else {
                    stack.extend([a, b]);
                }
            } else {
                for &t in &self.order[node.start..node.end] {
                    let q = self.triangle_closest(t, p);
                    let d = p.distance_squared(q.point);
                    if d < distance {
                        distance = d;
                        best = q;
                    }
                }
            }
        }
        best
    }
    fn differential(&self, p: DVec3) -> (f64, DVec3, DMat3) {
        let closest = self.nearest(p);
        let delta = p - closest.point;
        let d = delta.length();
        let (hint, projector) = match closest.feature {
            Feature::Face => {
                let n = self.face_normals[closest.triangle];
                return (delta.dot(n), n, DMat3::ZERO);
            }
            Feature::Edge(a, b) => {
                let e = (self.surface.vertices[b] - self.surface.vertices[a]).normalize();
                (
                    (self.vertex_normals[a] + self.vertex_normals[b]).normalize_or_zero(),
                    DMat3::IDENTITY - outer(e),
                )
            }
            Feature::Vertex(a) => (self.vertex_normals[a], DMat3::IDENTITY),
        };
        if d < 1e-12 {
            return (0.0, hint, DMat3::ZERO);
        }
        let sign = if delta.dot(hint) >= 0.0 { 1.0 } else { -1.0 };
        let n = delta / d;
        (sign * d, sign * n, (projector - outer(n)) * (sign / d))
    }
    pub fn signed_distance(&self, p: DVec3) -> f64 {
        self.differential(p).0
    }
    /// Visibility query on the original surface, not its collision envelope.
    /// `max_t` is a ray parameter (metres for a unit direction), strictly exclusive.
    pub fn occludes_ray(&self, origin: DVec3, direction: DVec3, max_t: f64) -> bool {
        if !origin.is_finite()
            || !direction.is_finite()
            || direction == DVec3::ZERO
            || max_t.is_nan()
            || max_t <= 0.
        {
            return false;
        }
        self.occludes_node(0, origin, direction, max_t)
    }
    fn occludes_node(&self, index: usize, origin: DVec3, direction: DVec3, max_t: f64) -> bool {
        let node = &self.nodes[index];
        if !node.intersects_ray(origin, direction, max_t) {
            return false;
        }
        if let Some([a, b]) = node.children {
            self.occludes_node(a, origin, direction, max_t)
                || self.occludes_node(b, origin, direction, max_t)
        } else {
            self.order[node.start..node.end].iter().any(|&i| {
                crate::picking::ray_triangle(
                    origin,
                    direction,
                    self.surface.triangles[i].map(|v| self.surface.vertices[v]),
                )
                .is_some_and(|(t, _)| t < max_t)
            })
        }
    }
    /// Extreme intersections of a line parallel to Z, for initial front/back
    /// arrangement only. This is not a time-stepping collision projection.
    pub fn z_bounds(&self, x: f64, y: f64) -> Option<[f64; 2]> {
        let mut span = [f64::INFINITY, f64::NEG_INFINITY];
        let mut stack = vec![0];
        while let Some(i) = stack.pop() {
            let n = &self.nodes[i];
            if x < n.min.x || x > n.max.x || y < n.min.y || y > n.max.y {
                continue;
            }
            if let Some(children) = n.children {
                stack.extend(children);
            } else {
                for &t in &self.order[n.start..n.end] {
                    let [a, b, c] = self.surface.triangles[t].map(|i| self.surface.vertices[i]);
                    let ab = (b - a).truncate();
                    let ac = (c - a).truncate();
                    let aq = glam::DVec2::new(x - a.x, y - a.y);
                    let det = ab.perp_dot(ac);
                    if det.abs() < 1e-14 {
                        continue;
                    }
                    let u = aq.perp_dot(ac) / det;
                    let v = ab.perp_dot(aq) / det;
                    if u >= -1e-10 && v >= -1e-10 && u + v <= 1.0 + 1e-10 {
                        let z = a.z + u * (b.z - a.z) + v * (c.z - a.z);
                        span[0] = span[0].min(z);
                        span[1] = span[1].max(z);
                    }
                }
            }
        }
        if span[0].is_finite() {
            Some(span)
        } else {
            None
        }
    }
}
impl Collider for MeshCollider {
    fn validate(&self) -> Result<(), String> {
        if self.stiffness.is_finite()
            && self.stiffness > 0.0
            && self.clearance.is_finite()
            && self.clearance >= 0.0
        {
            Ok(())
        } else {
            Err("Invalid contact stiffness".into())
        }
    }
    fn penetration(&self, p: DVec3, thickness: f64) -> f64 {
        (self.clearance + thickness * 0.5 - self.signed_distance(p)).max(0.0)
    }
    fn value(&self, p: DVec3, thickness: f64, area: f64) -> f64 {
        0.5 * self.stiffness * area * self.penetration(p, thickness).powi(2)
    }
    fn element(&self, vertex: usize, p: DVec3, thickness: f64, area: f64) -> Option<Element> {
        let (d, n, h) = self.differential(p);
        let gap = d - thickness * 0.5 - self.clearance;
        if gap >= 0.0 {
            return None;
        }
        let k = self.stiffness * area;
        let gradient = k * gap * n;
        let hessian = (outer(n) + gap * h) * k;
        Some(Element {
            dofs: (3 * vertex..3 * vertex + 3).collect(),
            energy: 0.5 * k * gap * gap,
            gradient: gradient.to_array().to_vec(),
            hessian: (0..3)
                .flat_map(|i| (0..3).map(move |j| hessian.col(j)[i]))
                .collect(),
        })
    }
}
