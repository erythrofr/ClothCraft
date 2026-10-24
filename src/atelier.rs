//! Garment workspace: library | 3D | 2D patterns | properties.
use crate::render::{Camera, DrawModel, Viewport};
use eframe::egui::{self, Color32, Stroke, Vec2};
use marvelous_cloth::{
    fitting::{FittingProject, FittingScene},
    garment::{export, presets::GarmentKind},
    picking,
    vbd::{Grab, VbdMetrics, VbdSettings},
};
use std::{path::PathBuf, sync::mpsc, time::Duration};
#[path = "atelier/authoring_smoke.rs"]
mod authoring_smoke;
#[path = "atelier/authoring_ui.rs"]
mod authoring_ui;
#[path = "atelier/board.rs"]
mod board;
#[path = "atelier/chrome.rs"]
mod chrome;
#[path = "atelier/commands.rs"]
mod commands;
#[path = "atelier/documents_ui.rs"]
mod documents_ui;
#[path = "atelier/drafting_ui.rs"]
mod drafting_ui;
#[path = "atelier/edges_3d.rs"]
mod edges_3d;
#[path = "atelier/fabrics_ui.rs"]
mod fabrics_ui;
#[path = "atelier/gizmo.rs"]
mod gizmo;
#[path = "atelier/icons.rs"]
mod icons;
#[path = "atelier/issue_ui.rs"]
mod issue_ui;
#[path = "atelier/layout.rs"]
mod layout;
#[path = "atelier/measure.rs"]
mod measure;
#[path = "atelier/perf.rs"]
mod perf;
#[path = "atelier/quick_actions.rs"]
mod quick_actions;
#[path = "atelier/radial.rs"]
mod radial;
#[path = "atelier/seam_links.rs"]
mod seam_links;
#[path = "atelier/seams_ui.rs"]
mod seams_ui;
#[path = "atelier/selection.rs"]
mod selection;
#[path = "atelier/settings.rs"]
mod settings;
#[path = "atelier/sewing_ui.rs"]
mod sewing_ui;
#[cfg(test)]
#[path = "atelier/ui_preview.rs"]
mod ui_preview;
#[path = "atelier/view_controls.rs"]
mod view_controls;
#[path = "atelier/worker.rs"]
mod worker;
#[path = "atelier/workspace.rs"]
mod workspace;
use authoring_ui::{AuthoringUi, Tool};
use worker::Work;
fn camera() -> Camera {
    Camera {
        yaw: 0.10,
        pitch: 0.05,
        distance: 2.75,
        target: glam::Vec3::new(0., 0.95, 0.),
        ..Default::default()
    }
}
pub struct DocumentFiles {
    pub output: PathBuf,
    pub source: Option<PathBuf>,
    pub modified: bool,
}
pub fn run(
    project: FittingProject,
    scene: FittingScene,
    files: DocumentFiles,
    smoke: bool,
    drag_test: bool,
    perf_test: bool,
    authoring_test: bool,
) -> Result<(), String> {
    let output = files.output;
    let smoke_report = output.join("interaction.json");
    let authoring_report = output.join("authoring.json");
    let perf_report = output.join("ui-perf.json");
    let smoke_size = (smoke || drag_test || perf_test || authoring_test)
        .then(|| std::env::var("CLOTHCRAFT_SMOKE_SIZE").ok())
        .flatten()
        .and_then(|v| {
            let (w, h) = v.split_once('x')?;
            let (w, h) = (w.parse::<u32>().ok()?, h.parse::<u32>().ok()?);
            ((1100..=3840).contains(&w) && (700..=2160).contains(&h))
                .then_some([w as f32, h as f32])
        });
    let icon =
        eframe::icon_data::from_png_bytes(include_bytes!("../assets/branding/clothcraft-icon.png"))
            .map_err(|error| format!("Cannot decode the bundled ClothCraft icon: {error}"))?;
    let mut wgpu_options = eframe::egui_wgpu::WgpuConfiguration::default();
    if let eframe::egui_wgpu::WgpuSetup::CreateNew(setup) = &mut wgpu_options.wgpu_setup {
        let base = setup.device_descriptor.clone();
        setup.device_descriptor = std::sync::Arc::new(move |adapter| {
            let mut descriptor = base(adapter);
            descriptor.required_features |= adapter.features()
                & (eframe::wgpu::Features::TIMESTAMP_QUERY | eframe::wgpu::Features::SUBGROUP);
            descriptor
        });
    }
    let options = eframe::NativeOptions {
        wgpu_options,
        renderer: eframe::Renderer::Wgpu,
        viewport: egui::ViewportBuilder::default()
            .with_icon(icon)
            .with_inner_size(smoke_size.unwrap_or([1600., 980.]))
            .with_min_inner_size([1100., 700.]),
        ..Default::default()
    };
    eframe::run_native(
        "ClothCraft | Simulation Studio",
        options,
        Box::new(move |cc| {
            let render = cc.wgpu_render_state.clone().ok_or("wgpu unavailable")?;
            // Preferences choose the theme and the startup display defaults, so
            // they are loaded and applied before the first frame is drawn.
            // Applying them afterwards would show a flash of the wrong theme.
            let prefs = settings::load(&output.join(settings::FILE_NAME));
            settings::apply(&cc.egui_ctx, &prefs);
            // Copy the startup values out before `prefs` moves into the struct.
            let (wire, seam_links) = (prefs.wireframe, prefs.seam_links);
            let (dt, iterations) = (prefs.dt, prefs.iterations);
            let simulation = project.simulation.clone().unwrap_or(VbdSettings {
                dt,
                iterations,
                ..Default::default()
            });
            let mut authoring = AuthoringUi {
                tool: if drag_test || perf_test {
                    Tool::Grab
                } else {
                    Tool::Edit
                },
                ..Default::default()
            };
            authoring.board.snap_mm = prefs.snap_mm;
            let (tx, receive) = worker::start(render.device.clone(), render.queue.clone())?;
            let m = project
                .template
                .panels
                .iter()
                .find_map(|p| p.polygon.as_ref())
                .map(|p| p.meshing_settings())
                .unwrap_or_default();
            Ok(Box::new(Atelier {
                document: documents_ui::DocumentUi::new(&output, files.source, files.modified),
                issue: Default::default(),
                quick: Default::default(),
                authoring,
                prefs,
                settings_open: false,
                prefs_dirty: false,
                inspector_tab: chrome::InspectorTab::Piece,
                authoring_smoke: authoring_test.then(authoring_smoke::Smoke::new),
                mesh_mm: m.target_edge_m * 1000.,
                anisotropy: m.anisotropy,
                mesh_axis: m.axis_degrees,
                project,
                smoke_initial: if drag_test {
                    scene.state.x.clone()
                } else {
                    Vec::new()
                },
                scene,
                output,
                viewport: Viewport::new(render),
                camera: camera(),
                send: tx,
                receive,
                generation: 0,
                pending: false,
                playing: perf_test,
                wire,
                heat: false,
                seams: false,
                seam_links,
                clean_view: false,
                gpu: true,
                settings: simulation,
                metrics: None,
                cadence: Default::default(),
                simulation_error: None,
                status: "Ready · Space to start the simulation".into(),
                grab: None,
                grab_radius_px: 30.,
                grab_strength: 1.,
                drag_plane: None,
                smoke: smoke || drag_test || perf_test || authoring_test,
                perf: perf_test.then(perf::PerfRun::new),
                drag_test,
                smoke_point: None,
                smoke_tick: 0,
                smoke_started: std::time::Instant::now(),
                smoke_grabbed: false,
                smoke_applied: false,
                smoke_captured: false,
                frames: 0,
            }))
        }),
    )
    .map_err(|e| e.to_string())?;
    if drag_test {
        let report: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(smoke_report).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if report["passed"] != true {
            return Err(format!("UI drag smoke failed: {report}"));
        }
    }
    if authoring_test {
        let report: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(authoring_report).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if report["passed"] != true {
            return Err(format!("Authoring smoke failed: {report}"));
        }
    }
    if perf_test {
        let report: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(perf_report).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if report["passed"] != true {
            return Err(format!("UI realtime check failed: {report}"));
        }
    }
    Ok(())
}
struct Atelier {
    cadence: perf::Cadence,
    simulation_error: Option<String>,
    issue: issue_ui::IssueUi,
    quick: quick_actions::QuickActions,
    document: documents_ui::DocumentUi,
    authoring: AuthoringUi,
    /// Loaded from `output/preferences.json` before the first frame and saved
    /// after a preference edit or workspace drag is complete.
    prefs: settings::Preferences,
    /// Whether the preferences window is currently open.
    settings_open: bool,
    prefs_dirty: bool,
    inspector_tab: chrome::InspectorTab,
    authoring_smoke: Option<authoring_smoke::Smoke>,
    perf: Option<perf::PerfRun>,
    mesh_mm: f64,
    anisotropy: f64,
    mesh_axis: f64,
    project: FittingProject,
    scene: FittingScene,
    output: PathBuf,
    viewport: Viewport,
    camera: Camera,
    send: mpsc::Sender<Work>,
    receive: worker::Latest,
    generation: u64,
    pending: bool,
    playing: bool,
    wire: bool,
    heat: bool,
    seams: bool,
    seam_links: bool,
    clean_view: bool,
    gpu: bool,
    settings: VbdSettings,
    metrics: Option<VbdMetrics>,
    status: String,
    grab: Option<Grab>,
    grab_radius_px: f32,
    grab_strength: f64,
    drag_plane: Option<(glam::DVec3, glam::DVec3)>,
    smoke: bool,
    frames: u32,
    drag_test: bool,
    smoke_point: Option<egui::Pos2>,
    smoke_tick: u32,
    smoke_started: std::time::Instant,
    smoke_grabbed: bool,
    smoke_applied: bool,
    smoke_captured: bool,
    smoke_initial: Vec<glam::DVec3>,
}
impl Atelier {
    /// The only live dispatch route for registry actions. All external
    /// adapters must recheck this snapshot rather than trusting cached UI
    /// availability from an earlier frame.
    fn command_context(&self) -> commands::CapabilityContext {
        commands::CapabilityContext {
            document_loaded: !self.project.template.panels.is_empty(),
            worker_ready: true,     // A worker is created before Atelier exists.
            filesystem_ready: true, // Export reports actual I/O failures.
            playing: self.playing,
            pending: self.pending,
        }
    }

    fn dispatch_command(
        &mut self,
        id: commands::CommandId,
        ctx: &egui::Context,
    ) -> Result<(), String> {
        use commands::CommandId as Id;
        commands::availability(id, self.command_context())
            .map_err(|reason| reason.message().to_owned())?;
        match id {
            Id::ToggleSimulation => {
                if self.playing {
                    self.playing = false;
                } else if self.prepare_simulation() {
                    self.playing = true;
                } else {
                    return Err(self.status.clone());
                }
            }
            Id::StepSimulation => {
                if !self.prepare_simulation() {
                    return Err(self.status.clone());
                }
                self.step(ctx);
            }
            Id::ResetSimulation => self.reset(),
            Id::ExportSession => self.export(),
            Id::SplitView => self.prefs.workspace.mode = layout::ViewMode::Split,
            Id::GarmentView => self.prefs.workspace.mode = layout::ViewMode::Garment,
            Id::PatternView => self.prefs.workspace.mode = layout::ViewMode::Patterns,
            Id::ToggleInspector => {
                self.prefs.workspace.inspector_open = !self.prefs.workspace.inspector_open;
            }
            Id::ResetLayout => self.prefs.workspace = Default::default(),
            Id::OpenPreferences => self.settings_open = true,
            Id::LoadTshirt => self.preset(GarmentKind::Tshirt),
            Id::LoadDress => self.preset(GarmentKind::Dress),
        }
        Ok(())
    }

    fn invoke_command(&mut self, id: commands::CommandId, ctx: &egui::Context) {
        if let Err(error) = self.dispatch_command(id, ctx) {
            self.status = error;
        }
    }

    fn step(&mut self, ctx: &egui::Context) {
        self.submit(ctx, true);
    }
    fn submit(&mut self, ctx: &egui::Context, once: bool) {
        let scene = FittingScene {
            garment: self.scene.garment.clone(),
            collider: self.scene.collider.clone(),
            state: self.scene.state.clone(),
            quasistatic: false,
            next_dt: self.settings.dt,
        };
        self.pending = self
            .send
            .send(Work {
                generation: self.generation,
                playing: self.playing,
                once,
                scene,
                settings: self.settings.clone(),
                grab: self.grab.clone(),
                gpu: self.gpu,
                ctx: ctx.clone(),
            })
            .is_ok()
            && (self.playing || once);
    }
    fn load(&mut self, p: FittingProject) -> bool {
        match p.compile() {
            Ok(scene) => {
                self.document.dirty = true;
                self.authoring.sewing = Default::default();
                if let Some(poly) = p.template.panels.iter().find_map(|p| p.polygon.as_ref()) {
                    let m = poly.meshing_settings();
                    self.mesh_mm = m.target_edge_m * 1000.;
                    self.anisotropy = m.anisotropy;
                    self.mesh_axis = m.axis_degrees;
                }
                self.authoring.history.record(self.project.template.clone());
                self.authoring.board.fitted = false;
                self.authoring.replace = false;
                self.authoring.draft.clear();
                self.authoring.tangents.clear();
                self.authoring.edge = None;
                self.authoring.board.clear_preview();
                self.authoring.preview = None;
                self.authoring.preview_state = None;
                self.authoring.error = None;
                self.authoring.fabric_draft = None;
                self.authoring.drag = None;
                self.authoring.ends.clear();
                self.authoring.selected = p.template.panels.first().map(|p| p.id.clone());
                self.authoring.drafting.line_panel = if self.authoring.tool == Tool::InternalLine {
                    self.authoring.selected.clone()
                } else {
                    None
                };
                self.scene = scene;
                self.issue.invalidate();
                self.project = p;
                self.generation += 1;
                self.playing = false;
                self.pending = false;
                self.metrics = None;
                self.grab = None;
                self.drag_plane = None;
                self.status = "New arrangement · run to assemble the seams".into();
                true
            }
            Err(e) => {
                self.status = e;
                false
            }
        }
    }
    fn preset(&mut self, kind: GarmentKind) {
        self.load(FittingProject::basic(
            kind,
            2,
            self.project.avatar_path.clone(),
        ));
    }
    fn reset(&mut self) {
        let mut p = self.project.clone();
        p.state = None;
        p.mesh_signature = None;
        p.prearrange = false;
        self.load(p);
    }
    fn remesh(&mut self) {
        let mut p = self.project.clone();
        p.state = None;
        p.mesh_signature = None;
        p.prearrange = false;
        for panel in &mut p.template.panels {
            if let Some(poly) = &mut panel.polygon {
                let mut m = poly.meshing_settings();
                m.target_edge_m = self.mesh_mm * 0.001;
                m.anisotropy = self.anisotropy;
                m.axis_degrees = self.mesh_axis;
                poly.meshing = Some(m);
            }
        }
        self.load(p);
    }
    fn export(&mut self) {
        if !self.commit_placement() {
            return;
        }
        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            std::fs::create_dir_all(&self.output)?;
            export::write_artifacts(
                &self.project.template,
                &self.scene.garment,
                &self.scene.state,
                &self.output,
            )?;
            let mut p = self.project.clone();
            p.state = Some(self.scene.state.clone());
            p.simulation = Some(self.settings.clone());
            p.save(&self.output.join("fitting-project.json"))?;
            Ok(())
        })();
        self.status = result.map_or_else(
            |e| e.to_string(),
            |_| format!("Export: {}", self.output.display()),
        );
    }
    fn pick_and_drag(&mut self, response: &egui::Response, rect: egui::Rect) {
        if response.drag_started_by(egui::PointerButton::Primary)
            && let Some(pos) = response.interact_pointer_pos()
        {
            let (origin, dir) = self.camera.ray(pos, rect);
            let mut best = f64::INFINITY;
            let mut picked = None;
            for t in &self.scene.garment.mesh.triangles {
                if let Some((d, w)) =
                    picking::ray_triangle(origin, dir, t.vertices.map(|i| self.scene.state.x[i]))
                    && d < best
                {
                    best = d;
                    picked = Some((t.vertices, w));
                }
            }
            if picked.is_some() && self.scene.collider.occludes_ray(origin, dir, best - 1e-5) {
                picked = None;
            }
            if let Some((vertices, weights)) = picked {
                let target = origin + best * dir;
                let (edge_origin, edge_dir) = self
                    .camera
                    .ray(pos + egui::vec2(self.grab_radius_px, 0.), rect);
                let radius = picking::ray_plane(edge_origin, edge_dir, target, dir)
                    .map_or(0., |edge| edge.distance(target));
                let patch = self
                    .scene
                    .garment
                    .panels
                    .iter()
                    .find(|panel| panel.vertices.contains(&vertices[0]))
                    .map_or_else(Vec::new, |panel| {
                        marvelous_cloth::vbd::grab::surface_patch(
                            &self.scene.garment.mesh,
                            &self.scene.state.x,
                            panel.triangles.clone(),
                            vertices,
                            target,
                            radius,
                        )
                    });
                self.grab = Some(Grab {
                    patch,
                    vertices,
                    weights,
                    target,
                    stiffness: 150. * self.grab_strength,
                });
                self.drag_plane = Some((target, dir));
                self.playing = true;
            }
        }
        if response.dragged_by(egui::PointerButton::Primary)
            && let (Some(g), Some((point, normal)), Some(pos)) = (
                &mut self.grab,
                self.drag_plane,
                response.interact_pointer_pos(),
            )
        {
            let (origin, dir) = self.camera.ray(pos, rect);
            if let Some(target) = picking::ray_plane(origin, dir, point, normal) {
                g.target = target;
            }
        }
        if !response.ctx.input(|i| i.pointer.primary_down()) {
            self.grab = None;
            self.drag_plane = None;
        }
    }
}
impl eframe::App for Atelier {
    fn raw_input_hook(&mut self, _ctx: &egui::Context, input: &mut egui::RawInput) {
        if let Some(smoke) = &mut self.authoring_smoke {
            smoke.input(input);
        }
        if !self.drag_test {
            return;
        }
        let Some(origin) = self.smoke_point else {
            return;
        };
        // Startup shader compilation may outlast a short render-frame script.
        // Keep the actual pointer held until the worker accepts a grabbed step;
        // wall-clock deadlines below still turn a stalled worker into a failure.
        if self.smoke_tick != 14 || self.smoke_applied || self.simulation_error.is_some() {
            self.smoke_tick += 1;
        }
        let tick = self.smoke_tick;
        let pos = origin + Vec2::new((tick.saturating_sub(2).min(12) * 5) as f32, 0.);
        if tick <= 15 {
            input.events.push(egui::Event::PointerMoved(pos));
        }
        if tick == 2 || tick == 15 {
            input.events.push(egui::Event::PointerButton {
                pos,
                button: egui::PointerButton::Primary,
                pressed: tick == 2,
                modifiers: Default::default(),
            });
        }
        if tick >= 15 {
            self.playing = false;
        }
    }
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        let previous_preferences = self.prefs.clone();
        let previous_simulation = self.settings.clone();
        if let Some((tool, rotate)) = self.authoring.radial.show(
            &ctx,
            self.authoring.tool,
            self.authoring.rotate,
            self.authoring.selected.is_some(),
        ) {
            self.set_authoring_tool(tool, rotate);
        }
        self.quick_actions(&ctx);
        self.sewing_context(&ctx);
        self.clipboard_shortcuts(&ctx);
        self.frames += 1;
        self.authoring.hover_edge = None;
        let done = self.receive.lock().unwrap().take();
        if let Some(done) = done.filter(|d| d.generation == self.generation) {
            self.pending = false;
            match done.result {
                Ok((state, m)) => {
                    self.simulation_error = None;
                    self.document.dirty = true;
                    self.smoke_applied |= done.had_grab;
                    self.scene.state = state;
                    self.status = "Dynamic simulation · OGC contacts".into();
                    self.metrics = Some(m);
                }
                Err(e) => {
                    self.playing = false;
                    self.simulation_error = Some(e.clone());
                    self.status = e;
                }
            }
        }
        if !self.authoring.radial.blocked
            && !self.quick.blocked
            && ctx.input(|i| i.key_pressed(egui::Key::Space))
            && !ctx.egui_wants_keyboard_input()
        {
            self.invoke_command(commands::CommandId::ToggleSimulation, &ctx);
        }
        egui::Panel::top("toolbar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.colored_label(
                    workspace::ACCENT,
                    egui::RichText::new("CLOTHCRAFT").strong().size(15.),
                );
                ui.label(egui::RichText::new("ALPHA").small().color(Color32::GRAY))
                    .on_hover_text("Research prototype · most production features remain to be built");
                ui.separator();
                let play = ui.button(if self.playing {
                    "⏸ Pause"
                } else if self.authoring.ends.len() == 2 && !self.authoring.sewing.chain_mode {
                    "▶ Sew and simulate"
                } else {
                    "▶ Simulate"
                });
                self.smoke_target("simulate", play.rect.center());
                if play.clicked() {
                    self.invoke_command(commands::CommandId::ToggleSimulation, &ctx);
                }
                ui.menu_button("Simulation", |ui| {
                    let step = commands::CommandId::StepSimulation;
                    let enabled = commands::availability(step, self.command_context());
                    let reason = enabled.as_ref().err().map(|e| e.message());
                    if ui.add_enabled(enabled.is_ok(), egui::Button::new("Advance one step"))
                        .on_disabled_hover_text(reason.unwrap_or(""))
                        .clicked() {
                        self.invoke_command(step, &ctx);
                        ui.close();
                    }
                    if ui.button("Reset the flat arrangement").on_hover_text("Resets the drape of every panel").clicked() {
                        self.invoke_command(commands::CommandId::ResetSimulation, &ctx); ui.close();
                    }
                });
                ui.menu_button("File",|ui| self.document_menu(ui));
                let export_button = ui.button("Export").on_hover_text("Saves the JSON project, the patterns, the OBJ garment and the previews into the session folder.");
                self.smoke_target("export", export_button.rect.center());
                if export_button.clicked() {
                    self.invoke_command(commands::CommandId::ExportSession, &ctx);
                }
                ui.separator();
                ui.menu_button("Workspace", |ui| {
                    let inspector = self.prefs.workspace.inspector_open;
                    if ui.selectable_label(inspector, "Properties inspector").clicked() {
                        self.invoke_command(commands::CommandId::ToggleInspector, &ctx);
                    }
                    for (mode, id, label) in [
                        (layout::ViewMode::Split,commands::CommandId::SplitView,"Split view"),
                        (layout::ViewMode::Garment,commands::CommandId::GarmentView,"3D only"),
                        (layout::ViewMode::Patterns,commands::CommandId::PatternView,"2D only")
                    ] {
                        if ui.selectable_label(self.prefs.workspace.mode == mode, label).clicked() {
                            self.invoke_command(id, &ctx);
                        }
                    }
                    ui.separator();
                    if ui.button("Reset layout").clicked() { self.invoke_command(commands::CommandId::ResetLayout, &ctx); ui.close(); }
                    if ui.button("Preferences…").clicked() { self.invoke_command(commands::CommandId::OpenPreferences, &ctx); ui.close(); }
                });
                ui.menu_button("Examples", |ui| {
                    if ui.button("T-shirt").clicked() {
                        self.invoke_command(commands::CommandId::LoadTshirt, &ctx);
                        ui.close();
                    }
                    if ui.button("Dress").clicked() {
                        self.invoke_command(commands::CommandId::LoadDress, &ctx);
                        ui.close();
                    }
                });
                self.online_patterns(ui);
            });
        });
        let mut changed = false;
        settings::window(&ctx, &mut self.settings_open, &mut self.prefs, &mut changed);
        if changed {
            // Apply immediately rather than on the next start: the window edits
            // the live `Preferences`, so anything less would leave the theme
            // switch looking broken until a restart. `apply` is idempotent.
            settings::apply(&ctx, &self.prefs);
            // The board reads its step at startup, so push the edited value
            // through here too; otherwise the control would persist without
            // taking effect, which is a stored value pretending to be live.
            self.authoring.board.snap_mm = self.prefs.snap_mm;
        }
        egui::Panel::bottom("status").show(ui, |ui| {
            self.cadence.update(std::time::Instant::now(), self.scene.state.time, self.generation, self.playing);
            ui.horizontal(|ui| {
                ui.colored_label(
                    if self.playing {
                        workspace::ACCENT
                    } else {
                        Color32::GRAY
                    },
                    if self.playing { "Simulation" } else { "Pause" },
                );
                ui.separator();
                if let Some(speed) = self.cadence.speed {
                    ui.colored_label(if speed >= 0.95 {workspace::ACCENT} else {Color32::GOLD},
                        format!("{:.0} steps/s · {:.2}×", speed/self.settings.dt, speed))
                        .on_hover_text("Actual physical time advanced per wall-clock second. Independent of render FPS.");
                    ui.separator();
                }
                ui.add(egui::Label::new(&self.status).truncate())
                    .on_hover_text(&self.status);
            });
        });
        egui::Panel::left("authoring-tools")
            .exact_size(52.)
            .resizable(false)
            .show(ui, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| self.authoring_toolbar(ui));
            });
        egui::CentralPanel::default()
            .frame(egui::Frame::NONE.fill(ui.visuals().panel_fill))
            .show(ui, |ui| {
                let area = ui.available_rect_before_wrap();
                let panes = layout::arrange(ui, area, &mut self.prefs.workspace);
                self.authoring.selection.board_rect = None;
                self.authoring.selection.garment_rect = None;
                for (id, rect) in [
                    ("garment", panes.garment),
                    ("patterns", panes.patterns),
                    ("inspector", panes.inspector),
                ] {
                    let Some(rect) = rect else { continue };
                    ui.painter().rect_filled(rect, 0., ui.visuals().panel_fill);
                    let mut pane = ui.new_child(
                        egui::UiBuilder::new()
                            .id_salt(id)
                            .max_rect(rect.shrink(7.))
                            .layout(egui::Layout::top_down(egui::Align::Min)),
                    );
                    pane.set_clip_rect(rect);
                    match id {
                        "garment" => self.garment_view(&mut pane),
                        "patterns" => self.patterns(&mut pane),
                        _ => self.inspector(&mut pane),
                    }
                }
            });
        self.prefs_dirty |= self.prefs != previous_preferences;
        if self.prefs_dirty && !ctx.input(|i| i.pointer.any_down()) {
            if let Err(error) = settings::save(&self.output.join(settings::FILE_NAME), &self.prefs)
            {
                self.status = format!("Preferences could not be saved: {error}");
            }
            self.prefs_dirty = false;
        }
        if let Some(perf) = &mut self.perf
            && let Some(mut report) = perf.tick(
                self.scene.state.time,
                ctx.cumulative_frame_nr(),
                self.settings.dt,
                self.metrics.is_some(),
            )
        {
            report["last_delivered_step"] = serde_json::to_value(&self.metrics).unwrap();
            self.playing = false;
            if let Err(e) = std::fs::write(
                self.output.join("ui-perf.json"),
                serde_json::to_string_pretty(&report).unwrap(),
            ) {
                eprintln!("UI performance report: {e}");
            }
        }
        self.document.dirty |= self.settings != previous_simulation;
        self.document_tick(&ctx);
        self.submit(&ctx, false);
        if self.playing {
            ctx.request_repaint_after(Duration::from_millis(16));
        }
        if self.pending {
            ctx.request_repaint_after(Duration::from_millis(16));
        }
        self.authoring_smoke_tick();
        if self.smoke {
            let drag_finished = self.drag_test && self.smoke_tick >= 20 && !self.pending;
            if !self.smoke_captured
                && ((self.authoring_smoke.is_none()
                    && !self.drag_test
                    && self.perf.is_none()
                    && self.frames == 8)
                    || self.authoring_smoke.as_ref().is_some_and(|s| s.finished)
                    || drag_finished
                    || (self.authoring_smoke.is_none()
                        && self.perf.is_none()
                        && ((!self.drag_test && self.frames > 110)
                            || (self.drag_test
                                && self.smoke_started.elapsed() > Duration::from_secs(15))))
                    || self.perf.as_ref().is_some_and(|p| p.finished))
            {
                self.smoke_captured = true;
                if self.drag_test {
                    let displacement = self
                        .scene
                        .state
                        .x
                        .iter()
                        .zip(&self.smoke_initial)
                        .map(|(a, b)| a.distance(*b))
                        .fold(0., f64::max);
                    let report = serde_json::json!({"passed":self.smoke_grabbed&&self.smoke_applied&&displacement>1e-5,"pointer_picked_cloth":self.smoke_grabbed,"accepted_step_with_grab":self.smoke_applied,"max_vertex_displacement_m":displacement,"status":self.status,"state_time_s":self.scene.state.time});
                    if let Err(e) = std::fs::write(
                        self.output.join("interaction.json"),
                        serde_json::to_string_pretty(&report).unwrap(),
                    ) {
                        eprintln!("Interaction report: {e}");
                    }
                }
                ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(Default::default()));
            }
            for event in ctx.input(|i| i.events.clone()) {
                if let egui::Event::Screenshot { image, .. } = event {
                    let pixels: Vec<u8> = image.pixels.iter().flat_map(|p| p.to_array()).collect();
                    if let Err(e) = image::save_buffer(
                        self.output.join("ui.png"),
                        &pixels,
                        image.size[0] as u32,
                        image.size[1] as u32,
                        image::ColorType::Rgba8,
                    ) {
                        eprintln!("UI capture: {e}");
                    }
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
            if (self.authoring_smoke.is_none()
                && self.perf.is_none()
                && ((!self.drag_test && self.frames > 120)
                    || (self.drag_test && self.smoke_started.elapsed() > Duration::from_secs(20))))
                || self.perf.as_ref().is_some_and(|p| p.expired())
            {
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
            ctx.request_repaint_after(Duration::from_millis(30));
        }
    }
}
