//! Versioned pattern clipboard. Only editable data, never draped vertices.
use super::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

const FORMAT: &str = "clothcraft-pattern-clipboard";
const MAX_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatternClipboard {
    format: String,
    version: u32,
    template: GarmentTemplate,
}

impl PatternClipboard {
    pub fn capture(source: &GarmentTemplate, ids: &[String]) -> Result<Self, String> {
        let ids: BTreeSet<_> = ids.iter().collect();
        if ids.is_empty() || ids.len() > 64 {
            return Err("Select between 1 and 64 panels to copy".into());
        }
        let mut template = source.clone();
        template
            .mirror_links
            .retain(|l| ids.contains(&l.a) && ids.contains(&l.b));
        template.panels = source
            .panels
            .iter()
            .enumerate()
            .filter(|(_, p)| ids.contains(&p.id))
            .map(|(i, p)| {
                let mut p = p.clone();
                p.layout_2d = Some(layout(source, i));
                p
            })
            .collect();
        if template.panels.len() != ids.len() {
            return Err("A selected panel no longer exists".into());
        }
        template
            .seams
            .retain(|s| s.references().all(|r| ids.contains(&r.panel)));
        // Holds belong to selected panels only. Retain selected holds so the
        // existing paste guard can reject unsupported target remapping.
        template
            .pin_targets
            .retain(|hold| ids.contains(&hold.panel));
        template
            .frozen_panels
            .retain(|hold| ids.contains(&hold.panel));
        template
            .fabrics
            .retain(|f| template.panels.iter().any(|p| p.fabric == f.id));
        template
            .fabric_appearance
            .retain(|id, _| template.fabrics.iter().any(|f| &f.id == id));
        let mut lo = DVec2::splat(f64::INFINITY);
        let mut hi = DVec2::splat(f64::NEG_INFINITY);
        for p in &template.panels {
            for uv in corners(p) {
                let q = p.layout_2d.unwrap() + rotate_2d(uv, p.layout_rotation_degrees);
                lo = lo.min(q);
                hi = hi.max(q);
            }
        }
        let center = (lo + hi) * 0.5;
        for p in &mut template.panels {
            p.layout_2d = p.layout_2d.map(|q| q - center);
        }
        Ok(Self {
            format: FORMAT.into(),
            version: 1,
            template,
        })
    }

    pub fn panel_count(&self) -> usize {
        self.template.panels.len()
    }
    pub fn seam_count(&self) -> usize {
        self.template.seams.len()
    }

    pub fn to_text(&self) -> Result<String, String> {
        let text = serde_json::to_string(self).map_err(|e| e.to_string())?;
        if text.len() > MAX_BYTES {
            return Err("Pattern clipboard exceeds 2 MiB".into());
        }
        Ok(text)
    }

    pub fn from_text(text: &str) -> Result<Self, String> {
        if text.len() > MAX_BYTES {
            return Err("Pattern clipboard exceeds 2 MiB".into());
        }
        let clip: Self = serde_json::from_str(text)
            .map_err(|_| "Clipboard does not contain ClothCraft panels".to_string())?;
        clip.validate()?;
        Ok(clip)
    }

    fn validate(&self) -> Result<(), String> {
        if self.format != FORMAT || self.version != 1 || !(1..=64).contains(&self.panel_count()) {
            return Err("Unsupported or empty pattern clipboard".into());
        }
        if !matches!(self.template.version, 1 | 2) {
            return Err("Unsupported pattern template version".into());
        }
        let panels: BTreeSet<_> = self.template.panels.iter().map(|p| &p.id).collect();
        let fabrics: BTreeSet<_> = self.template.fabrics.iter().map(|f| &f.id).collect();
        let seams: BTreeSet<_> = self.template.seams.iter().map(|s| &s.id).collect();
        if panels.len() != self.panel_count()
            || fabrics.len() != self.template.fabrics.len()
            || seams.len() != self.template.seams.len()
            || self.template.panels.iter().any(|p| {
                !fabrics.contains(&p.fabric) || !p.layout_2d.is_some_and(|q| q.is_finite())
            })
            || self
                .template
                .seams
                .iter()
                .any(|s| s.references().any(|r| !panels.contains(&r.panel)))
            || self
                .template
                .pin_targets
                .iter()
                .any(|p| !panels.contains(&p.panel))
            || self.template.frozen_panels.iter().any(|freeze| {
                !panels.contains(&freeze.panel)
                    || freeze.targets.iter().any(|p| p.panel != freeze.panel)
            })
        {
            return Err("Clipboard contains missing or ambiguous references".into());
        }
        Ok(())
    }

    pub(super) fn paste(
        &self,
        target: &mut GarmentTemplate,
        center: DVec2,
    ) -> Result<Vec<String>, String> {
        self.validate()?;
        if !center.is_finite() {
            return Err("Invalid paste position".into());
        }
        // Place the copied assembly beside the existing flat arrangements. The
        // same world translation preserves relative placements and seam pairs.
        let max_x = target
            .panels
            .iter()
            .flat_map(|p| corners(p).map(|uv| p.placement.transform(DVec3::new(uv.x, -uv.y, 0.)).x))
            .fold(0., f64::max);
        let min_x = self
            .template
            .panels
            .iter()
            .flat_map(|p| corners(p).map(|uv| p.placement.transform(DVec3::new(uv.x, -uv.y, 0.)).x))
            .fold(f64::INFINITY, f64::min);
        let shift = DVec3::new(max_x + 0.15 - min_x, 0., 0.);
        let mut fabrics = BTreeMap::new();
        for f in &self.template.fabrics {
            let id = if let Some(existing) = target.fabrics.iter().find(|v| {
                v.properties == f.properties
                    && v.name == f.name
                    && target.fabric_appearance.get(&v.id)
                        == self.template.fabric_appearance.get(&f.id)
            }) {
                existing.id.clone()
            } else {
                let optics = self.template.fabric_appearance.get(&f.id).cloned();
                let mut f = f.clone();
                f.id = unused_id("fabric", target.fabrics.iter().map(|f| f.id.clone()));
                let id = f.id.clone();
                target.fabrics.push(f);
                if let Some(optics) = optics {
                    target.fabric_appearance.insert(id.clone(), optics);
                }
                id
            };
            fabrics.insert(f.id.clone(), id);
        }
        let mut panels = BTreeMap::new();
        let mut created = Vec::new();
        for p in &self.template.panels {
            let mut copy = p.clone();
            copy.id = unused_id("panel", target.panels.iter().map(|p| p.id.clone()));
            copy.name = format!("{} copy", p.name);
            copy.fabric = fabrics[&p.fabric].clone();
            copy.layout_2d = Some(p.layout_2d.unwrap() + center);
            copy.placement.translation += shift;
            panels.insert(p.id.clone(), copy.id.clone());
            created.push(copy.id.clone());
            target.panels.push(copy);
        }
        for s in &self.template.seams {
            let mut copy = s.clone();
            copy.id = unused_id("seam", target.seams.iter().map(|s| s.id.clone()));
            for r in copy.references_mut() {
                r.panel = panels[&r.panel].clone();
            }
            target.seams.push(copy);
        }
        for link in &self.template.mirror_links {
            target
                .mirror_links
                .push(crate::garment::template::MirrorLink {
                    a: panels[&link.a].clone(),
                    b: panels[&link.b].clone(),
                    axis: link.axis,
                });
        }
        if target.panels.iter().any(|p| p.polygon.is_some()) {
            target.version = 2;
        }
        Ok(created)
    }
}

fn corners(p: &Panel) -> [DVec2; 4] {
    let (w, h) = (p.pattern.width, p.pattern.height);
    [
        DVec2::ZERO,
        DVec2::new(w, 0.),
        DVec2::new(w, h),
        DVec2::new(0., h),
    ]
}
