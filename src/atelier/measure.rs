//! Boundary-attached ruler and saved, editable material-space measurements.
use super::*;
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        polygon::{MeasurementAnchor, PatternMeasurement, PolygonPattern},
        template::Panel,
    },
};

#[derive(Clone)]
struct Draft {
    value: PatternMeasurement,
    base: Option<PatternMeasurement>,
    topology: Vec<String>,
    geometry: Option<PolygonPattern>,
}
impl Draft {
    fn valid_for(&self, polygon: &PolygonPattern) -> bool {
        if self.topology != names(polygon)
            || self
                .geometry
                .as_ref()
                .is_some_and(|old| geometry(old) != geometry(polygon))
        {
            return false;
        }
        if let Some(base) = &self.base {
            polygon.measurements.iter().find(|m| m.id == base.id) == Some(base)
        } else {
            self.topology == names(polygon)
                && !polygon.measurements.iter().any(|m| m.id == self.value.id)
        }
    }
}

#[derive(Clone)]
enum Transition {
    Panel(String),
    Select(String, PatternMeasurement),
    New(String),
}

#[derive(Clone, Default)]
pub(super) struct Tape {
    start: Option<DVec2>,
    end: Option<DVec2>,
    panel: Option<String>,
    first: Option<MeasurementAnchor>,
    draft: Option<Draft>,
    selected: Option<String>,
    force_pick: bool,
    drag_endpoint: Option<usize>,
    error: Option<String>,
    transition: Option<Transition>,
}
impl Tape {
    pub(super) fn has_changes(&self) -> bool {
        self.first.is_some()
            || self
                .draft
                .as_ref()
                .is_some_and(|d| d.base.as_ref() != Some(&d.value))
    }
    pub(super) fn document_command(
        &self,
        template: &marvelous_cloth::garment::GarmentTemplate,
    ) -> Result<Option<Command>, String> {
        if !self.has_changes() {
            return Ok(None);
        }
        let owner = self.panel.as_ref().ok_or("Measurement has no panel")?;
        let draft = self
            .draft
            .as_ref()
            .ok_or("Finish the measurement's second endpoint or discard the draft before saving")?;
        let polygon = template
            .panels
            .iter()
            .find(|p| &p.id == owner)
            .and_then(|p| p.polygon.as_ref())
            .ok_or("Measurement's panel is missing")?;
        if !draft.valid_for(polygon) {
            return Err(
                "Measurement draft is stale; restore its geometry or discard it before saving"
                    .into(),
            );
        }
        let mut records = polygon.measurements.clone();
        if let Some(record) = records.iter_mut().find(|m| m.id == draft.value.id) {
            *record = draft.value.clone();
        } else {
            records.push(draft.value.clone());
        }
        polygon.validate_measurement_records(&records)?;
        Ok(Some(Command::SetMeasurement {
            panel: owner.clone(),
            measurement: draft.value.clone(),
        }))
    }
    pub(super) fn document_committed(&mut self) {
        let id = self.draft.as_ref().map(|d| d.value.id.clone());
        self.committed(id);
    }
    pub(super) fn discard(&mut self) {
        *self = Self::default();
    }
    fn request(&mut self, transition: Transition) -> bool {
        if self.has_changes() {
            if self.transition.is_none() {
                self.transition = Some(transition);
            }
            false
        } else {
            self.transition = Some(transition);
            self.finish_transition();
            true
        }
    }
    fn finish_transition(&mut self) {
        match self.transition.take() {
            Some(Transition::Panel(panel)) => {
                *self = Self {
                    panel: Some(panel),
                    ..Default::default()
                }
            }
            Some(Transition::New(panel)) => {
                *self = Self {
                    panel: Some(panel),
                    force_pick: true,
                    ..Default::default()
                }
            }
            Some(Transition::Select(panel, value)) => {
                *self = Self {
                    panel: Some(panel.clone()),
                    ..Default::default()
                };
                self.select(&panel, &value);
            }
            None => {}
        }
    }
    fn committed(&mut self, id: Option<String>) {
        self.draft = None;
        self.first = None;
        self.selected = id;
        self.finish_transition();
    }
    /// Preflight the draft and the saved geometry together before adding history
    /// or installing either side of a linked edit.
    pub(super) fn prepare_edit(
        &self,
        template: &marvelous_cloth::garment::GarmentTemplate,
        command: Command,
    ) -> Result<(authoring::Edit, Self), String> {
        let mut tape = self.clone();
        if let Some(draft) = &self.draft
            && self.has_changes()
            && let Some(polygon) = template
                .panels
                .iter()
                .find(|p| Some(&p.id) == self.panel.as_ref())
                .and_then(|p| p.polygon.as_ref())
            && !draft.valid_for(polygon)
        {
            return Err(
                "Measurement draft is stale; restore its geometry or discard it before editing"
                    .into(),
            );
        }
        if matches!(
            command,
            Command::SetMeasurement { .. } | Command::RemoveMeasurement { .. }
        ) || !self.has_changes()
        {
            return Ok((authoring::apply(template, command)?, tape));
        }
        let panel = self
            .panel
            .as_deref()
            .ok_or("Active measurement has no panel")?;
        let polygon = template
            .panels
            .iter()
            .find(|p| p.id == panel)
            .and_then(|p| p.polygon.as_ref())
            .ok_or("Active measurement's panel is missing")?;
        if self.draft.as_ref().is_some_and(|d| !d.valid_for(polygon)) {
            return Err("Measurement draft is stale; save or discard it before editing".into());
        }
        let value = self
            .draft
            .as_ref()
            .map(|d| d.value.clone())
            .or_else(|| {
                self.first.as_ref().map(|a| PatternMeasurement {
                    id: "first_anchor".into(),
                    label: "First anchor".into(),
                    a: a.clone(),
                    b: a.clone(),
                })
            })
            .ok_or("Measurement draft is missing")?;
        let (edit, migrated) =
            authoring::apply_with_measurement_draft(template, command, panel, &value)?;
        let polygon = edit
            .template
            .panels
            .iter()
            .find(|p| p.id == panel)
            .and_then(|p| p.polygon.as_ref())
            .ok_or("Edit would remove the active measurement")?;
        if let Some(draft) = &mut tape.draft {
            draft.value = migrated;
            if let Some(base) = &mut draft.base {
                *base = polygon
                    .measurements
                    .iter()
                    .find(|m| m.id == base.id)
                    .cloned()
                    .ok_or("Edit would remove the selected saved measurement")?;
            }
            draft.topology = names(polygon);
            draft.geometry = Some(polygon.clone());
        } else {
            tape.first = Some(migrated.a);
        }
        Ok((edit, tape))
    }
    /// A completed attached draft remains editable while switching to Edit to
    /// move the piece. Only unfinished/free ruler gestures are tool-local.
    pub(super) fn cancel_incomplete(&mut self) {
        if self.draft.is_none() {
            *self = Self::default();
        }
        self.drag_endpoint = None;
    }
    fn click(&mut self, point: DVec2) {
        if self.start.is_none() || self.end.is_some() {
            self.start = Some(point);
            self.end = None;
        } else {
            self.end = Some(point);
        }
    }
    pub(super) fn segment(&self, hover: Option<DVec2>) -> Option<[DVec2; 2]> {
        Some([self.start?, self.end.or(hover)?])
    }
    fn panel(&mut self, panel: &str) {
        if self.panel.as_deref().is_some_and(|old| old != panel)
            && !self.request(Transition::Panel(panel.into()))
        {
            return;
        }
        self.panel = Some(panel.into());
    }
    fn select(&mut self, panel: &str, value: &PatternMeasurement) {
        self.panel(panel);
        self.selected = Some(value.id.clone());
        self.first = None;
        self.start = None;
        self.end = None;
        self.force_pick = false;
        self.error = None;
        self.draft = Some(Draft {
            value: value.clone(),
            base: Some(value.clone()),
            topology: Vec::new(),
            geometry: None,
        });
    }
    fn attach(&mut self, panel: &str, anchor: MeasurementAnchor, polygon: &PolygonPattern) {
        if self.draft.is_some() && self.has_changes() {
            self.request(Transition::New(panel.into()));
            return;
        }
        self.panel(panel);
        self.error = None;
        self.start = None;
        self.end = None;
        if let Some(first) = self.first.take() {
            let serial = (1..=polygon.measurements.len() + 1)
                .find(|i| {
                    !polygon
                        .measurements
                        .iter()
                        .any(|m| m.id == format!("measurement_{i}"))
                })
                .unwrap();
            self.draft = Some(Draft {
                value: PatternMeasurement {
                    id: format!("measurement_{serial}"),
                    label: format!("Measurement {serial}"),
                    a: first,
                    b: anchor,
                },
                base: None,
                topology: names(polygon),
                geometry: Some(polygon.clone()),
            });
            self.force_pick = false;
        } else {
            self.selected = None;
            self.draft = None;
            self.first = Some(anchor);
            self.force_pick = true;
        }
    }
    fn synchronize(&mut self, polygon: &PolygonPattern) {
        if self
            .draft
            .as_ref()
            .is_some_and(|d| d.base.is_none() && d.topology != names(polygon))
        {
            self.error =
                Some("Pattern topology changed outside the measurement transaction; discard or restore the draft's geometry before saving".into());
        }
        if let Some(id) = self.selected.clone() {
            match polygon.measurements.iter().find(|m| m.id == id) {
                None => {
                    if self.has_changes() {
                        self.error = Some("Selected measurement was removed; draft retained. Restore it or discard the draft".into());
                        return;
                    }
                    self.selected = None;
                    self.draft = None;
                    self.drag_endpoint = None;
                }
                Some(current) => {
                    // History or another transaction changed the saved record.
                    // Refresh from it rather than overwriting it with an old draft.
                    if self.draft.as_ref().and_then(|d| d.base.as_ref()) != Some(current) {
                        if self.has_changes() {
                            self.error = Some("Saved measurement changed; draft retained. Restore it or discard the draft".into());
                            return;
                        }
                        self.draft = Some(Draft {
                            value: current.clone(),
                            base: Some(current.clone()),
                            topology: names(polygon),
                            geometry: Some(polygon.clone()),
                        });
                    }
                }
            }
        }
        if let Some(draft) = &mut self.draft
            && draft.geometry.is_none()
        {
            draft.geometry = Some(polygon.clone());
            draft.topology = names(polygon);
        }
    }
}

fn names(polygon: &PolygonPattern) -> Vec<String> {
    polygon
        .edges
        .iter()
        .chain(polygon.holes.iter().flat_map(|h| &h.edges))
        .chain(polygon.lines.iter().map(|line| &line.id))
        .cloned()
        .collect()
}

fn geometry(polygon: &PolygonPattern) -> serde_json::Value {
    serde_json::json!([
        polygon.points,
        polygon.edges,
        polygon.curves,
        polygon.holes,
        polygon.lines
    ])
}

/// Binding is local to one material panel, independent of board layout or mesh.
fn anchor_near(
    polygon: &PolygonPattern,
    local: DVec2,
    tolerance_m: f64,
) -> Option<MeasurementAnchor> {
    if !local.is_finite() || !tolerance_m.is_finite() || tolerance_m <= 0. {
        return None;
    }
    names(polygon)
        .into_iter()
        .filter_map(|name| polygon.measurement_anchor_at_point(&name, local).ok())
        .filter(|(_, distance)| *distance <= tolerance_m)
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map(|(anchor, _)| anchor)
}

fn placed_points(
    polygon: &PolygonPattern,
    measurement: &PatternMeasurement,
    origin: DVec2,
    angle: f64,
) -> Option<[DVec2; 2]> {
    Some(
        polygon
            .measurement_points(measurement)
            .ok()?
            .map(|p| origin + authoring::rotate_2d(p, angle)),
    )
}

fn named(ui: &egui::Ui, response: &egui::Response, key: &str) {
    let _ = (ui, response, key);
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(ui, response, key);
}

fn station_controls(
    ui: &mut egui::Ui,
    slot: &str,
    polygon: &PolygonPattern,
    anchor: &mut MeasurementAnchor,
) {
    ui.horizontal_wrapped(|ui| {
        ui.label(slot);
        let combo = egui::ComboBox::from_id_salt(("measurement-boundary", slot))
            .selected_text(&anchor.edge)
            .width(100.)
            .show_ui(ui, |ui| {
                for name in names(polygon) {
                    ui.selectable_value(&mut anchor.edge, name.clone(), name);
                }
            });
        named(ui, &combo.response, &format!("measurement.{slot}.boundary"));
        if let Some(points) = polygon.named_boundary(&anchor.edge) {
            let length = marvelous_cloth::garment::markings::polyline_length(&points);
            if length.is_finite() && length > 0. {
                let mut mm = anchor.t * length * 1000.;
                let field = ui.add(egui::DragValue::new(&mut mm).speed(0.1).suffix(" mm"));
                named(ui, &field, &format!("measurement.{slot}.position"));
                if field.changed() {
                    anchor.t = mm / 1000. / length;
                }
            }
        }
    });
}

struct Controls {
    command: Option<Command>,
    pick: bool,
    focus: Option<String>,
}
fn controls(ui: &mut egui::Ui, panel: &str, polygon: &PolygonPattern, tape: &mut Tape) -> Controls {
    tape.panel(panel);
    if tape.panel.as_deref() == Some(panel) {
        tape.synchronize(polygon);
    }
    let mut result = Controls {
        command: None,
        pick: false,
        focus: None,
    };
    ui.strong("Measurements");
    if tape.transition.is_some() {
        ui.label("Save the current measurement draft before continuing?");
        let valid = tape.draft.as_ref().is_some_and(|d| {
            d.geometry.as_ref().is_some_and(|p| {
                d.valid_for(p)
                    && p.measurement_length(&d.value).is_ok()
                    && !d.value.label.trim().is_empty()
            })
        });
        let save = ui.add_enabled(valid, egui::Button::new("Save draft and continue"));
        named(ui, &save, "measurement.decision.save");
        if save.clicked()
            && let (Some(owner), Some(draft)) = (&tape.panel, &tape.draft)
        {
            result.command = Some(Command::SetMeasurement {
                panel: owner.clone(),
                measurement: draft.value.clone(),
            });
        }
        let discard = ui.button("Discard draft and continue");
        named(ui, &discard, "measurement.decision.discard");
        if discard.clicked() {
            tape.finish_transition();
            result.focus = tape.panel.clone();
            result.pick = tape.force_pick;
        }
        let cancel = ui.button("Cancel switching measurement");
        named(ui, &cancel, "measurement.decision.cancel");
        if cancel.clicked() {
            tape.transition = None;
            result.focus = tape.panel.clone();
        }
        return result;
    }
    ui.small("Straight-line distances in the flat pattern. Click two boundaries with Measure, then save. Interior/cross-piece ruler distances remain temporary.");
    for measurement in &polygon.measurements {
        let length = polygon.measurement_length(measurement).unwrap_or(f64::NAN) * 1000.;
        let row = ui.selectable_label(
            tape.selected.as_ref() == Some(&measurement.id),
            format!("{} · {length:.1} mm", measurement.label),
        );
        named(ui, &row, &format!("measurement.select.{}", measurement.id));
        if row.clicked() && tape.selected.as_ref() != Some(&measurement.id) {
            tape.request(Transition::Select(panel.into(), measurement.clone()));
        }
    }
    let new = ui.button("New measurement");
    named(ui, &new, "measurement.new");
    if new.clicked() {
        result.pick = tape.request(Transition::New(panel.into()));
    }
    if let Some(draft) = &mut tape.draft {
        let field = ui.text_edit_singleline(&mut draft.value.label);
        named(ui, &field, "measurement.label");
        station_controls(ui, "A", polygon, &mut draft.value.a);
        station_controls(ui, "B", polygon, &mut draft.value.b);
        let mut proposed = polygon.measurements.clone();
        if let Some(old) = proposed.iter_mut().find(|m| m.id == draft.value.id) {
            *old = draft.value.clone();
        } else {
            proposed.push(draft.value.clone());
        }
        let validation = if draft.base.is_none()
            && polygon.measurements.iter().any(|m| m.id == draft.value.id)
        {
            Err(
                "A measurement with this ID appeared while drafting; start a new measurement"
                    .into(),
            )
        } else {
            if !draft.valid_for(polygon) {
                Err("Measurement draft is stale; restore its geometry or discard the draft".into())
            } else {
                polygon.validate_measurement_records(&proposed)
            }
        };
        if let Err(error) = &validation {
            ui.colored_label(Color32::GOLD, error);
        }
        if let Ok(length) = polygon.measurement_length(&draft.value) {
            ui.label(format!("{:.2} mm", length * 1000.));
        }
        let apply = ui.add_enabled(
            validation.is_ok() && draft.base.as_ref() != Some(&draft.value),
            egui::Button::new(if draft.base.is_some() {
                "Apply measurement edit"
            } else {
                "Save measurement"
            }),
        );
        named(ui, &apply, "measurement.apply");
        if apply.clicked() {
            result.command = Some(Command::SetMeasurement {
                panel: panel.into(),
                measurement: draft.value.clone(),
            });
        }
        if draft.base.is_some() {
            let delete = ui.button("Delete measurement");
            named(ui, &delete, "measurement.delete");
            if delete.clicked() {
                result.command = Some(Command::RemoveMeasurement {
                    panel: panel.into(),
                    id: draft.value.id.clone(),
                });
            }
        }
        let cancel = ui.button("Cancel measurement draft");
        named(ui, &cancel, "measurement.cancel");
        if cancel.clicked() {
            *tape = Tape {
                panel: Some(panel.into()),
                ..Default::default()
            };
            result.command = None;
        }
    } else if tape.first.is_some() {
        ui.small("First point attached. Click a second boundary on this piece.");
        if ui.button("Cancel measurement draft").clicked() {
            *tape = Tape::default();
        }
    }
    if let Some(error) = &tape.error {
        ui.colored_label(Color32::GOLD, error);
    }
    result
}

fn screen_distance(point: egui::Pos2, a: egui::Pos2, b: egui::Pos2) -> f32 {
    let delta = b - a;
    point
        .distance(a + delta * ((point - a).dot(delta) / delta.length_sq().max(1e-12)).clamp(0., 1.))
}

impl Atelier {
    pub(super) fn measurement_properties(&mut self, ui: &mut egui::Ui, panel: &Panel) {
        let Some(polygon) = panel.polygon.as_ref() else {
            ui.small("Saved measurements require an editable polygonal piece.");
            return;
        };
        let result = egui::CollapsingHeader::new("Measurements")
            .default_open(true)
            .show(ui, |ui| {
                controls(ui, &panel.id, polygon, &mut self.authoring.measure)
            })
            .body_returned;
        if let Some(result) = result {
            if let Some(panel) = result.focus {
                self.authoring.selected = Some(panel);
            }
            if result.pick {
                self.set_authoring_tool(Tool::Measure, false);
                self.authoring.measure.force_pick = true;
            }
            if let Some(command) = result.command {
                let id = match &command {
                    Command::SetMeasurement { measurement, .. } => Some(measurement.id.clone()),
                    _ => None,
                };
                if self.edit(command) {
                    self.authoring.measure.committed(id);
                    self.authoring.selected = self.authoring.measure.panel.clone();
                    if self.authoring.measure.force_pick {
                        self.set_authoring_tool(Tool::Measure, false);
                    }
                }
            }
        }
    }

    pub(super) fn paint_saved_measurements(&self, ui: &egui::Ui, rect: egui::Rect) {
        let painter = ui.painter().with_clip_rect(rect);
        for (i, panel) in self.project.template.panels.iter().enumerate() {
            let Some(polygon) = self.board_polygon(i) else {
                continue;
            };
            for measurement in &polygon.measurements {
                let Some(points) = placed_points(
                    polygon,
                    measurement,
                    self.board_origin(i),
                    self.board_angle(i),
                ) else {
                    continue;
                };
                let points = points.map(|p| self.authoring.board.screen(rect, p));
                let selected = self.authoring.measure.panel.as_ref() == Some(&panel.id)
                    && self.authoring.measure.selected.as_ref() == Some(&measurement.id);
                let color = if selected {
                    Color32::from_rgb(20, 130, 70)
                } else {
                    Color32::from_rgb(55, 105, 150)
                };
                painter.line_segment(points, Stroke::new(if selected { 2.5 } else { 1.2 }, color));
                for point in points {
                    painter.circle_stroke(point, 4., Stroke::new(1.5, color));
                }
                if let Ok(length) = polygon.measurement_length(measurement) {
                    painter.text(
                        points[0].lerp(points[1], 0.5) + Vec2::new(7., -8.),
                        egui::Align2::LEFT_BOTTOM,
                        format!("{} · {:.1} mm", measurement.label, length * 1000.),
                        egui::FontId::proportional(12.),
                        color,
                    );
                }
            }
        }
        if self.authoring.tool != Tool::Measure
            && let Some(panel) = &self.authoring.measure.panel
            && let Some(draft) = &self.authoring.measure.draft
            && let Some(i) = self
                .project
                .template
                .panels
                .iter()
                .position(|p| &p.id == panel)
            && let Some(polygon) = self.board_polygon(i)
            && draft.valid_for(polygon)
            && let Some(points) = placed_points(
                polygon,
                &draft.value,
                self.board_origin(i),
                self.board_angle(i),
            )
        {
            let points = points.map(|p| self.authoring.board.screen(rect, p));
            let color = Color32::from_rgb(20, 140, 75);
            painter.line_segment(points, Stroke::new(2., color));
            for point in points {
                painter.circle_filled(point, 4., color);
            }
            painter.text(
                points[0].lerp(points[1], 0.5) + Vec2::new(7., 8.),
                egui::Align2::LEFT_TOP,
                format!("Draft · {}", draft.value.label),
                egui::FontId::proportional(12.),
                color,
            );
        }
    }

    pub(super) fn measure_board(
        &mut self,
        ui: &egui::Ui,
        rect: egui::Rect,
        response: &egui::Response,
    ) {
        if !ui.ctx().egui_wants_keyboard_input() && ui.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.authoring.measure = Default::default();
        }
        let pos = response.hover_pos();
        let picked = pos.and_then(|pos| {
            let i = self.measurement_panel_at(rect, pos).or_else(|| {
                self.project
                    .template
                    .panels
                    .iter()
                    .position(|p| Some(&p.id) == self.authoring.selected.as_ref())
            })?;
            let panel = &self.project.template.panels[i];
            let polygon = panel.polygon.as_ref()?;
            let local = authoring::rotate_2d(
                self.authoring.board.world(rect, pos) - self.board_origin(i),
                -self.board_angle(i),
            );
            let anchor = anchor_near(polygon, local, 10. / f64::from(self.authoring.board.scale))?;
            Some((i, anchor))
        });
        if response.drag_started_by(egui::PointerButton::Primary)
            && let (Some(pos), Some(panel), Some(draft)) = (
                pos,
                self.authoring.measure.panel.as_ref(),
                self.authoring.measure.draft.as_ref(),
            )
            && draft.base.is_some()
            && let Some(i) = self
                .project
                .template
                .panels
                .iter()
                .position(|p| &p.id == panel)
            && let Some(points) = placed_points(
                self.project.template.panels[i].polygon.as_ref().unwrap(),
                &draft.value,
                self.board_origin(i),
                self.board_angle(i),
            )
        {
            let points = points.map(|p| self.authoring.board.screen(rect, p));
            let press = ui
                .input(|input| input.pointer.press_origin())
                .unwrap_or(pos);
            self.authoring.measure.drag_endpoint =
                points.iter().position(|p| p.distance(press) <= 10.);
        }
        if response.dragged_by(egui::PointerButton::Primary)
            && let (Some(slot), Some((i, anchor))) =
                (self.authoring.measure.drag_endpoint, picked.clone())
            && self.authoring.measure.panel.as_ref() == Some(&self.project.template.panels[i].id)
            && let Some(draft) = &mut self.authoring.measure.draft
        {
            if slot == 0 {
                draft.value.a = anchor;
            } else {
                draft.value.b = anchor;
            }
        }
        if response.drag_stopped_by(egui::PointerButton::Primary) {
            self.authoring.measure.drag_endpoint = None;
        }
        if response.clicked()
            && let Some(pos) = pos
        {
            let visible_owner = self
                .measurement_panel_at(rect, pos)
                .map(|i| &self.project.template.panels[i].id);
            let can_select = !self.authoring.measure.force_pick
                && self.authoring.measure.first.is_none()
                && self
                    .authoring
                    .measure
                    .draft
                    .as_ref()
                    .is_none_or(|d| d.base.is_some());
            let hit = can_select
                .then(|| {
                    self.project
                        .template
                        .panels
                        .iter()
                        .enumerate()
                        .rev()
                        .filter(|(_, panel)| visible_owner.is_none_or(|owner| owner == &panel.id))
                        .find_map(|(i, panel)| {
                            let polygon = panel.polygon.as_ref()?;
                            polygon
                                .measurements
                                .iter()
                                .find(|m| {
                                    placed_points(
                                        polygon,
                                        m,
                                        self.board_origin(i),
                                        self.board_angle(i),
                                    )
                                    .is_some_and(|p| {
                                        let p = p.map(|p| self.authoring.board.screen(rect, p));
                                        screen_distance(pos, p[0], p[1]) < 7.
                                    })
                                })
                                .map(|m| (panel.id.clone(), m.clone()))
                        })
                })
                .flatten();
            if let Some((panel, measurement)) = hit {
                self.authoring.selected = Some(panel.clone());
                self.authoring.edge = None;
                self.authoring.anchor = None;
                self.authoring
                    .measure
                    .request(Transition::Select(panel, measurement));
                self.inspector_tab = super::chrome::InspectorTab::Piece;
            } else if self
                .authoring
                .measure
                .draft
                .as_ref()
                .is_some_and(|d| d.base.is_none())
            {
                self.authoring.measure.error =
                    Some("Save or cancel the current measurement before starting another".into());
            } else if let Some((i, anchor)) = picked.clone() {
                let panel = &self.project.template.panels[i];
                if self.authoring.measure.first.is_some()
                    && self.authoring.measure.panel.as_ref() != Some(&panel.id)
                {
                    self.authoring.measure.error =
                        Some("Choose the second point on the same piece".into());
                } else {
                    self.authoring.measure.attach(
                        &panel.id,
                        anchor,
                        panel.polygon.as_ref().unwrap(),
                    );
                    self.authoring.selected = Some(panel.id.clone());
                    self.authoring.edge = None;
                    self.authoring.anchor = None;
                    self.inspector_tab = super::chrome::InspectorTab::Piece;
                }
            } else if self.authoring.measure.first.is_some() {
                self.authoring.measure.error = Some(
                    "Click near a boundary on the same piece to attach the second point".into(),
                );
            } else if let Some(point) = self.authoring.board.hover_snap.map(|s| s.point) {
                self.authoring.measure.click(point);
                self.authoring.measure.error = Some("Board-only ruler: choose two pattern boundaries to save an attached measurement".into());
            }
        }
        let painter = ui.painter().with_clip_rect(rect);
        let tape = &self.authoring.measure;
        let attached = tape.panel.as_ref().and_then(|id| {
            let i = self
                .project
                .template
                .panels
                .iter()
                .position(|p| &p.id == id)?;
            let polygon = self.board_polygon(i)?;
            let points = if let Some(draft) = &tape.draft {
                if !draft.valid_for(polygon) {
                    return None;
                }
                polygon.measurement_points(&draft.value).ok()?
            } else {
                let a = polygon
                    .measurement_anchor_position(tape.first.as_ref()?)
                    .ok()?;
                let b = picked
                    .as_ref()
                    .filter(|(owner, _)| *owner == i)
                    .and_then(|(_, anchor)| polygon.measurement_anchor_position(anchor).ok())
                    .unwrap_or(a);
                [a, b]
            };
            Some((
                points.map(|p| self.board_origin(i) + authoring::rotate_2d(p, self.board_angle(i))),
                points[0].distance(points[1]),
            ))
        });
        let segment = attached
            .map(|(p, _)| p)
            .or_else(|| tape.segment(self.authoring.board.hover_snap.map(|s| s.point)));
        if let Some(points) = segment {
            let points = points.map(|p| self.authoring.board.screen(rect, p));
            painter.line_segment(points, Stroke::new(2., Color32::from_rgb(20, 140, 75)));
            for point in points {
                painter.circle_filled(point, 4., Color32::from_rgb(20, 140, 75));
            }
        }
        let text = if tape.first.is_some() {
            "First point attached · click a second boundary on the same piece".into()
        } else if let Some((_, length)) = attached {
            format!(
                "{:.2} mm · attached to piece · save/edit in Properties → Piece → Measurements",
                length * 1000.
            )
        } else if let Some([a, b]) = segment {
            let delta = b - a;
            format!(
                "{:.1} mm · ΔX {:+.1} · ΔY {:+.1} mm · temporary board distance",
                delta.length() * 1000.,
                delta.x * 1000.,
                delta.y * 1000.
            )
        } else {
            "Ruler: click two boundaries on one piece to attach a measurement".into()
        };
        painter.text(
            rect.left_top() + Vec2::splat(12.),
            egui::Align2::LEFT_TOP,
            text,
            egui::FontId::proportional(13.),
            Color32::from_rgb(20, 95, 55),
        );
        if let Some(error) = &tape.error {
            painter.text(
                rect.left_top() + Vec2::new(12., 32.),
                egui::Align2::LEFT_TOP,
                error,
                egui::FontId::proportional(12.),
                Color32::from_rgb(140, 85, 10),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn two_clicks_lock_a_measurement_third_starts_another() {
        let mut tape = Tape::default();
        tape.click(DVec2::ZERO);
        tape.click(DVec2::new(0.3, 0.4));
        let [a, b] = tape.segment(None).unwrap();
        assert!((a.distance(b) - 0.5).abs() < 1e-12);
        tape.click(DVec2::ONE);
        assert!(tape.segment(None).is_none());
    }
    fn fixture() -> marvelous_cloth::garment::GarmentTemplate {
        use marvelous_cloth::garment::{
            meshing::MeshingSettings,
            presets::{self, GarmentKind},
            shapes::Primitive,
        };
        authoring::apply(
            &presets::basic(GarmentKind::Tshirt, 0),
            Command::Primitive {
                kind: Primitive::Rectangle,
                size: DVec2::new(0.4, 0.3),
                origin: DVec2::ZERO,
                sweep_degrees: 180.,
                meshing: MeshingSettings {
                    target_edge_m: 0.08,
                    ..Default::default()
                },
                fabric: "woven-reference".into(),
                replace: true,
            },
        )
        .unwrap()
        .template
    }
    fn attach_pair(tape: &mut Tape, template: &marvelous_cloth::garment::GarmentTemplate) {
        let panel = &template.panels[0];
        let p = panel.polygon.as_ref().unwrap();
        for point in [DVec2::new(0.1, 0.), DVec2::new(0.1, 0.3)] {
            tape.attach(&panel.id, anchor_near(p, point, 0.001).unwrap(), p);
        }
    }
    #[test]
    fn ruler_attachment_follows_piece_translation_rotation_and_rest_edit() {
        let t = fixture();
        let p = t.panels[0].polygon.as_ref().unwrap();
        let mut tape = Tape::default();
        attach_pair(&mut tape, &t);
        let m = &tape.draft.as_ref().unwrap().value;
        let original = placed_points(p, m, DVec2::ZERO, 0.).unwrap();
        let moved = placed_points(p, m, DVec2::new(2., 3.), 90.).unwrap();
        for (a, b) in original.into_iter().zip(moved) {
            assert!(b.distance(DVec2::new(2. - a.y, 3. + a.x)) < 1e-12);
        }
        assert!((moved[0].distance(moved[1]) - 0.3).abs() < 1e-12);
        let mut edited = p.clone();
        for point in &mut edited.points {
            point.y *= 2.;
        }
        assert!((edited.measurement_length(m).unwrap() - 0.6).abs() < 1e-12);
        assert!(anchor_near(p, DVec2::new(0.2, 0.15), 0.001).is_none());
        assert!(anchor_near(p, DVec2::splat(f64::NAN), 0.001).is_none());
        tape.cancel_incomplete();
        assert!(
            tape.draft.is_some(),
            "switching to Edit must retain an attached draft"
        );
    }

    #[test]
    fn new_drafts_refuse_stale_topology_and_id_collisions() {
        let t = fixture();
        let mut tape = Tape::default();
        attach_pair(&mut tape, &t);
        let mut polygon = t.panels[0].polygon.clone().unwrap();
        polygon.edges[1] = "renamed".into();
        tape.synchronize(&polygon);
        assert!(tape.draft.is_some());
        assert!(!tape.draft.as_ref().unwrap().valid_for(&polygon));
        assert!(tape.error.as_deref().unwrap().contains("topology"));
        let mut stale = t.clone();
        stale.panels[0].polygon = Some(polygon);
        assert!(tape.document_command(&stale).is_err());
        assert!(tape.document_command(&t).unwrap().is_some());
        tape.discard();
        attach_pair(&mut tape, &t);
        let mut polygon = t.panels[0].polygon.clone().unwrap();
        polygon
            .measurements
            .push(tape.draft.as_ref().unwrap().value.clone());
        assert!(!tape.draft.as_ref().unwrap().valid_for(&polygon));
        let mut incomplete = Tape::default();
        incomplete.attach(
            &t.panels[0].id,
            MeasurementAnchor {
                edge: "edge_1".into(),
                t: 0.3,
            },
            &polygon,
        );
        incomplete.cancel_incomplete();
        assert!(incomplete.first.is_none());
    }
    #[test]
    fn document_draft_commit_roundtrip_and_incomplete_refusal() {
        let mut t = fixture();
        let mut tape = Tape::default();
        let panel = &t.panels[0];
        tape.attach(
            &panel.id,
            MeasurementAnchor {
                edge: "edge_1".into(),
                t: 0.2,
            },
            panel.polygon.as_ref().unwrap(),
        );
        assert!(tape.has_changes());
        assert!(tape.document_command(&t).is_err());
        tape.discard();
        assert!(tape.document_command(&t).unwrap().is_none());
        attach_pair(&mut tape, &t);
        let expected = tape.draft.as_ref().unwrap().value.clone();
        t = authoring::apply(&t, tape.document_command(&t).unwrap().unwrap())
            .unwrap()
            .template;
        tape.document_committed();
        let reopened: marvelous_cloth::garment::GarmentTemplate =
            serde_json::from_slice(&serde_json::to_vec(&t).unwrap()).unwrap();
        assert_eq!(
            reopened.panels[0].polygon.as_ref().unwrap().measurements,
            vec![expected.clone()]
        );
        tape.select(&t.panels[0].id, &expected);
        tape.synchronize(t.panels[0].polygon.as_ref().unwrap());
        assert!(!tape.has_changes());
        assert!(tape.document_command(&t).unwrap().is_none());
        tape.draft.as_mut().unwrap().value.label = "Edited".into();
        assert!(tape.has_changes());
        assert!(tape.document_command(&t).unwrap().is_some());
    }

    #[test]
    fn staged_endpoint_survives_split_and_named_apply() {
        use super::super::authoring_smoke::widget_harness::Harness;
        let mut t = fixture();
        let owner = t.panels[0].id.clone();
        let mut tape = Tape::default();
        attach_pair(&mut tape, &t);
        t = authoring::apply(&t, tape.document_command(&t).unwrap().unwrap())
            .unwrap()
            .template;
        let saved = t.panels[0].polygon.as_ref().unwrap().measurements[0].clone();
        tape.discard();
        tape.select(&owner, &saved);
        tape.synchronize(t.panels[0].polygon.as_ref().unwrap());
        tape.draft.as_mut().unwrap().value.b = MeasurementAnchor {
            edge: "edge_2".into(),
            t: 0.75,
        };
        let before = t.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .measurement_points(&tape.draft.as_ref().unwrap().value)
            .unwrap();
        tape.cancel_incomplete();
        let (edit, migrated) = tape
            .prepare_edit(
                &t,
                Command::SplitBoundary {
                    panel: owner.clone(),
                    edge: "edge_2".into(),
                    at_m: 0.15,
                },
            )
            .unwrap();
        t = edit.template;
        tape = migrated;
        let mut h = Harness::new(Vec2::new(500., 900.));
        let mut draw = |ui: &mut egui::Ui, tape: &mut Tape| {
            let result = controls(ui, &owner, t.panels[0].polygon.as_ref().unwrap(), tape);
            if let Some(command) = result.command {
                t = authoring::apply(&t, command).unwrap().template;
                tape.document_committed();
            }
        };
        h.frame(&mut tape, &mut draw);
        h.click("measurement.apply", &mut tape, &mut draw).unwrap();
        let p = t.panels[0].polygon.as_ref().unwrap();
        assert_eq!(p.measurements.len(), 1);
        for (a, b) in before
            .into_iter()
            .zip(p.measurement_points(&p.measurements[0]).unwrap())
        {
            assert!(a.distance(b) <= 0.0005);
        }
        assert!(!tape.has_changes());
    }

    #[test]
    fn cross_panel_decision_preserves_requested_selection() {
        use super::super::authoring_smoke::widget_harness::Harness;
        for decision in ["cancel", "discard", "save"] {
            let t = fixture();
            let polygon = t.panels[0].polygon.as_ref().unwrap();
            let mut tape = Tape::default();
            attach_pair(&mut tape, &t);
            let mut target = tape.draft.as_ref().unwrap().value.clone();
            target.id = "target".into();
            let mut destination = polygon.clone();
            destination.measurements.push(target.clone());
            assert!(!tape.request(Transition::Select("other".into(), target.clone())));
            let mut h = Harness::new(Vec2::new(500., 900.));
            let mut draw = |ui: &mut egui::Ui, tape: &mut Tape| {
                let result = controls(ui, "other", &destination, tape);
                if let Some(command) = result.command {
                    let edit = authoring::apply(&t, command).unwrap();
                    assert_eq!(
                        edit.template.panels[0]
                            .polygon
                            .as_ref()
                            .unwrap()
                            .measurements
                            .len(),
                        1
                    );
                    tape.document_committed();
                }
            };
            h.frame(&mut tape, &mut draw);
            h.frame(&mut tape, &mut draw);
            h.click(
                &format!("measurement.decision.{decision}"),
                &mut tape,
                &mut draw,
            )
            .unwrap();
            if decision == "cancel" {
                assert_eq!(tape.panel.as_deref(), Some(t.panels[0].id.as_str()));
                assert!(tape.has_changes());
            } else {
                assert_eq!(tape.panel.as_deref(), Some("other"));
                assert_eq!(tape.selected.as_deref(), Some("target"));
                assert_eq!(tape.draft.as_ref().unwrap().value, target);
                assert!(!tape.has_changes());
            }
        }
    }

    #[test]
    fn named_ruler_controls_save_rename_cancel_delete_and_history() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            template: marvelous_cloth::garment::GarmentTemplate,
            tape: Tape,
            history: authoring::History,
            commands: usize,
        }
        let mut c = Case {
            template: fixture(),
            tape: Tape::default(),
            history: Default::default(),
            commands: 0,
        };
        attach_pair(&mut c.tape, &c.template);
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            let panel = c.template.panels[0].clone();
            let result = controls(ui, &panel.id, panel.polygon.as_ref().unwrap(), &mut c.tape);
            if let Some(command) = result.command {
                let id = match &command {
                    Command::SetMeasurement { measurement, .. } => Some(measurement.id.clone()),
                    _ => None,
                };
                let edit = authoring::apply(&c.template, command).unwrap();
                assert!(!edit.reset_simulation);
                c.history.record(c.template.clone());
                c.template = edit.template;
                c.commands += 1;
                c.tape.selected = id;
                c.tape.draft = None;
            }
        };
        let mut h = Harness::new(Vec2::new(500., 900.));
        h.frame(&mut c, &mut draw);
        h.replace_text("measurement.label", "Waist width", &mut c, &mut draw)
            .unwrap();
        h.key(
            "measurement.label",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, 0, "typing/Enter must not save");
        h.click("measurement.apply", &mut c, &mut draw).unwrap();
        assert_eq!(c.commands, 1);
        h.frame(&mut c, &mut draw);
        let saved = c.template.panels[0].polygon.as_ref().unwrap().measurements[0].clone();
        assert_eq!(saved.label, "Waist width");
        assert_eq!(saved.a.edge, "edge_1");
        assert!(
            h.click("measurement.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        assert_eq!(
            c.commands, 1,
            "an unchanged Apply must not add history or invalidate playback"
        );
        h.replace_text("measurement.label", "Discard this", &mut c, &mut draw)
            .unwrap();
        h.click("measurement.cancel", &mut c, &mut draw).unwrap();
        assert_eq!(c.commands, 1);
        h.frame(&mut c, &mut draw);
        h.click("measurement.select.measurement_1", &mut c, &mut draw)
            .unwrap();
        h.frame(&mut c, &mut draw);
        h.replace_text("measurement.label", "Finished waist", &mut c, &mut draw)
            .unwrap();
        h.click("measurement.apply", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert_eq!(
            c.template.panels[0].polygon.as_ref().unwrap().measurements[0].label,
            "Finished waist"
        );
        c.tape.draft.as_mut().unwrap().value.a.t = -0.2;
        h.frame(&mut c, &mut draw);
        assert!(
            h.click("measurement.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        assert_eq!(c.commands, 2);
        c.tape.draft.as_mut().unwrap().value.a.t = saved.a.t;
        h.frame(&mut c, &mut draw);
        h.click("measurement.delete", &mut c, &mut draw).unwrap();
        assert!(
            c.template.panels[0]
                .polygon
                .as_ref()
                .unwrap()
                .measurements
                .is_empty()
        );
        c.template = c.history.restore(&c.template, false).unwrap().template;
        assert_eq!(
            c.template.panels[0].polygon.as_ref().unwrap().measurements[0].label,
            "Finished waist"
        );
        // History preserves dirty text, but refuses to overwrite the changed record.
        c.tape.select(
            &c.template.panels[0].id,
            &c.template.panels[0].polygon.as_ref().unwrap().measurements[0],
        );
        c.tape.draft.as_mut().unwrap().value.label = "Stale unsaved label".into();
        c.template = c.history.restore(&c.template, false).unwrap().template;
        h.frame(&mut c, &mut draw);
        assert_eq!(
            c.tape.draft.as_ref().unwrap().value.label,
            "Stale unsaved label"
        );
        assert!(c.tape.document_command(&c.template).is_err());
        assert!(
            h.click("measurement.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.click("measurement.cancel", &mut c, &mut draw).unwrap();
        h.click("measurement.select.measurement_1", &mut c, &mut draw)
            .unwrap();
        h.frame(&mut c, &mut draw);
        assert_eq!(c.tape.draft.as_ref().unwrap().value.label, "Waist width");
        assert!(!c.tape.has_changes());
    }
}
