//! Named presentation snapshots; garment and solver state are intentionally absent.
use super::{layout::WorkspaceLayout, settings::Preferences};
use crate::render::appearance::Appearance;
use eframe::egui;
use serde::{Deserialize, Serialize};
use std::{io::Read, path::Path};

pub(super) const FILE_NAME: &str = "workspace-profiles.json";
const MAX_BYTES: u64 = 256 * 1024;
const MAX_PROFILES: usize = 32;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub(super) struct Snapshot {
    layout: WorkspaceLayout,
    appearance: Appearance,
    tools_visible: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    wireframe: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seam_links: Option<bool>,
}
impl Default for Snapshot {
    fn default() -> Self {
        Self {
            layout: Default::default(),
            appearance: Default::default(),
            tools_visible: true,
            wireframe: None,
            seam_links: None,
        }
    }
}
impl Snapshot {
    pub fn capture(
        prefs: &Preferences,
        tools_visible: bool,
        wireframe: bool,
        seam_links: bool,
    ) -> Self {
        let mut snapshot = Self {
            layout: prefs.workspace.clone(),
            appearance: prefs.viewport.clone(),
            tools_visible,
            wireframe: Some(wireframe),
            seam_links: Some(seam_links),
        };
        snapshot.sanitize();
        snapshot
    }
    fn has_overlay_settings(&self) -> bool {
        self.wireframe.is_some() || self.seam_links.is_some()
    }
    fn sanitize(&mut self) {
        self.layout.sanitize();
        self.appearance.sanitize();
    }
    pub fn apply(
        &self,
        prefs: &mut Preferences,
        tools_visible: &mut bool,
        wireframe: &mut bool,
        seam_links: &mut bool,
    ) {
        let mut safe = self.clone();
        safe.sanitize();
        prefs.workspace = safe.layout;
        prefs.viewport = safe.appearance;
        *tools_visible = safe.tools_visible;
        if let Some(value) = safe.wireframe {
            *wireframe = value;
        }
        if let Some(value) = safe.seam_links {
            *seam_links = value;
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
struct Profile {
    name: String,
    snapshot: Snapshot,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(super) struct Store {
    version: u32,
    profiles: Vec<Profile>,
    // Exact bytes read from disk, never serialized. This detects edits by a
    // second instance even when unknown JSON fields or formatting changed.
    #[serde(skip)]
    source_text: Option<String>,
}
impl Default for Store {
    fn default() -> Self {
        Self {
            version: 1,
            profiles: vec![],
            source_text: None,
        }
    }
}
fn valid_name(name: &str) -> Result<(), String> {
    if name.trim() != name
        || name.is_empty()
        || name.chars().count() > 48
        || name.chars().any(char::is_control)
    {
        return Err("Use 1–48 characters, without control characters or outer spaces".into());
    }
    Ok(())
}
fn read_source(path: &Path) -> Result<Option<String>, String> {
    let file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    let mut text = String::new();
    file.take(MAX_BYTES + 1)
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;
    if text.len() as u64 > MAX_BYTES {
        return Err("Workspace profiles exceed 256 KiB".into());
    }
    Ok(Some(text))
}
impl Store {
    pub fn load(path: &Path) -> Result<Self, String> {
        let Some(text) = read_source(path)? else {
            return Ok(Self::default());
        };
        let mut store: Self =
            serde_json::from_str(&text).map_err(|e| format!("Invalid workspace profiles: {e}"))?;
        if !matches!(store.version, 1 | 2) || store.profiles.len() > MAX_PROFILES {
            return Err("Unsupported profile version or too many profiles".into());
        }
        let mut names = std::collections::BTreeSet::new();
        for profile in &mut store.profiles {
            valid_name(&profile.name)?;
            if !names.insert(profile.name.to_lowercase()) {
                return Err("Duplicate workspace profile names".into());
            }
            profile.snapshot.sanitize();
        }
        // Early preview builds wrote overlay fields as version 1. Once such a
        // file is loaded, every subsequent write must use the newer version,
        // even if the last overlay profile is later removed.
        if store
            .profiles
            .iter()
            .any(|p| p.snapshot.has_overlay_settings())
        {
            store.version = 2;
        }
        store.source_text = Some(text);
        Ok(store)
    }
    /// Prepare a full replacement before writing; failures preserve both self and disk.
    pub fn save_profile(
        &mut self,
        path: &Path,
        name: &str,
        snapshot: Snapshot,
        replace: bool,
    ) -> Result<(), String> {
        valid_name(name)?;
        let mut next = self.clone();
        let found = next
            .profiles
            .iter()
            .position(|p| p.name.to_lowercase() == name.to_lowercase());
        let mut snapshot = snapshot;
        snapshot.sanitize();
        if snapshot.has_overlay_settings() {
            next.version = 2;
        }
        match (found, replace) {
            (Some(index), true) => {
                next.profiles[index] = Profile {
                    name: name.into(),
                    snapshot,
                }
            }
            (Some(_), false) => {
                return Err("A profile with this name exists; choose Replace explicitly".into());
            }
            (None, true) => return Err("The profile to replace no longer exists".into()),
            (None, false) if next.profiles.len() < MAX_PROFILES => next.profiles.push(Profile {
                name: name.into(),
                snapshot,
            }),
            _ => return Err("At most 32 workspace profiles are supported".into()),
        }
        next.persist(path)?;
        *self = next;
        Ok(())
    }
    pub fn remove(&mut self, path: &Path, name: &str) -> Result<(), String> {
        let mut next = self.clone();
        let index = next
            .profiles
            .iter()
            .position(|p| p.name == name)
            .ok_or("Profile no longer exists")?;
        next.profiles.remove(index);
        next.persist(path)?;
        *self = next;
        Ok(())
    }
    /// Rename without changing the saved presentation. Commit memory only
    /// after the complete replacement file has been written successfully.
    pub fn rename(&mut self, path: &Path, old: &str, new: &str) -> Result<(), String> {
        valid_name(new)?;
        let mut next = self.clone();
        let index = next
            .profiles
            .iter()
            .position(|p| p.name == old)
            .ok_or("The profile to rename no longer exists")?;
        if next
            .profiles
            .iter()
            .enumerate()
            .any(|(i, profile)| i != index && profile.name.to_lowercase() == new.to_lowercase())
        {
            return Err("A profile with this name already exists".into());
        }
        if old == new {
            return Ok(());
        }
        next.profiles[index].name = new.into();
        next.persist(path)?;
        *self = next;
        Ok(())
    }
    fn persist(&mut self, path: &Path) -> Result<(), String> {
        // This detects already-completed external edits. It is not a lock:
        // another process could still write between this check and the rename.
        if read_source(path)? != self.source_text {
            return Err("Workspace profiles changed on disk. Close and reopen the profiles dialog before saving.".into());
        }
        let text = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        if text.len() as u64 > MAX_BYTES {
            return Err("Workspace profiles exceed 256 KiB".into());
        }
        marvelous_cloth::document::atomic_write(path, text.as_bytes())?;
        self.source_text = Some(text);
        Ok(())
    }
}

#[derive(Default)]
pub(super) struct ProfileUi {
    pub open: bool,
    store: Option<Store>,
    name: String,
    selected: Option<String>,
    pending: Option<Pending>,
    error: Option<String>,
}
enum Pending {
    Replace(String, Snapshot),
    Remove(String),
}
fn named(_ui: &egui::Ui, _response: &egui::Response, _name: &str) {
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(_ui, _response, _name);
}
fn button(ui: &mut egui::Ui, name: &str, label: &str, enabled: bool) -> bool {
    let r = ui.add_enabled(enabled, egui::Button::new(label));
    named(ui, &r, name);
    r.clicked()
}
impl ProfileUi {
    pub fn begin(&mut self, path: &Path) {
        *self = Self {
            open: true,
            ..Default::default()
        };
        match Store::load(path) {
            Ok(store) => self.store = Some(store),
            Err(e) => self.error = Some(e),
        }
    }
    pub fn show(
        &mut self,
        ctx: &egui::Context,
        path: &Path,
        current: &Snapshot,
    ) -> Option<Snapshot> {
        if !self.open {
            return None;
        }
        if ctx.input(|i| i.viewport().close_requested()) {
            self.open = false;
            self.pending = None;
            return None;
        }
        let mut restore = None;
        let modal = egui::Modal::new(egui::Id::new("workspace-profiles")).show(ctx, |ui| {
            ui.set_width((ctx.content_rect().width()-64.).clamp(200.,500.));
            ui.heading("Workspace profiles");
            ui.small("Layout, viewport, tool rail and overlay visibility. Garment and simulation settings stay unchanged.");
            if let Some(error)=&self.error { ui.colored_label(egui::Color32::LIGHT_RED,error); }
            if self.store.is_none() {
                ui.label("The existing file is preserved. Fix it or move it aside, then retry.");
                if button(ui,"profiles.retry","Retry loading",true) { self.begin(path); }
            }
            if self.pending.is_some() {
                let label=match self.pending.as_ref().unwrap() {
                    Pending::Replace(name,_)=>format!("Replace saved profile ‘{name}’ with the current presentation?"),
                    Pending::Remove(name)=>format!("Remove saved profile ‘{name}’?"),
                };
                ui.label(label);
                ui.horizontal(|ui| {
                    if button(ui,"profiles.confirm","Confirm",true) {
                        let action=self.pending.take().unwrap();
                        let result=match (self.store.as_mut(),action) {
                            (Some(store),Pending::Replace(name,snapshot))=>store.save_profile(path,&name,snapshot,true),
                            (Some(store),Pending::Remove(name))=>store.remove(path,&name),
                            _=>Err("Reload profiles before changing them".into()),
                        };
                        match result { Ok(())=>{self.error=None;self.selected=None;}, Err(e)=>self.error=Some(e) }
                    }
                    if button(ui,"profiles.cancel_change","Cancel change",true) { self.pending=None; }
                });
            } else if let Some(store)=&mut self.store {
                let height=(ctx.content_rect().height()-330.).clamp(70.,240.);
                egui::ScrollArea::vertical().auto_shrink([false,false]).max_height(height).min_scrolled_height(height).show(ui,|ui| {
                    for (index,profile) in store.profiles.iter().enumerate() {
                        let r=ui.selectable_label(self.selected.as_ref()==Some(&profile.name),&profile.name);
                        named(ui,&r,&format!("profiles.row.{index}"));
                        if r.clicked() { self.selected=Some(profile.name.clone()); }
                    }
                    if store.profiles.is_empty() {ui.label("No saved profiles yet");}
                });
                let r=ui.add(egui::TextEdit::singleline(&mut self.name).char_limit(48).hint_text("Name for new or renamed profile"));
                named(ui,&r,"profiles.name");
                if button(ui,"profiles.save","Save current as new",valid_name(&self.name).is_ok() && store.profiles.len()<MAX_PROFILES) {
                    match store.save_profile(path,&self.name,current.clone(),false) {
                        Ok(())=>{self.selected=Some(self.name.clone());self.error=None;}, Err(e)=>self.error=Some(e),
                    }
                }
                let rename_target=self.selected.as_ref().filter(|name|store.profiles.iter().any(|p|&p.name==*name)).cloned();
                if button(ui,"profiles.rename","Rename selected",rename_target.is_some() && valid_name(&self.name).is_ok()) {
                    match store.rename(path,rename_target.as_deref().unwrap(),&self.name) {
                        Ok(())=>{self.selected=Some(self.name.clone());self.error=None;}, Err(e)=>self.error=Some(e),
                    }
                }
                let duplicate= self.selected.as_ref().and_then(|name|store.profiles.iter().find(|p|&p.name==name)).cloned();
                if button(ui,"profiles.duplicate","Duplicate selected",duplicate.is_some() && valid_name(&self.name).is_ok() && store.profiles.len()<MAX_PROFILES) {
                    match store.save_profile(path,&self.name,duplicate.unwrap().snapshot,false) {
                        Ok(())=>{self.selected=Some(self.name.clone());self.error=None;}, Err(e)=>self.error=Some(e),
                    }
                }
                ui.horizontal(|ui| {
                    let selected=self.selected.as_ref().and_then(|name|store.profiles.iter().find(|p|&p.name==name)).cloned();
                    if button(ui,"profiles.restore","Restore",selected.is_some()) { restore=selected.as_ref().map(|p|p.snapshot.clone()); }
                    if button(ui,"profiles.replace","Replace…",selected.is_some()) { self.pending=selected.as_ref().map(|p|Pending::Replace(p.name.clone(),current.clone())); }
                    if button(ui,"profiles.remove","Remove…",selected.is_some()) { self.pending=selected.map(|p|Pending::Remove(p.name)); }
                });
            }
            if button(ui,"profiles.close","Close",true) {self.open=false; self.pending=None;}
        });
        // Backdrop dismissal cancels the whole dialog, including an unconfirmed
        // replacement/removal. Keep Escape's existing one-level-back behavior.
        if modal.backdrop_response.clicked() {
            self.open = false;
            self.pending = None;
            return None;
        }
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Escape)) {
            if self.pending.is_some() {
                self.pending = None;
            } else {
                self.open = false;
            }
            restore = None;
        }
        if restore.is_some() {
            self.open = false;
        }
        restore
    }
}

#[cfg(test)]
mod tests {
    use super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    struct Case {
        ui: ProfileUi,
        path: std::path::PathBuf,
        prefs: Preferences,
        tools: bool,
        wire: bool,
        seams: bool,
    }
    fn draw(ui: &mut egui::Ui, c: &mut Case) {
        let current = Snapshot::capture(&c.prefs, c.tools, c.wire, c.seams);
        if let Some(snapshot) = c.ui.show(ui.ctx(), &c.path, &current) {
            snapshot.apply(&mut c.prefs, &mut c.tools, &mut c.wire, &mut c.seams);
        }
    }
    fn frames(h: &mut Harness, c: &mut Case) {
        for _ in 0..5 {
            h.frame(c, &mut draw);
        }
    }
    #[test]
    fn named_save_and_restore_recalls_live_overlays() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut c = Case {
            ui: ProfileUi::default(),
            path: path.clone(),
            prefs: Preferences::default(),
            tools: true,
            wire: true,
            seams: false,
        };
        let original_prefs = c.prefs.clone();
        c.ui.begin(&path);
        let mut h = Harness::new(egui::vec2(1100., 700.));
        frames(&mut h, &mut c);
        h.replace_text("profiles.name", "Clean", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.save", &mut c, &mut draw).unwrap();
        c.wire = false;
        c.seams = true;
        c.ui.begin(&path);
        frames(&mut h, &mut c);
        h.click("profiles.row.0", &mut c, &mut draw).unwrap();
        h.click("profiles.restore", &mut c, &mut draw).unwrap();
        assert!(c.wire);
        assert!(!c.seams);
        assert_eq!(c.prefs, original_prefs);
        let reloaded = Store::load(&path).unwrap();
        assert_eq!(reloaded.profiles[0].snapshot.wireframe, Some(true));
        assert_eq!(reloaded.profiles[0].snapshot.seam_links, Some(false));
    }
    #[test]
    fn duplicate_selected_uses_saved_snapshot_and_survives_reload() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let saved = Snapshot {
            tools_visible: false,
            ..Snapshot::default()
        };
        Store::default()
            .save_profile(&path, "Original", saved.clone(), false)
            .unwrap();
        let mut c = Case {
            ui: ProfileUi::default(),
            path: path.clone(),
            prefs: Preferences::default(),
            tools: true,
            wire: false,
            seams: true,
        };
        c.ui.begin(&path);
        // Exercise the application's configured minimum desktop viewport.
        let mut h = Harness::new(egui::vec2(1100., 700.));
        frames(&mut h, &mut c);
        h.click("profiles.row.0", &mut c, &mut draw).unwrap();
        h.replace_text("profiles.name", "Copy", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.duplicate", &mut c, &mut draw).unwrap();
        let store = Store::load(&path).unwrap();
        assert_eq!(store.profiles.len(), 2);
        assert_eq!(store.profiles[1].name, "Copy");
        assert_eq!(store.profiles[1].snapshot, saved);
        assert!(c.tools);
        assert_eq!(c.ui.selected.as_deref(), Some("Copy"));
        let bytes = std::fs::read(&path).unwrap();
        h.replace_text("profiles.name", "original", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.duplicate", &mut c, &mut draw).unwrap();
        assert!(c.ui.error.is_some());
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
        assert_eq!(Store::load(&path).unwrap(), store);
    }
    #[test]
    fn rename_preserves_snapshot_and_rolls_back_invalid_or_failed_writes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut store = Store::default();
        let snapshot = Snapshot {
            tools_visible: false,
            ..Snapshot::default()
        };
        store
            .save_profile(&path, "Drafting", snapshot.clone(), false)
            .unwrap();
        store
            .save_profile(&path, "Review", Snapshot::default(), false)
            .unwrap();
        let saved = std::fs::read(&path).unwrap();
        let initial = store.clone();
        for (old, new) in [
            ("Drafting", " review "),
            ("Drafting", "REVIEW"),
            ("missing", "Valid"),
            ("Drafting", ""),
        ] {
            assert!(store.rename(&path, old, new).is_err());
            assert_eq!(store, initial);
            assert_eq!(std::fs::read(&path).unwrap(), saved);
        }
        // A directory cannot be atomically replaced as a profile file.
        assert!(store.rename(dir.path(), "Drafting", "New name").is_err());
        assert_eq!(store, initial);
        assert_eq!(std::fs::read(&path).unwrap(), saved);
        store.rename(&path, "Drafting", "DRAFTING").unwrap();
        store.rename(&path, "DRAFTING", "Sewing").unwrap();
        assert_eq!(store.profiles[0].snapshot, snapshot);
        assert_eq!(Store::load(&path).unwrap(), store);
        assert_eq!(store.profiles[1], initial.profiles[1]);
    }

    #[test]
    fn named_rename_reloads_and_keeps_current_presentation_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let saved = Snapshot {
            tools_visible: false,
            ..Snapshot::default()
        };
        Store::default()
            .save_profile(&path, "Drafting", saved.clone(), false)
            .unwrap();
        let mut c = Case {
            ui: ProfileUi::default(),
            path: path.clone(),
            prefs: Preferences::default(),
            tools: true,
            wire: false,
            seams: true,
        };
        c.prefs.workspace.split = 0.7;
        let before = Snapshot::capture(&c.prefs, c.tools, c.wire, c.seams);
        c.ui.begin(&path);
        let mut h = Harness::new(egui::vec2(1000., 1000.));
        frames(&mut h, &mut c);
        h.click("profiles.row.0", &mut c, &mut draw).unwrap();
        h.replace_text("profiles.name", "Sewing", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.rename", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert_eq!(c.ui.selected.as_deref(), Some("Sewing"));
        assert_eq!(
            Snapshot::capture(&c.prefs, c.tools, c.wire, c.seams),
            before
        );
        let reloaded = Store::load(&path).unwrap();
        assert_eq!(reloaded.profiles[0].name, "Sewing");
        assert_eq!(reloaded.profiles[0].snapshot, saved);
    }
    #[test]
    fn backdrop_dismisses_pending_changes_without_disk_write_or_click_through() {
        for replace in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join(FILE_NAME);
            let saved = Snapshot::default();
            Store::default()
                .save_profile(&path, "Saved", saved.clone(), false)
                .unwrap();
            let bytes = std::fs::read(&path).unwrap();
            let mut dialog = ProfileUi::default();
            dialog.begin(&path);
            dialog.pending = Some(if replace {
                Pending::Replace(
                    "Saved".into(),
                    Snapshot {
                        tools_visible: false,
                        ..saved.clone()
                    },
                )
            } else {
                Pending::Remove("Saved".into())
            });
            let ctx = egui::Context::default();
            let mut clicks = 0;
            let mut restores = 0;
            let mut frame = |events| {
                let mut output = ctx.run_ui(
                    egui::RawInput {
                        screen_rect: Some(egui::Rect::from_min_size(
                            egui::Pos2::ZERO,
                            egui::vec2(900., 900.),
                        )),
                        focused: true,
                        events,
                        ..Default::default()
                    },
                    |ui| {
                        egui::CentralPanel::default().show(ui, |ui| {
                            if ui
                                .put(
                                    egui::Rect::from_min_size(
                                        egui::pos2(10., 10.),
                                        egui::vec2(80., 30.),
                                    ),
                                    egui::Button::new("Behind"),
                                )
                                .clicked()
                            {
                                clicks += 1;
                            }
                            if dialog.show(&ctx, &path, &saved).is_some() {
                                restores += 1;
                            }
                        });
                    },
                );
                output.textures_delta.clear();
            };
            for _ in 0..3 {
                frame(vec![]);
            }
            let pos = egui::pos2(30., 25.);
            for pressed in [true, false] {
                frame(vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::PointerButton {
                        pos,
                        button: egui::PointerButton::Primary,
                        pressed,
                        modifiers: egui::Modifiers::NONE,
                    },
                ]);
            }
            frame(vec![]);
            assert!(!dialog.open);
            assert!(dialog.pending.is_none());
            assert_eq!((clicks, restores), (0, 0));
            assert_eq!(std::fs::read(&path).unwrap(), bytes);
            assert_eq!(dialog.store.as_ref().unwrap().profiles[0].snapshot, saved);
        }
    }

    #[test]
    fn named_save_replace_cancel_restore_and_remove() {
        let dir = tempfile::tempdir().unwrap();
        let mut c = Case {
            ui: ProfileUi::default(),
            path: dir.path().join(FILE_NAME),
            prefs: Preferences::default(),
            tools: false,
            wire: false,
            seams: true,
        };
        c.ui.begin(&c.path);
        c.prefs.workspace.split = 0.7;
        let mut h = Harness::new(egui::vec2(1000., 1000.));
        frames(&mut h, &mut c);
        h.replace_text("profiles.name", "Drafting", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.save", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        let saved = std::fs::read(&c.path).unwrap();
        c.prefs.workspace.split = 0.3;
        h.click("profiles.replace", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("profiles.cancel_change", &mut c, &mut draw)
            .unwrap();
        frames(&mut h, &mut c);
        assert_eq!(std::fs::read(&c.path).unwrap(), saved);
        h.click("profiles.restore", &mut c, &mut draw).unwrap();
        assert_eq!(c.prefs.workspace.split, 0.7);
        assert!(!c.tools);
        assert!(!c.ui.open);
        c.ui.begin(&c.path);
        frames(&mut h, &mut c);
        h.click("profiles.row.0", &mut c, &mut draw).unwrap();
        c.prefs.workspace.split = 0.4;
        h.click("profiles.replace", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("profiles.confirm", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        assert_eq!(
            Store::load(&c.path).unwrap().profiles[0]
                .snapshot
                .layout
                .split,
            0.4
        );
        h.click("profiles.row.0", &mut c, &mut draw).unwrap();
        h.click("profiles.remove", &mut c, &mut draw).unwrap();
        frames(&mut h, &mut c);
        h.click("profiles.confirm", &mut c, &mut draw).unwrap();
        assert!(Store::load(&c.path).unwrap().profiles.is_empty());
    }
    #[test]
    fn malformed_profile_dialog_cannot_overwrite_source() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        std::fs::write(&path, "broken").unwrap();
        let mut c = Case {
            ui: ProfileUi::default(),
            path,
            prefs: Preferences::default(),
            tools: true,
            wire: false,
            seams: true,
        };
        c.ui.begin(&c.path);
        let mut h = Harness::new(egui::vec2(1000., 1000.));
        frames(&mut h, &mut c);
        assert!(h.click("profiles.save", &mut c, &mut draw).is_err());
        h.click("profiles.close", &mut c, &mut draw).unwrap();
        assert!(!c.ui.open);
        assert_eq!(std::fs::read_to_string(&c.path).unwrap(), "broken");
    }
    #[test]
    fn roundtrip_replace_remove_and_presentation_only_restore() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut store = Store::load(&path).unwrap();
        let mut prefs = Preferences::default();
        prefs.workspace.split = 0.7;
        prefs.viewport.floor = false;
        let snapshot = Snapshot::capture(&prefs, false, true, false);
        store
            .save_profile(&path, "Drafting", snapshot.clone(), false)
            .unwrap();
        assert_eq!(Store::load(&path).unwrap(), store);
        let bytes = std::fs::read(&path).unwrap();
        assert!(
            store
                .save_profile(&path, "drafting", snapshot.clone(), false)
                .is_err()
        );
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
        prefs.dt = 0.02;
        prefs.iterations = 55;
        prefs.snap_mm = 17.;
        prefs.workspace.split = 0.3;
        let mut tools = true;
        let mut wire = false;
        let mut seams = true;
        snapshot.apply(&mut prefs, &mut tools, &mut wire, &mut seams);
        assert!(wire);
        assert!(!seams);
        assert_eq!(prefs.dt, 0.02);
        assert_eq!(prefs.iterations, 55);
        assert_eq!(prefs.snap_mm, 17.);
        assert_eq!(prefs.workspace.split, 0.7);
        assert!(!tools);
        store
            .save_profile(&path, "Drafting", Snapshot::default(), true)
            .unwrap();
        store.remove(&path, "Drafting").unwrap();
        assert!(Store::load(&path).unwrap().profiles.is_empty());
    }
    #[test]
    fn overlay_profiles_upgrade_the_format_and_do_not_downgrade() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        std::fs::write(
            &path,
            r#"{"version":1,"profiles":[{"name":"Legacy","snapshot":{}}]}"#,
        )
        .unwrap();
        let mut store = Store::load(&path).unwrap();
        assert_eq!(store.version, 1);
        let overlay = Snapshot {
            wireframe: Some(true),
            seam_links: Some(false),
            ..Default::default()
        };
        store
            .save_profile(&path, "Overlay", overlay, false)
            .unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(json["version"], 2);
        assert_eq!(json["profiles"][1]["snapshot"]["wireframe"], true);
        let mut reopened = Store::load(&path).unwrap();
        reopened.rename(&path, "Legacy", "Renamed").unwrap();
        reopened
            .save_profile(&path, "Overlay", Snapshot::default(), true)
            .unwrap();
        assert_eq!(Store::load(&path).unwrap().version, 2);
        reopened.remove(&path, "Overlay").unwrap();
        assert_eq!(Store::load(&path).unwrap().version, 2);
    }

    #[test]
    fn preview_v1_overlay_files_upgrade_on_the_next_write() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        std::fs::write(
            &path,
            r#"{"version":1,"profiles":[{"name":"Preview","snapshot":{"wireframe":true}}]}"#,
        )
        .unwrap();
        let mut store = Store::load(&path).unwrap();
        assert_eq!(store.version, 2);
        store.remove(&path, "Preview").unwrap();
        let json: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(json["version"], 2);
    }

    #[test]
    fn legacy_profiles_preserve_current_overlays_and_startup_preferences() {
        let snapshot: Snapshot = serde_json::from_str("{}").unwrap();
        let mut prefs = Preferences {
            wireframe: false,
            seam_links: true,
            ..Preferences::default()
        };
        let mut tools = false;
        let mut wire = true;
        let mut seams = false;
        snapshot.apply(&mut prefs, &mut tools, &mut wire, &mut seams);
        assert!(wire);
        assert!(!seams);
        assert!(!prefs.wireframe);
        assert!(prefs.seam_links);
    }
    #[test]
    fn schema_defaults_bounds_and_resource_limits() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        assert_eq!(Store::load(&path).unwrap(), Store::default());
        std::fs::write(
            &path,
            r#"{"version":1,"profiles":[{"name":"Minimal","snapshot":{}}]}"#,
        )
        .unwrap();
        assert_eq!(
            Store::load(&path).unwrap().profiles[0].snapshot,
            Snapshot::default()
        );
        std::fs::write(&path, r#"{"version":1,"profiles":[{"name":"Bounds","snapshot":{"layout":{"split":99,"inspector_width":-20},"appearance":{"shadow_opacity":99}}}]}"#).unwrap();
        let bounded = Store::load(&path).unwrap();
        assert_eq!(bounded.profiles[0].snapshot.layout.split, 0.8);
        assert_eq!(bounded.profiles[0].snapshot.layout.inspector_width, 240.);
        assert_eq!(bounded.profiles[0].snapshot.appearance.shadow_opacity, 0.8);
        for text in [
            r#"{"version":3,"profiles":[]}"#,
            r#"{"version":1,"profiles":[{"name":"A","snapshot":{}},{"name":"a","snapshot":{}}]}"#,
        ] {
            std::fs::write(&path, text).unwrap();
            assert!(Store::load(&path).is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), text);
        }
        std::fs::write(&path, vec![b' '; MAX_BYTES as usize + 1]).unwrap();
        assert!(Store::load(&path).is_err());
        let path = dir.path().join("full-profiles.json");
        let mut full = Store {
            version: 1,
            source_text: None,
            profiles: (0..MAX_PROFILES)
                .map(|i| Profile {
                    name: format!("Profile {i}"),
                    snapshot: Snapshot::default(),
                })
                .collect(),
        };
        full.persist(&path).unwrap();
        let bytes = std::fs::read(&path).unwrap();
        assert!(
            full.save_profile(&path, "Overflow", Snapshot::default(), false)
                .is_err()
        );
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
        assert!(valid_name(&"x".repeat(49)).is_err());
        full.save_profile(&path, "Profile 0", Snapshot::default(), true)
            .unwrap();
        full.profiles.push(Profile {
            name: "Overflow".into(),
            snapshot: Snapshot::default(),
        });
        std::fs::write(&path, serde_json::to_vec(&full).unwrap()).unwrap();
        assert!(Store::load(&path).is_err());
    }

    #[test]
    fn invalid_storage_and_failed_write_preserve_records() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        std::fs::write(&path, "broken").unwrap();
        assert!(Store::load(&path).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "broken");
        let mut store = Store::default();
        let before = store.clone();
        assert!(
            store
                .save_profile(
                    &dir.path().join("missing").join(FILE_NAME),
                    "Valid",
                    Snapshot::default(),
                    false
                )
                .is_err()
        );
        assert_eq!(store, before);
        for name in ["", " padded", "line\nbreak"] {
            assert!(
                store
                    .save_profile(&path, name, Snapshot::default(), false)
                    .is_err()
            );
        }
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "broken");
    }
    #[test]
    fn stale_profile_writes_preserve_newer_disk_state() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut initial = Store::default();
        initial
            .save_profile(&path, "Original", Snapshot::default(), false)
            .unwrap();
        let stale = Store::load(&path).unwrap();
        let mut newer = Store::load(&path).unwrap();
        newer
            .save_profile(&path, "Other window", Snapshot::default(), false)
            .unwrap();
        let bytes = std::fs::read(&path).unwrap();
        for operation in 0..4 {
            let mut attempt = stale.clone();
            let result = match operation {
                0 => attempt.save_profile(&path, "New", Snapshot::default(), false),
                1 => attempt.save_profile(&path, "Original", Snapshot::default(), true),
                2 => attempt.remove(&path, "Original"),
                _ => attempt.rename(&path, "Original", "Renamed"),
            };
            assert!(result.unwrap_err().contains("changed on disk"));
            assert_eq!(attempt, stale);
            assert_eq!(std::fs::read(&path).unwrap(), bytes);
        }
        let mut reloaded = Store::load(&path).unwrap();
        reloaded
            .save_profile(&path, "New", Snapshot::default(), false)
            .unwrap();
        assert_eq!(Store::load(&path).unwrap().profiles.len(), 3);
    }

    #[test]
    fn stale_dialog_shows_error_and_reload_keeps_both_instances_profiles() {
        struct ConflictCase {
            ui: ProfileUi,
            path: std::path::PathBuf,
            restored: Option<Snapshot>,
        }
        let mut draw = |ui: &mut egui::Ui, c: &mut ConflictCase| {
            c.restored = c.ui.show(ui.ctx(), &c.path, &Snapshot::default());
        };
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut c = ConflictCase {
            ui: ProfileUi::default(),
            path: path.clone(),
            restored: None,
        };
        c.ui.begin(&path);
        let mut h = Harness::new(egui::vec2(1100., 700.));
        for _ in 0..5 {
            h.frame(&mut c, &mut draw);
        }
        Store::default()
            .save_profile(&path, "Other window", Snapshot::default(), false)
            .unwrap();
        let saved = std::fs::read(&path).unwrap();
        h.replace_text("profiles.name", "Mine", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.save", &mut c, &mut draw).unwrap();
        assert!(c.ui.error.as_deref().unwrap().contains("changed on disk"));
        assert_eq!(std::fs::read(&path).unwrap(), saved);
        assert!(c.restored.is_none());
        c.ui.begin(&path);
        for _ in 0..5 {
            h.frame(&mut c, &mut draw);
        }
        h.replace_text("profiles.name", "Mine", &mut c, &mut draw)
            .unwrap();
        h.click("profiles.save", &mut c, &mut draw).unwrap();
        assert_eq!(Store::load(&path).unwrap().profiles.len(), 2);
        assert!(c.restored.is_none());
    }

    #[test]
    fn changed_or_deleted_source_bytes_are_not_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut initial = Store::default();
        initial
            .save_profile(&path, "Original", Snapshot::default(), false)
            .unwrap();
        let stale = Store::load(&path).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        let changed = format!("{text}\n");
        std::fs::write(&path, &changed).unwrap();
        assert!(stale.clone().remove(&path, "Original").is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), changed);
        std::fs::remove_file(&path).unwrap();
        assert!(stale.clone().remove(&path, "Original").is_err());
        assert!(!path.exists());
    }
}
