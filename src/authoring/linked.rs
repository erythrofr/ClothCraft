//! Bidirectional paired geometry editing. No recursive propagation, no 3D pose
//! coupling, and no cached mesh indices in the relation.
use super::*;

pub(super) fn check_command(t: &GarmentTemplate, c: &Command) -> Result<(), String> {
    let linked = |id: &str| t.mirror_links.iter().any(|l| l.a == id || l.b == id);
    let blocked = match c {
        Command::LinkedMirror { panel, .. }
        | Command::SplitBoundary { panel, .. }
        | Command::RemovePoint { panel, .. }
        | Command::Mirror {
            panel,
            copy_side: None,
            ..
        } => linked(panel),
        Command::Boolean { a, b, .. } => linked(a) || linked(b),
        _ => false,
    };
    if blocked {
        Err("Unlink the mirrored pair before changing contour topology or flipping it independently".into())
    } else {
        Ok(())
    }
}

fn shape(p: &Panel) -> serde_json::Value {
    let mut polygon = p.polygon.clone();
    if let Some(polygon) = &mut polygon {
        polygon.measurements.clear();
    }
    serde_json::json!([p.pattern, polygon, p.grain_degrees, p.pin_points])
}

pub(super) fn synchronize(old: &GarmentTemplate, t: &mut GarmentTemplate) -> Result<(), String> {
    // Removing a piece or replacing the garment also removes its relationship.
    t.mirror_links
        .retain(|l| t.panels.iter().any(|p| p.id == l.a) && t.panels.iter().any(|p| p.id == l.b));
    for link in t.mirror_links.clone() {
        if !old
            .mirror_links
            .iter()
            .any(|l| l.a == link.a && l.b == link.b)
        {
            continue;
        }
        let a = t
            .panels
            .iter()
            .position(|p| p.id == link.a)
            .ok_or("Missing linked panel")?;
        let b = t
            .panels
            .iter()
            .position(|p| p.id == link.b)
            .ok_or("Missing linked panel")?;
        let changed = |i: usize| {
            old.panels
                .iter()
                .find(|p| p.id == t.panels[i].id)
                .is_some_and(|p| shape(p) != shape(&t.panels[i]))
        };
        let (from, to) = match (changed(a), changed(b)) {
            (false, false) => continue,
            (true, false) => (a, b),
            (false, true) => (b, a),
            (true, true) => return Err("Edit one member of a mirrored pair at a time".into()),
        };
        let source = t.panels[from].clone();
        let mut polygon = source.polygon.clone().ok_or("Linked polygon missing")?;
        crate::garment::shapes::mirror(
            &mut polygon,
            link.axis,
            DVec2::new(source.pattern.width, source.pattern.height),
        );
        // Each panel owns its measurement labels/stations. A metadata edit on
        // one member does not overwrite the other's measurements; geometric
        // synchronization retains the target's existing directed references.
        polygon.measurements = t.panels[to]
            .polygon
            .as_ref()
            .map(|p| p.measurements.clone())
            .unwrap_or_default();
        let target = &mut t.panels[to];
        target.pattern = source.pattern;
        target.polygon = Some(polygon);
        target.grain_degrees = match link.axis {
            MirrorAxis::X => 180. - source.grain_degrees,
            MirrorAxis::Y => -source.grain_degrees,
        }
        .rem_euclid(180.);
        target.pin_points = source
            .pin_points
            .into_iter()
            .map(|p| match link.axis {
                MirrorAxis::X => DVec2::new(target.pattern.width - p.x, p.y),
                MirrorAxis::Y => DVec2::new(p.x, target.pattern.height - p.y),
            })
            .collect();
        // IDs, boundary directions, fabric, board layout and arrangement remain
        // those of the existing target. Its contour was mirrored on creation;
        // reflecting every later edit keeps that orientation, so seam ranges
        // must NOT be flipped again on each edit. Compile validates all seams.
    }
    Ok(())
}
