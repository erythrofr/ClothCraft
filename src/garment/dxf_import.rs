//! Bounded ASCII DXF geometry reader, not an AAMA/ASTM garment importer.
//!
//! Model-space LINE, ARC, CIRCLE, LWPOLYLINE and legacy 2D POLYLINE/VERTEX are
//! accepted on XY with the default +Z extrusion. Layers and entity handles are
//! retained with surrounding whitespace trimmed; cut/sew/notch semantics are
//! never inferred or combined. Input must already be decoded UTF-8 text.
//! Non-HEADER/ENTITIES sections are ignored; block insertions are unsupported.
//! Legacy vertices inherit their parent polyline's layer in the returned path.
//! Closed flags add a closing segment; open paths remain open (closure tolerance
//! is zero). Circular segments are sampled to `chord_error_m`, not fitted curves.
//! Unknown/unsupported entities produce issues. Callers MUST show these issues
//! before using partial geometry; parsing alone does not validate a cloth panel.
//! No document, mesh or solver is modified. HEADER units are read from INSUNITS;
//! unitless/unknown drawings require an explicit metres-per-unit override.
//!
//! Independently implemented from Autodesk's DXF reference (consulted 2026-10-26):
//! <https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm>
//! <https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm>
//! <https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-0741E831-599E-4CBF-91E1-8ADBCFD6556D.htm>
//! <https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-0B14D8F1-0EBA-44BF-9108-57D8CE614BC8.htm>
use glam::DVec2;
use std::f64::consts::{FRAC_PI_2, TAU};

const MAX_BYTES: usize = 16 * 1024 * 1024;
const MAX_POINTS: usize = 1_000_000;
const MAX_PATH_POINTS: usize = 100_000;

#[derive(Clone, Copy, Debug)]
pub struct Options {
    /// Explicit user scale overrides header units and is recorded in the result.
    pub metres_per_unit: Option<f64>,
    pub chord_error_m: f64,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            metres_per_unit: None,
            chord_error_m: 0.0001,
        }
    }
}

#[derive(Debug)]
pub struct Path {
    pub entity: String,
    pub handle: Option<String>,
    pub layer: String,
    /// Metres, with a repeated first point only for closed paths.
    pub points: Vec<DVec2>,
    pub closed: bool,
}

#[derive(Debug)]
pub struct Issue {
    pub entity: String,
    pub handle: Option<String>,
    pub layer: String,
    pub reason: String,
}

#[derive(Debug)]
pub struct Drawing {
    pub paths: Vec<Path>,
    pub issues: Vec<Issue>,
    pub insunits: Option<i32>,
    pub metres_per_unit: f64,
    pub scale_overridden: bool,
}

#[derive(Clone, Copy)]
struct Pair<'a> {
    code: i32,
    value: &'a str,
}

fn field<'a>(pairs: &[Pair<'a>], code: i32) -> Result<Option<&'a str>, String> {
    let mut values = pairs.iter().filter(|p| p.code == code);
    let first = values.next().map(|p| p.value);
    if values.next().is_some() {
        return Err(format!("Duplicate group {code}"));
    }
    Ok(first)
}
fn number(pairs: &[Pair<'_>], code: i32, default: Option<f64>) -> Result<f64, String> {
    let value = match field(pairs, code)? {
        Some(value) => value
            .parse::<f64>()
            .map_err(|_| format!("Invalid group {code}"))?,
        None => default.ok_or_else(|| format!("Missing group {code}"))?,
    };
    if !value.is_finite() {
        return Err(format!("Nonfinite group {code}"));
    }
    Ok(value)
}
fn integer(pairs: &[Pair<'_>], code: i32, default: i32) -> Result<i32, String> {
    field(pairs, code)?.map_or(Ok(default), |v| {
        v.parse()
            .map_err(|_| format!("Invalid integer group {code}"))
    })
}
fn point(pairs: &[Pair<'_>], x: i32, scale: f64) -> Result<DVec2, String> {
    let p = DVec2::new(number(pairs, x, None)?, number(pairs, x + 10, None)?) * scale;
    if !p.is_finite() {
        return Err("Coordinate overflow after unit conversion".into());
    }
    Ok(p)
}
fn planar(pairs: &[Pair<'_>]) -> Result<(), String> {
    for code in [30, 31, 38, 39] {
        if number(pairs, code, Some(0.))? != 0. {
            return Err("Nonzero Z/elevation/thickness is unsupported".into());
        }
    }
    if number(pairs, 210, Some(0.))? != 0.
        || number(pairs, 220, Some(0.))? != 0.
        || number(pairs, 230, Some(1.))? != 1.
    {
        return Err("Only default +Z extrusion is supported".into());
    }
    if integer(pairs, 67, 0)? != 0 {
        return Err("Paper-space entities are unsupported".into());
    }
    Ok(())
}
fn push(points: &mut Vec<DVec2>, p: DVec2) -> Result<(), String> {
    if !p.is_finite() {
        return Err("Nonfinite geometry".into());
    }
    if points.len() >= MAX_PATH_POINTS {
        return Err("Path point budget exceeded".into());
    }
    points.push(p);
    Ok(())
}
fn arc(
    points: &mut Vec<DVec2>,
    center: DVec2,
    radius: f64,
    start: f64,
    sweep: f64,
    error: f64,
) -> Result<(), String> {
    if !radius.is_finite() || radius <= 0. || !center.is_finite() {
        return Err("Invalid circle radius/center".into());
    }
    let angle = (4. * (error / (2. * radius)).min(1.).sqrt().asin()).min(FRAC_PI_2);
    let count = (sweep.abs() / angle).ceil().max(1.);
    if !count.is_finite() || count > (MAX_PATH_POINTS - points.len()) as f64 {
        return Err("Curve sampling budget exceeded".into());
    }
    let count = count as usize;
    for k in 1..=count {
        let a = start + sweep * k as f64 / count as f64;
        push(points, center + radius * DVec2::new(a.cos(), a.sin()))?;
    }
    Ok(())
}
fn polyline(vertices: &[(DVec2, f64)], closed: bool, error: f64) -> Result<Vec<DVec2>, String> {
    if vertices.len() < 2 {
        return Err("Polyline needs at least two vertices".into());
    }
    let mut out = vec![vertices[0].0];
    let segments = vertices.len() - usize::from(!closed);
    for i in 0..segments {
        let (a, bulge) = vertices[i];
        let b = vertices[(i + 1) % vertices.len()].0;
        let chord = b - a;
        let length = chord.length();
        if !length.is_finite() {
            return Err("Polyline segment length overflow".into());
        }
        if length == 0. && bulge != 0. {
            return Err("Bulged segment has coincident endpoints".into());
        }
        if bulge == 0. || bulge.abs() * length * 0.5 <= error {
            push(&mut out, b)?;
        } else {
            let normal = DVec2::new(-chord.y, chord.x) / length;
            let center = a + chord * 0.5 + normal * (length * 0.25 * (1. / bulge - bulge));
            let radius = length * 0.25 * (bulge.abs() + 1. / bulge.abs());
            let start = (a - center).y.atan2((a - center).x);
            arc(&mut out, center, radius, start, 4. * bulge.atan(), error)?;
            *out.last_mut().unwrap() = b;
        }
    }
    Ok(out)
}

fn geometry(
    kind: &str,
    pairs: &[Pair<'_>],
    vertices: &[Vec<Pair<'_>>],
    scale: f64,
    error: f64,
) -> Result<(Vec<DVec2>, bool), String> {
    planar(pairs)?;
    match kind {
        "LINE" => Ok((
            vec![point(pairs, 10, scale)?, point(pairs, 11, scale)?],
            false,
        )),
        "CIRCLE" | "ARC" => {
            let center = point(pairs, 10, scale)?;
            let radius = number(pairs, 40, None)? * scale;
            let start = if kind == "ARC" {
                number(pairs, 50, None)?.to_radians()
            } else {
                0.
            };
            let sweep = if kind == "ARC" {
                (number(pairs, 51, None)?.to_radians() - start).rem_euclid(TAU)
            } else {
                TAU
            };
            if !start.is_finite() || !sweep.is_finite() || sweep == 0. {
                return Err("Invalid or ambiguous arc angles".into());
            }
            let mut out = vec![];
            push(
                &mut out,
                center + radius * DVec2::new(start.cos(), start.sin()),
            )?;
            arc(&mut out, center, radius, start, sweep, error)?;
            if kind == "CIRCLE" {
                *out.last_mut().unwrap() = out[0];
            }
            Ok((out, kind == "CIRCLE"))
        }
        "LWPOLYLINE" | "POLYLINE" => {
            let flags = integer(pairs, 70, 0)?;
            if flags & !129 != 0 {
                return Err("3D, mesh or fitted polylines are unsupported".into());
            }
            for code in [40, 41, 43] {
                if pairs
                    .iter()
                    .any(|p| p.code == code && p.value.parse::<f64>() != Ok(0.))
                {
                    return Err("Polyline stroke width is unsupported".into());
                }
            }
            let chunks: Vec<Vec<Pair<'_>>>;
            let records = if kind == "LWPOLYLINE" {
                let mut v: Vec<Vec<Pair<'_>>> = vec![];
                for p in pairs {
                    if p.code == 10 {
                        v.push(vec![]);
                    }
                    if matches!(p.code, 10 | 20 | 42) {
                        v.last_mut()
                            .ok_or("Vertex field before its X coordinate")?
                            .push(*p);
                    }
                }
                let count = integer(pairs, 90, -1)?;
                if count < 0 || count as usize != v.len() {
                    return Err("Polyline vertex count mismatch".into());
                }
                chunks = v;
                &chunks
            } else {
                vertices
            };
            let mut values = vec![];
            for v in records {
                planar(v)?;
                if integer(v, 70, 0)? != 0 {
                    return Err("Fitted/3D vertices are unsupported".into());
                }
                if number(v, 40, Some(0.))? != 0. || number(v, 41, Some(0.))? != 0. {
                    return Err("Vertex stroke width is unsupported".into());
                }
                values.push((point(v, 10, scale)?, number(v, 42, Some(0.))?));
            }
            let closed = flags & 1 != 0;
            Ok((polyline(&values, closed, error)?, closed))
        }
        _ => Err("Unsupported entity type".into()),
    }
}

/// Parse into a reviewable geometry report. Structural or scale failures are
/// errors; rejected entities are retained as issues alongside accepted paths.
pub fn read_ascii(text: &str, options: Options) -> Result<Drawing, String> {
    if text.len() > MAX_BYTES || text.contains('\0') {
        return Err("Not bounded text DXF (16 MiB maximum)".into());
    }
    if !options.chord_error_m.is_finite() || options.chord_error_m <= 0. {
        return Err("Chord error must be positive finite metres".into());
    }
    let mut lines = text.trim_start_matches('\u{feff}').lines();
    let mut pairs = vec![];
    while let Some(code) = lines.next() {
        let value = lines.next().ok_or("Incomplete DXF group pair")?;
        let code = code
            .trim()
            .parse::<i32>()
            .map_err(|_| "Invalid DXF group code")?;
        if code != 999 {
            pairs.push(Pair {
                code,
                value: value.trim(),
            });
        }
    }
    let mut i = 0;
    let mut units = None;
    let mut entities: Option<&[Pair<'_>]> = None;
    let mut eof = false;
    while i < pairs.len() {
        if pairs[i].code == 0 && pairs[i].value == "EOF" {
            eof = true;
            i += 1;
            break;
        }
        if pairs[i].code != 0 || pairs[i].value != "SECTION" {
            return Err("Expected SECTION or EOF".into());
        }
        i += 1;
        let section = pairs
            .get(i)
            .filter(|p| p.code == 2)
            .ok_or("Missing section name")?
            .value;
        i += 1;
        let start = i;
        while i < pairs.len() && !(pairs[i].code == 0 && pairs[i].value == "ENDSEC") {
            i += 1;
        }
        if i == pairs.len() {
            return Err("Unclosed DXF section".into());
        }
        let content = &pairs[start..i];
        if section == "ENTITIES" {
            if entities.replace(content).is_some() {
                return Err("Duplicate ENTITIES section".into());
            }
        } else if section == "HEADER" {
            for (j, p) in content.iter().enumerate() {
                if p.code == 9 && p.value == "$INSUNITS" {
                    if units.is_some() {
                        return Err("Duplicate INSUNITS".into());
                    }
                    units = Some(
                        content
                            .get(j + 1)
                            .filter(|p| p.code == 70)
                            .ok_or("Missing INSUNITS value")?
                            .value
                            .parse::<i32>()
                            .map_err(|_| "Invalid INSUNITS")?,
                    );
                }
            }
        }
        i += 1;
    }
    if !eof || i != pairs.len() {
        return Err("Missing EOF or trailing DXF content".into());
    }
    let scale = options
        .metres_per_unit
        .or(match units {
            Some(1) => Some(0.0254),
            Some(2) => Some(0.3048),
            Some(4) => Some(0.001),
            Some(5) => Some(0.01),
            Some(6) => Some(1.),
            _ => None,
        })
        .ok_or("Unknown/unitless scale: supply explicit metres_per_unit")?;
    if !scale.is_finite() || scale <= 0. {
        return Err("Scale must be positive and finite".into());
    }
    let entities = entities.ok_or("Missing ENTITIES section")?;
    let mut result = Drawing {
        paths: vec![],
        issues: vec![],
        insunits: units,
        metres_per_unit: scale,
        scale_overridden: options.metres_per_unit.is_some(),
    };
    let mut i = 0;
    let mut total = 0;
    while i < entities.len() {
        if entities[i].code != 0 {
            return Err("Entity must start with group 0".into());
        }
        let kind = entities[i].value;
        i += 1;
        let start = i;
        while i < entities.len() && entities[i].code != 0 {
            i += 1;
        }
        let fields = &entities[start..i];
        let mut vertices = vec![];
        if kind == "POLYLINE" {
            while i < entities.len() && entities[i].value == "VERTEX" {
                i += 1;
                let start = i;
                while i < entities.len() && entities[i].code != 0 {
                    i += 1;
                }
                vertices.push(entities[start..i].to_vec());
            }
            if i >= entities.len() || entities[i].value != "SEQEND" {
                return Err("POLYLINE missing SEQEND".into());
            }
            i += 1;
            while i < entities.len() && entities[i].code != 0 {
                i += 1;
            }
        }
        let layer = field(fields, 8)?.unwrap_or("0").to_owned();
        let handle = field(fields, 5)?.map(str::to_owned);
        match geometry(kind, fields, &vertices, scale, options.chord_error_m) {
            Ok((points, closed)) => {
                total += points.len();
                if total > MAX_POINTS {
                    return Err("Drawing point budget exceeded".into());
                }
                result.paths.push(Path {
                    entity: kind.into(),
                    handle,
                    layer,
                    points,
                    closed,
                });
            }
            Err(reason) => result.issues.push(Issue {
                entity: kind.into(),
                handle,
                layer,
                reason,
            }),
        }
    }
    Ok(result)
}
