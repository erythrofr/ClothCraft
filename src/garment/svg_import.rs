//! SVG outline geometry in physical metres, with +Y down like material V.
//! Parsing and prepared edits must never infer seams from adjacent contours.
use super::{
    GarmentTemplate, domain,
    meshing::MeshingSettings,
    polygon::PolygonPattern,
    template::{Panel, Placement},
};
use crate::{
    authoring::{self, Edit},
    model::Pattern,
};
use glam::{DAffine2, DMat2, DVec2, DVec3};
use std::collections::{BTreeMap, BTreeSet};

const MAX_PIECES: usize = 128;
const MAX_CONTOUR_POINTS: usize = 4096;
const MAX_COMPARISONS: usize = 2_000_000;

/// One explicitly closed source contour; the first vertex is not repeated.
#[derive(Clone, Debug)]
pub struct Outline {
    pub name: String,
    pub points: Vec<DVec2>,
}

/// Source geometry and explicit conversion losses, for review before applying.
#[derive(Clone, Debug)]
pub struct Drawing {
    pub outlines: Vec<Outline>,
    pub losses: Vec<String>,
}

#[derive(Clone, Copy, Debug)]
pub struct Options {
    /// Maximum geometric curve-to-chord error after transforms, in metres.
    pub chord_error_m: f64,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            chord_error_m: 0.0001,
        }
    }
}

type Attributes = BTreeMap<String, String>;
fn number_list(s: &str, max: usize) -> Result<Vec<f64>, String> {
    let mut values = vec![];
    for value in svgtypes::NumberListParser::from(s) {
        let value = value.map_err(|e| e.to_string())?;
        if !value.is_finite() || value.abs() > 1e9 || values.len() == max {
            return Err("Invalid or oversized SVG number list".into());
        }
        values.push(value);
    }
    Ok(values)
}
fn length(s: &str, physical: bool) -> Result<f64, String> {
    use svgtypes::LengthUnit as U;
    let v: svgtypes::Length = s
        .trim()
        .parse()
        .map_err(|e: svgtypes::Error| e.to_string())?;
    let factor = match v.unit {
        U::Mm => 0.001,
        U::Cm => 0.01,
        U::In => 0.0254,
        U::Pt => 0.0254 / 72.,
        U::Pc => 0.0254 / 6.,
        U::Px => 0.0254 / 96.,
        U::None if !physical => 0.0254 / 96.,
        _ => return Err("SVG needs absolute units; root dimensions need an explicit unit".into()),
    };
    if !v.number.is_finite() || v.number.abs() > 1e9 {
        return Err("Invalid SVG length".into());
    }
    Ok(v.number * factor / if physical { 1. } else { 0.0254 / 96. })
}
fn attr_length(a: &Attributes, key: &str, default: Option<f64>) -> Result<f64, String> {
    a.get(key)
        .map(|s| length(s, false))
        .unwrap_or_else(|| default.ok_or_else(|| format!("Missing SVG {key}")))
}
fn affine(value: &str) -> Result<DAffine2, String> {
    let t: svgtypes::Transform = value.parse().map_err(|e: svgtypes::Error| e.to_string())?;
    let m = DAffine2::from_mat2_translation(
        DMat2::from_cols(DVec2::new(t.a, t.b), DVec2::new(t.c, t.d)),
        DVec2::new(t.e, t.f),
    );
    checked_affine(m)
}
fn checked_affine(m: DAffine2) -> Result<DAffine2, String> {
    let d = m.matrix2.determinant();
    if !m.is_finite() || !d.is_finite() || d == 0. {
        Err("Nonfinite or singular SVG transform".into())
    } else {
        Ok(m)
    }
}
fn viewport(a: &Attributes) -> Result<DAffine2, String> {
    let width = length(a.get("width").ok_or("SVG needs a physical width")?, true)?;
    let height = length(a.get("height").ok_or("SVG needs a physical height")?, true)?;
    if width <= 0. || height <= 0. || width > 1000. || height > 1000. {
        return Err("Invalid SVG viewport size".into());
    }
    let Some(v) = a.get("viewBox") else {
        if a.contains_key("preserveAspectRatio") {
            return Err("preserveAspectRatio requires viewBox".into());
        }
        return Ok(DAffine2::from_scale(DVec2::splat(0.0254 / 96.)));
    };
    let v = number_list(v, 4)?;
    if v.len() != 4 || v[2] <= 0. || v[3] <= 0. {
        return Err("viewBox needs four numbers and positive size".into());
    }
    // The dependency's AspectRatio parser accepts trailing data. Validate our
    // complete supported syntax before using its typed representation.
    let aspect = a
        .get("preserveAspectRatio")
        .map(String::as_str)
        .unwrap_or("xMidYMid meet");
    let words: Vec<_> = aspect.split_whitespace().collect();
    if words.is_empty() || words.len() > 2 || (words.len() == 2 && words[1] != "meet") {
        return Err(
            "Only complete preserveAspectRatio none/alignment meet is supported; no clipping"
                .into(),
        );
    }
    let ratio: svgtypes::AspectRatio =
        aspect.parse().map_err(|e: svgtypes::Error| e.to_string())?;
    use svgtypes::Align as A;
    let mut scale = DVec2::new(width / v[2], height / v[3]);
    let mut padding = DVec2::ZERO;
    if ratio.align != A::None {
        scale = DVec2::splat(scale.min_element());
        let ax = match ratio.align {
            A::XMinYMin | A::XMinYMid | A::XMinYMax => 0.,
            A::XMaxYMin | A::XMaxYMid | A::XMaxYMax => 1.,
            _ => 0.5,
        };
        let ay = match ratio.align {
            A::XMinYMin | A::XMidYMin | A::XMaxYMin => 0.,
            A::XMinYMax | A::XMidYMax | A::XMaxYMax => 1.,
            _ => 0.5,
        };
        padding = (DVec2::new(width, height) - scale * DVec2::new(v[2], v[3])) * DVec2::new(ax, ay);
    }
    checked_affine(DAffine2::from_mat2_translation(
        DMat2::from_diagonal(scale),
        padding - scale * DVec2::new(v[0], v[1]),
    ))
}
fn push_point(out: &mut Vec<DVec2>, point: DVec2) -> Result<(), String> {
    if !point.is_finite() || point.abs().max_element() > 1000. {
        return Err("SVG geometry exceeds finite 1000 metre bounds".into());
    }
    if out.last() == Some(&point) {
        return Ok(());
    }
    if out.len() > MAX_CONTOUR_POINTS {
        return Err("SVG contour point budget exceeded".into());
    }
    out.push(point);
    Ok(())
}
fn cubic_points(
    out: &mut Vec<DVec2>,
    p: [DVec2; 4],
    m: DAffine2,
    tolerance: f64,
) -> Result<(), String> {
    for p in super::curves::flatten(p.map(|p| m.transform_point2(p)), tolerance)?
        .into_iter()
        .skip(1)
    {
        push_point(out, p)?;
    }
    Ok(())
}
/// Parametric ellipse: ||f''|| <= ||u|| + ||v||. Linear interpolation error
/// on an angular interval h is bounded by h² max||f''|| / 8, after transforms.
fn ellipse_points(
    out: &mut Vec<DVec2>,
    center: DVec2,
    u: DVec2,
    v: DVec2,
    start: f64,
    sweep: f64,
    tolerance: f64,
) -> Result<(), String> {
    let bound = u.length() + v.length();
    let count = (sweep.abs() * (bound / (8. * tolerance)).sqrt())
        .ceil()
        .max(if sweep.abs() >= std::f64::consts::TAU {
            4.
        } else {
            1.
        });
    if !count.is_finite() || count > MAX_CONTOUR_POINTS as f64 {
        return Err("SVG ellipse subdivision budget exceeded".into());
    }
    for i in 1..=count as usize {
        let angle = start + sweep * i as f64 / count;
        push_point(out, center + u * angle.cos() + v * angle.sin())?;
    }
    Ok(())
}
#[derive(Clone, Copy)]
struct ArcSpec {
    radii: DVec2,
    rotation: f64,
    large: bool,
    sweep: bool,
}
fn arc_points(
    out: &mut Vec<DVec2>,
    from: DVec2,
    to: DVec2,
    spec: ArcSpec,
    m: DAffine2,
    tolerance: f64,
) -> Result<(), String> {
    use std::f64::consts::TAU;
    let mut r = spec.radii.abs();
    if from == to {
        return Ok(());
    }
    if r.min_element() == 0. {
        return push_point(out, m.transform_point2(to));
    }
    let rot = DMat2::from_angle(spec.rotation.to_radians());
    let p = rot.transpose() * (from - to) * 0.5;
    let lambda = (p / r).length_squared();
    if lambda > 1. {
        r *= lambda.sqrt();
    }
    let q = p / r;
    let denom = q.length_squared();
    if !denom.is_finite() || denom == 0. {
        return Err("Ill-conditioned SVG arc".into());
    }
    let factor =
        ((1. - denom).max(0.) / denom).sqrt() * if spec.large == spec.sweep { -1. } else { 1. };
    let cp = DVec2::new(r.x * q.y, -r.y * q.x) * factor;
    let center = rot * cp + (from + to) * 0.5;
    let a = (p - cp) / r;
    let b = (-p - cp) / r;
    let start = a.y.atan2(a.x);
    let mut sweep = a.perp_dot(b).atan2(a.dot(b));
    if spec.sweep && sweep < 0. {
        sweep += TAU;
    }
    if !spec.sweep && sweep > 0. {
        sweep -= TAU;
    }
    ellipse_points(
        out,
        m.transform_point2(center),
        m.transform_vector2(rot * DVec2::new(r.x, 0.)),
        m.transform_vector2(rot * DVec2::new(0., r.y)),
        start,
        sweep,
        tolerance,
    )?;
    // Avoid a floating-point near-duplicate of the exact authored endpoint.
    out.pop().ok_or("Empty SVG arc")?;
    push_point(out, m.transform_point2(to))?;
    Ok(())
}

fn path_points(data: &str, m: DAffine2, tolerance: f64) -> Result<Vec<DVec2>, String> {
    use svgtypes::PathSegment as S;
    let mut out = vec![];
    let mut current = DVec2::ZERO;
    let mut start = None;
    let mut closed = false;
    let mut cubic_control = None;
    let mut quadratic_control = None;
    for (count, segment) in svgtypes::PathParser::from(data).enumerate() {
        if count >= 100_000 {
            return Err("SVG path token budget exceeded".into());
        }
        let segment = segment.map_err(|e| e.to_string())?;
        if closed {
            return Err("Compound SVG paths are ambiguous; split their outlines first".into());
        }
        let point = |abs: bool, x: f64, y: f64| {
            if abs {
                DVec2::new(x, y)
            } else {
                current + DVec2::new(x, y)
            }
        };
        let mut next_cubic = None;
        let mut next_quadratic = None;
        match segment {
            S::MoveTo { abs, x, y } => {
                if start.is_some() {
                    return Err("Compound/open SVG subpaths are unsupported".into());
                }
                current = point(abs, x, y);
                start = Some(current);
                push_point(&mut out, m.transform_point2(current))?;
            }
            S::LineTo { abs, x, y } => {
                current = point(abs, x, y);
                push_point(&mut out, m.transform_point2(current))?;
            }
            S::HorizontalLineTo { abs, x } => {
                current.x = if abs { x } else { current.x + x };
                push_point(&mut out, m.transform_point2(current))?;
            }
            S::VerticalLineTo { abs, y } => {
                current.y = if abs { y } else { current.y + y };
                push_point(&mut out, m.transform_point2(current))?;
            }
            S::CurveTo {
                abs,
                x1,
                y1,
                x2,
                y2,
                x,
                y,
            } => {
                let c1 = point(abs, x1, y1);
                let c2 = point(abs, x2, y2);
                let end = point(abs, x, y);
                cubic_points(&mut out, [current, c1, c2, end], m, tolerance)?;
                current = end;
                next_cubic = Some(c2);
            }
            S::SmoothCurveTo { abs, x2, y2, x, y } => {
                let c1 = cubic_control.map(|c| 2. * current - c).unwrap_or(current);
                let c2 = point(abs, x2, y2);
                let end = point(abs, x, y);
                cubic_points(&mut out, [current, c1, c2, end], m, tolerance)?;
                current = end;
                next_cubic = Some(c2);
            }
            S::Quadratic { abs, x1, y1, x, y } => {
                let c = point(abs, x1, y1);
                let end = point(abs, x, y);
                cubic_points(
                    &mut out,
                    [
                        current,
                        current + (c - current) * (2. / 3.),
                        end + (c - end) * (2. / 3.),
                        end,
                    ],
                    m,
                    tolerance,
                )?;
                current = end;
                next_quadratic = Some(c);
            }
            S::SmoothQuadratic { abs, x, y } => {
                let c = quadratic_control
                    .map(|c| 2. * current - c)
                    .unwrap_or(current);
                let end = point(abs, x, y);
                cubic_points(
                    &mut out,
                    [
                        current,
                        current + (c - current) * (2. / 3.),
                        end + (c - end) * (2. / 3.),
                        end,
                    ],
                    m,
                    tolerance,
                )?;
                current = end;
                next_quadratic = Some(c);
            }
            S::EllipticalArc {
                abs,
                rx,
                ry,
                x_axis_rotation,
                large_arc,
                sweep,
                x,
                y,
            } => {
                let end = point(abs, x, y);
                arc_points(
                    &mut out,
                    current,
                    end,
                    ArcSpec {
                        radii: DVec2::new(rx, ry),
                        rotation: x_axis_rotation,
                        large: large_arc,
                        sweep,
                    },
                    m,
                    tolerance,
                )?;
                current = end;
            }
            S::ClosePath { .. } => {
                closed = true;
                current = start.ok_or("SVG close without a start")?;
            }
        }
        if !current.is_finite() {
            return Err("Nonfinite SVG path".into());
        }
        cubic_control = next_cubic;
        quadratic_control = next_quadratic;
    }
    if !closed {
        return Err("Open SVG paths are not panel outlines".into());
    }
    if out.first() == out.last() {
        out.pop();
    }
    if !(3..=MAX_CONTOUR_POINTS).contains(&out.len()) {
        return Err("Invalid SVG contour point count".into());
    }
    Ok(out)
}

fn shape(tag: &str, a: &Attributes, m: DAffine2, tolerance: f64) -> Result<Vec<DVec2>, String> {
    let mut out = vec![];
    match tag {
        "path" => return path_points(a.get("d").ok_or("SVG path has no data")?, m, tolerance),
        "polygon" | "polyline" => {
            let values = number_list(
                a.get("points").ok_or("SVG shape has no points")?,
                2 * (MAX_CONTOUR_POINTS + 1),
            )?;
            if values.len() % 2 != 0 {
                return Err("SVG points need complete coordinate pairs".into());
            }
            for p in values.as_chunks::<2>().0 {
                push_point(&mut out, m.transform_point2(DVec2::new(p[0], p[1])))?;
            }
            if tag == "polyline" && out.first() != out.last() {
                return Err("Open SVG polylines are not panel outlines".into());
            }
        }
        "rect" => {
            if attr_length(a, "rx", Some(0.))? != 0. || attr_length(a, "ry", Some(0.))? != 0. {
                return Err("Convert rounded SVG rectangles to paths before import".into());
            }
            let p = DVec2::new(
                attr_length(a, "x", Some(0.))?,
                attr_length(a, "y", Some(0.))?,
            );
            let size = DVec2::new(
                attr_length(a, "width", None)?,
                attr_length(a, "height", None)?,
            );
            if size.min_element() <= 0. {
                return Err("SVG rectangle size must be positive".into());
            }
            for q in [
                p,
                p + DVec2::new(size.x, 0.),
                p + size,
                p + DVec2::new(0., size.y),
            ] {
                push_point(&mut out, m.transform_point2(q))?;
            }
        }
        "circle" | "ellipse" => {
            let center = DVec2::new(
                attr_length(a, "cx", Some(0.))?,
                attr_length(a, "cy", Some(0.))?,
            );
            let rx = attr_length(a, if tag == "circle" { "r" } else { "rx" }, None)?;
            let ry = if tag == "circle" {
                rx
            } else {
                attr_length(a, "ry", None)?
            };
            if rx <= 0. || ry <= 0. {
                return Err("SVG ellipse radii must be positive".into());
            }
            let center = m.transform_point2(center);
            let u = m.transform_vector2(DVec2::new(rx, 0.));
            let v = m.transform_vector2(DVec2::new(0., ry));
            push_point(&mut out, center + u)?;
            ellipse_points(&mut out, center, u, v, 0., std::f64::consts::TAU, tolerance)?;
            out.pop(); // Last sample is the same periodic endpoint, up to rounding.
        }
        _ => return Err(format!("Unsupported SVG geometry: {tag}")),
    }
    if out.first() == out.last() {
        out.pop();
    }
    if !(3..=MAX_CONTOUR_POINTS).contains(&out.len()) {
        return Err("Invalid SVG contour point count".into());
    }
    Ok(out)
}

/// Strict geometry-only SVG subset. No external resource is resolved or executed.
/// Unsupported semantics fail the entire read; callers must display `losses`.
pub fn read_svg(source: &str, options: Options) -> Result<Drawing, String> {
    use quick_xml::{events::Event, name::ResolveResult};
    if source.len() > 3 * 1024 * 1024 {
        return Err("SVG exceeds the 3 MiB input limit".into());
    }
    if !options.chord_error_m.is_finite()
        || options.chord_error_m <= 0.
        || options.chord_error_m > 0.01
    {
        return Err("SVG curve tolerance must be positive and at most 10 mm".into());
    }
    struct Frame {
        tag: String,
        transform: DAffine2,
        hidden: bool,
    }
    let mut reader = quick_xml::NsReader::from_str(source);
    reader.config_mut().expand_empty_elements = true;
    reader.config_mut().check_comments = true;
    let mut stack: Vec<Frame> = vec![];
    let mut seen = false;
    let mut seen_declaration = false;
    let mut count = 0;
    let mut total_points = 0;
    let mut drawing = Drawing {
        outlines: vec![],
        losses: vec![
            "Geometry only: no sewing, materials, allowances or stroke widths are inferred".into(),
            format!(
                "Curves become polygon edges with chord error at most {} m; viewport clipping is not applied",
                options.chord_error_m
            ),
        ],
    };
    loop {
        let decoder = reader.decoder();
        let (ns, event) = reader.read_resolved_event().map_err(|e| e.to_string())?;
        match event {
            Event::Start(e) => {
                count += 1;
                if count > 4096 || stack.len() >= 64 {
                    return Err("SVG element/depth budget exceeded".into());
                }
                if !matches!(ns,ResolveResult::Bound(n) if n.as_ref()==b"http://www.w3.org/2000/svg")
                {
                    return Err("Only the SVG namespace is supported".into());
                }
                let tag = std::str::from_utf8(e.local_name().as_ref())
                    .map_err(|e| e.to_string())?
                    .to_owned();
                if !matches!(
                    tag.as_str(),
                    "svg"
                        | "g"
                        | "path"
                        | "polygon"
                        | "polyline"
                        | "rect"
                        | "circle"
                        | "ellipse"
                        | "title"
                        | "desc"
                ) {
                    return Err(format!(
                        "Unsupported SVG element: {tag}; expand effects/references first"
                    ));
                }
                if stack.last().is_some_and(|f| f.tag != "svg" && f.tag != "g") {
                    return Err("SVG geometry/text cannot contain child elements".into());
                }
                let mut a = Attributes::new();
                for attribute in e.attributes() {
                    let attribute = attribute.map_err(|e| e.to_string())?;
                    let key =
                        std::str::from_utf8(attribute.key.as_ref()).map_err(|e| e.to_string())?;
                    let value = attribute
                        .decoded_and_normalized_value(quick_xml::XmlVersion::Implicit1_0, decoder)
                        .map_err(|e| e.to_string())?
                        .into_owned();
                    if key == "xmlns" || key.starts_with("xmlns:") {
                        continue;
                    }
                    if key.starts_with("on") || key.contains(':') || value.contains("url(") {
                        return Err(format!("Unsupported SVG attribute: {key}"));
                    }
                    if !matches!(
                        key,
                        "id" | "data-name"
                            | "width"
                            | "height"
                            | "viewBox"
                            | "preserveAspectRatio"
                            | "version"
                            | "transform"
                            | "d"
                            | "points"
                            | "x"
                            | "y"
                            | "rx"
                            | "ry"
                            | "r"
                            | "cx"
                            | "cy"
                            | "fill"
                            | "stroke"
                            | "stroke-width"
                            | "fill-rule"
                            | "display"
                            | "style"
                    ) {
                        return Err(format!("Unsupported SVG attribute: {key}"));
                    }
                    a.insert(key.into(), value);
                }
                let mut hidden = stack.last().is_some_and(|f| f.hidden);
                if let Some(style) = a.remove("style") {
                    for declaration in style.split(';').filter(|s| !s.trim().is_empty()) {
                        let (key, value) =
                            declaration.split_once(':').ok_or("Invalid SVG style")?;
                        let (key, value) = (key.trim(), value.trim());
                        if !matches!(
                            key,
                            "fill" | "stroke" | "stroke-width" | "fill-rule" | "display"
                        ) || value.contains("url(")
                            || value.contains('!')
                        {
                            return Err(
                                "Unsupported SVG style; expand geometry and effects first".into()
                            );
                        }
                        a.insert(key.into(), value.into());
                    }
                }
                if let Some(display) = a.get("display") {
                    match display.as_str() {
                        "none" => hidden = true,
                        "inline" => {}
                        _ => return Err("Unsupported SVG display value".into()),
                    }
                }
                let parent = if stack.is_empty() {
                    if seen || tag != "svg" {
                        return Err("SVG requires exactly one root".into());
                    }
                    if a.contains_key("transform") || a.contains_key("x") || a.contains_key("y") {
                        return Err("Root SVG transforms/placement are unsupported; use a transformed group inside the viewport".into());
                    }
                    seen = true;
                    viewport(&a)?
                } else {
                    if tag == "svg" {
                        return Err("Nested SVG viewports are unsupported".into());
                    }
                    stack.last().unwrap().transform
                };
                let transform = checked_affine(
                    parent * affine(a.get("transform").map(String::as_str).unwrap_or(""))?,
                )?;
                if !matches!(tag.as_str(), "svg" | "g" | "title" | "desc") {
                    if hidden {
                        drawing.losses.push(format!("Hidden {tag} excluded"));
                    } else {
                        let points = shape(&tag, &a, transform, options.chord_error_m)?;
                        total_points += points.len();
                        if drawing.outlines.len() == MAX_PIECES || total_points > 100_000 {
                            return Err("SVG drawing output budget exceeded".into());
                        }
                        let name = a
                            .get("data-name")
                            .or_else(|| a.get("id"))
                            .cloned()
                            .unwrap_or_else(|| format!("SVG {}", drawing.outlines.len() + 1));
                        if name.len() > 256 {
                            return Err("SVG outline name exceeds 256 bytes".into());
                        }
                        drawing.outlines.push(Outline { name, points });
                    }
                }
                stack.push(Frame {
                    tag,
                    transform,
                    hidden,
                });
            }
            Event::End(_) => {
                stack.pop().ok_or("Unmatched SVG closing tag")?;
            }
            Event::Eof => break,
            Event::Comment(_) => {}
            Event::Decl(e) => {
                if seen || seen_declaration {
                    return Err("XML declaration must precede the SVG root".into());
                }
                seen_declaration = true;
                if e.version().map_err(|e| e.to_string())?.as_ref() != b"1.0" {
                    return Err("Only XML 1.0 SVG input is supported".into());
                }
                if let Some(encoding) = e.encoding() {
                    let encoding = encoding.map_err(|e| e.to_string())?;
                    if !encoding.eq_ignore_ascii_case(b"utf-8") {
                        return Err("Only UTF-8 SVG input is supported".into());
                    }
                }
            }
            Event::Text(e) => {
                if !stack
                    .last()
                    .is_some_and(|f| matches!(f.tag.as_str(), "title" | "desc"))
                    && e.as_ref().iter().any(|b| !b.is_ascii_whitespace())
                {
                    return Err("Unexpected SVG text".into());
                }
            }
            _ => return Err(
                "SVG DTDs, entities, processing instructions and embedded content are unsupported"
                    .into(),
            ),
        }
    }
    if !seen || !stack.is_empty() || drawing.outlines.is_empty() {
        return Err("SVG contains no complete supported outlines".into());
    }
    Ok(drawing)
}

fn edge_intersection(a: DVec2, b: DVec2, c: DVec2, d: DVec2) -> bool {
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

/// Append reviewed contours as separated, unsewn panels. Source coordinates are
/// already physical metres; SVG +Y is not flipped as it would be for CAD DXF.
/// No live document/history is changed. The caller installs this fully compiled
/// edit as one transaction, preserving unchanged panels via `Edit::state_after`.
/// `origin` is chosen by the caller outside its current avatar/drape bounds.
pub fn prepare(
    source: &GarmentTemplate,
    drawing: &Drawing,
    selected: &[usize],
    fabric: &str,
    meshing: MeshingSettings,
    origin: DVec3,
) -> Result<Edit, String> {
    meshing.validate()?;
    if !origin.is_finite() {
        return Err("Import placement must be finite".into());
    }
    if selected.is_empty()
        || selected.len() > MAX_PIECES
        || source.panels.len().saturating_add(selected.len()) > MAX_PIECES
    {
        return Err("Choose 1..128 SVG outlines within the garment panel limit".into());
    }
    if !source.fabrics.iter().any(|f| f.id == fabric) {
        return Err("Choose an existing fabric".into());
    }
    let mut seen = BTreeSet::new();
    let mut contours = Vec::with_capacity(selected.len());
    for &index in selected {
        if !seen.insert(index) {
            return Err("An SVG outline was selected twice".into());
        }
        let outline = drawing
            .outlines
            .get(index)
            .ok_or("Stale SVG outline selection")?;
        if !(3..=MAX_CONTOUR_POINTS).contains(&outline.points.len())
            || outline
                .points
                .iter()
                .any(|p| !p.is_finite() || p.abs().max_element() > 1000.)
        {
            return Err("SVG contour needs 3..4096 finite points within 1000 metres".into());
        }
        contours.push(outline);
    }
    // Separate selected paths may be hole/cut/sew alternatives. Do not guess.
    // Closed polygon validity (including self-intersection) is checked by compile.
    let mut comparisons = 0;
    for (i, a) in contours.iter().enumerate() {
        for b in contours.iter().skip(i + 1) {
            if domain::inside(a.points[0], &b.points) || domain::inside(b.points[0], &a.points) {
                return Err("Selected SVG outlines are nested or overlapping".into());
            }
            for j in 0..a.points.len() {
                for k in 0..b.points.len() {
                    comparisons += 1;
                    if comparisons > MAX_COMPARISONS {
                        return Err(
                            "SVG contour comparison budget exceeded; select fewer outlines".into(),
                        );
                    }
                    if edge_intersection(
                        a.points[j],
                        a.points[(j + 1) % a.points.len()],
                        b.points[k],
                        b.points[(k + 1) % b.points.len()],
                    ) {
                        return Err("Selected SVG outlines touch or overlap".into());
                    }
                }
            }
        }
    }
    let mut template = source.clone();
    let board_x = source
        .panels
        .iter()
        .enumerate()
        .map(|(i, p)| authoring::layout(source, i).x + p.pattern.width)
        .fold(0., f64::max)
        + 0.15;
    let mut offset = 0.;
    let mut selected_id = None;
    for outline in contours {
        let lo = outline
            .points
            .iter()
            .copied()
            .fold(DVec2::splat(f64::INFINITY), DVec2::min);
        let hi = outline
            .points
            .iter()
            .copied()
            .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max);
        let size = hi - lo;
        let mut points: Vec<_> = outline.points.iter().map(|p| *p - lo).collect();
        if domain::area(&points) < 0. {
            points.reverse();
        }
        let mut serial = 1;
        let id = loop {
            let id = format!("svg_{serial}");
            if !template.panels.iter().any(|p| p.id == id) {
                break id;
            }
            serial += 1;
        };
        let polygon = PolygonPattern {
            edges: (0..points.len())
                .map(|i| format!("edge_{}", i + 1))
                .collect(),
            points,
            subdivisions: 0,
            meshing: Some(meshing.clone()),
            curves: BTreeMap::new(),
            holes: vec![],
            lines: vec![],
            target_lengths: BTreeMap::new(),
            seam_allowances: BTreeMap::new(),
            notches: BTreeMap::new(),
            measurements: Vec::new(),
        };
        template.panels.push(Panel {
            id: id.clone(),
            name: format!("{} · {}", outline.name, id),
            pattern: Pattern {
                width: size.x,
                height: size.y,
                nx: 1,
                ny: 1,
            },
            polygon: Some(polygon),
            fabric: fabric.into(),
            grain_degrees: 90.,
            placement: Placement {
                translation: origin + DVec3::new(offset, 0., 0.),
                ..Default::default()
            },
            layout_2d: Some(DVec2::new(board_x + offset, 0.)),
            layout_rotation_degrees: 0.,
            pins: vec![],
            pin_points: vec![],
        });
        offset += size.x + 0.1;
        selected_id = Some(id);
    }
    template.version = 2;
    let garment = template.compile()?;
    Ok(Edit {
        template,
        garment,
        selected: selected_id,
        reset_simulation: true,
        new_point: None,
    })
}
