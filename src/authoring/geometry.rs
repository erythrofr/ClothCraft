//! Geometry edits are committed by the parent's compile-before-install transaction.
use super::*;
use crate::garment::{seam::Side, shapes};

pub(super) fn add_polygon(
    t: &mut GarmentTemplate,
    polygon: PolygonPattern,
    origin: DVec2,
    fabric: String,
    replace: bool,
) -> Result<String, String> {
    if !origin.is_finite() {
        return Err("Invalid 2D position".into());
    }
    let id = unused_id("panel", t.panels.iter().map(|p| p.id.clone()));
    let placement = if let Some(p) = t.panels.first().filter(|_| !replace) {
        let delta = origin - layout(t, 0);
        Placement {
            translation: p.placement.translation + DVec3::new(delta.x, -delta.y, 0.12),
            ..Default::default()
        }
    } else {
        Placement {
            translation: DVec3::new(-0.25, 1.5, 0.45),
            ..Default::default()
        }
    };
    if replace {
        t.panels.clear();
        t.seams.clear();
        t.name = "Custom garment".into();
    }
    let mut p = Panel {
        id: id.clone(),
        name: id.clone(),
        pattern: Pattern {
            width: 1.,
            height: 1.,
            nx: 1,
            ny: 1,
        },
        polygon: Some(polygon),
        fabric,
        grain_degrees: 90.,
        placement,
        pins: vec![],
        pin_points: vec![],
        layout_2d: Some(origin),
        layout_rotation_degrees: 0.,
    };
    normalize(&mut p);
    t.panels.push(p);
    t.version = 2;
    Ok(id)
}

pub(super) fn mirror(
    t: &mut GarmentTemplate,
    id: &str,
    axis: MirrorAxis,
    copy_side: Option<i8>,
) -> Result<String, String> {
    if copy_side.is_some_and(|s| s != -1 && s != 1) {
        return Err("Invalid mirror direction".into());
    }
    let index = t
        .panels
        .iter()
        .position(|p| p.id == id)
        .ok_or("Panel not found")?;
    let mut p = t.panels[index].clone();
    p.layout_2d = Some(layout(t, index));
    let poly = p
        .polygon
        .as_mut()
        .ok_or("Mirroring requires a v2 polygonal panel")?;
    let reversed: std::collections::BTreeSet<_> = poly
        .edges
        .iter()
        .chain(poly.holes.iter().flat_map(|h| &h.edges))
        .cloned()
        .collect();
    shapes::mirror(poly, axis, DVec2::new(p.pattern.width, p.pattern.height));
    for pin in &mut p.pin_points {
        match axis {
            MirrorAxis::X => pin.x = p.pattern.width - pin.x,
            MirrorAxis::Y => pin.y = p.pattern.height - pin.y,
        }
    }
    p.grain_degrees = match axis {
        MirrorAxis::X => 180. - p.grain_degrees,
        MirrorAxis::Y => -p.grain_degrees,
    }
    .rem_euclid(180.);
    let size = DVec2::new(p.pattern.width, p.pattern.height);
    let reflect = |point: &mut DVec2| match axis {
        MirrorAxis::X => point.x = size.x - point.x,
        MirrorAxis::Y => point.y = size.y - point.y,
    };
    let reflect_trim = |trim: &mut crate::garment::trims::Trim| {
        use crate::garment::trims::TrimKind;
        match &mut trim.kind {
            TrimKind::Button { center_m, .. } => reflect(center_m),
            TrimKind::Buttonhole { start_m, end_m, .. } => {
                reflect(start_m);
                reflect(end_m);
            }
            TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
                path_m.iter_mut().for_each(reflect);
            }
        }
    };
    if let Some(side) = copy_side {
        p.id = unused_id("panel", t.panels.iter().map(|p| p.id.clone()));
        p.name = format!("{} mirror", p.name);
        let delta = match axis {
            MirrorAxis::X => DVec2::new(p.pattern.width + 0.05, 0.),
            MirrorAxis::Y => DVec2::new(0., p.pattern.height + 0.05),
        } * side as f64;
        p.layout_2d = Some(layout(t, index) + rotate_2d(delta, p.layout_rotation_degrees));
        p.placement.translation = p.placement.transform(DVec3::new(delta.x, -delta.y, 0.));
        let new_id = p.id.clone();
        t.panels.push(p);
        let trims: Vec<_> = t
            .trims
            .iter()
            .filter(|trim| trim.panel_id == id)
            .cloned()
            .collect();
        for mut trim in trims {
            trim.id = unused_id("trim", t.trims.iter().map(|existing| existing.id.clone()));
            trim.panel_id = new_id.clone();
            reflect_trim(&mut trim);
            t.trims.push(trim);
        }
        Ok(new_id)
    } else {
        for s in &mut t.seams {
            for r in s.references_mut() {
                if r.panel == id && r.edge.as_ref().is_some_and(|n| reversed.contains(n)) {
                    r.range = [1. - r.range[1], 1. - r.range[0]];
                    r.reversed = !r.reversed;
                }
            }
        }
        for trim in t.trims.iter_mut().filter(|trim| trim.panel_id == id) {
            reflect_trim(trim);
        }
        t.panels[index] = p;
        Ok(id.into())
    }
}

pub(super) fn boolean(
    t: &mut GarmentTemplate,
    a: &str,
    b: &str,
    op: BooleanOp,
    keep_tool: bool,
) -> Result<String, String> {
    if a == b {
        return Err("Choose two different panels".into());
    }
    let ai = t
        .panels
        .iter()
        .position(|p| p.id == a)
        .ok_or("Panel A not found")?;
    let bi = t
        .panels
        .iter()
        .position(|p| p.id == b)
        .ok_or("Panel B not found")?;
    for id in [a, b] {
        let p = t.panels.iter().find(|p| p.id == id).unwrap();
        if t.seams
            .iter()
            .any(|s| s.references().any(|r| r.panel == id))
            || !p.pins.is_empty()
            || !p.pin_points.is_empty()
            || p.polygon
                .as_ref()
                .is_some_and(|p| !p.lines.is_empty() || !p.target_lengths.is_empty())
        {
            return Err("Boolean operands must have no seams, pins, internal lines or target lengths; clear those relations first".into());
        }
    }
    let original = t.panels[ai].clone();
    let ap = original
        .polygon
        .as_ref()
        .ok_or("Panel A must be a v2 polygon")?;
    let mut bp = t.panels[bi]
        .polygon
        .clone()
        .ok_or("Panel B must be a v2 polygon")?;
    let into_a = |v: DVec2| {
        rotate_2d(
            layout(t, bi) + rotate_2d(v, t.panels[bi].layout_rotation_degrees) - layout(t, ai),
            -original.layout_rotation_degrees,
        )
    };
    for p in bp.points.iter_mut().chain(bp.curves.values_mut().flatten()) {
        *p = into_a(*p);
    }
    for h in &mut bp.holes {
        for p in &mut h.points {
            *p = into_a(*p);
        }
    }
    let polygons = shapes::boolean(ap, &bp, op)?;
    let origin = layout(t, ai);
    t.panels.retain(|p| p.id != a && (keep_tool || p.id != b));
    for (i, polygon) in polygons.into_iter().enumerate() {
        let mut p = original.clone();
        p.id = if i == 0 {
            a.into()
        } else {
            unused_id("panel", t.panels.iter().map(|p| p.id.clone()))
        };
        p.name = format!("{} · boolean {}", original.name, i + 1);
        p.layout_2d = Some(origin);
        p.polygon = Some(polygon);
        normalize(&mut p);
        t.panels.push(p);
    }
    Ok(a.into())
}

pub(super) fn ruffle(
    t: &mut GarmentTemplate,
    panel: &str,
    line: &str,
    width: f64,
    ratio: f64,
) -> Result<String, String> {
    if !ratio.is_finite()
        || !(1. ..=4.).contains(&ratio)
        || !width.is_finite()
        || !(0.005..=1.).contains(&width)
    {
        return Err("Ruffle: width must be 5..1000 mm and ratio 1..4".into());
    }
    let index = t
        .panels
        .iter()
        .position(|p| p.id == panel)
        .ok_or("Panel not found")?;
    let source = t.panels[index].clone();
    let poly = source
        .polygon
        .as_ref()
        .ok_or("A v2 polygonal panel is required")?;
    let path = poly
        .lines
        .iter()
        .find(|l| l.id == line)
        .ok_or("Select an internal line")?;
    if t.seams.iter().any(|s| {
        s.references()
            .any(|r| r.panel == panel && r.edge.as_deref() == Some(line))
    }) {
        return Err("This line is already sewn".into());
    }
    let points = path.samples()?;
    let length: f64 = points.windows(2).map(|p| p[0].distance(p[1])).sum();
    let polygon = shapes::primitive(
        Primitive::Rectangle,
        DVec2::new(length * ratio, width),
        180.,
        poly.meshing_settings(),
    )?;
    let origin = layout(t, index)
        + rotate_2d(
            DVec2::new(0., source.pattern.height + 0.08),
            source.layout_rotation_degrees,
        );
    let id = add_polygon(t, polygon, origin, source.fabric.clone(), false)?;
    let strip = t.panels.last_mut().unwrap();
    strip.name = format!("Ruffle for {}", source.name);
    strip.placement = source.placement.clone();
    strip.placement.translation =
        source
            .placement
            .transform(DVec3::new(points[0].x, -points[0].y, 0.05));
    t.seams.push(SeamSpec {
        a_tail: vec![],
        b_tail: vec![],
        id: unused_id("seam", t.seams.iter().map(|s| s.id.clone())),
        a: BoundaryRef {
            reversed: false,
            panel: panel.into(),
            side: Side::Top,
            edge: Some(line.into()),
            range: [0., 1.],
        },
        b: BoundaryRef {
            reversed: false,
            panel: id.clone(),
            side: Side::Top,
            edge: Some("edge_1".into()),
            range: [0., 1.],
        },
        reverse_b: false,
        allow_ease: true,
        notches: vec![],
        stiffness: 50_000.,
    });
    Ok(id)
}
