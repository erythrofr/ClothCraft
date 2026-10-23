//! CPU-only egui input driver. Compiled for tests, never for the shipped editor.
use eframe::egui::{self, Context, Event, Key, Modifiers, Pos2, Rect, Response, Ui, Vec2};
use std::collections::BTreeMap;

#[derive(Clone, Debug)]
struct Target {
    rect: Rect,
    enabled: bool,
    visible: bool,
    focused: bool,
    id: egui::Id,
}

#[derive(Clone, Default)]
struct Registry(BTreeMap<String, Vec<Target>>);

fn registry_id() -> egui::Id {
    egui::Id::new("clothcraft-test-widget-registry")
}

/// Annotate the actual response, including disabled/hidden controls. Keeping
/// rejected targets gives more useful diagnostics than silently omitting them.
pub(crate) fn named(ui: &Ui, response: &Response, name: impl Into<String>) {
    // Query Context-dependent response state before taking the data-map lock.
    let target = Target {
        rect: response.interact_rect,
        enabled: response.enabled(),
        visible: ui.clip_rect().contains_rect(response.rect)
            && ui.is_rect_visible(response.rect)
            && response.rect.is_positive(),
        focused: response.has_focus(),
        id: response.id,
    };
    ui.ctx().data_mut(|data| {
        if data.get_temp::<Registry>(registry_id()).is_some() {
            let registry = data.get_temp_mut_or_default::<Registry>(registry_id());
            registry.0.entry(name.into()).or_default().push(target);
        }
    });
}

pub(crate) struct Harness {
    pub ctx: Context,
    size: Vec2,
    frame: u64,
    registry: Registry,
    pub trace: Vec<String>,
}

impl Harness {
    pub fn new(size: Vec2) -> Self {
        assert!(size.is_finite() && size.x > 0. && size.y > 0.);
        let ctx = Context::default();
        for theme in [egui::Theme::Light, egui::Theme::Dark] {
            ctx.style_mut_of(theme, |style| style.animation_time = 0.);
        }
        Self {
            ctx,
            size,
            frame: 0,
            registry: Registry::default(),
            trace: vec![],
        }
    }

    pub fn resize(&mut self, size: Vec2) {
        assert!(size.is_finite() && size.x > 0. && size.y > 0.);
        self.size = size;
        // No input may use rectangles measured before a viewport change.
        self.registry = Registry::default();
    }

    pub fn frame<S>(&mut self, state: &mut S, draw: &mut impl FnMut(&mut Ui, &mut S)) {
        self.input(vec![], state, draw);
    }

    fn input<S>(
        &mut self,
        events: Vec<Event>,
        state: &mut S,
        draw: &mut impl FnMut(&mut Ui, &mut S),
    ) {
        self.frame += 1;
        let mut output = self.ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, self.size)),
                time: Some(self.frame as f64 / 60.),
                predicted_dt: 1. / 60.,
                focused: true,
                events,
                ..Default::default()
            },
            |ui| {
                // run_ui may perform multiple layout passes. Only the final pass's
                // responses are current; neither old targets nor duplicate passes survive.
                ui.ctx()
                    .data_mut(|d| d.insert_temp(registry_id(), Registry::default()));
                egui::CentralPanel::default().show(ui, |ui| draw(ui, state));
            },
        );
        output.textures_delta.clear(); // No renderer/GPU in these tests.
        self.registry = self
            .ctx
            .data(|d| d.get_temp(registry_id()))
            .unwrap_or_default();
    }

    fn failure(&self, name: &str, reason: &str) -> String {
        format!(
            "frame {}: target {name:?}: {reason}; available: {:?}; trace: {:?}",
            self.frame,
            self.registry.0.keys().collect::<Vec<_>>(),
            self.trace
        )
    }

    fn target(&self, name: &str) -> Result<Target, String> {
        let targets = self
            .registry
            .0
            .get(name)
            .ok_or_else(|| self.failure(name, "missing or stale"))?;
        if targets.len() != 1 {
            return Err(self.failure(name, "duplicate name"));
        }
        let target = &targets[0];
        if !target.enabled {
            return Err(self.failure(name, "disabled"));
        }
        if !target.visible || !target.rect.min.is_finite() || !target.rect.max.is_finite() {
            return Err(self.failure(name, "clipped or invisible"));
        }
        Ok(target.clone())
    }

    fn pointer(pos: Pos2, pressed: bool) -> Event {
        Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: Modifiers::NONE,
        }
    }

    fn cancel_pointer<S>(&mut self, state: &mut S, draw: &mut impl FnMut(&mut Ui, &mut S)) {
        let outside = Pos2::new(-1000., -1000.);
        self.input(
            vec![
                Event::PointerMoved(outside),
                Self::pointer(outside, false),
                Event::PointerGone,
            ],
            state,
            draw,
        );
    }

    pub fn click<S>(
        &mut self,
        name: &str,
        state: &mut S,
        draw: &mut impl FnMut(&mut Ui, &mut S),
    ) -> Result<(), String> {
        let target = self.target(name)?;
        self.trace.push(format!("click {name}"));
        let pos = target.rect.center();
        self.input(
            vec![Event::PointerMoved(pos), Self::pointer(pos, true)],
            state,
            draw,
        );
        let current = self.target(name);
        if !current
            .as_ref()
            .is_ok_and(|t| t.id == target.id && t.rect.contains(pos))
        {
            let error = self.failure(name, "target changed during press; gesture cancelled");
            self.cancel_pointer(state, draw);
            return Err(error);
        }
        self.input(vec![Self::pointer(pos, false)], state, draw);
        Ok(())
    }

    /// Drag relative to a named widget. Steps and distance are bounded, and
    /// invalid paths are rejected before any button is pressed.
    pub fn drag<S>(
        &mut self,
        name: &str,
        delta: Vec2,
        steps: usize,
        state: &mut S,
        draw: &mut impl FnMut(&mut Ui, &mut S),
    ) -> Result<(), String> {
        let target = self.target(name)?;
        if !(1..=120).contains(&steps) || !delta.is_finite() || delta.length() > 10000. {
            return Err(self.failure(name, "invalid drag path"));
        }
        self.trace
            .push(format!("drag {name} by {delta:?} in {steps} steps"));
        let start = target.rect.center();
        self.input(
            vec![Event::PointerMoved(start), Self::pointer(start, true)],
            state,
            draw,
        );
        for i in 1..=steps {
            if !self.target(name).as_ref().is_ok_and(|t| t.id == target.id) {
                let error = self.failure(name, "target changed during drag; gesture cancelled");
                self.cancel_pointer(state, draw);
                return Err(error);
            }
            self.input(
                vec![Event::PointerMoved(
                    start + delta * (i as f32 / steps as f32),
                )],
                state,
                draw,
            );
        }
        if !self.target(name).as_ref().is_ok_and(|t| t.id == target.id) {
            let error = self.failure(
                name,
                "target changed before drag release; gesture cancelled",
            );
            self.cancel_pointer(state, draw);
            return Err(error);
        }
        self.input(vec![Self::pointer(start + delta, false)], state, draw);
        Ok(())
    }

    pub fn key<S>(
        &mut self,
        name: &str,
        key: Key,
        modifiers: Modifiers,
        state: &mut S,
        draw: &mut impl FnMut(&mut Ui, &mut S),
    ) -> Result<(), String> {
        if !self.target(name)?.focused {
            return Err(self.failure(name, "keyboard target is not focused"));
        }
        self.trace.push(format!("key {key:?} on {name}"));
        self.input(
            [true, false]
                .map(|pressed| Event::Key {
                    key,
                    physical_key: None,
                    pressed,
                    repeat: false,
                    modifiers,
                })
                .to_vec(),
            state,
            draw,
        );
        Ok(())
    }

    pub fn replace_text<S>(
        &mut self,
        name: &str,
        text: &str,
        state: &mut S,
        draw: &mut impl FnMut(&mut Ui, &mut S),
    ) -> Result<(), String> {
        self.click(name, state, draw)?;
        self.key(
            name,
            Key::A,
            Modifiers {
                ctrl: true,
                command: true,
                ..Modifiers::NONE
            },
            state,
            draw,
        )?;
        if !self.target(name)?.focused {
            return Err(self.failure(name, "text target lost focus"));
        }
        self.trace.push(format!("text {name}: {text:?}"));
        self.input(vec![Event::Text(text.to_owned())], state, draw);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn named_widgets_reject_bad_targets_and_forget_previous_frame() {
        let mut h = Harness::new(Vec2::new(400., 300.));
        let mut count = 0;
        let mut draw = |ui: &mut Ui, count: &mut usize| {
            let r = ui.button("Live");
            named(ui, &r, "live");
            if r.clicked() {
                *count += 1;
            }
            let r = ui.add_enabled(false, egui::Button::new("Disabled"));
            named(ui, &r, "disabled");
            for _ in 0..2 {
                let r = ui.button("Duplicate");
                named(ui, &r, "duplicate");
            }
            ui.add_space(500.);
            let r = ui.button("Clipped");
            named(ui, &r, "clipped");
        };
        h.frame(&mut count, &mut draw);
        for (name, reason) in [
            ("missing", "missing"),
            ("disabled", "disabled"),
            ("duplicate", "duplicate"),
            ("clipped", "clipped"),
        ] {
            let e = h.click(name, &mut count, &mut draw).unwrap_err();
            assert!(e.contains(reason) && e.contains("available:"), "{e}");
        }
        assert_eq!(count, 0);
        h.click("live", &mut count, &mut draw).unwrap();
        assert_eq!(count, 1);
        h.resize(Vec2::new(300., 300.));
        assert!(
            h.click("live", &mut count, &mut draw)
                .unwrap_err()
                .contains("stale")
        );
        h.frame(&mut count, &mut |_, _| {});
        assert!(h.target("live").is_err());
    }

    #[test]
    fn named_widgets_drag_and_text_use_real_events() {
        let mut h = Harness::new(Vec2::new(400., 300.));
        let mut state = (0_f32, String::from("old"));
        let mut draw = |ui: &mut Ui, s: &mut (f32, String)| {
            let r = ui.add(egui::DragValue::new(&mut s.0).speed(1.));
            named(ui, &r, "value");
            let r = ui.text_edit_singleline(&mut s.1);
            named(ui, &r, "text");
        };
        h.frame(&mut state, &mut draw);
        assert!(
            h.key("text", Key::A, Modifiers::NONE, &mut state, &mut draw)
                .is_err()
        );
        assert!(
            h.drag("value", Vec2::new(f32::NAN, 0.), 3, &mut state, &mut draw)
                .is_err()
        );
        h.drag("value", Vec2::new(35., 0.), 5, &mut state, &mut draw)
            .unwrap();
        assert!(state.0 > 0.);
        h.replace_text("text", "125.5", &mut state, &mut draw)
            .unwrap();
        assert_eq!(state.1, "125.5");
        assert!(!h.ctx.input(|i| i.pointer.any_down()));
    }

    #[test]
    fn named_widgets_cancel_when_target_disappears_during_press() {
        let mut h = Harness::new(Vec2::new(400., 300.));
        let mut count = 0;
        let mut draw = |ui: &mut Ui, count: &mut usize| {
            if !ui.input(|i| i.pointer.any_down()) {
                let r = ui.button("Transient");
                named(ui, &r, "transient");
                if r.clicked() {
                    *count += 1;
                }
            }
        };
        h.frame(&mut count, &mut draw);
        assert!(
            h.click("transient", &mut count, &mut draw)
                .unwrap_err()
                .contains("cancelled")
        );
        assert_eq!(count, 0);
        assert!(!h.ctx.input(|i| i.pointer.any_down()));
    }

    #[test]
    fn named_widgets_cancel_if_target_disappears_on_last_drag_step() {
        let mut h = Harness::new(Vec2::new(400., 300.));
        let mut draw = |ui: &mut Ui, _: &mut ()| {
            if !ui.input(|i| {
                i.pointer.any_down() && !i.pointer.any_pressed() && i.pointer.delta().length() > 0.
            }) {
                let r = ui.allocate_response(Vec2::new(80., 30.), egui::Sense::drag());
                named(ui, &r, "drag");
            }
        };
        h.frame(&mut (), &mut draw);
        assert!(
            h.drag("drag", Vec2::new(25., 0.), 1, &mut (), &mut draw)
                .unwrap_err()
                .contains("before drag release")
        );
        assert!(!h.ctx.input(|i| i.pointer.any_down()));
        assert!(h.drag("drag", Vec2::ZERO, 0, &mut (), &mut draw).is_err());
    }
}
