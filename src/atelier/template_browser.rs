//! Modal template selection; production controls are driven by the CPU harness.
use eframe::egui;
use marvelous_cloth::template_catalog::{ENTRIES, Selection};

#[derive(Default)]
pub(super) struct Browser {
    pub open: bool,
    pub selection: Option<Selection>,
    pub confirming: bool,
    pub error: Option<String>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Action {
    Prepare,
    Import,
    SaveAndOpen,
    Open,
    Cancel,
}
fn button(ui: &mut egui::Ui, label: &str, name: &str, enabled: bool) -> bool {
    let response = ui.add_enabled(enabled, egui::Button::new(label));
    // Existing workspace shortcuts respect egui keyboard focus. Keep a real
    // modal control focused even before the user tabs or clicks within it.
    if matches!(name, "templates.close" | "templates.cancel")
        && !ui.ctx().egui_wants_keyboard_input()
    {
        response.request_focus();
    }
    #[cfg(test)]
    super::super::authoring_smoke::widget_harness::named(ui, &response, name);
    #[cfg(not(test))]
    let _ = name;
    response.clicked()
}
impl Browser {
    pub fn begin(&mut self) {
        self.open = true;
        self.confirming = false;
        self.error = None;
    }
    pub fn choose(&mut self, id: &str) {
        match Selection::bundled(id) {
            Ok(selection) => {
                self.selection = Some(selection);
                self.error = None;
                self.confirming = false;
            }
            Err(error) => {
                self.selection = None;
                self.error = Some(error);
                self.confirming = false;
            }
        }
    }
    pub fn show(&mut self, ctx: &egui::Context, dirty: bool) -> Option<Action> {
        if !self.open {
            return None;
        }
        let action = egui::Modal::new(egui::Id::new("template-browser"))
            .show(ctx, |ui| self.controls(ui, dirty))
            .inner;
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Escape)) {
            Some(Action::Cancel)
        } else {
            action
        }
    }
    pub fn controls(&mut self, ui: &mut egui::Ui, dirty: bool) -> Option<Action> {
        ui.set_width(560.);
        ui.heading(if self.confirming {
            "Open template as a new project?"
        } else {
            "Garment templates"
        });
        if let Some(error) = &self.error {
            ui.colored_label(egui::Color32::LIGHT_RED, error);
        }
        if self.confirming {
            if let Some(selection) = &self.selection {
                ui.label(&selection.title);
            }
            ui.label("The current garment will be replaced. Your avatar and simulation settings will be kept.");
            ui.label("The new project has no saved path. Its first save will ask for a filename.");
            ui.small("Saving keeps committed geometry and placement. Unfinished drawing and sewing drafts are not saved.");
            if dirty {
                ui.colored_label(
                    egui::Color32::YELLOW,
                    "The current document has unsaved changes or unfinished edits.",
                );
            }
            let mut action = None;
            ui.horizontal_wrapped(|ui| {
                if button(ui, "Cancel", "templates.cancel", true) {
                    action = Some(Action::Cancel);
                }
                if button(ui, "Save current, then open", "templates.save-open", true) {
                    action = Some(Action::SaveAndOpen);
                }
                if button(
                    ui,
                    if dirty {
                        "Discard changes and open"
                    } else {
                        "Open template"
                    },
                    "templates.confirm",
                    true,
                ) {
                    action = Some(Action::Open);
                }
            });
            return action;
        }
        ui.small("Original examples · metres · uncalibrated fabrics · not production patterns");
        ui.horizontal_wrapped(|ui| {
            for entry in ENTRIES {
                if button(
                    ui,
                    entry.title,
                    &format!("templates.choose.{}", entry.id),
                    true,
                ) {
                    self.choose(entry.id);
                }
            }
        });
        if let Some(selection) = &self.selection {
            ui.separator();
            ui.strong(&selection.title);
            ui.label(&selection.description);
            ui.label(format!(
                "{} panels · {} seams · units: metres",
                selection.panel_count, selection.seam_count
            ));
            ui.small(format!("Source: {}", selection.source));
            ui.small(format!("License: {}", selection.license));
            for warning in &selection.warnings {
                ui.small(warning);
            }
            preview(ui, selection);
        } else {
            ui.label("Choose an example or import a native template JSON file.");
        }
        ui.separator();
        let mut action = None;
        ui.horizontal_wrapped(|ui| {
            if button(ui, "Close", "templates.close", true) {
                action = Some(Action::Cancel);
            }
            if button(ui, "Import template JSON…", "templates.import", true) {
                action = Some(Action::Import);
            }
            if button(
                ui,
                "Use this template…",
                "templates.prepare",
                self.selection.is_some(),
            ) {
                action = Some(Action::Prepare);
            }
        });
        action
    }
}
fn preview(ui: &mut egui::Ui, selection: &Selection) {
    let (rect, _) =
        ui.allocate_exact_size(egui::vec2(ui.available_width(), 200.), egui::Sense::hover());
    let mut lo = glam::DVec2::splat(f64::INFINITY);
    let mut hi = glam::DVec2::splat(f64::NEG_INFINITY);
    for point in selection.preview.iter().flat_map(|p| &p.points_m) {
        lo = lo.min(*point);
        hi = hi.max(*point);
    }
    if !lo.is_finite() || !hi.is_finite() {
        return;
    }
    let span = (hi - lo).max(glam::DVec2::splat(1e-6));
    let scale = ((rect.width() - 20.) as f64 / span.x).min((rect.height() - 20.) as f64 / span.y);
    let center = (lo + hi) * 0.5;
    for path in &selection.preview {
        let mut points: Vec<_> = path
            .points_m
            .iter()
            .map(|p| {
                let d = (*p - center) * scale;
                rect.center() + egui::vec2(d.x as f32, d.y as f32)
            })
            .collect();
        if path.closed && !points.is_empty() {
            points.push(points[0]);
        }
        ui.painter().add(egui::Shape::line(
            points,
            egui::Stroke::new(
                if path.internal { 1. } else { 2. },
                if path.internal {
                    egui::Color32::GOLD
                } else {
                    egui::Color32::LIGHT_BLUE
                },
            ),
        ));
    }
}
