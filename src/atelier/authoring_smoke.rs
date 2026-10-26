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
    appearance: Option<AppearanceProbe>,
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
    pub(super) fn tests_documents(&self) -> bool {
        self.appearance
            .as_ref()
            .is_some_and(|probe| probe.documents)
    }
    pub(super) fn wants(&self, key: &str) -> bool {
        if let Some(probe) = &self.appearance {
            return probe.phase < probe.action_count() && probe.action() == key;
        }
        self.actions().get(self.action).is_some_and(|a| a.0 == key)
    }
    pub fn new() -> Self {
        Self {
            appearance: match std::env::var("CLOTHCRAFT_AUTHORING_SCENARIO").as_deref() {
                Ok("appearance") => Some(AppearanceProbe::default()),
                Ok("appearance-color") => Some(AppearanceProbe {
                    capture: Some(AppearanceCapture::Color),
                    ..Default::default()
                }),
                Ok("appearance-matte") => Some(AppearanceProbe {
                    capture: Some(AppearanceCapture::Matte),
                    ..Default::default()
                }),
                Ok("appearance-glossy") => Some(AppearanceProbe {
                    capture: Some(AppearanceCapture::Glossy),
                    ..Default::default()
                }),
                Ok("appearance-documents") => Some(AppearanceProbe {
                    documents: true,
                    ..Default::default()
                }),
                Ok("appearance-worker") => Some(AppearanceProbe {
                    running: true,
                    ..Default::default()
                }),
                _ => None,
            }
            .map(|mut probe| {
                probe.heatmap =
                    std::env::var("CLOTHCRAFT_APPEARANCE_HEATMAP").as_deref() == Ok("1");
                probe
            }),
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
    pub(super) fn target_rect(&mut self, ui: &egui::Ui, name: &str, rect: egui::Rect) {
        if ui.clip_rect().contains_rect(rect) && ui.is_rect_visible(rect) {
            self.target(name, rect.center());
        } else {
            self.targets.remove(name);
            if self.wants(name) {
                ui.scroll_to_rect_animation(
                    rect,
                    Some(egui::Align::Center),
                    egui::style::ScrollAnimation::none(),
                );
            }
        }
    }
    pub(super) fn appearance_text_target(&mut self, ui: &egui::Ui, response: &egui::Response) {
        self.target_rect(ui, "appearance.name", response.rect);
        if let Some(probe) = &mut self.appearance {
            probe.text_focused = response.has_focus();
        }
    }
    pub fn target(&mut self, name: &str, p: egui::Pos2) {
        self.targets.insert(name.into(), p);
    }
    pub fn input(&mut self, input: &mut egui::RawInput) {
        if let Some(probe) = &mut self.appearance {
            probe.input(input, &self.targets);
            return;
        }
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
        if self
            .authoring_smoke
            .as_ref()
            .is_some_and(|s| s.appearance.is_some())
        {
            self.appearance_smoke_tick();
            return;
        }
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

// This scenario advances only after observing the expected document transition.
// Sending a click is not evidence that the application accepted it.
const APPEARANCE_ACTIONS: [&str; 20] = [
    "appearance.enabled",
    "appearance.apply",
    "undo",
    "redo",
    "appearance.roughness.low",
    "appearance.apply",
    "undo",
    "redo",
    "keyboard.undo",
    "keyboard.redo",
    "appearance.name",
    "keyboard.text_undo",
    "appearance.enabled",
    "appearance.apply",
    "simulate",
    "appearance.enabled",
    "appearance.apply",
    "undo",
    "redo",
    "simulate",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AppearanceCapture {
    Color,
    Matte,
    Glossy,
}

// Capture fixture only: the public flat panel has a +Z normal. Put the
// orthographic eye on the fixed key light's reflected direction so roughness
// changes are visible instead of rounding to the same 8-bit front-view color.
fn appearance_capture_camera(camera: &mut marvelous_cloth::render::Camera) {
    let direction = glam::Vec3::new(-0.4, -0.8, 0.6).normalize();
    camera.yaw = direction.x.atan2(direction.z);
    camera.pitch = direction.y.asin();
    camera.orthographic = true;
    camera.pending_frame = None;
}

#[derive(Default)]
struct AppearanceProbe {
    phase: usize,
    tick: usize,
    running: bool,
    documents: bool,
    capture: Option<AppearanceCapture>,
    heatmap: bool,
    latest_pending: bool,
    latest_time: f64,
    dispatched: Option<(bool, f64)>,
    ready: bool,
    text_focused: bool,
    origin: Option<egui::Pos2>,
    baseline: Option<(Vec<glam::DVec3>, Vec<glam::DVec3>, f64, u64)>,
    garment: Option<std::sync::Arc<marvelous_cloth::garment::CompiledGarment>>,
    fabric: String,
    original: Option<marvelous_cloth::garment::appearance::FabricAppearance>,
    changed: Option<marvelous_cloth::garment::appearance::FabricAppearance>,
    observations: Vec<serde_json::Value>,
}
impl AppearanceProbe {
    fn action(&self) -> &'static str {
        if self.capture == Some(AppearanceCapture::Color) {
            [
                "appearance.enabled",
                "appearance.apply",
                "appearance.color.red",
                "appearance.apply",
            ][self.phase]
        } else if self.documents && self.phase >= 14 {
            [
                "appearance.enabled",
                "appearance.apply",
                "keyboard.save",
                "appearance.enabled",
                "appearance.apply",
                "keyboard.open",
            ][self.phase - 14]
        } else {
            APPEARANCE_ACTIONS[self.phase]
        }
    }
    fn action_count(&self) -> usize {
        if let Some(capture) = self.capture {
            // End only after Apply has passed its ordinary document/physics gate.
            return match capture {
                AppearanceCapture::Color => 4,
                AppearanceCapture::Matte => 2,
                AppearanceCapture::Glossy => 6,
            };
        }
        if self.running || self.documents {
            APPEARANCE_ACTIONS.len()
        } else {
            14
        }
    }
    fn input(&mut self, input: &mut egui::RawInput, targets: &BTreeMap<String, egui::Pos2>) {
        input.focused = true;
        if !self.ready || self.phase >= self.action_count() {
            return;
        }
        self.tick += 1;
        if self.tick == 3 {
            self.dispatched = Some((self.latest_pending, self.latest_time));
        }
        let action = self.action();
        if action.starts_with("keyboard.") {
            let modifiers = egui::Modifiers {
                ctrl: true,
                command: true,
                shift: action == "keyboard.redo",
                ..Default::default()
            };
            if self.tick == 7 {
                input
                    .events
                    .push(egui::Event::ModifiersChanged(egui::Modifiers::NONE));
            }
            if self.tick == 3 || self.tick == 6 {
                input.events.push(egui::Event::ModifiersChanged(modifiers));
                input.events.push(egui::Event::Key {
                    key: match action {
                        "keyboard.save" => egui::Key::S,
                        "keyboard.open" => egui::Key::O,
                        _ => egui::Key::Z,
                    },
                    physical_key: None,
                    pressed: self.tick == 3,
                    repeat: false,
                    modifiers,
                });
            }
        } else {
            if self.tick == 3 {
                self.origin = targets.get(action).copied();
            }
            if let Some(pos) = self.origin
                && (3..=6).contains(&self.tick)
            {
                let pos = if action == "appearance.color.red" && self.tick >= 4 {
                    pos + egui::vec2(-40.0 * (self.tick - 3) as f32, 0.0)
                } else {
                    pos
                };
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
        }
    }
}
impl Atelier {
    fn appearance_smoke_tick(&mut self) {
        let Some(mut smoke) = self.authoring_smoke.take() else {
            return;
        };
        let probe = smoke.appearance.as_mut().unwrap();
        let mut failure = None;
        if !probe.ready {
            self.playing = false;
            if !self.pending {
                if !self.project.template.fabric_appearance.is_empty() {
                    failure = Some("Use a public fixture with default appearance".to_owned());
                } else {
                    let panel = &self.project.template.panels[0];
                    probe.fabric = panel.fabric.clone();
                    self.authoring.selected = Some(panel.id.clone());
                    self.inspector_tab = chrome::InspectorTab::Fabric;
                    self.tools_visible = true;
                    probe.garment = Some(self.scene.garment.clone());
                    probe.baseline = Some((
                        self.scene.state.x.clone(),
                        self.scene.state.v.clone(),
                        self.scene.state.time,
                        self.generation,
                    ));
                    if matches!(
                        probe.capture,
                        Some(AppearanceCapture::Matte | AppearanceCapture::Glossy)
                    ) {
                        appearance_capture_camera(&mut self.camera);
                        // The reflected-light eye is below the floor plane.
                        // Hide presentation-only occluders, not physical contacts.
                        self.prefs.viewport.floor = false;
                        self.prefs.viewport.grid = false;
                        self.prefs.viewport.shadow = false;
                    }
                    if probe.heatmap {
                        self.heat = true;
                    }
                    probe.ready = true;
                }
            }
        } else if probe.tick >= 9 && probe.phase < probe.action_count() {
            let current = self
                .project
                .template
                .fabric_appearance
                .get(&probe.fabric)
                .cloned();
            let (x, v, time, generation) = probe.baseline.as_ref().unwrap();
            let live = probe.running && probe.phase >= 14;
            let document_replacement = probe.documents && matches!(probe.phase, 16 | 19);
            let advanced = probe
                .dispatched
                .is_some_and(|(_, before)| self.scene.state.time > before);
            let model_preserved = probe
                .garment
                .as_ref()
                .is_some_and(|before| std::sync::Arc::ptr_eq(before, &self.scene.garment));
            let preserved = self.generation == *generation + u64::from(document_replacement)
                && (model_preserved || (probe.documents && probe.phase == 19))
                && if live {
                    self.scene.state.time >= *time
                        && self
                            .scene
                            .state
                            .x
                            .iter()
                            .chain(&self.scene.state.v)
                            .all(|p| p.is_finite())
                        && self.simulation_error.is_none()
                        && self.playing == (probe.phase != 19)
                } else {
                    self.scene.state.x == *x
                        && self.scene.state.v == *v
                        && self.scene.state.time == *time
                        && !self.playing
                        && !self.pending
                };
            let transition = if probe.capture == Some(AppearanceCapture::Color) && probe.phase >= 2
            {
                if probe.phase == 2 {
                    current == probe.original
                } else {
                    current
                        .as_ref()
                        .zip(probe.original.as_ref())
                        .is_some_and(|(now, before)| {
                            now.color_srgb[0] < before.color_srgb[0]
                                && now.color_srgb[1..] == before.color_srgb[1..]
                                && now.roughness == before.roughness
                        })
                }
            } else if probe.documents && probe.phase >= 14 {
                match probe.phase {
                    14 => current.is_none(),
                    15 | 17 => current == probe.original && current.is_some(),
                    16 => {
                        current == probe.original
                            && !self.document.dirty
                            && FittingProject::load(
                                &self.output.join("appearance-acceptance.clothcraft.json"),
                            )
                            .is_ok_and(|saved| {
                                saved.template.fabric_appearance
                                    == self.project.template.fabric_appearance
                                    && saved.state.is_some_and(|state| {
                                        state.x == *x && state.v == *v && state.time == *time
                                    })
                            })
                    }
                    18 => current.is_none(),
                    19 => {
                        current == probe.original
                            && current.is_some()
                            && !self.document.dirty
                            && !self.authoring.history.can_undo()
                    }
                    _ => false,
                }
            } else {
                match probe.phase {
                    0 => {
                        current.is_none() && smoke.targets.contains_key("appearance.roughness.low")
                    }
                    1 => {
                        probe.original = current.clone();
                        current.is_some()
                    }
                    2 => current.is_none() && self.authoring.history.can_redo(),
                    3 | 4 | 6 | 8 => current == probe.original,
                    5 => {
                        let changed =
                            current
                                .as_ref()
                                .zip(probe.original.as_ref())
                                .is_some_and(|(a, b)| {
                                    a.roughness < b.roughness && a.color_srgb == b.color_srgb
                                });
                        if changed {
                            probe.changed = current.clone();
                        }
                        changed
                    }
                    7 | 9 | 12 => current == probe.changed && current.is_some(),
                    10 | 11 => current == probe.changed && current.is_some() && probe.text_focused,
                    13 => current.is_none(),
                    14 => current.is_none() && advanced,
                    15 => current.is_none(),
                    16 | 18 => {
                        current == probe.original
                            && current.is_some()
                            && advanced
                            && probe.dispatched.is_some_and(|(pending, _)| pending)
                    }
                    17 => {
                        current.is_none()
                            && advanced
                            && probe.dispatched.is_some_and(|(pending, _)| pending)
                    }
                    19 => current == probe.original && current.is_some(),
                    _ => false,
                }
            };
            // Wait for an actual worker response, not a fixed number of rendered frames.
            if live
                && matches!(probe.phase, 14 | 16 | 17 | 18)
                && preserved
                && !advanced
                && smoke.start.elapsed().as_secs() <= 30
            {
                probe.latest_pending = self.pending;
                probe.latest_time = self.scene.state.time;
                self.authoring_smoke = Some(smoke);
                return;
            }
            probe.observations.push(serde_json::json!({
                "phase":probe.phase,"action":probe.action(),
                "appearance":current,"expected_transition":transition,"physics_preserved":preserved,"compiled_model_identity_preserved":model_preserved,
                "can_undo":self.authoring.history.can_undo(),"can_redo":self.authoring.history.can_redo(),
                "playing":self.playing,"pending":self.pending,"generation":self.generation,
                "time":self.scene.state.time,"status":self.status,"error":self.authoring.error,
                "pointer_target_found":probe.origin.is_some(),"text_field_focused":probe.text_focused,
                "worker_pending_at_dispatch":probe.dispatched.map(|d| d.0),
                "worker_time_at_dispatch":probe.dispatched.map(|d| d.1),"later_worker_state_observed":advanced
            }));
            if transition && preserved {
                if document_replacement {
                    probe.baseline.as_mut().unwrap().3 = self.generation;
                }
                probe.phase += 1;
                probe.tick = 0;
                probe.origin = None;
            } else {
                failure = Some(format!(
                    "Appearance phase {} failed its state gate",
                    probe.phase
                ));
            }
        }
        if smoke.start.elapsed().as_secs() > 30 {
            failure = Some("Appearance scenario timed out".into());
        }
        probe.latest_pending = self.pending;
        probe.latest_time = self.scene.state.time;
        let complete = probe.phase == probe.action_count();
        if !smoke.finished && (complete || failure.is_some()) {
            let report = serde_json::json!({"passed":complete && failure.is_none(),
                "scenario":"appearance","heatmap":probe.heatmap,"capture_variant":probe.capture.map(|c| format!("{c:?}")),"document_scenario":probe.documents,"scope":if probe.capture.is_some() { "paused appearance capture fixture; visual inspection required" } else if probe.documents { "paused history plus isolated native Save/Open" } else if probe.running { "paused history plus live worker continuity" } else { "paused pointer history, keyboard history and text ownership" },
                "completed_verified_actions":probe.phase,"expected_actions":probe.action_count(),"worker_scenario":probe.running,
                "observations":probe.observations,"failure":failure,
                "remaining_acceptance":if probe.capture.is_some() { vec!["visual comparison", "full history", "in-flight worker", "save/reopen"] } else if probe.documents { vec!["in-flight worker", "visual shading"] } else if probe.running { vec!["save/reopen", "visual shading"] } else { vec!["in-flight worker", "save/reopen", "visual shading"] }});
            match std::fs::write(
                self.output.join("authoring.json"),
                serde_json::to_vec_pretty(&report).unwrap(),
            ) {
                Ok(()) => smoke.finished = true,
                Err(error) => {
                    eprintln!("Cannot write appearance report: {error}");
                    smoke.finished = true;
                }
            }
        }
        self.authoring_smoke = Some(smoke);
    }
}

#[cfg(test)]
mod appearance_probe_tests {
    use super::*;
    #[test]
    fn pointer_delivery_does_not_advance_an_unverified_phase() {
        let mut probe = AppearanceProbe {
            ready: true,
            ..Default::default()
        };
        let targets = BTreeMap::from([("appearance.enabled".into(), egui::pos2(20., 30.))]);
        let mut presses = 0;
        let mut releases = 0;
        for _ in 0..12 {
            let mut input = egui::RawInput::default();
            probe.input(&mut input, &targets);
            for event in input.events {
                if let egui::Event::PointerButton { pressed, .. } = event {
                    if pressed {
                        presses += 1;
                    } else {
                        releases += 1;
                    }
                }
            }
        }
        assert_eq!((presses, releases), (1, 1));
        assert_eq!(probe.phase, 0, "sending a click must not count as success");
    }
    #[test]
    fn color_capture_drags_a_named_channel_without_claiming_success() {
        let mut probe = AppearanceProbe {
            capture: Some(AppearanceCapture::Color),
            ready: true,
            phase: 2,
            ..Default::default()
        };
        let targets = BTreeMap::from([("appearance.color.red".into(), egui::pos2(200., 30.))]);
        let mut positions = Vec::new();
        for _ in 0..8 {
            let mut input = egui::RawInput::default();
            probe.input(&mut input, &targets);
            for event in input.events {
                if let egui::Event::PointerMoved(pos) = event {
                    positions.push(pos);
                }
            }
        }
        assert_eq!(probe.action_count(), 4);
        assert_eq!(positions.first(), Some(&egui::pos2(200., 30.)));
        assert_eq!(positions.last(), Some(&egui::pos2(80., 30.)));
        assert_eq!(probe.phase, 2);
    }
    #[test]
    fn appearance_capture_camera_exposes_the_fixed_light_reflection() {
        let mut camera = marvelous_cloth::render::Camera::default();
        let target = camera.target;
        let distance = camera.distance;
        appearance_capture_camera(&mut camera);
        let light = glam::Vec3::new(0.4, 0.8, 0.6).normalize();
        let half = (light + camera.direction()).normalize();
        assert!(half.distance(glam::Vec3::Z) < 1e-6);
        assert!(camera.orthographic);
        assert_eq!(camera.target, target);
        assert_eq!(camera.distance, distance);
        assert!(camera.pending_frame.is_none());
    }
    #[test]
    fn appearance_capture_stops_after_apply_without_later_input() {
        for (capture, count) in [
            (AppearanceCapture::Matte, 2),
            (AppearanceCapture::Glossy, 6),
        ] {
            let mut probe = AppearanceProbe {
                capture: Some(capture),
                ready: true,
                phase: count - 1,
                ..Default::default()
            };
            assert_eq!(probe.action_count(), count);
            assert_eq!(probe.action(), "appearance.apply");
            let targets = BTreeMap::from([("appearance.apply".into(), egui::pos2(20., 30.))]);
            for _ in 0..10 {
                probe.input(&mut egui::RawInput::default(), &targets);
            }
            assert_eq!(probe.phase, count - 1, "input cannot certify Apply");
            probe.phase = count;
            let mut input = egui::RawInput::default();
            probe.input(&mut input, &targets);
            assert!(
                input.events.is_empty(),
                "capture must not dispatch later Undo or simulation"
            );
        }
    }
    #[test]
    fn worker_actions_are_opt_in_and_capture_dispatch_state() {
        let mut paused = AppearanceProbe {
            ready: true,
            phase: 14,
            ..Default::default()
        };
        let mut input = egui::RawInput::default();
        paused.input(&mut input, &BTreeMap::new());
        assert!(input.events.is_empty());
        assert_eq!(paused.action_count(), 14);
        let mut running = AppearanceProbe {
            ready: true,
            running: true,
            phase: 16,
            latest_pending: true,
            latest_time: 0.25,
            ..Default::default()
        };
        let targets = BTreeMap::from([("appearance.apply".into(), egui::pos2(20., 30.))]);
        for _ in 0..3 {
            running.input(&mut egui::RawInput::default(), &targets);
        }
        assert_eq!(running.action_count(), 20);
        assert_eq!(running.dispatched, Some((true, 0.25)));
        assert_eq!(running.phase, 16, "dispatch is not a worker response");
    }
    #[test]
    fn missing_target_never_injects_a_click_or_claims_progress() {
        let mut probe = AppearanceProbe {
            ready: true,
            ..Default::default()
        };
        for _ in 0..12 {
            let mut input = egui::RawInput::default();
            probe.input(&mut input, &BTreeMap::new());
            assert!(input.events.is_empty());
        }
        assert!(probe.origin.is_none());
        assert_eq!(probe.phase, 0);
    }
    #[test]
    fn keyboard_history_and_documents_send_and_release_global_modifiers() {
        for (phase, key, documents) in [
            (8, egui::Key::Z, false),
            (9, egui::Key::Z, false),
            (16, egui::Key::S, true),
            (19, egui::Key::O, true),
        ] {
            let mut probe = AppearanceProbe {
                ready: true,
                phase,
                documents,
                ..Default::default()
            };
            let ctx = egui::Context::default();
            let mut observed = false;
            for tick in 1..=7 {
                let mut input = egui::RawInput::default();
                probe.input(&mut input, &BTreeMap::new());
                let mut output = ctx.run_ui(input, |ui| {
                    if tick == 3 {
                        assert!(ui.input(|i| i.key_pressed(key) && i.modifiers.command));
                        assert_eq!(ui.input(|i| i.modifiers.shift), phase == 9);
                        observed = true;
                    }
                    if tick == 7 {
                        assert!(!ui.input(|i| i.modifiers.command));
                    }
                });
                output.textures_delta.clear();
            }
            assert!(observed);
            assert_eq!(probe.phase, phase);
        }
    }
}
