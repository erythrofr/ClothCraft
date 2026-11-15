//! User preferences: theme, board and simulation defaults.
//!
//! Preferences are persisted as JSON in the session output directory. A missing,
//! truncated or corrupt file never panics: the loader falls back to
//! [`Preferences::default`] and clamps hand-edited values into the ranges that
//! the board and `VbdSettings::validate` actually accept.
use eframe::egui;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Name of the preferences file inside the session output directory.
pub(super) const FILE_NAME: &str = "preferences.json";

/// The two workspace themes [`apply`] can install.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum ThemeChoice {
    Light,
    Dark,
}

/// Board magnet step in millimetres.
pub(super) const SNAP_MM_MIN: f64 = 0.1;
pub(super) const SNAP_MM_MAX: f64 = 100.;
/// Physical time step in seconds, inside `VbdSettings::validate` (1e-6..=0.025).
pub(super) const DT_MIN: f64 = 1. / 240.;
pub(super) const DT_MAX: f64 = 0.025;
/// VBD iterations per step; the inspector slider offers the same range.
pub(super) const ITERATIONS_MIN: usize = 2;
pub(super) const ITERATIONS_MAX: usize = 128;

const DEFAULT_SNAP_MM: f64 = 10.;
const DEFAULT_DT: f64 = 1. / 60.;
const DEFAULT_ITERATIONS: usize = 16;
/// Length of the File > Open recent list.
pub(super) const RECENT_FILES_MAX: usize = 10;

/// User preferences. Every field is read by the live atelier; nothing is stored
/// for show only.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub(super) struct Preferences {
    pub(super) workspace: super::layout::WorkspaceLayout,
    pub(super) viewport: crate::render::appearance::Appearance,
    /// Workspace theme installed at startup and whenever the switch changes.
    pub(super) theme: ThemeChoice,
    /// Board magnet step in millimetres; the 2D board snaps to this grid.
    pub(super) snap_mm: f64,
    /// Whether the 2D + 3D seam-link overlay starts enabled.
    pub(super) seam_links: bool,
    /// Whether the wireframe mesh overlay starts enabled.
    pub(super) wireframe: bool,
    /// Physical time step in seconds for the fixed-step worker.
    pub(super) dt: f64,
    /// VBD iterations per physical step.
    pub(super) iterations: usize,
    /// Project files opened or saved most recently, newest first.
    pub(super) recent_files: Vec<PathBuf>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            workspace: Default::default(),
            viewport: Default::default(),
            theme: ThemeChoice::Light,
            snap_mm: DEFAULT_SNAP_MM,
            seam_links: true,
            wireframe: false,
            dt: DEFAULT_DT,
            iterations: DEFAULT_ITERATIONS,
            recent_files: Vec::new(),
        }
    }
}

impl Preferences {
    /// Clamp values that a hand-edited or corrupt file could otherwise push
    /// outside the ranges the board and `VbdSettings::validate` accept.
    fn sanitize(&mut self) {
        self.workspace.sanitize();
        self.viewport.sanitize();
        self.snap_mm = finite_or(self.snap_mm, DEFAULT_SNAP_MM).clamp(SNAP_MM_MIN, SNAP_MM_MAX);
        self.dt = finite_or(self.dt, DEFAULT_DT).clamp(DT_MIN, DT_MAX);
        self.iterations = self.iterations.clamp(ITERATIONS_MIN, ITERATIONS_MAX);
        self.recent_files.truncate(RECENT_FILES_MAX);
    }
}

/// Replace a non-finite value before clamping; `f64::clamp` propagates NaN.
fn finite_or(value: f64, fallback: f64) -> f64 {
    if value.is_finite() { value } else { fallback }
}

/// Read preferences from `path`. A missing, unreadable, truncated or corrupt
/// file yields the defaults; no error is propagated and nothing panics.
pub(super) fn load(path: &Path) -> Preferences {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Preferences::default();
    };
    let mut prefs: Preferences = serde_json::from_str(&text).unwrap_or_default();
    prefs.sanitize();
    prefs
}

/// Write preferences to `path`, creating the parent directory when needed.
pub(super) fn save(path: &Path, prefs: &Preferences) -> std::io::Result<()> {
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(prefs).map_err(std::io::Error::other)?;
    std::fs::write(path, text)
}

/// Draw the Preferences window. `changed` is set when any value was edited so
/// the caller can re-apply the theme and re-save the file.
///
/// The window is opened from the menu bar by the caller; it stays resizable and
/// shows the current values, including a Restore defaults button.
pub(super) fn window(
    ctx: &egui::Context,
    open: &mut bool,
    prefs: &mut Preferences,
    changed: &mut bool,
) {
    if !*open {
        return;
    }
    let mut edited = false;
    egui::Window::new("Preferences")
        .open(open)
        .resizable(true)
        .default_width(340.)
        .show(ctx, |ui| {
            ui.heading("Appearance");
            ui.horizontal(|ui| {
                ui.label("Theme");
                edited |= ui
                    .selectable_value(&mut prefs.theme, ThemeChoice::Light, "Light")
                    .changed();
                edited |= ui
                    .selectable_value(&mut prefs.theme, ThemeChoice::Dark, "Dark")
                    .changed();
            });
            ui.small("Viewport appearance: use the gear above the 3D view. Pane sizes: drag a divider; double-click to reset.");

            ui.separator();
            ui.heading("Board");
            ui.horizontal(|ui| {
                ui.label("Snap step (mm)");
                edited |= ui
                    .add(
                        egui::DragValue::new(&mut prefs.snap_mm)
                            .speed(0.1)
                            .range(SNAP_MM_MIN..=SNAP_MM_MAX),
                    )
                    .changed();
            });

            ui.separator();
            ui.heading("Overlays");
            edited |= ui
                .checkbox(&mut prefs.seam_links, "Seam links enabled at startup")
                .changed();
            edited |= ui
                .checkbox(&mut prefs.wireframe, "Wireframe enabled at startup")
                .changed();

            ui.separator();
            ui.heading("Simulation defaults for next launch");
            ui.horizontal(|ui| {
                ui.label("Time step (s)");
                edited |= ui
                    .add(
                        egui::DragValue::new(&mut prefs.dt)
                            .speed(0.0005)
                            .range(DT_MIN..=DT_MAX),
                    )
                    .changed();
            });
            ui.horizontal(|ui| {
                ui.label("Iterations");
                edited |= ui
                    .add(
                        egui::DragValue::new(&mut prefs.iterations)
                            .speed(1.)
                            .range(ITERATIONS_MIN..=ITERATIONS_MAX),
                    )
                    .changed();
            });
            ui.separator();
            ui.horizontal(|ui| {
                if ui.button("Restore defaults").clicked() {
                    *prefs = Preferences::default();
                    edited = true;
                }
                ui.small(format!("Stored as {FILE_NAME} in the session folder"));
            });
        });
    *changed |= edited;
}

/// Install the workspace chrome for the selected theme, and select that theme so
/// widgets that branch on `dark_mode` agree with the installed palette.
pub(super) fn apply(ctx: &egui::Context, prefs: &Preferences) {
    ctx.set_theme(match prefs.theme {
        ThemeChoice::Light => egui::Theme::Light,
        ThemeChoice::Dark => egui::Theme::Dark,
    });
    match prefs.theme {
        ThemeChoice::Light => super::workspace::style(ctx),
        ThemeChoice::Dark => super::workspace::dark_style(ctx),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Preferences {
        Preferences {
            theme: ThemeChoice::Dark,
            snap_mm: 2.5,
            seam_links: false,
            wireframe: true,
            dt: 1.0 / 120.0,
            iterations: 24,
            ..Default::default()
        }
    }

    /// Scratch file under `target/`, which the test sandbox can always write.
    fn scratch_path(name: &str) -> std::path::PathBuf {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("target/preferences-tests");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(format!("{name}-{}.json", std::process::id()))
    }

    #[test]
    fn serde_round_trip_preserves_every_field() {
        let prefs = sample();
        let json = serde_json::to_string(&prefs).unwrap();
        assert_eq!(serde_json::from_str::<Preferences>(&json).unwrap(), prefs);
    }

    #[test]
    fn every_field_survives_a_save_load_cycle() {
        let path = scratch_path("cycle");
        let _ = std::fs::remove_file(&path);
        let prefs = sample();
        save(&path, &prefs).unwrap();
        assert_eq!(load(&path), prefs);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults_without_panicking() {
        let path = scratch_path("corrupt");
        std::fs::write(&path, "{ this is not json").unwrap();
        assert_eq!(load(&path), Preferences::default());
        std::fs::write(&path, "[]").unwrap();
        assert_eq!(load(&path), Preferences::default());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn missing_file_returns_defaults() {
        let path = scratch_path("missing");
        let _ = std::fs::remove_file(&path);
        assert_eq!(load(&path), Preferences::default());
    }

    #[test]
    fn partial_file_keeps_stated_fields_and_defaults_the_rest() {
        let path = scratch_path("partial");
        std::fs::write(&path, "{\"theme\":\"dark\",\"iterations\":24}").unwrap();
        let prefs = load(&path);
        assert_eq!(prefs.theme, ThemeChoice::Dark);
        assert_eq!(prefs.iterations, 24);
        assert_eq!(prefs.snap_mm, Preferences::default().snap_mm);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn out_of_range_values_are_clamped_to_solver_and_board_ranges() {
        let path = scratch_path("clamped");
        std::fs::write(
            &path,
            "{\"snap_mm\":-5.0,\"dt\":9.0,\"iterations\":9999,\"mesh_mm\":1.0e9}",
        )
        .unwrap();
        let prefs = load(&path);
        assert_eq!(prefs.snap_mm, SNAP_MM_MIN);
        assert_eq!(prefs.dt, DT_MAX);
        assert_eq!(prefs.iterations, ITERATIONS_MAX);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn apply_installs_a_real_dark_style_and_the_reviewed_light_style() {
        let ctx = egui::Context::default();
        let light = Preferences {
            theme: ThemeChoice::Light,
            ..Preferences::default()
        };
        let dark = Preferences {
            theme: ThemeChoice::Dark,
            ..Preferences::default()
        };
        let reviewed = egui::Color32::from_rgb(0xEC, 0xEC, 0xEC);

        apply(&ctx, &light);
        assert_eq!(
            ctx.style_of(egui::Theme::Light).visuals.panel_fill,
            reviewed
        );
        assert_eq!(ctx.style_of(egui::Theme::Dark).visuals.panel_fill, reviewed);
        assert!(!ctx.style_of(egui::Theme::Light).visuals.dark_mode);

        apply(&ctx, &dark);
        let dark_fill = ctx.style_of(egui::Theme::Dark).visuals.panel_fill;
        assert_ne!(dark_fill, reviewed, "dark must not reuse the light fill");
        assert_eq!(
            ctx.style_of(egui::Theme::Light).visuals.panel_fill,
            dark_fill
        );
        assert!(ctx.style_of(egui::Theme::Dark).visuals.dark_mode);

        // Switching back must restore the reviewed light palette exactly.
        apply(&ctx, &light);
        assert_eq!(
            ctx.style_of(egui::Theme::Light).visuals.panel_fill,
            reviewed
        );
        assert!(!ctx.style_of(egui::Theme::Light).visuals.dark_mode);
    }
}
