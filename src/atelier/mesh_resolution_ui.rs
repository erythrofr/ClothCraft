//! Opt-in research comparison UI. No references to mutable document/solver state.
use eframe::egui::{self, Color32, Vec2};
use marvelous_cloth::mesh_resolution::{Comparison, Experiment, Preset, Run, artifacts};
use std::{
    path::Path,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    time::Duration,
};

#[derive(Clone, Debug, PartialEq)]
struct Draft {
    preset: Preset,
    local_scale: f64,
    transition_mm: f64,
    seed: u64,
}
impl Default for Draft {
    fn default() -> Self {
        Self {
            preset: Preset::Skirt,
            local_scale: 0.5,
            transition_mm: 40.,
            seed: 42,
        }
    }
}
impl Draft {
    fn input(&self) -> Result<Experiment, String> {
        if !self.local_scale.is_finite()
            || !(0.1..=1.).contains(&self.local_scale)
            || !self.transition_mm.is_finite()
            || !(1. ..=500.).contains(&self.transition_mm)
        {
            return Err("Use local spacing ratio 0.1..1 and transition distance 1..500 mm".into());
        }
        let mut input = Experiment::preset(self.preset)?;
        let base = input.fabric.resolution(&input.calibration)?;
        for s in &mut input.sources {
            s.spacing_m = base.map(|r| r * self.local_scale);
            s.doubling_distance_m = self.transition_mm * 0.001;
        }
        input.options.seed = self.seed;
        Ok(input)
    }
}
struct Sample {
    draft: Draft,
    input: Experiment,
    comparison: Comparison,
}
struct Message {
    request: u64,
    result: Result<Arc<Sample>, String>,
}
#[derive(Clone)]
struct Job {
    receive: Arc<Mutex<mpsc::Receiver<Message>>>,
    cancel: Arc<AtomicBool>,
    request: u64,
}
#[derive(Clone)]
struct Lab {
    open: bool,
    draft: Draft,
    pending: Option<Job>,
    sample: Option<Arc<Sample>>,
    error: Option<String>,
    export_status: Option<String>,
    request: u64,
    wire: bool,
    colors: bool,
    tab: usize,
}
impl Default for Lab {
    fn default() -> Self {
        Self {
            open: false,
            draft: Draft::default(),
            pending: None,
            sample: None,
            error: None,
            export_status: None,
            request: 0,
            wire: true,
            colors: true,
            tab: 0,
        }
    }
}
impl Lab {
    fn poll(&mut self) {
        let Some(job) = self.pending.as_ref() else {
            return;
        };
        let result = job
            .receive
            .lock()
            .map(|r| r.try_recv())
            .unwrap_or(Err(mpsc::TryRecvError::Disconnected));
        match result {
            Ok(message) => {
                if message.request != job.request {
                    return;
                }
                let cancelled = job.cancel.load(Ordering::Relaxed);
                self.pending = None;
                if cancelled {
                    self.error = Some("Comparison cancelled. Previous results retained.".into());
                    return;
                }
                match message.result {
                    Ok(sample) => {
                        self.sample = Some(sample);
                        self.error = None;
                        self.export_status = None;
                    }
                    Err(error) => self.error = Some(error),
                }
            }
            Err(mpsc::TryRecvError::Disconnected) => {
                self.pending = None;
                self.error = Some(
                    "Comparison worker stopped without a result. Generate again to retry.".into(),
                );
            }
            Err(mpsc::TryRecvError::Empty) => {}
        }
    }
    fn start(&mut self, ctx: &egui::Context) {
        if self.pending.is_some() {
            return;
        }
        let input = match self.draft.input() {
            Ok(input) => input,
            Err(e) => {
                self.error = Some(e);
                return;
            }
        };
        self.request = self.request.wrapping_add(1);
        let request = self.request;
        let draft = self.draft.clone();
        let cancel = Arc::new(AtomicBool::new(false));
        let signal = cancel.clone();
        let (send, receive) = mpsc::channel();
        let ctx = ctx.clone();
        match std::thread::Builder::new()
            .name("mesh-resolution-lab".into())
            .spawn(move || {
                let result = input
                    .generate_with_cancel(true, &|| signal.load(Ordering::Relaxed))
                    .map(|comparison| {
                        Arc::new(Sample {
                            draft,
                            input,
                            comparison,
                        })
                    });
                let _ = send.send(Message { request, result });
                ctx.request_repaint();
            }) {
            Ok(_) => {
                self.pending = Some(Job {
                    receive: Arc::new(Mutex::new(receive)),
                    cancel,
                    request,
                });
                self.error = None;
            }
            Err(e) => self.error = Some(format!("Could not start CPU comparison: {e}")),
        }
    }
    fn cancel(&self) {
        if let Some(job) = &self.pending {
            job.cancel.store(true, Ordering::Relaxed);
        }
    }
    fn close(&mut self) {
        self.cancel();
        self.open = false;
    }
    fn fresh(&self) -> bool {
        self.sample.as_ref().is_some_and(|s| s.draft == self.draft)
    }
    fn export(&mut self, root: &Path) {
        if self.pending.is_some() || !self.fresh() {
            return;
        }
        let sample = self.sample.as_ref().unwrap();
        let path = root.join("mesh-resolution-lab");
        match artifacts::write_comparison(&path, &sample.input, &sample.comparison) {
            Ok(()) => self.export_status = Some(format!("Exported to {}", path.display())),
            Err(e) => {
                self.error = Some(format!("Export failed (earlier files may exist): {e}"));
                self.export_status = None;
            }
        }
    }
}
fn key() -> egui::Id {
    egui::Id::new("clothcraft.mesh-resolution-lab")
}
fn named(ui: &egui::Ui, response: &egui::Response, name: &str) {
    #[cfg(test)]
    super::super::authoring_smoke::widget_harness::named(ui, response, name);
    let _ = (ui, response, name);
}
fn button(ui: &mut egui::Ui, name: &str, title: &str, enabled: bool) -> bool {
    let r = ui
        .push_id(name, |ui| ui.add_enabled(enabled, egui::Button::new(title)))
        .inner;
    named(ui, &r, name);
    r.clicked()
}
pub(super) fn launch(ui: &mut egui::Ui, enabled: bool) {
    if button(ui, "mesh_lab.open", "Mesh resolution lab…", enabled) {
        let mut state = ui
            .ctx()
            .data(|d| d.get_temp::<Lab>(key()))
            .unwrap_or_default();
        state.open = true;
        ui.ctx().data_mut(|d| d.insert_temp(key(), state));
        ui.ctx().request_repaint();
    }
    ui.small("Compare predicted mesh density on sample panels. Pause simulation to open.");
}
/// Called before workspace input dispatch. Return the opening state so the
/// closing Escape/click frame cannot fall through to a garment operation.
pub(super) fn frame(ctx: &egui::Context, output: &Path) -> bool {
    let mut state = ctx.data(|d| d.get_temp::<Lab>(key())).unwrap_or_default();
    state.poll();
    let blocked = state.open;
    if state.open {
        let modal = egui::Modal::new(egui::Id::new("mesh-resolution-lab-modal"))
            .show(ctx, |ui| controls(ui, &mut state, output));
        if modal.should_close() {
            state.close();
        }
    }
    if state.pending.is_some() {
        ctx.request_repaint_after(Duration::from_millis(80));
    }
    ctx.data_mut(|d| d.insert_temp(key(), state));
    blocked
}

fn controls(ui: &mut egui::Ui, state: &mut Lab, output: &Path) {
    let width = (ui.ctx().content_rect().width() - 64.).clamp(240., 1120.);
    ui.set_width(width);
    ui.horizontal_wrapped(|ui| {
        ui.heading("Mesh resolution lab");
        if button(ui, "mesh_lab.close", "Close", true) {
            state.close();
        }
    });
    ui.label("Compare mesh density before simulation. These examples do not replace your garment.");
    egui::ScrollArea::vertical().max_height((ui.ctx().content_rect().height()-160.).max(120.)).show(ui,|ui| {
        ui.horizontal_wrapped(|ui| {
            for preset in Preset::ALL {
                let r=ui.selectable_label(state.draft.preset==preset,preset.label());
                named(ui,&r,&format!("mesh_lab.preset.{preset:?}"));
                if r.clicked() {
                    state.draft=Draft {preset,local_scale:if preset==Preset::Sleeve {0.6}else{0.5},transition_mm:if preset==Preset::Sleeve {60.}else{40.},..Default::default()};
                }
            }
        });
        ui.small(state.draft.preset.description());
        ui.horizontal_wrapped(|ui| {
            ui.label(if state.draft.preset==Preset::Sleeve {"Elbow spacing / base"}else{"Gather sewn/rest ratio"});
            let r=ui.add(egui::DragValue::new(&mut state.draft.local_scale).speed(0.01).max_decimals(3));named(ui,&r,"mesh_lab.ratio");
            ui.label("Double spacing after");
            let r=ui.add(egui::DragValue::new(&mut state.draft.transition_mm).speed(1.).suffix(" mm"));named(ui,&r,"mesh_lab.transition");
            ui.label("Seed");let r=ui.add(egui::DragValue::new(&mut state.draft.seed));named(ui,&r,"mesh_lab.seed");
        });
        let valid=state.draft.input();
        if let Err(error)=&valid {ui.colored_label(Color32::LIGHT_RED,error);}
        if let Ok(input)=&valid
            && let Ok(base)=input.fabric.resolution(&input.calibration) {
                ui.small(format!("Base spacing {:.2} × {:.2} mm · material axis {:.0}°",base[0]*1000.,base[1]*1000.,input.fabric.axis_degrees));
                ui.small(format!("Example E: {:.0} / {:.0} Pa · B: {:.2e} / {:.2e} N·m",input.fabric.young_pa[0],input.fabric.young_pa[1],input.fabric.bending_nm[0],input.fabric.bending_nm[1]));
        }
        ui.horizontal_wrapped(|ui| {
            if button(ui,"mesh_lab.generate","Generate comparison",state.pending.is_none()&&valid.is_ok()) {state.start(ui.ctx());}
            if button(ui,"mesh_lab.cancel","Cancel computation",state.pending.is_some()) {state.cancel();}
            if button(ui,"mesh_lab.export","Export meshes",state.pending.is_none()&&state.fresh()) {state.export(output);}
            ui.checkbox(&mut state.wire,"Wireframe");ui.checkbox(&mut state.colors,"Sizing colors");
        });
        if state.pending.is_some() {ui.horizontal(|ui|{ui.spinner();ui.label("Generating on CPU…");});}
        if let Some(error)=&state.error {ui.colored_label(Color32::LIGHT_RED,error);}
        if let Some(status)=&state.export_status {ui.label(status);}
        if let Some(sample)=&state.sample {
            if !state.fresh() {ui.colored_label(Color32::YELLOW,"Settings changed. Showing previous results; generate again before exporting.");}
            if let Some(percent)=sample.comparison.vertex_reduction_percent() {
                ui.strong(format!("{percent:.1}% fewer vertices than uniform fine spacing"));
            }
            ui.small("This compares meshes, not wrinkle quality or simulation speed. Generation time is complete CPU wall time.");
            let order=["uniform-base","adaptive","uniform-fine"];
            let runs:Vec<_>=order.iter().filter_map(|name|sample.comparison.runs.iter().find(|r|r.name==*name)).collect();
            if width>=780. {
                ui.columns(3,|cols|{for (col,run) in cols.iter_mut().zip(&runs) {pane(col,run,&sample.input,state.wire,state.colors,320.);}});
            } else {
                ui.horizontal_wrapped(|ui|{for (i,title) in ["Coarse","Adaptive","Fine"].iter().enumerate(){let r=ui.selectable_value(&mut state.tab,i,*title);named(ui,&r,&format!("mesh_lab.view.{i}"));}});
                if let Some(run)=runs.get(state.tab) {pane(ui,run,&sample.input,state.wire,state.colors,280.);}
            }
        } else {ui.label("Choose an example, then Generate comparison. No mesh is built while typing.");}
        ui.small("Research estimate: explicit Pa inputs, manually labelled features, no calibrated wrinkle-accuracy claim.");
    });
}

fn pane(ui: &mut egui::Ui, run: &Run, input: &Experiment, wire: bool, colors: bool, height: f32) {
    ui.strong(match run.name.as_str() {
        "uniform-base" => "Uniform coarse",
        "uniform-fine" => "Uniform fine",
        _ => "Adaptive",
    });
    let q = &run.output.quality;
    ui.small(format!(
        "{} vertices · {} triangles",
        q.vertices, q.triangles
    ));
    ui.small(format!(
        "{:.1} ms · {:.5} m²",
        run.mesh_generation_ms, q.area_m2
    ));
    ui.small(format!(
        "Min metric angle {:.1}°",
        q.min_metric_angle_degrees
    ));
    let (rect, _) = ui.allocate_exact_size(
        Vec2::new(ui.available_width().max(40.), height),
        egui::Sense::hover(),
    );
    let painter = ui.painter_at(rect);
    painter.rect_filled(rect, 3., Color32::from_rgb(245, 247, 250));
    let lo = input
        .domain
        .outer
        .points
        .iter()
        .copied()
        .fold(glam::DVec2::splat(f64::INFINITY), glam::DVec2::min);
    let hi = input
        .domain
        .outer
        .points
        .iter()
        .copied()
        .fold(glam::DVec2::splat(f64::NEG_INFINITY), glam::DVec2::max);
    let extent = hi - lo;
    let scale = ((rect.width() - 18.) as f64 / extent.x)
        .min((rect.height() - 18.) as f64 / extent.y) as f32;
    let center = (lo + hi) * 0.5;
    let pos = |p: glam::DVec2| {
        rect.center() + Vec2::new((p.x - center.x) as f32, (p.y - center.y) as f32) * scale
    };
    let map = input.map().expect("completed input has a valid sizing map");
    let min = map.finest();
    let max = map.base().into_iter().fold(0., f64::max);
    let mut triangles = egui::Mesh::default();
    for (p, h) in run.output.uv.iter().zip(&run.output.spacing_m) {
        let t = ((h[0].min(h[1]) - min) / (max - min).max(1e-12)).clamp(0., 1.);
        let color = if colors {
            Color32::from_rgb(
                (40. + 150. * t) as u8,
                (125. + 90. * t) as u8,
                (185. + 45. * t) as u8,
            )
        } else {
            Color32::from_rgb(185, 210, 225)
        };
        triangles.colored_vertex(pos(*p), color);
    }
    for f in &run.output.faces {
        triangles.add_triangle(f[0] as u32, f[1] as u32, f[2] as u32);
    }
    painter.add(egui::Shape::mesh(triangles));
    if wire {
        for f in &run.output.faces {
            for i in 0..3 {
                painter.line_segment(
                    [pos(run.output.uv[f[i]]), pos(run.output.uv[f[(i + 1) % 3]])],
                    egui::Stroke::new(0.45, Color32::from_rgb(45, 65, 80)),
                );
            }
        }
    }
    for chain in run.output.boundaries.values() {
        for w in chain.windows(2) {
            painter.line_segment(
                [pos(run.output.uv[w[0]]), pos(run.output.uv[w[1]])],
                egui::Stroke::new(1.3, Color32::from_rgb(220, 115, 35)),
            );
        }
    }
}

#[derive(Clone)]
struct PreparationDraft {
    panel: String,
    young: [String; 2],
    ratio: String,
    transition_mm: String,
    all: bool,
}
pub(super) struct PrepareRequest {
    pub panels: Vec<String>,
    pub young_pa: [f64; 2],
    pub ratio: f64,
    pub transition_m: f64,
    pub physics: bool,
}
/// Draft numeric values are separate from the committed meshing plan. Merely
/// opening the inspector or changing a field never compiles or resets cloth.
pub(super) fn preparation_controls(
    ui: &mut egui::Ui,
    template: &marvelous_cloth::garment::GarmentTemplate,
    selected: Option<&str>,
    enabled: bool,
) -> Option<PrepareRequest> {
    ui.strong("Physics-inspired mesh preparation");
    let selected_panel = template
        .panels
        .iter()
        .find(|p| Some(p.id.as_str()) == selected && p.polygon.is_some());
    let Some(panel) =
        selected_panel.or_else(|| template.panels.iter().find(|p| p.polygon.is_some()))
    else {
        ui.small("Add an editable polygon piece to prepare a physics-inspired simulation mesh.");
        return None;
    };
    let id = egui::Id::new("clothcraft.mesh-preparation-draft");
    let mut draft = ui
        .ctx()
        .data(|d| d.get_temp::<PreparationDraft>(id))
        .filter(|d| d.panel == panel.id)
        .unwrap_or_else(|| {
            let plan = panel
                .polygon
                .as_ref()
                .and_then(|p| p.meshing.as_ref())
                .and_then(|m| m.physics_sizing.as_ref());
            PreparationDraft {
                panel: panel.id.clone(),
                young: plan
                    .map(|p| p.young_pa.map(|v| v.to_string()))
                    .unwrap_or(["110000".into(), "110000".into()]),
                ratio: plan.map_or("0.5".into(), |p| p.boundary_ratio.to_string()),
                transition_mm: plan.map_or("40".into(), |p| (p.transition_m * 1000.).to_string()),
                all: true,
            }
        });
    ui.label("Build once before running. The mesh stays fixed throughout simulation.");
    ui.small("Bending stiffness and grain come from each piece's fabric. E below is an explicit sizing estimate in Pa; it does not change simulation stiffness.");
    for (i, label) in ["Warp E (Pa)", "Weft E (Pa)"].iter().enumerate() {
        ui.horizontal(|ui| {
            ui.label(*label);
            let r = ui.add(
                egui::TextEdit::singleline(&mut draft.young[i])
                    .id_salt(("prepare-young", i))
                    .desired_width(90.),
            );
            named(ui, &r, &format!("mesh_prepare.young.{i}"));
        });
    }
    for (label, value, key) in [
        (
            "Boundary/base spacing",
            &mut draft.ratio,
            "mesh_prepare.ratio",
        ),
        (
            "Transition distance (mm)",
            &mut draft.transition_mm,
            "mesh_prepare.transition",
        ),
    ] {
        ui.horizontal(|ui| {
            ui.label(label);
            let r = ui.add(
                egui::TextEdit::singleline(value)
                    .id_salt(key)
                    .desired_width(65.),
            );
            named(ui, &r, key);
        });
    }
    if selected_panel.is_none() {
        draft.all = true;
    }
    let scope = ui.add_enabled(
        selected_panel.is_some(),
        egui::Checkbox::new(&mut draft.all, "All polygon pieces"),
    );
    named(ui, &scope, "mesh_prepare.all");
    if selected_panel.is_none() {
        ui.small("Select a polygon piece to prepare only that piece.");
    }
    let panels: Vec<_> = if draft.all {
        template
            .panels
            .iter()
            .filter(|p| p.polygon.is_some())
            .map(|p| p.id.clone())
            .collect()
    } else {
        vec![panel.id.clone()]
    };
    let parsed = (|| -> Result<([f64; 2], f64, f64), String> {
        let number = |s: &str| {
            s.trim()
                .parse::<f64>()
                .map_err(|_| "Enter finite numeric sizing values".to_owned())
        };
        let e = [number(&draft.young[0])?, number(&draft.young[1])?];
        let ratio = number(&draft.ratio)?;
        let transition = number(&draft.transition_mm)? * 0.001;
        marvelous_cloth::mesh_resolution::preparation::configure(
            template, &panels, e, ratio, transition, true,
        )?;
        Ok((e, ratio, transition))
    })();
    if let Err(error) = &parsed {
        ui.colored_label(Color32::LIGHT_RED, error);
    }
    ui.small("Prepare resets cloth to its flat arrangement. Cancel any unfinished drawing or placement first.");
    if !enabled {
        ui.small("Pause simulation and finish or cancel edits before preparing a mesh.");
    }
    let mut action = None;
    if button(
        ui,
        "mesh_prepare.apply",
        "Prepare mesh and reset",
        enabled && parsed.is_ok(),
    ) {
        let (young_pa, ratio, transition_m) = parsed.as_ref().unwrap();
        action = Some(PrepareRequest {
            panels: panels.clone(),
            young_pa: *young_pa,
            ratio: *ratio,
            transition_m: *transition_m,
            physics: true,
        });
    }
    if button(
        ui,
        "mesh_prepare.uniform",
        "Use uniform mesh and reset",
        enabled,
    ) {
        action = Some(PrepareRequest {
            panels,
            young_pa: [1.; 2],
            ratio: 1.,
            transition_m: 0.04,
            physics: false,
        });
    }
    ui.ctx().data_mut(|d| d.insert_temp(id, draft));
    action
}

#[cfg(test)]
mod preparation_tests {
    use super::super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    use marvelous_cloth::garment::presets::{self, GarmentKind};
    #[test]
    fn preparation_without_selection_targets_all_polygons_at_inspector_width() {
        let mut template = presets::basic(GarmentKind::Tshirt, 0);
        let panels: Vec<_> = template.panels.iter().map(|p| p.id.clone()).collect();
        let mut legacy = template.panels[0].clone();
        legacy.id = "legacy-rectangle".into();
        legacy.polygon = None;
        template.panels.push(legacy);
        let before = serde_json::to_value(&template).unwrap();
        let mut actions = Vec::<PrepareRequest>::new();
        let mut harness = Harness::new(Vec2::new(240., 850.));
        let mut draw = |ui: &mut egui::Ui, actions: &mut Vec<PrepareRequest>| {
            if let Some(action) = preparation_controls(ui, &template, None, true) {
                actions.push(action);
            }
        };
        harness.frame(&mut actions, &mut draw);
        assert!(actions.is_empty());
        harness
            .click("mesh_prepare.apply", &mut actions, &mut draw)
            .unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].panels, panels);
        assert!(actions[0].physics);
        harness
            .click("mesh_prepare.uniform", &mut actions, &mut draw)
            .unwrap();
        assert_eq!(actions.len(), 2);
        assert_eq!(actions[1].panels, panels);
        assert!(!actions[1].physics);
        assert_eq!(before, serde_json::to_value(&template).unwrap());
    }

    #[test]
    fn clearing_selection_restores_all_piece_preparation_scope() {
        let template = presets::basic(GarmentKind::Tshirt, 0);
        let selected = template.panels[0].id.clone();
        let mut state = (Some(selected.clone()), Vec::<PrepareRequest>::new());
        let mut harness = Harness::new(Vec2::new(280., 850.));
        let mut draw = |ui: &mut egui::Ui, state: &mut (Option<String>, Vec<PrepareRequest>)| {
            if let Some(action) = preparation_controls(ui, &template, state.0.as_deref(), true) {
                state.1.push(action);
            }
        };
        harness.frame(&mut state, &mut draw);
        harness
            .click("mesh_prepare.all", &mut state, &mut draw)
            .unwrap();
        harness
            .click("mesh_prepare.apply", &mut state, &mut draw)
            .unwrap();
        assert_eq!(state.1[0].panels, vec![selected]);
        state.0 = None;
        harness.frame(&mut state, &mut draw);
        harness
            .click("mesh_prepare.apply", &mut state, &mut draw)
            .unwrap();
        assert_eq!(state.1.len(), 2);
        assert_eq!(
            state.1[1].panels,
            template
                .panels
                .iter()
                .map(|p| p.id.clone())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn preparation_fields_require_explicit_apply_and_running_disables_it() {
        let template = presets::basic(GarmentKind::Tshirt, 0);
        let before = serde_json::to_value(&template).unwrap();
        let selected = template.panels[0].id.clone();
        let mut state = (Vec::<PrepareRequest>::new(), true);
        let mut harness = Harness::new(Vec2::new(500., 850.));
        let mut draw = |ui: &mut egui::Ui, state: &mut (Vec<PrepareRequest>, bool)| {
            if let Some(action) = preparation_controls(ui, &template, Some(&selected), state.1) {
                state.0.push(action);
            }
        };
        harness.frame(&mut state, &mut draw);
        harness
            .replace_text("mesh_prepare.young.0", "NaN", &mut state, &mut draw)
            .unwrap();
        assert!(
            harness
                .click("mesh_prepare.apply", &mut state, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        assert!(state.0.is_empty());
        harness
            .replace_text("mesh_prepare.young.0", "220000", &mut state, &mut draw)
            .unwrap();
        harness
            .key(
                "mesh_prepare.young.0",
                egui::Key::Enter,
                egui::Modifiers::NONE,
                &mut state,
                &mut draw,
            )
            .unwrap();
        assert!(state.0.is_empty());
        harness
            .click("mesh_prepare.apply", &mut state, &mut draw)
            .unwrap();
        assert_eq!(state.0.len(), 1);
        assert_eq!(state.0[0].young_pa, [220000., 110000.]);
        assert!(state.0[0].physics);
        state.1 = false;
        harness.frame(&mut state, &mut draw);
        assert!(
            harness
                .click("mesh_prepare.apply", &mut state, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        assert_eq!(before, serde_json::to_value(&template).unwrap());
    }
}

#[cfg(test)]
mod visual_preview {
    use super::*;
    /// CPU rasterization of the real egui tessellation; no window or GPU.
    #[test]
    #[ignore = "explicit CPU layout capture"]
    fn export_mesh_lab_cpu_preview() {
        let width = 1200;
        let height = 850;
        let ctx = egui::Context::default();
        let mut state = Lab {
            open: true,
            ..Default::default()
        };
        let input = state.draft.input().unwrap();
        let comparison = input.generate(true).unwrap();
        state.sample = Some(Arc::new(Sample {
            draft: state.draft.clone(),
            input,
            comparison,
        }));
        let mut textures = std::collections::HashMap::<egui::TextureId, egui::ColorImage>::new();
        let mut final_output = None;
        for frame in 0..3 {
            let mut out = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        Vec2::new(width as f32, height as f32),
                    )),
                    time: Some(frame as f64),
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        controls(ui, &mut state, Path::new("output/pie-preview"))
                    });
                },
            );
            for (id, deltas) in &out.textures_delta.set {
                for delta in deltas {
                    let egui::ImageData::Color(data) = &delta.image;
                    if let Some([x, y]) = delta.pos {
                        let texture = textures.get_mut(id).unwrap();
                        for row in 0..data.size[1] {
                            for col in 0..data.size[0] {
                                let index = (y + row) * texture.size[0] + x + col;
                                texture.pixels[index] = data.pixels[row * data.size[0] + col];
                            }
                        }
                    } else {
                        textures.insert(*id, data.as_ref().clone());
                    }
                }
            }
            out.textures_delta.clear();
            final_output = Some(out);
        }
        let mut canvas =
            image::RgbaImage::from_pixel(width, height, image::Rgba([24, 24, 24, 255]));
        let output = final_output.unwrap();
        for clipped in ctx.tessellate(output.shapes, output.pixels_per_point) {
            let egui::epaint::Primitive::Mesh(mesh) = clipped.primitive else {
                continue;
            };
            let texture = &textures[&mesh.texture_id];
            for f in mesh.indices.chunks_exact(3) {
                let v = [
                    &mesh.vertices[f[0] as usize],
                    &mesh.vertices[f[1] as usize],
                    &mesh.vertices[f[2] as usize],
                ];
                let cross = |a: Vec2, b: Vec2| a.x * b.y - a.y * b.x;
                let det = cross(v[1].pos - v[0].pos, v[2].pos - v[0].pos);
                if det.abs() < 1e-8 {
                    continue;
                }
                let lo = v
                    .iter()
                    .map(|v| v.pos)
                    .fold(
                        egui::Pos2::new(f32::INFINITY, f32::INFINITY),
                        egui::Pos2::min,
                    )
                    .max(clipped.clip_rect.min);
                let hi = v
                    .iter()
                    .map(|v| v.pos)
                    .fold(
                        egui::Pos2::new(f32::NEG_INFINITY, f32::NEG_INFINITY),
                        egui::Pos2::max,
                    )
                    .min(clipped.clip_rect.max);
                for y in (lo.y.floor().max(0.) as u32)..(hi.y.ceil().min(height as f32) as u32) {
                    for x in (lo.x.floor().max(0.) as u32)..(hi.x.ceil().min(width as f32) as u32) {
                        let p = egui::pos2(x as f32 + 0.5, y as f32 + 0.5);
                        let a = cross(v[1].pos - p, v[2].pos - p) / det;
                        let b = cross(v[2].pos - p, v[0].pos - p) / det;
                        let c = 1. - a - b;
                        if a < 0. || b < 0. || c < 0. {
                            continue;
                        }
                        let uv =
                            v[0].uv.to_vec2() * a + v[1].uv.to_vec2() * b + v[2].uv.to_vec2() * c;
                        let tx = (uv.x * texture.size[0] as f32) as usize;
                        let ty = (uv.y * texture.size[1] as f32) as usize;
                        let tex = texture.pixels[ty.min(texture.size[1] - 1) * texture.size[0]
                            + tx.min(texture.size[0] - 1)]
                        .to_array();
                        let colors = v.map(|v| v.color.to_array());
                        let source = std::array::from_fn::<_, 4, _>(|i| {
                            (colors[0][i] as f32 * a
                                + colors[1][i] as f32 * b
                                + colors[2][i] as f32 * c)
                                * tex[i] as f32
                                / 255.
                        });
                        let dest = canvas.get_pixel_mut(x, y);
                        for i in 0..3 {
                            dest[i] = (source[i] + dest[i] as f32 * (1. - source[3] / 255.))
                                .clamp(0., 255.) as u8;
                        }
                    }
                }
            }
        }
        std::fs::create_dir_all("output/pie-preview").unwrap();
        canvas.save("output/pie-preview/mesh-lab.png").unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    use std::time::Instant;
    fn finish(state: &mut Lab) {
        let start = Instant::now();
        while state.pending.is_some() {
            assert!(start.elapsed() < Duration::from_secs(10));
            std::thread::sleep(Duration::from_millis(1));
            state.poll();
        }
    }
    fn small() -> Lab {
        Lab {
            open: true,
            draft: Draft {
                preset: Preset::Shirring,
                ..Default::default()
            },
            ..Default::default()
        }
    }
    #[test]
    fn named_generation_export_and_stale_result_controls() {
        let dir = tempfile::tempdir().unwrap();
        let mut state = small();
        let mut harness = Harness::new(Vec2::new(1180., 850.));
        let mut draw = |ui: &mut egui::Ui, state: &mut Lab| controls(ui, state, dir.path());
        harness.frame(&mut state, &mut draw);
        assert!(state.pending.is_none() && state.sample.is_none());
        harness
            .click("mesh_lab.generate", &mut state, &mut draw)
            .unwrap();
        finish(&mut state);
        assert!(state.fresh());
        harness.frame(&mut state, &mut draw);
        harness
            .click("mesh_lab.export", &mut state, &mut draw)
            .unwrap();
        assert!(dir.path().join("mesh-resolution-lab/adaptive.obj").exists());
        state.draft.transition_mm += 10.;
        harness.frame(&mut state, &mut draw);
        assert!(!state.fresh());
        assert!(
            harness
                .click("mesh_lab.export", &mut state, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
    }
    #[test]
    fn cancellation_and_close_preserve_previous_results() {
        let mut state = small();
        let ctx = egui::Context::default();
        state.start(&ctx);
        finish(&mut state);
        let previous = state.sample.clone().unwrap();
        state.draft.transition_mm += 1.;
        state.start(&ctx);
        state.cancel();
        finish(&mut state);
        assert!(Arc::ptr_eq(state.sample.as_ref().unwrap(), &previous));
        assert!(state.error.as_ref().unwrap().contains("cancelled"));
        state.start(&ctx);
        state.close();
        assert!(!state.open);
        finish(&mut state);
        assert!(Arc::ptr_eq(state.sample.as_ref().unwrap(), &previous));
    }
    #[test]
    fn invalid_inputs_disable_generation_and_narrow_controls_work() {
        let mut state = small();
        state.draft.local_scale = f64::NAN;
        let mut harness = Harness::new(Vec2::new(420., 850.));
        let mut draw =
            |ui: &mut egui::Ui, state: &mut Lab| controls(ui, state, Path::new("unused"));
        harness.frame(&mut state, &mut draw);
        assert!(
            harness
                .click("mesh_lab.generate", &mut state, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        assert!(state.pending.is_none());
        state.draft.local_scale = 0.5;
        harness.frame(&mut state, &mut draw);
        harness
            .click("mesh_lab.generate", &mut state, &mut draw)
            .unwrap();
        finish(&mut state);
        harness.frame(&mut state, &mut draw);
        harness
            .click("mesh_lab.view.2", &mut state, &mut draw)
            .unwrap();
        assert_eq!(state.tab, 2);
    }
}
