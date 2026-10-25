//! Static avatar import confirmation, driven by the named-widget CPU harness.
use eframe::egui;
use marvelous_cloth::avatar_import::Candidate;

#[derive(Default)]
pub(super) struct ImportUi {
    pub open: bool,
    pub candidate: Option<Candidate>,
    pub error: Option<String>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Action {
    Choose,
    Confirm,
    Cancel,
}

fn button(ui: &mut egui::Ui, label: &str, name: &str, enabled: bool) -> bool {
    let response = ui
        .push_id(name, |ui| ui.add_enabled(enabled, egui::Button::new(label)))
        .inner;
    if name == "avatar.cancel" && !ui.ctx().egui_wants_keyboard_input() {
        response.request_focus();
    }
    #[cfg(test)]
    super::super::authoring_smoke::widget_harness::named(ui, &response, name);
    response.clicked()
}
impl ImportUi {
    pub fn choose(&mut self, path: &std::path::Path) {
        match Candidate::load(path) {
            Ok(candidate) => {
                self.candidate = Some(candidate);
                self.error = None;
            }
            Err(error) => {
                self.candidate = None;
                self.error = Some(error);
            }
        }
    }
    pub fn show(&mut self, ctx: &egui::Context) -> Option<Action> {
        if !self.open {
            return None;
        }
        let action = egui::Modal::new(egui::Id::new("avatar-import"))
            .show(ctx, |ui| self.controls(ui))
            .inner;
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Escape)) {
            Some(Action::Cancel)
        } else {
            action
        }
    }
    fn controls(&mut self, ui: &mut egui::Ui) -> Option<Action> {
        ui.set_width((ui.ctx().content_rect().width() - 64.).clamp(160., 560.));
        ui.heading("Import static avatar");
        let height = (ui.ctx().content_rect().height() - 170.).clamp(80., 400.);
        egui::ScrollArea::vertical().id_salt("avatar-import-details")
            .auto_shrink([false, false]).max_height(height).min_scrolled_height(height)
            .show(ui, |ui| {
                ui.label("OBJ · glTF · GLB · metres · Y-up");
                if let Some(error) = &self.error { ui.colored_label(egui::Color32::LIGHT_RED, error); }
                if let Some(candidate) = &self.candidate {
                    ui.label(format!("Source: {}", candidate.source.display()));
                    ui.label(format!("{} vertices · {} triangles", candidate.vertices, candidate.triangles));
                    let [lo, hi] = candidate.bounds;
                    let size = hi - lo;
                    ui.label(format!("Size X/Y/Z: {:.4} / {:.4} / {:.4} m", size.x, size.y, size.z));
                    ui.small(format!("Min: {:.4}, {:.4}, {:.4} m · Max: {:.4}, {:.4}, {:.4} m", lo.x, lo.y, lo.z, hi.x, hi.y, hi.z));
                    for warning in &candidate.warnings { ui.label(warning); }
                } else {
                    ui.label("Choose a local static mesh. Animated or skinned glTF assets are not supported.");
                }
                ui.separator();
                ui.label("Authored patterns, seams, materials and placement are kept. Unfinished edits are discarded. Save your current drape first if you want to keep it.");
            });
        ui.separator();
        ui.strong("Resets draped cloth and undo history.");
        let mut action = None;
        ui.horizontal_wrapped(|ui| {
            if button(ui, "Cancel", "avatar.cancel", true) {
                action = Some(Action::Cancel);
            }
            if button(ui, "Choose file…", "avatar.choose", true) {
                action = Some(Action::Choose);
            }
            if button(
                ui,
                "Replace avatar",
                "avatar.confirm",
                self.candidate.is_some(),
            ) {
                action = Some(Action::Confirm);
            }
        });
        action
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::{AuthoringUi, authoring_smoke::widget_harness::Harness};
    use super::super::{DocumentUi, install_avatar};
    use super::*;
    use marvelous_cloth::{
        fitting::{FittingProject, FittingScene},
        garment::presets::GarmentKind,
        vbd::VbdSettings,
    };

    struct Case {
        document: DocumentUi,
        project: FittingProject,
        scene: FittingScene,
        authoring: AuthoringUi,
        settings: VbdSettings,
        generation: u64,
        source: std::path::PathBuf,
    }
    fn fixture(dir: &std::path::Path) -> Case {
        let old = dir.join("old.obj");
        let source = dir.join("new.obj");
        std::fs::write(&old, "v 0 0 -10\nv 1 0 -10\nv 0 1 -10\nf 1 2 3").unwrap();
        std::fs::write(&source, "v 2 0 -10\nv 3 0 -10\nv 2 1 -10\nf 1 2 3").unwrap();
        let project = FittingProject::basic(GarmentKind::Dress, 1, old);
        let scene = project.compile().unwrap();
        let mut document = DocumentUi::new(dir, Some(dir.join("garment.json")), false);
        document.avatar_import.open = true;
        let mut authoring = AuthoringUi::default();
        authoring.history.record(project.template.clone());
        Case {
            document,
            project,
            scene,
            authoring,
            settings: VbdSettings::default(),
            generation: 17,
            source,
        }
    }
    fn draw(ui: &mut egui::Ui, case: &mut Case) {
        match case.document.avatar_import.show(ui.ctx()) {
            Some(Action::Choose) => case.document.avatar_import.choose(&case.source),
            Some(Action::Cancel) => case.document.avatar_import = Default::default(),
            Some(Action::Confirm) => {
                let result = case
                    .document
                    .avatar_import
                    .candidate
                    .as_ref()
                    .unwrap()
                    .prepare(&case.project, case.settings.clone());
                match result {
                    Ok(prepared) => install_avatar(
                        prepared,
                        &mut case.project,
                        &mut case.scene,
                        &mut case.authoring,
                        &mut case.document,
                        &mut case.generation,
                    ),
                    Err(error) => case.document.avatar_import.error = Some(error),
                }
            }
            None => {}
        }
    }
    fn frames(h: &mut Harness, case: &mut Case) {
        for _ in 0..4 {
            h.frame(case, &mut draw);
        }
    }
    #[test]
    fn named_widgets_avatar_cancel_and_confirm_use_production_install() {
        let dir = tempfile::tempdir().unwrap();
        let mut case = fixture(dir.path());
        let before = serde_json::to_vec(&case.project).unwrap();
        let original_path = case.document.path.clone();
        let mut h = Harness::new(egui::vec2(800., 720.));
        frames(&mut h, &mut case);
        assert!(h.click("avatar.confirm", &mut case, &mut draw).is_err());
        h.click("avatar.choose", &mut case, &mut draw).unwrap();
        frames(&mut h, &mut case);
        assert!(h.ctx.egui_wants_keyboard_input());
        h.click("avatar.cancel", &mut case, &mut draw).unwrap();
        assert_eq!(serde_json::to_vec(&case.project).unwrap(), before);
        assert_eq!(case.generation, 17);
        assert!(!case.document.dirty);
        assert!(case.authoring.history.can_undo());
        assert!(case.document.staged_avatar.is_none());
        case.document.avatar_import.open = true;
        frames(&mut h, &mut case);
        h.click("avatar.choose", &mut case, &mut draw).unwrap();
        frames(&mut h, &mut case);
        h.click("avatar.confirm", &mut case, &mut draw).unwrap();
        assert_eq!(case.generation, 18); // Previous worker generation 17 is stale.
        assert!(case.document.dirty);
        assert_eq!(case.document.path, original_path);
        assert!(case.document.staged_avatar.is_some());
        assert!(!case.document.avatar_import.open);
        assert!(!case.authoring.history.can_undo());
        assert_eq!(case.scene.collider.surface.vertices[0].x, 2.);
        assert_eq!(case.scene.state.time, 0.);
        assert!(case.project.state.is_none());
    }
    #[test]
    fn named_widgets_avatar_errors_and_escape_preserve_document() {
        let dir = tempfile::tempdir().unwrap();
        let mut case = fixture(dir.path());
        let before = serde_json::to_vec(&case.project).unwrap();
        let mut h = Harness::new(egui::vec2(800., 720.));
        frames(&mut h, &mut case);
        case.source = dir.path().join("missing.obj");
        h.click("avatar.choose", &mut case, &mut draw).unwrap();
        frames(&mut h, &mut case);
        assert!(case.document.avatar_import.error.is_some());
        assert!(h.click("avatar.confirm", &mut case, &mut draw).is_err());
        case.source = dir.path().join("new.obj");
        h.click("avatar.choose", &mut case, &mut draw).unwrap();
        frames(&mut h, &mut case);
        case.settings.dt = f64::NAN;
        h.click("avatar.confirm", &mut case, &mut draw).unwrap();
        assert!(case.document.avatar_import.error.is_some());
        assert_eq!(case.generation, 17);
        assert_eq!(serde_json::to_vec(&case.project).unwrap(), before);
        frames(&mut h, &mut case);
        h.key(
            "avatar.cancel",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut case,
            &mut draw,
        )
        .unwrap();
        assert!(!case.document.avatar_import.open);
        assert_eq!(serde_json::to_vec(&case.project).unwrap(), before);
    }
    #[test]
    fn named_widgets_avatar_small_window_keeps_actions_accessible() {
        let dir = tempfile::tempdir().unwrap();
        let mut case = fixture(dir.path());
        let mut h = Harness::new(egui::vec2(480., 360.));
        frames(&mut h, &mut case);
        h.click("avatar.choose", &mut case, &mut draw).unwrap();
        frames(&mut h, &mut case);
        h.click("avatar.confirm", &mut case, &mut draw).unwrap();
        assert_eq!(case.generation, 18);
    }

    #[test]
    fn avatar_staging_survives_template_replacement_and_saved_project_outlives_it() {
        let dir = tempfile::tempdir().unwrap();
        let mut case = fixture(dir.path());
        let candidate = Candidate::load(&case.source).unwrap();
        let prepared = candidate
            .prepare(&case.project, case.settings.clone())
            .unwrap();
        install_avatar(
            prepared,
            &mut case.project,
            &mut case.scene,
            &mut case.authoring,
            &mut case.document,
            &mut case.generation,
        );
        let staged = case.project.avatar_path.clone();
        drop(candidate);
        let template = marvelous_cloth::template_catalog::Selection::bundled("two-panel").unwrap();
        let prepared = template.prepare(&case.project).unwrap();
        super::super::install_template(
            prepared,
            &mut case.project,
            &mut case.scene,
            &mut case.authoring,
            &mut case.document,
        );
        assert_eq!(case.project.avatar_path, staged);
        assert!(staged.exists());
        let saved = dir.path().join("with-new-template.json");
        case.project.save(&saved).unwrap();
        drop(case);
        assert!(!staged.exists());
        let restored = FittingProject::load(&saved).unwrap().compile().unwrap();
        assert_eq!(restored.collider.surface.vertices[0].x, 2.);
    }

    #[test]
    fn avatar_confirmation_renders_source_units_counts_and_reset_notice() {
        let dir = tempfile::tempdir().unwrap();
        let case = fixture(dir.path());
        let mut import = ImportUi::default();
        import.choose(&case.source);
        let ctx = egui::Context::default();
        let mut labels = String::new();
        for _ in 0..2 {
            let mut output = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(900., 900.),
                    )),
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        import.controls(ui);
                    });
                },
            );
            labels = output
                .shapes
                .iter()
                .filter_map(|s| match &s.shape {
                    egui::Shape::Text(t) => Some(t.galley.job.text.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n");
            output.textures_delta.clear();
        }
        assert!(labels.contains("new.obj"));
        assert!(labels.contains("3 vertices · 1 triangles"));
        assert!(labels.contains("metres"));
        assert!(labels.contains("Geometry only"));
        assert!(labels.contains("Resets draped cloth and undo history"));
    }
}
