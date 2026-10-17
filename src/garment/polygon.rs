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
    /// Material-space marking instructions. They never alter the drape mesh.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub notches: BTreeMap<String, Vec<EdgeNotch>>,
    /// Cutting-guide width in metres per contour edge, not a stitched contour.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub seam_allowances: BTreeMap<String, f64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub annotations: Vec<PatternAnnotation>,
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
        let a = self.points[i];
        let b = self.points[(i + 1) % self.points.len()];
        if let Some([c, d]) = self.curves.get(&self.edges[i]) {
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
            holes: vec![],
            lines: vec![],
            target_lengths: Default::default(),
            notches: Default::default(),
            seam_allowances: Default::default(),
            annotations: vec![],
        }
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
