//! Compact viewport headers and contextual inspector, independent of solver choice.
use super::*;
use crate::render::appearance::{AntiAliasing, Appearance};
use layout::ViewMode;
use marvelous_cloth::vbd::{FinalDiagnostics, FinalDiagnosticsBackend};
#[path = "avatar_diagnostics.rs"]
mod avatar_diagnostics;
#[path = "mesh_resolution_ui.rs"]
mod mesh_resolution_ui;

pub(super) fn mesh_resolution_frame(ctx: &egui::Context, output: &std::path::Path) -> bool {
    mesh_resolution_ui::frame(ctx, output)
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum InspectorTab {
    Piece,
    Fabric,
    Simulation,
}

/// Shared chrome stays usable at the minimum split width; content belongs below it.
pub(super) struct ViewHeader {
    pub expand: bool,
    pub fit: bool,
    pub settings: egui::Response,
    pub camera: Option<egui::Response>,
}
pub(super) fn view_header(
    ui: &mut egui::Ui,
    title: &str,
    expanded: bool,
    is_3d: bool,
    help: &str,
) -> ViewHeader {
    let compact = ui.available_width() < 430.;
    ui.horizontal(|ui| {
        ui.strong(if compact {
            if is_3d { "3D" } else { "2D" }
        } else {
            title
        })
        .on_hover_text(help);
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            let expand = ui
                .small_button(if expanded { "Split" } else { "Expand" })
                .clicked();
            let settings = icons::dropdown_button(ui, icons::Icon::Settings, "Display options");
            let fit = icons::icon_only(ui, icons::Icon::Fit, 26., false, "Frame all").clicked();
            let camera = is_3d.then(|| {
                icons::dropdown_button(
                    ui,
                    icons::Icon::ViewIso,
                    "Camera · standard views, projection and framing",
                )
            });
            ViewHeader {
                expand,
                fit,
                settings,
                camera,
            }
        })
        .inner
    })
    .inner
}

/// Shared by the real popup and CPU-only presentation tests.
pub(super) fn appearance_controls(ui: &mut egui::Ui, value: &mut Appearance, msaa4: bool) {
    ui.set_min_width(240.);
    ui.strong("VIEWPORT DISPLAY");
    ui.separator();
    ui.horizontal(|ui| {
        ui.label("Anti-aliasing");
        ui.selectable_value(&mut value.anti_aliasing, AntiAliasing::Off, "Off");
        ui.add_enabled_ui(msaa4, |ui| {
            ui.selectable_value(&mut value.anti_aliasing, AntiAliasing::Msaa4, "4× MSAA");
        })
        .response
        .on_hover_text("Smooth silhouette edges; uses more graphics memory");
    });
    if !msaa4 {
        ui.small("4× MSAA is unavailable on this adapter.");
    }
    ui.separator();
    ui.strong("Background");
    ui.horizontal(|ui| {
        for (name, top, bottom, floor) in [
            ("Studio", [60, 67, 78], [116, 126, 140], [98, 107, 119]),
            ("Light", [190, 199, 210], [231, 235, 240], [196, 203, 212]),
            ("Dark", [27, 30, 36], [65, 72, 83], [54, 61, 71]),
        ] {
            if ui.small_button(name).clicked() {
                value.top = top;
                value.bottom = bottom;
                value.floor_color = floor;
            }
        }
    });
    ui.checkbox(&mut value.gradient, "Gradient");
    ui.horizontal(|ui| {
        ui.color_edit_button_srgb(&mut value.top);
        ui.label(if value.gradient {
            "Top color"
        } else {
            "Background color"
        });
    });
    if value.gradient {
        ui.horizontal(|ui| {
            ui.color_edit_button_srgb(&mut value.bottom);
            ui.label("Bottom color");
        });
    }
    ui.separator();
    ui.checkbox(&mut value.floor, "Ground plane");
    ui.add_enabled_ui(value.floor, |ui| {
        ui.horizontal(|ui| {
            ui.color_edit_button_srgb(&mut value.floor_color);
            ui.label("Ground color");
        });
        ui.checkbox(&mut value.grid, "Ground grid");
        ui.checkbox(&mut value.shadow, "Soft ground shadow")
            .on_hover_text(
                "Soft contact-style preview under the model. Does not affect simulation.",
            );
        if value.shadow {
            ui.add(egui::Slider::new(&mut value.shadow_opacity, 0.0..=0.8).text("Opacity"));
        }
    });
    ui.separator();
    if ui.small_button("Reset display").clicked() {
        *value = Appearance::default();
    }
}

impl Atelier {
    pub(super) fn garment_header(&mut self, ui: &mut egui::Ui) {
        let header = view_header(
            ui,
            "3D GARMENT",
            self.prefs.workspace.mode == ViewMode::Garment,
            true,
            view_controls::hint_3d(self.authoring.tool),
        );
        if header.expand {
            self.prefs.workspace.toggle_focus(ViewMode::Garment);
        }
        if header.fit {
            let bounds = self.view_bounds();
            if let Some((lo, hi)) = bounds.all {
                self.camera
                    .request_frame((lo + hi) * 0.5, (hi - lo).length() * 0.5);
            }
        }
        egui::Popup::menu(&header.settings).show(|ui| {
            appearance_controls(ui, &mut self.prefs.viewport, self.viewport.supports_msaa4());
            ui.separator();
            ui.strong("Overlays");
            ui.checkbox(&mut self.clean_view, "Clean view · hide all annotations")
                .on_hover_text("Show only the shaded garment and avatar. Keeps your overlay settings for later.");
            ui.checkbox(&mut self.wire, "Wireframe");
            ui.checkbox(&mut self.heat, "Strain map");
            ui.checkbox(&mut self.seam_links, "Seam links");
        });
        egui::Popup::menu(&header.camera.unwrap()).show(|ui| {
            ui.set_max_width(330.);
            self.show_view_bar(ui);
        });
    }

    pub(super) fn inspector(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.strong("PROPERTIES");
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui
                    .small_button("×")
                    .on_hover_text("Hide inspector · restore from Workspace menu")
                    .clicked()
                {
                    self.prefs.workspace.inspector_open = false;
                }
            });
        });
        ui.separator();
        self.panel_browser(ui);
        ui.horizontal(|ui| {
            for (tab, label) in [
                (InspectorTab::Piece, "Piece"),
                (InspectorTab::Fabric, "Fabric"),
                (InspectorTab::Simulation, "Simulation"),
            ] {
                let button = ui.selectable_value(&mut self.inspector_tab, tab, label);
                if tab == InspectorTab::Fabric {
                    self.smoke_target("fabric_tab", button.rect.center());
                }
            }
        });
        ui.separator();
        egui::ScrollArea::vertical()
            .id_salt("inspector-body")
            .show(ui, |ui| match self.inspector_tab {
                InspectorTab::Piece => {
                    self.authoring_properties(ui);
                    self.drafting_tools(ui);
                }
                InspectorTab::Fabric => {
                    if let Some(panel) = self
                        .project
                        .template
                        .panels
                        .iter()
                        .find(|p| Some(&p.id) == self.authoring.selected.as_ref())
                        .cloned()
                    {
                        ui.label(&panel.name);
                        self.fabric_properties(ui, &panel);
                    } else {
                        ui.label("Select a piece to edit its fabric.");
                    }
                }
                InspectorTab::Simulation => {
                    ui.collapsing("Avatar collision diagnostics", |ui| {
                        avatar_diagnostics::show(ui, &self.scene, &self.settings, self.generation, self.playing, self.pending);
                    });
                    ui.strong("Mesh resolution");
                    let prepared=self.project.template.panels.iter().any(|p|p.polygon.as_ref().and_then(|p|p.meshing.as_ref()).is_some_and(|m|m.physics_sizing.is_some()));
                    ui.add_enabled(!prepared,egui::Slider::new(&mut self.mesh_mm, 8.0..=60.0).text("Uniform mm"));
                    if prepared {ui.small("Prepared fabric-sized mesh · fixed until reset or an edit");}
                    if ui.add_enabled(!self.playing&&!self.pending,egui::Button::new("Remesh")).clicked() {
                        self.remesh();
                    }
                    ui.small(format!(
                        "{} vertices · {} triangles",
                        self.scene.state.x.len(),
                        self.scene.garment.mesh.triangles.len()
                    ));
                    ui.separator();
                    let ready = !self.playing && !self.pending
                        && self.authoring.preview.is_none() && self.authoring.drag.is_none()
                        && self.authoring.draft.is_empty() && self.authoring.dart.is_none()
                        && !self.authoring.board.gesture_active() && self.authoring.ends.is_empty()
                        && self.authoring.sewing.start.is_none()
                        && self.authoring.sewing.sides.iter().all(Vec::is_empty);
                    if let Some(request) = mesh_resolution_ui::preparation_controls(
                        ui, &self.project.template, self.authoring.selected.as_deref(), ready,
                    ) {
                        match marvelous_cloth::mesh_resolution::preparation::configure(
                            &self.project.template, &request.panels, request.young_pa,
                            request.ratio, request.transition_m, request.physics,
                        ) {
                            Ok(template) => {
                                let mut project = self.project.clone();
                                project.template = template;
                                project.state = None;
                                project.mesh_signature = None;
                                project.prearrange = false;
                                if self.load(project) {
                                    self.status = "Mesh prepared · press Simulate; topology stays fixed for the run".into();
                                }
                            }
                            Err(error) => self.status = error,
                        }
                    }
                    ui.separator();
                    mesh_resolution_ui::launch(ui,!self.playing&&!self.pending);
                    ui.separator();
                    ui.strong("Solver settings");
                    ui.checkbox(&mut self.gpu, "GPU compute");
                    ui.add(
                        egui::Slider::new(&mut self.settings.iterations, 2..=128)
                            .text("Iterations"),
                    );
                    ui.add(
                        egui::Slider::new(&mut self.settings.damping, 0.0..=10.0).text("Damping"),
                    );
                    ui.collapsing("Advanced meshing", |ui| {
                        ui.add(
                            egui::Slider::new(&mut self.anisotropy, 1.0..=4.0).text("Anisotropy"),
                        );
                        ui.add(
                            egui::Slider::new(&mut self.mesh_axis, 0.0..=180.0).text("Mesh axis"),
                        );
                    });
                    ui.collapsing("Diagnostics", |ui| {
                        ui.checkbox(&mut self.seams, "All seam samples");
                        ui.small("Hybrid VBD / OGC · frictionless · uncalibrated materials");
                        if let Some(m) = &self.metrics {
                            ui.small(format!(
                                "Step {:.2} ms · detection {:.2} ms · seam gap {:.2} mm",
                                m.step_ms,
                                m.detection_ms,
                                1000. * m.max_seam_gap_m
                            ));
                            ui.small(format!(
                                "Extension: 95% of rest area ≤ {:.1}% · max {:.1}%",
                                m.extension_p95_percent, m.extension_max_percent
                            ));
                        }
                        ui.separator();
                        ui.strong("Final accepted state");
                        let pending_id = egui::Id::new("clothcraft.final-diagnostics-pending");
                        let requested = ui
                            .ctx()
                            .data(|d| d.get_temp::<worker::FinalDiagnosticsRequest>(pending_id));
                        let sample = worker::final_diagnostics();
                        let error = worker::final_diagnostics_error();
                        let selection = select_final_diagnostics(
                            requested,
                            sample.as_ref(),
                            error.as_ref(),
                            self.generation,
                            self.simulation_error.is_some(),
                        );
                        if selection.requested != requested {
                            ui.ctx().data_mut(|d| {
                                d.remove::<worker::FinalDiagnosticsRequest>(pending_id)
                            });
                        }
                        let requested_now = final_diagnostics_controls(
                            ui,
                            FinalDiagnosticsView {
                                sample: selection.sample,
                                error: selection.error,
                                current_time_s: self.scene.state.time,
                                playing: self.playing,
                                pending: selection.pending,
                            },
                        );
                        if requested_now {
                            let request = worker::request_final_diagnostics(self.generation);
                            ui.ctx()
                                .data_mut(|d| d.insert_temp(pending_id, request));
                            if !self.playing {
                                self.step(ui.ctx());
                            }
                            ui.ctx().request_repaint();
                        }
                    });
                    ui.collapsing("Motion / jitter", |ui| {
                        let mut inspect = false;
                        if let Some(m) = self.metrics.as_ref().and_then(|m| m.motion.as_ref()) {
                            ui.small(format!("High-pass RMS {:.3} mm · max {:.3} mm", m.highpass_rms_m * 1000., m.highpass_max_m * 1000.));
                            ui.small(format!("{} vertices with persistent oscillation", m.oscillating_vertices));
                            if m.observed_seconds < 0.75 { ui.small("Collecting physical-step history…"); }
                            inspect = ui.add_enabled(!m.hotspots.is_empty(), egui::Button::new("Inspect jitter hotspots"))
                                .on_hover_text("Pause and mark faces around up to 12 strongest detected vertices. Export report includes motion measurements.").clicked();
                        } else {
                            ui.small("Run simulation to measure motion.");
                        }
                        ui.small("Repeated reversals, not rendering FPS. Real fabric vibration can also trigger this indicator.");
                        if inspect { self.inspect_motion(); }
                    });
                }
            });
    }
}

impl Atelier {
    pub(super) fn garment_view(&mut self, ui: &mut egui::Ui) {
        let ctx = ui.ctx().clone();
        self.garment_header(ui);
        if let Some(error) = self.simulation_error.clone() {
            egui::Frame::group(ui.style()).show(ui, |ui| {
                ui.colored_label(Color32::from_rgb(225, 120, 75), "SIMULATION PAUSED");
                ui.label(&error);
                ui.horizontal(|ui| {
                    if ui.small_button("Inspect problem faces").clicked() {
                        self.set_authoring_tool(Tool::Inspect, false);
                    }
                    if ui.small_button("Copy details").clicked() {
                        ui.ctx().copy_text(error);
                    }
                });
            });
        }
        self.sewing_strip(ui);
        if self.authoring.tool == Tool::Grab {
            ui.horizontal_wrapped(|ui| {
                ui.strong("Grab");
                ui.add(egui::Slider::new(&mut self.grab_radius_px, 0.0..=150.0).text("Radius (px)"))
                    .on_hover_text("Size on screen. Zero uses the original point grab. The brush follows the picked piece's surface, avoiding nearby disconnected layers.");
                ui.add(egui::Slider::new(&mut self.grab_strength, 0.25..=20.).logarithmic(true).text("Strength"))
                    .on_hover_text("1× is the original point spring strength. Higher values pull harder; collision limits still apply. Changes apply to the next drag.");
            });
        }
        if self.authoring.tool == Tool::Inspect {
            self.issue_controls(ui);
        }
        ui.separator();
        self.viewport.appearance = self.prefs.viewport.clone();
        let (rect, response) = ui.allocate_exact_size(
            ui.available_size().max(Vec2::splat(1.)),
            egui::Sense::click_and_drag(),
        );
        self.authoring.selection.garment_rect = Some(rect);
        if !self.authoring.radial.blocked && !self.quick.blocked {
            self.sewing_wheel(&response);
            if response.secondary_clicked()
                && !self.authoring.board.gesture_active()
                && self.authoring.drag.is_none()
                && self.grab.is_none()
                && let Some(at) = response.interact_pointer_pos()
            {
                self.authoring.radial.open(&ctx, at);
            }
            if self.authoring.tool == Tool::Grab {
                self.pick_and_drag(&response, rect);
            }
            self.place_interaction(&response, rect);
            self.edge_interaction(&response, rect);
        }
        self.smoke_grabbed |= self.grab.is_some();
        if self.drag_test && self.smoke_point.is_none() {
            let aim = glam::DVec3::new(0., 1.12, 0.30);
            let front = &self.scene.garment.panels[0];
            let point = self.scene.garment.mesh.triangles[front.triangles.clone()]
                .iter()
                .map(|t| {
                    t.vertices
                        .iter()
                        .map(|i| self.scene.state.x[*i] / 3.)
                        .sum::<glam::DVec3>()
                })
                .min_by(|a, b| a.distance_squared(aim).total_cmp(&b.distance_squared(aim)))
                .unwrap();
            let clip =
                self.camera.matrix(rect.width() / rect.height()) * point.as_vec3().extend(1.);
            let ndc = clip.truncate() / clip.w;
            self.smoke_point = Some(egui::pos2(
                rect.center().x + ndc.x * rect.width() * 0.5,
                rect.center().y - ndc.y * rect.height() * 0.5,
            ));
        }
        if !self.authoring.radial.blocked && !self.quick.blocked {
            self.camera.garment_interact(&response);
        }
        let size = rect.size() * ctx.pixels_per_point();
        let optics =
            marvelous_cloth::garment::appearance::bind(&self.project.template, &self.scene.garment);
        let texture = self.viewport.draw_scene(
            [size.x as u32, size.y as u32],
            &self.camera,
            DrawModel {
                marked_faces: if self.clean_view {
                    None
                } else {
                    Some(&self.issue.faces)
                },
                mesh: &self.scene.garment.mesh,
                state: &self.scene.state,
                materials: &self.scene.garment.materials,
                optics: Some(&optics),
                sphere: None,
                avatar: Some(&self.scene.collider.surface),
                collider: None,
                seams: if self.seams && !self.clean_view {
                    &self.scene.garment.seams
                } else {
                    &[]
                },
            },
            self.wire && !self.clean_view,
            self.heat && !self.clean_view,
            false,
        );
        ui.painter().image(
            texture,
            rect,
            egui::Rect::from_min_max(egui::Pos2::ZERO, egui::pos2(1., 1.)),
            Color32::WHITE,
        );
        if !self.clean_view {
            self.issue_brush(ui, &response, rect);
            self.paint_edges_3d(ui, rect);
            self.paint_seam_links(&ui.painter().with_clip_rect(rect), rect, true);
            self.paint_sewing_ranges(ui, rect, true);
            self.paint_gizmo(ui, rect);
            self.paint_selected_points_3d(ui, rect);
            if self.authoring.tool == Tool::Grab
                && let Some(p) = response.hover_pos()
            {
                ui.painter().with_clip_rect(rect).circle_stroke(
                    p,
                    self.grab_radius_px.max(4.),
                    Stroke::new(1.5, Color32::from_rgb(255, 194, 64)),
                );
            }
        }
        if !self.clean_view
            && let Some(g) = &self.grab
        {
            let clip =
                self.camera.matrix(rect.width() / rect.height()) * g.target.as_vec3().extend(1.);
            if clip.w > 0. {
                let ndc = clip.truncate() / clip.w;
                let p = egui::pos2(
                    rect.center().x + ndc.x * rect.width() * 0.5,
                    rect.center().y - ndc.y * rect.height() * 0.5,
                );
                ui.painter()
                    .circle_stroke(p, 8., Stroke::new(2., Color32::from_rgb(255, 194, 64)));
            }
        }
    }
}

struct FinalDiagnosticsSelection<'a> {
    requested: Option<worker::FinalDiagnosticsRequest>,
    sample: Option<&'a FinalDiagnostics>,
    error: Option<&'a str>,
    pending: bool,
}

/// Select only a result produced for the current generation and the latest
/// request. Equal physical timestamps after a reload or reset must not make an
/// older sample look current.
fn select_final_diagnostics<'a>(
    requested: Option<worker::FinalDiagnosticsRequest>,
    result: Option<&'a worker::FinalDiagnosticsResult>,
    failure: Option<&'a worker::FinalDiagnosticsFailure>,
    current_generation: u64,
    simulation_error: bool,
) -> FinalDiagnosticsSelection<'a> {
    let requested = requested.filter(|request| request.generation == current_generation);
    let sample = result
        .filter(|result| requested.is_some_and(|request| request == result.request))
        .map(|result| &result.sample);
    let error = failure
        .filter(|failure| requested.is_some_and(|request| request == failure.request))
        .map(|failure| failure.message.as_str());
    FinalDiagnosticsSelection {
        requested,
        pending: requested.is_some() && sample.is_none() && error.is_none() && !simulation_error,
        sample,
        error,
    }
}

struct FinalDiagnosticsView<'a> {
    sample: Option<&'a FinalDiagnostics>,
    error: Option<&'a str>,
    current_time_s: f64,
    playing: bool,
    pending: bool,
}

struct FinalDiagnosticsText {
    timing: String,
    contacts: String,
    residual: String,
    backend: String,
    freshness: &'static str,
    semantics: &'static str,
}

fn backend_label(backend: FinalDiagnosticsBackend) -> &'static str {
    match backend {
        FinalDiagnosticsBackend::Cpu => "CPU step / CPU audit",
        FinalDiagnosticsBackend::CpuAuditOfGpuState => {
            "GPU-accepted state / CPU audit (GPU timings unavailable)"
        }
    }
}

fn format_final_diagnostics(
    sample: &FinalDiagnostics,
    current_time_s: f64,
    playing: bool,
) -> FinalDiagnosticsText {
    let age_s = current_time_s - sample.state_time_s;
    let freshness = if age_s.abs() <= 1e-6 {
        if playing {
            "fresh at the sampled step"
        } else {
            "fresh (paused at the sampled state)"
        }
    } else if age_s < 0.0 {
        "stale (simulation state reset or reloaded)"
    } else {
        "stale; pause and sample again to inspect the current state"
    };
    FinalDiagnosticsText {
        timing: format!(
            "Accepted state t = {:.3} s · dt = {:.3} ms · sample {:.2} ms (detect {:.2} ms + residual {:.2} ms)",
            sample.state_time_s,
            1000.0 * sample.step_dt_s,
            sample.sample_ms,
            sample.detection_ms,
            sample.residual_ms
        ),
        contacts: {
            let separation = match sample.minimum_distance_m {
                Some(distance) => format!("minimum separation {:.3} mm", 1000.0 * distance),
                None => "no contact term".into(),
            };
            format!(
                "Contacts: {} active / {} retained · {separation}",
                sample.contacts, sample.contact_terms
            )
        },
        residual: match sample.residual_rms_n {
            Some(rms) => format!(
                "Free-DOF RMS residual: {:.4e} N over {} free vertices",
                rms, sample.free_vertices
            ),
            None => "Free-DOF RMS residual unavailable: no free vertices".into(),
        },
        backend: format!("Backend: {}", backend_label(sample.backend)),
        freshness,
        semantics: "Accepted post-step state with fresh final OGC contacts. Unconstrained free-DOF backward-Euler gradient, not a KKT/constrained-equilibrium or per-color mixed-gradient certificate. The in-step detection metric is an earlier query.",
    }
}

fn final_diagnostics_controls(ui: &mut egui::Ui, view: FinalDiagnosticsView<'_>) -> bool {
    let mut requested = false;
    ui.horizontal(|ui| {
        let response = ui
            .button("Sample final state")
            .on_hover_text(
                "Run a one-shot CPU audit after the next accepted step. If paused, this advances one step. It does not change contact coverage, the predictor or the rejection policy.",
            );
        #[cfg(test)]
        super::authoring_smoke::widget_harness::named(
            ui,
            &response,
            "simulation.sample_final_diagnostics",
        );
        if response.clicked() {
            requested = true;
        }
        if view.pending {
            ui.small("Sampling after the next accepted step…");
        }
    });
    if let Some(error) = view.error {
        ui.colored_label(
            Color32::from_rgb(225, 120, 75),
            format!("Final sample failed: {error}"),
        );
    }
    if let Some(sample) = view.sample {
        let text = format_final_diagnostics(sample, view.current_time_s, view.playing);
        ui.small(text.timing);
        ui.small(text.contacts);
        ui.small(text.residual);
        ui.small(format!("{} · {}", text.backend, text.freshness));
        ui.small(text.semantics);
    } else if view.pending {
        ui.small("Sampling is opt-in; no final-state sample has been accepted yet.");
    } else {
        ui.small(
            "No final-state sample yet. Sampling is opt-in and runs after the next accepted step.",
        );
    }
    requested
}

#[cfg(test)]
mod final_diagnostics_tests {
    use super::super::authoring_smoke::widget_harness::Harness;
    use super::*;

    fn sample() -> FinalDiagnostics {
        FinalDiagnostics {
            state_time_s: 1.25,
            step_dt_s: 1.0 / 60.0,
            sample_ms: 4.5,
            detection_ms: 2.0,
            residual_ms: 2.5,
            backend: FinalDiagnosticsBackend::Cpu,
            contacts: 12,
            contact_terms: 20,
            minimum_distance_m: Some(0.001_25),
            free_vertices: 96,
            residual_rms_n: Some(0.125),
            residual_kind: "free_dof_backward_euler_accepted_state_final_contacts",
        }
    }

    #[test]
    fn named_control_requests_a_sample_and_presentation_keeps_units() {
        let sample = sample();
        let mut clicked = false;
        let mut draw = |ui: &mut egui::Ui, clicked: &mut bool| {
            *clicked |= final_diagnostics_controls(
                ui,
                FinalDiagnosticsView {
                    sample: Some(&sample),
                    error: None,
                    current_time_s: sample.state_time_s,
                    playing: false,
                    pending: false,
                },
            );
        };
        let mut harness = Harness::new(egui::vec2(560., 520.));
        harness.frame(&mut clicked, &mut draw);
        harness
            .click(
                "simulation.sample_final_diagnostics",
                &mut clicked,
                &mut draw,
            )
            .unwrap();
        assert!(clicked);

        let text = format_final_diagnostics(&sample, sample.state_time_s, false);
        assert!(text.timing.contains("sample"));
        assert!(text.contacts.contains("12 active / 20 retained"));
        assert!(text.contacts.contains("1.250 mm"));
        assert!(text.residual.contains("N"));
        assert!(text.backend.contains("CPU"));
        assert!(text.semantics.contains("not a KKT"));
        assert!(text.freshness.contains("fresh"));
    }

    #[test]
    fn unavailable_residual_is_unavailable_not_zero() {
        let mut sample = sample();
        sample.free_vertices = 0;
        sample.residual_rms_n = None;
        sample.contact_terms = 0;
        sample.minimum_distance_m = None;
        let text = format_final_diagnostics(&sample, sample.state_time_s, true);
        assert!(text.residual.contains("unavailable"));
        assert!(!text.residual.contains("0.0000e0 N"));
        assert!(text.contacts.contains("no contact term"));
    }

    #[test]
    fn gpu_audit_is_labelled_and_stale_samples_are_not_fresh() {
        let mut sample = sample();
        sample.backend = FinalDiagnosticsBackend::CpuAuditOfGpuState;
        let text = format_final_diagnostics(&sample, sample.state_time_s + 0.5, true);
        assert!(text.backend.contains("GPU"));
        assert!(text.backend.contains("unavailable"));
        assert!(text.freshness.contains("stale"));
    }

    fn request(generation: u64, request_id: u64) -> worker::FinalDiagnosticsRequest {
        worker::FinalDiagnosticsRequest {
            generation,
            request_id,
        }
    }

    fn result(
        request: worker::FinalDiagnosticsRequest,
        state_time_s: f64,
    ) -> worker::FinalDiagnosticsResult {
        let mut sample = sample();
        sample.state_time_s = state_time_s;
        worker::FinalDiagnosticsResult { request, sample }
    }

    fn failure(
        request: worker::FinalDiagnosticsRequest,
        message: &str,
    ) -> worker::FinalDiagnosticsFailure {
        worker::FinalDiagnosticsFailure {
            request,
            message: message.into(),
        }
    }

    #[test]
    fn reload_with_equal_physical_time_rejects_the_old_generation() {
        let old = request(1, 1);
        let old_result = result(old, 0.0);
        let selection = select_final_diagnostics(Some(old), Some(&old_result), None, 2, false);
        assert_eq!(selection.requested, None);
        assert!(selection.sample.is_none());
        assert!(!selection.pending);

        let current = request(2, 2);
        let current_result = result(current, 0.0);
        let selection = select_final_diagnostics(Some(current), Some(&old_result), None, 2, false);
        assert!(selection.sample.is_none());
        assert!(selection.pending);

        let selection =
            select_final_diagnostics(Some(current), Some(&current_result), None, 2, false);
        assert_eq!(
            selection.sample.map(|sample| sample.state_time_s),
            Some(0.0)
        );
        assert!(!selection.pending);
    }

    #[test]
    fn late_previous_request_does_not_satisfy_a_newer_request() {
        let first = request(1, 1);
        let second = request(1, 2);
        let first_result = result(first, 0.5);
        let second_result = result(second, 0.5);

        let selection = select_final_diagnostics(Some(second), Some(&first_result), None, 1, false);
        assert_eq!(selection.requested, Some(second));
        assert!(selection.sample.is_none());
        assert!(selection.pending);

        let first_failure = failure(first, "late failure");
        let selection =
            select_final_diagnostics(Some(second), None, Some(&first_failure), 1, false);
        assert!(selection.error.is_none());
        assert!(selection.pending);

        let selection =
            select_final_diagnostics(Some(second), Some(&second_result), None, 1, false);
        assert!(selection.sample.is_some());
        assert!(!selection.pending);
    }

    #[test]
    fn current_request_error_is_shown_and_stops_pending() {
        let current = request(1, 3);
        let failure = failure(current, "sample failed");
        let selection = select_final_diagnostics(Some(current), None, Some(&failure), 1, false);
        assert_eq!(selection.error, Some("sample failed"));
        assert!(selection.sample.is_none());
        assert!(!selection.pending);
    }
}
