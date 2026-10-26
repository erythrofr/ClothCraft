//! DXF review modal. No garment mutation until the document adapter accepts Apply.
use eframe::egui;
use marvelous_cloth::{
    authoring::Edit,
    garment::{
        GarmentTemplate,
        dxf_import::{Drawing, Options},
        meshing::MeshingSettings,
    },
    pattern_import::{self, Source},
};
use std::collections::BTreeSet;

pub(super) struct ImportUi {
    pub open: bool,
    source: Option<Source>,
    drawing: Option<Drawing>,
    selected: BTreeSet<usize>,
    scale_mm: String,
    tolerance_mm: String,
    mesh_mm: String,
    fabric: String,
    reviewed: Option<(String, String)>,
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
            scale_mm: String::new(),
            tolerance_mm: "0.1".into(),
            mesh_mm: "25".into(),
            fabric: String::new(),
            reviewed: None,
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

fn named(_ui: &egui::Ui, _response: &egui::Response, _name: &str) {
    #[cfg(test)]
    super::super::authoring_smoke::widget_harness::named(_ui, _response, _name);
}
fn button(ui: &mut egui::Ui, name: &str, label: &str, enabled: bool) -> bool {
    let r = ui
        .push_id(name, |ui| ui.add_enabled(enabled, egui::Button::new(label)))
        .inner;
    if name == "dxf.cancel" && !ui.ctx().egui_wants_keyboard_input() {
        r.request_focus();
    }
    named(ui, &r, name);
    r.clicked()
}
fn field(ui: &mut egui::Ui, name: &str, label: &str, value: &mut String) {
    ui.horizontal(|ui| {
        ui.label(label);
        let r = ui.add(
            egui::TextEdit::singleline(value)
                .id(egui::Id::new(name))
                .desired_width(80.),
        );
        named(ui, &r, name);
    });
}
fn millimetres(value: &str) -> Result<f64, String> {
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
    pub fn choose(&mut self, path: &std::path::Path) {
        self.drawing = None;
        self.source = None;
        self.selected.clear();
        self.reviewed = None;
        self.acknowledged = false;
        self.scale_mm.clear();
        match Source::load(path) {
            Ok(source) => {
                self.source = Some(source);
                self.refresh();
            }
            Err(e) => self.error = Some(e),
        }
    }
    fn refresh(&mut self) {
        self.drawing = None;
        self.reviewed = None;
        self.selected.clear();
        self.acknowledged = false;
        let result = (|| {
            let scale = if self.scale_mm.trim().is_empty() {
                None
            } else {
                Some(millimetres(&self.scale_mm)?)
            };
            let options = Options {
                metres_per_unit: scale,
                chord_error_m: millimetres(&self.tolerance_mm)?,
            };
            self.source
                .as_ref()
                .ok_or("Choose a DXF file first")?
                .inspect(options)
        })();
        match result {
            Ok(d) => {
                self.drawing = Some(d);
                self.reviewed = Some((self.scale_mm.clone(), self.tolerance_mm.clone()));
                self.error = None;
            }
            Err(e) => self.error = Some(e),
        }
    }
    fn current(&self) -> bool {
        self.reviewed.as_ref() == Some(&(self.scale_mm.clone(), self.tolerance_mm.clone()))
    }
    pub fn prepare(&self, template: &GarmentTemplate, origin: glam::DVec3) -> Result<Edit, String> {
        if !self.current() || !self.acknowledged {
            return Err("Review the current scale and selection before importing".into());
        }
        pattern_import::prepare(
            template,
            self.drawing.as_ref().ok_or("No reviewed drawing")?,
            &self.selected.iter().copied().collect::<Vec<_>>(),
            &self.fabric,
            MeshingSettings {
                target_edge_m: millimetres(&self.mesh_mm)?,
                ..Default::default()
            },
            origin,
        )
    }
    pub fn show(&mut self, ctx: &egui::Context, template: &GarmentTemplate) -> Option<Action> {
        if !self.open {
            return None;
        }
        let action = egui::Modal::new(egui::Id::new("pattern-import"))
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
        ui.heading("Import DXF patterns");
        let mut action = None;
        let height = (ui.ctx().content_rect().height() - 150.).clamp(100., 650.);
        egui::ScrollArea::vertical().id_salt("dxf-import-details").auto_shrink([false, false]).max_height(height).min_scrolled_height(height).show(ui,|ui| {
            if button(ui,"dxf.choose","Choose DXF…",true) { action=Some(Action::Choose); }
            if let Some(source)=&self.source { ui.label(source.path.display().to_string()); }
            ui.small("Generic planar DXF · no AAMA/ASTM, automatic holes or sewing inference");
            field(ui,"dxf.scale","mm per DXF unit (blank = file units)",&mut self.scale_mm);
            field(ui,"dxf.tolerance","Curve chord error (mm)",&mut self.tolerance_mm);
            if button(ui,"dxf.refresh","Update preview",self.source.is_some()) { self.refresh(); }
            if self.drawing.is_some() && !self.current() { ui.colored_label(egui::Color32::YELLOW,"Scale changed — update preview and review again"); }
            if let Some(error)=&self.error { ui.colored_label(egui::Color32::LIGHT_RED,error); }
            if let Some(d)=&self.drawing {
                ui.label(format!("{} paths · {} unsupported entities · {:.6} mm/unit{}",d.paths.len(),d.issues.len(),d.metres_per_unit*1000.,if d.scale_overridden {" (override)"} else {" (file units)"}));
                preview(ui,d,&self.selected);
                ui.small("Preview shows up to 128 paths with display-only sampling. Select closed outlines below.");
                egui::ScrollArea::vertical().id_salt("dxf-paths").max_height(140.).show_rows(ui,22.,d.paths.len(),|ui,rows| {
                    for i in rows {
                        let p=&d.paths[i]; let reason=pattern_import::contour_issue(p);
                        let mut checked=self.selected.contains(&i);
                        let r=ui.push_id(i,|ui|ui.add_enabled(reason.is_none(),egui::Checkbox::new(&mut checked,format!("{} · {} · {}{}",i+1,p.layer,p.entity,reason.map(|r|format!(" — {r}")).unwrap_or_default())))).inner;
                        named(ui,&r,&format!("dxf.path.{i}"));
                        if r.changed() { if checked {self.selected.insert(i);} else {self.selected.remove(&i);} self.acknowledged=false; }
                    }
                });
                egui::CollapsingHeader::new(format!("Unsupported entities ({})",d.issues.len())).show(ui,|ui| {
                    egui::ScrollArea::vertical().id_salt("dxf-issues").max_height(120.).show_rows(ui,22.,d.issues.len(),|ui,rows| {
                        for i in rows { let e=&d.issues[i]; ui.label(format!("{} · {}: {}",e.layer,e.entity,e.reason)); }
                    });
                });
            }
            field(ui,"dxf.mesh","Mesh spacing (mm, 3–500)",&mut self.mesh_mm);
            egui::ComboBox::from_id_salt("dxf-fabric").selected_text(template.fabrics.iter().find(|f|f.id==self.fabric).map(|f|f.name.as_str()).unwrap_or("Choose fabric")).show_ui(ui,|ui| {
                for f in &template.fabrics { ui.selectable_value(&mut self.fabric,f.id.clone(),&f.name); }
            });
            ui.small("Grain: 90°. New pieces are arranged to the right of the avatar and cloth. Existing unchanged panels keep their drape; simulation caches rebuild.");
            let r=ui.checkbox(&mut self.acknowledged,"Import only selected outlines; ignore all remaining paths and unsupported entities");
            named(ui,&r,"dxf.acknowledge");
        });
        ui.separator();
        ui.horizontal(|ui| {
            if button(ui, "dxf.cancel", "Cancel", true) {
                action = Some(Action::Cancel);
            }
            let mesh_ok = millimetres(&self.mesh_mm).is_ok_and(|n| (0.003..=0.5).contains(&n));
            if button(
                ui,
                "dxf.confirm",
                &format!("Add {} panel(s)", self.selected.len()),
                self.current() && self.acknowledged && !self.selected.is_empty() && mesh_ok,
            ) {
                action = Some(Action::Confirm);
            }
        });
        action
    }
}
fn preview(ui: &mut egui::Ui, d: &Drawing, selected: &BTreeSet<usize>) {
    let (rect, _) =
        ui.allocate_exact_size(egui::vec2(ui.available_width(), 130.), egui::Sense::hover());
    let points = d.paths.iter().take(128).flat_map(|p| p.points.iter());
    let mut lo = glam::DVec2::splat(f64::INFINITY);
    let mut hi = glam::DVec2::splat(f64::NEG_INFINITY);
    for &p in points {
        lo = lo.min(p);
        hi = hi.max(p);
    }
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
        let q = glam::DVec2::new(p.x - lo.x, hi.y - p.y) * scale;
        rect.left_top() + egui::vec2(8. + q.x as f32, 8. + q.y as f32)
    };
    let painter = ui.painter_at(rect);
    for (i, p) in d.paths.iter().take(128).enumerate() {
        let color = if selected.contains(&i) {
            egui::Color32::LIGHT_GREEN
        } else {
            egui::Color32::GRAY
        };
        let stride = p.points.len().div_ceil(64).max(1);
        for j in (0..p.points.len().saturating_sub(1)).step_by(stride) {
            painter.line_segment(
                [
                    pos(p.points[j]),
                    pos(p.points[(j + stride).min(p.points.len() - 1)]),
                ],
                egui::Stroke::new(1., color),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::authoring_smoke::widget_harness::Harness;
    use super::super::{DocumentUi, prepare_pattern_edit};
    use super::*;
    use marvelous_cloth::{
        fitting::{FittingProject, FittingScene},
        garment::presets::GarmentKind,
    };

    struct Case {
        document: DocumentUi,
        project: FittingProject,
        scene: FittingScene,
        path: std::path::PathBuf,
        prepared: Option<Edit>,
        confirms: usize,
    }
    fn fixture(dir: &std::path::Path, units: i32) -> Case {
        let avatar = dir.join("avatar.obj");
        std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
        let project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
        let scene = project.compile().unwrap();
        let path = dir.join("pattern.dxf");
        std::fs::write(&path,format!("0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n{units}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nCUT\n90\n4\n70\n1\n10\n0\n20\n0\n10\n100\n20\n0\n10\n100\n20\n200\n10\n0\n20\n200\n0\nLINE\n8\nSEW\n10\n0\n20\n0\n11\n100\n21\n0\n0\nENDSEC\n0\nEOF\n")).unwrap();
        let mut document = DocumentUi::new(dir, Some(dir.join("garment.json")), false);
        document.pattern_import.begin(&project.template);
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
        match c
            .document
            .pattern_import
            .show(ui.ctx(), &c.project.template)
        {
            Some(Action::Choose) => c.document.pattern_import.choose(&c.path),
            Some(Action::Cancel) => c.document.pattern_import = Default::default(),
            Some(Action::Confirm) => {
                match prepare_pattern_edit(&c.document.pattern_import, &c.project, &c.scene) {
                    Ok(edit) => {
                        c.prepared = Some(edit);
                        c.confirms += 1;
                        c.document.pattern_import = Default::default();
                    }
                    Err(e) => c.document.pattern_import.error = Some(e),
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
    fn named_units_selection_loss_acknowledgement_and_prepare() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path(), 0);
        let before = serde_json::to_vec(&c.project).unwrap();
        let mut h = Harness::new(egui::vec2(1000., 1000.));
        frames(&mut h, &mut c);
        h.click("dxf.choose", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert!(
            c.document
                .pattern_import
                .error
                .as_ref()
                .unwrap()
                .contains("scale")
        );
        assert!(h.click("dxf.confirm", &mut c, &mut draw).is_err());
        h.replace_text("dxf.scale", "1", &mut c, &mut draw).unwrap();
        h.click("dxf.refresh", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert!(h.click("dxf.path.1", &mut c, &mut draw).is_err()); // open sewing path
        h.click("dxf.path.0", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert!(h.click("dxf.confirm", &mut c, &mut draw).is_err());
        h.click("dxf.acknowledge", &mut c, &mut draw).unwrap();
        // Editing scale must invalidate a reviewed selection until refreshed.
        h.replace_text("dxf.scale", "2", &mut c, &mut draw).unwrap();
        assert!(h.click("dxf.confirm", &mut c, &mut draw).is_err());
        h.click("dxf.refresh", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert!(c.document.pattern_import.selected.is_empty());
        h.click("dxf.path.0", &mut c, &mut draw).unwrap();
        h.click("dxf.acknowledge", &mut c, &mut draw).unwrap();
        h.click("dxf.confirm", &mut c, &mut draw).unwrap();
        assert_eq!(c.confirms, 1);
        let e = c.prepared.as_ref().unwrap();
        let panel = e.template.panels.last().unwrap();
        assert!((panel.pattern.width - 0.2).abs() < 1e-12);
        assert!((panel.pattern.height - 0.4).abs() < 1e-12);
        assert!(panel.placement.translation.x > 11.);
        assert_eq!(serde_json::to_vec(&c.project).unwrap(), before); // preparation is atomic
        assert!(!c.document.dirty);
    }
    #[test]
    fn named_cancel_escape_and_invalid_mesh_do_not_prepare() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path(), 4);
        let before = serde_json::to_vec(&c.project).unwrap();
        let mut h = Harness::new(egui::vec2(1000., 1000.));
        frames(&mut h, &mut c);
        h.click("dxf.choose", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("dxf.path.0", &mut c, &mut draw).unwrap();
        h.click("dxf.acknowledge", &mut c, &mut draw).unwrap();
        h.replace_text("dxf.mesh", "NaN", &mut c, &mut draw)
            .unwrap();
        assert!(h.click("dxf.confirm", &mut c, &mut draw).is_err());
        h.key(
            "dxf.mesh",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(!c.document.pattern_import.open);
        assert_eq!(c.confirms, 0);
        assert_eq!(serde_json::to_vec(&c.project).unwrap(), before);
        c.document.pattern_import.begin(&c.project.template);
        h.resize(egui::vec2(640., 700.));
        frames(&mut h, &mut c);
        h.click("dxf.cancel", &mut c, &mut draw).unwrap();
        assert!(!c.document.pattern_import.open);
    }
    #[test]
    fn window_close_dismisses_dxf_without_marking_saved() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path(), 4);
        c.document.dirty = true;
        let ctx = egui::Context::default();
        let mut input = egui::RawInput::default();
        input
            .viewports
            .entry(egui::ViewportId::ROOT)
            .or_default()
            .events
            .push(egui::ViewportEvent::Close);
        let mut out = ctx.run_ui(input, |ui| c.document.dismiss_modals_for_close(ui.ctx()));
        out.textures_delta.clear();
        assert!(!c.document.pattern_import.open);
        assert!(c.document.dirty);
        assert_eq!(c.confirms, 0);
    }
}
