//! Named material contours, holes and internal sewing paths.
use super::markings::Notch;
use super::meshing::{self, MeshingSettings};
use crate::model::{Hinge, Material, Mesh, Triangle};
use glam::{DMat2, DVec2};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// A station on one stable named boundary, measured by sampled material
/// arclength. Endpoints are included; this is neither a cubic parameter nor a
/// persistent mesh index. The schema follows Mikyle Couto's proposal in PR #66;
/// resolution and validation below are independently implemented on current main.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeasurementAnchor {
    pub edge: String,
    pub t: f64,
}

/// A named straight-line distance between two stations on the same panel in
/// local rest material metres. It is descriptive metadata, not a constraint.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatternMeasurement {
    pub id: String,
    pub label: String,
    pub a: MeasurementAnchor,
    pub b: MeasurementAnchor,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PolygonPattern {
    /// Counterclockwise in the numerical (u,v) plane; v is displayed downward.
    pub points: Vec<DVec2>,
    /// Name of the directed edge i -> (i+1)%n; names survive refinement.
    pub edges: Vec<String>,
    pub subdivisions: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meshing: Option<MeshingSettings>,
    /// Two cubic control points per named edge; absent entries are straight.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub curves: BTreeMap<String, [DVec2; 2]>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub holes: Vec<super::domain::Hole>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lines: Vec<super::domain::InternalLine>,
    /// Required length of each named boundary, keyed by the stable boundary
    /// identifier, in metres. A target is a 2D specification to compare against;
    /// it is never enforced while loading a document and never touches the 3D
    /// side. Empty maps serialise to nothing, so historical files are unchanged.
    #[serde(
        default,
        deserialize_with = "deserialize_target_lengths",
        skip_serializing_if = "BTreeMap::is_empty"
    )]
    pub target_lengths: BTreeMap<String, f64>,
    /// Per-boundary seam allowance in metres, keyed by the stable boundary id.
    /// Draft data only: the cutting contour is derived on demand and never enters
    /// the mesh, the masses or the solver. Empty maps serialise to nothing.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub seam_allowances: BTreeMap<String, f64>,
    /// Notches keyed by the stable boundary id, each with a position along the
    /// sampled arclength. Draft data only, like `seam_allowances`.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub notches: BTreeMap<String, Vec<Notch>>,
    /// Saved, editable rest-space distances. Empty metadata preserves legacy JSON.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub measurements: Vec<PatternMeasurement>,
}
/// Tolerant reader for stored targets. A hand-edited file can hold `null` (what a
/// non-finite float serialises to) or another unusable value. Those become `NaN`
/// so `target_length` ignores them and `target_diagnostics` reports them, instead
/// of failing the whole document load.
fn deserialize_target_lengths<'de, D>(deserializer: D) -> Result<BTreeMap<String, f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    #[allow(dead_code)]
    enum Raw {
        Number(f64),
        Text(String),
        Bool(bool),
        List(Vec<Raw>),
        Map(BTreeMap<String, Raw>),
        Null,
    }
    Ok(BTreeMap::<String, Raw>::deserialize(deserializer)?
        .into_iter()
        .map(|(edge, raw)| {
            (
                edge,
                match raw {
                    Raw::Number(value) => value,
                    _ => f64::NAN,
                },
            )
        })
        .collect())
}
pub struct MeshedPolygon {
    pub mesh: Mesh,
    pub boundaries: BTreeMap<String, Vec<usize>>,
}
fn cross(a: DVec2, b: DVec2, c: DVec2) -> f64 {
    (b - a).perp_dot(c - a)
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
    cross(a, b, c) * cross(a, b, d) <= eps * eps && cross(c, d, a) * cross(c, d, b) <= eps * eps
}
impl PolygonPattern {
    /// Resolve a station using the current authored material boundary. Internal
    /// lines are permitted; their direction, unlike a closed contour's, is not
    /// reversed by a mirror. Malformed or ambiguous boundaries fail explicitly.
    pub fn measurement_anchor_position(&self, anchor: &MeasurementAnchor) -> Result<DVec2, String> {
        self.validate_outer_structure()?;
        if !anchor.t.is_finite() || !(0. ..=1.).contains(&anchor.t) {
            return Err("Measurement station must be a finite fraction in [0, 1]".into());
        }
        let occurrences = self
            .edges
            .iter()
            .chain(self.holes.iter().flat_map(|hole| &hole.edges))
            .chain(self.lines.iter().map(|line| &line.id))
            .filter(|name| *name == &anchor.edge)
            .count();
        if occurrences != 1 {
            return Err(format!(
                "Measurement references missing or ambiguous boundary {}",
                anchor.edge
            ));
        }
        let points = self
            .named_boundary(&anchor.edge)
            .ok_or_else(|| format!("Invalid measurement boundary {}", anchor.edge))?;
        if points.len() < 2 || points.iter().any(|point| !point.is_finite()) {
            return Err("Measurement boundary requires finite material points".into());
        }
        let total: f64 = points
            .windows(2)
            .map(|pair| pair[0].distance(pair[1]))
            .sum();
        if !total.is_finite() || total <= 0. {
            return Err("Measurement boundary has no finite positive length".into());
        }
        let mut remaining = total * anchor.t;
        for pair in points.windows(2) {
            let length = pair[0].distance(pair[1]);
            if length == 0. {
                continue;
            }
            if remaining <= length {
                return Ok(pair[0].lerp(pair[1], remaining / length));
            }
            remaining -= length;
        }
        // The final endpoint also handles accumulated arclength roundoff at t=1.
        Ok(*points.last().unwrap())
    }

    pub fn measurement_points(
        &self,
        measurement: &PatternMeasurement,
    ) -> Result<[DVec2; 2], String> {
        Ok([
            self.measurement_anchor_position(&measurement.a)?,
            self.measurement_anchor_position(&measurement.b)?,
        ])
    }

    /// Euclidean rest-material distance, not boundary arclength, draped surface
    /// distance, a body measurement or an enforced target length.
    pub fn measurement_length(&self, measurement: &PatternMeasurement) -> Result<f64, String> {
        let [a, b] = self.measurement_points(measurement)?;
        let length = a.distance(b);
        if !length.is_finite() {
            return Err("Measurement distance is not finite".into());
        }
        Ok(length)
    }

    /// Project a material point onto one named sampled boundary. Used by ruler
    /// picking and split migration; the returned distance is in metres.
    pub fn measurement_anchor_at_point(
        &self,
        edge: &str,
        point: DVec2,
    ) -> Result<(MeasurementAnchor, f64), String> {
        if !point.is_finite() {
            return Err("Measurement point must be finite".into());
        }
        self.measurement_anchor_position(&MeasurementAnchor {
            edge: edge.into(),
            t: 0.,
        })?;
        let points = self
            .named_boundary(edge)
            .ok_or("Measurement boundary missing")?;
        let total: f64 = points.windows(2).map(|p| p[0].distance(p[1])).sum();
        let mut walked = 0.;
        let mut best = (f64::INFINITY, 0.);
        for pair in points.windows(2) {
            let delta = pair[1] - pair[0];
            let length = delta.length();
            if length == 0. {
                continue;
            }
            let along = ((point - pair[0]).dot(delta / length)).clamp(0., length);
            let distance = point.distance(pair[0] + delta / length * along);
            if distance < best.0 {
                best = (distance, (walked + along) / total);
            }
            walked += length;
        }
        if !best.0.is_finite() {
            return Err("Measurement projection has no finite result".into());
        }
        Ok((
            MeasurementAnchor {
                edge: edge.into(),
                t: best.1.clamp(0., 1.),
            },
            best.0,
        ))
    }

    /// Validate a bounded collection before accepting a transaction or document.
    pub fn validate_measurement_records(
        &self,
        measurements: &[PatternMeasurement],
    ) -> Result<(), String> {
        if measurements.len() > 256 {
            return Err("A panel supports at most 256 measurements".into());
        }
        let mut ids = BTreeSet::new();
        for measurement in measurements {
            if measurement.id.is_empty()
                || measurement.id.len() > 80
                || !measurement
                    .id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
                || !ids.insert(&measurement.id)
            {
                return Err("Measurement IDs must be valid and unique within their panel".into());
            }
            if measurement.label.trim().is_empty()
                || measurement.label.len() > 160
                || measurement.label.chars().any(char::is_control)
            {
                return Err(
                    "Measurement label requires 1..160 bytes without control characters".into(),
                );
            }
            self.measurement_length(measurement)?;
        }
        Ok(())
    }

    /// Structural outer-contour preconditions shared by `build` and by the
    /// public marking helpers. A hand-edited polygon can reach
    /// `cutting_contour`, `named_boundary` or `closed_boundary` without ever
    /// compiling, so those entrypoints must reject a mismatched point/edge list
    /// here rather than index it.
    pub(crate) fn validate_outer_structure(&self) -> Result<(), String> {
        let n = self.points.len();
        if !(3..=4096).contains(&n)
            || self.edges.len() != n
            || self.points.iter().any(|p| !p.is_finite())
        {
            return Err(
                "Polygon outline requires 3..=4096 finite points and one edge name per point"
                    .into(),
            );
        }
        Ok(())
    }

    pub fn edge_points(&self, i: usize) -> Result<Vec<DVec2>, String> {
        if !(3..=4096).contains(&self.points.len()) || self.edges.len() != self.points.len() {
            return Err(
                "Polygon outline requires 3..=4096 points and one edge name per point".into(),
            );
        }
        let a = *self
            .points
            .get(i)
            .ok_or_else(|| format!("Boundary edge {i} is outside the outline"))?;
        let b = self.points[(i + 1) % self.points.len()];
        let name = self
            .edges
            .get(i)
            .ok_or_else(|| format!("Boundary edge {i} has no name"))?;
        if let Some([c, d]) = self.curves.get(name) {
            super::curves::flatten([a, *c, *d, b], super::curves::FLATNESS_M)
        } else {
            Ok(vec![a, b])
        }
    }
    pub fn meshing_settings(&self) -> MeshingSettings {
        self.meshing.clone().unwrap_or_else(|| MeshingSettings {
            target_edge_m: 0.1 / 2.0_f64.powi(self.subdivisions as i32),
            ..Default::default()
        })
    }
    /// Stored target for a named boundary, when it is a usable specification.
    /// Unknown boundaries, non-finite values and non-positive values are treated
    /// as "no target", so a hand-edited file cannot leak a bad number into a
    /// readout or into geometry.
    pub fn target_length(&self, edge: &str) -> Option<f64> {
        if !self.edges.iter().any(|name| name == edge) {
            return None;
        }
        self.target_lengths
            .get(edge)
            .copied()
            .filter(|value| value.is_finite() && *value > 0.)
    }
    /// Reports every stored target that is not a usable specification: an
    /// unknown boundary, a non-finite value or a non-positive value. Readouts
    /// treat those entries as absent instead of trusting them.
    pub fn target_diagnostics(&self) -> Vec<String> {
        self.target_lengths
            .iter()
            .filter(|(edge, value)| {
                !self.edges.iter().any(|name| name == *edge) || !value.is_finite() || **value <= 0.
            })
            .map(|(edge, value)| format!("Ignored target length for boundary {edge}: {value}"))
            .collect()
    }
    pub fn build(&self, m: &Material) -> Result<MeshedPolygon, String> {
        m.validate()?;
        let n = self.points.len();
        if !(3..=4096).contains(&n)
            || self.edges.len() != n
            || self.subdivisions > 4
            || self.points.iter().any(|p| !p.is_finite())
        {
            return Err(
                "Polygon requires 3..4096 points, one edge name per point and 0..4 subdivisions"
                    .into(),
            );
        }
        let mut names = BTreeSet::new();
        for name in &self.edges {
            if name.is_empty()
                || name.len() > 80
                || !name
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
                || !names.insert(name)
            {
                return Err("Invalid/duplicate polygon edge name".into());
            }
        }
        if self
            .curves
            .iter()
            .any(|(name, points)| !names.contains(name) || points.iter().any(|p| !p.is_finite()))
        {
            return Err("Invalid Bézier edge name or control point".into());
        }
        self.validate_markings()?;
        self.validate_measurement_records(&self.measurements)?;
        let mut points = vec![];
        let mut segments = vec![];
        let mut owners = vec![];
        for i in 0..n {
            let samples = self.edge_points(i)?;
            for (j, p) in samples[..samples.len() - 1].iter().enumerate() {
                points.push(*p);
                segments.push(format!("@part_{i}_{j}"));
                owners.push(i);
            }
            if points.len() > 4096 {
                return Err("Contour subdivision budget exceeded".into());
            }
        }
        let n = points.len();
        let mut area = 0.0;
        for i in 0..n {
            let (a, b) = (points[i], points[(i + 1) % n]);
            area += a.perp_dot(b) * 0.5;
            if a.distance(b) < 1e-6 {
                return Err("Zero-length polygon edge".into());
            }
            for j in i + 1..n {
                if j == i + 1 || (i == 0 && j == n - 1) {
                    continue;
                }
                if intersects(a, b, points[j], points[(j + 1) % n]) {
                    return Err("Self-intersecting polygon".into());
                }
            }
        }
        if area <= 1e-8 {
            return Err("Polygon must have positive signed area in (u,v)".into());
        }
        super::domain::validate(self, &points)?;
        let settings = self.meshing_settings();
        let meshing::TriangulatedContour {
            uv,
            faces,
            boundaries: parts,
        } = if self.holes.is_empty() && self.lines.is_empty() {
            meshing::triangulate(&points, &segments, &settings)?
        } else {
            meshing::triangulate_domain(&points, &segments, &self.holes, &self.lines, &settings)?
        };
        let mut boundaries = BTreeMap::<String, Vec<usize>>::new();
        for (part, owner) in segments.iter().zip(owners) {
            let chain = boundaries.entry(self.edges[owner].clone()).or_default();
            let ids = &parts[part];
            if chain.is_empty() {
                chain.extend_from_slice(ids);
            } else {
                if chain.last() != ids.first() {
                    return Err("Disconnected curved boundary".into());
                }
                chain.extend_from_slice(&ids[1..]);
            }
        }
        for hole in &self.holes {
            for name in &hole.edges {
                boundaries.insert(name.clone(), parts[name].clone());
            }
        }
        for line in &self.lines {
            boundaries.insert(line.id.clone(), parts[&line.id].clone());
        }
        let count = uv.len();
        let mut mesh = Mesh {
            uv,
            triangles: vec![],
            hinges: vec![],
            rest_area: vec![0.0; count],
            masses: vec![0.0; count],
            pins: vec![None; count],
        };
        let mut edges = BTreeMap::<(usize, usize), (usize, f64)>::new();
        for vertices in faces {
            let rest = vertices.map(|i| mesh.uv[i]);
            let dm = DMat2::from_cols(rest[1] - rest[0], rest[2] - rest[0]);
            let area = dm.determinant() * 0.5;
            if area <= 1e-14 {
                return Err("Degenerate polygon triangle".into());
            }
            for i in vertices {
                mesh.rest_area[i] += area / 3.0;
            }
            let [a, b, c] = vertices;
            for (a, b, c) in [(a, b, c), (b, c, a), (c, a, b)] {
                let key = (a.min(b), a.max(b));
                if let Some((d, other_area)) = edges.remove(&key) {
                    let e = mesh.uv[b] - mesh.uv[a];
                    mesh.hinges.push(Hinge {
                        vertices: [a, b, c, d],
                        weight: 3.0 * e.length_squared() / (area + other_area),
                        across: DVec2::new(-e.y, e.x).normalize(),
                        material: 0,
                    });
                } else {
                    edges.insert(key, (c, area));
                }
            }
            mesh.triangles.push(Triangle {
                vertices,
                rest,
                inv_dm: dm.inverse(),
                area,
                material: 0,
            });
        }
        for i in 0..count {
            mesh.masses[i] = mesh.rest_area[i] * m.density;
        }
        Ok(MeshedPolygon { mesh, boundaries })
    }
}
