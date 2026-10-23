//! Shared sewing draft for 2D/3D: ranges and ordered sides remain material references.
use super::{authoring_ui::Tool, board::same_edge, *};
use marvelous_cloth::{
    authoring::Command,
    garment::seam::{BoundaryCurve, BoundaryRef, audit},
};

/// An explicit snapshot, independent of the editable sewing draft. Generation
/// invalidation is conservative: even placement/tool changes can make it stale.
#[derive(Default)]
pub(super) struct SewingAuditUi {
    generation: Option<u64>,
    result: Option<Result<audit::SewingAudit, String>>,
}

#[derive(Debug, PartialEq)]
enum AuditAction {
    Refresh,
    Inspect(String),
}

impl SewingAuditUi {
    fn refresh(&mut self, template: &marvelous_cloth::garment::GarmentTemplate, generation: u64) {
        // Replace a previous successful report even when compilation fails.
        self.result = Some(audit::report(template));
        self.generation = Some(generation);
    }

    fn is_current(&self, generation: u64) -> bool {
        self.result.is_some() && self.generation == Some(generation)
    }

    fn show(&self, ui: &mut egui::Ui, generation: u64) -> Option<AuditAction> {
        ui.style_mut().wrap_mode = Some(egui::TextWrapMode::Wrap);
        let warning = ui.visuals().warn_fg_color;
        let error_color = ui.visuals().error_fg_color;
        let mut action = None;
        let refresh = ui.button(if self.result.is_some() {
            "Refresh audit"
        } else {
            "Run audit"
        });
        #[cfg(test)]
        super::authoring_smoke::widget_harness::named(ui, &refresh, "audit.refresh");
        if refresh.clicked() {
            action = Some(AuditAction::Refresh);
        }
        ui.small("Material rest lengths · not draped gaps or simulation stress.");
        let Some(result) = &self.result else {
            ui.small("Check authored sewing without changing the garment.");
            return action;
        };
        let current = self.is_current(generation);
        if !current {
            ui.colored_label(warning, "Out of date — refresh before inspecting seams.");
        }
        let report = match result {
            Ok(report) => report,
            Err(error) => {
                ui.colored_label(error_color, format!("Audit unavailable: {error}"));
                return action;
            }
        };
        ui.label(format!(
            "{} seams · {} shared material endpoints",
            report.seams.len(),
            report.junctions.len()
        ));
        ui.colored_label(
            if !current {
                warning
            } else if report.valid {
                if ui.visuals().dark_mode {
                    Color32::LIGHT_GREEN
                } else {
                    Color32::from_rgb(20, 110, 55)
                }
            } else {
                error_color
            },
            if report.valid {
                "Snapshot: no authored-sewing errors"
            } else {
                "Snapshot: authored-sewing errors"
            },
        );
        ui.small("Positive B − A means extra material on side B. Easing may be intentional.");
        egui::ScrollArea::vertical().id_salt("sewing_audit_rows").max_height(300.).show(ui, |ui| {
            for seam in &report.seams {
                ui.push_id(seam.seam_index, |ui| {
                    let mismatch = seam.difference_m.map_or_else(|| "unresolved".into(), |d| format!("{:+.2} mm", d * 1000.));
                    let _header = egui::CollapsingHeader::new(format!("{} · B − A {mismatch}", seam.seam_id)).show(ui, |ui| {
                        if let Some([a, b]) = seam.lengths_m {
                            ui.label(format!("A {:.2} mm · B {:.2} mm", a * 1000., b * 1000.));
                        }
                        ui.label(format!("Easing: {}", if seam.allow_ease { "allowed" } else { "not allowed" }));
                        ui.label(format!("B direction: {}", if seam.reverse_b { "reversed" } else { "forward" }));
                        for error in &seam.errors {
                            ui.colored_label(error_color, &error.message);
                        }
                        for (side, segments) in [("A", &seam.a), ("B", &seam.b)] {
                            for segment in segments {
                                let boundary = segment.edge.clone().unwrap_or_else(|| segment.rectangle_side.map_or_else(|| "unresolved boundary".into(), |side| format!("{side:?}")));
                                ui.label(format!("{side}: {} / {boundary}", segment.panel_id));
                                for error in &segment.errors {
                                    ui.colored_label(error_color, &error.message);
                                }
                            }
                        }
                        for (i, interval) in seam.intervals.iter().enumerate() {
                            ui.label(format!("Interval {}: A {:.2} / B {:.2} mm · B − A {:+.2} mm{}", i + 1,
                                interval.lengths_m[0] * 1000., interval.lengths_m[1] * 1000., interval.difference_m * 1000.,
                                if interval.requires_easing { " · easing required" } else { "" }));
                        }
                        // Duplicate IDs cannot navigate unambiguously through the existing editor.
                        let unique = report.seams.iter().filter(|s| s.seam_id == seam.seam_id).count() == 1;
                        let inspect = ui.add_enabled(current && unique, egui::Button::new("Inspect seam"))
                            .on_hover_text("Open the existing sewing draft. The document changes only on Apply.");
                        #[cfg(test)]
                        super::authoring_smoke::widget_harness::named(ui, &inspect, format!("audit.seam.{}.inspect", seam.seam_id));
                        if inspect.clicked() {
                            action = Some(AuditAction::Inspect(seam.seam_id.clone()));
                        }
                    });
                    #[cfg(test)]
                    super::authoring_smoke::widget_harness::named(ui, &_header.header_response, format!("audit.seam.{}.toggle", seam.seam_id));
                });
            }
        });
        action
    }
}

#[derive(Default)]
pub(super) struct SewingDraft {
    pub card: Option<egui::Pos2>,
    pub chain_mode: bool,
    pub sides: [Vec<BoundaryRef>; 2],
    pub active: usize,
    pub editing: Option<String>,
    pub partial: bool,
    pub start: Option<(BoundaryRef, f64)>,
}
impl SewingDraft {
    fn from_spec(seam: &marvelous_cloth::garment::seam::SeamSpec) -> Self {
        Self {
            chain_mode: !seam.a_tail.is_empty() || !seam.b_tail.is_empty(),
            sides: [
                seam.side(false).cloned().collect(),
                seam.side(true).cloned().collect(),
            ],
            editing: Some(seam.id.clone()),
            ..Default::default()
        }
    }
}
/// Use the same relative tolerance as the seam compiler. Display rounding must
/// not suggest that two edges can sew without easing when compilation rejects it.
fn needs_easing(lengths: [f64; 2]) -> bool {
    (lengths[0] - lengths[1]).abs() > 1e-8 * lengths[0].max(lengths[1])
}

/// The primary action deliberately includes consent to unequal-length sewing.
/// Return whether that consent was given; unrelated clicks do not change it.
fn sewing_primary_action(ui: &mut egui::Ui, editing: bool, easing_needed: bool) -> Option<bool> {
    let label = match (editing, easing_needed) {
        (false, false) => "Sew these edges",
        (false, true) => "Sew with easing",
        (true, false) => "Apply seam changes",
        (true, true) => "Apply with easing",
    };
    let button = ui.add_sized(
        [ui.available_width(), 34.],
        egui::Button::new(egui::RichText::new(label).strong()).fill(ui.visuals().selection.bg_fill),
    );
    button.clicked().then_some(easing_needed)
}

impl Atelier {
    pub(super) fn sewing_audit_controls(&mut self, ui: &mut egui::Ui) {
        let action = egui::CollapsingHeader::new("Sewing audit")
            .show(ui, |ui| {
                self.authoring.sewing_audit.show(ui, self.generation)
            })
            .body_returned
            .flatten();
        match action {
            Some(AuditAction::Refresh) => self
                .authoring
                .sewing_audit
                .refresh(&self.project.template, self.generation),
            Some(AuditAction::Inspect(id)) => self.begin_seam_edit(&id),
            None => {}
        }
    }
    /// A deliberate third click confirms the visible pair. Widget clicks and
    /// endpoint drags keep their own ownership; no underlying edge is selected.
    pub(super) fn sewing_canvas_confirm(&mut self, response: &egui::Response) -> bool {
        if self.authoring.tool == Tool::Sew
            && self.sewing_sides().iter().all(|s| !s.is_empty())
            && (!self.authoring.sewing.chain_mode || response.ctx.input(|i| i.modifiers.command))
            && response.clicked()
        {
            self.commit_seam();
            return true;
        }
        false
    }
    pub(super) fn sewing_context(&mut self, ctx: &egui::Context) {
        if !matches!(self.authoring.tool, Tool::Edit | Tool::Sew)
            || self.quick.blocked
            || self.authoring.radial.blocked
        {
            return;
        }
        let sides = self.sewing_sides();
        let drafting = self.authoring.tool == Tool::Sew
            && (sides.iter().any(|s| !s.is_empty()) || self.authoring.sewing.start.is_some());
        let ready = drafting && sides.iter().all(|s| !s.is_empty());
        let seams = self.edge_seams();
        let at = if drafting {
            self.authoring.sewing.card
        } else {
            self.authoring.selection.seam_card
        };
        let Some(at) = at.filter(|_| drafting || !seams.is_empty()) else {
            return;
        };
        // Keep the card inside a canvas. Covering the inspector makes its
        // range/chain controls impossible to click near the board's right edge.
        let bounds = [
            self.authoring.selection.board_rect,
            self.authoring.selection.garment_rect,
        ]
        .into_iter()
        .flatten()
        .find(|r| r.contains(at))
        .unwrap_or_else(|| ctx.content_rect())
        .intersect(ctx.content_rect());
        let x = if at.x + 306. <= bounds.right() {
            at.x + 22.
        } else {
            at.x - 306.
        };
        let at = egui::pos2(
            x.clamp(bounds.left(), (bounds.right() - 306.).max(bounds.left())),
            (at.y + 18.).clamp(bounds.top(), (bounds.bottom() - 330.).max(bounds.top())),
        );
        egui::Window::new("Sewing at cursor")
            .id(egui::Id::new("sewing-context"))
            .title_bar(false)
            .resizable(false)
            .collapsible(false)
            .fixed_pos(at)
            .default_width(280.)
            .max_width(280.)
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                if ready {
                    let lengths = sides
                        .each_ref()
                        .map(|s| self.sewing_curve(s, false).map_or(0., |c| c.length * 1000.));
                    ui.strong(if self.authoring.sewing.editing.is_some() {
                        "EDIT SEAM"
                    } else {
                        "3 · CONFIRM SEAM"
                    });
                    for (side, refs) in sides.iter().enumerate() {
                        let details = format!(
                            "{}: {}",
                            if side == 0 { "A" } else { "B" },
                            refs.iter().map(|r| format!("{} / {}", r.panel,
                                r.edge.as_deref().unwrap_or("boundary")))
                                .collect::<Vec<_>>().join(" + ")
                        );
                        ui.add(egui::Label::new(egui::RichText::new(&details).small()).truncate())
                            .on_hover_text(details);
                    }
                    ui.label(format!("A {:.1} mm  ↔  B {:.1} mm", lengths[0], lengths[1]));
                    ui.small(format!(
                        "Difference {:.1} mm",
                        (lengths[0] - lengths[1]).abs()
                    ));
                    ui.separator();
                    let flip = ui.checkbox(&mut self.authoring.reverse, "Swap seam ends · F");
                    self.smoke_target_ui(ui, "cursor_flip", flip.rect);
                    let ease = ui.checkbox(&mut self.authoring.ease, "Allow different lengths · E");
                    self.smoke_target_ui(ui, "cursor_ease", ease.rect);
                    if flip.changed() || ease.changed() {
                        self.authoring.error = None;
                    }
                    if let Some(error) = &self.authoring.error {
                        ui.colored_label(Color32::from_rgb(225, 120, 75), error);
                    }
                    let easing_needed = needs_easing(lengths) && !self.authoring.ease;
                    if easing_needed {
                        ui.colored_label(Color32::from_rgb(225, 155, 65),
                            "Different lengths: easing gathers the longer side. It does not soften the fabric.");
                    }
                    if let Some(allow_ease) = sewing_primary_action(
                        ui, self.authoring.sewing.editing.is_some(), easing_needed,
                    ) {
                        self.authoring.ease |= allow_ease;
                        self.commit_seam();
                    }
                    if self.authoring.sewing.chain_mode {
                        ui.small("Keep adding edges, or Ctrl+Enter to apply");
                    } else if !easing_needed {
                        ui.small("Or click either canvas / press Enter to sew");
                    }
                    ui.small("F / Shift+wheel: flip direction · Esc: cancel");
                    if ui.small_button("Cancel · Esc").clicked() {
                        self.authoring.ends.clear();
                        self.authoring.sewing = Default::default();
                    }
                } else if drafting {
                    ui.strong(if self.authoring.sewing.partial && self.authoring.sewing.start.is_some() {
                        "PICK THE END OF THIS RANGE"
                    } else if self.authoring.sewing.chain_mode {
                        "BUILD THE TWO SEAM SIDES"
                    } else {
                        "2 · CLICK THE SECOND EDGE"
                    });
                    ui.label("Choose a boundary in either the 2D or 3D view.");
                    if !self.authoring.sewing.chain_mode && self.authoring.sewing.start.is_none() {
                        ui.small("The highlighted edge is side A. The next edge becomes side B.");
                    }
                    if self.authoring.sewing.chain_mode {
                        ui.horizontal(|ui| {
                            ui.selectable_value(&mut self.authoring.sewing.active, 0, "Add to A");
                            ui.selectable_value(&mut self.authoring.sewing.active, 1, "Add to B");
                        });
                    }
                    if ui.small_button("Cancel · Esc").clicked() {
                        self.authoring.ends.clear();
                        self.authoring.sewing = Default::default();
                    }
                } else {
                    ui.strong("SELECTED SEAM");
                    for id in seams {
                        ui.horizontal(|ui| {
                            if ui
                                .selectable_label(
                                    self.authoring.selection.seam.as_ref() == Some(&id),
                                    &id,
                                )
                                .clicked()
                            {
                                self.authoring.selection.seam = Some(id.clone());
                            }
                            if ui.small_button("Edit").clicked() {
                                self.begin_seam_edit(&id);
                                self.authoring.sewing.card = Some(at);
                            }
                            let delete = ui.small_button("Delete");
                            self.smoke_target_ui(ui, "cursor_delete_seam", delete.rect);
                            if delete.clicked() {
                                self.remove_seam(id);
                            }
                        });
                    }
                    ui.small("Del removes the selected seam · Ctrl+Z restores it");
                }
            });
    }
    pub(super) fn sewing_shortcuts(&mut self, ctx: &egui::Context) {
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::F)) {
            self.authoring.reverse = !self.authoring.reverse;
            self.authoring.error = None;
        }
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::E)) {
            self.authoring.ease = !self.authoring.ease;
            self.authoring.error = None;
        }
        let modifiers = if self.authoring.sewing.chain_mode {
            egui::Modifiers::CTRL
        } else {
            egui::Modifiers::NONE
        };
        if ctx.input_mut(|i| i.consume_key(modifiers, egui::Key::Enter)) {
            self.commit_seam();
        }
    }

    pub(super) fn sewing_wheel(&mut self, response: &egui::Response) {
        if self.authoring.tool != Tool::Sew || !response.hovered() {
            return;
        }
        let flipped = response.ctx.input_mut(|i| {
            let mut count = 0;
            i.events.retain(|e| {
                if matches!(e, egui::Event::MouseWheel { modifiers, delta, .. } if modifiers.shift && delta.length_sq() > 0.) {
                    count += 1; false
                } else { true }
            });
            if count > 0 { i.smooth_scroll_delta = Vec2::ZERO; }
            count % 2 == 1
        });
        if flipped {
            self.authoring.reverse = !self.authoring.reverse;
            self.authoring.error = None;
        }
    }

    pub(super) fn sewing_strip(&mut self, ui: &mut egui::Ui) {
        if self.authoring.tool != Tool::Sew {
            return;
        }
        let sides = self.sewing_sides();
        let lengths = sides
            .each_ref()
            .map(|s| self.sewing_curve(s, false).map_or(0., |c| c.length * 1000.));
        let ready = sides.iter().all(|s| !s.is_empty());
        ui.horizontal_wrapped(|ui| {
            ui.strong(if ready {
                "3 · Confirm seam"
            } else if sides.iter().any(|s| !s.is_empty()) {
                "2 · Pick second edge"
            } else {
                "1 · Pick first edge"
            });
            ui.label(format!("A {:.1} / B {:.1} mm", lengths[0], lengths[1]));
            let flip = ui.selectable_label(self.authoring.reverse, "Flip · F").on_hover_text("Reverse side B · F or Shift + wheel over either canvas");
            self.smoke_target_ui(ui, "quick_flip", flip.rect);
            if flip.clicked() { self.authoring.reverse = !self.authoring.reverse; self.authoring.error = None; }
            let ease = ui.selectable_label(self.authoring.ease, "Ease · E").on_hover_text("Explicitly allow unequal lengths. This changes correspondence, not the fabric's elasticity.");
            self.smoke_target_ui(ui, "quick_ease", ease.rect);
            if ease.clicked() { self.authoring.ease = !self.authoring.ease; self.authoring.error = None; }
            if ui.add_enabled(ready, egui::Button::new(if self.authoring.sewing.editing.is_some() { "Apply" } else { "Sew" })).on_hover_text("Enter commits a pair · Ctrl+Enter commits a chain").clicked() { self.commit_seam(); }
        });
        ui.horizontal_wrapped(|ui| {
            if self.authoring.sewing.chain_mode {
                ui.selectable_value(&mut self.authoring.sewing.active, 0, "Add to A");
                ui.selectable_value(&mut self.authoring.sewing.active, 1, "Add to B");
            }
            if ready && needs_easing(lengths) && !self.authoring.ease {
                ui.colored_label(
                    Color32::from_rgb(200, 110, 35),
                    "Different lengths · click Sew with easing beside the cursor, or press E",
                );
            } else {
                ui.small("F / Shift+wheel: direction · E: easing · Q: quick actions");
            }
        });
    }
    /// Closest point in screen space, converted back to normalized rest arclength.
    pub(super) fn boundary_parameter(
        &self,
        edge: &BoundaryRef,
        rect: egui::Rect,
        pointer: egui::Pos2,
        in_3d: bool,
    ) -> f64 {
        let Some(i) = self
            .scene
            .garment
            .panels
            .iter()
            .position(|p| p.id == edge.panel)
        else {
            return 0.;
        };
        let panel = &self.scene.garment.panels[i];
        let ids = if let Some(name) = &edge.edge {
            panel.boundaries.get(name).cloned().unwrap_or_default()
        } else {
            self.project.template.panels[i].boundary_vertices(edge.side, panel.vertices.start)
        };
        let matrix = self.camera.matrix(rect.width() / rect.height());
        let project = |id: usize| {
            if in_3d {
                super::gizmo::project_matrix(matrix, rect, self.scene.state.x[id])
            } else {
                Some(self.authoring.board.screen(
                    rect,
                    self.board_origin(i)
                        + marvelous_cloth::authoring::rotate_2d(
                            self.scene.garment.mesh.uv[id],
                            self.board_angle(i),
                        ),
                ))
            }
        };
        let mut total = 0.;
        let mut best = (f32::INFINITY, 0.);
        for pair in ids.windows(2) {
            let length =
                self.scene.garment.mesh.uv[pair[0]].distance(self.scene.garment.mesh.uv[pair[1]]);
            if let (Some(a), Some(b)) = (project(pair[0]), project(pair[1])) {
                let v = b - a;
                let mut t = ((pointer - a).dot(v) / v.length_sq().max(1e-12)).clamp(0., 1.);
                let distance = pointer.distance(a + v * t);
                if in_3d {
                    let wa = (matrix * self.scene.state.x[pair[0]].as_vec3().extend(1.)).w;
                    let wb = (matrix * self.scene.state.x[pair[1]].as_vec3().extend(1.)).w;
                    t = (t / wb) / ((1. - t) / wa + t / wb);
                }
                if distance < best.0 {
                    best = (distance, total + length * f64::from(t));
                }
            }
            total += length;
        }
        if total > 0. {
            (best.1 / total).clamp(0., 1.)
        } else {
            0.
        }
    }
    pub(super) fn paint_sewing_ranges(&mut self, ui: &egui::Ui, rect: egui::Rect, in_3d: bool) {
        let painter = ui.painter().with_clip_rect(rect);
        let mut sides = self.sewing_sides();
        let draft = sides.iter().enumerate().flat_map(|(s, rs)| {
            rs.iter().enumerate().map(move |(i, r)| {
                (
                    r.clone(),
                    Color32::from_rgb(248, 117, 188),
                    Some((s, i)),
                    true,
                )
            })
        });
        let stored = self.project.template.seams.iter().flat_map(|s| {
            s.references().map(|r| {
                (
                    r.clone(),
                    super::seam_links::seam_color(&s.id),
                    None,
                    self.authoring.selection.seam.as_ref() == Some(&s.id),
                )
            })
        });
        let ranges: Vec<_> = stored.chain(draft).collect();
        let mut updated = false;
        for (r, color, handle, selected) in ranges {
            let Some(curve) = self.display_boundary(&r, false) else {
                continue;
            };
            let i = self
                .scene
                .garment
                .panels
                .iter()
                .position(|p| p.id == r.panel)
                .unwrap();
            let matrix = self.camera.matrix(rect.width() / rect.height());
            let screen = |t| {
                let weights = curve.point(t);
                if in_3d {
                    let p: glam::DVec3 = weights
                        .iter()
                        .map(|(v, w)| self.scene.state.x[*v] * *w)
                        .sum();
                    let (origin, dir) = self
                        .camera
                        .ray(super::gizmo::project_matrix(matrix, rect, p)?, rect);
                    if self
                        .scene
                        .collider
                        .occludes_ray(origin, dir, p.distance(origin) - 0.0001)
                    {
                        return None;
                    }
                    super::gizmo::project_matrix(matrix, rect, p)
                } else {
                    let uv: glam::DVec2 = weights
                        .iter()
                        .map(|(v, w)| self.scene.garment.mesh.uv[*v] * *w)
                        .sum();
                    Some(self.authoring.board.screen(
                        rect,
                        self.board_origin(i)
                            + marvelous_cloth::authoring::rotate_2d(uv, self.board_angle(i)),
                    ))
                }
            };
            let points: Vec<_> = (0..=32).map(|k| screen(k as f64 / 32.)).collect();
            for pair in points.windows(2) {
                if let [Some(a), Some(b)] = pair {
                    if selected {
                        painter.line_segment([*a, *b], Stroke::new(6., Color32::WHITE));
                    }
                    painter.line_segment([*a, *b], Stroke::new(3., color));
                }
            }
            for end in 0..2 {
                let Some(pos) = screen(end as f64) else {
                    continue;
                };
                painter.circle_filled(pos, if handle.is_some() { 5. } else { 3. }, color);
                if let Some((side, index)) = handle {
                    let label = format!(
                        "{}{}.{}",
                        if side == 0 { "A" } else { "B" },
                        index + 1,
                        if side == 1 && self.authoring.reverse {
                            1 - end
                        } else {
                            end
                        }
                    );
                    painter.text(
                        pos + Vec2::new(7., -7.),
                        egui::Align2::LEFT_BOTTOM,
                        label,
                        egui::FontId::proportional(12.),
                        color,
                    );
                    if !self.authoring.radial.blocked
                        && self.authoring.tool == Tool::Sew
                        && rect.contains(pos)
                    {
                        let response = ui.interact(
                            egui::Rect::from_center_size(pos, Vec2::splat(14.)).intersect(rect),
                            ui.id().with(("sew-end", side, index, end)),
                            egui::Sense::drag(),
                        );
                        if response.dragged()
                            && let Some(pointer) = response.interact_pointer_pos()
                        {
                            let t = self.boundary_parameter(&r, rect, pointer, in_3d);
                            let physical_end = if r.reversed { 1 - end } else { end };
                            let range = &mut sides[side][index].range;
                            if physical_end == 0 {
                                range[0] = t.min(range[1] - 1e-6).max(0.);
                            } else {
                                range[1] = t.max(range[0] + 1e-6).min(1.);
                            }
                            updated = true;
                        }
                    }
                }
            }
        }
        if updated {
            if self.authoring.sewing.chain_mode {
                self.authoring.sewing.sides = sides;
            } else {
                self.authoring.ends = sides.into_iter().flatten().collect();
            }
        }
    }
    pub(super) fn sewing_sides(&self) -> [Vec<BoundaryRef>; 2] {
        if self.authoring.sewing.chain_mode {
            self.authoring.sewing.sides.clone()
        } else {
            [
                self.authoring.ends.first().cloned().into_iter().collect(),
                self.authoring.ends.get(1).cloned().into_iter().collect(),
            ]
        }
    }
    pub(super) fn sewing_curve(
        &self,
        refs: &[BoundaryRef],
        reverse: bool,
    ) -> Option<BoundaryCurve> {
        BoundaryCurve::concatenate(
            refs.iter()
                .map(|r| self.display_boundary(r, false))
                .collect::<Option<Vec<_>>>()?,
            reverse,
        )
        .ok()
    }
    pub(super) fn pick_sewing_boundary(
        &mut self,
        mut edge: BoundaryRef,
        t: f64,
        pointer: egui::Pos2,
    ) {
        self.authoring.sewing.card = Some(pointer);
        self.authoring.selection.seam_card = Some(pointer);
        self.authoring.selection.seam = self
            .project
            .template
            .seams
            .iter()
            .find(|s| {
                s.references()
                    .any(|r| same_edge(r, &edge) && t >= r.range[0] && t <= r.range[1])
            })
            .map(|s| s.id.clone());
        if self.authoring.tool == Tool::Sew
            && self.authoring.ends.is_empty()
            && !self.authoring.sewing.chain_mode
            && !self.authoring.sewing.partial
            && self.authoring.selection.seam.is_some()
        {
            self.cancel_preview();
            self.authoring.selected = Some(edge.panel.clone());
            self.authoring.edge = Some(edge);
            self.authoring.anchor = None;
            self.authoring.board.selection.clear();
            self.authoring.board.point_groups.clear();
            self.authoring.board.selection_panel = None;
            return;
        }
        if self.authoring.tool == Tool::Sew && self.authoring.sewing.partial {
            if let Some((start, s)) = self.authoring.sewing.start.take() {
                if !same_edge(&start, &edge) {
                    self.authoring.sewing.start = Some((edge, t));
                    self.status = "Start moved to this boundary · click its end".into();
                    return;
                }
                if (s - t).abs() < 1e-6 {
                    self.status = "Choose two different positions on the boundary".into();
                    return;
                }
                edge.range = [s.min(t), s.max(t)];
                edge.reversed = s > t;
            } else {
                self.authoring.sewing.start = Some((edge, t));
                self.status = "Partial sewing · click the other endpoint on this boundary".into();
                return;
            }
        }
        self.authoring.error = None;
        self.select_boundary(edge);
        self.status = if self.sewing_sides().iter().all(|s| !s.is_empty()) {
            "Seam preview ready · click Sew beside the cursor or press Enter"
        } else {
            "First edge selected · click the second edge in either view"
        }
        .into();
    }
    pub(super) fn begin_seam_edit(&mut self, id: &str) {
        let Some(s) = self
            .project
            .template
            .seams
            .iter()
            .find(|s| s.id == id)
            .cloned()
        else {
            return;
        };
        self.set_authoring_tool(Tool::Sew, false);
        self.authoring.reverse = s.reverse_b;
        self.authoring.ease = s.allow_ease;
        self.authoring.ends = vec![s.a.clone(), s.b.clone()];
        self.authoring.sewing = SewingDraft::from_spec(&s);
        self.prefs.workspace.inspector_open = true;
    }
    pub(super) fn sewing_controls(&mut self, ui: &mut egui::Ui) {
        ui.heading("Sewing");
        if let Some(id) = &self.authoring.sewing.editing {
            ui.label(format!("Editing {id} · apply to commit"));
        }
        let mut chain = self.authoring.sewing.chain_mode;
        let chain_button = ui.checkbox(&mut chain, "Multiple edges per side");
        self.smoke_target_ui(ui, "sew_chain", chain_button.rect);
        if chain_button.changed() {
            let sides = self.sewing_sides();
            if chain {
                self.authoring.sewing.sides = sides;
            } else if sides.iter().any(|s| s.len() > 1) {
                self.status = "Remove extra segments before switching to single-edge sewing".into();
                chain = true;
            } else {
                self.authoring.ends = sides.into_iter().flatten().collect();
            }
            self.authoring.sewing.chain_mode = chain;
        }
        if ui
            .checkbox(
                &mut self.authoring.sewing.partial,
                "Pick partial range (two clicks)",
            )
            .changed()
        {
            self.authoring.sewing.start = None;
        }
        if chain {
            ui.horizontal(|ui| {
                ui.selectable_value(&mut self.authoring.sewing.active, 0, "Add to A");
                let button = ui.selectable_value(&mut self.authoring.sewing.active, 1, "Add to B");
                self.smoke_target_ui(ui, "sew_side_b", button.rect);
            });
            ui.small(
                "Click edges in sewing order. Enter switches A/B. Reverse changes one segment.",
            );
        } else {
            ui.small("Select A then B in either view. Ranges use rest length, in mm.");
        }
        let mut sides = self.sewing_sides();
        for (side, refs) in sides.iter_mut().enumerate() {
            let mut remove = None;
            let mut move_up = None;
            for (i, r) in refs.iter_mut().enumerate() {
                ui.push_id((side, i), |ui| {
                    ui.horizontal(|ui| {
                        ui.label(format!(
                            "{}{} · {} / {}",
                            if side == 0 { "A" } else { "B" },
                            i + 1,
                            r.panel,
                            r.edge.as_deref().unwrap_or("edge")
                        ));
                        if chain
                            && i > 0
                            && ui
                                .small_button("Up")
                                .on_hover_text("Move earlier in the chain")
                                .clicked()
                        {
                            move_up = Some(i);
                        }
                        if ui
                            .small_button("×")
                            .on_hover_text("Remove this segment from the draft")
                            .clicked()
                        {
                            remove = Some(i);
                        }
                    });
                    let mut full = r.clone();
                    full.range = [0., 1.];
                    if let Some(c) = self.display_boundary(&full, false) {
                        let length = c.length * 1000.;
                        let mut mm = r.range.map(|t| t * length);
                        ui.horizontal(|ui| {
                            ui.label("From");
                            ui.add(
                                egui::DragValue::new(&mut mm[0])
                                    .range(0. ..=length)
                                    .speed(0.5)
                                    .suffix(" mm"),
                            );
                            ui.label("To");
                            let to = ui.add(
                                egui::DragValue::new(&mut mm[1])
                                    .range(0. ..=length)
                                    .speed(0.5)
                                    .suffix(" mm"),
                            );
                            self.smoke_target_ui(ui, &format!("sew_to_{side}_{i}"), to.rect);
                        });
                        if mm[1] > mm[0] + 1e-5 {
                            r.range = mm.map(|m| m / length);
                        }
                        ui.horizontal(|ui| {
                            let mut selected = (r.range[1] - r.range[0]) * length;
                            ui.label("Length");
                            if ui
                                .add(
                                    egui::DragValue::new(&mut selected)
                                        .range(0.01..=(length * (1. - r.range[0])))
                                        .speed(0.5)
                                        .suffix(" mm"),
                                )
                                .changed()
                            {
                                r.range[1] = r.range[0] + selected / length;
                            }
                            ui.checkbox(&mut r.reversed, "Reverse");
                        });
                    }
                });
            }
            if let Some(i) = remove {
                refs.remove(i);
            } else if let Some(i) = move_up {
                refs.swap(i, i - 1);
            }
        }
        let lengths = sides
            .each_ref()
            .map(|s| self.sewing_curve(s, false).map_or(0., |c| c.length));
        ui.label(format!(
            "A {:.1} mm / B {:.1} mm",
            lengths[0] * 1000.,
            lengths[1] * 1000.
        ));
        ui.checkbox(&mut self.authoring.reverse, "Reverse the entire B side");
        let easing = ui.checkbox(&mut self.authoring.ease, "Allow easing (different lengths)");
        self.smoke_target_ui(ui, "sew_easing", easing.rect);
        if needs_easing(lengths) && !self.authoring.ease {
            ui.colored_label(
                Color32::GOLD,
                "Lengths differ. Adjust the ranges or explicitly allow easing.",
            );
        }
        let ready = sides.iter().all(|s| !s.is_empty());
        if chain {
            self.authoring.sewing.sides = sides;
        } else {
            self.authoring.ends = sides.into_iter().flatten().collect();
        }
        ui.horizontal(|ui| {
            let button = ui.add_enabled(
                ready,
                egui::Button::new(if self.authoring.sewing.editing.is_some() {
                    "Apply seam"
                } else {
                    "Commit the seam"
                }),
            );
            self.smoke_target_ui(ui, "sew", button.rect);
            if button.clicked() {
                self.commit_seam();
            }
            if ui.button("Cancel draft").clicked() {
                self.authoring.ends.clear();
                self.authoring.sewing = Default::default();
            }
        });
        ui.separator();
    }
    pub(super) fn commit_seam(&mut self) -> bool {
        let [a, b] = self.sewing_sides();
        if a.is_empty() || b.is_empty() {
            return false;
        }
        let lengths = [&a, &b].map(|side| self.sewing_curve(side, false).map_or(0., |c| c.length));
        if needs_easing(lengths) && !self.authoring.ease {
            self.authoring.error = Some(
                "These edges have different lengths. Click Sew with easing to gather the longer side, or adjust the ranges.".into()
            );
            return false;
        }
        if self.edit(Command::SewChain {
            seam: self.authoring.sewing.editing.clone(),
            a,
            b,
            reverse: self.authoring.reverse,
            ease: self.authoring.ease,
        }) {
            self.authoring.ends.clear();
            self.authoring.sewing = Default::default();
            self.authoring.selection.seam_card = None;
            self.status = "Seam created · pick two more edges, or press Space to simulate".into();
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn named_widgets_audit_refresh_inspection_staleness_and_failure() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            template: marvelous_cloth::garment::GarmentTemplate,
            audit: SewingAuditUi,
            draft: SewingDraft,
            generation: u64,
            refreshes: usize,
        }
        let mut case = Case {
            template: marvelous_cloth::garment::GarmentTemplate::two_panel_demo(),
            audit: Default::default(),
            draft: Default::default(),
            generation: 1,
            refreshes: 0,
        };
        // Equal total lengths with deliberately different local correspondence.
        case.template.seams[0].notches = vec![[0.25, 0.75]];
        case.template.seams[0].allow_ease = true;
        let before = serde_json::to_string(&case.template).unwrap();
        let id = case.template.seams[0].id.clone();
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| match c.audit.show(ui, c.generation) {
            Some(AuditAction::Refresh) => {
                c.audit.refresh(&c.template, c.generation);
                c.refreshes += 1;
            }
            Some(AuditAction::Inspect(id)) => {
                let seam = c.template.seams.iter().find(|s| s.id == id).unwrap();
                c.draft = SewingDraft::from_spec(seam);
            }
            None => {}
        };
        let mut h = Harness::new(Vec2::new(650., 700.));
        h.frame(&mut case, &mut draw);
        assert_eq!(case.refreshes, 0);
        h.click("audit.refresh", &mut case, &mut draw).unwrap();
        assert_eq!(case.refreshes, 1);
        h.frame(&mut case, &mut draw);
        assert_eq!(case.refreshes, 1);
        assert!(
            case.audit.result.as_ref().unwrap().as_ref().unwrap().seams[0]
                .intervals
                .iter()
                .all(|i| i.requires_easing)
        );
        h.click(&format!("audit.seam.{id}.toggle"), &mut case, &mut draw)
            .unwrap();
        h.frame(&mut case, &mut draw);
        let inspect = format!("audit.seam.{id}.inspect");
        h.click(&inspect, &mut case, &mut draw).unwrap();
        assert_eq!(case.draft.editing.as_deref(), Some(id.as_str()));
        assert_eq!(case.draft.sides[0].len(), 1);
        assert_eq!(serde_json::to_string(&case.template).unwrap(), before);
        case.generation += 1;
        h.frame(&mut case, &mut draw);
        assert!(
            h.click(&inspect, &mut case, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.click("audit.refresh", &mut case, &mut draw).unwrap();
        assert!(case.audit.is_current(case.generation));
        case.template.version = u32::MAX;
        case.generation += 1;
        h.frame(&mut case, &mut draw);
        h.click("audit.refresh", &mut case, &mut draw).unwrap();
        assert!(case.audit.result.as_ref().unwrap().is_err());
        h.frame(&mut case, &mut draw);
        assert!(
            h.click(&inspect, &mut case, &mut draw)
                .unwrap_err()
                .contains("missing")
        );
    }

    #[test]
    fn sewing_audit_snapshot_preserves_document_and_replaces_success_on_error() {
        let mut template = marvelous_cloth::garment::GarmentTemplate::two_panel_demo();
        let before = serde_json::to_string(&template).unwrap();
        let mut cache = SewingAuditUi::default();
        assert!(!cache.is_current(0));
        cache.refresh(&template, 7);
        assert!(cache.is_current(7));
        assert!(!cache.is_current(8));
        assert!(cache.result.as_ref().unwrap().as_ref().unwrap().valid);
        assert_eq!(serde_json::to_string(&template).unwrap(), before);
        template.version = u32::MAX;
        cache.refresh(&template, 8);
        assert!(cache.is_current(8));
        assert!(cache.result.as_ref().unwrap().is_err());
    }

    #[test]
    fn sewing_audit_keeps_local_easing_even_with_equal_total_lengths() {
        let mut template = marvelous_cloth::garment::GarmentTemplate::two_panel_demo();
        template.seams[0].notches = vec![[0.25, 0.75]];
        let mut cache = SewingAuditUi::default();
        cache.refresh(&template, 1);
        let report = cache.result.as_ref().unwrap().as_ref().unwrap();
        assert!(!report.valid);
        assert_eq!(report.seams[0].difference_m, Some(0.));
        assert!(report.seams[0].intervals.iter().all(|i| i.requires_easing));
    }

    #[test]
    fn sewing_audit_button_requests_refresh_without_compiling_during_render() {
        let ctx = egui::Context::default();
        let cache = SewingAuditUi::default();
        let frame = |events| {
            let mut action = None;
            let mut at = egui::Pos2::ZERO;
            let mut output = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        Vec2::new(400., 500.),
                    )),
                    events,
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        at = ui.next_widget_position() + Vec2::new(30., 9.);
                        action = cache.show(ui, 1);
                    });
                },
            );
            output.textures_delta.clear();
            (action, at)
        };
        let (action, at) = frame(vec![]);
        assert_eq!(action, None);
        let click = |pressed| egui::Event::PointerButton {
            pos: at,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        assert_eq!(
            frame(vec![egui::Event::PointerMoved(at), click(true)]).0,
            None
        );
        assert_eq!(frame(vec![click(false)]).0, Some(AuditAction::Refresh));
        assert_eq!(frame(vec![]).0, None);
        assert!(cache.result.is_none());
    }

    #[test]
    fn unequal_length_primary_action_requires_an_explicit_click() {
        let ctx = egui::Context::default();
        let mut center = egui::Pos2::ZERO;
        let mut frame = |events| {
            let mut consent = None;
            let mut output = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        Vec2::new(320., 240.),
                    )),
                    events,
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        center = ui.next_widget_position() + Vec2::new(120., 17.);
                        consent = sewing_primary_action(ui, false, true);
                    });
                },
            );
            output.textures_delta.clear();
            (consent, center)
        };
        let (initial, at) = frame(vec![]);
        assert_eq!(initial, None);
        let click = |pressed| egui::Event::PointerButton {
            pos: at,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        assert_eq!(
            frame(vec![egui::Event::PointerMoved(at), click(true)]).0,
            None
        );
        assert_eq!(frame(vec![click(false)]).0, Some(true));
        assert_eq!(frame(vec![]).0, None);
    }
}
