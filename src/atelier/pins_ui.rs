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
) -> Result<(DVec2, f64, usize), String> {
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
    let mut best: Option<(DVec2, f64, usize)> = None;
    for (index, &uv) in garment.mesh.uv[range.clone()].iter().enumerate() {
        if !uv.is_finite() {
            return Err("Invalid material coordinates".into());
        }
        let d2 = uv.distance_squared(requested);
        if !d2.is_finite() {
            return Err("Material position is out of range".into());
        }
        if best.is_none_or(|(_, old, _)| d2 < old) {
            best = Some((uv, d2, range.start + index));
        }
    }
    let (uv, d2, vertex) = best.ok_or("Panel has no mesh vertices")?;
    if garment.mesh.uv[range.clone()]
        .iter()
        .filter(|&&point| point == uv)
        .count()
        != 1
    {
        return Err("Ambiguous material vertex".into());
    }
    Ok((uv, d2.sqrt(), vertex))
}

#[derive(Clone)]
struct PinSearchCache {
    garment: Arc<CompiledGarment>,
    panel: String,
    requested: DVec2,
    result: Result<(DVec2, f64, usize), String>,
}

#[derive(Clone)]
struct PinPreview {
    garment: Arc<CompiledGarment>,
    panel: String,
    vertex: usize,
    pass: u64,
}

#[derive(Clone)]
struct PinPick3d {
    garment: Arc<CompiledGarment>,
    panel: String,
    seen_pass: u64,
    text_focus: bool,
    on_board: bool,
}

fn pin_pick_id() -> egui::Id {
    egui::Id::new("pin-material-pick-3d")
}

fn pin_pick_shield_id() -> egui::Id {
    egui::Id::new("pin-material-pick-shield")
}

fn clear_pin_pick(ctx: &egui::Context) {
    ctx.data_mut(|data| data.remove::<PinPick3d>(pin_pick_id()));
}

/// If cancellation occurs during a press, suppress the matching release too.
fn cancel_pin_pick(ctx: &egui::Context) {
    if ctx.input(|input| {
        input.pointer.primary_down() || input.pointer.button_released(egui::PointerButton::Primary)
    }) {
        ctx.data_mut(|data| data.insert_temp(pin_pick_shield_id(), true));
    }
    clear_pin_pick(ctx);
}

/// A pending trim owns the editing gesture; do not leave a pin pick armed.
fn cancel_pin_pick_for_trim(ctx: &egui::Context, trims: &super::trims_ui::TrimUi) -> bool {
    if !trims.has_pending_history_step() {
        return false;
    }
    if ctx.data(|data| data.get_temp::<PinPick3d>(pin_pick_id()).is_some()) {
        cancel_pin_pick(ctx);
    }
    true
}

pub(super) fn pin_pick_shield(ctx: &egui::Context) -> bool {
    if !ctx.data(|data| data.get_temp::<bool>(pin_pick_shield_id()).unwrap_or(false)) {
        return false;
    }
    if !ctx.input(|input| input.pointer.primary_down()) {
        ctx.data_mut(|data| data.remove::<bool>(pin_pick_shield_id()));
    }
    true
}

fn pin_pick_matches(pick: &PinPick3d, garment: &Arc<CompiledGarment>, panel: &str) -> bool {
    pick.panel == panel && Arc::ptr_eq(&pick.garment, garment)
}

fn pin_pick_cancel_shortcut(ctx: &egui::Context, had_text_focus: bool) -> bool {
    !had_text_focus
        && !ctx.egui_wants_keyboard_input()
        && ctx.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
}

fn pin_pick_seen(pick: &PinPick3d, pass: u64, has_viewport: bool) -> bool {
    has_viewport && pick.seen_pass == pass
}

fn pin_pick_pointer(ui: &egui::Ui, rect: egui::Rect) -> Option<egui::Pos2> {
    let ctx = ui.ctx();
    let pos = ctx.input(|input| {
        input
            .pointer
            .button_clicked(egui::PointerButton::Primary)
            .then(|| input.pointer.interact_pos())
            .flatten()
    })?;
    (rect.contains(pos) && ctx.layer_id_at(pos) == Some(ui.layer_id())).then_some(pos)
}

fn board_material_point(
    garment: &CompiledGarment,
    panel: &str,
    owner: Option<&str>,
    world: DVec2,
    origin: DVec2,
    angle: f64,
) -> Result<Option<DVec2>, String> {
    if owner != Some(panel) {
        return Ok(None);
    }
    let uv = authoring::rotate_2d(world - origin, -angle);
    nearest_material_vertex(garment, panel, uv)?;
    Ok(Some(uv))
}

fn stage_board_material_pick(
    ctx: &egui::Context,
    pick: &PinPick3d,
    garment: &Arc<CompiledGarment>,
    owner: Option<&str>,
    world: DVec2,
    origin: DVec2,
    angle: f64,
) -> Result<bool, String> {
    if !pick.on_board || !pin_pick_matches(pick, garment, &pick.panel) {
        return Err("The cloth mesh or pick mode changed; choose the vertex again".into());
    }
    let Some(uv) = board_material_point(garment, &pick.panel, owner, world, origin, angle)? else {
        return Ok(false);
    };
    let mm = uv * 1000.;
    if !mm.is_finite() {
        return Err("Picked material coordinate is out of range".into());
    }
    ctx.data_mut(|data| {
        data.insert_temp(
            egui::Id::new(("pin-material-position", &pick.panel)),
            [mm.x, mm.y],
        )
    });
    clear_pin_pick(ctx);
    Ok(true)
}

/// Resolve the nearest cloth face, then use its material coordinates to pick
/// the closest vertex on the owning panel. This is not a collision query.
fn pick_material_surface(
    garment: &CompiledGarment,
    state: &State,
    panel: &str,
    origin: glam::DVec3,
    direction: glam::DVec3,
    avatar_occludes: impl Fn(glam::DVec3, glam::DVec3, f64) -> bool,
) -> Result<Option<DVec2>, String> {
    if !origin.is_finite()
        || !direction.is_finite()
        || direction.length_squared() < 1e-24
        || state.x.len() != garment.mesh.uv.len()
        || garment.mesh.triangles.len() > 100_000
    {
        return Err("Cannot pick this cloth surface".into());
    }
    let direction = direction.normalize();
    if !direction.is_finite() {
        return Err("Cannot pick this cloth surface".into());
    }
    let mut closest: Option<(usize, f64, [f64; 3])> = None;
    for (face, triangle) in garment.mesh.triangles.iter().enumerate() {
        if triangle.vertices.iter().any(|&i| {
            i >= state.x.len() || !state.x[i].is_finite() || !garment.mesh.uv[i].is_finite()
        }) {
            return Err("Invalid cloth geometry for picking".into());
        }
        if let Some((distance, weights)) = marvelous_cloth::picking::ray_triangle(
            origin,
            direction,
            triangle.vertices.map(|i| state.x[i]),
        ) && distance.is_finite()
            && weights.iter().all(|w| w.is_finite())
            && closest
                .as_ref()
                .is_none_or(|(_, previous, _)| distance < *previous)
        {
            closest = Some((face, distance, weights));
        }
    }
    let Some((face, distance, weights)) = closest else {
        return Ok(None);
    };
    if avatar_occludes(origin, direction, (distance - 1e-5).max(0.)) {
        return Ok(None);
    }
    let owner = garment
        .panels
        .iter()
        .find(|p| p.triangles.contains(&face))
        .ok_or("Cloth hit has no owning panel")?;
    if owner.id != panel {
        return Ok(None);
    }
    let uv = garment.mesh.triangles[face]
        .vertices
        .into_iter()
        .zip(weights)
        .map(|(i, w)| garment.mesh.uv[i] * w)
        .sum::<DVec2>();
    let (snapped, _, _) = nearest_material_vertex(garment, panel, uv)?;
    Ok(Some(snapped))
}

fn stage_material_pick(
    ctx: &egui::Context,
    pick: &PinPick3d,
    garment: &Arc<CompiledGarment>,
    state: &State,
    origin: glam::DVec3,
    direction: glam::DVec3,
    avatar_occludes: impl Fn(glam::DVec3, glam::DVec3, f64) -> bool,
) -> Result<bool, String> {
    if !pin_pick_matches(pick, garment, &pick.panel) {
        return Err("The cloth mesh changed; choose the vertex again".into());
    }
    let Some(uv) = pick_material_surface(
        garment,
        state,
        &pick.panel,
        origin,
        direction,
        avatar_occludes,
    )?
    else {
        return Ok(false);
    };
    let millimetres = uv * 1000.;
    if !millimetres.is_finite() {
        return Err("Picked material coordinate is out of range".into());
    }
    ctx.data_mut(|data| {
        data.insert_temp(
            egui::Id::new(("pin-material-position", &pick.panel)),
            [millimetres.x, millimetres.y],
        )
    });
    clear_pin_pick(ctx);
    Ok(true)
}

fn pin_preview_id() -> egui::Id {
    egui::Id::new("pin-material-preview")
}

fn preview_world(
    preview: &PinPreview,
    garment: &Arc<CompiledGarment>,
    positions: &[glam::DVec3],
    panel: &str,
    pass: u64,
) -> Option<glam::DVec3> {
    if preview.pass != pass || preview.panel != panel || !Arc::ptr_eq(&preview.garment, garment) {
        return None;
    }
    positions
        .get(preview.vertex)
        .copied()
        .filter(|p| p.is_finite())
}

fn project_preview(matrix: glam::Mat4, rect: egui::Rect, point: glam::DVec3) -> Option<egui::Pos2> {
    if !rect.is_positive() || !point.is_finite() || !matrix.is_finite() {
        return None;
    }
    let clip = matrix * point.as_vec3().extend(1.);
    if !clip.is_finite()
        || clip.w <= 0.
        || clip.z < 0.
        || clip.z > clip.w
        || clip.x.abs() > clip.w
        || clip.y.abs() > clip.w
    {
        return None;
    }
    let ndc = clip.truncate() / clip.w;
    Some(egui::pos2(
        rect.center().x + ndc.x * rect.width() * 0.5,
        rect.center().y - ndc.y * rect.height() * 0.5,
    ))
}

/// Retaining an immutable Arc makes identity safe across remeshing and avoids
/// stale address reuse. One context entry bounds retained meshes and memory.
fn nearest_material_cached(
    ctx: &egui::Context,
    garment: &Arc<CompiledGarment>,
    panel: &str,
    requested: DVec2,
) -> Result<(DVec2, f64, usize), String> {
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
    pick_views: (bool, bool),
) -> Option<Action> {
    let mut action = None;
    let section = egui::CollapsingHeader::new("Pin a material position")
        .id_salt(("pin-material", &panel.id))
        .show(ui, |ui| {
            ui.small("Enter a 2D position; the nearest mesh vertex is shown before pinning.");
            let active_pick = ui
                .ctx()
                .data(|data| data.get_temp::<PinPick3d>(pin_pick_id()))
                .filter(|pick| pin_pick_matches(pick, garment, &panel.id));
            if active_pick.as_ref().is_some_and(|pick| if pick.on_board { pick_views.1 } else { pick_views.0 }) && available && !frozen && ui.is_enabled() {
                let pass = ui.ctx().cumulative_pass_nr();
                ui.ctx().data_mut(|data| {
                    if let Some(mut pick) = data.get_temp::<PinPick3d>(pin_pick_id()) {
                        pick.seen_pass = pass;
                        data.insert_temp(pin_pick_id(), pick);
                    }
                });
                let on_board = ui.ctx().data(|data| data.get_temp::<PinPick3d>(pin_pick_id())).is_some_and(|pick| pick.on_board);
                ui.small(if on_board { "Click the active pattern in 2D to choose a vertex · Escape cancels." } else { "Click visible cloth in 3D to choose a vertex · Escape cancels." });
                let cancel = ui.button("Cancel pick");
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(
                    ui,
                    &cancel,
                    "pins.material.pick_cancel",
                );
                if cancel.clicked() {
                    clear_pin_pick(ui.ctx());
                }
            } else {
                let pick = ui.add_enabled(
                    pick_views.0 && available && !frozen,
                    egui::Button::new("Choose on 3D cloth"),
                ).on_disabled_hover_text("Use Edit mode with the 3D view open; pause simulation, unfreeze the panel and finish other edits.");
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &pick, "pins.material.pick_3d");
                if pick.clicked() {
                    let mode = PinPick3d {
                        garment: garment.clone(),
                        panel: panel.id.clone(),
                        seen_pass: ui.ctx().cumulative_pass_nr(),
                        text_focus: false,
                        on_board: false,
                    };
                    ui.ctx()
                        .data_mut(|data| data.insert_temp(pin_pick_id(), mode));
                }
                let pick_2d = ui.add_enabled(pick_views.1 && available && !frozen, egui::Button::new("Choose on 2D pattern"))
                    .on_disabled_hover_text("Use Edit mode with the 2D view open; pause simulation, unfreeze the panel and finish other edits.");
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &pick_2d, "pins.material.pick_2d");
                if pick_2d.clicked() {
                    let mode = PinPick3d { garment: garment.clone(), panel: panel.id.clone(), seen_pass: ui.ctx().cumulative_pass_nr(), text_focus: false, on_board: true };
                    ui.ctx().data_mut(|data| data.insert_temp(pin_pick_id(), mode));
                }
            }
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
                Ok((uv, distance, vertex)) => {
                    if !frozen && ui.is_enabled() {
                        let preview = PinPreview {
                            garment: garment.clone(),
                            panel: panel.id.clone(),
                            vertex,
                            pass: ui.ctx().cumulative_pass_nr(),
                        };
                        ui.ctx()
                            .data_mut(|data| data.insert_temp(pin_preview_id(), preview));
                        ui.small("Markers show the nearest vertex; the 3D marker is X-ray.");
                    }
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
    let pass = ui.ctx().cumulative_pass_nr();
    let text_focus = ui.ctx().egui_wants_keyboard_input();
    ui.ctx().data_mut(|data| {
        if let Some(mut pick) = data.get_temp::<PinPick3d>(pin_pick_id())
            && pick.seen_pass == pass
        {
            pick.text_focus = text_focus;
            data.insert_temp(pin_pick_id(), pick);
        }
    });
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
    pub(super) fn material_pin_pick_active(&mut self, ctx: &egui::Context) -> bool {
        let Some(pick) = ctx.data(|data| data.get_temp::<PinPick3d>(pin_pick_id())) else {
            return false;
        };
        if cancel_pin_pick_for_trim(ctx, &self.authoring.trims) {
            return false;
        }
        let valid = ctx.input(|input| input.focused)
            && self.authoring.tool == super::authoring_ui::Tool::Edit
            && self
                .authoring
                .selected
                .as_deref()
                .is_some_and(|panel| pin_pick_matches(&pick, &self.scene.garment, panel))
            && self.prefs.workspace.inspector_open
            && self.inspector_tab == super::chrome::InspectorTab::Piece
            && !self.clean_view
            && !self.playing
            && !self.pending
            && self.authoring.preview.is_none()
            && self.authoring.board.shape.is_none()
            && self.authoring.board.group_shapes.is_empty()
            && !self.authoring.board.gesture_active()
            && self.authoring.drag.is_none()
            && self.grab.is_none()
            && !self.authoring.radial.blocked
            && !self.quick.blocked
            && ctx.memory(|memory| memory.top_modal_layer().is_none())
            && !self
                .project
                .template
                .frozen_panels
                .iter()
                .any(|f| f.panel == pick.panel);
        let escape = valid && pin_pick_cancel_shortcut(ctx, pick.text_focus);
        if !valid || escape {
            cancel_pin_pick(ctx);
            return false;
        }
        true
    }

    pub(super) fn material_pin_pick_click(&mut self, ui: &egui::Ui) {
        let ctx = ui.ctx();
        let Some(rect) = self.authoring.selection.garment_rect else {
            return;
        };
        let Some(pos) = pin_pick_pointer(ui, rect) else {
            return;
        };
        let Some(pick) = ctx.data(|data| data.get_temp::<PinPick3d>(pin_pick_id())) else {
            return;
        };
        let (origin, direction) = self.camera.ray(pos, rect);
        match stage_material_pick(
            ctx,
            &pick,
            &self.scene.garment,
            &self.scene.state,
            origin,
            direction,
            |origin, direction, distance| {
                self.scene
                    .collider
                    .occludes_ray(origin, direction, distance)
            },
        ) {
            Ok(true) => self.status = "Vertex selected · choose Pin nearest to confirm".into(),
            Ok(false) => self.status = "Choose visible cloth on the active panel".into(),
            Err(error) => {
                self.status = error.clone();
                self.authoring.error = Some(error);
            }
        }
    }

    pub(super) fn material_pin_pick_on_board(&self, ctx: &egui::Context) -> bool {
        ctx.data(|data| {
            data.get_temp::<PinPick3d>(pin_pick_id())
                .is_some_and(|pick| pick.on_board)
        })
    }

    pub(super) fn material_pin_pick_board_click(&mut self, ui: &egui::Ui) {
        let ctx = ui.ctx();
        let Some(rect) = self.authoring.selection.board_rect else {
            return;
        };
        let Some(pos) = pin_pick_pointer(ui, rect) else {
            return;
        };
        let Some(pick) = ctx.data(|data| data.get_temp::<PinPick3d>(pin_pick_id())) else {
            return;
        };
        let world = self.authoring.board.world(rect, pos);
        let owner = super::board::panel_body_owner(
            self.project
                .template
                .panels
                .iter()
                .enumerate()
                .rev()
                .map(|(i, p)| {
                    (
                        p,
                        p.polygon.as_ref(),
                        self.board_origin(i),
                        self.board_angle(i),
                    )
                }),
            world,
        );
        let Some(index) = self
            .project
            .template
            .panels
            .iter()
            .position(|p| p.id == pick.panel)
        else {
            return;
        };
        match stage_board_material_pick(
            ctx,
            &pick,
            &self.scene.garment,
            owner,
            world,
            self.board_origin(index),
            self.board_angle(index),
        ) {
            Ok(true) => {
                self.status = "Vertex selected · choose Pin nearest to confirm".into();
            }
            Ok(false) => self.status = "Choose the visible active pattern".into(),
            Err(error) => {
                self.status = error.clone();
                self.authoring.error = Some(error);
            }
        }
    }

    pub(super) fn finish_material_pin_pick(&mut self, ctx: &egui::Context) {
        if let Some(pick) = ctx.data(|data| data.get_temp::<PinPick3d>(pin_pick_id()))
            && !pin_pick_seen(
                &pick,
                ctx.cumulative_pass_nr(),
                if pick.on_board {
                    self.authoring.selection.board_rect.is_some()
                } else {
                    self.authoring.selection.garment_rect.is_some()
                },
            )
        {
            cancel_pin_pick(ctx);
        }
    }

    pub(super) fn paint_material_pin_preview(&self, ui: &egui::Ui) {
        if self.clean_view
            || self.playing
            || self.pending
            || self.authoring.preview.is_some()
            || self.authoring.board.shape.is_some()
            || !self.authoring.board.group_shapes.is_empty()
        {
            return;
        }
        let (Some(panel), Some(preview)) = (
            self.authoring.selected.as_deref(),
            ui.ctx()
                .data(|data| data.get_temp::<PinPreview>(pin_preview_id())),
        ) else {
            return;
        };
        if preview.pass == ui.ctx().cumulative_pass_nr()
            && preview.panel == panel
            && Arc::ptr_eq(&preview.garment, &self.scene.garment)
            && let (Some(board_rect), Some(uv), Some(index)) = (
                self.authoring.selection.board_rect,
                self.scene.garment.mesh.uv.get(preview.vertex),
                self.project
                    .template
                    .panels
                    .iter()
                    .position(|p| p.id == panel),
            )
        {
            let world =
                self.board_origin(index) + authoring::rotate_2d(*uv, self.board_angle(index));
            let point = self.authoring.board.screen(board_rect, world);
            ui.painter().with_clip_rect(board_rect).circle_stroke(
                point,
                7.,
                egui::Stroke::new(2., egui::Color32::from_rgb(255, 199, 65)),
            );
        }
        let Some(rect) = self.authoring.selection.garment_rect else {
            return;
        };
        let Some(world) = preview_world(
            &preview,
            &self.scene.garment,
            &self.scene.state.x,
            panel,
            ui.ctx().cumulative_pass_nr(),
        ) else {
            return;
        };
        let Some(point) = project_preview(
            self.camera.matrix(rect.width() / rect.height()),
            rect,
            world,
        ) else {
            return;
        };
        let painter = ui.painter().with_clip_rect(rect);
        let color = egui::Color32::from_rgb(255, 199, 65);
        painter.circle_stroke(point, 7., egui::Stroke::new(2., color));
        painter.line_segment(
            [point + egui::vec2(-10., 0.), point + egui::vec2(10., 0.)],
            egui::Stroke::new(1., color),
        );
        painter.line_segment(
            [point + egui::vec2(0., -10.), point + egui::vec2(0., 10.)],
            egui::Stroke::new(1., color),
        );
    }

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
        let can_pick = self.authoring.tool == super::authoring_ui::Tool::Edit
            && !self.clean_view
            && !self.authoring.board.gesture_active()
            && !self.authoring.trims.has_pending_history_step()
            && self.authoring.drag.is_none()
            && self.grab.is_none();
        let material = material_pin_controls(
            ui,
            &self.scene.garment,
            &self.project.template,
            panel,
            available,
            frozen,
            (
                can_pick && self.authoring.selection.garment_rect.is_some(),
                can_pick && self.authoring.selection.board_rect.is_some(),
            ),
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

    #[test]
    fn board_pick_inverts_panel_layout_and_rejects_other_owner() {
        let c = case();
        let panel = &c.template.panels[0].id;
        let uv = c.garment.mesh.uv[0] + DVec2::new(0.01, 0.02);
        let origin = DVec2::new(4., -3.);
        let angle = 37.;
        let world = origin + authoring::rotate_2d(uv, angle);
        let picked = board_material_point(&c.garment, panel, Some(panel), world, origin, angle)
            .unwrap()
            .unwrap();
        assert!(picked.distance(uv) < 1e-12);
        assert_eq!(
            board_material_point(&c.garment, panel, Some("other"), world, origin, angle).unwrap(),
            None
        );
        assert!(
            board_material_point(
                &c.garment,
                panel,
                Some(panel),
                DVec2::splat(f64::NAN),
                origin,
                angle
            )
            .is_err()
        );
    }

    #[test]
    fn board_staging_rejects_stale_mesh_and_wrong_mode() {
        let c = case();
        let garment = Arc::new(c.garment);
        let panel = c.template.panels[0].id.clone();
        let mut pick = PinPick3d {
            garment: garment.clone(),
            panel: panel.clone(),
            seen_pass: 0,
            text_focus: false,
            on_board: false,
        };
        let ctx = egui::Context::default();
        let uv = garment.mesh.uv[0];
        assert!(
            stage_board_material_pick(&ctx, &pick, &garment, Some(&panel), uv, DVec2::ZERO, 0.)
                .is_err()
        );
        pick.on_board = true;
        let remeshed = Arc::new(garment.as_ref().clone());
        assert!(
            stage_board_material_pick(&ctx, &pick, &remeshed, Some(&panel), uv, DVec2::ZERO, 0.)
                .is_err()
        );
        let id = egui::Id::new(("pin-material-position", &panel));
        assert!(ctx.data(|data| data.get_temp::<[f64; 2]>(id)).is_none());
    }

    #[test]
    fn pick_material_surface_selects_visible_owned_vertex_and_rejects_occlusion() {
        let c = case();
        let g = &c.garment;
        let panel = &g.panels[0];
        let triangle = &g.mesh.triangles[panel.triangles.start];
        let p = triangle.vertices.map(|i| c.state.x[i]);
        let center = (p[0] + p[1] + p[2]) / 3.;
        let normal = (p[1] - p[0]).cross(p[2] - p[0]).normalize();
        let origin = center + normal;
        let ray = -normal;
        let centroid = triangle
            .vertices
            .into_iter()
            .map(|i| g.mesh.uv[i] / 3.)
            .sum::<DVec2>();
        let expected = nearest_material_vertex(g, &panel.id, centroid).unwrap().0;
        assert_eq!(
            pick_material_surface(g, &c.state, &panel.id, origin, ray, |_, _, _| false).unwrap(),
            Some(expected)
        );
        assert_eq!(
            pick_material_surface(g, &c.state, &panel.id, origin, ray, |_, _, _| true).unwrap(),
            None
        );
        assert_eq!(
            pick_material_surface(g, &c.state, &g.panels[1].id, origin, ray, |_, _, _| false)
                .unwrap(),
            None
        );
        assert_eq!(
            pick_material_surface(g, &c.state, &panel.id, origin, normal, |_, _, _| false).unwrap(),
            None
        );
        assert!(
            pick_material_surface(
                g,
                &c.state,
                &panel.id,
                origin,
                glam::DVec3::ZERO,
                |_, _, _| false
            )
            .is_err()
        );
        let mut invalid = g.clone();
        invalid.mesh.triangles[0].vertices[0] = c.state.x.len();
        assert!(
            pick_material_surface(&invalid, &c.state, &panel.id, origin, ray, |_, _, _| false)
                .is_err()
        );
        let mut oversized = g.clone();
        oversized.mesh.triangles.resize(100_001, triangle.clone());
        assert!(
            pick_material_surface(&oversized, &c.state, &panel.id, origin, ray, |_, _, _| {
                false
            })
            .is_err()
        );
    }

    #[test]
    fn named_pick_mode_starts_and_cancels_without_editing_document() {
        struct PickCase {
            template: GarmentTemplate,
            garment: Arc<CompiledGarment>,
            available: bool,
            can_pick: bool,
        }
        let c = case();
        let mut c = PickCase {
            template: c.template,
            garment: Arc::new(c.garment),
            available: true,
            can_pick: false,
        };
        let before = serde_json::to_vec(&c.template).unwrap();
        let mut draw = |ui: &mut egui::Ui, c: &mut PickCase| {
            let panel = &c.template.panels[0];
            assert!(
                material_pin_controls(
                    ui,
                    &c.garment,
                    &c.template,
                    panel,
                    c.available,
                    false,
                    (c.can_pick, c.can_pick)
                )
                .is_none()
            );
        };
        let mut h = Harness::new(egui::vec2(600., 500.));
        h.frame(&mut c, &mut draw);
        h.click("pins.material", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.material.pick_3d", &mut c, &mut draw).is_err());
        c.can_pick = true;
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_3d", &mut c, &mut draw).unwrap();
        let pick = h
            .ctx
            .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
            .unwrap();
        assert_eq!(pick.panel, c.template.panels[0].id);
        assert!(Arc::ptr_eq(&pick.garment, &c.garment));
        assert!(pin_pick_matches(
            &pick,
            &c.garment,
            &c.template.panels[0].id
        ));
        assert!(!pin_pick_matches(
            &pick,
            &c.garment,
            &c.template.panels[1].id
        ));
        assert!(!pin_pick_matches(
            &pick,
            &Arc::new(c.garment.as_ref().clone()),
            &pick.panel
        ));
        assert!(pin_pick_seen(&pick, pick.seen_pass, true));
        assert!(!pin_pick_seen(&pick, pick.seen_pass + 1, true));
        assert!(!pin_pick_seen(&pick, pick.seen_pass, false));
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_cancel", &mut c, &mut draw)
            .unwrap();
        assert!(
            h.ctx
                .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                .is_none()
        );
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_2d", &mut c, &mut draw).unwrap();
        assert!(
            h.ctx
                .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                .unwrap()
                .on_board
        );
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_cancel", &mut c, &mut draw)
            .unwrap();
        assert!(
            h.ctx
                .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                .is_none()
        );
        assert_eq!(serde_json::to_vec(&c.template).unwrap(), before);
    }

    #[test]
    fn named_pin_picker_availability_follows_each_visible_view() {
        struct Views {
            template: GarmentTemplate,
            garment: Arc<CompiledGarment>,
            views: (bool, bool),
        }
        let source = case();
        let mut c = Views {
            template: source.template,
            garment: Arc::new(source.garment),
            views: (false, true),
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Views| {
            material_pin_controls(
                ui,
                &c.garment,
                &c.template,
                &c.template.panels[0],
                true,
                false,
                c.views,
            );
        };
        let mut h = Harness::new(egui::vec2(600., 500.));
        h.frame(&mut c, &mut draw);
        h.click("pins.material", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.material.pick_3d", &mut c, &mut draw).is_err());
        h.click("pins.material.pick_2d", &mut c, &mut draw).unwrap();
        let pick = h
            .ctx
            .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
            .unwrap();
        assert!(pick.on_board);
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_cancel", &mut c, &mut draw)
            .unwrap();
        c.views = (true, false);
        h.frame(&mut c, &mut draw);
        assert!(h.click("pins.material.pick_2d", &mut c, &mut draw).is_err());
        h.click("pins.material.pick_3d", &mut c, &mut draw).unwrap();
        let pick = h
            .ctx
            .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
            .unwrap();
        assert!(!pick.on_board);
        assert!(!pin_pick_seen(&pick, pick.seen_pass, false));
    }

    #[test]
    fn real_trim_and_pin_controls_exclude_pending_gestures_in_both_orders() {
        struct Flow {
            template: GarmentTemplate,
            garment: Arc<CompiledGarment>,
            trims: super::super::trims_ui::TrimUi,
        }
        let c = case();
        let mut c = Flow {
            template: c.template,
            garment: Arc::new(c.garment),
            trims: Default::default(),
        };
        c.template
            .trims
            .push(marvelous_cloth::garment::trims::Trim {
                id: "trim_1".into(),
                panel_id: c.template.panels[0].id.clone(),
                kind: marvelous_cloth::garment::trims::TrimKind::Button {
                    center_m: DVec2::new(0.1, 0.1),
                    diameter_m: 0.01,
                },
            });
        let original = serde_json::to_vec(&c.template).unwrap();
        let mut draw = |ui: &mut egui::Ui, c: &mut Flow| {
            // The viewport guard runs before the inspectors in production.
            cancel_pin_pick_for_trim(ui.ctx(), &c.trims);
            let panel = c.template.panels[0].clone();
            let can_pick = !c.trims.has_pending_history_step();
            assert!(
                material_pin_controls(
                    ui,
                    &c.garment,
                    &c.template,
                    &panel,
                    true,
                    false,
                    (can_pick, can_pick)
                )
                .is_none()
            );
            assert!(
                super::super::trims_ui::trim_controls(ui, &mut c.trims, &c.template, &panel, true)
                    .is_none()
            );
        };
        let mut h = Harness::new(egui::vec2(1200., 1100.));
        h.frame(&mut c, &mut draw);
        h.click("pins.material", &mut c, &mut draw).unwrap();
        h.click("trim.section", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_3d", &mut c, &mut draw).unwrap();
        assert!(
            h.ctx
                .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                .is_some()
        );
        h.frame(&mut c, &mut draw);
        h.click("trim.new", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert!(
            h.ctx
                .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                .is_none()
        );
        assert!(c.trims.has_pending_history_step());
        assert!(h.click("pins.material.pick_3d", &mut c, &mut draw).is_err());
        h.click("trim.cancel", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("trim.edit.trim_1", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("trim.place_3d", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert!(c.trims.has_pending_history_step());
        assert!(h.click("pins.material.pick_3d", &mut c, &mut draw).is_err());
        c.trims.cancel_board_placement();
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_3d", &mut c, &mut draw).unwrap();
        assert!(
            h.ctx
                .data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                .is_some()
        );
        assert_eq!(serde_json::to_vec(&c.template).unwrap(), original);
    }

    #[test]
    fn named_3d_pick_stages_then_confirms_one_interior_pin() {
        use super::super::authoring_smoke::widget_harness::named;
        struct Flow {
            template: GarmentTemplate,
            garment: Arc<CompiledGarment>,
            state: State,
            history: authoring::History,
            camera: crate::render::Camera,
            staged: bool,
        }
        let source = case();
        let center = source.garment.panels[0].vertices.start + 4;
        let target_uv = source.garment.mesh.uv[center];
        let target_world = source.state.x[center];
        let camera = crate::render::Camera::new(0., 0., 2., target_world.as_vec3());
        let mut c = Flow {
            template: source.template,
            garment: Arc::new(source.garment),
            state: source.state,
            history: Default::default(),
            camera,
            staged: false,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Flow| {
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(300., 200.), egui::Sense::click_and_drag());
            named(ui, &response, "pins.pick.canvas");
            if let Some(pick) = ui.ctx().data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                && let Some(pos) = pin_pick_pointer(ui, rect)
            {
                let (origin, direction) = c.camera.ray(pos, rect);
                c.staged = stage_material_pick(
                    ui.ctx(),
                    &pick,
                    &c.garment,
                    &c.state,
                    origin,
                    direction,
                    |_, _, _| false,
                )
                .unwrap();
            }
            let panel = c.template.panels[0].clone();
            if let Some(action) = material_pin_controls(
                ui,
                &c.garment,
                &c.template,
                &panel,
                true,
                false,
                (true, true),
            ) {
                let edit = prepare(
                    &c.template,
                    &c.garment,
                    &c.state,
                    None,
                    (
                        &panel.id,
                        &BTreeMap::new(),
                        std::slice::from_ref(&panel.id),
                        action,
                    ),
                )
                .unwrap();
                c.state = edit.state_after(&c.garment, &c.state);
                c.history.record(c.template.clone());
                c.template = edit.template;
                c.garment = Arc::new(edit.garment);
            }
        };
        let mut h = Harness::new(egui::vec2(800., 800.));
        h.frame(&mut c, &mut draw);
        h.click("pins.material", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_3d", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("pins.pick.canvas", &mut c, &mut draw).unwrap();
        assert!(c.staged);
        assert!(c.template.pin_targets.is_empty() && !c.history.can_undo());
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pin", &mut c, &mut draw).unwrap();
        assert_eq!(c.template.pin_targets.len(), 1);
        assert_eq!(c.template.pin_targets[0].uv, target_uv);
        assert_eq!(c.template.pin_targets[0].world, target_world);
        assert!(c.history.can_undo());
        let undo = c.history.restore(&c.template, false).unwrap();
        assert!(undo.template.pin_targets.is_empty());
    }

    #[test]
    fn named_2d_pick_respects_overlap_and_confirms_one_pin() {
        use super::super::authoring_smoke::widget_harness::named;
        struct Flow {
            template: GarmentTemplate,
            garment: Arc<CompiledGarment>,
            state: State,
            history: authoring::History,
            board: super::super::board::Board,
            staged: bool,
        }
        let source = case();
        let mut template = source.template;
        let origin = DVec2::new(0.7, -0.3);
        let angle = 37.;
        for panel in &mut template.panels {
            panel.layout_2d = Some(origin);
            panel.layout_rotation_degrees = angle;
        }
        let uv = DVec2::new(
            template.panels[0].pattern.width * 0.5,
            template.panels[0].pattern.height * 0.5,
        );
        let mut board = super::super::board::Board::default();
        board.center = origin + authoring::rotate_2d(uv, angle);
        board.view_rotation = 0.7;
        let mut c = Flow {
            template,
            garment: Arc::new(source.garment),
            state: source.state,
            history: Default::default(),
            board,
            staged: false,
        };
        let expected = nearest_material_vertex(&c.garment, &c.template.panels[0].id, uv)
            .unwrap()
            .0;
        let before = serde_json::to_vec(&c.template).unwrap();
        let mut draw = |ui: &mut egui::Ui, c: &mut Flow| {
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(300., 200.), egui::Sense::click_and_drag());
            named(ui, &response, "pins.pick.board");
            if let Some(pick) = ui.ctx().data(|d| d.get_temp::<PinPick3d>(pin_pick_id()))
                && let Some(pos) = pin_pick_pointer(ui, rect)
            {
                let world = c.board.world(rect, pos);
                let owner = super::super::board::panel_body_owner(
                    c.template.panels.iter().enumerate().rev().map(|(i, p)| {
                        (
                            p,
                            p.polygon.as_ref(),
                            authoring::layout(&c.template, i),
                            p.layout_rotation_degrees,
                        )
                    }),
                    world,
                );
                c.staged = stage_board_material_pick(
                    ui.ctx(),
                    &pick,
                    &c.garment,
                    owner,
                    world,
                    authoring::layout(&c.template, 0),
                    c.template.panels[0].layout_rotation_degrees,
                )
                .unwrap();
            }
            let panel = c.template.panels[0].clone();
            if let Some(action) = material_pin_controls(
                ui,
                &c.garment,
                &c.template,
                &panel,
                true,
                false,
                (true, true),
            ) {
                let edit = prepare(
                    &c.template,
                    &c.garment,
                    &c.state,
                    None,
                    (
                        &panel.id,
                        &BTreeMap::new(),
                        std::slice::from_ref(&panel.id),
                        action,
                    ),
                )
                .unwrap();
                c.state = edit.state_after(&c.garment, &c.state);
                c.history.record(c.template.clone());
                c.template = edit.template;
                c.garment = Arc::new(edit.garment);
            }
        };
        let mut h = Harness::new(egui::vec2(800., 800.));
        h.frame(&mut c, &mut draw);
        h.click("pins.material", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pick_2d", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("pins.pick.board", &mut c, &mut draw).unwrap();
        assert!(!c.staged, "the other visible panel must own the click");
        assert_eq!(serde_json::to_vec(&c.template).unwrap(), before);
        assert!(!c.history.can_undo());
        c.template.panels[1].layout_2d = Some(DVec2::splat(20.));
        h.frame(&mut c, &mut draw);
        h.click("pins.pick.board", &mut c, &mut draw).unwrap();
        assert!(c.staged);
        assert!(c.template.pin_targets.is_empty() && !c.history.can_undo());
        h.frame(&mut c, &mut draw);
        h.click("pins.material.pin", &mut c, &mut draw).unwrap();
        assert_eq!(c.template.pin_targets.len(), 1);
        assert_eq!(c.template.pin_targets[0].uv, expected);
        assert!(c.history.can_undo());
        assert!(
            c.history
                .restore(&c.template, false)
                .unwrap()
                .template
                .pin_targets
                .is_empty()
        );
    }

    #[test]
    fn pin_pick_pointer_requires_click_inside_unobscured_viewport() {
        use super::super::authoring_smoke::widget_harness::named;
        let mut h = Harness::new(egui::vec2(500., 400.));
        let mut picked = Vec::new();
        let mut draw = |ui: &mut egui::Ui, picked: &mut Vec<egui::Pos2>| {
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(250., 200.), egui::Sense::click_and_drag());
            named(ui, &response, "pin.canvas");
            if let Some(pos) = pin_pick_pointer(ui, rect) {
                picked.push(pos);
            }
        };
        h.frame(&mut picked, &mut draw);
        h.click("pin.canvas", &mut picked, &mut draw).unwrap();
        assert_eq!(picked.len(), 1);
        h.drag("pin.canvas", egui::vec2(30., 0.), 4, &mut picked, &mut draw)
            .unwrap();
        assert_eq!(picked.len(), 1);
    }

    #[test]
    fn cancelled_pick_shields_the_in_flight_pointer_release() {
        use super::super::authoring_smoke::widget_harness::named;
        struct ShieldCase {
            cancelled: bool,
            leaked: usize,
        }
        let mut case = ShieldCase {
            cancelled: false,
            leaked: 0,
        };
        let mut h = Harness::new(egui::vec2(500., 400.));
        let mut draw = |ui: &mut egui::Ui, case: &mut ShieldCase| {
            let response = ui.add_sized([200., 120.], egui::Button::new("Viewport"));
            named(ui, &response, "pin.shield.canvas");
            if !case.cancelled && ui.input(|input| input.pointer.primary_pressed()) {
                cancel_pin_pick(ui.ctx());
                case.cancelled = true;
            }
            if !pin_pick_shield(ui.ctx()) && response.clicked() {
                case.leaked += 1;
            }
        };
        h.frame(&mut case, &mut draw);
        h.click("pin.shield.canvas", &mut case, &mut draw).unwrap();
        assert!(case.cancelled);
        assert_eq!(case.leaked, 0);
        h.frame(&mut case, &mut draw);
        h.click("pin.shield.canvas", &mut case, &mut draw).unwrap();
        assert_eq!(case.leaked, 1);
    }

    #[test]
    fn pin_pick_escape_respects_text_focus_and_consumes_unfocused_key() {
        use super::super::authoring_smoke::widget_harness::named;
        struct EscapeCase {
            text: String,
            cancels: usize,
            previous_focus: bool,
        }
        let mut c = EscapeCase {
            text: "edit".into(),
            cancels: 0,
            previous_focus: false,
        };
        let mut h = Harness::new(egui::vec2(500., 400.));
        let mut draw = |ui: &mut egui::Ui, c: &mut EscapeCase| {
            if pin_pick_cancel_shortcut(ui.ctx(), c.previous_focus) {
                c.cancels += 1;
            }
            let response = ui.text_edit_singleline(&mut c.text);
            named(ui, &response, "pin.text");
            c.previous_focus = ui.ctx().egui_wants_keyboard_input();
        };
        h.frame(&mut c, &mut draw);
        h.click("pin.text", &mut c, &mut draw).unwrap();
        h.key(
            "pin.text",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.cancels, 0);
        h.ctx.memory_mut(|memory| {
            if let Some(focus) = memory.focused() {
                memory.surrender_focus(focus);
            }
        });
        c.previous_focus = false;
        let mut output = h.ctx.run_ui(
            egui::RawInput {
                focused: true,
                events: vec![egui::Event::Key {
                    key: egui::Key::Escape,
                    physical_key: None,
                    pressed: true,
                    repeat: false,
                    modifiers: egui::Modifiers::NONE,
                }],
                ..Default::default()
            },
            |ui| {
                egui::CentralPanel::default().show(ui, |ui| draw(ui, &mut c));
            },
        );
        output.textures_delta.clear();
        assert_eq!(c.cancels, 1);
    }

    #[test]
    fn pin_pick_pointer_does_not_click_through_foreground_panel() {
        use super::super::authoring_smoke::widget_harness::named;
        let mut h = Harness::new(egui::vec2(500., 400.));
        let mut picked = Vec::new();
        let mut draw = |ui: &mut egui::Ui, picked: &mut Vec<egui::Pos2>| {
            let (rect, _) =
                ui.allocate_exact_size(egui::vec2(250., 200.), egui::Sense::click_and_drag());
            if let Some(pos) = pin_pick_pointer(ui, rect) {
                picked.push(pos);
            }
            egui::Area::new(egui::Id::new("pin-test-overlay"))
                .order(egui::Order::Foreground)
                .fixed_pos(egui::pos2(50., 50.))
                .show(ui.ctx(), |ui| {
                    let response = ui.add_sized([100., 60.], egui::Button::new("Overlay"));
                    named(ui, &response, "pin.overlay");
                });
        };
        for _ in 0..3 {
            h.frame(&mut picked, &mut draw);
        }
        h.click("pin.overlay", &mut picked, &mut draw).unwrap();
        assert!(picked.is_empty());
    }

    #[test]
    fn pin_preview_tracks_current_mesh_and_rejects_stale_or_offscreen_points() {
        let c = case();
        let garment = Arc::new(c.garment.clone());
        let panel = &c.template.panels[0].id;
        let requested = DVec2::new(
            c.template.panels[0].pattern.width,
            c.template.panels[0].pattern.height,
        ) * 0.5;
        let (uv, _, vertex) = nearest_material_vertex(&garment, panel, requested).unwrap();
        assert_eq!(garment.mesh.uv[vertex], uv);
        let preview = PinPreview {
            garment: garment.clone(),
            panel: panel.clone(),
            vertex,
            pass: 12,
        };
        assert_eq!(
            preview_world(&preview, &garment, &c.state.x, panel, 12),
            Some(c.state.x[vertex])
        );
        let mut moved = c.state.x.clone();
        moved[vertex] += glam::DVec3::X;
        assert_eq!(
            preview_world(&preview, &garment, &moved, panel, 12),
            Some(moved[vertex])
        );
        assert!(preview_world(&preview, &garment, &moved, panel, 13).is_none());
        assert!(preview_world(&preview, &garment, &moved, "other", 12).is_none());
        assert!(preview_world(&preview, &Arc::new(c.garment.clone()), &moved, panel, 12).is_none());
        assert!(preview_world(&preview, &garment, &[], panel, 12).is_none());

        let rect = egui::Rect::from_min_size(egui::pos2(20., 30.), egui::vec2(200., 100.));
        assert_eq!(
            project_preview(glam::Mat4::IDENTITY, rect, glam::DVec3::new(0., 0., 0.5)),
            Some(rect.center())
        );
        assert!(
            project_preview(glam::Mat4::IDENTITY, rect, glam::DVec3::new(0., 0., -0.1)).is_none()
        );
        assert!(
            project_preview(glam::Mat4::IDENTITY, rect, glam::DVec3::new(2., 0., 0.5)).is_none()
        );
        assert!(
            project_preview(glam::Mat4::IDENTITY, rect, glam::DVec3::splat(f64::NAN)).is_none()
        );
    }

    #[test]
    fn pin_preview_is_emitted_only_for_open_available_inspector() {
        struct PreviewCase {
            template: GarmentTemplate,
            garment: Arc<CompiledGarment>,
            available: bool,
            frozen: bool,
            present: bool,
        }
        let c = case();
        let mut c = PreviewCase {
            template: c.template,
            garment: Arc::new(c.garment),
            available: true,
            frozen: false,
            present: false,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut PreviewCase| {
            let panel = &c.template.panels[0];
            material_pin_controls(
                ui,
                &c.garment,
                &c.template,
                panel,
                c.available,
                c.frozen,
                (true, true),
            );
            c.present = ui
                .ctx()
                .data(|data| data.get_temp::<PinPreview>(pin_preview_id()))
                .is_some_and(|preview| preview.pass == ui.ctx().cumulative_pass_nr());
        };
        let mut harness = Harness::new(egui::vec2(600., 500.));
        harness.frame(&mut c, &mut draw);
        assert!(!c.present);
        harness.click("pins.material", &mut c, &mut draw).unwrap();
        harness.frame(&mut c, &mut draw);
        assert!(c.present);
        c.available = false;
        harness.frame(&mut c, &mut draw);
        assert!(!c.present);
        c.available = true;
        harness.frame(&mut c, &mut draw);
        assert!(c.present);
        c.frozen = true;
        harness.frame(&mut c, &mut draw);
        assert!(!c.present);
        c.frozen = false;
        harness.frame(&mut c, &mut draw);
        assert!(c.present);
        harness.click("pins.material", &mut c, &mut draw).unwrap();
        harness.frame(&mut c, &mut draw);
        assert!(!c.present);
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
            (true, true),
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
