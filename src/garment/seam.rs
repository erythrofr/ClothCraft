//! Rest-arclength line-penalty coupling for nonmatching boundary meshes.
//! Two-point Gauss integration on the common partition is exact for linear edges.
use crate::{energy::Element, model::Mesh};
use glam::DVec3;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BoundaryRef {
    /// Direction of this segment within a sewing chain, after trimming.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub reversed: bool,
    pub panel: String,
    pub side: Side,
    /// v2 polygon edge name; takes precedence over the legacy rectangle side.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge: Option<String>,
    /// Interval on the directed boundary, in normalized rest arclength.
    pub range: [f64; 2],
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SeamSpec {
    pub id: String,
    pub a: BoundaryRef,
    pub b: BoundaryRef,
    /// Ordered continuations of A/B. Empty preserves legacy single-edge semantics.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub a_tail: Vec<BoundaryRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub b_tail: Vec<BoundaryRef>,
    pub reverse_b: bool,
    /// Monotone interior (a,b) correspondences after trimming and reversing b.
    /// Endpoints (0,0) and (1,1) are implicit; these are not mesh vertex IDs.
    #[serde(default)]
    pub notches: Vec<[f64; 2]>,
    /// Line-integrated gap penalty coefficient (N/m²).
    pub stiffness: f64,
    /// Permit unequal lengths (gathering/easing). This does not change rest geometry.
    #[serde(default)]
    pub allow_ease: bool,
}

impl SeamSpec {
    pub fn side(&self, b: bool) -> impl Iterator<Item = &BoundaryRef> {
        let (first, tail) = if b {
            (&self.b, &self.b_tail)
        } else {
            (&self.a, &self.a_tail)
        };
        std::iter::once(first).chain(tail)
    }
    pub fn references(&self) -> impl Iterator<Item = &BoundaryRef> {
        self.side(false).chain(self.side(true))
    }
    pub fn references_mut(&mut self) -> impl Iterator<Item = &mut BoundaryRef> {
        std::iter::once(&mut self.a)
            .chain(&mut self.a_tail)
            .chain(std::iter::once(&mut self.b))
            .chain(&mut self.b_tail)
    }
}

#[derive(Clone, Debug)]
pub struct BoundaryCurve {
    chain: Vec<BoundaryCurve>,
    vertices: Vec<usize>,
    knots: Vec<f64>,
    range: [f64; 2],
    reverse: bool,
    pub length: f64,
}
impl BoundaryCurve {
    pub fn new(
        mesh: &Mesh,
        vertices: Vec<usize>,
        range: [f64; 2],
        reverse: bool,
    ) -> Result<Self, String> {
        if vertices.len() < 2
            || vertices.iter().any(|i| *i >= mesh.uv.len())
            || !range.iter().all(|v| v.is_finite())
            || range[0] < 0.0
            || range[1] > 1.0
            || range[1] - range[0] < 1e-9
        {
            return Err("Boundary requires valid vertices and 0 <= start < end <= 1".into());
        }
        let mut knots = vec![0.0];
        for pair in vertices.windows(2) {
            let length = mesh.uv[pair[0]].distance(mesh.uv[pair[1]]);
            if !length.is_finite() || length <= 1e-12 {
                return Err("Zero-length boundary segment".into());
            }
            knots.push(knots.last().unwrap() + length);
        }
        let total = *knots.last().unwrap();
        for k in &mut knots {
            *k /= total;
        }
        Ok(Self {
            chain: vec![],
            vertices,
            knots,
            range,
            reverse,
            length: total * (range[1] - range[0]),
        })
    }
    pub fn breakpoints(&self) -> Vec<f64> {
        if !self.chain.is_empty() {
            let mut offset = 0.;
            let mut out = Vec::new();
            for c in &self.chain {
                out.extend(
                    c.breakpoints()
                        .into_iter()
                        .map(|t| (offset + t * c.length) / self.length),
                );
                offset += c.length;
            }
            out.sort_by(f64::total_cmp);
            out.dedup_by(|a, b| (*a - *b).abs() < 1e-12);
            return out;
        }
        let mut out = vec![0.0, 1.0];
        for k in &self.knots {
            if *k > self.range[0] && *k < self.range[1] {
                let t = (*k - self.range[0]) / (self.range[1] - self.range[0]);
                out.push(if self.reverse { 1.0 - t } else { t });
            }
        }
        out.sort_by(f64::total_cmp);
        out
    }
    pub fn point(&self, t: f64) -> [(usize, f64); 2] {
        self.point_limit(t, false)
    }
    fn point_limit(&self, t: f64, left: bool) -> [(usize, f64); 2] {
        if !self.chain.is_empty() {
            let distance = t.clamp(0., 1.) * self.length;
            let mut offset = 0.;
            for (i, c) in self.chain.iter().enumerate() {
                let end = offset + c.length;
                if distance < end - 1e-12
                    || (left && distance <= end + 1e-12)
                    || i + 1 == self.chain.len()
                {
                    return c.point_limit((distance - offset) / c.length, left);
                }
                offset = end;
            }
        }
        let t = if self.reverse { 1.0 - t } else { t };
        let s = self.range[0] + t.clamp(0.0, 1.0) * (self.range[1] - self.range[0]);
        let i = self
            .knots
            .partition_point(|k| *k <= s)
            .saturating_sub(1)
            .min(self.vertices.len() - 2);
        let w = (s - self.knots[i]) / (self.knots[i + 1] - self.knots[i]);
        [(self.vertices[i], 1.0 - w), (self.vertices[i + 1], w)]
    }
    pub fn concatenate(mut chain: Vec<Self>, reverse: bool) -> Result<Self, String> {
        chain = chain
            .into_iter()
            .flat_map(|c| if c.chain.is_empty() { vec![c] } else { c.chain })
            .collect();
        if chain.is_empty() || chain.len() > 128 {
            return Err("Sewing side needs 1..128 segments".into());
        }
        if reverse {
            chain.reverse();
            for c in &mut chain {
                c.reverse = !c.reverse;
            }
        }
        if chain.len() == 1 {
            return Ok(chain.remove(0));
        }
        let length = chain.iter().map(|c| c.length).sum();
        Ok(Self {
            chain,
            vertices: vec![],
            knots: vec![],
            range: [0., 1.],
            reverse: false,
            length,
        })
    }
    fn joints(&self) -> Vec<f64> {
        let mut sum = 0.;
        self.chain
            .iter()
            .take(self.chain.len().saturating_sub(1))
            .map(|c| {
                sum += c.length;
                sum / self.length
            })
            .collect()
    }
}

#[derive(Clone, Debug)]
pub struct StitchPoint {
    /// Coefficients sum to zero; duplicate vertices are merged before assembly.
    pub terms: Vec<(usize, f64)>,
}
impl StitchPoint {
    fn new(a: &BoundaryCurve, b: &BoundaryCurve, s: f64, t: f64) -> Self {
        Self::limit(a, b, s, t, false)
    }
    fn limit(a: &BoundaryCurve, b: &BoundaryCurve, s: f64, t: f64, left: bool) -> Self {
        let mut terms = BTreeMap::<usize, f64>::new();
        for (v, w) in a.point_limit(s, left) {
            *terms.entry(v).or_default() += w;
        }
        for (v, w) in b.point_limit(t, left) {
            *terms.entry(v).or_default() -= w;
        }
        Self {
            terms: terms.into_iter().filter(|(_, c)| c.abs() > 1e-15).collect(),
        }
    }
    pub fn gap(&self, x: &[DVec3]) -> DVec3 {
        self.terms.iter().map(|(v, w)| x[*v] * (*w)).sum()
    }
    fn element(&self, x: &[DVec3], coefficient: f64) -> Element {
        let gap = self.gap(x);
        let n = 3 * self.terms.len();
        let mut gradient = vec![0.0; n];
        let mut hessian = vec![0.0; n * n];
        for (i, (_, a)) in self.terms.iter().enumerate() {
            for k in 0..3 {
                gradient[3 * i + k] = coefficient * a * gap[k];
            }
            for (j, (_, b)) in self.terms.iter().enumerate() {
                for k in 0..3 {
                    hessian[(3 * i + k) * n + 3 * j + k] = coefficient * a * b;
                }
            }
        }
        Element {
            dofs: self
                .terms
                .iter()
                .flat_map(|(v, _)| (0..3).map(move |k| 3 * v + k))
                .collect(),
            energy: 0.5 * coefficient * gap.length_squared(),
            gradient,
            hessian,
        }
    }
}

#[derive(Clone, Debug)]
pub struct StitchSample {
    pub point: StitchPoint,
    pub weight_m: f64,
}

#[derive(Clone, Debug)]
pub struct CompiledSeam {
    pub id: String,
    pub samples: Vec<StitchSample>,
    /// Endpoints of every linear interval; maxima occur here, not at Gauss nodes.
    pub probes: Vec<StitchPoint>,
    /// Sparse display correspondences, derived from the same rest-arclength map.
    /// These are transient attachments, never persisted or used by the solver.
    pub guides: Vec<StitchGuide>,
    pub stiffness: f64,
    pub lengths: [f64; 2],
    pub notches: Vec<[f64; 2]>,
}
pub type StitchGuide = [[(usize, f64); 2]; 2];

fn interpolate(knots: &[[f64; 2]], u: f64, from: usize) -> f64 {
    let i = knots
        .partition_point(|k| k[from] <= u)
        .saturating_sub(1)
        .min(knots.len() - 2);
    let t = (u - knots[i][from]) / (knots[i + 1][from] - knots[i][from]);
    knots[i][1 - from] * (1.0 - t) + knots[i + 1][1 - from] * t
}

impl CompiledSeam {
    pub fn validate(&self, vertex_count: usize) -> Result<(), String> {
        let valid_point = |p: &StitchPoint| {
            p.terms
                .iter()
                .all(|(v, c)| *v < vertex_count && c.is_finite())
                && p.terms.iter().map(|(_, c)| c).sum::<f64>().abs() < 1e-10
                && p.terms.windows(2).all(|p| p[0].0 < p[1].0)
        };
        if !self.stiffness.is_finite()
            || self.stiffness <= 0.0
            || self.lengths.iter().any(|l| !l.is_finite() || *l <= 0.0)
            || self.samples.is_empty()
            || self.probes.is_empty()
            || self
                .samples
                .iter()
                .any(|s| !s.weight_m.is_finite() || s.weight_m <= 0.0 || !valid_point(&s.point))
            || self.probes.iter().any(|p| !valid_point(p))
        {
            return Err(format!("Invalid compiled seam {}", self.id));
        }
        Ok(())
    }
    pub fn compile(spec: &SeamSpec, a: BoundaryCurve, b: BoundaryCurve) -> Result<Self, String> {
        if !spec.stiffness.is_finite() || spec.stiffness <= 0.0 {
            return Err("Seam stiffness must be positive and finite (N/m²)".into());
        }
        // The authoring contour is cubic, but compiled sewing uses a flattened
        // material-space polyline. Splitting an unchanged cubic changes its
        // flattening partition and can introduce a few micrometres of sampled
        // arclength drift. Do not confuse that numerical error with actual ease.
        // 1e-5 m = 0.01 mm; larger physical mismatches remain invalid.
        const SEW_SAMPLING_TOLERANCE_M: f64 = 1e-5;
        if !spec.allow_ease && (a.length - b.length).abs() > SEW_SAMPLING_TOLERANCE_M {
            return Err(format!(
                "Seam {} has unequal lengths ({:.6}, {:.6} m); set allow_ease explicitly",
                spec.id, a.length, b.length
            ));
        }
        let mut knots = vec![[0.0, 0.0]];
        for knot in &spec.notches {
            if (0..2).any(|i| {
                !knot[i].is_finite()
                    || knot[i] <= knots.last().unwrap()[i] + 1e-9
                    || knot[i] >= 1.0 - 1e-9
            }) {
                return Err(format!(
                    "Seam {} notches must be strictly increasing inside (0,1) on both edges",
                    spec.id
                ));
            }
            knots.push(*knot);
        }
        knots.push([1.0, 1.0]);
        if !spec.allow_ease
            && knots.windows(2).any(|k| {
                let la = a.length * (k[1][0] - k[0][0]);
                let lb = b.length * (k[1][1] - k[0][1]);
                (la - lb).abs() > SEW_SAMPLING_TOLERANCE_M
            })
        {
            return Err(format!(
                "Seam {} notches introduce local easing; set allow_ease explicitly",
                spec.id
            ));
        }
        let mut partition = a.breakpoints();
        partition.extend(
            b.breakpoints()
                .into_iter()
                .map(|t| interpolate(&knots, t, 1)),
        );
        partition.extend(knots.iter().map(|k| k[0]));
        partition.sort_by(f64::total_cmp);
        partition.dedup_by(|a, b| (*a - *b).abs() < 1e-12);
        let mut samples = vec![];
        for interval in partition.windows(2) {
            let [lo, hi] = [interval[0], interval[1]];
            let [blo, bhi] = [interpolate(&knots, lo, 0), interpolate(&knots, hi, 0)];
            let weight_m = (a.length * (hi - lo) + b.length * (bhi - blo)) / 4.0;
            for q in [-1.0 / 3.0_f64.sqrt(), 1.0 / 3.0_f64.sqrt()] {
                let s = (lo + hi) * 0.5 + q * (hi - lo) * 0.5;
                samples.push(StitchSample {
                    point: StitchPoint::new(&a, &b, s, interpolate(&knots, s, 0)),
                    weight_m,
                });
            }
        }
        // A chain can cross panel boundaries: measure both one-sided limits at
        // every joint, without inventing a physical bridge across the gap.
        let mut probes: Vec<_> = partition
            .iter()
            .map(|s| StitchPoint::new(&a, &b, *s, interpolate(&knots, *s, 0)))
            .collect();
        let joints = a
            .joints()
            .into_iter()
            .chain(b.joints().into_iter().map(|t| interpolate(&knots, t, 1)));
        probes
            .extend(joints.map(|s| StitchPoint::limit(&a, &b, s, interpolate(&knots, s, 0), true)));
        let guides = (0..=8)
            .map(|i| {
                let t = i as f64 / 8.;
                [a.point(t), b.point(interpolate(&knots, t, 0))]
            })
            .collect();
        Ok(Self {
            id: spec.id.clone(),
            samples,
            probes,
            guides,
            stiffness: spec.stiffness,
            lengths: [a.length, b.length],
            notches: spec.notches.clone(),
        })
    }
    pub fn energy(&self, x: &[DVec3]) -> f64 {
        self.samples
            .iter()
            .map(|s| 0.5 * self.stiffness * s.weight_m * s.point.gap(x).length_squared())
            .sum()
    }
    pub fn elements(&self, x: &[DVec3]) -> Vec<Element> {
        self.samples
            .iter()
            .map(|s| s.point.element(x, self.stiffness * s.weight_m))
            .collect()
    }
    pub fn max_gap(&self, x: &[DVec3]) -> f64 {
        self.probes
            .iter()
            .map(|p| p.gap(x).length())
            .fold(0.0, f64::max)
    }
    /// Length-weighted RMS separation of physically coupled stitch samples.
    /// Unlike whole-garment max seam gap this isolates the selected seam, and
    /// unlike the material rest gap it measures actual world-space closure.
    pub fn rms_gap(&self, x: &[DVec3]) -> f64 {
        let weight: f64 = self.samples.iter().map(|s| s.weight_m).sum();
        if weight <= 0. || !weight.is_finite() {return f64::NAN;}
        (self.integrated_gap_squared(x) / weight).sqrt()
    }
    pub fn integrated_gap_squared(&self, x: &[DVec3]) -> f64 {
        self.samples
            .iter()
            .map(|s| s.weight_m * s.point.gap(x).length_squared())
            .sum()
    }
    pub fn measure(&self) -> f64 {
        (self.lengths[0] + self.lengths[1]) * 0.5
    }
}
