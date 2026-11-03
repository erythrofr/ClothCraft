//! Bounded, deterministic variable-spacing Poisson seeds and constrained CDT.
//! CDT uses a fixed base metric. Spatial sizing controls sampling/refinement,
//! not a claim of Delaunay optimality in a varying Riemannian metric.
use super::sizing::SizingMap;
use crate::garment::{domain, polygon::PolygonPattern};
use glam::DVec2;
use serde::{Deserialize, Serialize};
use spade::{AngleLimit, RefinementParameters};
use spade::{ConstrainedDelaunayTriangulation, Point2, Triangulation};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ring {
    pub points: Vec<DVec2>,
    pub edges: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Domain {
    pub outer: Ring,
    #[serde(default)]
    pub holes: Vec<Ring>,
    #[serde(default)]
    pub lines: BTreeMap<String, Vec<DVec2>>,
}
impl Domain {
    pub fn validate(&self) -> Result<(), String> {
        let r = &self.outer;
        if !(3..=4096).contains(&r.points.len())
            || r.edges.len() != r.points.len()
            || r.points
                .iter()
                .any(|p| !p.is_finite() || p.abs().max_element() > 100.)
            || domain::area(&r.points) <= 1e-8
        {
            return Err(
                "Outer ring needs 3..4096 finite CCW points within +/-100 m and matching names"
                    .into(),
            );
        }
        let valid_name = |s: &str| {
            !s.is_empty()
                && s.len() <= 80
                && s.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        };
        let names: BTreeSet<_> = r.edges.iter().collect();
        if names.len() != r.edges.len() || r.edges.iter().any(|s| !valid_name(s)) {
            return Err("Outer boundary names must be valid and unique".into());
        }
        for i in 0..r.points.len() {
            let a = r.points[i];
            let b = r.points[(i + 1) % r.points.len()];
            if a.distance(b) < 1e-6 {
                return Err("Outer segment is shorter than 1 um".into());
            }
            let c = r.points[(i + 2) % r.points.len()];
            if (b - a).perp_dot(c - b).abs() < 1e-12 && (b - a).dot(c - b) < 0. {
                return Err("Outer ring doubles back".into());
            }
            for j in i + 2..r.points.len() {
                if i == 0 && j == r.points.len() - 1 {
                    continue;
                }
                if intersects(a, b, r.points[j], r.points[(j + 1) % r.points.len()]) {
                    return Err("Outer ring intersects itself".into());
                }
            }
        }
        // Reuse the current domain validator, never its meshing defaults or
        // physical materials. Straight sampled paths are research inputs.
        let polygon = PolygonPattern {
            points: r.points.clone(),
            edges: r.edges.clone(),
            subdivisions: 0,
            meshing: None,
            curves: BTreeMap::new(),
            target_lengths: BTreeMap::new(),
            holes: self
                .holes
                .iter()
                .map(|h| domain::Hole {
                    points: h.points.clone(),
                    edges: h.edges.clone(),
                })
                .collect(),
            lines: self
                .lines
                .iter()
                .map(|(id, points)| domain::InternalLine {
                    id: id.clone(),
                    points: points.clone(),
                    tangents: vec![DVec2::ZERO; points.len()],
                })
                .collect(),
        };
        domain::validate(&polygon, &r.points)
    }
    pub fn contains(&self, p: DVec2) -> bool {
        domain::inside(p, &self.outer.points)
            && !self.holes.iter().any(|h| domain::inside(p, &h.points))
    }
    pub fn paths(&self) -> Vec<(String, Vec<DVec2>)> {
        let mut out = vec![];
        for r in std::iter::once(&self.outer).chain(&self.holes) {
            for (i, name) in r.edges.iter().enumerate() {
                out.push((
                    name.clone(),
                    vec![r.points[i], r.points[(i + 1) % r.points.len()]],
                ));
            }
        }
        out.extend(self.lines.iter().map(|(s, p)| (s.clone(), p.clone())));
        out
    }
    pub fn area(&self) -> f64 {
        domain::area(&self.outer.points)
            + self
                .holes
                .iter()
                .map(|h| domain::area(&h.points))
                .sum::<f64>()
    }
}
fn intersects(a: DVec2, b: DVec2, c: DVec2, d: DVec2) -> bool {
    let eps = 1e-12;
    if a.min(b).x > c.max(d).x + eps
        || c.min(d).x > a.max(b).x + eps
        || a.min(b).y > c.max(d).y + eps
        || c.min(d).y > a.max(b).y + eps
    {
        return false;
    }
    (b - a).perp_dot(c - a) * (b - a).perp_dot(d - a) <= eps * eps
        && (d - c).perp_dot(a - c) * (d - c).perp_dot(b - c) <= eps * eps
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Options {
    pub seed: u64,
    pub max_vertices: usize,
    pub candidates: usize,
    pub max_refinement_passes: usize,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            seed: 42,
            max_vertices: 20_000,
            candidates: 30,
            max_refinement_passes: 32,
        }
    }
}
impl Options {
    fn validate(&self) -> Result<(), String> {
        if !(64..=100_000).contains(&self.max_vertices)
            || !(1..=64).contains(&self.candidates)
            || !(1..=64).contains(&self.max_refinement_passes)
        {
            return Err(
                "Mesh options require 64..100000 vertices, 1..64 candidates and 1..64 passes"
                    .into(),
            );
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Quality {
    pub vertices: usize,
    pub triangles: usize,
    pub area_m2: f64,
    pub max_metric_area_bound: f64,
    pub min_metric_angle_degrees: f64,
    pub max_metric_edge_bound: f64,
    pub poisson_vertices: usize,
    pub refinement_vertices: usize,
}
#[derive(Clone, Debug, Serialize)]
pub struct Output {
    pub uv: Vec<DVec2>,
    pub faces: Vec<[usize; 3]>,
    /// Ordered directed chains, by research-input boundary ID. These indices
    /// belong to this rebuildable output mesh, not the editable document.
    pub boundaries: BTreeMap<String, Vec<usize>>,
    pub spacing_m: Vec<[f64; 2]>,
    pub quality: Quality,
}
pub const MAX_METRIC_AREA: f64 = 0.4330127018922193;

fn face_bound(map: &SizingMap, p: [DVec2; 3]) -> ([f64; 2], f64) {
    let center = (p[0] + p[1] + p[2]) / 3.;
    let radius = p.iter().map(|p| p.distance(center)).fold(0., f64::max);
    let h = map.lower_bound(center, radius);
    (
        h,
        (p[1] - p[0]).perp_dot(p[2] - p[0]).abs() / (2. * h[0] * h[1]),
    )
}

fn sampled_segment(
    a: DVec2,
    b: DVec2,
    map: &SizingMap,
    remaining: usize,
) -> Result<Vec<DVec2>, String> {
    let mut out = vec![a];
    let mut stack = vec![(a, b, 0)];
    while let Some((a, b, depth)) = stack.pop() {
        let h = map.lower_bound((a + b) * 0.5, a.distance(b) * 0.5);
        if map.metric_delta(b - a, h).length() <= 1. + 1e-12 {
            if out.len() >= remaining {
                return Err("Constraint sampling exceeds vertex budget".into());
            }
            out.push(b);
        } else {
            if depth >= 30 || out.len() + stack.len() >= remaining {
                return Err("Constraint sampling exceeds budget/depth".into());
            }
            let mid = (a + b) * 0.5;
            stack.push((mid, b, depth + 1));
            stack.push((a, mid, depth + 1));
        }
    }
    Ok(out)
}

struct Rng(u64);
impl Rng {
    fn unit(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / ((1_u64 << 53) as f64)
    }
}

/// Bridson-style active list with symmetric endpoint ellipse exclusion. The
/// uniform-radius O(N) proof does not extend to this variable-spacing variant.
fn poisson(
    domain: &Domain,
    map: &SizingMap,
    seeds: Vec<DVec2>,
    options: &Options,
    cancelled: &dyn Fn() -> bool,
) -> Result<Vec<DVec2>, String> {
    let cell = map.base().into_iter().fold(0., f64::max);
    let key = |p: DVec2| ((p.x / cell).floor() as i64, (p.y / cell).floor() as i64);
    let mut points = seeds;
    let mut grid = BTreeMap::<_, Vec<usize>>::new();
    let mut active: Vec<_> = (0..points.len()).collect();
    for (i, p) in points.iter().enumerate() {
        grid.entry(key(*p)).or_default().push(i);
    }
    let mut rng = Rng(options.seed.max(1));
    while !active.is_empty() {
        if cancelled() {
            return Err("Comparison cancelled".into());
        }
        let slot = (rng.unit() * active.len() as f64) as usize;
        let a = points[active[slot]];
        let h = map.spacing(a);
        let mut accepted = false;
        for _ in 0..options.candidates {
            let theta = rng.unit() * std::f64::consts::TAU;
            // Uniform annular area in the local metric (radius 1..2).
            let radius = (1. + 3. * rng.unit()).sqrt();
            let b = a + map
                .material_vector(DVec2::new(theta.cos() * h[0], theta.sin() * h[1]) * radius);
            if !domain.contains(b) {
                continue;
            }
            let hb = map.spacing(b);
            let (x, y) = key(b);
            let mut clear = true;
            for dx in -1..=1 {
                for dy in -1..=1 {
                    if let Some(ids) = grid.get(&(x + dx, y + dy)) {
                        for i in ids {
                            let d = b - points[*i];
                            if map.metric_delta(d, hb).length_squared() < 1.
                                || map
                                    .metric_delta(d, map.spacing(points[*i]))
                                    .length_squared()
                                    < 1.
                            {
                                clear = false;
                                break;
                            }
                        }
                    }
                }
            }
            if clear {
                if points.len() >= options.max_vertices {
                    return Err("Poisson sampling exceeds vertex budget".into());
                }
                grid.entry((x, y)).or_default().push(points.len());
                active.push(points.len());
                points.push(b);
                accepted = true;
                break;
            }
        }
        if !accepted {
            active.swap_remove(slot);
        }
    }
    Ok(points)
}

pub fn generate(domain: &Domain, map: &SizingMap, options: &Options) -> Result<Output, String> {
    generate_with_cancel(domain, map, options, &|| false)
}
pub fn generate_with_cancel(
    domain: &Domain,
    map: &SizingMap,
    options: &Options,
    cancelled: &dyn Fn() -> bool,
) -> Result<Output, String> {
    generate_with_quality(domain, map, options, cancelled, None)
}
/// Production preparation additionally requests angle refinement in the fixed
/// base metric. Size refinement still checks the entire spatial field.
pub fn generate_with_quality(
    domain: &Domain,
    map: &SizingMap,
    options: &Options,
    cancelled: &dyn Fn() -> bool,
    angle: Option<f64>,
) -> Result<Output, String> {
    if angle.is_some_and(|a| !a.is_finite() || !(15. ..=30.).contains(&a)) {
        return Err("Invalid requested metric angle".into());
    }
    if cancelled() {
        return Err("Comparison cancelled".into());
    }
    domain.validate()?;
    options.validate()?;
    // Avoid a single mutable meshing/model/material cache. This temporary CDT
    // is built entirely from material-space geometry and an explicit sizing map.
    let base = DVec2::from_array(map.base());
    let q = |p: DVec2| {
        let p = map.to_axes(p) / base;
        Point2::new(p.x, p.y)
    };
    let material = |p: Point2<f64>| map.material_vector(DVec2::new(p.x, p.y) * base);
    let mut cdt = ConstrainedDelaunayTriangulation::<Point2<f64>>::new();
    for (_, path) in domain.paths() {
        if cancelled() {
            return Err("Comparison cancelled".into());
        }
        for w in path.windows(2) {
            let samples = sampled_segment(
                w[0],
                w[1],
                map,
                options.max_vertices.saturating_sub(cdt.num_vertices()),
            )?;
            let mut previous = None;
            for p in samples {
                if cdt.num_vertices() >= options.max_vertices {
                    return Err("Constraint vertex budget exhausted".into());
                }
                let next = cdt.insert(q(p)).map_err(|e| e.to_string())?;
                if let Some(prev) = previous {
                    if prev == next || !cdt.can_add_constraint(prev, next) {
                        return Err("Degenerate or crossing constraints".into());
                    }
                    cdt.add_constraint(prev, next);
                }
                previous = Some(next);
            }
        }
    }
    let seed_count = cdt.num_vertices();
    let seeds = cdt.vertices().map(|v| material(v.position())).collect();
    let cloud = poisson(domain, map, seeds, options, cancelled)?;
    // Existing constraint handles must stay bit-identical under rotated metrics.
    for p in &cloud[seed_count..] {
        cdt.insert(q(*p)).map_err(|e| e.to_string())?;
    }
    let poisson_vertices = cdt.num_vertices();
    // Separate the hull from nearly collinear rounded constraint samples. As in
    // the production domain mesher, an exterior frame avoids hull slivers; all
    // frame vertices/faces are removed from the returned material mesh.
    if cdt.num_vertices() + 4 > options.max_vertices {
        return Err("Domain frame exceeds vertex budget".into());
    }
    let metric: Vec<_> = domain.outer.points.iter().map(|p| q(*p)).collect();
    let lo = metric
        .iter()
        .map(|p| DVec2::new(p.x, p.y))
        .fold(DVec2::splat(f64::INFINITY), DVec2::min)
        - DVec2::splat(2.);
    let hi = metric
        .iter()
        .map(|p| DVec2::new(p.x, p.y))
        .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max)
        + DVec2::splat(2.);
    for p in [lo, DVec2::new(hi.x, lo.y), hi, DVec2::new(lo.x, hi.y)] {
        cdt.insert(Point2::new(p.x, p.y))
            .map_err(|e| e.to_string())?;
    }
    let mut complete = false;
    for _ in 0..options.max_refinement_passes {
        if cancelled() {
            return Err("Comparison cancelled".into());
        }
        if let Some(angle) = angle {
            let result = cdt.refine(
                RefinementParameters::new()
                    .with_angle_limit(AngleLimit::from_deg(angle))
                    .with_max_additional_vertices(
                        options.max_vertices.saturating_sub(cdt.num_vertices()),
                    ),
            );
            if !result.refinement_complete {
                return Err("Angle refinement exceeds vertex budget".into());
            }
        }
        let mut additions = vec![];
        for f in cdt.inner_faces() {
            let p = f.vertices().map(|v| material(v.position()));
            let center = (p[0] + p[1] + p[2]) / 3.;
            if domain.contains(center) && face_bound(map, p).1 > MAX_METRIC_AREA * (1. + 1e-10) {
                additions.push(center);
            }
        }
        if additions.is_empty() {
            complete = true;
            break;
        }
        if cdt.num_vertices() + additions.len() > options.max_vertices {
            return Err("Spatial area refinement exceeds vertex budget".into());
        }
        let before = cdt.num_vertices();
        for p in additions {
            cdt.insert(q(p)).map_err(|e| e.to_string())?;
        }
        if cdt.num_vertices() == before {
            return Err("Spatial area refinement made no progress".into());
        }
    }
    if !complete {
        return Err(
            "Spatial area refinement exhausted its pass budget; no partial mesh returned".into(),
        );
    }
    let raw: Vec<_> = cdt
        .inner_faces()
        .filter_map(|f| {
            let p = f.vertices().map(|v| material(v.position()));
            domain
                .contains((p[0] + p[1] + p[2]) / 3.)
                .then_some(f.vertices().map(|v| v.index()))
        })
        .collect();
    let used: BTreeSet<_> = raw.iter().flatten().copied().collect();
    let mut remap = BTreeMap::new();
    let mut uv = vec![];
    for v in cdt.vertices() {
        if used.contains(&v.index()) {
            remap.insert(v.index(), uv.len());
            uv.push(material(v.position()));
        }
    }
    let faces: Vec<_> = raw.into_iter().map(|f| f.map(|i| remap[&i])).collect();
    let mut boundaries = BTreeMap::new();
    let edges: BTreeSet<_> = faces
        .iter()
        .flat_map(|f| (0..3).map(|i| (f[i].min(f[(i + 1) % 3]), f[i].max(f[(i + 1) % 3]))))
        .collect();
    for (name, path) in domain.paths() {
        let mut chain = vec![];
        for w in path.windows(2) {
            let d = w[1] - w[0];
            let mut ids: Vec<_> = uv
                .iter()
                .enumerate()
                .filter_map(|(i, p)| {
                    let t = (*p - w[0]).dot(d) / d.length_squared();
                    ((-1e-9..=1. + 1e-9).contains(&t) && (*p - w[0] - t * d).length() < 1e-9)
                        .then_some((t, i))
                })
                .collect();
            ids.sort_by(|a, b| a.0.total_cmp(&b.0));
            if ids.len() < 2
                || uv[ids[0].1].distance(w[0]) > 1e-9
                || uv[ids.last().unwrap().1].distance(w[1]) > 1e-9
            {
                return Err(format!("Missing boundary endpoints: {name}"));
            }
            for w in ids.windows(2) {
                if !edges.contains(&(w[0].1.min(w[1].1), w[0].1.max(w[1].1))) {
                    return Err(format!("Missing constrained mesh edge: {name}"));
                }
            }
            let next: Vec<_> = ids.into_iter().map(|(_, i)| i).collect();
            if !chain.is_empty() && chain.last() != next.first() {
                return Err(format!("Disconnected boundary: {name}"));
            }
            chain.extend_from_slice(if chain.is_empty() { &next } else { &next[1..] });
        }
        boundaries.insert(name, chain);
    }
    let mut quality = Quality {
        vertices: uv.len(),
        triangles: faces.len(),
        area_m2: 0.,
        max_metric_area_bound: 0.,
        min_metric_angle_degrees: 180.,
        max_metric_edge_bound: 0.,
        poisson_vertices,
        refinement_vertices: cdt.num_vertices() - poisson_vertices - 4,
    };
    for f in &faces {
        let p = f.map(|i| uv[i]);
        let signed = (p[1] - p[0]).perp_dot(p[2] - p[0]) * 0.5;
        if signed <= 0. {
            return Err("Degenerate or reversed mesh triangle".into());
        }
        quality.area_m2 += signed;
        let (h, area) = face_bound(map, p);
        quality.max_metric_area_bound = quality.max_metric_area_bound.max(area);
        for i in 0..3 {
            let a = map.metric_delta(p[(i + 1) % 3] - p[i], h);
            let b = map.metric_delta(p[(i + 2) % 3] - p[i], h);
            quality.max_metric_edge_bound = quality.max_metric_edge_bound.max(a.length());
            quality.min_metric_angle_degrees = quality
                .min_metric_angle_degrees
                .min(a.angle_to(b).abs().to_degrees());
        }
    }
    if (quality.area_m2 - domain.area()).abs() > domain.area() * 1e-8 {
        return Err("Generated mesh does not conserve the material domain area".into());
    }
    let spacing_m = uv.iter().map(|p| map.spacing(*p)).collect();
    Ok(Output {
        uv,
        faces,
        boundaries,
        spacing_m,
        quality,
    })
}
