//! Optional holes and material-space sewing paths; no persisted mesh indices.
use super::{curves, polygon::PolygonPattern};
use glam::DVec2;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Hole {
    /// Clockwise, with one stable directed boundary name per segment.
    pub points: Vec<DVec2>,
    pub edges: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InternalLine {
    pub id: String,
    pub points: Vec<DVec2>,
    /// Symmetric pen tangents at each anchor, in material metres.
    pub tangents: Vec<DVec2>,
}
impl InternalLine {
    pub fn samples(&self) -> Result<Vec<DVec2>, String> {
        if !(2..=64).contains(&self.points.len())
            || self.tangents.len() != self.points.len()
            || self
                .points
                .iter()
                .chain(&self.tangents)
                .any(|p| !p.is_finite())
        {
            return Err("Ligne intérieure : 2..64 points et tangentes finies requis".into());
        }
        let mut out = vec![self.points[0]];
        for i in 0..self.points.len() - 1 {
            let samples = curves::flatten(
                [
                    self.points[i],
                    self.points[i] + self.tangents[i],
                    self.points[i + 1] - self.tangents[i + 1],
                    self.points[i + 1],
                ],
                curves::FLATNESS_M,
            )?;
            out.extend_from_slice(&samples[1..]);
            if out.len() > 4096 {
                return Err("Ligne trop détaillée".into());
            }
        }
        Ok(out)
    }
}
pub fn area(points: &[DVec2]) -> f64 {
    (0..points.len())
        .map(|i| points[i].perp_dot(points[(i + 1) % points.len()]))
        .sum::<f64>()
        * 0.5
}
pub fn inside(p: DVec2, points: &[DVec2]) -> bool {
    let mut yes = false;
    for i in 0..points.len() {
        let (a, b) = (points[i], points[(i + 1) % points.len()]);
        if (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
            yes = !yes;
        }
    }
    yes
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
    let cross = |p: DVec2, q: DVec2, r: DVec2| (q - p).perp_dot(r - p);
    cross(a, b, c) * cross(a, b, d) <= eps * eps && cross(c, d, a) * cross(c, d, b) <= eps * eps
}
fn segments(points: &[DVec2], closed: bool) -> Vec<[DVec2; 2]> {
    let mut out: Vec<_> = points.windows(2).map(|p| [p[0], p[1]]).collect();
    if closed {
        out.push([*points.last().unwrap(), points[0]]);
    }
    out
}
fn simple(points: &[DVec2], closed: bool) -> Result<(), String> {
    if points.iter().any(|p| !p.is_finite()) {
        return Err("Coordonnée non finie".into());
    }
    let seg = segments(points, closed);
    for (i, [a, b]) in seg.iter().copied().enumerate() {
        if a.distance(b) < 1e-6 {
            return Err("Segment nul ou inférieur à 1 µm".into());
        }
        if closed || i + 1 < seg.len() {
            let d = seg[(i + 1) % seg.len()][1];
            if (b - a).perp_dot(d - b).abs() < 1e-12 && (b - a).dot(d - b) < 0. {
                return Err("Une ligne ne peut pas revenir sur son propre segment".into());
            }
        }
        for (j, [c, d]) in seg.iter().copied().enumerate().skip(i + 1) {
            if j == i + 1 || (closed && i == 0 && j == seg.len() - 1) {
                continue;
            }
            if intersects(a, b, c, d) {
                return Err("Contour ou ligne auto-intersecté".into());
            }
        }
    }
    Ok(())
}
fn name_ok(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 80
        && name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
pub fn validate(poly: &PolygonPattern, outer: &[DVec2]) -> Result<(), String> {
    if poly.holes.len() > 32 || poly.lines.len() > 64 {
        return Err("Maximum 32 trous et 64 lignes par panneau".into());
    }
    let mut names: BTreeSet<_> = poly.edges.iter().map(String::as_str).collect();
    let mut contours = vec![outer];
    let mut budget = outer.len();
    for hole in &poly.holes {
        budget += hole.points.len();
        if budget > 8192 {
            return Err("Budget de contours et lignes dépassé".into());
        }
        if !(3..=4096).contains(&hole.points.len())
            || hole.edges.len() != hole.points.len()
            || area(&hole.points) >= -1e-8
        {
            return Err("Trou invalide : contour horaire et bords nommés requis".into());
        }
        for name in &hole.edges {
            if !name_ok(name) || !names.insert(name) {
                return Err("Nom de bord dupliqué/invalide".into());
            }
        }
        simple(&hole.points, true)?;
        if !inside(hole.points[0], outer) {
            return Err("Trou hors du panneau".into());
        }
        for previous in &contours {
            if segments(&hole.points, true).iter().any(|[a, b]| {
                segments(previous, true)
                    .iter()
                    .any(|[c, d]| intersects(*a, *b, *c, *d))
            }) {
                return Err("Les trous ne doivent ni toucher ni croiser un contour".into());
            }
        }
        for previous in contours.iter().skip(1) {
            if inside(hole.points[0], previous) || inside(previous[0], &hole.points) {
                return Err("Trous imbriqués ou superposés".into());
            }
        }
        contours.push(&hole.points);
    }
    let mut paths: Vec<Vec<DVec2>> = vec![];
    for line in &poly.lines {
        if !name_ok(&line.id) || !names.insert(&line.id) {
            return Err("Nom de ligne dupliqué/invalide".into());
        }
        let points = line.samples()?;
        budget += points.len();
        if budget > 8192 {
            return Err("Budget de contours et lignes dépassé".into());
        }
        simple(&points, false)?;
        if points
            .iter()
            .any(|p| !inside(*p, outer) || poly.holes.iter().any(|h| inside(*p, &h.points)))
        {
            return Err("La ligne doit rester à l'intérieur du tissu".into());
        }
        for [a, b] in segments(&points, false) {
            if contours.iter().any(|c| {
                segments(c, true)
                    .iter()
                    .any(|[c, d]| intersects(a, b, *c, *d))
            }) || paths.iter().any(|p| {
                segments(p, false)
                    .iter()
                    .any(|[c, d]| intersects(a, b, *c, *d))
            }) {
                return Err(
                    "Une ligne ne doit ni toucher ni croiser un contour ou une autre ligne".into(),
                );
            }
        }
        paths.push(points);
    }
    if budget > 8192 {
        return Err("Budget de contours et lignes dépassé".into());
    }
    Ok(())
}
impl PolygonPattern {
    pub fn outer_points(&self) -> Result<Vec<DVec2>, String> {
        let mut out = vec![];
        for i in 0..self.points.len() {
            let p = self.edge_points(i)?;
            out.extend_from_slice(&p[..p.len() - 1]);
        }
        Ok(out)
    }
    /// All selectable sewing paths, including hole rims and internal lines.
    pub fn paths(&self) -> Result<Vec<(String, Vec<DVec2>)>, String> {
        let mut out = vec![];
        for (i, name) in self.edges.iter().enumerate() {
            out.push((name.clone(), self.edge_points(i)?));
        }
        for hole in &self.holes {
            for (i, name) in hole.edges.iter().enumerate() {
                out.push((
                    name.clone(),
                    vec![hole.points[i], hole.points[(i + 1) % hole.points.len()]],
                ));
            }
        }
        for line in &self.lines {
            out.push((line.id.clone(), line.samples()?));
        }
        Ok(out)
    }
    pub fn translate_material(&mut self, delta: DVec2) {
        for p in self
            .points
            .iter_mut()
            .chain(self.curves.values_mut().flatten())
        {
            *p += delta;
        }
        for mark in self.free_curve_points.values_mut().flatten() {
            mark.position += delta;
        }
        for hole in &mut self.holes {
            for p in &mut hole.points {
                *p += delta;
            }
        }
        for line in &mut self.lines {
            for p in &mut line.points {
                *p += delta;
            }
        }
    }
}
