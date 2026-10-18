//! Explicit native GPU smoke: inject real egui pointer events into editor widgets.
use super::*;
use std::{collections::BTreeMap, time::Instant};

// The first element of each action is a smoke-target protocol key registered by
// the authoring widgets (`smoke_target`). These keys are part of the test harness
// contract and are deliberately left unchanged even where a key still spells a
// former French button label; only the visible labels themselves were translated.
const ACTIONS: [(&str, Vec2); 57] = [
    ("Plume", Vec2::ZERO),
    ("replace", Vec2::ZERO),
    ("Rectangle", Vec2::ZERO),
    ("point0", Vec2::new(120., 160.)),
    ("Plume", Vec2::ZERO),
    ("replace", Vec2::ZERO),
    ("point0", Vec2::ZERO),
    ("point1", Vec2::new(28., 20.)),
    ("point2", Vec2::ZERO),
    ("point3", Vec2::ZERO),
    ("create", Vec2::ZERO),
    ("Modifier", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("markings_allowance", Vec2::ZERO),
    ("markings_notch", Vec2::ZERO),
    ("handle_1", Vec2::new(-12., -16.)),
    ("anchor_3", Vec2::new(-16., 0.)),
    ("body_panel_1", Vec2::new(36., 20.)),
    ("rotate_2d", Vec2::new(48., 20.)),
    ("Déplacer 3D", Vec2::ZERO),
    ("gizmo_x", Vec2::new(35., 0.)),
    ("duplicate", Vec2::ZERO),
    ("Coudre", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("edge3d_panel_2", Vec2::ZERO),
    ("simulate", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("redo", Vec2::ZERO),
    ("remove_seam", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("Déplacer 3D", Vec2::ZERO),
    ("focus", Vec2::ZERO),
    // Leave room for the following XYZ rotations without intersecting its neighbour.
    ("gizmo_x", Vec2::new(80., 0.)),
    ("Tourner 3D", Vec2::ZERO),
    ("ring_x", Vec2::new(0., 25.)),
    ("ring_y", Vec2::new(25., 0.)),
    ("ring_z", Vec2::new(25., 20.)),
    ("fabric_tab", Vec2::ZERO),
    ("fabric_presets", Vec2::ZERO),
    ("fabric_preset_denim", Vec2::ZERO),
    ("fabric_apply", Vec2::ZERO),
    ("export", Vec2::ZERO),
    ("Coudre", Vec2::ZERO),
    ("edit_seam", Vec2::ZERO),
    ("sew_to_0_0", Vec2::new(-40., 0.)),
    ("sew_to_1_0", Vec2::new(-40., 0.)),
    ("sew_easing", Vec2::ZERO),
    ("sew", Vec2::ZERO),
    ("edit_seam", Vec2::ZERO),
    ("sew_chain", Vec2::ZERO),
    ("next_edge_panel_1", Vec2::ZERO),
    ("sew_side_b", Vec2::ZERO),
    ("next_edge_panel_2", Vec2::ZERO),
    ("sew", Vec2::ZERO),
    ("export", Vec2::ZERO),
    ("focus", Vec2::ZERO),
    ("simulate", Vec2::ZERO),
];
pub(super) struct Smoke {
    targets: BTreeMap<String, egui::Pos2>,
    action: usize,
    tick: usize,
    origin: Option<egui::Pos2>,
    start: Instant,
    pub finished: bool,
    undo_observed: bool,
    redo_observed: bool,
    mixed_sewing: bool,
    translation_before: Option<glam::DVec3>,
    shape_before: Option<marvelous_cloth::garment::polygon::PolygonPattern>,
    layout_before: Option<(
        marvelous_cloth::garment::template::GarmentTemplate,
        Vec<glam::DVec3>,
    )>,
    motion_start: Option<(f64, Vec<glam::DVec3>)>,
    rectangle_drawn: bool,
    handle_edited: bool,
    anchor_edited: bool,
    layout_preserved_physics: bool,
    rotation_2d_preserved_physics: bool,
    rotation_before: Option<(usize, glam::DVec3)>,
    rotation_axes: [bool; 3],
    fabric_before: Option<(Vec<glam::DVec3>, Vec<f64>)>,
    fabric_applied: bool,
    seam_before: Option<Vec<glam::DVec3>>,
    seam_removed: bool,
    markings_before: Option<(
        marvelous_cloth::garment::template::GarmentTemplate,
        Vec<glam::DVec3>,
    )>,
    allowance_applied: bool,
    notch_added: bool,
    markings_preserved_physics: bool,
}
impl Smoke {
    pub(super) fn wants(&self, key: &str) -> bool {
        ACTIONS.get(self.action).is_some_and(|a| a.0 == key)
    }
    pub fn new() -> Self {
        Self {
            targets: BTreeMap::new(),
            action: 0,
            tick: 0,
            origin: None,
            start: Instant::now(),
            finished: false,
            undo_observed: false,
            redo_observed: false,
            mixed_sewing: false,
            translation_before: None,
            shape_before: None,
            layout_before: None,
            motion_start: None,
            rectangle_drawn: false,
            handle_edited: false,
            anchor_edited: false,
            layout_preserved_physics: false,
            rotation_2d_preserved_physics: false,
            rotation_before: None,
            rotation_axes: [false; 3],
            fabric_before: None,
            fabric_applied: false,
            seam_before: None,
            seam_removed: false,
            markings_before: None,
            allowance_applied: false,
            notch_added: false,
            markings_preserved_physics: false,
        }
    }
    pub fn target(&mut self, name: &str, p: egui::Pos2) {
        self.targets.insert(name.into(), p);
    }
    pub fn input(&mut self, input: &mut egui::RawInput) {
        if self.action >= ACTIONS.len() {
            return;
        }
        let (key, delta) = ACTIONS[self.action];
        self.tick += 1;
        if self.tick == 3 {
            self.origin = self.targets.get(key).copied();
        }
        if (3..=6).contains(&self.tick)
            && let Some(origin) = self.origin
        {
            let pos = origin + if self.tick >= 4 { delta } else { Vec2::ZERO };
            input.events.push(egui::Event::PointerMoved(pos));
            if self.tick == 3 || self.tick == 6 {
                input.events.push(egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: self.tick == 3,
                    modifiers: Default::default(),
                });
            }
        }
        if self.tick >= 10 && self.origin.is_some() {
            eprintln!(
                "Authoring smoke: completed {}/{} ({key})",
                self.action + 1,
                ACTIONS.len()
            );
            self.action += 1;
            self.tick = 0;
            self.origin = None;
        } else if self.tick >= 10 {
            self.tick = 0;
        }
    }
}
impl Atelier {
    pub(super) fn smoke_target_ui(&mut self, ui: &egui::Ui, name: &str, rect: egui::Rect) {
        if ui.clip_rect().contains(rect.center()) {
            self.smoke_target(name, rect.center());
        } else if let Some(smoke) = &mut self.authoring_smoke {
            smoke.targets.remove(name);
        }
        if self.authoring_smoke.as_ref().is_some_and(|s| s.wants(name))
            && !ui.clip_rect().contains(rect.center())
        {
            ui.scroll_to_rect_animation(
                rect,
                Some(egui::Align::Center),
                egui::style::ScrollAnimation::none(),
            );
        }
    }
    pub(super) fn smoke_target(&mut self, name: &str, p: egui::Pos2) {
        if let Some(smoke) = &mut self.authoring_smoke {
            smoke.targets.insert(name.into(), p);
        }
    }
    pub(super) fn authoring_smoke_tick(&mut self) {
        let Some(smoke) = &mut self.authoring_smoke else {
            return;
        };
        let key = ACTIONS.get(smoke.action).map(|a| a.0);
        let axis = match key {
            Some("ring_x") => Some(0),
            Some("ring_y") => Some(1),
            Some("ring_z") => Some(2),
            _ => None,
        };
        if smoke.rotation_before.as_ref().map(|(i, _)| *i) != axis {
            let rotation = self
                .project
                .template
                .panels
                .iter()
                .find(|p| Some(&p.id) == self.authoring.selected.as_ref())
                .map(|p| p.placement.rotation_degrees);
            if let Some((i, before)) = smoke.rotation_before.take() {
                smoke.rotation_axes[i] = rotation.is_some_and(|after| after.distance(before) > 1.);
            }
            if let (Some(i), Some(rotation)) = (axis, rotation) {
                smoke.rotation_before = Some((i, rotation));
            }
        }
        if key == Some("remove_seam") && smoke.seam_before.is_none() {
            smoke.seam_before = Some(self.scene.state.x.clone());
        }
        if key == Some("undo")
            && let Some(before) = &smoke.seam_before
        {
            smoke.seam_removed |=
                self.project.template.seams.is_empty() && self.scene.state.x == *before;
        }
        let panel = &self.project.template.panels[0];
        let poly = panel.polygon.as_ref();
        if smoke.action == 4 {
            if smoke.tick == 1 {
                eprintln!(
                    "Rectangle check: panels={}, points={:?}, status={}, error={:?}",
                    self.project.template.panels.len(),
                    poly.map(|p| p.points.len()),
                    self.status,
                    self.authoring.error
                );
            }
            smoke.rectangle_drawn |= self.project.template.panels.len() == 1
                && poly.is_some_and(|p| p.points.len() == 4 && p.curves.is_empty());
        }
        if key == Some("handle_1") && smoke.shape_before.is_none() {
            smoke.shape_before = poly.cloned();
        }
        if key == Some("anchor_3") && !smoke.handle_edited {
            smoke.handle_edited = smoke
                .shape_before
                .as_ref()
                .zip(poly)
                .is_some_and(|(before, after)| before.curves != after.curves);
            smoke.shape_before = poly.cloned();
        }
        if key == Some("body_panel_1") && smoke.layout_before.is_none() {
            smoke.anchor_edited =
                smoke
                    .shape_before
                    .as_ref()
                    .zip(poly)
                    .is_some_and(|(before, after)| {
                        (before.points[3] - before.points[0])
                            .distance(after.points[3] - after.points[0])
                            > 0.001
                    });
            smoke.layout_before = Some((self.project.template.clone(), self.scene.state.x.clone()));
        }
        if key == Some("rotate_2d") && !smoke.layout_preserved_physics {
            smoke.layout_preserved_physics = smoke.layout_before.as_ref().is_some_and(|(t, x)| {
                t.panels[0].layout_2d != panel.layout_2d
                    && marvelous_cloth::authoring::same_physics(t, &self.project.template)
                    && x == &self.scene.state.x
            });
        }
        if key == Some("Déplacer 3D") && !smoke.rotation_2d_preserved_physics {
            smoke.rotation_2d_preserved_physics =
                smoke.layout_before.as_ref().is_some_and(|(t, x)| {
                    panel.layout_rotation_degrees.abs() > 1.
                        && marvelous_cloth::authoring::same_physics(t, &self.project.template)
                        && x == &self.scene.state.x
                });
        }
        if key == Some("gizmo_x") && smoke.translation_before.is_none() {
            smoke.translation_before = Some(panel.placement.translation);
        }
        smoke.mixed_sewing |= key == Some("simulate") && self.authoring.ends.len() == 2;
        smoke.undo_observed |= key == Some("redo") && self.project.template.seams.is_empty();
        smoke.redo_observed |= smoke.undo_observed && self.project.template.seams.len() == 1;
        if smoke.action == ACTIONS.len() - 1 && smoke.motion_start.is_none() {
            smoke.motion_start = Some((self.scene.state.time, self.scene.state.x.clone()));
        }
        let simulated = smoke.motion_start.as_ref().is_some_and(|(time, x)| {
            x.len() == self.scene.state.x.len()
                && self.scene.state.time - time >= 0.2
                && self.scene.garment.panels.last().is_some_and(|p| {
                    p.vertices
                        .clone()
                        .any(|i| self.scene.state.x[i].distance(x[i]) > 0.001)
                })
        });
        if key == Some("fabric_apply") && smoke.fabric_before.is_none() {
            smoke.fabric_before = Some((
                self.scene.state.x.clone(),
                self.scene.garment.mesh.masses.clone(),
            ));
        }
        if key == Some("export") {
            smoke.fabric_applied |= smoke.fabric_before.as_ref().is_some_and(|(x, masses)| {
                self.scene.state.x == *x
                    && self.scene.garment.mesh.masses != *masses
                    && self
                        .scene
                        .garment
                        .materials
                        .iter()
                        .any(|m| (m.density - 0.296675).abs() < 1e-12)
            });
        }
        if key == Some("markings_allowance") && smoke.markings_before.is_none() {
            smoke.markings_before =
                Some((self.project.template.clone(), self.scene.state.x.clone()));
        }
        if key == Some("markings_notch") {
            let mut allowance = false;
            let mut notch = false;
            for poly in self
                .project
                .template
                .panels
                .iter()
                .filter_map(|p| p.polygon.as_ref())
            {
                allowance |= !poly.seam_allowances.is_empty()
                    && poly.cutting_contour().is_ok_and(|c| c.is_some());
                notch |= !poly.notches.is_empty();
            }
            smoke.allowance_applied |= allowance;
            smoke.notch_added |= notch;
            smoke.markings_preserved_physics |=
                smoke.markings_before.as_ref().is_some_and(|(t, x)| {
                    marvelous_cloth::authoring::same_physics(t, &self.project.template)
                        && x == &self.scene.state.x
                });
        }
        if smoke.finished
            || ((!simulated || smoke.action < ACTIONS.len())
                && smoke.start.elapsed().as_secs() < 40)
        {
            return;
        }
        smoke.finished = true;
        let partial_chain = self.project.template.seams.first().is_some_and(|s| {
            s.a.range[1] < 0.999
                && s.b.range[1] < 0.999
                && s.a_tail.len() == 1
                && s.b_tail.len() == 1
        });
        let complete = smoke.action == ACTIONS.len()
            && partial_chain
            && smoke.fabric_applied
            && smoke.seam_removed
            && smoke.rotation_2d_preserved_physics
            && smoke.rotation_axes.iter().all(|v| *v);
        let moved = self.project.template.panels.first().is_some_and(|p| {
            smoke
                .translation_before
                .is_some_and(|before| p.placement.translation.distance(before) > 0.001)
        });
        let curved = self.project.template.panels[0]
            .polygon
            .as_ref()
            .is_some_and(|p| !p.curves.is_empty());
        let rotated = self
            .project
            .template
            .panels
            .iter()
            .any(|p| p.placement.rotation_degrees.length() > 1.);
        let exported = FittingProject::load(&self.output.join("fitting-project.json"))
            .and_then(|p| p.compile().map(|_| p))
            .is_ok_and(|p| p.template.panels.len() == 2 && p.template.seams.len() == 1);
        let markings_exported = FittingProject::load(&self.output.join("fitting-project.json"))
            .is_ok_and(|p| {
                p.template
                    .panels
                    .iter()
                    .filter_map(|panel| panel.polygon.as_ref())
                    .any(|poly| {
                        !poly.seam_allowances.is_empty()
                            && !poly.notches.is_empty()
                            && poly.cutting_contour().is_ok_and(|c| c.is_some())
                    })
            });
        let report = serde_json::json!({"passed":complete&&simulated&&moved&&curved&&smoke.rectangle_drawn&&smoke.handle_edited&&smoke.anchor_edited&&smoke.layout_preserved_physics&&smoke.mixed_sewing&&rotated&&exported&&smoke.undo_observed&&smoke.redo_observed&&self.project.template.seams.len()==1&&smoke.allowance_applied&&smoke.notch_added&&smoke.markings_preserved_physics&&markings_exported,
            "partial_and_multi_edge_sewing":partial_chain,"seam_removed_preserving_drape":smoke.seam_removed,"fabric_applied_preserving_drape":smoke.fabric_applied,"new_panel_simulated":simulated,"pending_seam_committed_on_play":smoke.mixed_sewing&&smoke.undo_observed,"completed_pointer_actions":smoke.action,"expected_actions":ACTIONS.len(),"translated_with_gizmo":moved,"bezier_drawn":curved,"rectangle_drawn":smoke.rectangle_drawn,"handle_edited":smoke.handle_edited,"anchor_edited":smoke.anchor_edited,"layout_preserved_physics":smoke.layout_preserved_physics,"sewing_selected_in_2d_and_3d":smoke.mixed_sewing,"rotated_with_gizmo":rotated,
            "rotation_axes_xyz":smoke.rotation_axes,"rotation_2d_preserved_physics":smoke.rotation_2d_preserved_physics,"export_reload_compiles":exported,"undo_observed":smoke.undo_observed,"redo_observed":smoke.redo_observed,"panels":self.project.template.panels.len(),"seams":self.project.template.seams.len(),"status":self.status,
            "allowance_applied":smoke.allowance_applied,"notch_added":smoke.notch_added,"markings_preserved_physics":smoke.markings_preserved_physics,"markings_exported":markings_exported});
        if let Err(e) = std::fs::write(
            self.output.join("authoring.json"),
            serde_json::to_string_pretty(&report).unwrap(),
        ) {
            eprintln!("Authoring smoke: {e}");
        }
    }
}
