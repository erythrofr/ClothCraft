//! Workspace presentation; no physical state or file-format promises live here.
use super::*;
use std::sync::OnceLock;

/// Workspace accent: a saturated blue that reads on the light chrome, on the
/// white pattern board and on the dark variant.
pub(super) const ACCENT: Color32 = Color32::from_rgb(30, 136, 229);

/// Pristine egui base styles, captured before the first install. Deriving each
/// theme from its own base keeps switching Light -> Dark -> Light idempotent
/// instead of letting the light palette inherit the dark overrides.
fn bases(ctx: &egui::Context) -> &'static (egui::Style, egui::Style) {
    static BASES: OnceLock<(egui::Style, egui::Style)> = OnceLock::new();
    BASES.get_or_init(|| {
        (
            (*ctx.style_of(egui::Theme::Light)).clone(),
            (*ctx.style_of(egui::Theme::Dark)).clone(),
        )
    })
}

/// Theme-independent geometry and text sizes.
fn geometry(style: &mut egui::Style) {
    style.spacing.item_spacing = Vec2::new(8., 6.);
    style.spacing.button_padding = Vec2::new(10., 6.);
    style.spacing.interact_size.y = 28.;
    style
        .text_styles
        .insert(egui::TextStyle::Body, egui::FontId::proportional(13.));
    style
        .text_styles
        .insert(egui::TextStyle::Button, egui::FontId::proportional(13.));
    style
        .text_styles
        .insert(egui::TextStyle::Small, egui::FontId::proportional(11.));
}

/// The reviewed light palette. These values are unchanged from the approved pass.
fn light_visuals(visuals: &mut egui::Visuals) {
    visuals.panel_fill = Color32::from_rgb(0xEC, 0xEC, 0xEC);
    visuals.window_fill = Color32::from_rgb(0xF7, 0xF7, 0xF7);
    visuals.faint_bg_color = Color32::from_rgb(0xDD, 0xDD, 0xDD);
    visuals.extreme_bg_color = Color32::WHITE;
    visuals.selection.bg_fill = ACCENT;
    visuals.selection.stroke = Stroke::new(1., Color32::from_rgb(21, 101, 192));
    visuals.widgets.inactive.bg_fill = Color32::from_rgb(0xDD, 0xDD, 0xDD);
    visuals.widgets.hovered.bg_fill = Color32::from_rgb(0xCB, 0xDD, 0xF0);
    visuals.widgets.active.bg_fill = Color32::from_rgb(0xAE, 0xCC, 0xEC);
}

/// Dark counterpart of the light palette, carrying the same accent. Text and
/// stroke colours stay egui's dark defaults so contrast remains readable.
fn dark_visuals(visuals: &mut egui::Visuals) {
    visuals.panel_fill = Color32::from_rgb(0x1B, 0x1B, 0x1F);
    visuals.window_fill = Color32::from_rgb(0x23, 0x23, 0x28);
    visuals.faint_bg_color = Color32::from_rgb(0x2C, 0x2C, 0x32);
    visuals.extreme_bg_color = Color32::from_rgb(0x12, 0x12, 0x15);
    visuals.selection.bg_fill = ACCENT;
    visuals.selection.stroke = Stroke::new(1., Color32::from_rgb(0x8A, 0xC4, 0xF8));
    visuals.widgets.inactive.bg_fill = Color32::from_rgb(0x32, 0x32, 0x38);
    visuals.widgets.hovered.bg_fill = Color32::from_rgb(0x2A, 0x40, 0x57);
    visuals.widgets.active.bg_fill = Color32::from_rgb(0x23, 0x4E, 0x74);
}

fn install(ctx: &egui::Context, dark: bool) {
    let base = bases(ctx);
    let mut style = if dark { base.1.clone() } else { base.0.clone() };
    geometry(&mut style);
    if dark {
        dark_visuals(&mut style.visuals);
    } else {
        light_visuals(&mut style.visuals);
    }
    // Both egui theme slots receive the same workspace look, so the active theme
    // preference cannot pick a half-styled variant.
    ctx.set_style_of(egui::Theme::Light, style.clone());
    ctx.set_style_of(egui::Theme::Dark, style);
}

/// Install the reviewed light workspace chrome.
pub(super) fn style(ctx: &egui::Context) {
    install(ctx, false);
}

/// Install the dark workspace chrome. `settings::apply` chooses between the two.
// The only caller is `settings::apply`, which lands with the module declaration.
#[allow(dead_code)]
pub(super) fn dark_style(ctx: &egui::Context) {
    install(ctx, true);
}
impl Atelier {
    pub(super) fn panel_browser(&mut self, ui: &mut egui::Ui) {
        let mut select = None;
        egui::CollapsingHeader::new(format!("Pieces ({})", self.project.template.panels.len()))
            .id_salt("panel_browser")
            .default_open(true)
            .show(ui, |ui| {
                egui::ScrollArea::vertical()
                    .id_salt("panel_list")
                    .max_height(115.)
                    .show(ui, |ui| {
                        for panel in &self.project.template.panels {
                            if ui
                                .selectable_label(
                                    self.authoring.selected.as_ref() == Some(&panel.id),
                                    &panel.name,
                                )
                                .on_hover_text(format!("{} · select in both views", panel.id))
                                .clicked()
                            {
                                select = Some(panel.id.clone());
                            }
                        }
                    });
            });
        if let Some(id) = select {
            self.set_authoring_tool(Tool::Edit, false);
            self.cancel_preview();
            self.select_panel(id, ui.input(|i| i.modifiers.shift));
            self.authoring.edge = None;
        }
        ui.separator();
    }
    pub(super) fn export_information(&mut self, ui: &mut egui::Ui) {
        ui.collapsing("Files & formats", |ui| {
            ui.label("Import");
            ui.small("ClothCraft project and template JSON");
            ui.small("Static avatars: OBJ · glTF · GLB");
            ui.small("Pattern outlines: generic ASCII DXF · physical SVG subsets");
            ui.label("Export");
            ui.small("Project and template JSON · garment OBJ · SVG patterns · fiber guides");
            ui.small("Industrial DXF, GLB export, animated avatars, USD, Alembic, FBX and PDF are not yet supported.");
            ui.separator();
            ui.small("Export folder (files replaced on every export):");
            ui.label(egui::RichText::new(self.output.display().to_string()).small());
        });
    }
}
