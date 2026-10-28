//! Search and input adapter; execution belongs to Atelier::dispatch_command.
use super::{
    authoring_ui::Tool,
    commands::{self, CapabilityContext, CommandId},
};
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
        ToolEdit => "select edit point piece",
        ToolDraw => "pen bezier pattern cloth",
        ToolFreehand => "freehand sketch stroke outline pattern",
        ToolRectangle => "square shape primitive",
        ToolEllipse => "circle shape primitive",
        ToolSector => "arc shape primitive",
        ToolInternalLine => "internal path curve frill",
        ToolSew => "seam stitch boundary",
        ToolMove => "place arrange translate gizmo",
        ToolRotate => "place arrange rotation gizmo",
        ToolGrab => "pull drag cloth",
        ToolMeasure => "ruler tape distance",
        ToolInspect => "debug report paint faces",
    }
}

/// Map only implemented selections to the existing editor transition.
pub(super) fn tool_for_command(id: CommandId) -> Option<(Tool, bool)> {
    use CommandId::*;
    Some(match id {
        ToolEdit => (Tool::Edit, false),
        ToolDraw => (Tool::Draw, false),
        ToolFreehand => (Tool::Draw, false),
        ToolRectangle => (Tool::Rectangle, false),
        ToolEllipse => (Tool::Ellipse, false),
        ToolSector => (Tool::Sector, false),
        ToolInternalLine => (Tool::InternalLine, false),
        ToolSew => (Tool::Sew, false),
        ToolMove => (Tool::Place, false),
        ToolRotate => (Tool::Place, true),
        ToolGrab => (Tool::Grab, false),
        ToolMeasure => (Tool::Measure, false),
        ToolInspect => (Tool::Inspect, false),
        _ => return None,
    })
}

const MAX_QUERY_CHARS: usize = 128;

fn is_subsequence(needle: &str, word: &str) -> bool {
    let mut chars = word.chars();
    needle
        .chars()
        .all(|c| chars.any(|candidate| candidate == c))
}

fn matches(query: &str) -> Vec<CommandId> {
    if query.chars().count() > MAX_QUERY_CHARS {
        return Vec::new();
    }
    let query = query.to_lowercase();
    let mut results: Vec<_> = commands::REGISTRY
        .iter()
        .enumerate()
        .filter_map(|(index, d)| {
            let label = d.label.to_lowercase();
            let key = d.key.to_lowercase();
            let shortcut = d.shortcut.unwrap_or_default().to_lowercase();
            let text = format!("{} {} {} {}", label, key, shortcut, aliases(d.id));
            let mut fuzzy_words = 0usize;
            for word in query.split_whitespace() {
                if text.contains(word) {
                    continue;
                }
                if word.chars().count() < 3
                    || !text
                        .split(|c: char| !c.is_alphanumeric())
                        .any(|candidate| is_subsequence(word, candidate))
                {
                    return None;
                }
                fuzzy_words += 1;
            }
            let term = query.trim();
            // Favor an actual command name over a match in a broad alias,
            // while leaving an empty search in the original registry order.
            let relevance = if term.is_empty() || label == term || key == term || shortcut == term {
                0
            } else if label.starts_with(term) || key.starts_with(term) || shortcut.starts_with(term)
            {
                1
            } else if label
                .split(|c: char| !c.is_alphanumeric())
                .any(|w| w == term)
                || key.split(|c: char| !c.is_alphanumeric()).any(|w| w == term)
            {
                2
            } else if label.contains(term) || key.contains(term) {
                3
            } else {
                4
            };
            Some((fuzzy_words, relevance, index, d.id))
        })
        .collect();
    if results
        .iter()
        .any(|(fuzzy_words, _, _, _)| *fuzzy_words == 0)
    {
        results.retain(|(fuzzy_words, _, _, _)| *fuzzy_words == 0);
    }
    results.sort_by_key(|(fuzzy_words, relevance, index, _)| (*fuzzy_words, *relevance, *index));
    results.into_iter().map(|(_, _, _, id)| id).collect()
}

fn named(_ui: &egui::Ui, _r: &egui::Response, _name: &str) {
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(_ui, _r, _name);
}

// Shared production boundary for the launcher button and keyboard entrypoint.
// The caller supplies editing/modal state owned by Atelier; egui supplies actual
// text focus and modal ownership. Blocked shortcuts remain with their owner.
pub(super) fn can_launch(ctx: &egui::Context, editor_idle: bool) -> bool {
    editor_idle && !ctx.egui_wants_keyboard_input() && ctx.memory(|m| m.top_modal_layer().is_none())
}

pub(super) fn launch_shortcut(ctx: &egui::Context, enabled: bool) -> bool {
    enabled
        && !ctx.input(|i| i.pointer.any_down())
        && ctx.input_mut(|i| {
            i.consume_key(
                egui::Modifiers {
                    command: true,
                    shift: true,
                    ..Default::default()
                },
                egui::Key::P,
            )
        })
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
            ui.small(
                "Search actions (abbreviations supported) · ↑ ↓ navigate · Enter run · Esc close",
            );
            let response = ui.add(
                egui::TextEdit::singleline(&mut self.query)
                    .id(egui::Id::new("palette.query"))
                    .char_limit(MAX_QUERY_CHARS)
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
            let available: Vec<usize> = results
                .iter()
                .enumerate()
                .filter_map(|(index, &id)| {
                    commands::availability(id, context).is_ok().then_some(index)
                })
                .collect();
            // When a selected action becomes unavailable, move the highlight
            // but do not let the same Enter press activate a different action.
            let selection_changed = !available.contains(&self.selected) && !available.is_empty();
            if selection_changed {
                self.selected = available[0];
            }
            let (up, down, enter, escape) = ctx.input_mut(|i| {
                (
                    i.consume_key(egui::Modifiers::NONE, egui::Key::ArrowUp),
                    i.consume_key(egui::Modifiers::NONE, egui::Key::ArrowDown),
                    i.consume_key(egui::Modifiers::NONE, egui::Key::Enter),
                    i.consume_key(egui::Modifiers::NONE, egui::Key::Escape),
                )
            });
            if !available.is_empty() {
                let position = available
                    .iter()
                    .position(|&index| index == self.selected)
                    .expect("selected command must be available");
                if down {
                    self.selected = available[(position + 1) % available.len()];
                } else if up {
                    self.selected = available[(position + available.len() - 1) % available.len()];
                }
                if enter && !selection_changed {
                    command = Some(results[self.selected]);
                }
            }
            // TextEdit relinquishes focus on Enter even if activation was
            // rejected. Keep the palette usable without a new mouse click.
            if enter && command.is_none() {
                response.request_focus();
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
                            egui::Button::new(label)
                                .selected(index == self.selected && availability.is_ok()),
                        );
                        named(ui, &row, &format!("palette.command.{}", descriptor.key));
                        if (up || down || response.changed() || selection_changed)
                            && index == self.selected
                            && availability.is_ok()
                        {
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
                selected_panel: true,
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
    fn launch_boundary_preserves_text_modal_gesture_and_pointer_ownership() {
        let shortcut = egui::Modifiers {
            command: true,
            shift: true,
            ..Default::default()
        };
        // Each case uses actual egui focus/modal/pointer state. The final case
        // is the normal idle workspace and must consume exactly one request.
        for (idle, text, modal, pointer, expected) in [
            (false, false, false, false, false),
            (true, true, false, false, false),
            (true, false, true, false, false),
            (true, false, false, true, false),
            (true, false, false, false, true),
        ] {
            let ctx = egui::Context::default();
            let mut value = String::new();
            let mut observation = None;
            for frame in 0..3 {
                let mut events = Vec::new();
                if frame == 2 {
                    events.push(egui::Event::Key {
                        key: egui::Key::P,
                        physical_key: None,
                        pressed: true,
                        repeat: false,
                        modifiers: shortcut,
                    });
                    if pointer {
                        events.push(egui::Event::PointerButton {
                            pos: egui::pos2(500., 500.),
                            button: egui::PointerButton::Primary,
                            pressed: true,
                            modifiers: shortcut,
                        });
                    }
                }
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
                        // The production caller checks input before drawing its
                        // tools, so use the focus established by earlier frames.
                        if frame == 2 {
                            let enabled = can_launch(&ctx, idle);
                            let launched = launch_shortcut(&ctx, enabled);
                            let second = launch_shortcut(&ctx, enabled);
                            let retained = ctx.input(|i| i.key_pressed(egui::Key::P));
                            observation = Some((launched, second, retained));
                        }
                        if text {
                            ui.text_edit_singleline(&mut value).request_focus();
                        }
                        if modal {
                            egui::Modal::new(egui::Id::new("launch-test-modal")).show(&ctx, |ui| {
                                ui.label("Modal owner");
                            });
                        }
                    },
                );
                output.textures_delta.clear();
            }
            assert_eq!(
                observation,
                Some((expected, false, !expected)),
                "idle={idle}, text={text}, modal={modal}, pointer={pointer}"
            );
        }
    }

    #[test]
    fn plain_p_and_unshifted_command_p_do_not_launch_palette() {
        for modifiers in [egui::Modifiers::NONE, egui::Modifiers::COMMAND] {
            let ctx = egui::Context::default();
            let mut output = ctx.run_ui(
                egui::RawInput {
                    focused: true,
                    events: vec![egui::Event::Key {
                        key: egui::Key::P,
                        physical_key: None,
                        pressed: true,
                        repeat: false,
                        modifiers,
                    }],
                    ..Default::default()
                },
                |_| {
                    assert!(!launch_shortcut(&ctx, true));
                    assert!(ctx.input(|i| i.key_pressed(egui::Key::P)));
                },
            );
            output.textures_delta.clear();
        }
    }

    #[test]
    fn search_keys_labels_and_aliases() {
        assert_eq!(matches("TEE"), vec![CommandId::LoadTshirt]);
        assert_eq!(matches("simulation.step"), vec![CommandId::StepSimulation]);
        assert_eq!(matches("garment 3d"), vec![CommandId::GarmentView]);
        assert_eq!(matches("ruler"), vec![CommandId::ToolMeasure]);
        assert_eq!(matches("frill"), vec![CommandId::ToolInternalLine]);
        assert!(matches("not-a-command").is_empty());
        assert_eq!(matches(" ").len(), commands::REGISTRY.len());
    }

    #[test]
    fn abbreviations_preserve_exact_priority_and_bound_input() {
        assert_eq!(matches("rctngl").first(), Some(&CommandId::ToolRectangle));
        assert_eq!(matches("FRHND").first(), Some(&CommandId::ToolFreehand));
        assert_eq!(matches("ruler").first(), Some(&CommandId::ToolMeasure));
        assert!(matches("qz").is_empty());
        assert!(matches(&"a".repeat(MAX_QUERY_CHARS + 1)).is_empty());
        assert!(is_subsequence("fhn", "freehand"));
        assert!(!is_subsequence("hfn", "freehand"));
    }

    #[test]
    fn changed_search_reveals_new_selection_after_keyboard_scroll() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(700., 480.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "tool", &mut c, &mut draw)
            .unwrap();
        for _ in 0..10 {
            h.key(
                "palette.query",
                egui::Key::ArrowDown,
                egui::Modifiers::NONE,
                &mut c,
                &mut draw,
            )
            .unwrap();
        }
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "tool.", &mut c, &mut draw)
            .unwrap();
        frames(&mut h, &mut c);
        h.click("palette.command.tool.edit", &mut c, &mut draw)
            .unwrap();
        assert_eq!(c.commands, vec![CommandId::ToolEdit]);
    }

    #[test]
    fn named_shortcut_search_finds_and_dispatches_the_associated_command() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "Space", &mut c, &mut draw)
            .unwrap();
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::ToggleSimulation]);
    }

    #[test]
    fn command_names_rank_before_broad_aliases_without_reordering_empty_search() {
        assert_eq!(matches("cloth").first(), Some(&CommandId::ToolGrab));
        assert_eq!(matches("TOOL.GRAB").first(), Some(&CommandId::ToolGrab));
        assert_eq!(
            matches("   "),
            commands::REGISTRY.iter().map(|d| d.id).collect::<Vec<_>>()
        );
        assert!(matches("cloth").contains(&CommandId::GarmentView));
    }

    #[test]
    fn named_ambiguous_search_selects_the_relevant_tool() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "cloth", &mut c, &mut draw)
            .unwrap();
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::ToolGrab]);
    }

    #[test]
    fn named_abbreviated_search_dispatches_the_real_tool_and_bounds_paste() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "rctngl", &mut c, &mut draw)
            .unwrap();
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::ToolRectangle]);
        c.palette.begin();
        frames(&mut h, &mut c);
        h.replace_text(
            "palette.query",
            &"x".repeat(MAX_QUERY_CHARS * 4),
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(c.palette.query.chars().count() <= MAX_QUERY_CHARS);
        assert!(c.commands.len() == 1 && c.palette.open);
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

    #[test]
    fn keyboard_skips_disabled_actions_and_wraps_without_hiding_them() {
        let mut c = case();
        c.context.document_loaded = false;
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        assert_eq!(
            commands::REGISTRY[c.palette.selected].id,
            CommandId::SplitView
        );
        assert!(
            h.click("palette.command.simulation.toggle", &mut c, &mut draw)
                .is_err()
        );
        h.key(
            "palette.query",
            egui::Key::ArrowUp,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(
            commands::REGISTRY[c.palette.selected].id,
            CommandId::ToolInspect
        );
        h.key(
            "palette.query",
            egui::Key::ArrowDown,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(
            commands::REGISTRY[c.palette.selected].id,
            CommandId::SplitView
        );
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::SplitView]);
    }

    #[test]
    fn losing_availability_never_dispatches_a_different_action_on_same_enter() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        assert_eq!(
            commands::REGISTRY[c.palette.selected].id,
            CommandId::ToggleSimulation
        );
        c.context.document_loaded = false;
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(c.commands.is_empty());
        assert!(c.palette.open);
        assert_eq!(
            commands::REGISTRY[c.palette.selected].id,
            CommandId::SplitView
        );
        h.frame(&mut c, &mut draw);
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::SplitView]);
    }

    #[test]
    fn all_disabled_matches_leave_palette_open_without_dispatch() {
        let mut c = case();
        c.context.document_loaded = false;
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "simulation.step", &mut c, &mut draw)
            .unwrap();
        for key in [egui::Key::ArrowDown, egui::Key::ArrowUp, egui::Key::Enter] {
            h.key(
                "palette.query",
                key,
                egui::Modifiers::NONE,
                &mut c,
                &mut draw,
            )
            .unwrap();
        }
        assert!(c.commands.is_empty());
        assert!(c.palette.open);
    }

    #[test]
    fn every_tool_descriptor_maps_to_the_existing_transition() {
        let expected = [
            (CommandId::ToolEdit, Tool::Edit, false),
            (CommandId::ToolDraw, Tool::Draw, false),
            (CommandId::ToolFreehand, Tool::Draw, false),
            (CommandId::ToolRectangle, Tool::Rectangle, false),
            (CommandId::ToolEllipse, Tool::Ellipse, false),
            (CommandId::ToolSector, Tool::Sector, false),
            (CommandId::ToolInternalLine, Tool::InternalLine, false),
            (CommandId::ToolSew, Tool::Sew, false),
            (CommandId::ToolMove, Tool::Place, false),
            (CommandId::ToolRotate, Tool::Place, true),
            (CommandId::ToolGrab, Tool::Grab, false),
            (CommandId::ToolMeasure, Tool::Measure, false),
            (CommandId::ToolInspect, Tool::Inspect, false),
        ];
        for (id, tool, rotate) in expected {
            assert!(tool_for_command(id).is_some_and(|actual| actual == (tool, rotate)));
            assert_eq!(id.descriptor().context, commands::CommandContext::Tool);
        }
        assert!(tool_for_command(CommandId::ToggleSimulation).is_none());
        assert_eq!(
            commands::REGISTRY
                .iter()
                .filter(|d| d.context == commands::CommandContext::Tool)
                .count(),
            expected.len()
        );
    }

    #[test]
    fn palette_search_selects_real_tools_and_disables_unselected_placement() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "ruler", &mut c, &mut draw)
            .unwrap();
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::ToolMeasure]);
        c.palette.begin();
        c.context.selected_panel = false;
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "move 3d", &mut c, &mut draw)
            .unwrap();
        assert!(
            h.click("palette.command.tool.move_3d", &mut c, &mut draw)
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
        assert_eq!(c.commands, vec![CommandId::ToolMeasure]);
        assert!(c.palette.open);
    }

    #[test]
    fn palette_search_activates_freehand_by_keyboard() {
        let mut c = case();
        let mut h = Harness::new(egui::vec2(900., 900.));
        frames(&mut h, &mut c);
        h.replace_text("palette.query", "sketch", &mut c, &mut draw)
            .unwrap();
        h.key(
            "palette.query",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.commands, vec![CommandId::ToolFreehand]);
        assert!(!c.palette.open);
    }
}
