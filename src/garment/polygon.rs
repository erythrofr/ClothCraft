//! Named material contours, holes and internal sewing paths.
use super::meshing::{self, MeshingSettings};
use crate::model::{Hinge, Material, Mesh, Triangle};
use glam::{DMat2, DVec2};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// A notch anchored to a fraction of the named boundary's sampled arclength.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EdgeNotch {
    pub t: f64,
    /// Notch marker depth, measured outward from the stitch boundary in metres.
    pub depth_m: f64,
}

/// Editable print / manufacturing note in local material coordinates (metres).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatternAnnotation {
    pub id: String,
    pub text: String,
    pub position: DVec2,
}

/// Stable physical station on an authored named boundary. The fraction refers
/// to sampled material arclength, never the cubic parameter or a mesh index.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeasurementAnchor {
    pub edge: String,
    pub t: f64,
}

/// Editable two-station point of measure in local rest material metres.
/// IDs and station references survive remeshing, saving and topology splits.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatternMeasurement {
    pub id: String,
    pub label: String,
    pub a: MeasurementAnchor,
    pub b: MeasurementAnchor,
}

/// Independent curve-shaping point on an existing named cutline.
/// `t` is the base edge's normalized cubic parameter. This entity never
/// subdivides or renames the sewing boundary. Coordinates are material metres.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FreeCurvePoint {
    pub id: String,
    pub t: f64,
    pub position: DVec2,
    /// Optional exact derivative d(position)/d(edge t), in material metres.
    /// Authored controls default to their parent base Bézier derivative.
    /// A topology split stores the original derivative here so that the
    /// reparameterized child pieces are exactly the same physical cubic.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub derivative: Option<DVec2>,
    /// Incoming d(position)/d(edge t), independently authored at this knot.
    /// Defaults to `derivative`, then to the original cubic derivative.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub derivative_in: Option<DVec2>,
    /// Outgoing d(position)/d(edge t). Distinct incoming/outgoing values make
    /// a sharp corner while retaining the same physical cutline point.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub derivative_out: Option<DVec2>,
    /// Two controls with the same group are authored as one reflected pair.
    /// Changes and deletion must preserve both records in one Shape revision.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mirror_group: Option<String>,
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
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub free_curve_points: BTreeMap<String, Vec<FreeCurvePoint>>,
    /// Stable IDs of promoted contour vertices, keyed by the outgoing named
    /// boundary. A free knot converted into a topological split point keeps
    /// its original ID here rather than disappearing or being stored at t=0.
    /// Keying by boundary name, not a vertex index, survives meshing/reload.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub vertex_ids: BTreeMap<String, String>,
    /// A pair of former mirrored free knots promoted to true vertices.
    /// Both outgoing boundary names carry one common mirror-group ID.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub vertex_mirror_groups: BTreeMap<String, String>,
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
    /// Material-space marking instructions. They never alter the drape mesh.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub notches: BTreeMap<String, Vec<EdgeNotch>>,
    /// Cutting-guide width in metres per contour edge, not a stitched contour.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub seam_allowances: BTreeMap<String, f64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub annotations: Vec<PatternAnnotation>,
    /// Physically anchored POMs, independent of the presentation/2D tape tool.
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
    pub fn measurement_anchor_position(&self, anchor: &MeasurementAnchor) -> Result<DVec2,String> {
        if !anchor.t.is_finite() || !(0.0..=1.0).contains(&anchor.t) {
            return Err("POM station requires a finite boundary arclength fraction in [0,1]".into());
        }
        let index=self.edges.iter().position(|edge|edge==&anchor.edge)
            .ok_or("POM anchor refers to an unknown named boundary")?;
        let samples=self.edge_points(index)?;
        let length:f64=samples.windows(2).map(|span|span[0].distance(span[1])).sum();
        if !length.is_finite() || length <= 1e-9 {
            return Err("POM anchor belongs to a degenerate boundary".into());
        }
        let desired=length*anchor.t;
        let mut traveled=0.0;
        for segment in samples.windows(2) {
            let span=segment[0].distance(segment[1]);
            if traveled+span >= desired-1e-12 && span>1e-12 {
                return Ok(segment[0].lerp(segment[1],((desired-traveled)/span).clamp(0.,1.)));
            }
            traveled+=span;
        }
        Ok(*samples.last().ok_or("POM boundary has no endpoint")?)
    }
    pub fn measurement_points(&self, measurement:&PatternMeasurement) -> Result<[DVec2;2],String> {
        Ok([self.measurement_anchor_position(&measurement.a)?,
            self.measurement_anchor_position(&measurement.b)?])
    }
    pub fn measurement_length(&self, measurement:&PatternMeasurement) -> Result<f64,String> {
        let [a,b]=self.measurement_points(measurement)?;
        Ok(a.distance(b))
    }
    pub fn validate_measurements(&self) -> Result<(),String> {
        let mut ids=BTreeSet::new();
        if self.measurements.len()>256 {
            return Err("Panel supports at most 256 persistent POM references".into());
        }
        for pom in &self.measurements {
            if pom.id.is_empty() || pom.id.len()>80 || !ids.insert(pom.id.as_str())
                || pom.label.trim().is_empty() || pom.label.chars().count()>120
                || pom.label.chars().any(char::is_control) {
                return Err("POM requires a unique ID and printable nonempty label".into());
            }
            let length=self.measurement_length(pom)?;
            if !length.is_finite() || length<=0.00001 {
                return Err("POM must span distinct physical material stations".into());
            }
        }
        Ok(())
    }
    /// Exact cubic spans of one boundary in its original normalized parameter.
    /// Each span is Hermite interpolation of the authored knot positions and
    /// their physical derivatives. This is the single geometry contract used
    /// by triangulation, sewing arclength, and topology-preserving split edits.
    pub fn edge_cubic_spans(&self, i: usize) -> Result<Vec<([f64; 2], [DVec2; 4])>, String> {
        if self.points.len() < 3 || self.edges.len() != self.points.len() || i >= self.points.len() {
            return Err("Invalid polygon edge index or contour topology".into());
        }
        let a = self.points[i];
        let b = self.points[(i + 1) % self.points.len()];
        if !a.is_finite() || !b.is_finite() {
            return Err("Invalid non-finite boundary endpoint".into());
        }
        let controls = self.curves.get(&self.edges[i]).copied()
            .unwrap_or([a.lerp(b, 1. / 3.), a.lerp(b, 2. / 3.)]);
        if controls.iter().any(|point| !point.is_finite()) {
            return Err("Invalid non-finite Bézier control".into());
        }
        let base = [a, controls[0], controls[1], b];
        let mut previous_t = 0.;
        let mut previous_position = a;
        let mut previous_derivative = super::curves::cubic_derivative(base, 0.);
        let mut spans = Vec::new();
        let free = self.free_curve_points.get(&self.edges[i]).map(Vec::as_slice).unwrap_or(&[]);
        for (next_t, next_position, next_derivative_in, next_derivative_out) in free
            .iter()
            .map(|point| (point.t, point.position, point.derivative_in.or(point.derivative), point.derivative_out.or(point.derivative)))
            .chain(std::iter::once((1., b, None, None))) {
            if !next_t.is_finite() || next_t <= previous_t + 1e-6
                || next_t > 1. || !next_position.is_finite() {
                return Err("Invalid or unordered free curve point".into());
            }
            let derivative_in = next_derivative_in
                .unwrap_or_else(|| super::curves::cubic_derivative(base, next_t));
            let derivative_out = next_derivative_out
                .unwrap_or_else(|| super::curves::cubic_derivative(base, next_t));
            if !derivative_in.is_finite() || !derivative_out.is_finite() {
                return Err("Invalid free curve tangent".into());
            }
            let span = next_t - previous_t;
            spans.push(([previous_t, next_t], [
                previous_position,
                previous_position + previous_derivative * (span / 3.),
                next_position - derivative_in * (span / 3.),
                next_position,
            ]));
            previous_t = next_t;
            previous_position = next_position;
            previous_derivative = derivative_out;
        }
        Ok(spans)
    }
    /// Marker endpoints in material coordinates. The polygon is CCW, so the
    /// outward normal lies to the right of each directed boundary segment.
    pub fn notch_segment(&self, edge: &str, notch: &EdgeNotch) -> Result<[DVec2; 2], String> {
        if !notch.t.is_finite()
            || notch.t <= 0.
            || notch.t >= 1.
            || !notch.depth_m.is_finite()
            || notch.depth_m <= 0.
        {
            return Err("Notch requires 0 < t < 1 and positive finite depth".into());
        }
        let index = self
            .edges
            .iter()
            .position(|name| name == edge)
            .ok_or("Boundary not found")?;
        let path = self.edge_points(index)?;
        let total: f64 = path.windows(2).map(|w| w[0].distance(w[1])).sum();
        if total <= 1e-9 {
            return Err("Notch boundary has zero length".into());
        }
        let distance = total * notch.t;
        let mut consumed = 0.;
        for pair in path.windows(2) {
            let tangent = pair[1] - pair[0];
            let length = tangent.length();
            if length <= 1e-12 {
                continue;
            }
            if consumed + length >= distance {
                let start = pair[0] + tangent * ((distance - consumed) / length);
                let normal = DVec2::new(tangent.y, -tangent.x) / length;
                return Ok([start, start + normal * notch.depth_m]);
            }
            consumed += length;
        }
        Err("Notch cannot be placed on this boundary".into())
    }

    /// Per-edge cutting guide. Corner joins and intersection cleanup are not
    /// performed, so consumers must not treat this as a production cut contour.
    pub fn allowance_guide(&self, edge: &str) -> Result<Option<Vec<DVec2>>, String> {
        let Some(&width) = self.seam_allowances.get(edge) else {
            return Ok(None);
        };
        if !width.is_finite() || width <= 0. {
            return Err("Invalid seam allowance width".into());
        }
        let index = self
            .edges
            .iter()
            .position(|name| name == edge)
            .ok_or("Boundary not found")?;
        let path = self.edge_points(index)?;
        let mut guide = Vec::with_capacity(path.len());
        for (i, point) in path.iter().enumerate() {
            let tangent = if i == 0 {
                path[1] - path[0]
            } else if i + 1 == path.len() {
                path[i] - path[i - 1]
            } else {
                path[i + 1] - path[i - 1]
            };
            if tangent.length_squared() <= 1e-20 {
                return Err("Degenerate allowance guide".into());
            }
            guide.push(*point + DVec2::new(tangent.y, -tangent.x).normalize() * width);
        }
        Ok(Some(guide))
    }

    pub fn edge_points(&self, i: usize) -> Result<Vec<DVec2>, String> {
        // Authoring tools also sample uncompiled, user-edited polygons. Guard
        // this public entry point independently of the full mesh validator.
        if self.points.len() < 3 || self.edges.len() != self.points.len() || i >= self.points.len() {
            return Err("Invalid polygon edge index or contour topology".into());
        }
        let spans = self.edge_cubic_spans(i)?;
        let mut points = vec![spans[0].1[0]];
        for (_, controls) in spans {
            let sample = super::curves::flatten(controls, super::curves::FLATNESS_M)?;
            points.extend_from_slice(&sample[1..]);
            if points.len() > 4096 {
                return Err("Free curve subdivision budget exceeded".into());
            }
        }
        Ok(points)
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
        let mut authored_ids = BTreeSet::new();
        for (edge, id) in &self.vertex_ids {
            if !names.contains(edge) || id.is_empty() || id.len() > 80
                || !authored_ids.insert(id.as_str()) {
                return Err("Invalid promoted vertex identity".into());
            }
        }
        self.validate_measurements()?;
        let mut vertex_mirrors=BTreeMap::<&str,Vec<&str>>::new();
        for (edge, group) in &self.vertex_mirror_groups {
            if group.is_empty() || !self.vertex_ids.contains_key(edge) {
                return Err("Mirrored vertex group needs an identified contour vertex".into());
            }
            vertex_mirrors.entry(group).or_default().push(edge.as_str());
        }
        if vertex_mirrors.values().any(|names|names.len()!=2) {
            return Err("Mirrored vertex group needs exactly two identified vertices".into());
        }
        let mirror_axis_sum=self.points.iter().map(|p|p.x).fold(f64::INFINITY,f64::min)
            +self.points.iter().map(|p|p.x).fold(f64::NEG_INFINITY,f64::max);
        for owners in vertex_mirrors.values() {
            let a=self.points[self.edges.iter().position(|edge|edge==owners[0])
                .ok_or("Mirrored vertex boundary missing")?];
            let b=self.points[self.edges.iter().position(|edge|edge==owners[1])
                .ok_or("Mirrored vertex boundary missing")?];
            if (a.x+b.x-mirror_axis_sum).abs()>1e-6 || (a.y-b.y).abs()>1e-6 {
                return Err("Linked mirrored contour vertices are no longer reflected".into());
            }
        }
        if self
            .curves
            .iter()
            .any(|(name, points)| !names.contains(name) || points.iter().any(|p| !p.is_finite()))
        {
            return Err("Invalid Bézier edge name or control point".into());
        }
        let mut mirror_groups=BTreeMap::<&str,Vec<&FreeCurvePoint>>::new();
        for (edge, points) in &self.free_curve_points {
            if !names.contains(edge) || points.len()>32 {
                return Err("Free curve points need a named edge and at most 32 points".into());
            }
            let mut previous=0.;
            let mut ids=BTreeSet::new();
            for point in points {
                if point.id.is_empty() || !ids.insert(&point.id) || !point.t.is_finite()
                    || point.t<=previous+1e-6 || point.t>=1.-1e-6
                    || !point.position.is_finite()
                    || point.derivative.is_some_and(|value| !value.is_finite())
                    || point.derivative_in.is_some_and(|value| !value.is_finite())
                    || point.derivative_out.is_some_and(|value| !value.is_finite())
                    || point.mirror_group.as_deref()==Some("")
                    || authored_ids.contains(point.id.as_str()) {
                    return Err("Invalid or unordered free curve point".into());
                }
                if let Some(group)=point.mirror_group.as_deref(){
                    mirror_groups.entry(group).or_default().push(point);
                }
                previous=point.t;
            }
        }
        let low_x=self.points.iter().map(|point|point.x).fold(f64::INFINITY,f64::min);
        let high_x=self.points.iter().map(|point|point.x).fold(f64::NEG_INFINITY,f64::max);
        for names in vertex_mirrors.values(){
            let find_vertex=|name:&str| -> Result<DVec2,String>{
                let index=self.edges.iter().position(|edge|edge==name)
                    .ok_or("Mirrored vertex references unknown boundary")?;
                Ok(self.points[index])
            };
            let left=find_vertex(names[0])?;
            let right=find_vertex(names[1])?;
            if (left.x+right.x-low_x-high_x).abs()>0.00055
                || (left.y-right.y).abs()>0.00055 {
                return Err("Promoted mirror vertices must stay reflected".into());
            }
        }
        for points in mirror_groups.values(){
            if points.len()!=2{
                return Err("Mirrored free curve group requires exactly two points".into());
            }
            let (left,right)=(points[0],points[1]);
            if (left.t+right.t-1.).abs()>1e-6
                || (left.position.x+right.position.x-low_x-high_x).abs()>1e-6
                || (left.position.y-right.position.y).abs()>1e-6{
                return Err("Mirrored free curve points must remain reflected pairs".into());
            }
        }
        for (edge, notches) in &self.notches {
            if !names.contains(edge) {
                return Err("Notch references unknown boundary".into());
            }
            for notch in notches {
                self.notch_segment(edge, notch)?;
            }
        }
        for (edge, width) in &self.seam_allowances {
            if !names.contains(edge) || !width.is_finite() || *width <= 0. || *width > 0.5 {
                return Err(
                    "Seam allowance needs a known boundary and width in (0, 0.5] metres".into(),
                );
            }
        }
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

#[cfg(test)]
mod notch_allowance_tests {
    use super::*;
    use crate::garment::curves;
    fn square() -> PolygonPattern {
        PolygonPattern {
            points: vec![
                DVec2::ZERO,
                DVec2::new(1., 0.),
                DVec2::ONE,
                DVec2::new(0., 1.),
            ],
            edges: vec!["top".into(), "right".into(), "bottom".into(), "left".into()],
            subdivisions: 0,
            meshing: None,
            curves: Default::default(),
            free_curve_points: Default::default(),
            vertex_ids: Default::default(),
            vertex_mirror_groups: Default::default(),
            holes: vec![],
            lines: vec![],
            target_lengths: Default::default(),
            notches: Default::default(),
            seam_allowances: Default::default(),
            annotations: vec![],
            measurements: vec![],
        }
    }
    #[test]
    fn free_curve_edit_preserves_named_cutline_and_measured_geometry() {
        let mut poly=square();
        poly.notches.insert("top".into(),vec![EdgeNotch{t:0.25,depth_m:0.004}]);
        poly.seam_allowances.insert("top".into(),0.01);
        let baseline=poly.edge_points(0).unwrap();
        assert!((baseline.windows(2).map(|w|w[0].distance(w[1])).sum::<f64>()-1.).abs()<1e-9);
        let original_edges=poly.edges.clone();
        poly.free_curve_points.insert("top".into(),vec![FreeCurvePoint{
            id:"free_1".into(),t:0.5,position:DVec2::new(0.5,0.),mirror_group:None,derivative:None,
         derivative_in:None, derivative_out:None,}]);
        let unchanged=poly.edge_points(0).unwrap();
        assert!((unchanged.windows(2).map(|w|w[0].distance(w[1])).sum::<f64>()-1.).abs()<1e-9);
        poly.free_curve_points.get_mut("top").unwrap()[0].position.y=-0.08;
        let bent=poly.edge_points(0).unwrap();
        let bent_length=bent.windows(2).map(|w|w[0].distance(w[1])).sum::<f64>();
        assert!(bent_length>1.005 && bent_length<1.05);
        assert_eq!(poly.edges,original_edges);
        assert_eq!(poly.notches["top"][0].t,0.25);
        assert_eq!(poly.seam_allowances["top"],0.01);
        let restored:PolygonPattern=serde_json::from_str(&serde_json::to_string(&poly).unwrap()).unwrap();
        assert_eq!(restored.free_curve_points["top"][0].position, DVec2::new(0.5,-0.08));
        let rounded=restored.edge_points(0).unwrap();
        assert!((rounded.windows(2).map(|w|w[0].distance(w[1])).sum::<f64>()-bent_length).abs()<1e-9);
    }
    #[test]
    fn independent_handles_change_only_their_respective_hermite_spans() {
        let mut poly = square();
        let base_derivative = DVec2::new(1., 0.);
        poly.free_curve_points.insert("top".into(), vec![FreeCurvePoint {
            id: "corner".into(), t: 0.5, position: DVec2::new(0.5, 0.),
            derivative: Some(base_derivative), derivative_in: Some(DVec2::new(0., 0.6)),
            derivative_out: Some(DVec2::new(0., -0.4)), mirror_group: None,
        }]);
        let spans = poly.edge_cubic_spans(0).unwrap();
        assert_eq!(spans.len(), 2);
        assert!((spans[0].1[3] - spans[0].1[2] - DVec2::new(0., 0.1)).length() < 1e-12);
        assert!((spans[1].1[1] - spans[1].1[0] - DVec2::new(0., -0.4 / 6.)).length() < 1e-12);
        let json = serde_json::to_value(&poly).unwrap();
        assert!(json["free_curve_points"]["top"][0]["derivative_in"].is_array());
        let reopened: PolygonPattern = serde_json::from_value(json).unwrap();
        assert_eq!(reopened.edge_cubic_spans(0).unwrap(), spans);

        let point = &mut poly.free_curve_points.get_mut("top").unwrap()[0];
        point.derivative_in = None;
        point.derivative_out = None;
        let smooth = poly.edge_cubic_spans(0).unwrap();
        assert!((smooth[0].1[3] - smooth[0].1[2] - DVec2::new(1. / 6., 0.)).length() < 1e-12);
        assert!((smooth[1].1[1] - smooth[1].1[0] - DVec2::new(1. / 6., 0.)).length() < 1e-12);
    }
    #[test]
    fn non_finite_independent_handles_fail_validation_and_sampling() {
        let mut poly = square();
        poly.free_curve_points.insert("top".into(), vec![FreeCurvePoint {
            id: "corner".into(), t: 0.5, position: DVec2::new(0.5, 0.),
            derivative: None, derivative_in: Some(DVec2::splat(f64::NAN)),
            derivative_out: None, mirror_group: None,
        }]);
        assert!(poly.edge_cubic_spans(0).is_err());
        assert!(poly.build(&crate::model::Material::default()).is_err());
        let knot = &mut poly.free_curve_points.get_mut("top").unwrap()[0];
        knot.derivative_in = None;
        knot.derivative_out = Some(DVec2::splat(f64::INFINITY));
        assert!(poly.edge_points(0).is_err());
        assert!(poly.build(&crate::model::Material::default()).is_err());
    }
    #[test]
    fn free_curve_invalid_controls_are_rejected() {
        let mut poly=square();
        poly.free_curve_points.insert("top".into(),vec![
            FreeCurvePoint{id:"free_1".into(),t:0.7,position:DVec2::new(0.7,-0.1),mirror_group:None,derivative:None, derivative_in:None, derivative_out:None,},
            FreeCurvePoint{id:"free_2".into(),t:0.6,position:DVec2::new(0.6,-0.1),mirror_group:None,derivative:None, derivative_in:None, derivative_out:None,},
        ]);
        // Validation precedes meshing, including seam/notch calculations.
        assert!(poly.build(&crate::model::Material::default())
            .err().expect("invalid knot order must fail").contains("Invalid or unordered free curve point"));
    }
    #[test]
    fn multiple_free_knots_flatten_with_bounded_cubic_error() {
        let mut poly = square();
        let base = [
            DVec2::ZERO, DVec2::new(0.18, -0.045),
            DVec2::new(0.82, -0.035), DVec2::new(1., 0.),
        ];
        poly.curves.insert("top".into(), [base[1],base[2]]);
        let first = FreeCurvePoint{
            id:"free_1".into(),t:0.3,position:DVec2::new(0.26,-0.083),mirror_group:None,derivative:None,
         derivative_in:None, derivative_out:None,};
        let second = FreeCurvePoint{
            id:"free_2".into(),t:0.74,position:DVec2::new(0.77,-0.055),mirror_group:None,derivative:None,
         derivative_in:None, derivative_out:None,};
        poly.free_curve_points.insert("top".into(),vec![first.clone(),second.clone()]);
        let sampled = poly.edge_points(0).unwrap();
        assert!(sampled.len()>8 && sampled.len()<4096);
        let knots = [(0.,base[0]),(first.t,first.position),
            (second.t,second.position),(1.,base[3])];
        for index in 0..=1500 {
            let t = index as f64 / 1500.;
            let w = knots.windows(2)
                .find(|pair|t>=pair[0].0&&t<=pair[1].0).unwrap();
            let [left,right] = [w[0],w[1]];
            let q = (t-left.0)/(right.0-left.0);
            let smooth = q*q*(3.-2.*q);
            let offset_left = left.1 - curves::cubic(base,left.0);
            let offset_right = right.1 - curves::cubic(base,right.0);
            let analytic = curves::cubic(base,t)
                + offset_left.lerp(offset_right,smooth);
            let distance = sampled.windows(2).map(|pair|{
                let d=pair[1]-pair[0];
                let f=((analytic-pair[0]).dot(d)/d.length_squared().max(1e-30))
                    .clamp(0.,1.);
                analytic.distance(pair[0]+d*f)
            }).fold(f64::INFINITY, f64::min);
            assert!(distance<=curves::FLATNESS_M*1.01,
                "Exact free-curve cubic exceeded 0.25mm mesh tolerance at t={t}: {distance}");
        }
    }
    #[test]
    fn mirrored_free_curve_controls_require_complete_pair() {
        let mut poly=square();
        poly.free_curve_points.insert("right".into(),vec![FreeCurvePoint{
            id:"free_1".into(),t:0.4,position:DVec2::new(1.02,0.4),
            mirror_group:Some("mirror_1".into()),derivative:None,
         derivative_in:None, derivative_out:None,}]);
        assert!(poly.build(&crate::model::Material::default()).err()
            .unwrap().contains("exactly two points"));
        poly.free_curve_points.insert("left".into(),vec![FreeCurvePoint{
            id:"free_1".into(),t:0.6,position:DVec2::new(-0.02,0.4),
            mirror_group:Some("mirror_1".into()),derivative:None,
         derivative_in:None, derivative_out:None,}]);
        assert!(poly.build(&crate::model::Material::default()).is_ok());
        poly.free_curve_points.get_mut("left").unwrap()[0].position.y+=0.01;
        assert!(poly.build(&crate::model::Material::default()).err()
            .unwrap().contains("reflected pairs"));
        poly.free_curve_points.get_mut("left").unwrap()[0].position.y-=0.01;
        let json=serde_json::to_string(&poly).unwrap();
        let recovered:PolygonPattern=serde_json::from_str(&json).unwrap();
        assert_eq!(recovered.free_curve_points["left"][0].mirror_group.as_deref(),Some("mirror_1"));
    }
    #[test]
    fn notch_extends_outward_in_material_coordinates() {
        let poly = square();
        let [start, end] = poly
            .notch_segment(
                "top",
                &EdgeNotch {
                    t: 0.25,
                    depth_m: 0.01,
                },
            )
            .unwrap();
        assert!((start - DVec2::new(0.25, 0.)).length() < 1e-12);
        assert!((end - DVec2::new(0.25, -0.01)).length() < 1e-12);
        assert!(
            poly.notch_segment(
                "top",
                &EdgeNotch {
                    t: 1.,
                    depth_m: 0.01
                }
            )
            .is_err()
        );
    }
    #[test]
    fn allowance_is_a_non_destructive_cutting_guide() {
        let mut poly = square();
        let original = poly.points.clone();
        poly.seam_allowances.insert("top".into(), 0.012);
        let guide = poly.allowance_guide("top").unwrap().unwrap();
        assert_eq!(guide, vec![DVec2::new(0., -0.012), DVec2::new(1., -0.012)]);
        assert_eq!(original, poly.points);
        let json = serde_json::to_string(&poly).unwrap();
        let read: PolygonPattern = serde_json::from_str(&json).unwrap();
        assert_eq!(read.seam_allowances["top"], 0.012);
    }
}
