//! Review SVG outlines before preparing one atomic authoring edit.
use eframe::egui;
use marvelous_cloth::{
    authoring::Edit,
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        svg_import::{self, Drawing, Options},
    },
};
use std::{
    collections::BTreeSet,
    io::Read,
    path::{Path, PathBuf},
};

const MAX_BYTES: u64 = 3 * 1024 * 1024;
struct Source {
    path: PathBuf,
    text: String,
}
impl Source {
    fn load(path: &Path) -> Result<Self, String> {
        let mut text = String::new();
        std::fs::File::open(path)
            .map_err(|e| e.to_string())?
            .take(MAX_BYTES + 1)
            .read_to_string(&mut text)
            .map_err(|e| e.to_string())?;
        if text.len() as u64 > MAX_BYTES {
            return Err("SVG exceeds the 3 MiB input limit".into());
        }
        Ok(Self {
            path: path.to_owned(),
            text,
        })
    }
}
pub(super) struct ImportUi {
    pub open: bool,
    source: Option<Source>,
    drawing: Option<Drawing>,
    selected: BTreeSet<usize>,
    tolerance_mm: String,
    reviewed: Option<String>,
    mesh_mm: String,
    fabric: String,
    acknowledged: bool,
    pub error: Option<String>,
}
impl Default for ImportUi {
    fn default() -> Self {
        Self {
            open: false,
            source: None,
            drawing: None,
            selected: BTreeSet::new(),
            tolerance_mm: "0.1".into(),
            reviewed: None,
            mesh_mm: "25".into(),
            fabric: String::new(),
            acknowledged: false,
            error: None,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Action {
    Choose,
    Confirm,
    Cancel,
}
fn named(_ui: &egui::Ui, _r: &egui::Response, _name: &str) {
    super::super::authoring_smoke::svg_widget(_ui, _r, _name);
    #[cfg(test)]
    super::super::authoring_smoke::widget_harness::named(_ui, _r, _name);
}
fn button(ui: &mut egui::Ui, name: &str, label: &str, enabled: bool) -> bool {
    let r = ui
        .push_id(name, |ui| ui.add_enabled(enabled, egui::Button::new(label)))
        .inner;
    if name == "svg.cancel" && !ui.ctx().egui_wants_keyboard_input() {
        r.request_focus();
    }
    named(ui, &r, name);
    r.clicked()
}
fn field(ui: &mut egui::Ui, name: &str, label: &str, value: &mut String) -> bool {
    ui.horizontal(|ui| {
        ui.label(label);
        let r = ui.add(
            egui::TextEdit::singleline(value)
                .id(egui::Id::new(name))
                .desired_width(80.),
        );
        named(ui, &r, name);
        r.changed()
    })
    .inner
}
fn metres(value: &str) -> Result<f64, String> {
    let n = value
        .trim()
        .parse::<f64>()
        .map_err(|_| "Enter a numeric value")?
        * 0.001;
    if !n.is_finite() || n <= 0. {
        return Err("Value must be positive and finite".into());
    }
    Ok(n)
}
impl ImportUi {
    pub fn smoke_status(&self) -> (bool, bool, usize, bool) {
        (
            self.open,
            self.current(),
            self.selected.len(),
            self.acknowledged,
        )
    }
    pub fn begin(&mut self, template: &GarmentTemplate) {
        *self = Self {
            open: true,
            fabric: template
                .fabrics
                .first()
                .map(|f| f.id.clone())
                .unwrap_or_default(),
            ..Default::default()
        };
    }
    fn invalidate(&mut self) {
        self.drawing = None;
        self.reviewed = None;
        self.selected.clear();
        self.acknowledged = false;
    }
    pub fn choose(&mut self, path: &Path) {
        self.invalidate();
        self.source = None;
        match Source::load(path) {
            Ok(s) => {
                self.source = Some(s);
                self.refresh();
            }
            Err(e) => self.error = Some(e),
        }
    }
    fn refresh(&mut self) {
        self.invalidate();
        let result = (|| {
            svg_import::read_svg(
                &self.source.as_ref().ok_or("Choose an SVG file first")?.text,
                Options {
                    chord_error_m: metres(&self.tolerance_mm)?,
                },
            )
        })();
        match result {
            Ok(d) => {
                self.drawing = Some(d);
                self.reviewed = Some(self.tolerance_mm.clone());
                self.error = None;
            }
            Err(e) => self.error = Some(e),
        }
    }
    fn current(&self) -> bool {
        self.drawing.is_some() && self.reviewed.as_ref() == Some(&self.tolerance_mm)
    }
    pub fn prepare(&self, template: &GarmentTemplate, origin: glam::DVec3) -> Result<Edit, String> {
        if !self.current() || !self.acknowledged {
            return Err("Review the current outlines and losses before importing".into());
        }
        svg_import::prepare(
            template,
            self.drawing.as_ref().ok_or("No reviewed SVG")?,
            &self.selected.iter().copied().collect::<Vec<_>>(),
            &self.fabric,
            MeshingSettings {
                target_edge_m: metres(&self.mesh_mm)?,
                ..Default::default()
            },
            origin,
        )
    }
    pub fn show(&mut self, ctx: &egui::Context, template: &GarmentTemplate) -> Option<Action> {
        if !self.open {
            return None;
        }
        let action = egui::Modal::new(egui::Id::new("svg-import"))
            .show(ctx, |ui| self.controls(ui, template))
            .inner;
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Escape)) {
            Some(Action::Cancel)
        } else {
            action
        }
    }
    fn controls(&mut self, ui: &mut egui::Ui, template: &GarmentTemplate) -> Option<Action> {
        ui.set_width((ui.ctx().content_rect().width() - 64.).clamp(180., 620.));
        ui.heading("Import SVG patterns");
        let mut action = None;
        let height = (ui.ctx().content_rect().height() - 150.).clamp(100., 650.);
        egui::ScrollArea::vertical().id_salt("svg-details").auto_shrink([false,false]).max_height(height).min_scrolled_height(height).show(ui, |ui| {
            if button(ui, "svg.choose", "Choose SVG…", true) { action = Some(Action::Choose); }
            if let Some(s) = &self.source { ui.label(s.path.display().to_string()); }
            ui.small("Physical units required · +Y down · no automatic holes or sewing");
            if field(ui, "svg.tolerance", "Curve chord error (mm)", &mut self.tolerance_mm) { self.invalidate(); }
            if button(ui, "svg.refresh", "Update preview", self.source.is_some()) { self.refresh(); }
            if self.source.is_some() && !self.current() { ui.colored_label(egui::Color32::YELLOW, "Update preview and review the outlines again"); }
            if let Some(e) = &self.error { ui.colored_label(egui::Color32::LIGHT_RED, e); }
            if let Some(d) = &self.drawing {
                ui.label(format!("{} closed outlines · dimensions in millimetres", d.outlines.len()));
                preview(ui, d, &self.selected);
                ui.small("Display-only sampling; full geometry is used on Apply.");
                egui::ScrollArea::vertical().id_salt("svg-outlines").max_height(140.).show_rows(ui,22.,d.outlines.len(), |ui, rows| {
                    ui.style_mut().wrap_mode = Some(egui::TextWrapMode::Truncate);
                    for i in rows {
                        let p = &d.outlines[i]; let (lo,hi) = bounds(p.points.iter().copied()); let size = (hi-lo)*1000.;
                        let text = format!("{} · {} · {:.2} × {:.2} mm", i+1, p.name, size.x,size.y);
                        let mut selected = self.selected.contains(&i);
                        let r = ui.push_id(i, |ui| ui.checkbox(&mut selected, &text)).inner.on_hover_text(text);
                        named(ui,&r,&format!("svg.outline.{i}"));
                        if r.changed() { if selected { self.selected.insert(i); } else { self.selected.remove(&i); } self.acknowledged = false; }
                    }
                });
                ui.label("Conversion losses");
                for loss in &d.losses { ui.label(loss); }
            }
            field(ui,"svg.mesh","Mesh spacing (mm, 3–500)",&mut self.mesh_mm);
            egui::ComboBox::from_id_salt("svg-fabric").selected_text(template.fabrics.iter().find(|f|f.id==self.fabric).map(|f|f.name.as_str()).unwrap_or("Choose fabric")).show_ui(ui,|ui| {
                for f in &template.fabrics { let r=ui.selectable_value(&mut self.fabric,f.id.clone(),&f.name); named(ui,&r,&format!("svg.fabric.{}",f.id)); }
            });
            ui.small("New pieces are arranged to the right of the avatar and cloth. Existing panels keep their drape; caches rebuild. No seams are inferred.");
            let r=ui.checkbox(&mut self.acknowledged,"Accept these losses and import only the selected outlines"); named(ui,&r,"svg.acknowledge");
        });
        ui.separator();
        ui.horizontal(|ui| {
            if button(ui, "svg.cancel", "Cancel", true) {
                action = Some(Action::Cancel);
            }
            let mesh_ok = metres(&self.mesh_mm).is_ok_and(|n| (0.003..=0.5).contains(&n));
            let fabric_ok = template.fabrics.iter().any(|f| f.id == self.fabric);
            if button(
                ui,
                "svg.confirm",
                &format!("Add {} panel(s)", self.selected.len()),
                self.current()
                    && self.acknowledged
                    && !self.selected.is_empty()
                    && mesh_ok
                    && fabric_ok,
            ) {
                action = Some(Action::Confirm);
            }
        });
        action
    }
}
fn bounds(points: impl Iterator<Item = glam::DVec2>) -> (glam::DVec2, glam::DVec2) {
    points.fold(
        (
            glam::DVec2::splat(f64::INFINITY),
            glam::DVec2::splat(f64::NEG_INFINITY),
        ),
        |(lo, hi), p| (lo.min(p), hi.max(p)),
    )
}
fn preview(ui: &mut egui::Ui, d: &Drawing, selected: &BTreeSet<usize>) {
    let (rect, _) =
        ui.allocate_exact_size(egui::vec2(ui.available_width(), 130.), egui::Sense::hover());
    let (lo, hi) = bounds(d.outlines.iter().flat_map(|p| p.points.iter().copied()));
    if !lo.is_finite() || !hi.is_finite() {
        return;
    }
    let extent = hi - lo;
    let scale = ((rect.width() - 16.) as f64 / extent.x.max(1e-6))
        .min((rect.height() - 16.) as f64 / extent.y.max(1e-6));
    if !scale.is_finite() || scale <= 0. {
        return;
    }
    let pos = |p: glam::DVec2| {
        let q = (p - lo) * scale;
        rect.left_top() + egui::vec2(8. + q.x as f32, 8. + q.y as f32)
    };
    let painter = ui.painter_at(rect);
    for (i, p) in d.outlines.iter().enumerate() {
        let color = if selected.contains(&i) {
            egui::Color32::LIGHT_GREEN
        } else {
            egui::Color32::GRAY
        };
        let stride = p.points.len().div_ceil(128).max(1);
        let points: Vec<_> = p.points.iter().step_by(stride).copied().map(pos).collect();
        if points.len() >= 2 {
            painter.add(egui::Shape::closed_line(
                points,
                egui::Stroke::new(1., color),
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::authoring_smoke::widget_harness::Harness;
    use super::super::{DocumentUi, prepare_svg_edit};
    use super::*;
    use marvelous_cloth::{
        fitting::{FittingProject, FittingScene},
        garment::presets::GarmentKind,
    };
    struct Case {
        document: DocumentUi,
        project: FittingProject,
        scene: FittingScene,
        path: PathBuf,
        prepared: Option<Edit>,
        confirms: usize,
    }
    fn fixture(dir: &Path) -> Case {
        let avatar = dir.join("avatar.obj");
        std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
        let project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
        let scene = project.compile().unwrap();
        let path = dir.join("pattern.svg");
        std::fs::write(&path,r#"<svg xmlns="http://www.w3.org/2000/svg" width="300mm" height="300mm" viewBox="0 0 300 300"><polygon id="front" points="0,0 100,0 0,200"/><rect id="back" x="150" y="0" width="100" height="200"/></svg>"#).unwrap();
        let mut document = DocumentUi::new(dir, Some(dir.join("garment.json")), false);
        document.svg_import.begin(&project.template);
        Case {
            document,
            project,
            scene,
            path,
            prepared: None,
            confirms: 0,
        }
    }
    fn draw(ui: &mut egui::Ui, c: &mut Case) {
        match c.document.svg_import.show(ui.ctx(), &c.project.template) {
            Some(Action::Choose) => c.document.svg_import.choose(&c.path),
            Some(Action::Cancel) => c.document.svg_import = Default::default(),
            Some(Action::Confirm) => {
                match prepare_svg_edit(&c.document.svg_import, &c.project, &c.scene) {
                    Ok(edit) => {
                        c.prepared = Some(edit);
                        c.confirms += 1;
                        c.document.svg_import = Default::default();
                    }
                    Err(e) => c.document.svg_import.error = Some(e),
                }
            }
            None => {}
        }
    }
    fn frames(h: &mut Harness, c: &mut Case) {
        for _ in 0..4 {
            h.frame(c, &mut draw);
        }
    }
    #[test]
    fn named_review_invalidates_on_tolerance_then_prepares_once() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        let before = serde_json::to_vec(&c.project).unwrap();
        let mut h = Harness::new(egui::vec2(1000., 1100.));
        frames(&mut h, &mut c);
        h.click("svg.choose", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert!(h.click("svg.confirm", &mut c, &mut draw).is_err());
        h.click("svg.outline.0", &mut c, &mut draw).unwrap();
        h.click("svg.acknowledge", &mut c, &mut draw).unwrap();
        h.replace_text("svg.tolerance", "0.2", &mut c, &mut draw)
            .unwrap();
        assert!(c.document.svg_import.selected.is_empty());
        assert!(!c.document.svg_import.acknowledged);
        assert!(h.click("svg.confirm", &mut c, &mut draw).is_err());
        h.click("svg.refresh", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("svg.outline.0", &mut c, &mut draw).unwrap();
        h.click("svg.acknowledge", &mut c, &mut draw).unwrap();
        h.click("svg.confirm", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert_eq!(c.confirms, 1);
        let edit = c.prepared.as_ref().unwrap();
        let p = edit.template.panels.last().unwrap();
        assert!((p.pattern.width - 0.1).abs() < 1e-12);
        assert!((p.pattern.height - 0.2).abs() < 1e-12);
        assert!(p.placement.translation.x > 11.);
        let mut state = c.scene.state.clone();
        state.time = 3.;
        state.v.fill(glam::DVec3::new(0.1, 0.2, 0.3));
        let next = edit.state_after(&c.scene.garment, &state);
        assert_eq!(&next.x[..state.x.len()], &state.x);
        assert_eq!(&next.v[..state.v.len()], &state.v);
        assert_eq!(next.time, state.time);
        assert_eq!(serde_json::to_vec(&c.project).unwrap(), before);
        assert!(!c.document.dirty);
        let mut history = marvelous_cloth::authoring::History::default();
        history.record(c.project.template.clone());
        let undo = history.restore(&edit.template, false).unwrap();
        assert_eq!(
            serde_json::to_value(&undo.template).unwrap(),
            serde_json::to_value(&c.project.template).unwrap()
        );
        let redo = history.restore(&undo.template, true).unwrap();
        assert_eq!(redo.garment.mesh.uv, edit.garment.mesh.uv);
        let mut saved = c.project.clone();
        saved.template = edit.template.clone();
        saved.state = Some(next);
        let path = dir.path().join("imported.clothcraft");
        saved.save(&path).unwrap();
        let reopened = FittingProject::load(&path).unwrap();
        let compiled = reopened.compile().unwrap();
        assert_eq!(compiled.garment.mesh.uv, edit.garment.mesh.uv);
        assert_eq!(compiled.state.x, saved.state.as_ref().unwrap().x);
        assert_eq!(compiled.state.v, saved.state.as_ref().unwrap().v);
        assert!(reopened.avatar_path.is_file());
    }
    #[test]
    fn cancel_invalid_source_and_input_bound_preserve_document() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        let before = serde_json::to_vec(&c.project).unwrap();
        let mut h = Harness::new(egui::vec2(1000., 1100.));
        frames(&mut h, &mut c);
        h.click("svg.choose", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("svg.outline.0", &mut c, &mut draw).unwrap();
        h.click("svg.acknowledge", &mut c, &mut draw).unwrap();
        h.replace_text("svg.mesh", "NaN", &mut c, &mut draw)
            .unwrap();
        assert!(h.click("svg.confirm", &mut c, &mut draw).is_err());
        h.key(
            "svg.mesh",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(!c.document.svg_import.open);
        c.document.svg_import.begin(&c.project.template);
        std::fs::write(&c.path, "not SVG").unwrap();
        c.document.svg_import.choose(&c.path);
        assert!(c.document.svg_import.error.is_some());
        assert!(!c.document.svg_import.current());
        std::fs::write(&c.path, vec![b' '; MAX_BYTES as usize + 1]).unwrap();
        c.document.svg_import.choose(&c.path);
        assert!(
            c.document
                .svg_import
                .error
                .as_ref()
                .unwrap()
                .contains("3 MiB")
        );
        assert_eq!(serde_json::to_vec(&c.project).unwrap(), before);
        assert_eq!(c.confirms, 0);
    }

    #[test]
    fn crossing_outline_apply_fails_without_mutating_document() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        std::fs::write(&c.path, r#"<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="200mm" viewBox="0 0 100 200"><polygon points="0,0 100,200 0,200 100,0"/></svg>"#).unwrap();
        let before = serde_json::to_vec(&c.project).unwrap();
        let mut h = Harness::new(egui::vec2(1000., 1100.));
        frames(&mut h, &mut c);
        h.click("svg.choose", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("svg.outline.0", &mut c, &mut draw).unwrap();
        h.click("svg.acknowledge", &mut c, &mut draw).unwrap();
        h.click("svg.confirm", &mut c, &mut draw).unwrap();
        assert!(c.document.svg_import.error.is_some());
        assert_eq!(c.confirms, 0);
        assert!(c.prepared.is_none());
        assert_eq!(serde_json::to_vec(&c.project).unwrap(), before);
        assert!(!c.document.dirty);
        h.click("svg.cancel", &mut c, &mut draw).unwrap();
        assert!(!c.document.svg_import.open);
    }

    #[test]
    fn close_dismisses_svg_and_preserves_unsaved_flag() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        c.document.dirty = true;
        let ctx = egui::Context::default();
        let mut input = egui::RawInput::default();
        input
            .viewports
            .entry(egui::ViewportId::ROOT)
            .or_default()
            .events
            .push(egui::ViewportEvent::Close);
        let mut output = ctx.run_ui(input, |ui| c.document.dismiss_modals_for_close(ui.ctx()));
        output.textures_delta.clear();
        assert!(!c.document.svg_import.open);
        assert!(c.document.dirty);
        assert_eq!(c.confirms, 0);
    }
}
