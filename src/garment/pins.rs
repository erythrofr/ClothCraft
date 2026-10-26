//! Material-space hold records and read-only resolution against a compiled mesh.
//! Resolution is preparation only: callers must validate and install a complete
//! authoring transaction before changing any live constraint or simulation state.
use super::CompiledGarment;
use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub const MAX_PIN_TARGETS: usize = 65_536;

/// Persistent identity is a panel and exact material coordinate, never an index.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MaterialPinTarget {
    pub panel: String,
    pub uv: DVec2,
    pub world: DVec3,
}

fn key(uv: DVec2) -> [u64; 2] {
    uv.to_array()
        .map(|v| if v == 0.0 { 0 } else { v.to_bits() })
}

/// Return transient mesh indices only after the entire input is validated.
/// No nearest-point fallback: a remesh which removes a target must be rejected.
/// Existing constraints may coincide exactly but may never be overwritten.
pub fn resolve_targets(
    garment: &CompiledGarment,
    targets: &[MaterialPinTarget],
) -> Result<Vec<(usize, DVec3)>, String> {
    if targets.len() > MAX_PIN_TARGETS {
        return Err("Too many authored pin targets".into());
    }
    if garment.mesh.pins.len() != garment.mesh.uv.len() {
        return Err("Pin resolution requires matching mesh arrays".into());
    }
    let mut requested = BTreeSet::new();
    for target in targets {
        if !target.uv.is_finite() || !target.world.is_finite() {
            return Err("Pin coordinates must be finite metres".into());
        }
        if !requested.insert((target.panel.as_str(), key(target.uv))) {
            return Err(format!("Duplicate pin target on panel {}", target.panel));
        }
    }
    let mut panels = BTreeMap::new();
    for panel in &garment.panels {
        if panels.insert(panel.id.as_str(), panel).is_some() {
            return Err("Ambiguous compiled panel identity".into());
        }
    }
    // Build each requested panel's lookup once, rather than scanning its mesh
    // for every target (freezing a panel can request tens of thousands).
    let mut lookups = BTreeMap::new();
    for target in targets {
        if lookups.contains_key(target.panel.as_str()) {
            continue;
        }
        let panel = panels
            .get(target.panel.as_str())
            .ok_or_else(|| format!("Unknown pin panel: {}", target.panel))?;
        if panel.vertices.start > panel.vertices.end || panel.vertices.end > garment.mesh.uv.len() {
            return Err("Invalid compiled panel range".into());
        }
        let mut lookup = BTreeMap::new();
        for i in panel.vertices.clone() {
            let uv = garment.mesh.uv[i];
            if !uv.is_finite() || lookup.insert(key(uv), i).is_some() {
                return Err(format!("Ambiguous material vertices on panel {}", panel.id));
            }
        }
        lookups.insert(target.panel.as_str(), lookup);
    }
    targets
        .iter()
        .map(|target| {
            let i = *lookups[target.panel.as_str()]
                .get(&key(target.uv))
                .ok_or_else(|| {
                    format!("Pin material point no longer exists on {}", target.panel)
                })?;
            if garment.mesh.pins[i].is_some_and(|existing| existing != target.world) {
                return Err(format!(
                    "Pin conflicts with an existing hold on {}",
                    target.panel
                ));
            }
            Ok((i, target.world))
        })
        .collect()
}
