//! On-demand CPU inspection; no collision analysis during ordinary repaints.
use eframe::egui;
use marvelous_cloth::{avatar::diagnostics, fitting::FittingScene, vbd::VbdSettings};
use std::sync::{Arc, Mutex, mpsc};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Action {
    Inspect,
    CheckStart,
}

#[derive(Clone, Copy)]
struct Stamp {
    generation: u64,
    time: u64,
    avatar: usize,
    garment: usize,
}
impl Stamp {
    fn new(scene: &FittingScene, generation: u64) -> Self {
        Self {
            generation,
            time: scene.state.time.to_bits(),
            avatar: Arc::as_ptr(&scene.collider.surface) as usize,
            garment: Arc::as_ptr(&scene.garment) as usize,
        }
    }
}

struct Sample {
    stamp: Stamp,
    report: Result<diagnostics::Report, String>,
    initialization: Option<Result<(), String>>,
    milliseconds: f64,
    // Keep the captured geometry allocation alive: pointer identity cannot be
    // accidentally reused while the sample is still displayed.
    _surface: Arc<marvelous_cloth::avatar::SurfaceMesh>,
    _garment: Option<Arc<marvelous_cloth::garment::CompiledGarment>>,
}
impl Sample {
    fn current(&self, now: Stamp) -> bool {
        self.stamp.generation == now.generation
            && self.stamp.avatar == now.avatar
            && (self.initialization.is_none()
                || (self.stamp.time == now.time && self.stamp.garment == now.garment))
    }
}

type Pending = Arc<Mutex<mpsc::Receiver<Arc<Sample>>>>;
#[derive(Clone, Default)]
struct Inspector {
    pending: Option<Pending>,
    sample: Option<Arc<Sample>>,
    error: Option<String>,
}
impl Inspector {
    fn poll(&mut self) {
        let Some(receiver) = &self.pending else {
            return;
        };
        let result = match receiver.lock() {
            Ok(receiver) => receiver.try_recv(),
            Err(_) => Err(mpsc::TryRecvError::Disconnected),
        };
        match result {
            Ok(sample) => {
                self.sample = Some(sample);
                self.pending = None;
            }
            Err(mpsc::TryRecvError::Empty) => {}
            Err(mpsc::TryRecvError::Disconnected) => {
                self.pending = None;
                self.error = Some("Inspection worker stopped without a result".into());
            }
        }
    }
    fn start(
        &mut self,
        action: Action,
        scene: &FittingScene,
        generation: u64,
        ctx: &egui::Context,
    ) {
        if self.pending.is_some() {
            return;
        }
        let stamp = Stamp::new(scene, generation);
        let surface = scene.collider.surface.clone();
        let input =
            (action == Action::CheckStart).then(|| (scene.garment.clone(), scene.state.clone()));
        let ctx = ctx.clone();
        let (send, receive) = mpsc::channel();
        self.error = None;
        // No unbounded queue: both actions stay disabled until this job completes.
        match std::thread::Builder::new()
            .name("avatar-inspection".into())
            .spawn(move || {
                let start = std::time::Instant::now();
                let report = diagnostics::inspect(&surface);
                let (initialization, garment) = match input {
                    Some((garment, state)) => (
                        Some(diagnostics::check_vbd_initialization(
                            garment.clone(),
                            &surface,
                            &state,
                        )),
                        Some(garment),
                    ),
                    None => (None, None),
                };
                let _ = send.send(Arc::new(Sample {
                    stamp,
                    report,
                    initialization,
                    milliseconds: start.elapsed().as_secs_f64() * 1000.,
                    _surface: surface,
                    _garment: garment,
                }));
                ctx.request_repaint();
            }) {
            Ok(_) => self.pending = Some(Arc::new(Mutex::new(receive))),
            Err(error) => self.error = Some(format!("Could not start inspection: {error}")),
        }
    }
}

fn key() -> egui::Id {
    egui::Id::new("clothcraft.avatar-diagnostics")
}

fn action(ui: &mut egui::Ui, name: &str, title: &str, enabled: bool) -> bool {
    let response = ui
        .push_id(name, |ui| ui.add_enabled(enabled, egui::Button::new(title)))
        .inner;
    #[cfg(test)]
    super::super::authoring_smoke::widget_harness::named(ui, &response, name);
    response.clicked()
}

pub(super) fn show(
    ui: &mut egui::Ui,
    scene: &FittingScene,
    settings: &VbdSettings,
    generation: u64,
    playing: bool,
    worker_pending: bool,
) {
    let mut inspector = ui
        .ctx()
        .data(|d| d.get_temp::<Inspector>(key()))
        .unwrap_or_default();
    inspector.poll();
    let mut request = None;
    if action(
        ui,
        "avatar.inspect",
        "Inspect collision mesh",
        inspector.pending.is_none(),
    ) {
        request = Some(Action::Inspect);
    }
    if action(
        ui,
        "avatar.check_start",
        "Check current initialization",
        inspector.pending.is_none() && !playing && !worker_pending,
    ) {
        request = Some(Action::CheckStart);
    }
    ui.small("Static triangle surface used by collisions. Cosmetic visibility does not remove collision geometry.");
    if playing || worker_pending {
        ui.small("Pause simulation before checking initialization.");
    }
    ui.small(format!(
        "VBD / OGC contact radius: {:.3} mm",
        settings.contact.radius * 1000.
    ));
    ui.small(format!(
        "Reference penalty collider only: clearance {:.3} mm · stiffness {:.3e} N/m",
        scene.collider.clearance * 1000.,
        scene.collider.stiffness
    ));
    if inspector.pending.is_some() {
        ui.small("Inspecting a captured snapshot on CPU…");
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(100));
    }
    if let Some(error) = &inspector.error {
        ui.colored_label(egui::Color32::LIGHT_RED, error);
    }
    if let Some(sample) = &inspector.sample {
        let current = sample.current(Stamp::new(scene, generation));
        ui.small(if current {
            "Current snapshot"
        } else {
            "Stale snapshot — inspect again after editing or simulation"
        });
        ui.small(format!(
            "Generation {} · captured at {:.6} s · CPU {:.2} ms",
            sample.stamp.generation,
            f64::from_bits(sample.stamp.time),
            sample.milliseconds
        ));
        match &sample.report {
            Err(error) => {
                ui.colored_label(egui::Color32::LIGHT_RED, error);
            }
            Ok(r) => {
                ui.small(format!(
                    "{} vertices ({} referenced) · {} triangles",
                    r.vertices, r.used_vertices, r.triangles
                ));
                ui.small(format!(
                    "Size: {:.3} × {:.3} × {:.3} m",
                    r.max.x - r.min.x,
                    r.max.y - r.min.y,
                    r.max.z - r.min.z
                ));
                ui.small(format!(
                    "Min: {:.3}, {:.3}, {:.3} m",
                    r.min.x, r.min.y, r.min.z
                ));
                ui.small(format!(
                    "Max: {:.3}, {:.3}, {:.3} m",
                    r.max.x, r.max.y, r.max.z
                ));
                ui.small(format!(
                    "Open edges: {} · nonmanifold edges: {}",
                    r.boundary_edges, r.nonmanifold_edges
                ));
                ui.small(format!(
                    "Inconsistent two-face edges: {} · duplicate faces: {}",
                    r.inconsistent_two_face_edges, r.duplicate_triangles
                ));
                ui.small(&r.fingerprint).on_hover_text("Order-sensitive geometry fingerprint, not a security hash or collision certificate.");
            }
        }
        match &sample.initialization {
            None => {
                ui.small("Cloth initialization: not checked.");
            }
            Some(Ok(())) => {
                ui.small(if current {
                    "Captured state passed the existing VBD initialization checks."
                } else {
                    "The old captured state passed; the current state has not been checked."
                });
            }
            Some(Err(error)) => {
                ui.colored_label(
                    egui::Color32::LIGHT_RED,
                    format!("Captured initialization failed: {error}"),
                );
            }
        }
    } else {
        ui.small("No inspection yet. Analysis runs only when requested.");
    }
    ui.small("Indexed topology only; no welding or avatar self-intersection test. Start checks use production sewing exclusions and do not certify global inside/outside containment. No repairs or solver changes.");
    if let Some(request) = request {
        inspector.start(request, scene, generation, ui.ctx());
    }
    ui.ctx().data_mut(|d| d.insert_temp(key(), inspector));
}

#[cfg(test)]
mod tests {
    use super::super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    use marvelous_cloth::{fitting::FittingProject, garment::presets::GarmentKind};

    struct Case {
        scene: FittingScene,
        settings: VbdSettings,
        generation: u64,
        playing: bool,
        pending: bool,
    }
    fn fixture(dir: &std::path::Path) -> Case {
        let path = dir.join("avatar.obj");
        std::fs::write(&path, "v 20 0 0\nv 21 0 0\nv 20 1 0\nf 1 2 3\n").unwrap();
        Case {
            scene: FittingProject::basic(GarmentKind::Tshirt, 0, path)
                .compile()
                .unwrap(),
            settings: VbdSettings::default(),
            generation: 1,
            playing: false,
            pending: false,
        }
    }
    fn draw(ui: &mut egui::Ui, c: &mut Case) {
        show(
            ui,
            &c.scene,
            &c.settings,
            c.generation,
            c.playing,
            c.pending,
        );
    }
    fn inspector(h: &Harness) -> Inspector {
        h.ctx.data(|d| d.get_temp::<Inspector>(key())).unwrap()
    }
    fn settle(h: &mut Harness, c: &mut Case) {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        loop {
            h.frame(c, &mut draw);
            if inspector(h).pending.is_none() {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "CPU inspection did not finish"
            );
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        h.frame(c, &mut draw);
    }
    #[test]
    fn named_inspection_refreshes_and_tracks_geometry_and_generation() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        let mut h = Harness::new(egui::vec2(420., 1000.));
        h.frame(&mut c, &mut draw);
        h.frame(&mut c, &mut draw);
        assert!(inspector(&h).sample.is_none());
        h.click("avatar.inspect", &mut c, &mut draw).unwrap();
        settle(&mut h, &mut c);
        let old = inspector(&h).sample.unwrap();
        assert_eq!(old.report.as_ref().unwrap().triangles, 1);
        assert!(old.current(Stamp::new(&c.scene, c.generation)));
        assert!(old.initialization.is_none());
        c.scene.state.time += 1.; // Static mesh inspection does not expire just because cloth advances.
        assert!(old.current(Stamp::new(&c.scene, c.generation)));
        c.generation += 1;
        h.frame(&mut c, &mut draw);
        assert!(!old.current(Stamp::new(&c.scene, c.generation)));
        h.click("avatar.inspect", &mut c, &mut draw).unwrap();
        settle(&mut h, &mut c);
        assert!(
            inspector(&h)
                .sample
                .unwrap()
                .current(Stamp::new(&c.scene, c.generation))
        );
    }
    #[test]
    fn named_start_check_requires_pause_and_does_not_advance_state() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        let before = serde_json::to_vec(&c.scene.state).unwrap();
        let mut h = Harness::new(egui::vec2(420., 1000.));
        c.playing = true;
        h.frame(&mut c, &mut draw);
        h.frame(&mut c, &mut draw);
        assert!(h.click("avatar.check_start", &mut c, &mut draw).is_err());
        c.playing = false;
        c.pending = true;
        h.frame(&mut c, &mut draw);
        assert!(h.click("avatar.check_start", &mut c, &mut draw).is_err());
        c.pending = false;
        h.frame(&mut c, &mut draw);
        h.click("avatar.check_start", &mut c, &mut draw).unwrap();
        settle(&mut h, &mut c);
        let sample = inspector(&h).sample.unwrap();
        assert!(sample.initialization.as_ref().unwrap().is_ok());
        assert_eq!(serde_json::to_vec(&c.scene.state).unwrap(), before);
        let t = c.scene.garment.mesh.triangles[0].vertices;
        let touching = marvelous_cloth::avatar::SurfaceMesh {
            vertices: t.map(|v| c.scene.state.x[v]).to_vec(),
            triangles: vec![[0, 1, 2]],
        };
        c.scene.collider = Arc::new(
            marvelous_cloth::avatar::MeshCollider::new(Arc::new(touching), 500_000.).unwrap(),
        );
        assert!(!sample.current(Stamp::new(&c.scene, c.generation)));
        h.frame(&mut c, &mut draw);
        h.click("avatar.check_start", &mut c, &mut draw).unwrap();
        settle(&mut h, &mut c);
        let failed = inspector(&h).sample.unwrap();
        assert!(failed.initialization.as_ref().unwrap().is_err());
        assert_eq!(serde_json::to_vec(&c.scene.state).unwrap(), before);
        c.scene.state.time += 0.01;
        assert!(!failed.current(Stamp::new(&c.scene, c.generation)));
    }

    #[test]
    fn named_controls_wait_for_one_job_and_recover_from_disconnection() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = fixture(dir.path());
        let mut h = Harness::new(egui::vec2(420., 1000.));
        let (send, receive) = mpsc::channel();
        h.ctx.data_mut(|d| {
            d.insert_temp(
                key(),
                Inspector {
                    pending: Some(Arc::new(Mutex::new(receive))),
                    ..Default::default()
                },
            )
        });
        h.frame(&mut c, &mut draw);
        h.frame(&mut c, &mut draw);
        assert!(h.click("avatar.inspect", &mut c, &mut draw).is_err());
        assert!(h.click("avatar.check_start", &mut c, &mut draw).is_err());
        drop(send);
        h.frame(&mut c, &mut draw);
        assert!(inspector(&h).error.is_some());
        assert!(inspector(&h).pending.is_none());
        h.click("avatar.inspect", &mut c, &mut draw).unwrap();
        settle(&mut h, &mut c);
        assert!(inspector(&h).error.is_none());
        assert!(inspector(&h).sample.is_some());
    }
}
