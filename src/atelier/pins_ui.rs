//! Hold controls prepare and validate before changing history or live state.
use super::*;
use glam::DVec2;
use marvelous_cloth::{
    authoring,
    garment::{CompiledGarment, GarmentTemplate},
    model::State,
};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq)]
enum Action {
    Pin,
    Unpin,
    Freeze,
    Thaw,
    ReleasePins,
}

fn controls(
    ui: &mut egui::Ui,
    available: bool,
    frozen: bool,
    points: usize,
    pins: usize,
) -> Option<Action> {
    ui.separator();
    ui.strong("Pins and freeze");
    ui.small(format!(
        "Active panel · {points} selected contour points · {pins} authored pins"
    ));
    if !available {
        ui.small("Pause simulation and finish placement before editing holds.");
    }
    let mut action = None;
    ui.horizontal_wrapped(|ui| {
        for (name, label, kind, enabled) in [
            (
                "pins.pin",
                "Pin selected",
                Action::Pin,
                points > 0 && !frozen,
            ),
            (
                "pins.unpin",
                "Unpin selected",
                Action::Unpin,
                points > 0 && !frozen,
            ),
            (
                "pins.release",
                "Release panel pins",
                Action::ReleasePins,
                pins > 0 && !frozen,
            ),
            ("pins.freeze", "Freeze panel", Action::Freeze, !frozen),
            ("pins.thaw", "Unfreeze panel", Action::Thaw, frozen),
        ] {
            let response = ui.add_enabled(available && enabled, egui::Button::new(label));
            #[cfg(test)]
            super::authoring_smoke::widget_harness::named(ui, &response, name);
            #[cfg(not(test))]
            let _ = name;
            if response.clicked() {
                action = Some(kind);
            }
        }
    });
    ui.small("Unfreeze keeps individual pins. Legacy template pins are unchanged.");
    action
}

fn prepare(
    template: &GarmentTemplate,
    garment: &CompiledGarment,
    state: &State,
    avatar: Option<&marvelous_cloth::avatar::SurfaceMesh>,
    request: (&str, &[DVec2], Action),
) -> Result<authoring::Edit, String> {
    let (panel, points, action) = request;
    let (edit, candidate) = match action {
        Action::Freeze | Action::Thaw => authoring::prepare_freeze_edit(
            template,
            garment,
            state,
            panel,
            action == Action::Freeze,
        )?,
        Action::Pin | Action::Unpin => authoring::prepare_pin_edit(
            template,
            garment,
            state,
            panel,
            points,
            action == Action::Pin,
        )?,
        Action::ReleasePins => {
            let points: Vec<_> = template
                .pin_targets
                .iter()
                .filter(|t| t.panel == panel)
                .map(|t| t.uv)
                .collect();
            authoring::prepare_pin_edit(template, garment, state, panel, &points, false)?
        }
    };
    validate(&edit, &candidate, avatar)?;
    Ok(edit)
}

/// Endpoint initialization validation, not continuous collision coverage of an edit.
pub(super) fn validate(
    edit: &authoring::Edit,
    candidate: &State,
    avatar: Option<&marvelous_cloth::avatar::SurfaceMesh>,
) -> Result<(), String> {
    marvelous_cloth::vbd::VbdSolver::new(Arc::new(edit.garment.clone()), avatar, candidate)
        .map(|_| ())
}

impl Atelier {
    pub(super) fn pin_properties(
        &mut self,
        ui: &mut egui::Ui,
        panel: &marvelous_cloth::garment::template::Panel,
    ) {
        let mut indices = if self.authoring.board.selection_panel.as_deref() == Some(&panel.id) {
            self.authoring.board.selection.clone()
        } else {
            vec![]
        };
        if indices.is_empty()
            && let Some((id, i)) = &self.authoring.anchor
            && id == &panel.id
        {
            indices.push(*i);
        }
        let points: Vec<_> = panel
            .polygon
            .as_ref()
            .map(|p| {
                indices
                    .iter()
                    .filter_map(|i| p.points.get(*i).copied())
                    .collect()
            })
            .unwrap_or_default();
        let frozen = self
            .project
            .template
            .frozen_panels
            .iter()
            .any(|p| p.panel == panel.id);
        let pins = self
            .project
            .template
            .pin_targets
            .iter()
            .filter(|p| p.panel == panel.id)
            .count();
        let available = !self.playing
            && !self.pending
            && self.authoring.preview.is_none()
            && self.authoring.board.shape.is_none()
            && self.authoring.board.group_shapes.is_empty();
        if let Some(action) = controls(ui, available, frozen, points.len(), pins) {
            match prepare(
                &self.project.template,
                &self.scene.garment,
                &self.scene.state,
                Some(&self.scene.collider.surface),
                (&panel.id, &points, action),
            ) {
                Ok(edit) if edit.reset_simulation => {
                    self.authoring.history.record(self.project.template.clone());
                    self.install_edit(edit);
                    self.status = "Panel holds updated".into();
                }
                Ok(_) => self.status = "Panel holds already match the request".into(),
                Err(error) => {
                    self.status = error.clone();
                    self.authoring.error = Some(error);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    struct Case {
        template: GarmentTemplate,
        garment: CompiledGarment,
        state: State,
        history: authoring::History,
        selected: Vec<DVec2>,
        available: bool,
        error: Option<String>,
    }
    fn case() -> Case {
        let mut template = GarmentTemplate::two_panel_demo();
        template.seams.clear();
        for (i, p) in template.panels.iter_mut().enumerate() {
            p.pins.clear();
            p.pattern.nx = 2;
            p.pattern.ny = 2;
            p.placement.translation = glam::DVec3::new(i as f64 * 4., 2., 0.);
        }
        let garment = template.compile().unwrap();
        let mut state = garment.initial_state.clone();
        for x in &mut state.x {
            x.y += 0.2;
        }
        Case {
            selected: vec![garment.mesh.uv[0]],
            template,
            garment,
            state,
            history: Default::default(),
            available: true,
            error: None,
        }
    }
    fn draw(ui: &mut egui::Ui, c: &mut Case) {
        let panel = c.template.panels[0].id.clone();
        let frozen = c.template.frozen_panels.iter().any(|p| p.panel == panel);
        let pins = c
            .template
            .pin_targets
            .iter()
            .filter(|p| p.panel == panel)
            .count();
        if let Some(action) = controls(ui, c.available, frozen, c.selected.len(), pins) {
            match prepare(
                &c.template,
                &c.garment,
                &c.state,
                None,
                (&panel, &c.selected, action),
            ) {
                Ok(edit) => {
                    c.state = edit.state_after(&c.garment, &c.state);
                    c.history.record(c.template.clone());
                    c.template = edit.template;
                    c.garment = edit.garment;
                    c.error = None;
                }
                Err(error) => c.error = Some(error),
            }
        }
    }
    #[test]
    fn named_controls_pin_freeze_thaw_release_without_moving_drape() {
        let mut c = case();
        let before = c.state.x.clone();
        let mut h = Harness::new(egui::vec2(1000., 600.));
        h.frame(&mut c, &mut draw);
        h.click("pins.pin", &mut c, &mut draw).unwrap();
        assert!(c.error.is_none(), "{:?}", c.error);
        assert_eq!(c.template.pin_targets.len(), 1);
        h.click("pins.freeze", &mut c, &mut draw).unwrap();
        assert_eq!(c.template.frozen_panels.len(), 1);
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.unpin", &mut c, &mut draw).is_err());
        h.click("pins.thaw", &mut c, &mut draw).unwrap();
        assert!(c.template.frozen_panels.is_empty());
        assert_eq!(c.template.pin_targets.len(), 1);
        h.frame(&mut c, &mut draw);
        h.click("pins.release", &mut c, &mut draw).unwrap();
        assert!(c.template.pin_targets.is_empty());
        assert_eq!(c.state.x, before);
        assert!(c.history.can_undo());
    }
    #[test]
    fn disabled_and_invalid_requests_do_not_modify_history() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(1000., 600.));
        c.available = false;
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.freeze", &mut c, &mut draw).is_err());
        assert!(!c.history.can_undo());
        c.available = true;
        c.selected[0] += DVec2::splat(0.001);
        h.frame(&mut c, &mut draw);
        h.click("pins.pin", &mut c, &mut draw).unwrap();
        assert!(c.error.is_some());
        assert!(!c.history.can_undo());
        assert!(c.template.pin_targets.is_empty());
    }
    #[test]
    fn intersecting_avatar_is_rejected_before_edit_commit() {
        let c = case();
        let tri = c.garment.mesh.triangles[0].vertices;
        let avatar = marvelous_cloth::avatar::SurfaceMesh {
            vertices: tri.map(|i| c.state.x[i]).to_vec(),
            triangles: vec![[0, 1, 2]],
        };
        let before = serde_json::to_vec(&c.state).unwrap();
        assert!(
            prepare(
                &c.template,
                &c.garment,
                &c.state,
                Some(&avatar),
                (&c.template.panels[0].id, &[], Action::Freeze)
            )
            .is_err()
        );
        assert_eq!(serde_json::to_vec(&c.state).unwrap(), before);
        assert!(c.template.frozen_panels.is_empty());
        assert!(!c.history.can_undo());
    }
}
