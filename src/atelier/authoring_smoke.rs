//! Explicit native GPU smoke: inject real egui pointer events into editor widgets.
use super::*;
use std::{collections::BTreeMap, time::Instant};

#[cfg(test)]
#[path = "authoring_smoke/widget_harness.rs"]
pub(super) mod widget_harness;

// The first element of each action is a smoke-target protocol key registered by
// the authoring widgets (`smoke_target`). These keys are part of the test harness
// contract. Keep these English keys synchronized with the authoring toolbar.
const ACTIONS: [(&str, Vec2); 55] = [
    ("Pen", Vec2::ZERO),
    ("replace", Vec2::ZERO),
    ("Rectangle", Vec2::ZERO),
    ("point0", Vec2::new(120., 160.)),
    ("Pen", Vec2::ZERO),
    ("replace", Vec2::ZERO),
    ("point0", Vec2::ZERO),
    ("point1", Vec2::new(28., 20.)),
    ("point2", Vec2::ZERO),
    ("point3", Vec2::ZERO),
    ("create", Vec2::ZERO),
    ("Edit", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("handle_1", Vec2::new(-12., -16.)),
    ("anchor_3", Vec2::new(-16., 0.)),
    ("body_panel_1", Vec2::new(36., 20.)),
    ("rotate_2d", Vec2::new(48., 20.)),
    ("Move 3D", Vec2::ZERO),
    ("gizmo_x", Vec2::new(35., 0.)),
    ("duplicate", Vec2::ZERO),
    ("Sew", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("edge3d_panel_2", Vec2::ZERO),
    ("simulate", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("redo", Vec2::ZERO),
    ("remove_seam", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("Move 3D", Vec2::ZERO),
    ("focus", Vec2::ZERO),
    // Leave room for the following XYZ rotations without intersecting its neighbour.
    ("gizmo_x", Vec2::new(80., 0.)),
    ("Rotate 3D", Vec2::ZERO),
    ("ring_x", Vec2::new(0., 25.)),
    ("ring_y", Vec2::new(25., 0.)),
    ("ring_z", Vec2::new(25., 20.)),
    ("fabric_tab", Vec2::ZERO),
    ("fabric_presets", Vec2::ZERO),
    ("fabric_preset_denim", Vec2::ZERO),
    ("fabric_apply", Vec2::ZERO),
    ("export", Vec2::ZERO),
    ("Sew", Vec2::ZERO),
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
const QUICK_ACTIONS: &[(&str, Vec2)] = &[
    ("quick_open", Vec2::ZERO),
    ("quick_Union", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("quick_open", Vec2::ZERO),
    ("quick_copy_x", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("quick_open", Vec2::ZERO),
    ("quick_Ellipse", Vec2::ZERO),
    ("point0", Vec2::new(85., 100.)),
    ("undo", Vec2::ZERO),
    ("quick_open", Vec2::ZERO),
    ("quick_Arc", Vec2::ZERO),
    ("point0", Vec2::new(85., 100.)),
    ("undo", Vec2::ZERO),
    ("Sew", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("edge3d_panel_2", Vec2::ZERO),
    ("quick_flip", Vec2::ZERO),
    ("quick_flip", Vec2::ZERO),
    ("quick_ease", Vec2::ZERO),
    ("issue_brush", Vec2::ZERO),
    ("issue_face", Vec2::new(8., 5.)),
    ("issue_export", Vec2::ZERO),
];
const PANEL_ACTIONS: &[(&str, Vec2)] = &[
    ("Internal line", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("inside_a", Vec2::ZERO),
    ("inside_b", Vec2::ZERO),
    ("create", Vec2::ZERO),
    ("measure", Vec2::ZERO),
    ("inside_a", Vec2::ZERO),
    ("inside_b", Vec2::ZERO),
    ("Edit", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("linked_mirror_X", Vec2::ZERO),
    ("Edit", Vec2::ZERO),
    ("anchor_1", Vec2::new(-10., 15.)),
    ("undo", Vec2::ZERO),
    ("redo", Vec2::ZERO),
    ("export", Vec2::ZERO),
];
const WORKFLOW_ACTIONS: &[(&str, Vec2)] = &[
    ("Edit", Vec2::ZERO),
    ("selection_points", Vec2::ZERO),
    ("selection_lasso", Vec2::ZERO),
    ("lasso_points", Vec2::ZERO),
    ("selection_box", Vec2::ZERO),
    ("box_points", Vec2::ZERO),
    ("Sew", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("edge3d_panel_2", Vec2::ZERO),
    ("canvas_confirm", Vec2::ZERO),
    ("cursor_ease", Vec2::ZERO),
    ("cursor_flip", Vec2::ZERO),
    ("cursor_flip", Vec2::ZERO),
    ("canvas_confirm", Vec2::ZERO),
    ("Edit", Vec2::ZERO),
    ("panel_1", Vec2::ZERO),
    ("cursor_delete_seam", Vec2::ZERO),
    ("undo", Vec2::ZERO),
    ("selection_points", Vec2::ZERO),
    ("selection_lasso", Vec2::ZERO),
    ("lasso_points", Vec2::ZERO),
];

pub(super) struct Smoke {
    panel_tools: bool,
    workflow: bool,
    quick: bool,
    prepared: bool,
    checks: BTreeMap<String, bool>,
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
}
impl Smoke {
    fn actions(&self) -> &'static [(&'static str, Vec2)] {
        if self.panel_tools {
            PANEL_ACTIONS
        } else if self.workflow {
            WORKFLOW_ACTIONS
        } else if self.quick {
            QUICK_ACTIONS
        } else {
            &ACTIONS
        }
    }
    pub(super) fn wants(&self, key: &str) -> bool {
        self.actions().get(self.action).is_some_and(|a| a.0 == key)
    }
    pub fn new() -> Self {
        Self {
            panel_tools: std::env::var("CLOTHCRAFT_AUTHORING_SCENARIO").as_deref()
                == Ok("panel-tools"),
            workflow: std::env::var("CLOTHCRAFT_AUTHORING_SCENARIO").as_deref() == Ok("workflow"),
            quick: std::env::var("CLOTHCRAFT_AUTHORING_SCENARIO").as_deref() == Ok("quick"),
            prepared: false,
            checks: BTreeMap::new(),
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
        }
    }
    pub fn target(&mut self, name: &str, p: egui::Pos2) {
        self.targets.insert(name.into(), p);
    }
    pub fn input(&mut self, input: &mut egui::RawInput) {
        // Synthetic pointer/keyboard input belongs to this test viewport, even
        // when Windows leaves the owner's other application in the foreground.
        input.focused = true;
        if self.action >= self.actions().len() {
            return;
        }
        let (key, delta) = self.actions()[self.action];
        self.tick += 1;
        if self.tick == 3 {
            self.origin = self.targets.get(key).copied();
        }
        if matches!(key, "lasso_points" | "box_points") {
            if let (Some(origin), Some(end)) =
                (self.origin, self.targets.get("selection_end").copied())
            {
                let path = [
                    origin,
                    egui::pos2(end.x, origin.y),
                    end,
                    egui::pos2(origin.x, end.y),
                    origin,
                    origin,
                ];
                if (3..=8).contains(&self.tick) {
                    let pos = if key == "box_points" {
                        if self.tick == 3 { origin } else { end }
                    } else {
                        path[self.tick - 3]
                    };
                    input.events.push(egui::Event::PointerMoved(pos));
                    if self.tick == 3 || self.tick == 8 {
                        input.events.push(egui::Event::PointerButton {
                            pos,
                            button: egui::PointerButton::Primary,
                            pressed: self.tick == 3,
                            modifiers: Default::default(),
                        });
                    }
                }
            }
        } else if (3..=6).contains(&self.tick)
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
                self.actions().len()
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
    fn workflow_smoke_tick(&mut self) {
        use marvelous_cloth::{authoring::Command, garment::shapes::Primitive};
        let Some(mut smoke) = self.authoring_smoke.take() else {
            return;
        };
        if !smoke.prepared {
            for index in 0..2 {
                assert!(self.edit(Command::Primitive {
                    kind: Primitive::Rectangle,
                    size: glam::DVec2::splat(if index == 0 { 0.4 } else { 0.3 }),
                    sweep_degrees: 180.,
                    origin: glam::DVec2::new(index as f64 * 0.6, 0.),
                    meshing: Default::default(),
                    fabric: self.project.template.fabrics[0].id.clone(),
                    replace: index == 0
                }));
            }
            self.authoring.selected = Some(self.project.template.panels[0].id.clone());
            self.authoring.board.request_fit();
            smoke.prepared = true;
        }
        if smoke.tick <= 2 {
            let check = match smoke.action {
                4 => Some((
                    "lasso_selects_contour_points",
                    self.authoring.board.selection.len() == 4,
                )),
                6 => Some((
                    "box_selects_contour_points",
                    self.authoring.board.selection.len() == 4,
                )),
                9 => Some((
                    "mixed_2d_3d_preview",
                    self.authoring.ends.len() == 2 && self.project.template.seams.is_empty(),
                )),
                10 => Some((
                    "unequal_lengths_require_explicit_easing",
                    self.authoring.ends.len() == 2
                        && self.project.template.seams.is_empty()
                        && self.authoring.error.is_some(),
                )),
                11 => Some(("cursor_easing", self.authoring.ease)),
                12 => Some(("cursor_flip", self.authoring.reverse)),
                13 => Some(("cursor_flip_restored", !self.authoring.reverse)),
                14 => Some((
                    "canvas_click_commits_seam",
                    self.project.template.seams.len() == 1 && self.authoring.ends.is_empty(),
                )),
                17 => Some((
                    "cursor_deletes_seam",
                    self.project.template.seams.is_empty(),
                )),
                18 => Some(("undo_restores_seam", self.project.template.seams.len() == 1)),
                _ => None,
            };
            if let Some((name, ok)) = check {
                if smoke.tick == 0 {
                    eprintln!(
                        "Workflow check {name}: {ok}, selection={:?}, panel={:?}, status={}",
                        self.authoring.board.selection, self.authoring.selected, self.status
                    );
                }
                smoke.checks.insert(name.into(), ok);
            }
        }
        if !smoke.finished
            && (smoke.action == WORKFLOW_ACTIONS.len() || smoke.start.elapsed().as_secs() > 45)
        {
            let report = serde_json::json!({"passed":smoke.action==WORKFLOW_ACTIONS.len() && smoke.checks.len()==10 && smoke.checks.values().all(|v| *v),
                "scenario":"workflow","checks":smoke.checks,"completed_pointer_actions":smoke.action,"expected_actions":WORKFLOW_ACTIONS.len(),"status":self.status});
            std::fs::write(
                self.output.join("authoring.json"),
                serde_json::to_vec_pretty(&report).unwrap(),
            )
            .unwrap();
            smoke.finished = true;
        }
        self.authoring_smoke = Some(smoke);
    }
    fn panel_smoke_tick(&mut self) {
        use marvelous_cloth::{
            authoring::Command,
            garment::shapes::{MirrorAxis, Primitive},
        };
        let Some(mut smoke) = self.authoring_smoke.take() else {
            return;
        };
        if !smoke.prepared {
            for (i, origin) in [glam::DVec2::ZERO, glam::DVec2::new(0.55, 0.)]
                .into_iter()
                .enumerate()
            {
                assert!(self.edit(Command::Primitive {
                    kind: Primitive::Rectangle,
                    size: glam::DVec2::splat(0.4),
                    sweep_degrees: 180.,
                    origin,
                    meshing: Default::default(),
                    fabric: self.project.template.fabrics[0].id.clone(),
                    replace: i == 0
                }));
            }
            // Deliberately select the OTHER panel before clicking panel_1's edge.
            self.authoring.selected = Some("panel_2".into());
            self.authoring.board.request_fit();
            smoke.prepared = true;
        }
        let first = &self.project.template.panels[0];
        let checks = [
            (
                2,
                "boundary_selects_owner_without_endpoint",
                self.authoring.drafting.line_panel.as_deref() == Some("panel_1")
                    && self.authoring.draft.is_empty(),
            ),
            (
                5,
                "internal_line_on_clicked_owner",
                first.polygon.as_ref().unwrap().lines.len() == 1
                    && self.project.template.panels[1]
                        .polygon
                        .as_ref()
                        .unwrap()
                        .lines
                        .is_empty(),
            ),
            (
                8,
                "ruler_200mm",
                self.authoring
                    .measure
                    .segment(None)
                    .is_some_and(|[a, b]| (a.distance(b) - 0.2).abs() < 1e-6),
            ),
            (
                11,
                "linked_copy",
                self.project.template.mirror_links.len() == 1
                    && self.project.template.panels.len() == 3,
            ),
        ];
        for (action, name, ok) in checks {
            if smoke.action == action && smoke.tick <= 2 {
                smoke.checks.insert(name.into(), ok);
            }
        }
        if smoke.action == 13 && smoke.tick <= 2 {
            let link = self.project.template.mirror_links.first();
            let mirrored = link.is_some_and(|l| {
                let a = self
                    .project
                    .template
                    .panels
                    .iter()
                    .find(|p| p.id == l.a)
                    .unwrap();
                let b = self
                    .project
                    .template
                    .panels
                    .iter()
                    .find(|p| p.id == l.b)
                    .unwrap();
                let mut poly = a.polygon.clone().unwrap();
                marvelous_cloth::garment::shapes::mirror(
                    &mut poly,
                    MirrorAxis::X,
                    glam::DVec2::new(a.pattern.width, a.pattern.height),
                );
                poly.points
                    .iter()
                    .zip(&b.polygon.as_ref().unwrap().points)
                    .all(|(a, b)| a.distance(*b) < 1e-12)
                    && a.polygon.as_ref().unwrap().points
                        != marvelous_cloth::garment::shapes::primitive(
                            Primitive::Rectangle,
                            glam::DVec2::splat(0.4),
                            180.,
                            Default::default(),
                        )
                        .unwrap()
                        .points
            });
            smoke
                .checks
                .insert("drag_updates_both_pieces".into(), mirrored);
        }
        if !smoke.finished
            && (smoke.action == PANEL_ACTIONS.len() || smoke.start.elapsed().as_secs() > 45)
        {
            let report = serde_json::json!({"passed":smoke.action==PANEL_ACTIONS.len() && smoke.checks.len()==5 && smoke.checks.values().all(|v|*v),"scenario":"panel-tools","checks":smoke.checks,"completed_pointer_actions":smoke.action,"expected_actions":PANEL_ACTIONS.len(),"status":self.status});
            std::fs::write(
                self.output.join("authoring.json"),
                serde_json::to_vec_pretty(&report).unwrap(),
            )
            .unwrap();
            smoke.finished = true;
        }
        self.authoring_smoke = Some(smoke);
    }
    fn quick_smoke_tick(&mut self) {
        use marvelous_cloth::{authoring::Command, garment::shapes::Primitive};
        let Some(mut smoke) = self.authoring_smoke.take() else {
            return;
        };
        if !smoke.prepared {
            for (index, origin) in [glam::DVec2::ZERO, glam::DVec2::new(0.15, 0.1)]
                .into_iter()
                .enumerate()
            {
                assert!(self.edit(Command::Primitive {
                    kind: Primitive::Rectangle,
                    size: glam::DVec2::splat(0.4),
                    sweep_degrees: 180.,
                    origin,
                    meshing: Default::default(),
                    fabric: self.project.template.fabrics[0].id.clone(),
                    replace: index == 0
                }));
            }
            self.authoring.selection.panels = self
                .project
                .template
                .panels
                .iter()
                .map(|p| p.id.clone())
                .collect();
            self.authoring.selected = Some(self.project.template.panels[0].id.clone());
            self.authoring.board.request_fit();
            smoke.prepared = true;
        }
        let count = self.project.template.panels.len();
        for (action, name, ok) in
            [
                (2, "boolean_union", count == 1),
                (5, "mirror_copy", count == 3),
                (
                    9,
                    "ellipse_drag",
                    count == 3
                        && self.project.template.panels.last().is_some_and(|p| {
                            p.polygon.as_ref().is_some_and(|p| p.curves.len() == 4)
                        }),
                ),
                (
                    13,
                    "arc_drag",
                    count == 3
                        && self.project.template.panels.last().is_some_and(|p| {
                            p.polygon.as_ref().is_some_and(|p| !p.curves.is_empty())
                        }),
                ),
                (18, "flip_on", self.authoring.reverse),
                (19, "flip_off", !self.authoring.reverse),
                (20, "easing", self.authoring.ease),
                (
                    22,
                    "painted_visible_faces",
                    !self.issue.faces.is_empty() && !self.playing,
                ),
            ]
        {
            if smoke.action == action && smoke.tick <= 2 {
                smoke.checks.insert(name.into(), ok);
            }
        }
        if !smoke.finished
            && (smoke.action == QUICK_ACTIONS.len() || smoke.start.elapsed().as_secs() > 40)
        {
            let export_ok = self.issue.last_export.as_ref().is_some_and(|folder| {
                let report = std::fs::read(folder.join("report.json"))
                    .ok()
                    .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
                let replay = FittingProject::load(&folder.join("project.clothcraft.json"))
                    .and_then(|p| p.compile());
                report.is_some_and(|r| {
                    r["analysis"]["marked_faces"]
                        .as_array()
                        .is_some_and(|f| f.len() == self.issue.faces.len() && !f.is_empty())
                }) && replay.is_ok_and(|s| {
                    s.state.x == self.scene.state.x
                        && s.state.v == self.scene.state.v
                        && s.state.time == self.scene.state.time
                })
            });
            smoke
                .checks
                .insert("report_reopens_identical_state".into(), export_ok);
            let report = serde_json::json!({ "passed": smoke.action == QUICK_ACTIONS.len() && smoke.checks.len() == 9 && smoke.checks.values().all(|v| *v), "scenario": "quick", "checks": smoke.checks, "completed_pointer_actions": smoke.action, "expected_actions": QUICK_ACTIONS.len(), "status": self.status });
            std::fs::write(
                self.output.join("authoring.json"),
                serde_json::to_vec_pretty(&report).unwrap(),
            )
            .unwrap();
            smoke.finished = true;
        }
        self.authoring_smoke = Some(smoke);
    }
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
        if self.authoring_smoke.as_ref().is_some_and(|s| s.panel_tools) {
            self.panel_smoke_tick();
            return;
        }
        if self.authoring_smoke.as_ref().is_some_and(|s| s.workflow) {
            self.workflow_smoke_tick();
            return;
        }
        if self.authoring_smoke.as_ref().is_some_and(|s| s.quick) {
            self.quick_smoke_tick();
            return;
        }
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
        if key == Some("Move 3D") && !smoke.rotation_2d_preserved_physics {
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
        let report = serde_json::json!({"passed":complete&&simulated&&moved&&curved&&smoke.rectangle_drawn&&smoke.handle_edited&&smoke.anchor_edited&&smoke.layout_preserved_physics&&smoke.mixed_sewing&&rotated&&exported&&smoke.undo_observed&&smoke.redo_observed&&self.project.template.seams.len()==1,
            "partial_and_multi_edge_sewing":partial_chain,"seam_removed_preserving_drape":smoke.seam_removed,"fabric_applied_preserving_drape":smoke.fabric_applied,"new_panel_simulated":simulated,"pending_seam_committed_on_play":smoke.mixed_sewing&&smoke.undo_observed,"completed_pointer_actions":smoke.action,"expected_actions":ACTIONS.len(),"translated_with_gizmo":moved,"bezier_drawn":curved,"rectangle_drawn":smoke.rectangle_drawn,"handle_edited":smoke.handle_edited,"anchor_edited":smoke.anchor_edited,"layout_preserved_physics":smoke.layout_preserved_physics,"sewing_selected_in_2d_and_3d":smoke.mixed_sewing,"rotated_with_gizmo":rotated,
            "rotation_axes_xyz":smoke.rotation_axes,"rotation_2d_preserved_physics":smoke.rotation_2d_preserved_physics,"export_reload_compiles":exported,"undo_observed":smoke.undo_observed,"redo_observed":smoke.redo_observed,"panels":self.project.template.panels.len(),"seams":self.project.template.seams.len(),"status":self.status});
        if let Err(e) = std::fs::write(
            self.output.join("authoring.json"),
            serde_json::to_string_pretty(&report).unwrap(),
        ) {
            eprintln!("Authoring smoke: {e}");
        }
    }
}
