//! Document lifecycle. Dialog cancellation never changes the document or saved path.
use super::*;
use rfd::{FileDialog, MessageButtons, MessageDialog, MessageDialogResult};
use std::time::Instant;
#[path = "template_browser.rs"]
mod template_browser;

pub(super) struct DocumentUi {
    browser: template_browser::Browser,
    path: Option<PathBuf>,
    pub dirty: bool,
    last_recovery: Instant,
    recovery: PathBuf,
    checked_recovery: bool,
    closing: bool,
}
impl DocumentUi {
    pub fn new(output: &std::path::Path, path: Option<PathBuf>, modified: bool) -> Self {
        Self {
            browser: Default::default(),
            dirty: path.is_none() || modified,
            path,
            last_recovery: Instant::now(),
            recovery: output.join(format!("recovery-{}.json", std::process::id())),
            checked_recovery: false,
            closing: false,
        }
    }
}
fn install_template(
    prepared: marvelous_cloth::template_catalog::Prepared,
    project: &mut FittingProject,
    scene: &mut FittingScene,
    authoring: &mut AuthoringUi,
    document: &mut DocumentUi,
) {
    *project = prepared.project;
    *scene = prepared.scene;
    *authoring = AuthoringUi::default();
    authoring.selected = project.template.panels.first().map(|p| p.id.clone());
    document.path = None;
    document.dirty = true;
    document.browser = Default::default();
}
impl Atelier {
    pub(super) fn template_browser_open(&self) -> bool {
        self.document.browser.open
    }
    pub(super) fn open_template_browser(&mut self, ctx: &egui::Context) {
        self.pause_document(ctx);
        self.document.browser.begin();
    }
    fn template_browser_tick(&mut self, ctx: &egui::Context) {
        use template_browser::Action;
        let dirty =
            self.document.dirty || self.authoring.preview.is_some() || self.has_document_draft();
        let action = self.document.browser.show(ctx, dirty);
        match action {
            Some(Action::Cancel) => {
                self.document.browser.open = false;
                self.document.browser.confirming = false;
            }
            Some(Action::Import) => {
                if let Some(path) = FileDialog::new()
                    .set_title("Import native garment template")
                    .add_filter("ClothCraft template JSON", &["json"])
                    .pick_file()
                {
                    use std::io::Read;
                    let result = (|| {
                        let mut bytes = Vec::new();
                        std::fs::File::open(&path)
                            .map_err(|e| e.to_string())?
                            .take(8 * 1024 * 1024 + 1)
                            .read_to_end(&mut bytes)
                            .map_err(|e| e.to_string())?;
                        marvelous_cloth::template_catalog::Selection::external(
                            &bytes,
                            path.display().to_string(),
                        )
                    })();
                    match result {
                        Ok(selection) => {
                            self.document.browser.selection = Some(selection);
                            self.document.browser.error = None;
                        }
                        Err(error) => {
                            self.document.browser.selection = None;
                            self.document.browser.error = Some(error);
                        }
                    }
                }
            }
            Some(Action::Prepare) => {
                if let Some(selection) = &self.document.browser.selection {
                    match selection
                        .prepare_with_simulation(&self.project, Some(self.settings.clone()))
                    {
                        Ok(_) => {
                            self.document.browser.confirming = true;
                            self.document.browser.error = None;
                        }
                        Err(error) => self.document.browser.error = Some(error),
                    }
                }
            }
            Some(Action::SaveAndOpen) | Some(Action::Open) => {
                if action == Some(Action::SaveAndOpen) && !self.save_document(ctx, false) {
                    return;
                }
                if let Some(selection) = &self.document.browser.selection {
                    // Revalidate against the current avatar/settings at confirmation.
                    // Only a complete candidate may replace the document.
                    match selection
                        .prepare_with_simulation(&self.project, Some(self.settings.clone()))
                    {
                        Ok(prepared) => {
                            self.pause_document(ctx);
                            self.remove_recovery();
                            install_template(
                                prepared,
                                &mut self.project,
                                &mut self.scene,
                                &mut self.authoring,
                                &mut self.document,
                            );
                            // A paused request still references the previous scene.
                            // Its eventual response must never overwrite this garment.
                            self.generation += 1;
                            self.pending = false;
                            self.playing = false;
                            self.authoring.board.snap_mm = self.prefs.snap_mm;
                            if let Some(poly) = self
                                .project
                                .template
                                .panels
                                .iter()
                                .find_map(|p| p.polygon.as_ref())
                            {
                                let m = poly.meshing_settings();
                                self.mesh_mm = m.target_edge_m * 1000.;
                                self.anisotropy = m.anisotropy;
                                self.mesh_axis = m.axis_degrees;
                            }
                            self.issue.invalidate();
                            self.metrics = None;
                            self.simulation_error = None;
                            self.grab = None;
                            self.drag_plane = None;
                            self.status =
                                "Template opened as a new project · Save As to keep it".into();
                        }
                        Err(error) => self.document.browser.error = Some(error),
                    }
                }
            }
            None => {}
        }
    }
    fn has_document_draft(&self) -> bool {
        !self.authoring.draft.is_empty()
            || !self.authoring.ends.is_empty()
            || self.authoring.sewing.sides.iter().any(|s| !s.is_empty())
            || self.authoring.sewing.start.is_some()
    }
    fn pause_document(&mut self, ctx: &egui::Context) {
        self.playing = false;
        self.generation += 1;
        self.pending = false;
        self.submit(ctx, false);
    }
    fn snapshot_document(&self) -> FittingProject {
        let mut project = self.project.clone();
        project.prearrange = false;
        project.simulation = Some(self.settings.clone());
        project.state = Some(self.scene.state.clone());
        project
    }
    fn save_document(&mut self, ctx: &egui::Context, save_as: bool) -> bool {
        self.pause_document(ctx);
        let path = if save_as || self.document.path.is_none() {
            FileDialog::new()
                .add_filter("ClothCraft project", &["json"])
                .set_file_name(
                    self.document
                        .path
                        .as_ref()
                        .and_then(|p| p.file_name())
                        .and_then(|s| s.to_str())
                        .unwrap_or("garment.clothcraft.json"),
                )
                .save_file()
        } else {
            self.document.path.clone()
        };
        let Some(path) = path else {
            return false;
        };
        if !self.commit_placement() {
            return false;
        }
        match self.snapshot_document().save(&path) {
            Ok(()) => {
                self.document.path = Some(path.clone());
                self.document.dirty = false;
                self.remove_recovery();
                self.status = format!(
                    "Saved {}{}",
                    path.display(),
                    if self.has_document_draft() {
                        " · unfinished drawing/sewing is not included"
                    } else {
                        ""
                    }
                );
                true
            }
            Err(e) => {
                self.status = format!("Save failed: {e}");
                false
            }
        }
    }
    fn can_replace_document(&mut self, ctx: &egui::Context) -> bool {
        self.pause_document(ctx);
        if !self.document.dirty && self.authoring.preview.is_none() && !self.has_document_draft() {
            return true;
        }
        match MessageDialog::new().set_title("Unsaved garment")
            .set_description("Save committed changes before continuing?\nUnfinished drawing/sewing drafts are not saved.\nYes: save · No: discard · Cancel: stay here.")
            .set_buttons(MessageButtons::YesNoCancel).show() {
            MessageDialogResult::Yes => self.save_document(ctx, false),
            MessageDialogResult::No => true,
            _ => false,
        }
    }
    fn open_document_path(&mut self, path: PathBuf, recovered: bool) {
        let result = (|| {
            let mut project = FittingProject::load(&path)?;
            let mut relinked = false;
            if !project.avatar_path.is_file() {
                let Some(avatar) = FileDialog::new()
                    .set_title("Locate missing avatar OBJ")
                    .add_filter("Avatar mesh", &["obj"])
                    .pick_file()
                else {
                    return Err("Open cancelled: avatar was not located".to_owned());
                };
                project.avatar_path = avatar;
                relinked = true;
            }
            let scene = project.compile()?;
            Ok((project, scene, relinked))
        })();
        match result {
            Ok((project, scene, relinked)) => {
                self.remove_recovery();
                self.settings = project.simulation.clone().unwrap_or_else(|| VbdSettings {
                    dt: self.prefs.dt,
                    iterations: self.prefs.iterations,
                    ..Default::default()
                });
                if let Some(poly) = project
                    .template
                    .panels
                    .iter()
                    .find_map(|p| p.polygon.as_ref())
                {
                    let m = poly.meshing_settings();
                    self.mesh_mm = m.target_edge_m * 1000.;
                    self.anisotropy = m.anisotropy;
                    self.mesh_axis = m.axis_degrees;
                }
                self.project = project;
                self.scene = scene;
                self.authoring = AuthoringUi::default();
                self.authoring.board.snap_mm = self.prefs.snap_mm;
                self.generation += 1;
                self.pending = false;
                self.playing = false;
                self.metrics = None;
                self.simulation_error = None;
                self.grab = None;
                self.drag_plane = None;
                self.document.path = (!recovered).then_some(path);
                self.document.dirty = recovered || relinked;
                self.status = if recovered {
                    "Recovery opened · Save As to keep it"
                } else {
                    "Project opened"
                }
                .into();
            }
            Err(e) => self.status = format!("Open failed; current document retained: {e}"),
        }
    }
    fn open_document(&mut self, ctx: &egui::Context, recovery: bool) {
        if !self.can_replace_document(ctx) {
            return;
        }
        let picker = FileDialog::new().add_filter("ClothCraft project", &["json"]);
        let picker = if recovery {
            picker
                .set_directory(&self.output)
                .set_title("Open a recovery-*.json snapshot")
        } else {
            picker
        };
        if let Some(path) = picker.pick_file() {
            self.open_document_path(path, recovery);
        }
    }
    fn new_document(&mut self, ctx: &egui::Context) {
        if !self.can_replace_document(ctx) {
            return;
        }
        // Start with a single unsewn, unpinned rectangle; empty solver meshes are unsupported.
        let mut p = self.project.clone();
        let command = marvelous_cloth::authoring::Command::Primitive {
            kind: marvelous_cloth::garment::shapes::Primitive::Rectangle,
            size: glam::DVec2::new(0.4, 0.6),
            sweep_degrees: 180.,
            origin: glam::DVec2::ZERO,
            meshing: Default::default(),
            fabric: p.template.fabrics[0].id.clone(),
            replace: true,
        };
        match marvelous_cloth::authoring::apply(&p.template, command) {
            Ok(edit) => {
                p.template = edit.template;
                p.state = None;
                p.mesh_signature = None;
                p.prearrange = false;
                if !self.load(p) {
                    return;
                }
                self.remove_recovery();
                self.authoring.history = Default::default();
                self.document.path = None;
                self.document.dirty = true;
                self.status = "New project · one unsewn rectangle".into();
            }
            Err(e) => self.status = e,
        }
    }
    fn remove_recovery(&mut self) {
        if self.document.recovery.is_file() {
            let _ = std::fs::remove_file(&self.document.recovery);
        }
        self.document.last_recovery = Instant::now();
    }
    pub(super) fn document_menu(&mut self, ui: &mut egui::Ui) {
        let ctx = ui.ctx().clone();
        for (label, action) in [
            ("Templates…", 5),
            ("New project…", 0),
            ("Open…  Ctrl+O", 1),
            ("Save  Ctrl+S", 2),
            ("Save As…  Ctrl+Shift+S", 3),
            ("Recover snapshot…", 4),
        ] {
            if ui.button(label).clicked() {
                ui.close();
                match action {
                    0 => self.new_document(&ctx),
                    1 => self.open_document(&ctx, false),
                    2 => {
                        self.save_document(&ctx, false);
                    }
                    3 => {
                        self.save_document(&ctx, true);
                    }
                    4 => self.open_document(&ctx, true),
                    _ => self.open_template_browser(&ctx),
                }
            }
        }
        ui.separator();
        self.export_information(ui);
    }
    pub(super) fn document_tick(&mut self, ctx: &egui::Context) {
        self.template_browser_tick(ctx);
        if self.document.browser.open {
            return;
        }
        if self.smoke {
            return;
        }
        if !self.document.checked_recovery {
            self.document.checked_recovery = true;
            let previous = std::fs::read_dir(&self.output)
                .ok()
                .into_iter()
                .flatten()
                .filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| {
                    p.file_name()
                        .and_then(|s| s.to_str())
                        .is_some_and(|s| s.starts_with("recovery-") && s.ends_with(".json"))
                })
                .max_by_key(|p| p.metadata().and_then(|m| m.modified()).ok());
            if let Some(path) = previous
                && MessageDialog::new()
                    .set_title("Recovery available")
                    .set_description(format!(
                        "Open the last recovery snapshot?\n{}",
                        path.display()
                    ))
                    .set_buttons(MessageButtons::YesNo)
                    .show()
                    == MessageDialogResult::Yes
            {
                self.open_document_path(path, true);
            }
        }
        let shortcut = ctx.input_mut(|i| {
            if i.consume_key(
                egui::Modifiers::COMMAND | egui::Modifiers::SHIFT,
                egui::Key::S,
            ) {
                3
            } else if i.consume_key(egui::Modifiers::COMMAND, egui::Key::S) {
                2
            } else if i.consume_key(egui::Modifiers::COMMAND, egui::Key::O) {
                1
            } else {
                0
            }
        });
        match shortcut {
            1 => self.open_document(ctx, false),
            2 => {
                self.save_document(ctx, false);
            }
            3 => {
                self.save_document(ctx, true);
            }
            _ => {}
        }
        if ctx.input(|i| i.viewport().close_requested()) && !self.document.closing {
            if self.can_replace_document(ctx) {
                self.document.closing = true;
                self.remove_recovery();
            } else {
                ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            }
        }
        if self.document.dirty
            && self.authoring.preview.is_none()
            && self.document.last_recovery.elapsed().as_secs() >= 60
        {
            let _ = std::fs::create_dir_all(&self.output);
            match self.snapshot_document().save(&self.document.recovery) {
                Ok(()) => {}
                Err(e) => self.status = format!("Recovery save failed: {e}"),
            }
            self.document.last_recovery = Instant::now();
        }
        let name = self
            .document
            .path
            .as_ref()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled");
        ctx.send_viewport_cmd(egui::ViewportCommand::Title(format!(
            "{}{} — ClothCraft",
            name,
            if self.document.dirty { " *" } else { "" }
        )));
        ctx.request_repaint_after(Duration::from_secs(5));
    }
}

#[cfg(test)]
mod template_tests {
    use super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    use marvelous_cloth::{garment::presets::GarmentKind, template_catalog::Selection};

    struct Case {
        browser: template_browser::Browser,
        document: DocumentUi,
        project: FittingProject,
        scene: FittingScene,
        authoring: AuthoringUi,
        installs: usize,
    }
    fn draw(ui: &mut egui::Ui, case: &mut Case) {
        let action = case.browser.show(ui.ctx(), case.document.dirty);
        match action {
            Some(template_browser::Action::Prepare) => {
                match case
                    .browser
                    .selection
                    .as_ref()
                    .unwrap()
                    .prepare(&case.project)
                {
                    Ok(_) => case.browser.confirming = true,
                    Err(e) => case.browser.error = Some(e),
                }
            }
            Some(template_browser::Action::Cancel) => {
                case.browser.open = false;
                case.browser.confirming = false;
            }
            Some(template_browser::Action::Open) => {
                let prepared = case
                    .browser
                    .selection
                    .as_ref()
                    .unwrap()
                    .prepare(&case.project)
                    .unwrap();
                install_template(
                    prepared,
                    &mut case.project,
                    &mut case.scene,
                    &mut case.authoring,
                    &mut case.document,
                );
                case.browser.open = false;
                case.installs += 1;
            }
            None => {}
            other => panic!("Unexpected action: {other:?}"),
        }
    }
    fn fixture(directory: &std::path::Path) -> Case {
        let avatar = directory.join("avatar.obj");
        std::fs::write(&avatar, "v 0 0 -10\nv 1 0 -10\nv 0 1 -10\nf 1 2 3\n").unwrap();
        let project = FittingProject::basic(GarmentKind::Dress, 1, avatar);
        let scene = project.compile().unwrap();
        let mut authoring = AuthoringUi::default();
        authoring.history.record(project.template.clone());
        let mut browser = template_browser::Browser::default();
        browser.begin();
        Case {
            browser,
            document: DocumentUi::new(directory, Some(directory.join("existing.json")), true),
            project,
            scene,
            authoring,
            installs: 0,
        }
    }
    #[test]
    fn named_widgets_templates_cancel_preserves_then_confirm_starts_new_document() {
        let directory = tempfile::tempdir().unwrap();
        let mut case = fixture(directory.path());
        let original = serde_json::to_vec(&case.project).unwrap();
        let saved = case.document.path.clone();
        let avatar = case.project.avatar_path.clone();
        let mut h = Harness::new(egui::vec2(900., 850.));
        for _ in 0..4 {
            h.frame(&mut case, &mut draw);
        }
        h.click("templates.choose.two-panel", &mut case, &mut draw)
            .unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.click("templates.prepare", &mut case, &mut draw).unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        assert!(case.browser.confirming);
        assert_eq!(case.installs, 0);
        h.click("templates.cancel", &mut case, &mut draw).unwrap();
        assert_eq!(serde_json::to_vec(&case.project).unwrap(), original);
        assert_eq!(case.document.path, saved);
        assert!(case.authoring.history.can_undo());
        h.frame(&mut case, &mut draw);
        case.browser.begin();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.click("templates.prepare", &mut case, &mut draw).unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.click("templates.confirm", &mut case, &mut draw).unwrap();
        assert_eq!(case.installs, 1);
        assert!(case.document.path.is_none());
        assert!(case.document.dirty);
        assert!(!case.authoring.history.can_undo());
        assert!(!case.authoring.history.can_redo());
        assert_eq!(case.project.avatar_path, avatar);
        assert_eq!(case.project.template.name, "Two panels / nonmatching seam");
        assert!(case.project.state.is_none());
        assert!(case.project.mesh_signature.is_none());
        assert!(!directory.path().join("existing.json").exists());
    }
    #[test]
    fn named_widgets_templates_small_window_keeps_confirmation_accessible() {
        let directory = tempfile::tempdir().unwrap();
        let mut case = fixture(directory.path());
        let mut h = Harness::new(egui::vec2(480., 360.));
        for _ in 0..4 {
            h.frame(&mut case, &mut draw);
        }
        h.click("templates.choose.two-panel", &mut case, &mut draw)
            .unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.click("templates.prepare", &mut case, &mut draw).unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.click("templates.cancel", &mut case, &mut draw).unwrap();
        assert_eq!(case.installs, 0);
    }
    #[test]
    fn named_widgets_templates_owns_keyboard_and_escape_preserves_document() {
        let directory = tempfile::tempdir().unwrap();
        let mut case = fixture(directory.path());
        let original = serde_json::to_vec(&case.project).unwrap();
        let mut h = Harness::new(egui::vec2(900., 850.));
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        assert!(h.ctx.egui_wants_keyboard_input());
        h.key(
            "templates.close",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut case,
            &mut draw,
        )
        .unwrap();
        assert!(!case.browser.open);
        assert_eq!(case.installs, 0);
        assert_eq!(serde_json::to_vec(&case.project).unwrap(), original);
        assert!(case.authoring.history.can_undo());
    }
    #[test]
    fn named_widgets_templates_invalid_avatar_never_replaces_document() {
        let directory = tempfile::tempdir().unwrap();
        let mut case = fixture(directory.path());
        case.project.avatar_path = directory.path().join("missing.obj");
        let original = serde_json::to_vec(&case.project).unwrap();
        let saved = case.document.path.clone();
        let mut h = Harness::new(egui::vec2(900., 850.));
        for _ in 0..4 {
            h.frame(&mut case, &mut draw);
        }
        h.click("templates.choose.two-panel", &mut case, &mut draw)
            .unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        h.click("templates.prepare", &mut case, &mut draw).unwrap();
        h.frame(&mut case, &mut draw);
        h.frame(&mut case, &mut draw);
        assert!(case.browser.error.is_some());
        assert!(!case.browser.confirming);
        assert_eq!(case.installs, 0);
        assert_eq!(serde_json::to_vec(&case.project).unwrap(), original);
        assert_eq!(case.document.path, saved);
        assert!(Selection::external(b"invalid", "broken".into()).is_err());
    }
}
