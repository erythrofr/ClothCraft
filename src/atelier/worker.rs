//! Fixed-step worker independent of repaint frequency. The latest controls win;
//! state stays on the worker within a generation. Only one result snapshot is
//! retained when the window is slow or hidden (no growing animation queue).
use eframe::{egui, wgpu};
use marvelous_cloth::{
    fitting::FittingScene,
    gpu_vbd::GpuVbd,
    model::State,
    vbd::{FinalDiagnostics, FinalDiagnosticsBackend, Grab, VbdMetrics, VbdSettings, VbdSolver},
};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

pub(super) struct Work {
    pub generation: u64,
    pub scene: FittingScene,
    pub settings: VbdSettings,
    pub grab: Option<Grab>,
    pub gpu: bool,
    pub ctx: egui::Context,
    pub playing: bool,
    pub once: bool,
}
pub(super) struct Done {
    pub generation: u64,
    pub had_grab: bool,
    pub result: Result<(State, VbdMetrics), String>,
}
pub(super) type Latest = Arc<Mutex<Option<Done>>>;

/// Identity of one sample request. The generation names the document/solver
/// generation; the request id distinguishes repeated requests in the same
/// generation. Timestamps alone cannot identify either one.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct FinalDiagnosticsRequest {
    pub generation: u64,
    pub request_id: u64,
}

#[derive(Clone)]
pub(super) struct FinalDiagnosticsResult {
    pub request: FinalDiagnosticsRequest,
    pub sample: FinalDiagnostics,
}

#[derive(Clone)]
pub(super) struct FinalDiagnosticsFailure {
    pub request: FinalDiagnosticsRequest,
    pub message: String,
}

/// One-shot request from the Simulation inspector. The worker owns the
/// accepted state and solver cache, so the UI only asks for the next accepted
/// step to be sampled instead of constructing a second solver or reading the
/// worker's private state. A newer queued request supersedes one the worker
/// has not taken yet; an already running sample may finish and is filtered by
/// its identity in the UI.
static FINAL_DIAGNOSTICS_REQUEST: Mutex<Option<FinalDiagnosticsRequest>> = Mutex::new(None);
/// Common-path guard: the worker pays one atomic swap per accepted step and
/// only takes the request mutex when a request is pending.
static FINAL_DIAGNOSTICS_REQUESTED: AtomicBool = AtomicBool::new(false);
static NEXT_FINAL_DIAGNOSTICS_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// One-shot result slot. It is separate from `Latest` so a slow frame cannot
/// overwrite a completed sample with a later ordinary step before the UI reads
/// it. The application has one physical worker.
static FINAL_DIAGNOSTICS: Mutex<Option<FinalDiagnosticsResult>> = Mutex::new(None);
static FINAL_DIAGNOSTICS_ERROR: Mutex<Option<FinalDiagnosticsFailure>> = Mutex::new(None);

pub(super) fn request_final_diagnostics(generation: u64) -> FinalDiagnosticsRequest {
    let request = FinalDiagnosticsRequest {
        generation,
        request_id: NEXT_FINAL_DIAGNOSTICS_REQUEST_ID.fetch_add(1, Ordering::Relaxed),
    };
    if let Ok(mut slot) = FINAL_DIAGNOSTICS_REQUEST.lock() {
        *slot = Some(request);
    }
    FINAL_DIAGNOSTICS_REQUESTED.store(true, Ordering::Release);
    request
}

pub(super) fn final_diagnostics() -> Option<FinalDiagnosticsResult> {
    FINAL_DIAGNOSTICS
        .lock()
        .ok()
        .and_then(|sample| sample.clone())
}

pub(super) fn final_diagnostics_error() -> Option<FinalDiagnosticsFailure> {
    FINAL_DIAGNOSTICS_ERROR
        .lock()
        .ok()
        .and_then(|error| error.clone())
}

fn take_final_diagnostics_request(generation: u64) -> Option<FinalDiagnosticsRequest> {
    if !FINAL_DIAGNOSTICS_REQUESTED.swap(false, Ordering::AcqRel) {
        return None;
    }
    let mut slot = FINAL_DIAGNOSTICS_REQUEST.lock().ok()?;
    match *slot {
        Some(request) if request.generation == generation => slot.take(),
        // A request for a newer generation may have arrived just before the
        // worker accepted the matching work. Keep it queued for that step.
        Some(request) if request.generation > generation => {
            FINAL_DIAGNOSTICS_REQUESTED.store(true, Ordering::Release);
            None
        }
        // Requests from an older generation are stale after reload/reset.
        Some(_) => {
            *slot = None;
            None
        }
        None => None,
    }
}

fn clear_final_diagnostics() {
    if let Ok(mut sample) = FINAL_DIAGNOSTICS.lock() {
        *sample = None;
    }
    if let Ok(mut error) = FINAL_DIAGNOSTICS_ERROR.lock() {
        *error = None;
    }
}

fn accept(active: &mut Option<Work>, mut new: Work, deadline: &mut Instant) {
    if let Some(old) = active {
        if old.generation == new.generation {
            // Never roll back to the slightly older snapshot displayed by egui.
            std::mem::swap(&mut old.scene.state, &mut new.scene.state);
            new.once |= old.once;
            if new.playing && !old.playing {
                *deadline = Instant::now();
            }
        } else {
            clear_final_diagnostics();
            *deadline = Instant::now();
        }
    }
    *active = Some(new);
}
pub(super) fn start(
    device: wgpu::Device,
    queue: wgpu::Queue,
) -> Result<(mpsc::Sender<Work>, Latest), std::io::Error> {
    let (tx, latest, _thread) = start_inner(
        Some((device, queue)),
        #[cfg(test)]
        None,
    )?;
    Ok((tx, latest))
}

#[cfg(test)]
struct TestHooks {
    entered: mpsc::Sender<u64>,
    release: mpsc::Receiver<()>,
    published: mpsc::Sender<u64>,
}

fn start_inner(
    backend: Option<(wgpu::Device, wgpu::Queue)>,
    #[cfg(test)] hooks: Option<TestHooks>,
) -> Result<(mpsc::Sender<Work>, Latest, std::thread::JoinHandle<()>), std::io::Error> {
    let (tx, rx) = mpsc::channel::<Work>();
    let latest: Latest = Arc::new(Mutex::new(None));
    let output = latest.clone();
    let thread = std::thread::Builder::new()
        .name("cloth-vbd".into())
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let gpu = backend.map(|(device, queue)| GpuVbd::new(device, queue));
            let mut cache: Option<(u64, VbdSolver)> = None;
            let mut active: Option<Work> = None;
            let mut deadline = Instant::now();
            loop {
                let wait = active.as_ref().and_then(|w| {
                    if w.once {
                        Some(Duration::ZERO)
                    } else if w.playing {
                        Some(deadline.saturating_duration_since(Instant::now()))
                    } else {
                        None
                    }
                });
                let message = match wait {
                    Some(timeout) => match rx.recv_timeout(timeout) {
                        Ok(w) => Some(w),
                        Err(mpsc::RecvTimeoutError::Timeout) => None,
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    },
                    None => match rx.recv() {
                        Ok(w) => Some(w),
                        Err(_) => break,
                    },
                };
                if let Some(w) = message {
                    accept(&mut active, w, &mut deadline);
                }
                while let Ok(w) = rx.try_recv() {
                    accept(&mut active, w, &mut deadline);
                }
                let Some(w) = &mut active else { continue };
                if !w.once && (!w.playing || Instant::now() < deadline) {
                    continue;
                }
                // A request from another generation is stale even if the
                // physical timestamp happens to match after a reload or reset.
                let request = take_final_diagnostics_request(w.generation);
                if request.is_some() {
                    // A new request supersedes the previous result; never let
                    // an old sample look like the answer to this request.
                    clear_final_diagnostics();
                }
                #[cfg(test)]
                if let Some(hooks) = &hooks {
                    let _ = hooks.entered.send(w.generation);
                    if hooks.release.recv().is_err() {
                        break;
                    }
                }
                let previous = request.map(|_| w.scene.state.clone());
                w.once = false;
                let result: Result<(State, VbdMetrics), String> = (|| {
                    if w.gpu && gpu.is_none() {
                        return Err("GPU simulation requested without a GPU backend".to_owned());
                    }
                    if cache.as_ref().is_none_or(|(g, _)| *g != w.generation) {
                        cache = Some((
                            w.generation,
                            VbdSolver::new(
                                w.scene.garment.clone(),
                                Some(&w.scene.collider.surface),
                                &w.scene.state,
                            )?,
                        ));
                        // A sample belongs to the solver generation that made it.
                        clear_final_diagnostics();
                    }
                    let solver = &mut cache.as_mut().unwrap().1;
                    let metrics = if w.gpu {
                        gpu.as_ref()
                            .ok_or_else(|| {
                                "GPU simulation requested without a GPU backend".to_owned()
                            })?
                            .step(solver, &mut w.scene.state, &w.settings, w.grab.as_ref())
                    } else {
                        solver.step(&mut w.scene.state, &w.settings, w.grab.as_ref())
                    }?;
                    if let (Some(request), Some(previous)) = (request, previous) {
                        let backend = if w.gpu {
                            FinalDiagnosticsBackend::CpuAuditOfGpuState
                        } else {
                            FinalDiagnosticsBackend::Cpu
                        };
                        match solver.sample_final_diagnostics(
                            &previous,
                            &w.scene.state,
                            &w.settings,
                            w.grab.as_ref(),
                            backend,
                        ) {
                            Ok(sample) => {
                                if let Ok(mut slot) = FINAL_DIAGNOSTICS.lock() {
                                    *slot = Some(FinalDiagnosticsResult { request, sample });
                                }
                                if let Ok(mut error) = FINAL_DIAGNOSTICS_ERROR.lock() {
                                    *error = None;
                                }
                            }
                            Err(message) => {
                                if let Ok(mut slot) = FINAL_DIAGNOSTICS.lock() {
                                    *slot = None;
                                }
                                if let Ok(mut error) = FINAL_DIAGNOSTICS_ERROR.lock() {
                                    *error = Some(FinalDiagnosticsFailure { request, message });
                                }
                            }
                        }
                    }
                    Ok((w.scene.state.clone(), metrics))
                })();
                if let Err(error) = &result {
                    if let Some(request) = request {
                        if let Ok(mut sample) = FINAL_DIAGNOSTICS.lock() {
                            *sample = None;
                        }
                        if let Ok(mut slot) = FINAL_DIAGNOSTICS_ERROR.lock() {
                            *slot = Some(FinalDiagnosticsFailure {
                                request,
                                message: error.clone(),
                            });
                        }
                    }
                    w.playing = false;
                }
                let mut slot = output.lock().unwrap();
                let had_grab = w.grab.is_some()
                    || slot
                        .as_ref()
                        .is_some_and(|d| d.generation == w.generation && d.had_grab);
                *slot = Some(Done {
                    generation: w.generation,
                    had_grab,
                    result,
                });
                drop(slot);
                #[cfg(test)]
                if let Some(hooks) = &hooks {
                    let _ = hooks.published.send(w.generation);
                }
                w.ctx.request_repaint();
                // Keep the wall-clock phase through isolated BVH rebuilds and OS
                // wakeup jitter. Bound catch-up to four steps; never change the
                // physical dt or iteration budget when the machine is overloaded.
                let dt = Duration::from_secs_f64(w.settings.dt);
                deadline = (deadline + dt).max(Instant::now() - dt * 4);
            }
        })?;
    Ok((tx, latest, thread))
}

#[cfg(test)]
mod final_diagnostics_transport_tests {
    use super::*;
    use std::sync::Mutex;

    // These tests exercise the one physical worker's global mailbox.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn reset() {
        if let Ok(mut request) = FINAL_DIAGNOSTICS_REQUEST.lock() {
            *request = None;
        }
        FINAL_DIAGNOSTICS_REQUESTED.store(false, Ordering::Release);
        clear_final_diagnostics();
    }

    // Dropping the release sender unblocks the worker even if an assertion panics.
    struct TestWorker {
        tx: Option<mpsc::Sender<Work>>,
        release: Option<mpsc::Sender<()>>,
        thread: Option<std::thread::JoinHandle<()>>,
    }

    impl TestWorker {
        fn shutdown(mut self) {
            self.release.take();
            self.tx.take();
            self.thread.take().unwrap().join().unwrap();
        }
    }

    impl Drop for TestWorker {
        fn drop(&mut self) {
            self.release.take();
            self.tx.take();
            if let Some(thread) = self.thread.take() {
                let _ = thread.join();
            }
        }
    }

    #[test]
    fn cpu_worker_keeps_generation_state_and_rejects_missing_gpu() {
        use marvelous_cloth::{fitting::FittingProject, garment::presets::GarmentKind};
        let _guard = TEST_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        reset();
        let dir = tempfile::tempdir().unwrap();
        let avatar = dir.path().join("avatar.obj");
        std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
        let project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
        let scene = project.compile().unwrap();
        let settings = VbdSettings::default();
        let mut direct = scene.state.clone();
        let mut solver = VbdSolver::new(
            scene.garment.clone(),
            Some(&scene.collider.surface),
            &direct,
        )
        .unwrap();
        solver.step(&mut direct, &settings, None).unwrap();
        let fresh_first_step = direct.clone();
        let (entered_tx, entered) = mpsc::channel();
        let (release, release_rx) = mpsc::channel();
        let (published_tx, published) = mpsc::channel();
        let (tx, latest, thread) = start_inner(
            None,
            Some(TestHooks {
                entered: entered_tx,
                release: release_rx,
                published: published_tx,
            }),
        )
        .unwrap();
        let worker = TestWorker {
            tx: Some(tx),
            release: Some(release),
            thread: Some(thread),
        };
        let work = |generation, gpu| Work {
            generation,
            scene: FittingScene {
                garment: scene.garment.clone(),
                collider: scene.collider.clone(),
                state: scene.state.clone(),
                quasistatic: scene.quasistatic,
                next_dt: scene.next_dt,
            },
            settings: settings.clone(),
            grab: None,
            gpu,
            ctx: egui::Context::default(),
            playing: false,
            once: true,
        };
        let timeout = Duration::from_secs(30);
        worker.tx.as_ref().unwrap().send(work(11, false)).unwrap();
        assert_eq!(entered.recv_timeout(timeout).unwrap(), 11);
        // Exercise the production installer and history while the actual worker
        // holds its pending state. The test does not create a native viewport.
        let mut editor_project =
            FittingProject::basic(GarmentKind::Tshirt, 0, project.avatar_path.clone());
        let mut editor_scene = editor_project.compile().unwrap();
        let original = serde_json::to_vec(&editor_project.template).unwrap();
        let initial_editor_state = editor_scene.state.clone();
        let mut authoring_ui = super::super::authoring_ui::AuthoringUi::default();
        let mut issue = super::super::issue_ui::IssueUi::default();
        let (mut dirty, mut generation, mut playing, mut pending) = (false, 11, true, true);
        let (mut metrics, mut grab, mut plane, mut error) = (None, None, None, None);
        let mut status = String::new();
        {
            use marvelous_cloth::authoring::{self, Command};
            let mut transition = super::super::authoring_ui::EditorTransition {
                authoring: &mut authoring_ui,
                project: &mut editor_project,
                scene: &mut editor_scene,
                issue: &mut issue,
                dirty: &mut dirty,
                generation: &mut generation,
                playing: &mut playing,
                pending: &mut pending,
                metrics: &mut metrics,
                grab: &mut grab,
                drag_plane: &mut plane,
                simulation_error: &mut error,
                status: &mut status,
                dt: settings.dt,
            };
            let edit = authoring::apply(
                &transition.project.template,
                Command::FabricAppearance {
                    fabric: transition.project.template.fabrics[0].id.clone(),
                    appearance: Some(Default::default()),
                },
            )
            .unwrap();
            assert!(!edit.reset_simulation);
            transition
                .authoring
                .history
                .record(transition.project.template.clone());
            transition.install(edit);
            let edited = serde_json::to_vec(&transition.project.template).unwrap();
            assert_ne!(edited, original);
            assert_eq!(transition.scene.state.x, initial_editor_state.x);
            assert_eq!(transition.scene.state.v, initial_editor_state.v);
            assert_eq!(transition.scene.state.time, initial_editor_state.time);
            let undo = transition
                .authoring
                .history
                .restore(&transition.project.template, false)
                .unwrap();
            transition.install(undo);
            assert_eq!(
                serde_json::to_vec(&transition.project.template).unwrap(),
                original
            );
            assert_eq!(transition.scene.state.x, initial_editor_state.x);
            assert_eq!(transition.scene.state.v, initial_editor_state.v);
            assert_eq!(transition.scene.state.time, initial_editor_state.time);
            let redo = transition
                .authoring
                .history
                .restore(&transition.project.template, true)
                .unwrap();
            transition.install(redo);
            assert_eq!(
                serde_json::to_vec(&transition.project.template).unwrap(),
                edited
            );
            assert_eq!(transition.scene.state.x, initial_editor_state.x);
            assert_eq!(transition.scene.state.v, initial_editor_state.v);
            assert_eq!(transition.scene.state.time, initial_editor_state.time);
            assert!(*transition.playing && *transition.pending);
            assert_eq!(*transition.generation, 11);
        }
        let optical_template = serde_json::to_vec(&editor_project.template).unwrap();
        // The UI may submit its old displayed state while a real step is in flight.
        worker.tx.as_ref().unwrap().send(work(11, false)).unwrap();
        worker.release.as_ref().unwrap().send(()).unwrap();
        assert_eq!(published.recv_timeout(timeout).unwrap(), 11);
        assert_eq!(entered.recv_timeout(timeout).unwrap(), 11);
        let first = latest.lock().unwrap().take().unwrap();
        assert!(
            super::super::current_worker_result(
                Some(Done {
                    generation: first.generation,
                    had_grab: first.had_grab,
                    result: first.result.clone()
                }),
                12
            )
            .is_none()
        );
        let accepted = super::super::current_worker_result(Some(first), generation).unwrap();
        let actual = accepted.result.unwrap().0;
        assert_eq!(actual.time, direct.time);
        assert_eq!(actual.x, direct.x);
        assert_eq!(actual.v, direct.v);
        // Approximate the consumer's pending reset and state copy; this is not
        // the Atelier update path. The optical edit must remain installed.
        assert!(pending);
        pending = false;
        editor_scene.state = actual;
        assert_eq!(editor_scene.state.time, direct.time);
        assert_eq!(
            serde_json::to_vec(&editor_project.template).unwrap(),
            optical_template
        );
        assert_eq!(generation, 11);
        assert!(!pending);
        solver.step(&mut direct, &settings, None).unwrap();
        worker.release.as_ref().unwrap().send(()).unwrap();
        assert_eq!(published.recv_timeout(timeout).unwrap(), 11);
        let second =
            super::super::current_worker_result(latest.lock().unwrap().take(), 11).unwrap();
        let actual = second.result.unwrap().0;
        assert_eq!(actual.time, direct.time);
        assert_eq!(actual.x, direct.x);
        assert_eq!(actual.v, direct.v);
        // A rejected GPU request must leave the cached same-generation solver
        // and its state intact. Compare the resumed step to an uninterrupted
        // CPU solver, then repeat the failure and switch to a fresh generation.
        for (failure_generation, resume_generation) in [(11, 11), (12, 12), (12, 13)] {
            worker
                .tx
                .as_ref()
                .unwrap()
                .send(work(failure_generation, true))
                .unwrap();
            assert_eq!(entered.recv_timeout(timeout).unwrap(), failure_generation);
            worker.release.as_ref().unwrap().send(()).unwrap();
            assert_eq!(published.recv_timeout(timeout).unwrap(), failure_generation);
            let failure = latest.lock().unwrap().take().unwrap();
            assert_eq!(failure.generation, failure_generation);
            assert!(
                failure
                    .result
                    .unwrap_err()
                    .contains("without a GPU backend")
            );

            worker
                .tx
                .as_ref()
                .unwrap()
                .send(work(resume_generation, false))
                .unwrap();
            assert_eq!(entered.recv_timeout(timeout).unwrap(), resume_generation);
            worker.release.as_ref().unwrap().send(()).unwrap();
            assert_eq!(published.recv_timeout(timeout).unwrap(), resume_generation);
            let resumed = latest.lock().unwrap().take().unwrap();
            assert_eq!(resumed.generation, resume_generation);
            let actual = resumed.result.unwrap().0;
            let expected = if resume_generation == 11 {
                solver.step(&mut direct, &settings, None).unwrap();
                &direct
            } else {
                &fresh_first_step
            };
            assert_eq!(actual.time, expected.time);
            assert_eq!(actual.x, expected.x);
            assert_eq!(actual.v, expected.v);
        }
        worker.shutdown();
        reset();
    }

    #[test]
    fn latest_mailbox_replaces_old_generation_after_inflight_step() {
        use marvelous_cloth::{fitting::FittingProject, garment::presets::GarmentKind};
        let _guard = TEST_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        reset();
        let dir = tempfile::tempdir().unwrap();
        let avatar = dir.path().join("avatar.obj");
        std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
        let project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
        let old_scene = project.compile().unwrap();
        let mut new_scene = project.compile().unwrap();
        // A different starting time makes accidental reuse of the previous
        // generation's state observable, even if both geometries are equal.
        new_scene.state.time = 10.0;
        let mut newest_scene = project.compile().unwrap();
        newest_scene.state.time = 10.0;
        let settings = VbdSettings::default();
        let mut newest_settings = settings.clone();
        newest_settings.gravity *= 0.25;
        let mut expected = newest_scene.state.clone();
        let mut solver = VbdSolver::new(
            new_scene.garment.clone(),
            Some(&new_scene.collider.surface),
            &expected,
        )
        .unwrap();
        solver.step(&mut expected, &newest_settings, None).unwrap();
        let (entered_tx, entered) = mpsc::channel();
        let (release, release_rx) = mpsc::channel();
        let (published_tx, published) = mpsc::channel();
        let (tx, latest, thread) = start_inner(
            None,
            Some(TestHooks {
                entered: entered_tx,
                release: release_rx,
                published: published_tx,
            }),
        )
        .unwrap();
        let worker = TestWorker {
            tx: Some(tx),
            release: Some(release),
            thread: Some(thread),
        };
        let work = |generation, scene| Work {
            generation,
            scene,
            settings: settings.clone(),
            grab: None,
            gpu: false,
            ctx: egui::Context::default(),
            playing: false,
            once: true,
        };
        let timeout = Duration::from_secs(30);
        worker
            .tx
            .as_ref()
            .unwrap()
            .send(work(21, old_scene))
            .unwrap();
        assert_eq!(entered.recv_timeout(timeout).unwrap(), 21);
        // Queue the new generation while the previous accepted step is held.
        worker
            .tx
            .as_ref()
            .unwrap()
            .send(work(22, new_scene))
            .unwrap();
        // The newest controls win without dropping the earlier single-step
        // request, even though this update itself does not request a step.
        let mut newest = work(22, newest_scene);
        newest.settings = newest_settings;
        newest.once = false;
        worker.tx.as_ref().unwrap().send(newest).unwrap();
        worker.release.as_ref().unwrap().send(()).unwrap();
        assert_eq!(published.recv_timeout(timeout).unwrap(), 21);
        assert_eq!(entered.recv_timeout(timeout).unwrap(), 22);
        {
            let slot = latest.lock().unwrap();
            let first = slot.as_ref().unwrap();
            assert_eq!(first.generation, 21);
            assert!(first.result.is_ok());
        }
        // Leave the first result unconsumed. The next publication replaces it.
        worker.release.as_ref().unwrap().send(()).unwrap();
        assert_eq!(published.recv_timeout(timeout).unwrap(), 22);
        let last = latest.lock().unwrap().take().unwrap();
        assert_eq!(last.generation, 22);
        let actual = last.result.unwrap().0;
        assert_eq!(actual.time, expected.time);
        assert_eq!(actual.x, expected.x);
        assert_eq!(actual.v, expected.v);
        assert!(latest.lock().unwrap().is_none());
        worker.shutdown();
        reset();
    }

    #[test]
    fn newer_request_has_a_new_identity_and_supersedes_a_queued_request() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        reset();

        let first = request_final_diagnostics(11);
        let second = request_final_diagnostics(11);
        let reloaded = request_final_diagnostics(12);

        assert_eq!(first.generation, 11);
        assert_eq!(second.generation, 11);
        assert_eq!(reloaded.generation, 12);
        assert_ne!(first.request_id, second.request_id);
        assert_ne!(second.request_id, reloaded.request_id);
        assert_eq!(take_final_diagnostics_request(11), None);
        assert_eq!(take_final_diagnostics_request(12), Some(reloaded));

        let stale = request_final_diagnostics(10);
        assert_eq!(stale.generation, 10);
        assert_eq!(take_final_diagnostics_request(11), None);
        assert_eq!(take_final_diagnostics_request(11), None);

        reset();
    }
}
