//! Read-only authored sewing diagnostics. No simulation state or solver is used.
use super::{BoundaryCurve, BoundaryRef, CompiledSeam, SeamSpec, Side};
use crate::garment::{GarmentTemplate, template::CompiledGarment};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Serialize)]
pub struct Diagnostic {
    pub code: &'static str,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Segment {
    pub panel_id: String,
    pub edge: Option<String>,
    /// Used only when edge is absent, matching the compiler's legacy rules.
    pub rectangle_side: Option<Side>,
    /// None denotes a non-finite authored range, not an untrimmed boundary.
    pub range: Option<[f64; 2]>,
    pub reversed: bool,
    pub length_m: Option<f64>,
    pub errors: Vec<Diagnostic>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Interval {
    /// Normalized cumulative arclength on the two directed sewing chains.
    pub a: [f64; 2],
    pub b: [f64; 2],
    pub lengths_m: [f64; 2],
    /// B minus A: positive means B has more material in this interval.
    pub difference_m: f64,
    pub requires_easing: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct SeamAudit {
    /// Document order disambiguates duplicate (invalid) seam IDs in a report.
    pub seam_index: usize,
    pub seam_id: String,
    pub a: Vec<Segment>,
    pub b: Vec<Segment>,
    pub reverse_b: bool,
    pub allow_ease: bool,
    pub lengths_m: Option<[f64; 2]>,
    pub difference_m: Option<f64>,
    pub intervals: Vec<Interval>,
    pub errors: Vec<Diagnostic>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Endpoint {
    pub seam_index: usize,
    pub seam_id: String,
    pub side: &'static str,
    pub segment_index: usize,
    pub edge: Option<String>,
    pub rectangle_side: Option<Side>,
    /// Parameter on the original directed boundary, before reversal.
    pub boundary_parameter: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct Junction {
    pub panel_id: String,
    pub material_position_m: [f64; 2],
    /// Number of distinct authored seam records incident at this endpoint.
    pub degree: usize,
    pub endpoints: Vec<Endpoint>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SewingAudit {
    pub format: &'static str,
    pub version: u32,
    pub geometry_basis: &'static str,
    pub valid: bool,
    pub seams: Vec<SeamAudit>,
    /// Exact shared material endpoints, not crossings or physical contacts.
    pub junctions: Vec<Junction>,
}

fn diagnostic(code: &'static str, message: impl Into<String>) -> Diagnostic {
    Diagnostic {
        code,
        message: message.into(),
    }
}

fn curve(
    template: &GarmentTemplate,
    garment: &CompiledGarment,
    r: &BoundaryRef,
) -> Result<BoundaryCurve, String> {
    if template.version == 1 && r.edge.is_some() {
        return Err("Named boundaries require template version 2".into());
    }
    let i = template
        .panels
        .iter()
        .position(|p| p.id == r.panel)
        .ok_or_else(|| format!("Missing seam panel {}", r.panel))?;
    let vertices = if let Some(edge) = &r.edge {
        garment.panels[i]
            .boundaries
            .get(edge)
            .cloned()
            .ok_or_else(|| format!("Unknown boundary {edge} on {}", r.panel))?
    } else {
        if template.panels[i].polygon.is_some() {
            return Err("Polygon seam requires a named edge".into());
        }
        template.panels[i].boundary_vertices(r.side, garment.panels[i].vertices.start)
    };
    BoundaryCurve::new(&garment.mesh, vertices, r.range, r.reversed)
}

type BoundaryKey = (String, String);
type Ownership = BTreeMap<BoundaryKey, Vec<(f64, f64, usize)>>;
type Endpoints = BTreeMap<(String, u64, u64), Vec<Endpoint>>;

fn boundary_key(r: &BoundaryRef) -> BoundaryKey {
    (
        r.panel.clone(),
        r.edge
            .as_ref()
            .map_or_else(|| format!("side:{:?}", r.side), |e| format!("edge:{e}")),
    )
}

fn side(
    template: &GarmentTemplate,
    garment: &CompiledGarment,
    spec: &SeamSpec,
    index: usize,
    b: bool,
    ownership: &mut Ownership,
    endpoints: &mut Endpoints,
) -> (Vec<Segment>, Option<BoundaryCurve>) {
    let mut segments = Vec::new();
    let mut curves = Vec::new();
    for (segment_index, r) in spec.side(b).enumerate() {
        let mut segment = Segment {
            panel_id: r.panel.clone(),
            edge: r.edge.clone(),
            rectangle_side: r.edge.is_none().then_some(r.side),
            range: r.range.iter().all(|v| v.is_finite()).then_some(r.range),
            reversed: r.reversed,
            length_m: None,
            errors: vec![],
        };
        match curve(template, garment, r) {
            Ok(c) => {
                segment.length_m = Some(c.length);
                ownership
                    .entry(boundary_key(r))
                    .or_default()
                    .push((r.range[0], r.range[1], index));
                for end in [0., 1.] {
                    let p = c
                        .point(end)
                        .into_iter()
                        .map(|(v, w)| garment.mesh.uv[v] * w)
                        .sum::<glam::DVec2>();
                    // Canonicalize signed zero; do not snap nearby but distinct endpoints.
                    let bits = |v: f64| {
                        if v == 0. {
                            0.0f64.to_bits()
                        } else {
                            v.to_bits()
                        }
                    };
                    endpoints
                        .entry((r.panel.clone(), bits(p.x), bits(p.y)))
                        .or_default()
                        .push(Endpoint {
                            seam_index: index,
                            seam_id: spec.id.clone(),
                            side: if b { "b" } else { "a" },
                            segment_index,
                            edge: r.edge.clone(),
                            rectangle_side: r.edge.is_none().then_some(r.side),
                            boundary_parameter: r.range[usize::from((end == 1.) ^ r.reversed)],
                        });
                }
                curves.push(c);
            }
            Err(e) => segment.errors.push(diagnostic("invalid_reference", e)),
        }
        segments.push(segment);
    }
    let chain = if curves.len() == segments.len() {
        match BoundaryCurve::concatenate(curves, b && spec.reverse_b) {
            Ok(chain) => Some(chain),
            Err(error) => {
                segments[0].errors.push(diagnostic("invalid_chain", error));
                None
            }
        }
    } else {
        None
    };
    (segments, chain)
}

/// Compile material geometry once, then diagnose seams independently.
/// Invalid material geometry or excessive structural counts are fatal; invalid
/// sewing produces a report with valid=false. Input and physics are unchanged.
pub fn report(template: &GarmentTemplate) -> Result<SewingAudit, String> {
    if template.seams.len() > 512 {
        return Err("Sewing audit supports at most 512 seams, matching the compiler".into());
    }
    let mut geometry = template.clone();
    geometry.seams.clear();
    let garment = geometry.compile()?;
    let mut seams = Vec::new();
    let mut ownership = Ownership::new();
    let mut endpoints = Endpoints::new();
    let mut ids: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
    for (index, spec) in template.seams.iter().enumerate() {
        let mut item = SeamAudit {
            seam_index: index,
            seam_id: spec.id.clone(),
            a: vec![],
            b: vec![],
            reverse_b: spec.reverse_b,
            allow_ease: spec.allow_ease,
            lengths_m: None,
            difference_m: None,
            intervals: vec![],
            errors: vec![],
        };
        ids.entry(&spec.id).or_default().push(index);
        if spec.id.is_empty()
            || spec.id.len() > 80
            || !spec
                .id
                .bytes()
                .all(|v| v.is_ascii_alphanumeric() || v == b'_' || v == b'-')
        {
            item.errors.push(diagnostic(
                "invalid_id",
                "Seam ID must contain 1..80 ASCII letters, digits, '_' or '-'",
            ));
        }
        if spec.a_tail.len() >= 128 || spec.b_tail.len() >= 128 {
            item.errors.push(diagnostic(
                "too_many_segments",
                "Sewing side needs 1..128 segments",
            ));
            seams.push(item);
            continue;
        }
        let (a, ac) = side(
            template,
            &garment,
            spec,
            index,
            false,
            &mut ownership,
            &mut endpoints,
        );
        let (b, bc) = side(
            template,
            &garment,
            spec,
            index,
            true,
            &mut ownership,
            &mut endpoints,
        );
        item.a = a;
        item.b = b;
        if let (Some(a), Some(b)) = (ac, bc) {
            let lengths = [a.length, b.length];
            item.lengths_m = Some(lengths);
            item.difference_m = Some(lengths[1] - lengths[0]);
            if let Err(e) = CompiledSeam::compile(spec, a.clone(), b.clone()) {
                item.errors.push(diagnostic("invalid_correspondence", e));
            }
            // Inspect the same correspondence even when explicit easing is
            // missing. This local copy never changes the authored seam policy.
            let mut measured = spec.clone();
            measured.allow_ease = true;
            if CompiledSeam::compile(&measured, a, b).is_ok() {
                let knots: Vec<_> = std::iter::once([0., 0.])
                    .chain(spec.notches.iter().copied())
                    .chain(std::iter::once([1., 1.]))
                    .collect();
                for k in knots.windows(2) {
                    let la = lengths[0] * (k[1][0] - k[0][0]);
                    let lb = lengths[1] * (k[1][1] - k[0][1]);
                    item.intervals.push(Interval {
                        a: [k[0][0], k[1][0]],
                        b: [k[0][1], k[1][1]],
                        lengths_m: [la, lb],
                        difference_m: lb - la,
                        requires_easing: (la - lb).abs() > 1e-8 * la.max(lb),
                    });
                }
            }
        }
        seams.push(item);
    }
    for indices in ids.values().filter(|v| v.len() > 1) {
        for &i in indices {
            seams[i]
                .errors
                .push(diagnostic("duplicate_id", "Seam ID occurs more than once"));
        }
    }
    // One diagnostic per seam/boundary, not a quadratic enumeration of pairs.
    for ((panel, boundary), mut ranges) in ownership {
        ranges.sort_by(|a, b| {
            a.0.total_cmp(&b.0)
                .then(a.1.total_cmp(&b.1))
                .then(a.2.cmp(&b.2))
        });
        let mut furthest: Option<(f64, usize)> = None;
        let mut conflicts = BTreeSet::new();
        for (lo, hi, i) in ranges {
            if let Some((end, owner)) = furthest {
                if lo < end - 1e-12 {
                    conflicts.insert(i);
                    conflicts.insert(owner);
                }
                if hi > end {
                    furthest = Some((hi, i));
                }
            } else {
                furthest = Some((hi, i));
            }
        }
        for i in conflicts {
            seams[i].errors.push(diagnostic(
                "overlapping_ownership",
                format!("Overlapping sewing intervals on {panel} / {boundary}"),
            ));
        }
    }
    let junctions = endpoints
        .into_iter()
        .filter_map(|((panel_id, x, y), endpoints)| {
            let degree = endpoints
                .iter()
                .map(|e| e.seam_index)
                .collect::<BTreeSet<_>>()
                .len();
            (degree >= 2).then_some(Junction {
                panel_id,
                material_position_m: [f64::from_bits(x), f64::from_bits(y)],
                degree,
                endpoints,
            })
        })
        .collect();
    let valid = seams
        .iter()
        .all(|s| s.errors.is_empty() && s.a.iter().chain(&s.b).all(|r| r.errors.is_empty()));
    Ok(SewingAudit {
        format: "clothcraft-sewing-audit",
        version: 1,
        geometry_basis: "compiled_material_rest_boundaries",
        valid,
        seams,
        junctions,
    })
}
