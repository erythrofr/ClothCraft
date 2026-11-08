//! Garment-CAD workspace presentation for the CPU FEM reference.
//!
//! The arrangement follows the workspace shape of a professional garment CAD
//! tool: a menu bar, a tool strip, a narrow palette on the left, the 3D garment
//! window and the white 2D pattern window side by side, a tabbed property
//! inspector docked on the right, and a status bar along the bottom.
//!
//! Every colour, glyph, label and layout choice in this file is original to this
//! project. No CLO3D asset, icon, artwork, font or screenshot is used, and no
//! CLO3D control is imitated at the pixel level; the shape of a docked viewport
//! workspace is a generic CAD convention shared by many applications.
//!
//! Mesh preparation explicitly rebuilds the rest mesh before simulation.
use crate::render::{Camera, Viewport};
use eframe::egui::{self, Color32, RichText, Stroke, Vec2};
use marvelous_cloth::{
    model::{Mesh, Scene, State},
    project::{self, Project},
    solver::{Metrics, ReferenceSolver},
};
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, mpsc},
    time::Duration,
};
#[path = "editor/mesh_preparation.rs"]
mod mesh_preparation;
#[cfg(test)]
#[path = "atelier/authoring_smoke/widget_harness.rs"]
mod widget_harness;

/// Chrome colours: light panels, dark docked-window title bars.
const CHROME: Color32 = Color32::from_rgb(0xEC, 0xEC, 0xEC);
const CHROME_DEEP: Color32 = Color32::from_rgb(0xDD, 0xDD, 0xDD);
const TITLE_BAR: Color32 = Color32::from_rgb(0x4A, 0x4E, 0x54);
const TEXT: Color32 = Color32::from_rgb(0x1A, 0x1A, 0x1A);
const ACCENT: Color32 = Color32::from_rgb(0x1E, 0x88, 0xE5);
const ACCENT_DEEP: Color32 = Color32::from_rgb(0x15, 0x65, 0xC0);
const SELECT: Color32 = Color32::from_rgb(0xE8, 0x6A, 0x17);
/// Neutral backdrop behind the rendered 3D window, matching the wgpu clear
/// colour in `render.rs` so no seam shows before the first frame lands.
const VIEW_BG: Color32 = Color32::from_rgb(0xB3, 0xBA, 0xC4);
const PATTERN_BG: Color32 = Color32::from_rgb(0xFF, 0xFF, 0xFF);
const PATTERN_GRID: Color32 = Color32::from_rgb(0xE3, 0xE8, 0xEF);
const PATTERN_MESH: Color32 = Color32::from_rgb(0xB6, 0xC1, 0xCE);
const PATTERN_LINE: Color32 = Color32::from_rgb(0x1B, 0x1B, 0x1B);

const TABS: [&str; 4] = ["Properties", "Objects", "Fabric", "Simulation"];

/// Light chrome with a blue accent, applied to both egui themes so the
/// workspace looks the same whatever the host reports.
fn style(ctx: &egui::Context) {
    let mut style = (*ctx.style_of(egui::Theme::Light)).clone();
    style.spacing.item_spacing = Vec2::new(6.0, 4.0);
    style.spacing.button_padding = Vec2::new(8.0, 3.0);
    style.spacing.interact_size.y = 23.0;
    style
        .text_styles
        .insert(egui::TextStyle::Body, egui::FontId::proportional(12.5));
    style
        .text_styles
        .insert(egui::TextStyle::Button, egui::FontId::proportional(12.5));
    style
        .text_styles
        .insert(egui::TextStyle::Small, egui::FontId::proportional(11.0));
    style.visuals.panel_fill = CHROME;
    style.visuals.window_fill = Color32::from_rgb(0xF7, 0xF7, 0xF7);
    style.visuals.faint_bg_color = CHROME_DEEP;
    style.visuals.extreme_bg_color = Color32::WHITE;
    style.visuals.selection.bg_fill = ACCENT;
    style.visuals.selection.stroke = Stroke::new(1.0, ACCENT_DEEP);
    style.visuals.widgets.inactive.bg_fill = CHROME_DEEP;
    style.visuals.widgets.hovered.bg_fill = Color32::from_rgb(0xCB, 0xDD, 0xF0);
    style.visuals.widgets.active.bg_fill = Color32::from_rgb(0xAE, 0xCC, 0xEC);
    ctx.set_style_of(egui::Theme::Light, style.clone());
    ctx.set_style_of(egui::Theme::Dark, style);
}

/// Docked-window caption strip, the way a CAD workspace titles each viewport.
fn title_bar(ui: &mut egui::Ui, title: &str, hint: &str) {
    let width = ui.available_width();
    let (rect, _) = ui.allocate_exact_size(Vec2::new(width, 20.0), egui::Sense::hover());
    let painter = ui.painter_at(rect);
    painter.rect_filled(rect, 0.0, TITLE_BAR);
    painter.text(
        rect.left_center() + Vec2::new(7.0, 0.0),
        egui::Align2::LEFT_CENTER,
        title,
        egui::FontId::proportional(11.5),
        Color32::from_rgb(0xF2, 0xF2, 0xF2),
    );
    if !hint.is_empty() {
        painter.text(
            rect.right_center() - Vec2::new(7.0, 0.0),
            egui::Align2::RIGHT_CENTER,
            hint,
            egui::FontId::proportional(10.5),
            Color32::from_rgb(0xBE, 0xC4, 0xCC),
        );
    }
}

/// A palette entry that shows its own on/off state.
fn palette_toggle(ui: &mut egui::Ui, on: &mut bool, label: &str, hint: &str) {
    let text = RichText::new(label)
        .size(11.5)
        .color(if *on { Color32::WHITE } else { TEXT });
    let button = egui::Button::new(text).fill(if *on { ACCENT } else { CHROME_DEEP });
    if ui
        .add_sized(Vec2::new(ui.available_width(), 26.0), button)
        .on_hover_text(hint)
        .clicked()
    {
        *on = !*on;
    }
}

struct Work {
    generation: u64,
    mesh: Arc<Mesh>,
    state: State,
    project: Project,
    ctx: egui::Context,
}
struct Done {
    generation: u64,
    result: Result<(State, Metrics), String>,
}

pub fn run(project: Project, output: PathBuf) -> eframe::Result {
    let options = eframe::NativeOptions {
        renderer: eframe::Renderer::Wgpu,
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1600.0, 980.0])
            .with_min_inner_size([1100.0, 700.0]),
        ..Default::default()
    };
    eframe::run_native(
        "MARVELOUS CLOTH | FEM Workshop",
        options,
        Box::new(move |cc| Ok(Box::new(Editor::new(cc, project, output)?))),
    )
}

struct Editor {
    active: Project,
    draft: Project,
    mesh: Arc<Mesh>,
    state: State,
    metrics: Option<Metrics>,
    viewport: Viewport,
    camera: Camera,
    playing: bool,
    wire: bool,
    heat: bool,
    contacts: bool,
    generation: u64,
    pending: bool,
    send: mpsc::Sender<Work>,
    receive: mpsc::Receiver<Done>,
    project_path: String,
    output: PathBuf,
    status: String,
    selected_edge: Option<usize>,
    tab: usize,
    mesh_preparation: mesh_preparation::Draft,
}
impl Editor {
    fn new(
        cc: &eframe::CreationContext<'_>,
        project: Project,
        output: PathBuf,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let (mesh, state) = project.build()?;
        let render_state = cc
            .wgpu_render_state
            .clone()
            .ok_or("wgpu renderer unavailable")?;
        style(&cc.egui_ctx);
        let (send, work) = mpsc::channel::<Work>();
        let (result, receive) = mpsc::channel::<Done>();
        std::thread::Builder::new()
            .name("cloth-cpu-solver".into())
            .stack_size(8 * 1024 * 1024)
            .spawn(move || {
                while let Ok(mut job) = work.recv() {
                    let solved = ReferenceSolver::step(
                        &job.mesh,
                        &mut job.state,
                        &job.project.material,
                        &job.project.solver,
                        job.project.sphere.as_ref(),
                    )
                    .map(|m| (job.state, m));
                    if result
                        .send(Done {
                            generation: job.generation,
                            result: solved,
                        })
                        .is_err()
                    {
                        break;
                    }
                    job.ctx.request_repaint();
                }
            })?;
        let project_path = output.join("project.json").to_string_lossy().into_owned();
        let mesh_preparation = mesh_preparation::Draft::from_project(&project);
        Ok(Self {
            active: project.clone(),
            draft: project,
            mesh: Arc::new(mesh),
            state,
            metrics: None,
            viewport: Viewport::new(render_state),
            camera: Camera::default(),
            playing: false,
            wire: true,
            heat: false,
            contacts: false,
            generation: 0,
            pending: false,
            send,
            receive,
            project_path,
            output,
            status: "Ready. The Simulation menu starts the CPU FEM solver.".into(),
            selected_edge: None,
            tab: 0,
            mesh_preparation,
        })
    }
    fn reset(&mut self, project: Project) {
        match project.build() {
            Ok((mesh, state)) => {
                self.generation += 1;
                self.mesh = Arc::new(mesh);
                self.state = state;
                self.active = project.clone();
                self.mesh_preparation = mesh_preparation::Draft::from_project(&project);
                self.draft = project;
                self.metrics = None;
                self.playing = false;
                self.selected_edge = None;
                self.status = "Pattern applied, simulation reset to rest.".into();
            }
            Err(e) => self.status = e,
        }
    }
    fn step(&mut self, ctx: &egui::Context) {
        if self.pending {
            return;
        }
        let job = Work {
            generation: self.generation,
            mesh: self.mesh.clone(),
            state: self.state.clone(),
            project: self.active.clone(),
            ctx: ctx.clone(),
        };
        if self.send.send(job).is_ok() {
            self.pending = true;
        } else {
            self.playing = false;
            self.status = "The CPU worker has stopped.".into();
        }
    }
    fn poll(&mut self) {
        while let Ok(done) = self.receive.try_recv() {
            self.pending = false;
            if done.generation != self.generation {
                continue;
            }
            match done.result {
                Ok((state, m)) => {
                    if !m.converged {
                        self.playing = false;
                        self.status =
                            "Tolerance not reached: paused. Reduce dt or increase the iterations."
                                .into();
                    }
                    self.state = state;
                    self.metrics = Some(m);
                }
                Err(e) => {
                    self.status = e;
                    self.playing = false;
                }
            }
        }
    }
    fn save(&mut self) {
        let path = PathBuf::from(&self.project_path);
        let result = (|| {
            if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            self.active.save(&path)
        })();
        self.status = result.map_or_else(
            |e| e,
            |_| format!("Active project saved: {}", path.display()),
        );
    }
    fn load(&mut self) {
        match Project::load(&PathBuf::from(&self.project_path)) {
            Ok(p) => self.reset(p),
            Err(e) => self.status = e,
        }
    }
    fn export(&mut self) {
        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            fs::create_dir_all(&self.output)?;
            fs::write(
                self.output.join("cloth.obj"),
                project::obj(&self.mesh, &self.state),
            )?;
            if let Some(m) = &self.metrics {
                fs::write(
                    self.output.join("last-metrics.json"),
                    serde_json::to_string_pretty(m)?,
                )?;
            }
            Ok(())
        })();
        self.status = result.map_or_else(
            |e| e.to_string(),
            |_| format!("OBJ and metrics exported: {}", self.output.display()),
        );
    }
    fn playing_label(&self) -> &'static str {
        if self.playing {
            "⏸ Pause"
        } else {
            "▶ Simulate"
        }
    }

    // ---------------------------------------------------------------- chrome

    fn menu_bar(&mut self, ui: &mut egui::Ui) {
        let ctx = ui.ctx().clone();
        ui.horizontal(|ui| {
            ui.menu_button("File", |ui| {
                if ui.button("Save project").clicked() {
                    self.save();
                    ui.close();
                }
                if ui.button("Load project").clicked() {
                    self.load();
                    ui.close();
                }
                ui.separator();
                if ui.button("Export OBJ + metrics").clicked() {
                    self.export();
                    ui.close();
                }
                ui.separator();
                if ui.button("Quit").clicked() {
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });
            ui.menu_button("Edit", |ui| {
                if ui.button("Apply settings and Reset").clicked() {
                    self.reset(self.draft.clone());
                    ui.close();
                }
                if ui.button("Reset the 3D view").clicked() {
                    self.camera = Camera::default();
                    ui.close();
                }
            });
            ui.menu_button("View", |ui| {
                ui.checkbox(&mut self.wire, "Wireframe");
                ui.checkbox(&mut self.heat, "Strain");
                ui.checkbox(&mut self.contacts, "Contacts");
            });
            ui.menu_button("Simulation", |ui| {
                if ui.button(self.playing_label()).clicked() {
                    self.playing = !self.playing;
                    ui.close();
                }
                if ui
                    .add_enabled(
                        !self.pending && !self.playing,
                        egui::Button::new("Advance one step"),
                    )
                    .clicked()
                {
                    self.step(&ctx);
                    ui.close();
                }
                if ui.button("Back to rest").clicked() {
                    self.reset(self.active.clone());
                    ui.close();
                }
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    RichText::new("FEM CPU f64")
                        .small()
                        .color(Color32::from_rgb(0x66, 0x66, 0x66)),
                );
                ui.separator();
                ui.label(
                    RichText::new("MARVELOUS CLOTH")
                        .strong()
                        .size(13.5)
                        .color(ACCENT_DEEP),
                );
            });
        });
    }

    fn tool_strip(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        ui.horizontal(|ui| {
            let play = ui.button(RichText::new(self.playing_label()).size(12.5));
            if play.clicked() {
                self.playing = !self.playing;
            }
            if ui
                .add_enabled(
                    !self.pending && !self.playing,
                    egui::Button::new(RichText::new("⏭ Step").size(12.5)),
                )
                .clicked()
            {
                self.step(ctx);
            }
            if ui
                .button(RichText::new("↺ Reset").size(12.5))
                .on_hover_text("Rebuilds the pattern and resets the simulation to rest")
                .clicked()
            {
                self.reset(self.active.clone());
            }
            ui.separator();
            if ui
                .button(RichText::new("Default view").size(12.5))
                .on_hover_text("Reframes the 3D camera")
                .clicked()
            {
                self.camera = Camera::default();
            }
            ui.separator();
            ui.checkbox(&mut self.wire, "Wireframe");
            ui.checkbox(&mut self.heat, "Strain");
            ui.checkbox(&mut self.contacts, "Contacts");
            ui.separator();
            ui.label(format!("t = {:.3} s", self.state.time));
            if self.pending {
                ui.spinner();
            }
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    RichText::new(self.scene_label())
                        .small()
                        .color(Color32::from_rgb(0x55, 0x55, 0x55)),
                );
            });
        });
    }

    fn scene_label(&self) -> &'static str {
        match self.active.scene {
            Scene::Sphere => "Scene: draped over a sphere",
            Scene::Hanging => "Scene: hung by two corners",
        }
    }

    fn palette(&mut self, ui: &mut egui::Ui) {
        ui.add_space(4.0);
        ui.label(
            RichText::new("DISPLAY")
                .size(10.0)
                .color(Color32::from_rgb(0x70, 0x70, 0x70)),
        );
        palette_toggle(ui, &mut self.wire, "Wireframe", "Shows the triangle edges");
        palette_toggle(
            ui,
            &mut self.heat,
            "Strain",
            "Colors |elongation - 1| from cyan (0 %) to red (10 %+)",
        );
        palette_toggle(
            ui,
            &mut self.contacts,
            "Contacts",
            "Highlights the vertices in contact penetration",
        );
        ui.add_space(8.0);
        ui.label(
            RichText::new("VIEW")
                .size(10.0)
                .color(Color32::from_rgb(0x70, 0x70, 0x70)),
        );
        if ui
            .add_sized(
                Vec2::new(ui.available_width(), 26.0),
                egui::Button::new(RichText::new("Default").size(11.5)).fill(CHROME_DEEP),
            )
            .on_hover_text("Reframes the 3D camera")
            .clicked()
        {
            self.camera = Camera::default();
        }
    }

    fn status_bar(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            let (badge, color) = match &self.metrics {
                Some(m) if m.converged => ("Converged", ACCENT_DEEP),
                Some(_) => ("Budget reached", SELECT),
                None => ("At rest", Color32::from_rgb(0x66, 0x66, 0x66)),
            };
            ui.label(RichText::new(badge).strong().color(color));
            ui.separator();
            ui.add(egui::Label::new(RichText::new(&self.status).size(11.5)).truncate())
                .on_hover_text(&self.status);
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if let Some(m) = &self.metrics {
                    ui.label(
                        RichText::new(format!(
                            "Newton {} · PCG {} · {:.1} ms · max strain {:.2} %",
                            m.newton_iterations,
                            m.pcg_iterations,
                            m.step_ms,
                            100.0 * m.max_strain
                        ))
                        .small(),
                    );
                    ui.separator();
                    ui.label(
                        RichText::new(format!(
                            "residual {:.2e} / {:.2e} N",
                            m.residual_rms_n, m.tolerance_n
                        ))
                        .small(),
                    );
                }
            });
        });
    }

    // ------------------------------------------------------------- inspector

    fn inspector(&mut self, ui: &mut egui::Ui) {
        ui.horizontal_wrapped(|ui| {
            for (i, name) in TABS.iter().enumerate() {
                if ui.selectable_label(self.tab == i, *name).clicked() {
                    self.tab = i;
                }
            }
        });
        ui.separator();
        egui::ScrollArea::vertical()
            .id_salt("inspector")
            .show(ui, |ui| match self.tab {
                0 => self.tab_properties(ui),
                1 => self.tab_objects(ui),
                2 => self.tab_fabric(ui),
                _ => self.tab_simulation(ui),
            });
    }

    fn tab_properties(&mut self, ui: &mut egui::Ui) {
        ui.strong("STARTING SCENE");
        let old = self.draft.scene;
        ui.radio_value(&mut self.draft.scene, Scene::Sphere, "Draped over a sphere");
        ui.radio_value(&mut self.draft.scene, Scene::Hanging, "Hung by two corners");
        if old != self.draft.scene {
            self.draft.sphere = if self.draft.scene == Scene::Sphere {
                Some(Default::default())
            } else {
                None
            };
        }
        ui.separator();
        ui.strong("REST PATTERN");
        ui.add(egui::Slider::new(&mut self.draft.pattern.width, 0.1..=2.0).text("Width · m"));
        ui.add(egui::Slider::new(&mut self.draft.pattern.height, 0.1..=2.0).text("Height · m"));
        ui.add(egui::Slider::new(&mut self.draft.pattern.nx, 2..=32).text("Uniform cells X"));
        ui.add(egui::Slider::new(&mut self.draft.pattern.ny, 2..=32).text("Uniform cells Y"));
        if self.draft.physics_sizing.is_some() {
            ui.small("Grid cell counts apply when using the uniform mesh. Choose Use uniform grid and reset below to switch.");
        }
        ui.add(
            egui::Slider::new(&mut self.draft.material.grain_degrees, 0.0..=180.0)
                .text("Grain · °"),
        );
        ui.add_space(8.0);
        self.mesh_controls(ui);
        if let Some(s) = &mut self.draft.sphere {
            ui.separator();
            ui.strong("COLLISION · SPHERE");
            ui.add(egui::Slider::new(&mut s.radius, 0.1..=0.5).text("Radius · m"));
            ui.add(
                egui::Slider::new(&mut s.stiffness, 1e3..=1e6)
                    .logarithmic(true)
                    .text("Contact · N/m³"),
            );
        }
        ui.add_space(8.0);
        if ui
            .add_sized(
                Vec2::new(ui.available_width(), 26.0),
                egui::Button::new(RichText::new("Apply and Reset").strong()),
            )
            .clicked()
        {
            self.reset(self.draft.clone());
        }
        ui.small("Apply and Reset rebuilds the current mesh mode. Use Remesh and reset above to apply sizing estimates.");
    }

    fn tab_objects(&mut self, ui: &mut egui::Ui) {
        ui.strong("TREE");
        ui.collapsing("2D pattern", |ui| {
            let p = &self.active.pattern;
            if self.active.physics_sizing.is_some() {
                ui.label("Physics-inspired triangulation");
            } else {
                ui.label(format!("{} × {} cells", p.nx, p.ny));
            }
            ui.label(format!(
                "{:.0} × {:.0} mm",
                p.width * 1000.0,
                p.height * 1000.0
            ));
        });
        ui.collapsing("Compiled mesh", |ui| {
            ui.label(format!("{} vertices", self.mesh.uv.len()));
            ui.label(format!("{} triangles", self.mesh.triangles.len()));
            ui.label(format!("{} hinges", self.mesh.hinges.len()));
            let pins = self.mesh.pins.iter().filter(|p| p.is_some()).count();
            ui.label(format!("{pins} fixed points"));
        });
        ui.collapsing("Selection", |ui| match self.selected_edge {
            Some(i) => {
                let p = &self.active.pattern;
                let mm = if i % 2 == 0 {
                    p.width * 1000.0
                } else {
                    p.height * 1000.0
                };
                ui.label(format!("Edge {} · {:.0} mm", i + 1, mm));
                if ui.button("Clear selection").clicked() {
                    self.selected_edge = None;
                }
            }
            None => {
                ui.small("No edge selected. Click an edge in the 2D window.");
            }
        });
        ui.separator();
        ui.strong("PROJECT JSON");
        ui.text_edit_singleline(&mut self.project_path);
        ui.horizontal(|ui| {
            if ui.button("Save").clicked() {
                self.save();
            }
            if ui.button("Load").clicked() {
                self.load();
            }
        });
        if ui.button("Export OBJ + metrics").clicked() {
            self.export();
        }
        ui.small("Saves the active pattern and settings; the simulated state is exported as OBJ.");
    }

    fn tab_fabric(&mut self, ui: &mut egui::Ui) {
        ui.strong("FABRIC · SI UNITS");
        let m = &mut self.draft.material;
        ui.add(
            egui::Slider::new(&mut m.warp, 10.0..=3000.0)
                .logarithmic(true)
                .text("Warp · N/m"),
        );
        ui.add(
            egui::Slider::new(&mut m.weft, 10.0..=3000.0)
                .logarithmic(true)
                .text("Weft · N/m"),
        );
        ui.add(
            egui::Slider::new(&mut m.shear, 1.0..=500.0)
                .logarithmic(true)
                .text("Shear"),
        );
        ui.add(
            egui::Slider::new(&mut m.bend_warp, 1e-6..=0.01)
                .logarithmic(true)
                .text("Bending warp · N m"),
        );
        ui.add(
            egui::Slider::new(&mut m.bend_weft, 1e-6..=0.01)
                .logarithmic(true)
                .text("Bending weft · N m"),
        );
        ui.add(egui::Slider::new(&mut m.compression_ratio, 0.01..=1.0).text("Compression ratio"));
        ui.add(egui::Slider::new(&mut m.density, 0.02..=1.0).text("Mass · kg/m²"));
        ui.add(
            egui::Slider::new(&mut m.thickness, 0.0001..=0.01)
                .logarithmic(true)
                .text("Thickness · m"),
        );
        ui.separator();
        ui.small("Estimated values, not calibrated against measurements. Changing the fabric requires a Reset: the density is baked into the compiled mass.");
    }

    fn mesh_controls(&mut self, ui: &mut egui::Ui) {
        ui.strong("MESH RESOLUTION");
        ui.small(format!(
            "{} vertices · {} triangles",
            self.mesh.uv.len(),
            self.mesh.triangles.len()
        ));
        ui.small(if self.active.physics_sizing.is_some() {
            "Current mesh: physics-inspired · fixed during simulation"
        } else {
            "Current mesh: uniform grid"
        });
        if let Some(action) = mesh_preparation::controls(
            ui,
            &mut self.mesh_preparation,
            &self.draft,
            !self.playing && !self.pending,
        ) {
            let mut project = self.draft.clone();
            project.physics_sizing = match action {
                mesh_preparation::Action::Physics(plan) => Some(plan),
                mesh_preparation::Action::Uniform => None,
            };
            self.reset(project);
        }
    }

    fn tab_simulation(&mut self, ui: &mut egui::Ui) {
        self.mesh_controls(ui);
        ui.separator();
        ui.strong("REFERENCE · IMPLICIT EULER");
        ui.add(egui::Slider::new(&mut self.draft.solver.dt, 0.001..=0.04).text("Step · s"));
        ui.add(
            egui::Slider::new(&mut self.draft.solver.gravity.y, -20.0..=0.0)
                .text("Gravity Y · m/s²"),
        );
        ui.add(egui::Slider::new(&mut self.draft.solver.damping, 0.0..=5.0).text("Damping · 1/s"));
        ui.add(
            egui::Slider::new(&mut self.draft.solver.newton_iterations, 5..=100)
                .text("Newton iterations"),
        );
        ui.separator();
        ui.strong("LINEAR SOLVER");
        ui.label("Assembled nodal operator · 3×3");
        ui.label("Preconditioner: nodal block-Jacobi");
        ui.small(
            "The matrix-free point-Jacobi path stays the fallback when a nodal block is not invertible.",
        );
        if let Some(m) = &self.metrics {
            ui.separator();
            ui.strong("LAST STEP");
            egui::Grid::new("metrics").num_columns(2).show(ui, |ui| {
                ui.label("Residual");
                ui.label(format!("{:.3e} N", m.residual_rms_n));
                ui.end_row();
                ui.label("Tolerance");
                ui.label(format!("{:.3e} N", m.tolerance_n));
                ui.end_row();
                ui.label("Newton / PCG");
                ui.label(format!("{} / {}", m.newton_iterations, m.pcg_iterations));
                ui.end_row();
                ui.label("Max elongation");
                ui.label(format!("{:.2} %", 100.0 * m.max_strain));
                ui.end_row();
                ui.label("Penetration");
                ui.label(format!("{:.3} mm", 1000.0 * m.max_vertex_penetration_m));
                ui.end_row();
                ui.label("Step cost");
                ui.label(format!("{:.2} ms", m.step_ms));
                ui.end_row();
            });
        }
        ui.separator();
        ui.small("Sphere contact by penalty · no self-collision · no collision grid · CPU FEM, wgpu display");
    }

    // -------------------------------------------------------------- viewports

    fn window_3d(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        title_bar(ui, "3D WINDOW", "drag: orbit · right: pan · wheel: zoom");
        let size = ui.available_size().max(Vec2::splat(1.0));
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click_and_drag());
        let painter = ui.painter_at(rect);
        painter.rect_filled(rect, 0.0, VIEW_BG);
        self.camera.interact(&response);
        let pixels = rect.size() * ctx.pixels_per_point();
        let texture = self.viewport.draw(
            [pixels.x as u32, pixels.y as u32],
            &self.camera,
            &self.mesh,
            &self.state,
            &self.active,
            self.wire,
            self.heat,
            self.contacts,
        );
        painter.image(
            texture,
            rect,
            egui::Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
            Color32::WHITE,
        );
        if self.heat {
            painter.text(
                rect.left_bottom() + Vec2::new(8.0, -14.0),
                egui::Align2::LEFT_BOTTOM,
                "|elongation - 1|: cyan 0 % → red 10 %+",
                egui::FontId::proportional(11.0),
                Color32::from_rgb(0x33, 0x33, 0x33),
            );
        }
    }

    fn window_2d(&mut self, ui: &mut egui::Ui) {
        let hint = match self.selected_edge {
            Some(i) => {
                let p = &self.active.pattern;
                let mm = if i % 2 == 0 {
                    p.width * 1000.0
                } else {
                    p.height * 1000.0
                };
                format!("edge {} · {:.0} mm", i + 1, mm)
            }
            None => "click an edge to select it".to_string(),
        };
        title_bar(ui, "2D PATTERN WINDOW", &hint);

        let avail = ui.available_size();
        let size = Vec2::new(avail.x.max(80.0), (avail.y - 6.0).max(120.0));
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());
        let painter = ui.painter_at(rect);
        painter.rect_filled(rect, 0.0, PATTERN_BG);

        // Millimetre drafting grid, the way a pattern window rules its canvas.
        let step = 40.0_f32;
        let mut x = rect.left() + step;
        while x < rect.right() {
            painter.line_segment(
                [egui::pos2(x, rect.top()), egui::pos2(x, rect.bottom())],
                Stroke::new(1.0, PATTERN_GRID),
            );
            x += step;
        }
        let mut y = rect.top() + step;
        while y < rect.bottom() {
            painter.line_segment(
                [egui::pos2(rect.left(), y), egui::pos2(rect.right(), y)],
                Stroke::new(1.0, PATTERN_GRID),
            );
            y += step;
        }
        for edge in [
            [rect.left_top(), rect.right_top()],
            [rect.right_top(), rect.right_bottom()],
            [rect.right_bottom(), rect.left_bottom()],
            [rect.left_bottom(), rect.left_top()],
        ] {
            painter.line_segment(edge, Stroke::new(1.0, Color32::from_rgb(0x8A, 0x8A, 0x8A)));
        }

        let p = &self.active.pattern;
        let scale = ((rect.width() - 90.0) / p.width as f32)
            .min((rect.height() - 110.0) / p.height as f32)
            .max(1.0);
        let origin = rect.center() - Vec2::new(p.width as f32, p.height as f32) * scale * 0.5;
        let point = |u: glam::DVec2| origin + Vec2::new(u.x as f32, u.y as f32) * scale;

        for t in &self.mesh.triangles {
            let [a, b, c] = t.vertices.map(|i| point(self.mesh.uv[i]));
            for pair in [[a, b], [b, c], [c, a]] {
                painter.line_segment(pair, Stroke::new(0.5, PATTERN_MESH));
            }
        }

        let corners = [
            origin,
            origin + Vec2::new(p.width as f32 * scale, 0.0),
            origin + Vec2::new(p.width as f32, p.height as f32) * scale,
            origin + Vec2::new(0.0, p.height as f32 * scale),
        ];
        for i in 0..4 {
            let pair = [corners[i], corners[(i + 1) % 4]];
            let selected = self.selected_edge == Some(i);
            painter.line_segment(
                pair,
                Stroke::new(
                    if selected { 3.0 } else { 1.6 },
                    if selected { SELECT } else { PATTERN_LINE },
                ),
            );
            if response.clicked()
                && let Some(pos) = response.interact_pointer_pos()
            {
                let edge = pair[1] - pair[0];
                let t = ((pos - pair[0]).dot(edge) / edge.length_sq()).clamp(0.0, 1.0);
                if pos.distance(pair[0] + t * edge) < 10.0 {
                    self.selected_edge = Some(i);
                }
            }
        }

        // Warp direction marker.
        let angle = self.active.material.grain_degrees.to_radians() as f32;
        let d = Vec2::new(angle.cos(), angle.sin()) * 62.0;
        painter.arrow(rect.center() - 0.5 * d, d, Stroke::new(2.0, ACCENT_DEEP));
        painter.text(
            rect.center() + Vec2::new(0.0, 42.0),
            egui::Align2::CENTER_CENTER,
            "WARP",
            egui::FontId::proportional(11.0),
            ACCENT_DEEP,
        );

        // Dimension lines, drawn the way a pattern window annotates a piece.
        let dim = Color32::from_rgb(0x44, 0x44, 0x44);
        let top = origin.y - 26.0;
        painter.line_segment(
            [
                egui::pos2(origin.x, top),
                egui::pos2(origin.x + p.width as f32 * scale, top),
            ],
            Stroke::new(1.0, dim),
        );
        painter.text(
            egui::pos2(origin.x + p.width as f32 * scale * 0.5, top - 9.0),
            egui::Align2::CENTER_CENTER,
            format!("{:.0} mm", p.width * 1000.0),
            egui::FontId::proportional(11.0),
            dim,
        );
        let right = origin.x + p.width as f32 * scale + 26.0;
        painter.line_segment(
            [
                egui::pos2(right, origin.y),
                egui::pos2(right, origin.y + p.height as f32 * scale),
            ],
            Stroke::new(1.0, dim),
        );
        painter.text(
            egui::pos2(right + 6.0, origin.y + p.height as f32 * scale * 0.5),
            egui::Align2::LEFT_CENTER,
            format!("{:.0} mm", p.height * 1000.0),
            egui::FontId::proportional(11.0),
            dim,
        );

        for (i, pin) in self.mesh.pins.iter().enumerate() {
            if pin.is_some() {
                let at = point(self.mesh.uv[i]);
                painter.circle_filled(at, 5.0, Color32::WHITE);
                painter.circle_stroke(
                    at,
                    5.0,
                    Stroke::new(1.6, Color32::from_rgb(0xC8, 0x28, 0x28)),
                );
            }
        }
    }
}
impl eframe::App for Editor {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.poll();
        let ctx = ui.ctx().clone();
        egui::Panel::top("menubar").show(ui, |ui| self.menu_bar(ui));
        egui::Panel::top("toolbar").show(ui, |ui| self.tool_strip(ui, &ctx));
        egui::Panel::bottom("status").show(ui, |ui| self.status_bar(ui));
        egui::Panel::left("palette")
            .default_size(58.0)
            .resizable(false)
            .show(ui, |ui| self.palette(ui));
        egui::Panel::right("inspector")
            .default_size(320.0)
            .size_range(260.0..=460.0)
            .resizable(true)
            .show(ui, |ui| self.inspector(ui));
        egui::CentralPanel::default().show(ui, |ui| {
            ui.columns(2, |cols| {
                self.window_3d(&mut cols[0], &ctx);
                self.window_2d(&mut cols[1]);
            });
        });
        if self.playing {
            self.step(&ctx);
        }
        if self.pending {
            ctx.request_repaint_after(Duration::from_millis(50));
        }
    }
}
