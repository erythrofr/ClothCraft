//! Research mesh exports, independent of editor state.
use super::mesh::{Domain, Output};
use glam::DVec2;
use std::{fmt::Write as _, fs, path::Path};

/// Export an already completed comparison. This does no remeshing. Like the
/// existing artifact exporter, filesystem replacement is not multi-file atomic.
pub fn write_comparison(
    dir: &Path,
    input: &super::Experiment,
    comparison: &super::Comparison,
) -> Result<(), Box<dyn std::error::Error>> {
    fs::create_dir_all(dir)?;
    fs::write(dir.join("input.json"), serde_json::to_vec_pretty(input)?)?;
    for run in &comparison.runs {
        write_mesh(dir, &run.name, &run.output, &input.domain)?;
    }
    fs::write(
        dir.join("summary.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "research_only":true,"base_spacing_m":comparison.base_spacing_m,"runs":comparison.runs,
            "vertex_reduction_percent":comparison.vertex_reduction_percent(),
            "units":"metres, Pa, N m; mesh_generation_ms is CPU wall time, not simulation or rendering",
            "warning":"Mesh comparison only; no drape or wrinkle accuracy established."
        }))?,
    )?;
    let map = input.map()?;
    let lo = input
        .domain
        .outer
        .points
        .iter()
        .copied()
        .fold(DVec2::splat(f64::INFINITY), DVec2::min);
    let hi = input
        .domain
        .outer
        .points
        .iter()
        .copied()
        .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max);
    let mut csv = String::from("u_m,v_m,axis_0_spacing_m,axis_1_spacing_m\n");
    for y in 0..=100 {
        for x in 0..=100 {
            let p = lo + (hi - lo) * DVec2::new(x as f64 / 100., y as f64 / 100.);
            if input.domain.contains(p) {
                let h = map.spacing(p);
                writeln!(csv, "{},{},{},{}", p.x, p.y, h[0], h[1])?;
            }
        }
    }
    fs::write(dir.join("sizing.csv"), csv)?;
    Ok(())
}
pub fn write_mesh(
    dir: &Path,
    name: &str,
    mesh: &Output,
    domain: &Domain,
) -> Result<(), Box<dyn std::error::Error>> {
    fs::write(
        dir.join(format!("{name}.json")),
        serde_json::to_vec_pretty(mesh)?,
    )?;
    let mut obj = String::from("# Rebuildable rest-space research mesh; metres, no draped state\n");
    for p in &mesh.uv {
        writeln!(obj, "v {:.17} {:.17} 0", p.x, p.y)?;
    }
    for p in &mesh.uv {
        writeln!(obj, "vt {:.17} {:.17}", p.x, p.y)?;
    }
    for f in &mesh.faces {
        writeln!(
            obj,
            "f {0}/{0} {1}/{1} {2}/{2}",
            f[0] + 1,
            f[1] + 1,
            f[2] + 1
        )?;
    }
    fs::write(dir.join(format!("{name}.obj")), obj)?;
    let lo = domain
        .outer
        .points
        .iter()
        .copied()
        .fold(DVec2::splat(f64::INFINITY), DVec2::min)
        * 1000.;
    let hi = domain
        .outer
        .points
        .iter()
        .copied()
        .fold(DVec2::splat(f64::NEG_INFINITY), DVec2::max)
        * 1000.;
    let width = hi.x - lo.x;
    let height = hi.y - lo.y;
    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}mm\" height=\"{}mm\" viewBox=\"{} {} {} {}\"><rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"#faf9f5\"/>\n",
        width + 10.,
        height + 10.,
        lo.x - 5.,
        lo.y - 5.,
        width + 10.,
        height + 10.,
        lo.x - 5.,
        lo.y - 5.,
        width + 10.,
        height + 10.
    );
    let hmin = mesh
        .spacing_m
        .iter()
        .flatten()
        .copied()
        .fold(f64::INFINITY, f64::min);
    let hmax = mesh.spacing_m.iter().flatten().copied().fold(0., f64::max);
    for f in &mesh.faces {
        let h = f
            .iter()
            .map(|i| mesh.spacing_m[*i][0].min(mesh.spacing_m[*i][1]))
            .sum::<f64>()
            / 3.;
        let t = ((h - hmin) / (hmax - hmin).max(1e-12)).clamp(0., 1.);
        let color = format!(
            "rgb({},{},{})",
            (40. + 150. * t) as u8,
            (125. + 90. * t) as u8,
            (185. + 45. * t) as u8
        );
        let points = f
            .map(|i| format!("{},{}", mesh.uv[i].x * 1000., mesh.uv[i].y * 1000.))
            .join(" ");
        writeln!(
            svg,
            "<polygon points=\"{points}\" fill=\"{color}\" stroke=\"#223344\" stroke-width=\"0.12\"/>"
        )?;
    }
    svg.push_str("<g fill=\"none\" stroke=\"#e87528\" stroke-width=\"0.6\">\n");
    for chain in mesh.boundaries.values() {
        let points = chain
            .iter()
            .map(|i| format!("{},{}", mesh.uv[*i].x * 1000., mesh.uv[*i].y * 1000.))
            .collect::<Vec<_>>()
            .join(" ");
        writeln!(svg, "<polyline points=\"{points}\"/>")?;
    }
    svg.push_str("</g></svg>\n");
    fs::write(dir.join(format!("{name}.svg")), svg)?;
    Ok(())
}
