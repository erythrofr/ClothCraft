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
            // Manufacturing markings: the joined cutting contour (dashed) and the
            // notches, drawn on the sewing line the same way a pattern drafter
            // shows the seam allowance beside the stitch line.
            if let Some(contour) = polygon.cutting_contour().ok().flatten() {
                out.push_str("<path d=\"");
                for (k, p) in contour.outer.iter().enumerate() {
                    let p = pos(*p);
                    write!(out, "{} {} {} ", if k == 0 { "M" } else { "L" }, p.x, p.y).unwrap();
                }
                out.push_str("Z ");
                for hole in &contour.holes {
                    for (k, p) in hole.iter().enumerate() {
                        let p = pos(*p);
                        write!(out, "{} {} {} ", if k == 0 { "M" } else { "L" }, p.x, p.y).unwrap();
                    }
                    out.push_str("Z ");
                }
                out.push_str("\" fill=\"none\" stroke=\"#ff8a65\" stroke-width=\"2\" stroke-dasharray=\"7 4\"><title>Cutting line (seam allowance)</title></path>");
            }
            for (edge, notches) in &polygon.notches {
                for (i, notch) in notches.iter().enumerate() {
                    if let Ok(marker) = polygon.notch_marker(edge, notch) {
                        out.push_str("<polyline points=\"");
                        for p in marker {
                            let p = pos(p);
                            write!(out, "{},{} ", p.x, p.y).unwrap();
                        }
                        write!(out,"\" fill=\"none\" stroke=\"#ff5252\" stroke-width=\"2\"><title>{}: notch {}</title></polyline>",xml(edge),i+1).unwrap();
                    }
                }
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

fn svg_path(contour: &[DVec2], to_page: &impl Fn(DVec2) -> DVec2) -> String {
    let mut d = String::new();
    for (k, p) in contour.iter().enumerate() {
        let p = to_page(*p);
        write!(
            d,
            "{} {:.3} {:.3} ",
            if k == 0 { "M" } else { "L" },
            p.x,
            p.y
        )
        .unwrap();
    }
    d.push('Z');
    d
}

/// True-scale sewing sheet in millimetres: one panel per page, laid out in a
/// single column. Each page carries the stitch line, the joined seam-allowance
/// cutting line, the notches and a 100 mm ruler, all at 1 mm = 1 mm. This is not
/// nesting and not tiling: pages are never packed together and a panel wider than
/// the page is not split.
pub fn pattern_print_svg(template: &GarmentTemplate) -> String {
    const MARGIN: f64 = 15.;
    const LABEL: f64 = 16.;
    let mut pages = String::new();
    let mut cursor_y = MARGIN + 12.;
    let mut page_width = 220.0_f64;
    for panel in &template.panels {
        let (w, h) = (panel.pattern.width, panel.pattern.height);
        let mut contours = vec![];
        match &panel.polygon {
            Some(polygon) => {
                contours.push(polygon.outer_points().unwrap_or_default());
                contours.extend(polygon.holes.iter().map(|hole| hole.points.clone()));
            }
            None => contours.push(vec![
                DVec2::ZERO,
                DVec2::new(w, 0.),
                DVec2::new(w, h),
                DVec2::new(0., h),
            ]),
        }
        let cut = panel
            .polygon
            .as_ref()
            .and_then(|p| p.cutting_contour().ok().flatten());
        let mut bounds: Vec<DVec2> = contours.iter().flatten().copied().collect();
        if let Some(contour) = &cut {
            bounds.extend(contour.outer.iter().copied());
            bounds.extend(contour.holes.iter().flatten().copied());
        }
        if bounds.is_empty() {
            continue;
        }
        let lo = bounds
            .iter()
            .fold(DVec2::splat(f64::INFINITY), |a, b| a.min(*b));
        let hi = bounds
            .iter()
            .fold(DVec2::splat(f64::NEG_INFINITY), |a, b| a.max(*b));
        let span = (hi - lo) * 1000.;
        let origin = DVec2::new(MARGIN, cursor_y + LABEL) - lo * 1000.;
        let to_page = |p: DVec2| DVec2::new(p.x * 1000., p.y * 1000.) + origin;
        write!(
            pages,
            "<text x=\"{MARGIN}\" y=\"{:.3}\" font-size=\"4\">{} · {} · {:.0} × {:.0} mm</text>",
            cursor_y + 5.,
            xml(&panel.id),
            xml(&panel.name),
            w * 1000.,
            h * 1000.
        )
        .unwrap();
        for (k, contour) in contours.iter().enumerate() {
            write!(
                pages,
                "<path d=\"{}\" fill=\"{}\" stroke=\"#111\" stroke-width=\"0.3\"/>",
                svg_path(contour, &to_page),
                if k == 0 { "#f4f1ea" } else { "#ffffff" }
            )
            .unwrap();
        }
        if let Some(contour) = &cut {
            write!(pages, "<path d=\"{}\" fill=\"none\" stroke=\"#d32f2f\" stroke-width=\"0.4\" stroke-dasharray=\"4 1.8\"><title>Cutting line</title></path>", svg_path(&contour.outer, &to_page)).unwrap();
            for hole in &contour.holes {
                write!(pages, "<path d=\"{}\" fill=\"none\" stroke=\"#d32f2f\" stroke-width=\"0.4\" stroke-dasharray=\"4 1.8\"/>", svg_path(hole, &to_page)).unwrap();
            }
        }
        if let Some(polygon) = &panel.polygon {
            for line in &polygon.lines {
                pages.push_str("<polyline points=\"");
                for q in line.samples().unwrap_or_default() {
                    let q = to_page(q);
                    write!(pages, "{:.3},{:.3} ", q.x, q.y).unwrap();
                }
                pages.push_str("\" fill=\"none\" stroke=\"#888\" stroke-width=\"0.3\" stroke-dasharray=\"2 1.5\"/>");
            }
            for (edge, notches) in &polygon.notches {
                for (j, notch) in notches.iter().enumerate() {
                    if let Ok(marker) = polygon.notch_marker(edge, notch) {
                        pages.push_str("<polyline points=\"");
                        for q in marker {
                            let q = to_page(q);
                            write!(pages, "{:.3},{:.3} ", q.x, q.y).unwrap();
                        }
                        write!(pages, "\" fill=\"none\" stroke=\"#d32f2f\" stroke-width=\"0.5\"><title>{}: notch {}</title></polyline>", xml(edge), j + 1).unwrap();
                    }
                }
            }
        }
        let centre = to_page((lo + hi) * 0.5);
        let angle = panel.grain_degrees.to_radians();
        let direction = DVec2::new(angle.cos(), angle.sin());
        let start = centre - direction * 15.;
        let end = centre + direction * 15.;
        write!(
            pages,
            "<path d=\"M {:.3} {:.3} L {:.3} {:.3}\" stroke=\"#e0a500\" stroke-width=\"0.5\"/>",
            start.x, start.y, end.x, end.y
        )
        .unwrap();
        // A 100 mm ruler proves the page scale.
        let ruler_y = cursor_y + LABEL + span.y + 8.;
        write!(
            pages,
            "<path d=\"M {MARGIN} {:.3} L {:.3} {:.3}\" stroke=\"#111\" stroke-width=\"0.4\"/>",
            ruler_y,
            MARGIN + 100.,
            ruler_y
        )
        .unwrap();
        for tick in 0..=10 {
            let x = MARGIN + f64::from(tick) * 10.;
            let len = if tick % 5 == 0 { 3. } else { 1.5 };
            write!(
                pages,
                "<path d=\"M {:.3} {:.3} L {:.3} {:.3}\" stroke=\"#111\" stroke-width=\"0.3\"/>",
                x,
                ruler_y,
                x,
                ruler_y - len
            )
            .unwrap();
        }
        write!(
            pages,
            "<text x=\"{:.3}\" y=\"{:.3}\" font-size=\"4\">100 mm ruler</text>",
            MARGIN + 104.,
            ruler_y + 1.5
        )
        .unwrap();
        cursor_y = ruler_y + 12.;
        page_width = page_width.max(span.x + 2. * MARGIN + 20.);
    }
    let height = cursor_y + MARGIN;
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{page_width}mm\" height=\"{height}mm\" viewBox=\"0 0 {page_width} {height}\"><rect width=\"100%\" height=\"100%\" fill=\"#ffffff\"/><style>text{{font-family:Arial,sans-serif;fill:#111}}</style><text x=\"{MARGIN}\" y=\"{MARGIN}\" font-size=\"5\">{} — true-scale sewing sheet, one piece per page, no nesting</text>{pages}</svg>\n",
        xml(&template.name)
    )
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
    fs::create_dir_all(path)?;
    fs::write(path.join("cloth.obj"), obj(garment, state))?;
    fs::write(path.join("patterns.svg"), pattern_svg(template))?;
    fs::write(path.join("patterns-print.svg"), pattern_print_svg(template))?;
    fs::write(
        path.join("grain-guides.obj"),
        grain_guides_obj(template, garment, state)?,
    )?;
    fs::write(
        path.join("fibers.json"),
        serde_json::to_string_pretty(&garment.fiber_frames(&state.x))?,
    )?;
    template.save(&path.join("template.json"))?;
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
