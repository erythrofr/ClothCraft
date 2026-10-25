//! Deterministic interchange artifacts; all generated on CPU.
use super::embedding::MaterialPath;
use super::{CompiledGarment, GarmentTemplate, seam::Side};
use crate::model::State;
use glam::DVec2;
use std::{fmt::Write as _, fs, path::Path};

fn xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
fn edge_point(width: f64, height: f64, side: Side, t: f64) -> DVec2 {
    match side {
        Side::Top => DVec2::new(t * width, 0.0),
        Side::Right => DVec2::new(width, t * height),
        Side::Bottom => DVec2::new((1.0 - t) * width, height),
        Side::Left => DVec2::new(0.0, (1.0 - t) * height),
    }
}
fn reference_length(template: &GarmentTemplate, r: &super::seam::BoundaryRef) -> f64 {
    let Some(p) = template.panels.iter().find(|p| p.id == r.panel) else {
        return 0.;
    };
    let total = if let Some(name) = &r.edge {
        p.polygon
            .as_ref()
            .and_then(|p| p.paths().ok())
            .and_then(|paths| paths.into_iter().find(|(n, _)| n == name))
            .map_or(0., |(_, ps)| {
                ps.windows(2).map(|p| p[0].distance(p[1])).sum()
            })
    } else {
        match r.side {
            Side::Top | Side::Bottom => p.pattern.width,
            _ => p.pattern.height,
        }
    };
    total * (r.range[1] - r.range[0])
}
pub fn pattern_svg(template: &GarmentTemplate) -> String {
    let columns = template.panels.len().min(3);
    let rows = template.panels.len().div_ceil(columns.max(1));
    let width = columns * 360;
    let height = rows * 410 + 60;
    let mut out = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\"><rect width=\"100%\" height=\"100%\" fill=\"#141c26\"/><style>text{{font-family:Arial,sans-serif;fill:#dde9ef;font-size:13px}}</style><text x=\"24\" y=\"28\">{} — rest patterns / not a print-to-scale sewing pattern</text>",
        xml(&template.name)
    );
    for (i, panel) in template.panels.iter().enumerate() {
        let origin = DVec2::new(
            30.0 + (i % columns) as f64 * 360.0,
            70.0 + (i / columns) as f64 * 410.0,
        );
        let (w, h) = (panel.pattern.width, panel.pattern.height);
        let scale = (290.0 / w).min(280.0 / h);
        let pos = |p: DVec2| origin + p * scale;
        let paths = panel
            .polygon
            .as_ref()
            .and_then(|p| p.paths().ok())
            .unwrap_or_default();
        write!(out,"<text x=\"{}\" y=\"{}\">{} · {}</text><rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"#233d47\" stroke=\"#75c8d1\"/>",origin.x,origin.y-15.0,xml(&panel.id),xml(&panel.name),origin.x,origin.y,w*scale,h*scale).unwrap();
        if let Some(polygon) = &panel.polygon {
            // Cover the legacy rectangular outline before drawing the actual contour.
            write!(out,"<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"#141c26\"/><path fill-rule=\"evenodd\" d=\"",origin.x-1.0,origin.y-1.0,w*scale+2.0,h*scale+2.0).unwrap();
            let outer = polygon.outer_points().unwrap_or_default();
            for contour in std::iter::once(&outer).chain(polygon.holes.iter().map(|h| &h.points)) {
                for (k, p) in contour.iter().enumerate() {
                    let p = pos(*p);
                    write!(out, "{} {} {} ", if k == 0 { "M" } else { "L" }, p.x, p.y).unwrap();
                }
                out.push_str("Z ");
            }
            out.push_str("\" fill=\"#233d47\" stroke=\"#75c8d1\"/>");
            for line in &polygon.lines {
                out.push_str("<polyline points=\"");
                for p in line.samples().unwrap_or_default() {
                    let p = pos(p);
                    write!(out, "{},{} ", p.x, p.y).unwrap();
                }
                write!(out,"\" fill=\"none\" stroke=\"#eab1de\" stroke-dasharray=\"5 3\"><title>{}</title></polyline>",xml(&line.id)).unwrap();
            }
        }
        let centre = pos(DVec2::new(w, h) * 0.5);
        let angle = panel.grain_degrees.to_radians();
        let direction = DVec2::new(angle.cos(), angle.sin());
        let start = centre - direction * 35.0;
        let end = centre + direction * 35.0;
        let perp = DVec2::new(-direction.y, direction.x);
        let a = end - direction * 10.0 + perp * 5.0;
        let b = end - direction * 10.0 - perp * 5.0;
        write!(out,"<path d=\"M {} {} L {} {} M {} {} L {} {} L {} {}\" fill=\"none\" stroke=\"#ffd166\" stroke-width=\"2\"/>",start.x,start.y,end.x,end.y,a.x,a.y,end.x,end.y,b.x,b.y).unwrap();
        for (j, seam) in template.seams.iter().enumerate() {
            let color = ["#f4a261", "#a5d6a7", "#ce93d8", "#90caf9"][j % 4];
            let mut references = Vec::new();
            for side in 0..2 {
                let total: f64 = seam
                    .side(side == 1)
                    .map(|r| reference_length(template, r))
                    .sum();
                let mut offset = 0.;
                for r in seam.side(side == 1) {
                    let length = reference_length(template, r);
                    references.push((side, r, offset, length, total));
                    offset += length;
                }
            }
            for (side, reference, offset, length, total) in references {
                if reference.panel != panel.id {
                    continue;
                }
                let edge = |t: f64| {
                    let t = if reference.reversed { 1. - t } else { t };
                    let s = reference.range[0] + t * (reference.range[1] - reference.range[0]);
                    if let Some(name) = &reference.edge
                        && let Some((_, points)) = paths.iter().find(|(n, _)| n == name)
                    {
                        return pos(super::curves::arclength_point(points, s));
                    }
                    pos(edge_point(w, h, reference.side, s))
                };
                write!(out, "<polyline points=\"").unwrap();
                for k in 0..=32 {
                    let p = edge(k as f64 / 32.);
                    write!(out, "{},{} ", p.x, p.y).unwrap();
                }
                write!(out,"\" fill=\"none\" stroke=\"{color}\" stroke-width=\"4\"><title>{}: {}</title></polyline>",xml(&seam.id),if side==0 {"A"} else {"B"}).unwrap();
                for notch in &seam.notches {
                    let t = if side == 1 && seam.reverse_b {
                        1.0 - notch[side]
                    } else {
                        notch[side]
                    };
                    let t = (t * total - offset) / length;
                    if !(0. ..=1.).contains(&t) {
                        continue;
                    }
                    let p = edge(t);
                    write!(
                        out,
                        "<circle cx=\"{}\" cy=\"{}\" r=\"5\" fill=\"{color}\" stroke=\"#141c26\"/>",
                        p.x, p.y
                    )
                    .unwrap();
                }
            }
        }
        write!(out,"<text x=\"{}\" y=\"{}\">{:.0} × {:.0} mm · {} × {} cells</text><text x=\"{}\" y=\"{}\">Fabric {} · warp {:.1}° (yellow)</text>",origin.x,origin.y+310.0,w*1000.0,h*1000.0,panel.pattern.nx,panel.pattern.ny,origin.x,origin.y+333.0,xml(&panel.fabric),panel.grain_degrees).unwrap();
    }
    out.push_str("</svg>\n");
    out
}

/// Produce a physically dimensioned, untiled SVG of the *sewing outlines*.
///
/// Both the root SVG dimensions and its viewBox are in millimetres, so one
/// user-space unit represents one millimetre at 100% print size. This is not a
/// ready-to-cut pattern: seam allowances, page tiling and printer scaling are
/// deliberately outside this export's scope.
pub fn print_pattern_svg(template: &GarmentTemplate) -> Result<String, String> {
    template.compile()?;
    print_pattern_svg_validated(template)
}

// Call only after compiling this template successfully. Artifact export shares
// that validation with its JSON output instead of triangulating twice.
fn print_pattern_svg_validated(template: &GarmentTemplate) -> Result<String, String> {
    const MARGIN_MM: f64 = 20.0;
    const LABEL_MM: f64 = 14.0;
    const GAP_MM: f64 = 22.0;
    const RULER_MM: f64 = 35.0;

    if template.panels.is_empty() {
        return Err("Cannot print a template without panels".into());
    }
    let mut width_mm: f64 = 100.0 + 2.0 * MARGIN_MM;
    let mut height_mm = MARGIN_MM;
    let mut bounds = Vec::with_capacity(template.panels.len());
    for panel in &template.panels {
        let mut min = DVec2::ZERO;
        let mut max = DVec2::new(panel.pattern.width, panel.pattern.height);
        if !max.is_finite() || max.min_element() <= 0.0 || max.max_element() > 100.0 {
            return Err(format!(
                "Invalid printable dimensions for panel {}",
                panel.id
            ));
        }
        // Control handles may extend a valid curve beyond the declared corner
        // bounds. Include the sampled contour so export never clips that bulge.
        if let Some(polygon) = &panel.polygon {
            for point in polygon.outer_points()? {
                min = min.min(point);
                max = max.max(point);
            }
        }
        let size = (max - min) * 1000.0;
        let (w, h) = (size.x, size.y);
        if !w.is_finite()
            || !h.is_finite()
            || w <= 0.0
            || h <= 0.0
            || w > 100_000.0
            || h > 100_000.0
        {
            return Err(format!(
                "Invalid printable dimensions for panel {}",
                panel.id
            ));
        }
        width_mm = width_mm.max(w + 2.0 * MARGIN_MM);
        height_mm += LABEL_MM + h + GAP_MM;
        bounds.push((min * 1000.0, size));
    }
    height_mm += RULER_MM + MARGIN_MM;
    let mut out = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width_mm:.3}mm\" height=\"{height_mm:.3}mm\" viewBox=\"0 0 {width_mm:.3} {height_mm:.3}\"><title>{}</title><desc>Material-space sewing outlines at 1 SVG unit per mm. Print at 100% and check the 100 mm ruler. No seam allowances, page tiling or cutting certification.</desc><rect width=\"100%\" height=\"100%\" fill=\"white\"/>\n",
        xml(&template.name)
    );
    let mut y = MARGIN_MM;
    for (panel, (min, size)) in template.panels.iter().zip(bounds) {
        let (w, h) = (size.x, size.y);
        writeln!(
            out,
            "<text x=\"{MARGIN_MM:.3}\" y=\"{:.3}\" font-family=\"sans-serif\" font-size=\"5\" fill=\"black\">{} — {} ({w:.1} × {h:.1} mm)</text>",
            y + 5.0,
            xml(&panel.id),
            xml(&panel.name)
        ).unwrap();
        y += LABEL_MM;
        write!(out, "<g data-panel=\"{}\" transform=\"translate({:.3} {:.3})\">\n<path data-role=\"sewing-outline\" d=\"", xml(&panel.id), MARGIN_MM - min.x, y - min.y).unwrap();
        if let Some(polygon) = &panel.polygon {
            // Each Bézier boundary is sampled in material metres. The first
            // point of the following edge repeats the previous endpoint.
            for i in 0..polygon.edges.len() {
                let points = polygon.edge_points(i)?;
                for (j, p) in points.iter().enumerate() {
                    if i > 0 && j == 0 {
                        continue;
                    }
                    write!(
                        out,
                        "{} {:.3} {:.3} ",
                        if i == 0 && j == 0 { "M" } else { "L" },
                        p.x * 1000.0,
                        p.y * 1000.0
                    )
                    .unwrap();
                }
            }
            out.push_str("Z ");
            for hole in &polygon.holes {
                for (j, p) in hole.points.iter().enumerate() {
                    write!(
                        out,
                        "{} {:.3} {:.3} ",
                        if j == 0 { "M" } else { "L" },
                        p.x * 1000.0,
                        p.y * 1000.0
                    )
                    .unwrap();
                }
                out.push_str("Z ");
            }
        } else {
            write!(
                out,
                "M 0.000 0.000 L {w:.3} 0.000 L {w:.3} {h:.3} L 0.000 {h:.3} Z "
            )
            .unwrap();
        }
        out.push_str(
            "\" fill=\"none\" stroke=\"black\" stroke-width=\"0.3\" fill-rule=\"evenodd\"/>\n",
        );
        if let Some(polygon) = &panel.polygon {
            for line in &polygon.lines {
                write!(out, "<polyline data-role=\"internal-line\" points=\"").unwrap();
                for p in line.samples()? {
                    write!(out, "{:.3},{:.3} ", p.x * 1000.0, p.y * 1000.0).unwrap();
                }
                writeln!(out,"\" fill=\"none\" stroke=\"#555\" stroke-width=\"0.3\" stroke-dasharray=\"2 2\"><title>{}</title></polyline>",xml(&line.id)).unwrap();
            }
        }
        out.push_str("</g>\n");
        y += h + GAP_MM;
    }
    let ruler_y = y + 8.0;
    writeln!(out, "<g data-role=\"calibration-ruler\" stroke=\"black\" stroke-width=\"0.3\" fill=\"none\"><path d=\"M {MARGIN_MM:.3} {ruler_y:.3} h 100.000 M {MARGIN_MM:.3} {:.3} v 10.000 M {:.3} {:.3} v 10.000\"/></g><text x=\"{MARGIN_MM:.3}\" y=\"{:.3}\" font-family=\"sans-serif\" font-size=\"4\">100 mm calibration ruler — print at actual size (100%)</text></svg>",ruler_y-5.0,MARGIN_MM+100.0,ruler_y-5.0,ruler_y+17.0).unwrap();
    Ok(out)
}

pub fn obj(garment: &CompiledGarment, state: &State) -> String {
    let mut out = String::from("# MARVELOUS CLOTH garment; metres; UV=local rest pattern metres\n");
    for p in &state.x {
        writeln!(out, "v {:.12} {:.12} {:.12}", p.x, p.y, p.z).unwrap();
    }
    for p in &garment.mesh.uv {
        writeln!(out, "vt {:.12} {:.12}", p.x, p.y).unwrap();
    }
    for panel in &garment.panels {
        writeln!(out, "g {}", panel.id).unwrap();
        for t in &garment.mesh.triangles[panel.triangles.clone()] {
            let [a, b, c] = t.vertices.map(|i| i + 1);
            writeln!(out, "f {a}/{a} {b}/{b} {c}/{c}").unwrap();
        }
    }
    out
}

pub fn write_artifacts(
    template: &GarmentTemplate,
    garment: &CompiledGarment,
    state: &State,
    path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    // Preserve save's full template validation, but do it before any output is
    // replaced. A geometry/serialization failure must not leave mixed exports.
    // Filesystem failures during the writes below are not directory-atomic.
    template.compile()?;
    let physical_svg = print_pattern_svg_validated(template)?;
    let guides = grain_guides_obj(template, garment, state)?;
    let fibers = serde_json::to_string_pretty(&garment.fiber_frames(&state.x))?;
    let template_json = serde_json::to_string_pretty(template)?;
    let cloth_obj = obj(garment, state);
    let preview_svg = pattern_svg(template);
    fs::create_dir_all(path)?;
    fs::write(path.join("cloth.obj"), cloth_obj)?;
    fs::write(path.join("patterns.svg"), preview_svg)?;
    fs::write(path.join("patterns-print.svg"), physical_svg)?;
    fs::write(path.join("grain-guides.obj"), guides)?;
    fs::write(path.join("fibers.json"), fibers)?;
    fs::write(path.join("template.json"), template_json)?;
    Ok(())
}

/// Grain guides clipped to the actual contour; no yarn mechanics.
pub fn grain_guides_obj(
    template: &GarmentTemplate,
    garment: &CompiledGarment,
    state: &State,
) -> Result<String, String> {
    let mut out = String::from("# Material grain guides, not explicit yarn mechanics; metres\n");
    let mut index = 1;
    for panel in &template.panels {
        let w = panel.pattern.width;
        let h = panel.pattern.height;
        let center = DVec2::new(w, h) * 0.5;
        let contours = panel.polygon.as_ref().map_or_else(
            || {
                Ok(vec![vec![
                    DVec2::ZERO,
                    DVec2::new(w, 0.0),
                    DVec2::new(w, h),
                    DVec2::new(0.0, h),
                ]])
            },
            |p| -> Result<Vec<Vec<DVec2>>, String> {
                let mut contours = vec![p.outer_points()?];
                contours.extend(p.holes.iter().map(|h| h.points.clone()));
                Ok(contours)
            },
        )?;
        let angle = panel.grain_degrees.to_radians();
        for (name, angle) in [
            ("warp", angle),
            ("weft", angle + std::f64::consts::FRAC_PI_2),
        ] {
            let direction = DVec2::new(angle.cos(), angle.sin());
            let mut hits = vec![];
            for contour in &contours {
                for i in 0..contour.len() {
                    let a = contour[i];
                    let edge = contour[(i + 1) % contour.len()] - a;
                    let det = direction.perp_dot(edge);
                    if det.abs() < 1e-12 {
                        continue;
                    }
                    let t = (a - center).perp_dot(edge) / det;
                    let u = (a - center).perp_dot(direction) / det;
                    if (-1e-10..=1.0 + 1e-10).contains(&u) {
                        hits.push(t);
                    }
                }
            }
            hits.sort_by(f64::total_cmp);
            hits.dedup_by(|a, b| (*a - *b).abs() < 1e-10);
            for span in hits.windows(2) {
                if garment
                    .embed_point(&panel.id, center + direction * (span[0] + span[1]) * 0.5)
                    .is_err()
                {
                    continue;
                }
                let path = MaterialPath {
                    panel: panel.id.clone(),
                    points: vec![center + direction * span[0], center + direction * span[1]],
                };
                let points = garment.embed_path(&path)?;
                writeln!(out, "g {}_{name}", panel.id).unwrap();
                for p in &points {
                    let p = p.evaluate(&state.x)?;
                    writeln!(out, "v {:.12} {:.12} {:.12}", p.x, p.y, p.z).unwrap();
                }
                out.push('l');
                for i in index..index + points.len() {
                    write!(out, " {i}").unwrap();
                }
                out.push('\n');
                index += points.len();
            }
        }
    }
    Ok(out)
}
