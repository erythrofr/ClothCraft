//! Splitting a sewn boundary. The seams that reference the split edge follow the
//! new point. A seam that spans the point becomes two seams, and the boundary on
//! its other side is split where the seam's pairing puts the matching point. A
//! mirror partner is split at the mirrored point, so a mirrored pair stays
//! symmetric.
//!
//! The edited polygon is split by the caller. Explicit partners are split here
//! through `split_polygon`; mirror partners are split by the mirror sync.
//!
//! Supported: seams with a single segment per side and no notches. Anything else
//! that a split crosses is refused, and the caller returns that error without
//! changing the template.
use super::*;
use crate::garment::seam::{BoundaryRef, SeamSpec};
use std::collections::BTreeSet;

const TOL: f64 = 1e-9;
/// Two split points on the same boundary closer than this (as a fraction of its
/// length) are the same point.
const SAME_POINT: f64 = 1e-6;

/// A boundary that gets a new point at fraction `f` of its original length. The
/// piece before the point keeps `edge`; the piece after it is `child`.
#[derive(Clone, Debug)]
struct Cut {
    panel: String,
    edge: String,
    child: String,
    f: f64,
    /// The polygon is already split: this is the edited boundary.
    done: bool,
    /// The mirror sync splits this polygon, so this module must not.
    synced: bool,
}

/// A seam with one side that spans a cut.
struct Span {
    seam: usize,
    /// The spanning side is B.
    origin_b: bool,
    /// Index into the cut list of the spanned boundary.
    origin: usize,
    /// Index into the cut list of the boundary on the other side.
    partner: usize,
}

fn child_name(t: &GarmentTemplate, panel: &str, edge: &str) -> Result<String, String> {
    let p = t
        .panels
        .iter()
        .find(|p| p.id == panel)
        .ok_or("Panel not found")?;
    let polygon = p
        .polygon
        .as_ref()
        .ok_or("This panel has no editable contour")?;
    Ok(split_edge_name(&polygon.edges, edge))
}

fn mirror_partner(t: &GarmentTemplate, panel: &str) -> Option<String> {
    t.mirror_links.iter().find_map(|link| {
        if link.a == panel {
            Some(link.b.clone())
        } else if link.b == panel {
            Some(link.a.clone())
        } else {
            None
        }
    })
}

/// Add a cut that is split by this module (the edited boundary, or an explicit
/// partner). Its mirror partner, if any, becomes a sync target. A cut already
/// present at the same point is kept as it is.
fn add_cut(t: &GarmentTemplate, cuts: &mut Vec<Cut>, cut: Cut) -> Result<usize, String> {
    if let Some(i) = cuts
        .iter()
        .position(|c| c.panel == cut.panel && c.edge == cut.edge)
    {
        if (cuts[i].f - cut.f).abs() > SAME_POINT {
            return Err(format!(
                "Sewn seams need different split points on {}; split them separately",
                cut.edge
            ));
        }
        return Ok(i);
    }
    let mirror = mirror_partner(t, &cut.panel);
    let index = cuts.len();
    let (edge, mirrored_f) = (cut.edge.clone(), 1. - cut.f);
    cuts.push(cut);
    if let Some(partner) = mirror {
        add_mirror(t, cuts, partner, edge, mirrored_f)?;
    }
    Ok(index)
}

/// A mirror partner of a split boundary. The mirror sync splits its polygon, so
/// it is never split here. This never adds a mirror of its own: the partner is
/// already the split boundary, and going back would mark that boundary as a sync
/// target and leave it unsplit.
fn add_mirror(
    t: &GarmentTemplate,
    cuts: &mut Vec<Cut>,
    panel: String,
    edge: String,
    f: f64,
) -> Result<(), String> {
    if let Some(i) = cuts
        .iter()
        .position(|c| c.panel == panel && c.edge == edge)
    {
        if (cuts[i].f - f).abs() > SAME_POINT {
            return Err(format!(
                "Sewn seams need different split points on {edge}; split them separately"
            ));
        }
        if !cuts[i].done {
            cuts[i].synced = true;
        }
        return Ok(());
    }
    let child = child_name(t, &panel, &edge)?;
    cuts.push(Cut {
        panel,
        edge,
        child,
        f,
        done: false,
        synced: true,
    });
    Ok(())
}

/// Whether a seam's reversed flag, combined with the seam's B direction, makes the
/// reference run against its edge direction.
fn reverse_of(seam: &SeamSpec, b: bool, r: &BoundaryRef) -> bool {
    (b && seam.reverse_b) ^ r.reversed
}

/// Edge-normalized position of seam parameter `u` along a reference.
fn at(r: &BoundaryRef, reverse: bool, u: f64) -> f64 {
    let t = if reverse { 1. - u } else { u };
    r.range[0] + t * (r.range[1] - r.range[0])
}

/// Seam parameter of edge-normalized position `s` along a reference.
fn param_of(r: &BoundaryRef, reverse: bool, s: f64) -> f64 {
    let t = (s - r.range[0]) / (r.range[1] - r.range[0]);
    if reverse { 1. - t } else { t }
}

fn crosses(r: &BoundaryRef, s: f64) -> bool {
    r.range[0] + TOL < s && s < r.range[1] - TOL
}

/// Map a span of the original edge [lo, hi] onto the piece that contains it.
fn piece(cut: &Cut, lo: f64, hi: f64) -> Result<(String, [f64; 2]), String> {
    let (lo, hi) = (lo.min(hi), lo.max(hi));
    // The mirror sync reverses the contour, so its split names are the other way
    // round: the name stays with the piece that ends at the old boundary start.
    let (before, after) = if cut.synced {
        (cut.child.clone(), cut.edge.clone())
    } else {
        (cut.edge.clone(), cut.child.clone())
    };
    let (name, range) = if hi <= cut.f + TOL {
        (before, [lo / cut.f, hi / cut.f])
    } else if lo >= cut.f - TOL {
        let width = 1. - cut.f;
        (after, [(lo - cut.f) / width, (hi - cut.f) / width])
    } else {
        return Err(format!("A seam crosses the new point on {}", cut.edge));
    };
    if range[1] - range[0] < TOL {
        return Err(format!("A seam piece on {} would be empty", cut.edge));
    }
    Ok((
        name,
        [range[0].clamp(0., 1.), range[1].clamp(0., 1.)],
    ))
}

fn single(seam: &SeamSpec, b: bool) -> Result<BoundaryRef, String> {
    let mut refs = seam.side(b);
    let first = refs.next().ok_or("Seam has no boundary on this side")?;
    if refs.next().is_some() {
        return Err(format!(
            "Seam {} has several segments on one side; split it after simplifying the seam",
            seam.id
        ));
    }
    Ok(first.clone())
}

fn with_piece(r: &BoundaryRef, (edge, range): (String, [f64; 2])) -> BoundaryRef {
    let mut out = r.clone();
    out.edge = Some(edge);
    out.range = range;
    out
}

fn set_side(seam: &mut SeamSpec, b: bool, r: BoundaryRef) {
    if b {
        seam.b = r;
    } else {
        seam.a = r;
    }
}

/// Update seams after the edited boundary (`panel`, `edge`) has been split into
/// `edge` and `child`. The polygon of the edited panel must already be split.
pub(super) fn after_origin_split(
    t: &mut GarmentTemplate,
    panel: &str,
    edge: &str,
    child: &str,
) -> Result<(), String> {
    let polygon = t
        .panels
        .iter()
        .find(|p| p.id == panel)
        .and_then(|p| p.polygon.as_ref())
        .ok_or("This panel has no editable contour")?;
    let left = edge_length(polygon, edge)?;
    let right = edge_length(polygon, child)?;
    let mut cuts = Vec::new();
    add_cut(
        t,
        &mut cuts,
        Cut {
            panel: panel.into(),
            edge: edge.into(),
            child: child.into(),
            f: left / (left + right),
            done: true,
            synced: false,
        },
    )?;

    // Find every seam that spans a cut. Each one pulls its other side into a cut.
    let mut spans: Vec<Span> = Vec::new();
    let mut next = 0;
    while next < cuts.len() {
        let cut = cuts[next].clone();
        for (k, seam) in t.seams.iter().enumerate() {
            for origin_b in [false, true] {
                let hits: Vec<&BoundaryRef> = seam
                    .side(origin_b)
                    .filter(|r| {
                        r.panel == cut.panel
                            && r.edge.as_deref() == Some(cut.edge.as_str())
                            && crosses(r, cut.f)
                    })
                    .collect();
                if hits.is_empty() || spans.iter().any(|s| s.seam == k) {
                    continue;
                }
                let simple = seam.a_tail.is_empty()
                    && seam.b_tail.is_empty()
                    && seam.notches.is_empty()
                    && hits.len() == 1;
                if !simple {
                    return Err(format!(
                        "Splitting {} crosses seam {}, which has several segments or notches; simplify it first",
                        cut.edge, seam.id
                    ));
                }
                let rx = hits[0];
                let ry = single(seam, !origin_b)?;
                let partner_edge = ry
                    .edge
                    .clone()
                    .ok_or("Sewn boundary needs a named edge")?;
                if ry.panel == cut.panel && partner_edge == cut.edge {
                    return Err(format!(
                        "Seam {} joins {} to itself; it can't be split here",
                        seam.id, cut.edge
                    ));
                }
                let u = param_of(rx, reverse_of(seam, origin_b, rx), cut.f);
                let g = at(&ry, reverse_of(seam, !origin_b, &ry), u);
                let child = child_name(t, &ry.panel, &partner_edge)?;
                let partner = add_cut(
                    t,
                    &mut cuts,
                    Cut {
                        panel: ry.panel.clone(),
                        edge: partner_edge,
                        child,
                        f: g,
                        done: false,
                        synced: false,
                    },
                )?;
                spans.push(Span {
                    seam: k,
                    origin_b,
                    origin: next,
                    partner,
                });
            }
        }
        next += 1;
    }

    // Split the explicit partners. Their actual split point is measured on the
    // split polygon, as for the edited boundary.
    for cut in cuts.iter_mut().filter(|c| !c.done && !c.synced) {
        let before = {
            let p = t
                .panels
                .iter()
                .find(|p| p.id == cut.panel)
                .ok_or("Panel not found")?;
            let polygon = p
                .polygon
                .as_ref()
                .ok_or("This panel has no editable contour")?;
            edge_length(polygon, &cut.edge)?
        };
        let (_, actual_child) = split_polygon(t, cut.panel.clone(), cut.edge.clone(), cut.f * before)?;
        if actual_child != cut.child {
            return Err(format!("Mirrored boundary names differ on {}", cut.edge));
        }
        let p = t
            .panels
            .iter()
            .find(|p| p.id == cut.panel)
            .ok_or("Panel not found")?;
        let polygon = p
            .polygon
            .as_ref()
            .ok_or("This panel has no editable contour")?;
        let (left, right) = (
            edge_length(polygon, &cut.edge)?,
            edge_length(polygon, &cut.child)?,
        );
        cut.f = left / (left + right);
    }

    // Spanning seams are rebuilt below, so the plain remap leaves them alone.
    let spanning: BTreeSet<usize> = spans.iter().map(|s| s.seam).collect();
    for (k, seam) in t.seams.iter_mut().enumerate() {
        if spanning.contains(&k) {
            continue;
        }
        for r in seam.references_mut() {
            let Some(name) = r.edge.clone() else {
                continue;
            };
            if let Some(cut) = cuts
                .iter()
                .find(|c| c.panel == r.panel && c.edge == name)
            {
                let (edge, range) = piece(cut, r.range[0], r.range[1])?;
                r.edge = Some(edge);
                r.range = range;
            }
        }
    }

    // Each spanning seam becomes two seams that meet at the same point on both
    // sides. The first keeps the seam's id; the second gets a new one.
    for span in &spans {
        let seam = t.seams[span.seam].clone();
        let x_b = span.origin_b;
        let rx = single(&seam, x_b)?;
        let ry = single(&seam, !x_b)?;
        let oc = &cuts[span.origin];
        let pc = &cuts[span.partner];
        let rev_x = reverse_of(&seam, x_b, &rx);
        let rev_y = reverse_of(&seam, !x_b, &ry);
        let x = [
            piece(oc, at(&rx, rev_x, 0.), oc.f)?,
            piece(oc, oc.f, at(&rx, rev_x, 1.))?,
        ];
        let y = [
            piece(pc, at(&ry, rev_y, 0.), pc.f)?,
            piece(pc, pc.f, at(&ry, rev_y, 1.))?,
        ];
        let mut first = seam.clone();
        let mut second = seam.clone();
        set_side(&mut first, x_b, with_piece(&rx, x[0].clone()));
        set_side(&mut first, !x_b, with_piece(&ry, y[0].clone()));
        set_side(&mut second, x_b, with_piece(&rx, x[1].clone()));
        set_side(&mut second, !x_b, with_piece(&ry, y[1].clone()));
        t.seams[span.seam] = first;
        second.id = unused_id("seam", t.seams.iter().map(|s| s.id.clone()));
        t.seams.push(second);
    }
    Ok(())
}
