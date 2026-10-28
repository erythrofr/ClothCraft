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
    ReleaseOne(DVec2),
    ReleaseSelectedPins,
    PinMaterial(DVec2),
    UnpinMaterial(DVec2),
    FreezeSelected,
    ThawSelected,
}

/// List only authored pins; legacy arrangement pins cannot be released here.
fn individual_pin_controls(
    ui: &mut egui::Ui,
    panel: &str,
    available: bool,
    frozen: bool,
    points: &[DVec2],
) -> Option<Action> {
    if points.is_empty() {
        return None;
    }
    let mut action = None;
    let section = egui::CollapsingHeader::new("Individual authored pins")
        .id_salt(("individual-pins", panel))
        .show(ui, |ui| {
            egui::ScrollArea::vertical()
                .id_salt(("individual-pin-scroll", panel))
                .max_height(144.)
                .show_rows(ui, 24., points.len(), |ui, rows| {
                    for index in rows {
                        let uv = points[index];
                        ui.push_id((uv.x.to_bits(), uv.y.to_bits()), |ui| {
                            ui.horizontal(|ui| {
                                let release = ui.add_enabled(
                                    available && !frozen,
                                    egui::Button::new("Release"),
                                );
                                #[cfg(test)]
                                super::authoring_smoke::widget_harness::named(
                                    ui,
                                    &release,
                                    format!("pins.release_one.{index}"),
                                );
                                if release.clicked() {
                                    action = Some(Action::ReleaseOne(uv));
                                }
                                let coordinates =
                                    format!("X {:.2} mm · Y {:.2} mm", uv.x * 1000., uv.y * 1000.);
                                ui.add(egui::Label::new(&coordinates).truncate())
                                    .on_hover_text(coordinates);
                            });
                        });
                    }
                });
        });
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(ui, &section.header_response, "pins.individual");
    #[cfg(not(test))]
    let _ = section;
    action
}

/// Find a mesh vertex in this panel only, returning its exact rest UV.
/// Ties choose mesh order; a duplicate winning UV is refused as ambiguous.
fn nearest_material_vertex(
    garment: &CompiledGarment,
    panel: &str,
    requested: DVec2,
) -> Result<(DVec2, f64), String> {
    if !requested.is_finite() {
        return Err("Material position must be finite".into());
    }
    let mut panels = garment.panels.iter().filter(|p| p.id == panel);
    let range = &panels.next().ok_or("Unknown panel")?.vertices;
    if panels.next().is_some()
        || range.start >= range.end
        || range.end > garment.mesh.uv.len()
        || range.len() > 100_000
    {
        return Err("Invalid or oversized panel mesh".into());
    }
    let mut best: Option<(DVec2, f64)> = None;
    for &uv in &garment.mesh.uv[range.clone()] {
        if !uv.is_finite() {
            return Err("Invalid material coordinates".into());
        }
        let d2 = uv.distance_squared(requested);
        if !d2.is_finite() {
            return Err("Material position is out of range".into());
        }
        if best.is_none_or(|(_, old)| d2 < old) {
            best = Some((uv, d2));
        }
    }
    let (uv, d2) = best.ok_or("Panel has no mesh vertices")?;
    if garment.mesh.uv[range.clone()]
        .iter()
        .filter(|&&point| point == uv)
        .count()
        != 1
    {
        return Err("Ambiguous material vertex".into());
    }
    Ok((uv, d2.sqrt()))
}

#[derive(Clone)]
struct PinSearchCache {
    garment: Arc<CompiledGarment>,
    panel: String,
    requested: DVec2,
    result: Result<(DVec2, f64), String>,
}

/// Retaining an immutable Arc makes identity safe across remeshing and avoids
/// stale address reuse. One context entry bounds retained meshes and memory.
fn nearest_material_cached(
    ctx: &egui::Context,
    garment: &Arc<CompiledGarment>,
    panel: &str,
    requested: DVec2,
) -> Result<(DVec2, f64), String> {
    let id = egui::Id::new("pin-material-last-search");
    if let Some(cache) = ctx.data(|data| data.get_temp::<PinSearchCache>(id))
        && Arc::ptr_eq(&cache.garment, garment)
        && cache.panel == panel
        && cache.requested == requested
    {
        return cache.result;
    }
    let result = nearest_material_vertex(garment, panel, requested);
    ctx.data_mut(|data| {
        data.insert_temp(
            id,
            PinSearchCache {
                garment: garment.clone(),
                panel: panel.to_owned(),
                requested,
                result: result.clone(),
            },
        )
    });
    result
}

fn material_pin_controls(
    ui: &mut egui::Ui,
    garment: &Arc<CompiledGarment>,
    template: &GarmentTemplate,
    panel: &marvelous_cloth::garment::template::Panel,
    available: bool,
    frozen: bool,
) -> Option<Action> {
    let mut action = None;
    let section = egui::CollapsingHeader::new("Pin a material position")
        .id_salt(("pin-material", &panel.id))
        .show(ui, |ui| {
            ui.small("Enter a 2D position; the nearest mesh vertex is shown before pinning.");
            let id = egui::Id::new(("pin-material-position", &panel.id));
            let mut mm = ui
                .ctx()
                .data(|data| data.get_temp::<[f64; 2]>(id))
                .unwrap_or([panel.pattern.width * 500., panel.pattern.height * 500.]);
            ui.horizontal(|ui| {
                ui.label("X / Y (mm)");
                ui.add(egui::DragValue::new(&mut mm[0]).speed(1.));
                ui.add(egui::DragValue::new(&mut mm[1]).speed(1.));
            });
            ui.ctx().data_mut(|data| data.insert_temp(id, mm));
            if !available {
                ui.small("Pause simulation and finish placement to select a mesh vertex.");
                return;
            }
            match nearest_material_cached(
                ui.ctx(),
                garment,
                &panel.id,
                DVec2::new(mm[0], mm[1]) * 0.001,
            ) {
                Ok((uv, distance)) => {
                    ui.small(format!(
                        "Nearest: X {:.2} mm · Y {:.2} mm · offset {:.2} mm",
                        uv.x * 1000.,
                        uv.y * 1000.,
                        distance * 1000.
                    ));
                    let pinned = template
                        .pin_targets
                        .iter()
                        .any(|p| p.panel == panel.id && p.uv == uv);
                    ui.horizontal_wrapped(|ui| {
                        let pin = ui.add_enabled(
                            available && !frozen && !pinned,
                            egui::Button::new("Pin nearest"),
                        );
                        #[cfg(test)]
                        super::authoring_smoke::widget_harness::named(
                            ui,
                            &pin,
                            "pins.material.pin",
                        );
                        if pin.clicked() {
                            action = Some(Action::PinMaterial(uv));
                        }
                        let unpin = ui.add_enabled(
                            available && !frozen && pinned,
                            egui::Button::new("Release nearest"),
                        );
                        #[cfg(test)]
                        super::authoring_smoke::widget_harness::named(
                            ui,
                            &unpin,
                            "pins.material.unpin",
                        );
                        if unpin.clicked() {
                            action = Some(Action::UnpinMaterial(uv));
                        }
                    });
                }
                Err(error) => {
                    ui.colored_label(egui::Color32::GOLD, error);
                }
            }
        });
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(ui, &section.header_response, "pins.material");
    #[cfg(not(test))]
    let _ = section;
    action
}

fn controls(
    ui: &mut egui::Ui,
    available: bool,
    frozen: bool,
    selection_frozen: bool,
    points: usize,
    pins: usize,
    selected_panels: (usize, usize, usize),
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
    if selected_panels.0 > 1 && selected_panels.1 > 0 && selected_panels.2 > 0 {
        ui.small("Unfreeze all selected panels before releasing their pins together.");
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
                "pins.release_selected",
                "Release selected panel pins",
                Action::ReleaseSelectedPins,
                selected_panels.0 > 1 && selected_panels.1 == 0 && selected_panels.2 > 0,
            ),
            (
                "pins.thaw_selected",
                "Unfreeze selected panels",
                Action::ThawSelected,
                selected_panels.0 > 1 && selected_panels.1 > 0,
            ),
        ] {
            if selected_panels.0 <= 1
                && matches!(
                    kind,
                    Action::FreezeSelected | Action::ThawSelected | Action::ReleaseSelectedPins
                )
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
        Action::PinMaterial(uv) | Action::UnpinMaterial(uv) => authoring::prepare_pin_edit(
            template,
            garment,
            state,
            panel,
            &[uv],
            matches!(action, Action::PinMaterial(_)),
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
        Action::ReleaseOne(uv) => {
            authoring::prepare_pin_edit(template, garment, state, panel, &[uv], false)?
        }
        Action::ReleaseSelectedPins => {
            let ids: std::collections::BTreeSet<_> = selected_panels.iter().collect();
            if selected_panels.len() < 2
                || selected_panels.len() > 128
                || ids.len() != selected_panels.len()
                || ids
                    .iter()
                    .any(|id| !template.panels.iter().any(|p| &p.id == *id))
            {
                return Err("Select 2–128 distinct existing panels".into());
            }
            if template
                .frozen_panels
                .iter()
                .any(|p| ids.contains(&p.panel))
            {
                return Err("Unfreeze selected panels before releasing their pins".into());
            }
            let mut points = BTreeMap::<String, Vec<DVec2>>::new();
            for target in &template.pin_targets {
                if ids.contains(&target.panel) {
                    points
                        .entry(target.panel.clone())
                        .or_default()
                        .push(target.uv);
                }
            }
            authoring::prepare_pin_group_edit(template, garment, state, &points, false)?
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
        let pin_points: Vec<_> = self
            .project
            .template
            .pin_targets
            .iter()
            .filter(|p| p.panel == panel.id)
            .map(|pin| pin.uv)
            .collect();
        let pins = pin_points.len();
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
        let selected_ids: std::collections::BTreeSet<&str> =
            selected_panels.iter().map(String::as_str).collect();
        let pins_selected = self
            .project
            .template
            .pin_targets
            .iter()
            .filter(|target| selected_ids.contains(target.panel.as_str()))
            .count();
        let available = !self.playing
            && !self.pending
            && self.authoring.preview.is_none()
            && self.authoring.board.shape.is_none()
            && self.authoring.board.group_shapes.is_empty();
        let action = controls(
            ui,
            available,
            frozen,
            selection_frozen,
            count,
            pins,
            (selected_panels.len(), frozen_selected, pins_selected),
        );
        let individual = individual_pin_controls(ui, &panel.id, available, frozen, &pin_points);
        let material = material_pin_controls(
            ui,
            &self.scene.garment,
            &self.project.template,
            panel,
            available,
            frozen,
        );
        if let Some(action) = action.or(individual).or(material) {
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
        let pin_points: Vec<_> = c
            .template
            .pin_targets
            .iter()
            .filter(|p| p.panel == panel)
            .map(|p| p.uv)
            .collect();
        let pins = pin_points.len();
        let action = controls(
            ui,
            c.available,
            frozen,
            frozen,
            c.selected.len(),
            pins,
            (1, usize::from(frozen), pins),
        );
        let individual = individual_pin_controls(ui, &panel, c.available, frozen, &pin_points);
        let panel_data = c.template.panels[0].clone();
        let test_garment = Arc::new(c.garment.clone());
        let material = material_pin_controls(
            ui,
            &test_garment,
            &c.template,
            &panel_data,
            c.available,
            frozen,
        );
        if let Some(action) = action.or(individual).or(material) {
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
    fn cached_material_search_revalidates_mesh_panel_and_query() {
        let c = case();
        let ctx = egui::Context::default();
        let original = Arc::new(c.garment.clone());
        let first = &c.template.panels[0].id;
        let second = &c.template.panels[1].id;
        let p = original.mesh.uv[original.panels[0].vertices.start];
        let first_result = nearest_material_cached(&ctx, &original, first, p).unwrap();
        assert_eq!(
            first_result,
            nearest_material_vertex(&original, first, p).unwrap()
        );
        assert_eq!(
            nearest_material_cached(&ctx, &original, first, p).unwrap(),
            first_result
        );
        let changed_query = p + DVec2::splat(0.2);
        assert_eq!(
            nearest_material_cached(&ctx, &original, first, changed_query),
            nearest_material_vertex(&original, first, changed_query)
        );
        assert_eq!(
            nearest_material_cached(&ctx, &original, second, p),
            nearest_material_vertex(&original, second, p)
        );
        let mut remeshed = original.as_ref().clone();
        let start = remeshed.panels[0].vertices.start;
        remeshed.mesh.uv[start] = DVec2::new(-1., -1.);
        let remeshed = Arc::new(remeshed);
        let result = nearest_material_cached(&ctx, &remeshed, first, p).unwrap();
        assert_eq!(
            result,
            nearest_material_vertex(&remeshed, first, p).unwrap()
        );
        assert_ne!(result, first_result);
        let saved = ctx
            .data(|d| d.get_temp::<PinSearchCache>(egui::Id::new("pin-material-last-search")))
            .unwrap();
        assert!(Arc::ptr_eq(&saved.garment, &remeshed));
        assert!(nearest_material_cached(&ctx, &remeshed, first, DVec2::splat(f64::NAN)).is_err());
    }

    #[test]
    fn material_position_controls_pin_and_release_interior_with_undo() {
        let mut c = case();
        let panel = c.template.panels[0].id.clone();
        let center = DVec2::new(
            c.template.panels[0].pattern.width,
            c.template.panels[0].pattern.height,
        ) * 0.5;
        let center_vertex = c.garment.panels[0].vertices.start + 4;
        let free_vertex = c.garment.panels[1].vertices.start;
        c.state.v[center_vertex] = glam::DVec3::X;
        c.state.v[free_vertex] = glam::DVec3::Y;
        let before = c.state.x.clone();
        let target = nearest_material_vertex(&c.garment, &panel, center).unwrap();
        assert_eq!(target.0, center);
        let mut h = Harness::new(egui::vec2(1000., 700.));
        h.frame(&mut c, &mut draw);
        h.click("pins.material", &mut c, &mut draw).unwrap();
        c.available = false;
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.material.pin", &mut c, &mut draw).is_err());
        c.available = true;
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pin", &mut c, &mut draw).unwrap();
        assert!(c.error.is_none(), "{:?}", c.error);
        assert_eq!(c.template.pin_targets.len(), 1);
        assert_eq!(c.template.pin_targets[0].uv, center);
        assert_eq!(c.template.pin_targets[0].world, before[center_vertex]);
        assert_eq!(c.state.x, before);
        assert_eq!(c.state.v[center_vertex], glam::DVec3::ZERO);
        assert_eq!(c.state.v[free_vertex], glam::DVec3::Y);
        h.frame(&mut c, &mut draw);
        h.click("pins.material.unpin", &mut c, &mut draw).unwrap();
        assert!(c.template.pin_targets.is_empty());
        assert_eq!(c.state.x, before);
        assert_eq!(c.state.v[center_vertex], glam::DVec3::ZERO);
        assert_eq!(c.state.v[free_vertex], glam::DVec3::Y);
        let undo = c.history.restore(&c.template, false).unwrap();
        assert_eq!(undo.template.pin_targets.len(), 1);
    }

    #[test]
    fn nearest_pin_vertex_is_panel_scoped_and_rejects_invalid_or_ambiguous_meshes() {
        let c = case();
        let first = &c.template.panels[0].id;
        let p = c.garment.mesh.uv[c.garment.panels[0].vertices.start];
        assert_eq!(nearest_material_vertex(&c.garment, first, p).unwrap().0, p);
        assert!(nearest_material_vertex(&c.garment, first, DVec2::splat(f64::NAN)).is_err());
        assert!(nearest_material_vertex(&c.garment, "missing", p).is_err());
        let mut isolated = c.garment.clone();
        let request = DVec2::new(-10., -10.);
        let second = isolated.panels[1].vertices.start;
        isolated.mesh.uv[second] = request;
        assert_ne!(
            nearest_material_vertex(&isolated, first, request)
                .unwrap()
                .0,
            request
        );
        let range = isolated.panels[0].vertices.clone();
        let a = isolated.mesh.uv[range.start];
        let b = isolated.mesh.uv[range.start + 1];
        assert_eq!(
            nearest_material_vertex(&isolated, first, (a + b) * 0.5)
                .unwrap()
                .0,
            a
        );
        let mut invalid = c.garment.clone();
        let range = invalid.panels[0].vertices.clone();
        invalid.mesh.uv[range.start + 1] = p;
        assert!(nearest_material_vertex(&invalid, first, p).is_err());
        invalid.panels[0].vertices.end = invalid.mesh.uv.len() + 1;
        assert!(nearest_material_vertex(&invalid, first, p).is_err());
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
    fn named_individual_pin_release_preserves_other_holds_and_undoes() {
        let mut c = case();
        c.selected = vec![c.garment.mesh.uv[0], c.garment.mesh.uv[1]];
        let free = c.garment.panels[1].vertices.start;
        c.state.v[free] = glam::DVec3::new(0.3, -0.1, 0.2);
        c.state.time = 1.25;
        let before = c.state.x.clone();
        let mut h = Harness::new(egui::vec2(1000., 700.));
        h.frame(&mut c, &mut draw);
        h.click("pins.pin", &mut c, &mut draw).unwrap();
        assert_eq!(c.template.pin_targets.len(), 2);
        let original = c.template.pin_targets.clone();
        h.frame(&mut c, &mut draw);
        h.click("pins.individual", &mut c, &mut draw).unwrap();
        h.resize(egui::vec2(240., 700.));
        h.frame(&mut c, &mut draw);
        c.available = false;
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.release_one.0", &mut c, &mut draw).is_err());
        assert_eq!(c.template.pin_targets, original);
        c.available = true;
        h.frame(&mut c, &mut draw);
        h.click("pins.freeze", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.release_one.0", &mut c, &mut draw).is_err());
        h.click("pins.thaw", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("pins.release_one.0", &mut c, &mut draw).unwrap();
        assert!(c.error.is_none(), "{:?}", c.error);
        assert_eq!(c.template.pin_targets, vec![original[1].clone()]);
        assert_eq!(c.state.x, before);
        assert_eq!(c.state.v[free], glam::DVec3::new(0.3, -0.1, 0.2));
        assert_eq!(c.state.time, 1.25);
        let edit = c.history.restore(&c.template, false).unwrap();
        c.state = edit.state_after(&c.garment, &c.state);
        c.template = edit.template;
        assert_eq!(c.template.pin_targets, original);
        assert_eq!(c.state.x, before);
        assert_eq!(c.state.v[free], glam::DVec3::new(0.3, -0.1, 0.2));
        assert_eq!(c.state.time, 1.25);
    }

    #[test]
    fn individual_pin_list_scrolls_to_and_releases_the_correct_last_row() {
        struct ListCase {
            points: Vec<DVec2>,
            top: egui::Pos2,
            selected: Option<Action>,
            available: bool,
        }
        let mut case = ListCase {
            points: (0..100)
                .map(|i| DVec2::new(i as f64 * 0.001, 0.02))
                .collect(),
            top: egui::Pos2::ZERO,
            selected: None,
            available: true,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut ListCase| {
            c.top = ui.next_widget_position();
            if let Some(action) = individual_pin_controls(ui, "left", c.available, false, &c.points)
            {
                c.selected = Some(action);
            }
        };
        let mut h = Harness::new(egui::vec2(400., 300.));
        h.frame(&mut case, &mut draw);
        h.click("pins.individual", &mut case, &mut draw).unwrap();
        assert!(
            h.click("pins.release_one.99", &mut case, &mut draw)
                .is_err()
        );
        assert!(case.selected.is_none());
        let pointer = case.top + egui::vec2(30., 60.);
        let mut output = h.ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(400., 300.),
                )),
                time: Some(0.055),
                focused: true,
                events: vec![
                    egui::Event::PointerMoved(pointer),
                    egui::Event::MouseWheel {
                        unit: egui::MouseWheelUnit::Point,
                        delta: egui::vec2(0., -10_000.),
                        phase: egui::TouchPhase::Move,
                        modifiers: egui::Modifiers::NONE,
                    },
                ],
                ..Default::default()
            },
            |ui| {
                egui::CentralPanel::default().show(ui, |ui| draw(ui, &mut case));
            },
        );
        output.textures_delta.clear();
        for _ in 0..20 {
            h.frame(&mut case, &mut draw);
        }
        h.click("pins.release_one.99", &mut case, &mut draw)
            .unwrap();
        assert_eq!(case.selected, Some(Action::ReleaseOne(case.points[99])));
        case.available = false;
        case.selected = None;
        h.frame(&mut case, &mut draw);
        assert!(
            h.click("pins.release_one.99", &mut case, &mut draw)
                .is_err()
        );
        assert!(case.selected.is_none());
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
            if let Some(action) = controls(ui, true, false, false, 2, 0, (1, 0, 0)) {
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
                (panels.len(), frozen, 0),
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

    #[test]
    fn release_selected_panel_pins_preserves_other_holds_and_undoes_once() {
        let mut c = case();
        let mut third = c.template.panels[0].clone();
        third.id = "third".into();
        third.placement.translation.x += 8.0;
        c.template.panels.push(third);
        c.garment = c.template.compile().unwrap();
        c.state = c.garment.initial_state.clone();
        let points: BTreeMap<_, _> = c
            .garment
            .panels
            .iter()
            .map(|panel| {
                (
                    panel.id.clone(),
                    vec![c.garment.mesh.uv[panel.vertices.start]],
                )
            })
            .collect();
        let (edit, _) =
            authoring::prepare_pin_group_edit(&c.template, &c.garment, &c.state, &points, true)
                .unwrap();
        c.state = edit.state_after(&c.garment, &c.state);
        c.template = edit.template;
        c.garment = edit.garment;
        let free_vertex = c.garment.panels[2].vertices.start + 1;
        c.state.v[free_vertex] = glam::DVec3::new(0.1, -0.2, 0.3);
        let before = c.state.clone();
        let all_targets = c.template.pin_targets.clone();
        let ids: Vec<_> = c
            .template
            .panels
            .iter()
            .take(2)
            .map(|p| p.id.clone())
            .collect();
        let active = ids[0].clone();
        let mut draw_group = |ui: &mut egui::Ui, c: &mut Case| {
            let count = c
                .template
                .pin_targets
                .iter()
                .filter(|p| ids.contains(&p.panel))
                .count();
            let frozen = c
                .template
                .frozen_panels
                .iter()
                .filter(|p| ids.contains(&p.panel))
                .count();
            if let Some(action) = controls(
                ui,
                c.available,
                frozen > 0,
                false,
                0,
                1,
                (ids.len(), frozen, count),
            ) {
                match prepare(
                    &c.template,
                    &c.garment,
                    &c.state,
                    None,
                    (&active, &BTreeMap::new(), &ids, action),
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
        let mut h = Harness::new(egui::vec2(1100., 700.));
        h.frame(&mut c, &mut draw_group);
        h.click("pins.release_selected", &mut c, &mut draw_group)
            .unwrap();
        assert!(c.error.is_none(), "{:?}", c.error);
        assert_eq!(c.template.pin_targets.len(), 1);
        assert_eq!(c.template.pin_targets[0].panel, "third");
        assert_eq!(c.state.x, before.x);
        assert_eq!(c.state.v, before.v);
        assert_eq!(c.state.time, before.time);
        let undo = c.history.restore(&c.template, false).unwrap();
        assert_eq!(undo.template.pin_targets, all_targets);
        assert!(!c.history.can_undo());
        h.frame(&mut c, &mut draw_group);
        assert!(
            h.click("pins.release_selected", &mut c, &mut draw_group)
                .is_err()
        );
    }

    #[test]
    fn group_release_rejects_frozen_or_invalid_selection_without_mutation() {
        let mut c = case();
        let ids: Vec<_> = c.template.panels.iter().map(|p| p.id.clone()).collect();
        let points = BTreeMap::from([(
            ids[0].clone(),
            vec![c.garment.mesh.uv[c.garment.panels[0].vertices.start]],
        )]);
        let (edit, _) =
            authoring::prepare_pin_group_edit(&c.template, &c.garment, &c.state, &points, true)
                .unwrap();
        c.state = edit.state_after(&c.garment, &c.state);
        c.template = edit.template;
        c.garment = edit.garment;
        let (edit, _) =
            authoring::prepare_freeze_edit(&c.template, &c.garment, &c.state, &ids[1], true)
                .unwrap();
        c.state = edit.state_after(&c.garment, &c.state);
        c.template = edit.template;
        c.garment = edit.garment;
        let before = serde_json::to_vec(&c.template).unwrap();
        for panels in [
            ids.clone(),
            vec![ids[0].clone(), ids[0].clone()],
            vec![ids[0].clone(), "missing".into()],
        ] {
            assert!(
                prepare(
                    &c.template,
                    &c.garment,
                    &c.state,
                    None,
                    (
                        &ids[0],
                        &BTreeMap::new(),
                        &panels,
                        Action::ReleaseSelectedPins
                    )
                )
                .is_err()
            );
            assert_eq!(serde_json::to_vec(&c.template).unwrap(), before);
        }
        let mut draw_frozen = |ui: &mut egui::Ui, _: &mut Case| {
            controls(ui, true, false, false, 0, 1, (2, 1, 1));
        };
        let mut h = Harness::new(egui::vec2(1100., 700.));
        h.frame(&mut c, &mut draw_frozen);
        assert!(
            h.click("pins.release_selected", &mut c, &mut draw_frozen)
                .is_err()
        );
        assert!(!c.history.can_undo());
    }
}
