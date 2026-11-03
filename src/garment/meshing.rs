//! Constrained Delaunay refinement in a constant material-space metric.
//! Contours are constraints; named edges are recovered after Steiner insertion.
use glam::DVec2;
use serde::{Deserialize, Serialize};
use spade::{
    AngleLimit, ConstrainedDelaunayTriangulation, Point2, RefinementParameters, Triangulation,
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeshingSettings {
    /// Nominal equilateral edge size. The enforced bound is on triangle area.
    pub target_edge_m: f64,
    /// Ratio of spacing along axis_degrees to spacing perpendicular to it.
    #[serde(default = "one")]
    pub anisotropy: f64,
    #[serde(default)]
    pub axis_degrees: f64,
    #[serde(default = "angle")]
    pub min_angle_degrees: f64,
    #[serde(default = "budget")]
    pub max_vertices: usize,
    /// Optional, static sizing plan. Evaluated only when compiling a rest mesh.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub physics_sizing: Option<crate::mesh_resolution::preparation::PhysicsSizing>,
}
fn one() -> f64 {
    1.0
}
fn angle() -> f64 {
    25.0
}
fn budget() -> usize {
    20_000
}
impl Default for MeshingSettings {
    fn default() -> Self {
        Self {
            target_edge_m: 0.025,
            anisotropy: one(),
            axis_degrees: 0.0,
            min_angle_degrees: angle(),
            max_vertices: budget(),
            physics_sizing: None,
        }
    }
}
impl MeshingSettings {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(plan) = &self.physics_sizing {
            plan.validate()?;
        }
        if !self.target_edge_m.is_finite()
            || !(0.003..=0.5).contains(&self.target_edge_m)
            || !self.anisotropy.is_finite()
            || !(1.0..=4.0).contains(&self.anisotropy)
            || !self.axis_degrees.is_finite()
            || !self.min_angle_degrees.is_finite()
            || !(15.0..=30.0).contains(&self.min_angle_degrees)
            || !(64..=100_000).contains(&self.max_vertices)
        {
            return Err("Invalid meshing settings: size 3..500 mm, anisotropy 1..4, angle 15..30 degrees, budget 64..100000".into());
        }
        Ok(())
    }
    pub fn to_metric(&self, p: DVec2) -> DVec2 {
        if let Some(plan) = &self.physics_sizing
            && let Ok(base) = plan.base()
        {
            let (s, c) = plan.axis_degrees.to_radians().sin_cos();
            return DVec2::new(
                (c * p.x + s * p.y) / base[0],
                (-s * p.x + c * p.y) / base[1],
            );
        }
        let (s, c) = self.axis_degrees.to_radians().sin_cos();
        DVec2::new(
            (c * p.x + s * p.y) / (self.target_edge_m * self.anisotropy),
            (-s * p.x + c * p.y) / self.target_edge_m,
        )
    }
    fn material_point(&self, q: DVec2) -> DVec2 {
        let (s, c) = self.axis_degrees.to_radians().sin_cos();
        let p = q * DVec2::new(self.target_edge_m * self.anisotropy, self.target_edge_m);
        DVec2::new(c * p.x - s * p.y, s * p.x + c * p.y)
    }
}
pub struct TriangulatedContour {
    pub uv: Vec<DVec2>,
    pub faces: Vec<[usize; 3]>,
    pub boundaries: BTreeMap<String, Vec<usize>>,
}

#[derive(Debug, Serialize)]
pub struct MeshQuality {
    pub triangles: usize,
    pub min_angle_degrees: f64,
    pub min_metric_angle_degrees: f64,
    pub median_edge_m: f64,
    pub max_edge_m: f64,
    pub max_triangle_area_m2: f64,
    pub max_metric_triangle_area: f64,
}
pub fn quality(triangles: &[crate::model::Triangle], settings: &MeshingSettings) -> MeshQuality {
    let mut result = MeshQuality {
        triangles: triangles.len(),
        min_angle_degrees: 180.0,
        min_metric_angle_degrees: 180.0,
        median_edge_m: 0.0,
        max_edge_m: 0.0,
        max_triangle_area_m2: 0.0,
        max_metric_triangle_area: 0.0,
    };
    let mut lengths = vec![];
    for t in triangles {
        let metric = t.rest.map(|p| settings.to_metric(p));
        result.max_triangle_area_m2 = result.max_triangle_area_m2.max(t.area);
        result.max_metric_triangle_area = result.max_metric_triangle_area.max(
            (metric[1] - metric[0])
                .perp_dot(metric[2] - metric[0])
                .abs()
                * 0.5,
        );
        for i in 0..3 {
            let a = t.rest[(i + 1) % 3] - t.rest[i];
            let b = t.rest[(i + 2) % 3] - t.rest[i];
            lengths.push(a.length());
            result.min_angle_degrees = result
                .min_angle_degrees
                .min(a.angle_to(b).abs().to_degrees());
            let a = metric[(i + 1) % 3] - metric[i];
            let b = metric[(i + 2) % 3] - metric[i];
            result.min_metric_angle_degrees = result
                .min_metric_angle_degrees
                .min(a.angle_to(b).abs().to_degrees());
        }
    }
    lengths.sort_by(f64::total_cmp);
    if !lengths.is_empty() {
        result.median_edge_m = lengths[lengths.len() / 2];
        result.max_edge_m = *lengths.last().unwrap();
    }
    result
}

/// The caller validates the simple CCW contour before entering this routine.
pub fn triangulate(
    points: &[DVec2],
    names: &[String],
    settings: &MeshingSettings,
) -> Result<TriangulatedContour, String> {
    triangulate_domain(points, names, &[], &[], settings)
}

/// Internal constraints do not delimit material. With holes/lines, refine the
/// hull then select faces by the validated material domain, never by crossing
/// an arbitrary constraint. Boundary-only legacy inputs keep the old path.
pub fn triangulate_domain(
    points: &[DVec2],
    names: &[String],
    holes: &[super::domain::Hole],
    lines: &[super::domain::InternalLine],
    settings: &MeshingSettings,
) -> Result<TriangulatedContour, String> {
    settings.validate()?;
    if let Some(plan) = &settings.physics_sizing {
        return crate::mesh_resolution::preparation::triangulate(
            points, names, holes, lines, settings, plan,
        );
    }
    let metric: Vec<_> = points.iter().map(|p| settings.to_metric(*p)).collect();
    let mut cdt = ConstrainedDelaunayTriangulation::<Point2<f64>>::new();
    let mut handles = vec![];
    for i in 0..points.len() {
        let a = metric[i];
        let b = metric[(i + 1) % points.len()];
        let count = a.distance(b).ceil().max(1.0) as usize;
        if handles.len().saturating_add(count) > settings.max_vertices {
            return Err("Contour exceeds meshing vertex budget".into());
        }
        for k in 0..count {
            let p = a.lerp(b, k as f64 / count as f64);
            handles.push(
                cdt.insert(Point2::new(p.x, p.y))
                    .map_err(|e| e.to_string())?,
            );
        }
    }
    for i in 0..handles.len() {
        cdt.add_constraint(handles[i], handles[(i + 1) % handles.len()]);
    }
    let mut paths: Vec<(String, Vec<DVec2>)> = vec![];
    for hole in holes {
        for (i, name) in hole.edges.iter().enumerate() {
            paths.push((
                name.clone(),
                vec![hole.points[i], hole.points[(i + 1) % hole.points.len()]],
            ));
        }
    }
    for line in lines {
        paths.push((line.id.clone(), line.samples()?));
    }
    for (_, path) in &paths {
        for pair in path.windows(2) {
            let a = settings.to_metric(pair[0]);
            let b = settings.to_metric(pair[1]);
            let count = a.distance(b).ceil().max(1.) as usize;
            if cdt.num_vertices().saturating_add(count.saturating_add(1)) > settings.max_vertices {
                return Err("Internal constraints exceed meshing vertex budget".into());
            }
            let mut previous = None;
            for k in 0..=count {
                // Keep shared endpoints bit-identical; rounded lerp(1) can
                // otherwise create a near-duplicate constraint vertex.
                let q = if k == count {
                    b
                } else {
                    a.lerp(b, k as f64 / count as f64)
                };
                let next = cdt
                    .insert(Point2::new(q.x, q.y))
                    .map_err(|e| e.to_string())?;
                if let Some(prev) = previous {
                    if prev == next || !cdt.can_add_constraint(prev, next) {
                        return Err("Intersecting or degenerate material constraints".into());
                    }
                    cdt.add_constraint(prev, next);
                }
                previous = Some(next);
            }
        }
    }
    let legacy = holes.is_empty() && lines.is_empty();
    if !legacy {
        // The material boundary must not nearly coincide with the hull during
        // full-domain refinement. Rotated/rounded collinear samples otherwise
        // form vanishing angles between hull and constraints and cause runaway
        // encroachment. An external frame separates them without moving cloth.
        if cdt.num_vertices().saturating_add(4) > settings.max_vertices {
            return Err("Domain frame exceeds meshing vertex budget".into());
        }
        let lo = metric
            .iter()
            .copied()
            .fold(DVec2::splat(f64::INFINITY), DVec2::min)
            - DVec2::splat(2.);
        let hi = metric
            .iter()
            .copied()
            .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max)
            + DVec2::splat(2.);
        for p in [lo, DVec2::new(hi.x, lo.y), hi, DVec2::new(lo.x, hi.y)] {
            cdt.insert(Point2::new(p.x, p.y))
                .map_err(|e| e.to_string())?;
        }
    }
    let material_face = |p: [Point2<f64>; 3]| {
        if legacy {
            return true;
        }
        let q = settings.material_point(DVec2::new(
            (p[0].x + p[1].x + p[2].x) / 3.,
            (p[0].y + p[1].y + p[2].y) / 3.,
        ));
        super::domain::inside(q, points)
            && !holes.iter().any(|h| super::domain::inside(q, &h.points))
    };
    let mut excluded = BTreeSet::new();
    let mut complete = false;
    for _ in 0..8 {
        let parameters = RefinementParameters::new()
            .exclude_outer_faces(legacy)
            .with_max_allowed_area(3.0_f64.sqrt() / 4.0)
            .with_angle_limit(AngleLimit::from_deg(settings.min_angle_degrees))
            .with_max_additional_vertices(settings.max_vertices.saturating_sub(cdt.num_vertices()));
        let result = cdt.refine(parameters);
        if !result.refinement_complete {
            return Err(format!(
                "Delaunay refinement incomplete at {} / {} vertices; increase target size or budget",
                cdt.num_vertices(),
                settings.max_vertices
            ));
        }
        excluded = result.excluded_faces.iter().map(|f| f.index()).collect();
        // A refinement pass can leave newly formed triangles over the requested
        // area. Check the actual postcondition and seed their centroids explicitly.
        let oversized: Vec<_> = cdt
            .inner_faces()
            .filter(|f| {
                !excluded.contains(&f.index())
                    && material_face(f.vertices().map(|v| v.position()))
                    && f.area() > 3.0_f64.sqrt() / 4.0 * (1.0 + 1e-10)
            })
            .map(|f| {
                let p = f.vertices().map(|v| v.position());
                Point2::new(
                    (p[0].x + p[1].x + p[2].x) / 3.0,
                    (p[0].y + p[1].y + p[2].y) / 3.0,
                )
            })
            .collect();
        if oversized.is_empty() {
            complete = true;
            break;
        }
        if cdt.num_vertices() + oversized.len() > settings.max_vertices {
            return Err("Delaunay area refinement exceeds vertex budget".into());
        }
        for p in oversized {
            cdt.insert(p).map_err(|e| e.to_string())?;
        }
    }
    if !complete {
        return Err("Delaunay refinement did not satisfy the requested area bound".into());
    }
    let raw_faces: Vec<_> = cdt
        .inner_faces()
        .filter(|f| {
            !excluded.contains(&f.index()) && material_face(f.vertices().map(|v| v.position()))
        })
        .map(|f| f.vertices().map(|v| v.index()))
        .collect();
    let used: BTreeSet<_> = raw_faces.iter().flatten().copied().collect();
    let mut remap = BTreeMap::new();
    let mut uv = vec![];
    for v in cdt.vertices() {
        if used.contains(&v.index()) {
            remap.insert(v.index(), uv.len());
            let p = v.position();
            uv.push(settings.material_point(DVec2::new(p.x, p.y)));
        }
    }
    let faces = raw_faces
        .into_iter()
        .map(|f| f.map(|i| remap[&i]))
        .collect();
    let mut boundaries = BTreeMap::new();
    for i in 0..points.len() {
        let a = points[i];
        let d = points[(i + 1) % points.len()] - a;
        let mut edge: Vec<_> = uv
            .iter()
            .enumerate()
            .filter_map(|(j, p)| {
                let t = (*p - a).dot(d) / d.length_squared();
                ((-1e-9..=1.0 + 1e-9).contains(&t) && (*p - a - t * d).length() < 1e-9)
                    .then_some((t, j))
            })
            .collect();
        edge.sort_by(|a, b| a.0.total_cmp(&b.0));
        if edge.len() < 2 {
            return Err("Missing refined contour edge".into());
        }
        boundaries.insert(names[i].clone(), edge.into_iter().map(|(_, j)| j).collect());
    }
    for (name, path) in paths {
        let mut chain = vec![];
        for pair in path.windows(2) {
            let (a, d) = (pair[0], pair[1] - pair[0]);
            let mut edge: Vec<_> = uv
                .iter()
                .enumerate()
                .filter_map(|(i, p)| {
                    let t = (*p - a).dot(d) / d.length_squared();
                    ((-1e-9..=1. + 1e-9).contains(&t) && (*p - a - t * d).length() < 1e-9)
                        .then_some((t, i))
                })
                .collect();
            edge.sort_by(|a, b| a.0.total_cmp(&b.0));
            if edge.len() < 2 {
                return Err("Missing internal constraint segment".into());
            }
            let ids: Vec<_> = edge.into_iter().map(|(_, i)| i).collect();
            if chain.is_empty() {
                chain.extend(ids);
            } else {
                if chain.last() != ids.first() {
                    return Err("Disconnected internal constraint".into());
                }
                chain.extend_from_slice(&ids[1..]);
            }
        }
        boundaries.insert(name, chain);
    }
    Ok(TriangulatedContour {
        uv,
        faces,
        boundaries,
    })
}
