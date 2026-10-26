//! Search and input adapter; execution belongs to Atelier::dispatch_command.
use super::commands::{self, CapabilityContext, CommandId};
use eframe::egui;

#[derive(Default)]
pub(super) struct Palette {
    pub open: bool,
    query: String,
    selected: usize,
    focus_search: bool,
}

fn aliases(id: CommandId) -> &'static str {
    use CommandId::*;
    match id {
        ToggleSimulation => "play pause run simulate",
        StepSimulation => "step frame advance",
        ResetSimulation => "reset flat arrange restart",
        ExportSession => "export write artifacts",
        SplitView => "split both 2d 3d",
        GarmentView => "garment cloth 3d viewport",
        PatternView => "pattern flat 2d viewport",
        ToggleInspector => "properties inspector sidebar",
        ResetLayout => "layout workspace reset",
        OpenPreferences => "settings preferences options theme",
        LoadTshirt => "tshirt t-shirt tee example preset",
        LoadDress => "dress example preset",
    }
}

fn matches(query: &str) -> Vec<CommandId> {
    let query = query.to_lowercase();
    commands::REGISTRY
        .iter()
        .filter(|d| {
            let text = format!("{} {} {}", d.label, d.key, aliases(d.id)).to_lowercase();
            query.split_whitespace().all(|word| text.contains(word))
        })
        .map(|d| d.id)
        .collect()
}

fn named(_ui: &egui::Ui, _r: &egui::Response, _name: &str) {
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(_ui, _r, _name);
}

pub(super) fn launch_button(ui: &mut egui::Ui, enabled: bool) -> bool {
    let response = ui
        .add_enabled(enabled, egui::Button::new("Commands…"))
        .on_hover_text("Search actions · Ctrl/Cmd+Shift+P");
    named(ui, &response, "palette.open");
    response.clicked()
}

impl Palette {
    pub fn begin(&mut self) {
        *self = Self {
            open: true,
            focus_search: true,
            ..Default::default()
        };
    }

    /// Returns at most one requested command; the caller must revalidate it.
    pub fn show(&mut self, ctx: &egui::Context, context: CapabilityContext) -> Option<CommandId> {
        if !self.open {
            return None;
        }
        if !ctx.input(|i| i.focused) || ctx.input(|i| i.viewport().close_requested()) {
            self.open = false;
            return None;
        }
        let mut command = None;
        let mut cancel = false;
        let modal = egui::Modal::new(egui::Id::new("command-palette")).show(ctx, |ui| {
            ui.set_width((ctx.content_rect().width() - 64.).clamp(200., 520.));
            ui.heading("Commands");
            ui.small("Search actions · ↑ ↓ navigate · Enter run · Esc close");
            let response = ui.add(
                egui::TextEdit::singleline(&mut self.query)
                    .id(egui::Id::new("palette.query"))
                    .hint_text("Search commands…")
                    .desired_width(f32::INFINITY),
            );
            named(ui, &response, "palette.query");
            if self.focus_search {
                response.request_focus();
                self.focus_search = false;
            }
            if response.changed() {
                self.selected = 0;
            }
            let results = matches(&self.query);
            self.selected = self.selected.min(results.len().saturating_sub(1));
            let (up, down, enter, escape) = ctx.input_mut(|i| {
                (
                    i.consume_key(egui::Modifiers::NONE, egui::Key::ArrowUp),
                    i.consume_key(egui::Modifiers::NONE, egui::Key::ArrowDown),
                    i.consume_key(egui::Modifiers::NONE, egui::Key::Enter),
                    i.consume_key(egui::Modifiers::NONE, egui::Key::Escape),
                )
            });
            if !results.is_empty() {
                if down {
                    self.selected = (self.selected + 1) % results.len();
                }
                if up {
                    self.selected = (self.selected + results.len() - 1) % results.len();
                }
                if enter && commands::availability(results[self.selected], context).is_ok() {
                    command = Some(results[self.selected]);
                }
            }
            cancel |= escape;
            let results_height = (ctx.content_rect().height() - 230.).clamp(80., 380.);
            egui::ScrollArea::vertical()
                .auto_shrink([false, false])
                .max_height(results_height)
                .min_scrolled_height(results_height)
                .show(ui, |ui| {
                    if results.is_empty() {
                        ui.label("No matching commands");
                    }
                    for (index, &id) in results.iter().enumerate() {
                        let descriptor = id.descriptor();
                        let availability = commands::availability(id, context);
                        let label = match descriptor.shortcut {
                            Some(key) => format!("{}   {key}", descriptor.label),
                            None => descriptor.label.into(),
                        };
                        let row = ui.add_enabled(
                            availability.is_ok(),
                            egui::Button::new(label).selected(index == self.selected),
                        );
                        named(ui, &row, &format!("palette.command.{}", descriptor.key));
                        if (up || down) && index == self.selected {
                            row.scroll_to_me(Some(egui::Align::Center));
                        }
                        if row.clicked() {
                            command = Some(id);
                        }
                        if let Err(reason) = availability {
                            ui.small(reason.message());
                        }
                    }
                });
            let close = ui.button("Close");
            named(ui, &close, "palette.close");
            cancel |= close.clicked();
        });
        cancel |= modal.should_close();
        if cancel {
            command = None;
        }
        if cancel || command.is_some() {
            self.open = false;
        }
        command
    }
}

#[cfg(test)]
mod tests {
    use super::super::authoring_smoke::widget_harness::Harness;
    use super::*;
    struct Case {
        palette: Palette,
        context: CapabilityContext,
        commands: Vec<CommandId>,
    }
    fn draw(ui: &mut egui::Ui, c: &mut Case) {
        if let Some(id) = c.palette.show(ui.ctx(), c.context) {
            c.commands.push(id);
        }
    }
    fn case() -> Case {
        let mut palette = Palette::default();
        palette.begin();
        Case {
            palette,
            context: CapabilityContext {
                document_loaded: true,
                worker_ready: true,
                filesystem_ready: true,
                playing: false,
                pending: false,
            },
            commands: vec![],
        }
    }
    fn frames(h: &mut Harness, c: &mut Case) {
        for _ in 0..3 {
            h.frame(c, &mut draw);
        }
    }
    #[test]
    fn search_keys_labels_and_aliases() {
        assert_eq!(matches("TEE"), vec![CommandId::LoadTshirt]);
        assert_eq!(matches("simulation.step"), vec![CommandId::StepSimulation]);
        assert_eq!(matches("garment 3d"), vec![CommandId::GarmentView]);
        assert!(matches("not-a-command").is_empty());
        assert_eq!(matches(" ").len(), commands::REGISTRY.len());
    }
    #[test]
    fn launcher_accepts_a_complete_pointer_gesture() {
        let mut count = 0;
        let mut h = Harness::new(egui::vec2(900., 900.));
        let mut draw = |ui: &mut egui::Ui, count: &mut usize| {
            if launch_button(ui, true) {
                *count += 1;
            }
        };
        h.frame(&mut count, &mut draw);
        h.click("palette.open", &mut count, &mut draw).unwrap();
        assert_eq!(count, 1);
    }
    #[test]
    fn named_search_single_dispatch_and_disabled_context() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "step", &mut c, &mut draw)
            .unwrap();
        c.context.playing = true;
        frames(&mut h, &mut c);
        assert!(
            h.click("palette.command.simulation.step", &mut c, &mut draw)
                .is_err()
        );
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(c.commands.is_empty());
        c.context.playing = false;
        frames(&mut h, &mut c);
        h.click("palette.command.simulation.step", &mut c, &mut draw)
            .unwrap();
        frames(&mut h, &mut c);
        assert_eq!(c.commands, vec![CommandId::StepSimulation]);
        assert!(!c.palette.open);
    }
    #[test]
    fn backdrop_click_cancels_without_dispatch_or_click_through() {
        let mut c = case();
        let ctx = egui::Context::default();
        let mut underlying_clicks = 0;
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
                            underlying_clicks += 1;
                        }
                        draw(ui, &mut c);
                    });
                },
            );
            output.textures_delta.clear(); // CPU-only input test has no renderer.
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
        assert!(!c.palette.open);
        assert!(c.commands.is_empty());
        assert_eq!(underlying_clicks, 0);
    }
    #[test]
    fn escape_cancels_without_request() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.key(
            "palette.query",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(!c.palette.open);
        assert!(c.commands.is_empty());
    }

    #[test]
    fn keyboard_navigation_and_context_changes_are_checked_at_activation() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "example", &mut c, &mut draw)
            .unwrap();
        h.key(
            "palette.query",
            egui::Key::ArrowDown,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.palette.selected, 1);
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::LoadDress]);
        c.palette.begin();
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "export", &mut c, &mut draw)
            .unwrap();
        c.context.filesystem_ready = false;
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands.len(), 1);
        assert!(c.palette.open);
    }
}
