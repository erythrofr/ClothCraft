//! Persistent material coordinates -> transient barycentric attachments.
//! Useful for grain guides, future decorative yarns or surface landmarks.
//! These attachments introduce no additional mechanical degrees of freedom.
use super::CompiledGarment;
use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MaterialPath {
    pub panel: String,
    pub points: Vec<DVec2>,
}

/// Rebuild after remeshing. Never persist these vertex indices as authoring data.
#[derive(Clone, Debug)]
pub struct EmbeddedPoint {
    pub vertices: [usize; 3],
    pub weights: [f64; 3],
    pub uv: DVec2,
}
impl EmbeddedPoint {
    pub fn evaluate(&self, x: &[DVec3]) -> Result<DVec3, String> {
        if self.vertices.iter().any(|i| *i >= x.len()) {
            return Err("Attachment does not belong to this state".into());
        }
        let p = self
            .vertices
            .iter()
            .zip(self.weights)
            .map(|(i, w)| x[*i] * w)
            .sum::<DVec3>();
        if !p.is_finite() {
            return Err("Non-finite attachment position".into());
        }
        Ok(p)
    }
}
fn weights(g: &CompiledGarment, triangle: usize, uv: DVec2) -> [f64; 3] {
    let t = &g.mesh.triangles[triangle];
    let b = t.inv_dm * (uv - t.rest[0]);
    [1.0 - b.x - b.y, b.x, b.y]
}

/// An ephemeral material-space index. It is rebuilt for each bounded path and
/// never persisted or used as a collision structure.
struct MaterialIndex {
    tree: crate::ogc::bvh::Bvh,
    nodes: Vec<crate::ogc::bvh::NodeView>,
    bounds: Vec<crate::ogc::bvh::Bounds>,
    first: usize,
}

const MATERIAL_WORK_LIMIT: usize = 8_000_000;
fn charge(work: &mut usize, amount: usize) -> Result<(), String> {
    *work = work.saturating_add(amount);
    if *work > MATERIAL_WORK_LIMIT {
        return Err("Material path exceeded its work limit".into());
    }
    Ok(())
}

impl MaterialIndex {
    fn new(g: &CompiledGarment, range: std::ops::Range<usize>) -> Result<Self, String> {
        use crate::ogc::bvh::{Bounds, Bvh};
        if range.len() > 100_000 {
            return Err("Material path exceeds the triangle limit".into());
        }
        let mut bounds = Vec::with_capacity(range.len());
        for i in range.clone() {
            let triangle = &g.mesh.triangles[i];
            let [a, b, c] = triangle.rest;
            let scale = a.abs().max(b.abs()).max(c.abs()).max_element().max(1.);
            let size = (b - a).length().max((c - a).length()).max((c - b).length());
            let determinant = (b - a).perp_dot(c - a).abs();
            let mapped_u = triangle.inv_dm * (b - a);
            let mapped_v = triangle.inv_dm * (c - a);
            if !a.is_finite()
                || !b.is_finite()
                || !c.is_finite()
                || scale > 1e6
                || !size.is_finite()
                || determinant <= size * size * 1e-6
                || !triangle.inv_dm.is_finite()
                || !mapped_u.is_finite()
                || !mapped_v.is_finite()
                || (mapped_u - DVec2::X).length() > 1e-8
                || (mapped_v - DVec2::Y).length() > 1e-8
            {
                return Err(
                    "Material path index requires finite, well-conditioned triangles".into(),
                );
            }
            // Conservatively include numerical and barycentric boundary tolerances.
            bounds.push(
                Bounds::points([a.extend(0.), b.extend(0.), c.extend(0.)]).inflate(scale * 1e-6),
            );
        }
        let tree = Bvh::new(&bounds, &vec![true; bounds.len()]);
        let nodes = tree.nodes().collect();
        Ok(Self {
            tree,
            nodes,
            bounds,
            first: range.start,
        })
    }

    fn point(
        &self,
        g: &CompiledGarment,
        panel: &str,
        uv: DVec2,
        work: &mut usize,
    ) -> Result<EmbeddedPoint, String> {
        use crate::ogc::bvh::Bounds;
        if !uv.is_finite() {
            return Err("Non-finite material coordinate".into());
        }
        let query = Bounds::points([uv.extend(0.)]);
        let mut best: Option<(usize, [f64; 3])> = None;
        let mut index = 0;
        while index < self.nodes.len() {
            charge(work, 1)?;
            let node = &self.nodes[index];
            if !node.bounds.overlaps(query) {
                index = node.escape;
                continue;
            }
            if node.children.is_none() {
                for &id in &self.tree.primitive_order()[node.start..node.end] {
                    charge(work, 1)?;
                    if !self.bounds[id].overlaps(query) {
                        continue;
                    }
                    let triangle = self.first + id;
                    if best.as_ref().is_some_and(|(old, _)| triangle >= *old) {
                        continue;
                    }
                    let w = weights(g, triangle, uv);
                    if w.iter().all(|v| *v >= -1e-10 && *v <= 1.0 + 1e-10) {
                        best = Some((triangle, w));
                    }
                }
            }
            index += 1;
        }
        let Some((triangle, weights)) = best else {
            return Err(format!("Material coordinate {uv:?} outside panel {panel}"));
        };
        Ok(EmbeddedPoint {
            vertices: g.mesh.triangles[triangle].vertices,
            weights,
            uv,
        })
    }
}
impl CompiledGarment {
    /// Embed a path with bounded indexed point queries. Unusual or
    /// ill-conditioned meshes are rejected rather than approximated.
    pub fn embed_path_bounded(&self, path: &MaterialPath) -> Result<Vec<EmbeddedPoint>, String> {
        if path.points.len() < 2 || path.points.len() > 10_000 {
            return Err("Material path requires 2..10000 control points".into());
        }
        let range = self
            .panels
            .iter()
            .find(|p| p.id == path.panel)
            .ok_or_else(|| format!("Unknown panel {}", path.panel))?
            .triangles
            .clone();
        let index = MaterialIndex::new(self, range.clone())?;
        let mut work = 0;
        for &p in &path.points {
            index.point(self, &path.panel, p, &mut work)?;
        }
        let mut result = vec![index.point(self, &path.panel, path.points[0], &mut work)?];
        for segment in path.points.windows(2) {
            if segment[0].distance_squared(segment[1]) < 1e-24 {
                continue;
            }
            charge(&mut work, range.len())?;
            let breaks = self.material_breaks(range.clone(), segment[0], segment[1]);
            for interval in breaks.windows(2) {
                if result.len() >= 4096 {
                    return Err("Material path exceeds the attachment limit".into());
                }
                index.point(
                    self,
                    &path.panel,
                    segment[0].lerp(segment[1], (interval[0] + interval[1]) * 0.5),
                    &mut work,
                )?;
                result.push(index.point(
                    self,
                    &path.panel,
                    segment[0].lerp(segment[1], interval[1]),
                    &mut work,
                )?);
            }
        }
        Ok(result)
    }

    fn material_breaks(
        &self,
        triangles: std::ops::Range<usize>,
        start: DVec2,
        end: DVec2,
    ) -> Vec<f64> {
        let mut breaks = vec![0.0, 1.0];
        for triangle in triangles {
            let a = weights(self, triangle, start);
            let b = weights(self, triangle, end);
            let mut lo = 0.0_f64;
            let mut hi = 1.0_f64;
            for i in 0..3 {
                let slope = b[i] - a[i];
                if slope.abs() < 1e-14 {
                    if a[i] < -1e-10 {
                        hi = -1.0;
                        break;
                    }
                } else if slope > 0.0 {
                    lo = lo.max(-a[i] / slope);
                } else {
                    hi = hi.min(-a[i] / slope);
                }
            }
            if hi >= lo && lo <= 1.0 && hi >= 0.0 {
                breaks.extend([lo.max(0.0), hi.min(1.0)]);
            }
        }
        breaks.sort_by(f64::total_cmp);
        breaks.dedup_by(|a, b| (*a - *b).abs() < 1e-10);
        breaks
    }
    /// Boundary ties resolve to the first triangle in deterministic mesh order.
    pub fn embed_point(&self, panel: &str, uv: DVec2) -> Result<EmbeddedPoint, String> {
        if !uv.is_finite() {
            return Err("Non-finite material coordinate".into());
        }
        let range = self
            .panels
            .iter()
            .find(|p| p.id == panel)
            .ok_or_else(|| format!("Unknown panel {panel}"))?;
        for triangle in range.triangles.clone() {
            let w = weights(self, triangle, uv);
            if w.iter().all(|v| *v >= -1e-10 && *v <= 1.0 + 1e-10) {
                return Ok(EmbeddedPoint {
                    vertices: self.mesh.triangles[triangle].vertices,
                    weights: w,
                    uv,
                });
            }
        }
        Err(format!("Material coordinate {uv:?} outside panel {panel}"))
    }
    /// Split every segment at triangle crossings, so the attached path follows
    /// the piecewise-linear deformed surface even where it bends sharply.
    pub fn embed_path(&self, path: &MaterialPath) -> Result<Vec<EmbeddedPoint>, String> {
        if path.points.len() < 2 || path.points.len() > 10_000 {
            return Err("Material path requires 2..10000 control points".into());
        }
        for p in &path.points {
            self.embed_point(&path.panel, *p)?;
        }
        let range = self.panels.iter().find(|p| p.id == path.panel).unwrap();
        let mut result = vec![self.embed_point(&path.panel, path.points[0])?];
        for segment in path.points.windows(2) {
            if segment[0].distance_squared(segment[1]) < 1e-24 {
                continue;
            }
            let breaks = self.material_breaks(range.triangles.clone(), segment[0], segment[1]);
            for interval in breaks.windows(2) {
                // Reject paths crossing holes if arbitrary panels are added later.
                self.embed_point(
                    &path.panel,
                    segment[0].lerp(segment[1], (interval[0] + interval[1]) * 0.5),
                )?;
                result
                    .push(self.embed_point(&path.panel, segment[0].lerp(segment[1], interval[1]))?);
            }
        }
        Ok(result)
    }
}
