//! Hold controls prepare and validate before changing history or live state.
use super::*;
use glam::DVec2;
use marvelous_cloth::{
    authoring,
    garment::{CompiledGarment, GarmentTemplate},
    model::State,
};
use std::{collections::BTreeMap, sync::Arc};

#[derive(Clone, Copy, Debug, PartialEq)]
enum Action {
    Pin,
    Unpin,
    Freeze,
    Thaw,
    ReleasePins,
    FreezeSelected,
    ThawSelected,
}

fn controls(
    ui: &mut egui::Ui,
    available: bool,
    frozen: bool,
    selection_frozen: bool,
    points: usize,
    pins: usize,
    selected_panels: (usize, usize),
) -> Option<Action> {
    ui.separator();
    ui.strong("Pins and freeze");
    ui.small(format!(
        "Selection: {points} contour points | Active panel: {pins} authored pins"
    ));
    if !available {
        ui.small("Pause simulation and finish placement before editing holds.");
    }
    if selection_frozen {
        ui.small("Unfreeze selected panels before editing their individual pins.");
    }
    let mut action = None;
    ui.horizontal_wrapped(|ui| {
        for (name, label, kind, enabled) in [
            (
                "pins.pin",
                "Pin selected",
                Action::Pin,
                points > 0 && !selection_frozen,
            ),
            (
                "pins.unpin",
                "Unpin selected",
                Action::Unpin,
                points > 0 && !selection_frozen,
            ),
            (
                "pins.release",
                "Release panel pins",
                Action::ReleasePins,
                pins > 0 && !frozen,
            ),
            ("pins.freeze", "Freeze panel", Action::Freeze, !frozen),
            ("pins.thaw", "Unfreeze panel", Action::Thaw, frozen),
            (
                "pins.freeze_selected",
                "Freeze selected panels",
                Action::FreezeSelected,
                selected_panels.0 > 1 && selected_panels.1 < selected_panels.0,
            ),
            (
                "pins.thaw_selected",
                "Unfreeze selected panels",
                Action::ThawSelected,
                selected_panels.0 > 1 && selected_panels.1 > 0,
            ),
        ] {
            if selected_panels.0 <= 1
                && matches!(kind, Action::FreezeSelected | Action::ThawSelected)
            {
                continue;
            }
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
    request: (&str, &BTreeMap<String, Vec<DVec2>>, &[String], Action),
) -> Result<authoring::Edit, String> {
    let (panel, points, selected_panels, action) = request;
    let (mut edit, candidate) = match action {
        Action::Freeze | Action::Thaw => authoring::prepare_freeze_edit(
            template,
            garment,
            state,
            panel,
            action == Action::Freeze,
        )?,
        Action::Pin | Action::Unpin => authoring::prepare_pin_group_edit(
            template,
            garment,
            state,
            points,
            action == Action::Pin,
        )?,
        Action::FreezeSelected | Action::ThawSelected => authoring::prepare_freeze_group_edit(
            template,
            garment,
            state,
            selected_panels,
            action == Action::FreezeSelected,
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
    edit.selected = Some(panel.to_owned());
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

/// Resolve every selected contour index or reject the entire selection.
fn selected_material_points(
    template: &GarmentTemplate,
    groups: &BTreeMap<String, Vec<usize>>,
) -> Result<BTreeMap<String, Vec<DVec2>>, String> {
    groups
        .iter()
        .map(|(id, indices)| {
            let polygon = template
                .panels
                .iter()
                .find(|p| &p.id == id)
                .and_then(|p| p.polygon.as_ref())
                .ok_or_else(|| format!("Selected panel {id} has no editable contour"))?;
            let points = indices
                .iter()
                .map(|i| {
                    polygon
                        .points
                        .get(*i)
                        .copied()
                        .ok_or_else(|| format!("Selected contour point {i} on {id} is stale"))
                })
                .collect::<Result<Vec<_>, _>>()?;
            Ok((id.clone(), points))
        })
        .collect()
}

impl Atelier {
    pub(super) fn pin_properties(
        &mut self,
        ui: &mut egui::Ui,
        panel: &marvelous_cloth::garment::template::Panel,
    ) {
        let mut groups = self.authoring.board.point_selections();
        if groups.is_empty()
            && let Some((id, i)) = &self.authoring.anchor
        {
            groups.insert(id.clone(), vec![*i]);
        }
        let points = selected_material_points(&self.project.template, &groups);
        let count = groups.values().map(Vec::len).sum();
        let selection_frozen = self
            .project
            .template
            .frozen_panels
            .iter()
            .any(|p| groups.contains_key(&p.panel));
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
        let selected_panels = self.selected_panels();
        let frozen_selected = selected_panels
            .iter()
            .filter(|id| {
                self.project
                    .template
                    .frozen_panels
                    .iter()
                    .any(|p| &p.panel == *id)
            })
            .count();
        let available = !self.playing
            && !self.pending
            && self.authoring.preview.is_none()
            && self.authoring.board.shape.is_none()
            && self.authoring.board.group_shapes.is_empty();
        if let Some(action) = controls(
            ui,
            available,
            frozen,
            selection_frozen,
            count,
            pins,
            (selected_panels.len(), frozen_selected),
        ) {
            let result = (|| {
                // Full-panel actions do not depend on contour selection validity.
                let empty = BTreeMap::new();
                let points = if matches!(action, Action::Pin | Action::Unpin) {
                    points.as_ref().map_err(Clone::clone)?
                } else {
                    &empty
                };
                prepare(
                    &self.project.template,
                    &self.scene.garment,
                    &self.scene.state,
                    Some(&self.scene.collider.surface),
                    (&panel.id, points, &selected_panels, action),
                )
            })();
            match result {
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
        if let Some(action) = controls(
            ui,
            c.available,
            frozen,
            frozen,
            c.selected.len(),
            pins,
            (1, usize::from(frozen)),
        ) {
            match prepare(
                &c.template,
                &c.garment,
                &c.state,
                None,
                (
                    &panel,
                    &BTreeMap::from([(panel.clone(), c.selected.clone())]),
                    std::slice::from_ref(&panel),
                    action,
                ),
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
                (
                    &c.template.panels[0].id,
                    &BTreeMap::new(),
                    std::slice::from_ref(&c.template.panels[0].id),
                    Action::Freeze
                )
            )
            .is_err()
        );
        assert_eq!(serde_json::to_vec(&c.state).unwrap(), before);
        assert!(c.template.frozen_panels.is_empty());
        assert!(!c.history.can_undo());
    }
    #[test]
    fn grouped_widget_action_and_contour_resolution_are_atomic() {
        use marvelous_cloth::garment::shapes::{Primitive, primitive};
        let mut c = case();
        c.template.version = 2;
        for panel in &mut c.template.panels {
            panel.polygon = Some(
                primitive(
                    Primitive::Rectangle,
                    DVec2::splat(0.2),
                    90.,
                    Default::default(),
                )
                .unwrap(),
            );
        }
        c.garment = c.template.compile().unwrap();
        c.state = c.garment.initial_state.clone();
        let groups = c
            .template
            .panels
            .iter()
            .map(|p| (p.id.clone(), vec![0]))
            .collect();
        let selected = selected_material_points(&c.template, &groups).unwrap();
        assert_eq!(selected.len(), 2);
        let active = c.template.panels[1].id.clone();
        let before = c.state.x.clone();
        let mut draw_group = |ui: &mut egui::Ui, c: &mut Case| {
            if let Some(action) = controls(ui, true, false, false, 2, 0, (1, 0)) {
                let edit = prepare(
                    &c.template,
                    &c.garment,
                    &c.state,
                    None,
                    (&active, &selected, std::slice::from_ref(&active), action),
                )
                .unwrap();
                assert_eq!(edit.selected.as_ref(), Some(&active));
                c.state = edit.state_after(&c.garment, &c.state);
                c.history.record(c.template.clone());
                c.template = edit.template;
                c.garment = edit.garment;
            }
        };
        let mut h = Harness::new(egui::vec2(1000., 600.));
        h.frame(&mut c, &mut draw_group);
        h.click("pins.pin", &mut c, &mut draw_group).unwrap();
        assert_eq!(c.template.pin_targets.len(), 2);
        assert_eq!(c.state.x, before);
        h.click("pins.unpin", &mut c, &mut draw_group).unwrap();
        assert!(c.template.pin_targets.is_empty());
        assert_eq!(c.state.x, before);
        let mut stale = groups;
        stale.insert(active.clone(), vec![usize::MAX]);
        assert!(selected_material_points(&c.template, &stale).is_err());
        stale.remove(&active);
        stale.insert("missing".into(), vec![0]);
        assert!(selected_material_points(&c.template, &stale).is_err());
    }

    #[test]
    fn named_group_freeze_and_thaw_use_one_history_step_each() {
        let mut c = case();
        let before = c.state.x.clone();
        let mut draw_group = |ui: &mut egui::Ui, c: &mut Case| {
            let panels: Vec<_> = c.template.panels.iter().map(|p| p.id.clone()).collect();
            let active = panels[0].clone();
            let frozen = c
                .template
                .frozen_panels
                .iter()
                .filter(|p| panels.contains(&p.panel))
                .count();
            if let Some(action) = controls(
                ui,
                c.available,
                frozen > 0,
                frozen > 0,
                0,
                0,
                (panels.len(), frozen),
            ) {
                match prepare(
                    &c.template,
                    &c.garment,
                    &c.state,
                    None,
                    (&active, &BTreeMap::new(), &panels, action),
                ) {
                    Ok(edit) if edit.reset_simulation => {
                        c.state = edit.state_after(&c.garment, &c.state);
                        c.history.record(c.template.clone());
                        c.template = edit.template;
                        c.garment = edit.garment;
                    }
                    Ok(_) => {}
                    Err(e) => c.error = Some(e),
                }
            }
        };
        let mut h = Harness::new(egui::vec2(1000., 600.));
        h.frame(&mut c, &mut draw_group);
        h.click("pins.freeze_selected", &mut c, &mut draw_group)
            .unwrap();
        assert!(c.error.is_none(), "{:?}", c.error);
        assert_eq!(c.template.frozen_panels.len(), 2);
        assert_eq!(c.state.x, before);
        h.frame(&mut c, &mut draw_group);
        h.click("pins.thaw_selected", &mut c, &mut draw_group)
            .unwrap();
        assert!(c.template.frozen_panels.is_empty());
        assert_eq!(c.state.x, before);
        let undo = c.history.restore(&c.template, false).unwrap();
        assert_eq!(undo.template.frozen_panels.len(), 2);
        let undo = c.history.restore(&undo.template, false).unwrap();
        assert!(undo.template.frozen_panels.is_empty());
        assert!(!c.history.can_undo());
    }
}
