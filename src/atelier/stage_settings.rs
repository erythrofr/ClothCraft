//! Explicit presentation snapshots, independent of document and solver state.
//! The directional rig is illustrative; there is no environment asset loader.
use crate::render::{Camera, appearance::Appearance};
use eframe::egui;
use serde::{Deserialize, Serialize};
use std::{io::Read, path::Path};

pub(super) const FILE_NAME: &str = "presentation.json";
const MAX_BYTES: u64 = 16 * 1024;
const LIGHTING: &str = "clothcraft-directional-v2";
const LEGACY_LIGHTING: &str = "clothcraft-fixed-v1";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Presentation {
    version: u32,
    lighting: String,
    yaw: f32,
    pitch: f32,
    distance: f32,
    target: [f32; 3],
    orthographic: bool,
    appearance: Appearance,
}

impl Presentation {
    fn capture(camera: &Camera, appearance: &Appearance) -> Result<Self, String> {
        let value = Self {
            version: 2,
            lighting: LIGHTING.into(),
            yaw: camera.yaw,
            pitch: camera.pitch,
            distance: camera.distance,
            target: camera.target.to_array(),
            orthographic: camera.orthographic,
            appearance: appearance.clone(),
        };
        value.validate()?;
        Ok(value)
    }

    fn validate(&self) -> Result<(), String> {
        let legacy = self.version == 1
            && self.lighting == LEGACY_LIGHTING
            && self.appearance.lighting == Default::default();
        if !legacy && !(self.version == 2 && self.lighting == LIGHTING) {
            return Err("Unsupported presentation version or lighting rig".into());
        }
        // Match the camera's working distance; reject instead of silently changing framing.
        if !self.appearance.lighting.valid()
            || !self.yaw.is_finite()
            || !self.pitch.is_finite()
            || self.pitch.abs() > std::f32::consts::FRAC_PI_2
            || !(0.15..=30.).contains(&self.distance)
            || self.target.iter().any(|v| !v.is_finite() || v.abs() > 1e6)
            || !self.appearance.shadow_opacity.is_finite()
            || !(0.0..=0.8).contains(&self.appearance.shadow_opacity)
        {
            return Err("Presentation contains invalid camera, lighting or shadow values".into());
        }
        Ok(())
    }

    fn load(path: &Path) -> Result<Self, String> {
        let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
        let mut text = String::new();
        file.take(MAX_BYTES + 1)
            .read_to_string(&mut text)
            .map_err(|e| e.to_string())?;
        if text.len() as u64 > MAX_BYTES {
            return Err("Presentation exceeds 16 KiB".into());
        }
        let value: Self =
            serde_json::from_str(&text).map_err(|e| format!("Invalid presentation: {e}"))?;
        value.validate()?;
        Ok(value)
    }

    fn apply(self, camera: &mut Camera, appearance: &mut Appearance) {
        camera.save_pose();
        camera.yaw = self.yaw;
        camera.pitch = self.pitch;
        camera.distance = self.distance;
        camera.target = self.target.into();
        camera.orthographic = self.orthographic;
        // A queued Frame selection must not overwrite the restored pose next frame.
        camera.pending_frame = None;
        *appearance = self.appearance;
    }
}

#[derive(Clone, Copy)]
pub(super) enum Action {
    Save,
    Restore,
}

pub(super) fn execute(
    action: Action,
    path: &Path,
    camera: &mut Camera,
    appearance: &mut Appearance,
) -> Result<String, String> {
    match action {
        Action::Save => {
            let value = Presentation::capture(camera, appearance)?;
            let bytes = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
            marvelous_cloth::document::atomic_write(path, &bytes)?;
            Ok(format!("Presentation saved to {}", path.display()))
        }
        Action::Restore => {
            Presentation::load(path)?.apply(camera, appearance);
            Ok("Presentation restored · camera, lighting, background and floor".into())
        }
    }
}

pub(super) fn controls(
    ui: &mut egui::Ui,
    enabled: bool,
    appearance: &mut Appearance,
) -> Option<Action> {
    ui.small("World-space lighting · presentation only");
    ui.add_enabled_ui(enabled, |ui| {
        let light = &mut appearance.lighting;
        for (id, label, value, range) in [
            (
                "presentation.light.yaw",
                "Rotation",
                &mut light.yaw_degrees,
                -180. ..=180.,
            ),
            (
                "presentation.light.tilt",
                "Tilt",
                &mut light.tilt_degrees,
                -90. ..=90.,
            ),
            (
                "presentation.light.ambient",
                "Ambient",
                &mut light.ambient,
                0. ..=2.,
            ),
            (
                "presentation.light.key",
                "Key light",
                &mut light.key,
                0. ..=2.,
            ),
        ] {
            let response = ui.add(egui::Slider::new(value, range).text(label));
            #[cfg(test)]
            super::authoring_smoke::widget_harness::named(ui, &response, id);
            #[cfg(not(test))]
            let _ = (response, id);
        }
        let reset = ui.button("Reset lighting");
        #[cfg(test)]
        super::authoring_smoke::widget_harness::named(ui, &reset, "presentation.light.reset");
        if reset.clicked() {
            *light = Default::default();
        }
    });
    let mut action = None;
    for (id, label, value) in [
        ("presentation.save", "Save presentation", Action::Save),
        (
            "presentation.restore",
            "Restore presentation",
            Action::Restore,
        ),
    ] {
        let r = ui.add_enabled(enabled, egui::Button::new(label));
        #[cfg(test)]
        super::authoring_smoke::widget_harness::named(ui, &r, id);
        #[cfg(not(test))]
        let _ = id;
        if r.clicked() {
            action = Some(value);
        }
    }
    ui.small("Save replaces presentation.json in this session folder. Restore leaves the garment and simulation unchanged.");
    action
}

#[cfg(test)]
mod tests {
    use super::super::authoring_smoke::widget_harness::Harness;
    use super::*;

    #[test]
    fn legacy_snapshot_defaults_and_invalid_light_rejection() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut camera = Camera::default();
        let mut appearance = Appearance::default();
        let mut legacy =
            serde_json::to_value(Presentation::capture(&camera, &appearance).unwrap()).unwrap();
        legacy["version"] = serde_json::json!(1);
        legacy["lighting"] = serde_json::json!(LEGACY_LIGHTING);
        legacy["appearance"]
            .as_object_mut()
            .unwrap()
            .remove("lighting");
        std::fs::write(&path, serde_json::to_vec(&legacy).unwrap()).unwrap();
        appearance.lighting.key = 0.;
        execute(Action::Restore, &path, &mut camera, &mut appearance).unwrap();
        assert_eq!(appearance.lighting, Default::default());
        appearance.lighting.yaw_degrees = 90.;
        appearance.lighting.key = 0.4;
        execute(Action::Save, &path, &mut camera, &mut appearance).unwrap();
        let valid: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(valid["version"], 2);
        appearance.lighting = Default::default();
        execute(Action::Restore, &path, &mut camera, &mut appearance).unwrap();
        assert_eq!(appearance.lighting.yaw_degrees, 90.);
        assert_eq!(appearance.lighting.key, 0.4);
        for (field, bad) in [
            ("key", 2.1),
            ("ambient", -0.1),
            ("yaw_degrees", 181.),
            ("tilt_degrees", 91.),
        ] {
            let before = appearance.clone();
            let mut invalid = valid.clone();
            invalid["appearance"]["lighting"][field] = serde_json::json!(bad);
            std::fs::write(&path, serde_json::to_vec(&invalid).unwrap()).unwrap();
            assert!(execute(Action::Restore, &path, &mut camera, &mut appearance).is_err());
            assert_eq!(appearance, before);
        }
        // A v1 identity cannot smuggle in a configurable rig.
        legacy["appearance"]["lighting"] = valid["appearance"]["lighting"].clone();
        std::fs::write(&path, serde_json::to_vec(&legacy).unwrap()).unwrap();
        assert!(execute(Action::Restore, &path, &mut camera, &mut appearance).is_err());
    }

    #[test]
    fn roundtrip_restores_camera_and_appearance_without_pending_framing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut camera = Camera::new(0.8, -0.3, 4., glam::Vec3::new(0.2, 1.5, -0.4));
        camera.orthographic = true;
        let mut appearance = Appearance {
            floor: false,
            top: [1, 2, 3],
            ..Default::default()
        };
        execute(Action::Save, &path, &mut camera, &mut appearance).unwrap();
        camera.distance = 2.;
        camera.pending_frame = Some((glam::Vec3::ZERO, 1.));
        appearance.floor = true;
        execute(Action::Restore, &path, &mut camera, &mut appearance).unwrap();
        assert_eq!(camera.distance, 4.);
        assert_eq!(camera.target, glam::Vec3::new(0.2, 1.5, -0.4));
        assert!(camera.orthographic);
        assert!(camera.pending_frame.is_none());
        assert!(!appearance.floor);
        assert_eq!(appearance.top, [1, 2, 3]);
        camera.restore_pose();
        assert_eq!(camera.distance, 2.);
    }

    #[test]
    fn failed_restore_and_save_preserve_live_state_and_existing_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE_NAME);
        let mut camera = Camera::default();
        let mut appearance = Appearance::default();
        let valid =
            serde_json::to_value(Presentation::capture(&camera, &appearance).unwrap()).unwrap();
        for (key, bad) in [
            ("version", serde_json::json!(3)),
            ("lighting", serde_json::json!("external.hdr")),
            ("distance", serde_json::json!(-1)),
            ("pitch", serde_json::json!(3.)),
            ("asset", serde_json::json!("file.obj")),
        ] {
            let mut value = valid.clone();
            value[key] = bad;
            std::fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
            let before = Presentation::capture(&camera, &appearance).unwrap();
            assert!(execute(Action::Restore, &path, &mut camera, &mut appearance).is_err());
            assert_eq!(
                serde_json::to_value(Presentation::capture(&camera, &appearance).unwrap()).unwrap(),
                serde_json::to_value(before).unwrap()
            );
        }
        std::fs::write(&path, "keep").unwrap();
        camera.yaw = f32::NAN;
        assert!(execute(Action::Save, &path, &mut camera, &mut appearance).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "keep");
        camera.yaw = 0.;
        assert!(execute(Action::Save, dir.path(), &mut camera, &mut appearance).is_err());
        std::fs::write(&path, vec![b' '; MAX_BYTES as usize + 1]).unwrap();
        assert!(
            execute(Action::Restore, &path, &mut camera, &mut appearance)
                .unwrap_err()
                .contains("16 KiB")
        );
    }

    #[test]
    fn named_controls_save_restore_and_reject_disabled_actions() {
        struct Case {
            camera: Camera,
            appearance: Appearance,
            path: std::path::PathBuf,
            enabled: bool,
            error: Option<String>,
        }
        fn draw(ui: &mut egui::Ui, c: &mut Case) {
            if let Some(action) = controls(ui, c.enabled, &mut c.appearance) {
                c.error = execute(action, &c.path, &mut c.camera, &mut c.appearance).err();
            }
        }
        let dir = tempfile::tempdir().unwrap();
        let mut c = Case {
            camera: Camera::default(),
            appearance: Appearance::default(),
            path: dir.path().join(FILE_NAME),
            enabled: true,
            error: None,
        };
        let mut h = Harness::new(egui::vec2(800., 400.));
        h.frame(&mut c, &mut draw);
        for id in [
            "presentation.light.yaw",
            "presentation.light.tilt",
            "presentation.light.ambient",
            "presentation.light.key",
        ] {
            let before = c.appearance.lighting;
            h.drag(id, egui::vec2(35., 0.), 5, &mut c, &mut draw)
                .unwrap();
            assert_ne!(
                c.appearance.lighting, before,
                "{id} must edit its live value"
            );
            assert!(c.appearance.lighting.valid());
        }
        c.appearance.lighting.key = 0.2;
        h.click("presentation.light.reset", &mut c, &mut draw)
            .unwrap();
        assert_eq!(c.appearance.lighting, Default::default());
        h.click("presentation.restore", &mut c, &mut draw).unwrap();
        assert!(c.error.is_some());
        h.click("presentation.save", &mut c, &mut draw).unwrap();
        assert!(c.error.is_none());
        c.camera.distance = 8.;
        h.click("presentation.restore", &mut c, &mut draw).unwrap();
        assert_eq!(c.camera.distance, Camera::default().distance);
        c.enabled = false;
        h.frame(&mut c, &mut draw);
        assert!(h.click("presentation.save", &mut c, &mut draw).is_err());
        assert!(
            h.click("presentation.light.reset", &mut c, &mut draw)
                .is_err()
        );
    }
}
