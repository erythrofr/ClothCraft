//! Egui adapter for the CPU authoring commands; no physical model lives here.
use super::*;
use glam::{DVec2, DVec3};
use marvelous_cloth::{
    authoring::{self, Command, ConstructionRef, Edit, History, PointConstruction},
    garment::{meshing::MeshingSettings, seam::BoundaryRef, template::Placement},
};

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub(super) enum Tool {
    Grab,
    #[default]
    Edit,
    Place,
    Draw,
    Rectangle,
    InternalLine,
    Measure,
    Sew,
    Inspect,
    Ellipse,
    Sector,
}
#[derive(Default)]
pub(super) struct AuthoringUi {
    pub construction: ConstructionDraft,
    pub sewing: super::sewing_ui::SewingDraft,
    pub radial: super::radial::Radial,
    pub selection: super::selection::Selection,
    pub tool: Tool,
    pub selected: Option<String>,
    pub history: History,
    pub draft: Vec<DVec2>,
    pub tangents: Vec<DVec2>,
    pub board: super::board::Board,
    pub measure: super::measure::Tape,
    pub edge: Option<BoundaryRef>,
    pub hover_edge: Option<BoundaryRef>,
    pub replace: bool,
    pub ends: Vec<BoundaryRef>,
    pub reverse: bool,
    pub ease: bool,
    pub preview: Option<Placement>,
    pub preview_state: Option<marvelous_cloth::model::State>,
    pub error: Option<String>,
    pub fabric_draft: Option<super::fabrics_ui::FabricDraft>,
    pub rotate: bool,
    pub drag: Option<super::gizmo::Drag>,
    pub drafting: super::drafting_ui::DraftingUi,
    /// Contour point selected for numeric entry: (panel id, point index).
    pub anchor: Option<(String, usize)>,
    /// Panel the numeric size draft belongs to; `None` reloads from geometry.
    pub numeric_panel: Option<String>,
    pub width_mm: f64,
    pub height_mm: f64,
    pub numeric_anchor: Option<usize>,
    pub anchor_x_mm: f64,
    pub anchor_y_mm: f64,
    /// Boundary the target-length draft belongs to: (panel id, boundary name).
    pub target_edge: Option<(String, String)>,
    /// Target length draft, in millimetres. The document stores metres.
    pub target_mm: f64,
}

pub(super) fn segment_distance(p: egui::Pos2, a: egui::Pos2, b: egui::Pos2) -> f32 {
    let d = b - a;
    p.distance(a + d * ((p - a).dot(d) / d.length_sq().max(1e-12)).clamp(0., 1.))
}

/// Shared millimetre entry: 0.1 mm steps and a ` mm` suffix. The document stores
/// metres; convert edits with `authoring::mm_to_m` (division by 1000).
pub(super) fn millimetre_field(ui: &mut egui::Ui, value_mm: &mut f64) -> bool {
    ui.add(
        egui::DragValue::new(value_mm)
            .speed(0.1)
            .max_decimals(1)
            .suffix(" mm"),
    )
    .changed()
}

pub(super) struct ConstructionDraft {
    reference: Option<ConstructionRef>,
    mode: usize,
    value_mm: String,
}
impl Default for ConstructionDraft {
    fn default() -> Self {
        Self {
            reference: None,
            mode: 0,
            value_mm: "50".into(),
        }
    }
}
struct ConstructionControls {
    command: Option<Command>,
    field: egui::Response,
    apply: egui::Response,
}

/// Board-space reference endpoints, current corner and proposed corner.
/// Only semantic contour coordinates are read; this never compiles a mesh.
fn construction_preview_points(
    template: &marvelous_cloth::garment::GarmentTemplate,
    target: &ConstructionRef,
    reference: &ConstructionRef,
    result: DVec2,
) -> Option<[DVec2; 4]> {
    let resolve = |r: &ConstructionRef| {
        let i = template.panels.iter().position(|p| p.id == r.panel)?;
        let polygon = template.panels[i].polygon.as_ref()?;
        let k = polygon.edges.iter().position(|e| e == &r.edge)?;
        Some((i, k, polygon))
    };
    let (ri, rk, rp) = resolve(reference)?;
    let (ti, tk, tp) = resolve(target)?;
    let board = |i: usize, p: DVec2| {
        authoring::layout(template, i)
            + authoring::rotate_2d(p, template.panels[i].layout_rotation_degrees)
    };
    let points = [
        board(ri, *rp.points.get(rk)?),
        board(ri, *rp.points.get((rk + 1) % rp.points.len())?),
        board(ti, *tp.points.get(tk)?),
        board(ti, result),
    ];
    points.iter().all(|p| p.is_finite()).then_some(points)
}

fn paint_construction_preview(ui: &mut egui::Ui, points: [DVec2; 4]) {
    let min = points.iter().copied().fold(points[0], DVec2::min);
    let max = points.iter().copied().fold(points[0], DVec2::max);
    let span = max - min;
    if !span.is_finite() {
        return;
    }
    let (rect, _) = ui.allocate_exact_size(
        Vec2::new(ui.available_width().clamp(80., 280.), 110.),
        egui::Sense::hover(),
    );
    let painter = ui.painter_at(rect);
    painter.rect_filled(rect, 4., ui.visuals().extreme_bg_color);
    let inner = rect.shrink(14.);
    let scale =
        (inner.width() as f64 / span.x.max(1e-9)).min(inner.height() as f64 / span.y.max(1e-9));
    let screen = |p: DVec2| {
        let offset = ((p - min) - span * 0.5) * scale;
        inner.center() + Vec2::new(offset.x as f32, offset.y as f32)
    };
    let [a, b, current, proposed] = points.map(screen);
    let reference = Color32::from_rgb(110, 180, 240);
    let result = Color32::from_rgb(110, 220, 160);
    painter.arrow(a, b - a, egui::Stroke::new(2., reference));
    painter.line_segment([current, proposed], egui::Stroke::new(1., Color32::GRAY));
    painter.circle_stroke(current, 5., egui::Stroke::new(2., Color32::GOLD));
    painter.circle_filled(proposed, 3., result);
    ui.horizontal_wrapped(|ui| {
        ui.colored_label(reference, "→ Reference");
        ui.colored_label(Color32::GOLD, "○ Current");
        ui.colored_label(result, "● Proposed");
    });
    ui.small("Auto-scaled board view · Apply still validates the contour and seams.");
}
/// A UI-only draft. Typing and choosing a reference never mutate a document.
fn construction_controls(
    ui: &mut egui::Ui,
    draft: &mut ConstructionDraft,
    template: &marvelous_cloth::garment::GarmentTemplate,
    target: &ConstructionRef,
) -> ConstructionControls {
    let choices: Vec<_> = template
        .panels
        .iter()
        .flat_map(|p| {
            p.polygon.iter().flat_map(move |poly| {
                poly.edges.iter().enumerate().filter_map(move |(i, e)| {
                    if poly.curves.contains_key(e) {
                        return None;
                    }
                    Some((
                        ConstructionRef {
                            panel: p.id.clone(),
                            edge: e.clone(),
                        },
                        format!(
                            "{} / {} · {} → {}",
                            p.name,
                            e,
                            i + 1,
                            (i + 1) % poly.points.len() + 1
                        ),
                    ))
                })
            })
        })
        .collect();
    if draft.reference.is_none() {
        draft.reference = choices.first().map(|(r, _)| r.clone());
    }
    let label = choices
        .iter()
        .find(|(r, _)| Some(r) == draft.reference.as_ref())
        .map(|(_, s)| s.as_str())
        .unwrap_or("Choose a straight edge");
    ui.label("Reference edge · start → end");
    egui::ComboBox::from_id_salt("construction-reference")
        .selected_text(label)
        .width(220.)
        .show_ui(ui, |ui| {
            for (reference, label) in choices {
                ui.selectable_value(&mut draft.reference, Some(reference), label);
            }
        });
    ui.horizontal_wrapped(|ui| {
        for (i, label) in ["Project", "Distance", "Perpendicular"].iter().enumerate() {
            ui.selectable_value(&mut draft.mode, i, *label);
        }
    });
    let field = ui
        .horizontal(|ui| {
            let response = ui.add_enabled(
                draft.mode != 0,
                egui::TextEdit::singleline(&mut draft.value_mm).desired_width(90.),
            );
            ui.label("mm");
            response
        })
        .inner;
    ui.small(match draft.mode {
        0 => "Project onto the infinite line; endpoints do not clamp it.",
        1 => "Signed distance from the reference start toward its end.",
        _ => "Offset from the projection; + follows a 90° turn in board coordinates.",
    });
    let operation = if draft.mode == 0 {
        Ok(PointConstruction::Project)
    } else {
        draft
            .value_mm
            .trim()
            .parse::<f64>()
            .ok()
            .filter(|v| v.is_finite())
            .map(|v| {
                if draft.mode == 1 {
                    PointConstruction::Distance(authoring::mm_to_m(v))
                } else {
                    PointConstruction::Perpendicular(authoring::mm_to_m(v))
                }
            })
            .ok_or_else(|| "Enter a finite signed distance in mm".to_owned())
    };
    let preview = operation.clone().and_then(|operation| {
        let reference = draft
            .reference
            .as_ref()
            .ok_or("Choose a straight reference edge")?;
        authoring::constructed_point(template, target, reference, operation)
    });
    match &preview {
        Ok(p) => {
            ui.small(format!(
                "Local result: X {:.2} mm · Y {:.2} mm",
                p.x * 1000.,
                p.y * 1000.
            ));
            if let Some(points) = draft
                .reference
                .as_ref()
                .and_then(|reference| construction_preview_points(template, target, reference, *p))
            {
                paint_construction_preview(ui, points);
            }
        }
        Err(error) => {
            ui.colored_label(Color32::GOLD, error);
        }
    }
    let apply = ui.add_enabled(preview.is_ok(), egui::Button::new("Apply construction"));
    let command = if apply.clicked() {
        Some(Command::ConstructPoint {
            target: target.clone(),
            reference: draft.reference.clone().unwrap(),
            operation: operation.unwrap(),
        })
    } else {
        None
    };
    ConstructionControls {
        command,
        field,
        apply,
    }
}

impl Atelier {
    pub(super) fn install_edit(&mut self, edit: Edit) {
        self.simulation_error = None;
        self.document.dirty = true;
        self.authoring.sewing = Default::default();
        if edit.reset_simulation {
            self.issue.invalidate();
            self.scene.state = edit.state_after(&self.scene.garment, &self.scene.state);
        }
        let point_order_unchanged = |id: &str| {
            let old = self
                .project
                .template
                .panels
                .iter()
                .find(|p| p.id == id)
                .and_then(|p| p.polygon.as_ref());
            let new = edit
                .template
                .panels
                .iter()
                .find(|p| p.id == id)
                .and_then(|p| p.polygon.as_ref());
            matches!((old, new), (Some(a), Some(b)) if a.edges == b.edges && a.points.len() == b.points.len())
        };
        let point_groups = self
            .authoring
            .board
            .point_selections()
            .into_iter()
            .filter(|(id, _)| point_order_unchanged(id))
            .collect();
        let point_selection = self
            .authoring
            .board
            .selection_panel
            .as_ref()
            .filter(|id| point_order_unchanged(id))
            .map(|id| (id.clone(), self.authoring.board.selection.clone()));
        if self
            .authoring
            .anchor
            .as_ref()
            .is_some_and(|(id, _)| !point_order_unchanged(id))
        {
            self.authoring.anchor = None;
        }
        self.project.template = edit.template;
        self.authoring
            .selection
            .panels
            .retain(|id| self.project.template.panels.iter().any(|p| &p.id == id));
        self.project.state = None;
        self.project.mesh_signature = None;
        self.project.prearrange = false;
        if edit.reset_simulation {
            self.scene.garment = std::sync::Arc::new(edit.garment);
        }
        self.authoring.board.clear_preview();
        self.authoring.board.point_groups = point_groups;
        if let Some((id, indices)) = point_selection {
            self.authoring.board.selection_panel = Some(id);
            self.authoring.board.selection = indices;
        }
        self.scene.next_dt = self.settings.dt;
        self.generation += 1;
        self.playing = false;
        self.pending = false;
        self.metrics = None;
        self.grab = None;
        self.drag_plane = None;
        self.authoring.preview = None;
        self.authoring.preview_state = None;
        self.authoring.error = None;
        self.authoring.fabric_draft = None;
        self.authoring.drag = None;
        // Force the numeric fields to re-read the edited geometry next frame.
        self.authoring.numeric_panel = None;
        self.authoring.numeric_anchor = None;
        self.authoring.target_edge = None;
        self.authoring.ends.clear();
        self.authoring.edge = self.authoring.edge.take().filter(|edge| {
            self.scene.garment.panels.iter().any(|p| {
                p.id == edge.panel
                    && edge
                        .edge
                        .as_ref()
                        .is_some_and(|name| p.boundaries.contains_key(name))
            })
        });
        let inserted = edit.new_point.zip(edit.selected.clone());
        if let Some(id) = edit.selected {
            self.authoring.selected = Some(id);
        }
        if !self
            .project
            .template
            .panels
            .iter()
            .any(|p| Some(&p.id) == self.authoring.selected.as_ref())
        {
            self.authoring.selected = self.project.template.panels.first().map(|p| p.id.clone());
        }
        // A split selects its new point, so the user keeps editing where they are.
        if let Some((index, id)) = inserted {
            self.authoring.board.select_point(id.clone(), index, false);
            self.authoring.anchor = Some((id, index));
        }
        self.status = if edit.reset_simulation {
            "Edit applied · unchanged panels retained · ready to simulate"
        } else {
            "2D layout changed · 3D state preserved"
        }
        .into();
    }
    pub(super) fn edit(&mut self, command: Command) -> bool {
        match authoring::apply(&self.project.template, command) {
            Ok(edit) => {
                self.authoring.history.record(self.project.template.clone());
                self.install_edit(edit);
                true
            }
            Err(e) => {
                self.authoring.error = Some(e.clone());
                self.status = e;
                false
            }
        }
    }
    fn undo_edit(&mut self, redo: bool) {
        self.cancel_preview();
        self.authoring.board.clear_preview();
        self.authoring.replace = false;
        self.authoring.draft.clear();
        self.authoring.tangents.clear();
        match self.authoring.history.restore(&self.project.template, redo) {
            Ok(edit) => self.install_edit(edit),
            Err(e) => self.status = e,
        }
    }
    pub(super) fn cancel_preview(&mut self) {
        if self.authoring.preview.take().is_some() {
            if let Some(state) = self.authoring.preview_state.take() {
                self.scene.state = state;
            }
            self.generation += 1;
        }
        self.authoring.drag = None;
    }
    pub(super) fn preview_placement(&mut self, placement: Placement) {
        let Some(id) = self.authoring.selected.as_ref() else {
            return;
        };
        let Some(range) = self.scene.garment.panels.iter().find(|p| &p.id == id) else {
            return;
        };
        if self.authoring.preview.is_none() {
            self.authoring.preview_state = Some(self.scene.state.clone());
            self.generation += 1;
        }
        self.playing = false;
        for i in range.vertices.clone() {
            let uv = self.scene.garment.mesh.uv[i];
            self.scene.state.x[i] = placement.transform(DVec3::new(uv.x, -uv.y, 0.));
            self.scene.state.v[i] = DVec3::ZERO;
        }
        self.authoring.preview = Some(placement);
    }
    pub(super) fn commit_placement(&mut self) -> bool {
        if let (Some(panel), Some(placement)) = (
            self.authoring.selected.clone(),
            self.authoring.preview.clone(),
        ) && !self.edit(Command::Place { panel, placement })
        {
            self.cancel_preview();
            return false;
        }
        true
    }
    pub(super) fn authoring_toolbar(&mut self, ui: &mut egui::Ui) {
        self.history_shortcuts(ui.ctx());
        ui.vertical_centered(|ui| {
            if ui
                .button("···")
                .on_hover_text("Right-click either canvas to choose a tool")
                .clicked()
            {
                self.authoring.radial.open(
                    ui.ctx(),
                    ui.ctx()
                        .pointer_hover_pos()
                        .unwrap_or(ui.max_rect().center()),
                );
            }
            // Keep smoke-target keys synchronized with authoring_smoke.rs.
            // `label` is the text shown on the button.
            for (tool, key, label, rotate, help) in [
                (
                    Tool::Edit,
                    "Edit",
                    "Edit",
                    false,
                    "Select, points and Bézier handles · 2D rotation with the round handle",
                ),
                (
                    Tool::Draw,
                    "Pen",
                    "Pen",
                    false,
                    "Click for a corner, click and drag for a curve",
                ),
                (
                    Tool::Rectangle,
                    "Rectangle",
                    "Rectangle",
                    false,
                    "Drag between two corners to create fabric",
                ),
                (
                    Tool::Sew,
                    "Sew",
                    "Sew",
                    false,
                    "Choose two boundaries in the 2D or 3D views",
                ),
                (
                    Tool::InternalLine,
                    "Internal line",
                    "Internal line",
                    false,
                    "Click a boundary to choose its panel, then draw inside; Enter to finish",
                ),
                (
                    Tool::Measure,
                    "measure",
                    "Measure",
                    false,
                    "M · click two points on the 2D board · Esc: clear",
                ),
                (
                    Tool::Place,
                    "Move 3D",
                    "Move 3D",
                    false,
                    "G · move the selected panel's flat arrangement",
                ),
                (
                    Tool::Place,
                    "Rotate 3D",
                    "Rotate 3D",
                    true,
                    "R · X/Y/Z rings · Shift for 15°",
                ),
                (
                    Tool::Grab,
                    "Grab",
                    "Grab",
                    false,
                    "Drag the simulated cloth with the mouse",
                ),
                (
                    Tool::Inspect,
                    "issue_brush",
                    "Mark issue",
                    false,
                    "D · pause and paint problem faces; export a diagnostic report",
                ),
            ] {
                if tool == Tool::Sew || (tool == Tool::Place && !rotate) || tool == Tool::Grab {
                    ui.separator();
                }
                let active = self.authoring.tool == tool
                    && (tool != Tool::Place || self.authoring.rotate == rotate);
                let icon = match tool {
                    Tool::Edit => super::icons::Icon::Select,
                    Tool::Draw | Tool::InternalLine => super::icons::Icon::Pen,
                    Tool::Rectangle => super::icons::Icon::Rectangle,
                    Tool::Ellipse => super::icons::Icon::Ellipse,
                    Tool::Sector => super::icons::Icon::Arc,
                    Tool::Sew => super::icons::Icon::Sew,
                    Tool::Place if rotate => super::icons::Icon::Rotate3d,
                    Tool::Place => super::icons::Icon::Move3d,
                    Tool::Grab => super::icons::Icon::Grab,
                    Tool::Inspect => super::icons::Icon::Warning,
                    Tool::Measure => super::icons::Icon::Measure,
                };
                let button =
                    super::icons::icon_only(ui, icon, 36., active, &format!("{label}\n{help}"));
                self.smoke_target(key, button.rect.center());
                if button.clicked() {
                    self.set_authoring_tool(tool, rotate);
                }
            }
            ui.separator();
            let undo = ui
                .add_enabled_ui(self.authoring.history.can_undo(), |ui| {
                    super::icons::icon_only(
                        ui,
                        super::icons::Icon::Undo,
                        32.,
                        false,
                        "Undo · Ctrl+Z",
                    )
                })
                .inner;
            self.smoke_target("undo", undo.rect.center());
            if undo.clicked() {
                self.undo_edit(false);
            }
            let redo = ui
                .add_enabled_ui(self.authoring.history.can_redo(), |ui| {
                    super::icons::icon_only(
                        ui,
                        super::icons::Icon::Redo,
                        32.,
                        false,
                        "Redo · Ctrl+Shift+Z",
                    )
                })
                .inner;
            self.smoke_target("redo", redo.rect.center());
            if redo.clicked() {
                self.undo_edit(true);
            }
        });
    }
    pub(super) fn set_authoring_tool(&mut self, tool: Tool, rotate: bool) {
        if self.authoring.tool == tool
            && (tool != Tool::Place || self.authoring.rotate == rotate)
            && !self.authoring.board.freehand.enabled
        {
            return;
        }
        self.cancel_preview();
        let replacing = self.authoring.replace
            && matches!(
                self.authoring.tool,
                Tool::Draw | Tool::Rectangle | Tool::Ellipse | Tool::Sector
            )
            && matches!(
                tool,
                Tool::Draw | Tool::Rectangle | Tool::Ellipse | Tool::Sector
            );
        self.authoring.board.clear_preview();
        self.authoring.draft.clear();
        self.authoring.tangents.clear();
        self.authoring.replace = replacing;
        self.authoring.drafting.line_panel = if tool == Tool::InternalLine {
            self.authoring
                .edge
                .as_ref()
                .map(|e| e.panel.clone())
                .or_else(|| self.authoring.selected.clone())
        } else {
            None
        };
        self.authoring.tool = tool;
        self.authoring.measure = Default::default();
        if tool == Tool::Inspect && self.prefs.workspace.mode == super::layout::ViewMode::Patterns {
            self.prefs.workspace.mode = super::layout::ViewMode::Split;
        }
        self.inspector_tab = super::chrome::InspectorTab::Piece;
        self.authoring.rotate = rotate;
        self.grab = None;
        self.drag_plane = None;
        if tool != Tool::Grab {
            self.playing = false;
            self.pending = false;
            self.generation += 1;
            if tool != Tool::Inspect {
                self.metrics = None;
            }
            self.status = if tool == Tool::Inspect {
                "Simulation paused · paint problem faces, then Export report"
            } else if tool == Tool::Place {
                "Selected panel laid flat · other panels retained"
            } else {
                "Edit mode · simulation paused"
            }
            .into();
        }
    }
    fn history_shortcuts(&mut self, ctx: &egui::Context) {
        if ctx.egui_wants_keyboard_input() || self.authoring.radial.blocked || self.quick.blocked {
            return;
        }
        if self.authoring.tool == Tool::Sew {
            self.sewing_shortcuts(ctx);
            if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
                self.authoring.ends.clear();
                self.authoring.sewing = Default::default();
            }
            if self.authoring.sewing.chain_mode
                && ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Enter))
            {
                self.authoring.sewing.active = 1 - self.authoring.sewing.active;
            }
        }
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::D)) {
            self.set_authoring_tool(Tool::Inspect, false);
        }
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::M)) {
            self.set_authoring_tool(Tool::Measure, false);
        }
        if ctx.input(|i| !i.modifiers.command && !i.modifiers.alt && i.key_pressed(egui::Key::R)) {
            self.set_authoring_tool(Tool::Place, true);
        }
        if ctx.input(|i| !i.modifiers.command && !i.modifiers.alt && i.key_pressed(egui::Key::G)) {
            self.set_authoring_tool(Tool::Place, false);
        }
        if matches!(self.authoring.tool, Tool::Edit | Tool::Sew)
            && ctx.input(|i| i.key_pressed(egui::Key::Delete))
        {
            let seams = self.edge_seams();
            if let Some(id) = self
                .authoring
                .selection
                .seam
                .clone()
                .filter(|id| seams.contains(id))
            {
                self.remove_seam(id);
            } else if seams.len() == 1 {
                self.remove_seam(seams[0].clone());
            }
        }
        if ctx.input(|i| i.modifiers.command && i.key_pressed(egui::Key::Z)) {
            if !self.authoring.board.freehand.samples.is_empty() {
                self.authoring.board.clear_preview();
                return;
            }
            if matches!(self.authoring.tool, Tool::Draw | Tool::InternalLine)
                && !self.authoring.draft.is_empty()
            {
                self.authoring.draft.pop();
                self.authoring.tangents.pop();
            } else {
                self.undo_edit(ctx.input(|i| i.modifiers.shift));
            }
        }
    }
    /// Target length of the selected boundary. The value is a specification in
    /// metres; the field edits millimetres and the readout shows the deviation
    /// from the measured material length. It is stored by `TargetLength` and is
    /// never enforced while loading a document.
    fn target_length_properties(
        &mut self,
        ui: &mut egui::Ui,
        panel: &marvelous_cloth::garment::template::Panel,
        polygon: &marvelous_cloth::garment::polygon::PolygonPattern,
    ) {
        let Some(name) = self
            .authoring
            .edge
            .as_ref()
            .filter(|edge| edge.panel == panel.id)
            .and_then(|edge| edge.edge.clone())
        else {
            return;
        };
        let Ok(measured) = authoring::edge_length(polygon, &name) else {
            return;
        };
        if self.authoring.target_edge.as_ref() != Some(&(panel.id.clone(), name.clone())) {
            self.authoring.target_edge = Some((panel.id.clone(), name.clone()));
            // A stored specification reloads as typed; without one the field
            // starts from the measured length.
            self.authoring.target_mm = polygon
                .target_length(&name)
                .map(authoring::m_to_mm)
                .unwrap_or_else(|| authoring::m_to_mm(measured));
        }
        ui.separator();
        ui.strong(format!("Boundary {name}"));
        ui.horizontal(|ui| {
            ui.label("Target");
            millimetre_field(ui, &mut self.authoring.target_mm);
        });
        let target_m = authoring::mm_to_m(self.authoring.target_mm);
        let deviation = authoring::deviation_mm(measured, target_m);
        ui.small(format!(
            "Measured {:.1} mm · deviation from target {:+.2} mm",
            authoring::m_to_mm(measured),
            deviation
        ));
        ui.horizontal(|ui| {
            if ui
                .button("Apply target")
                .on_hover_text("Store this required length and set the boundary to it")
                .clicked()
            {
                self.edit(Command::TargetLength {
                    panel: panel.id.clone(),
                    edge: name.clone(),
                    target_m,
                });
            }
            let stored = polygon.target_lengths.contains_key(&name);
            if ui
                .add_enabled(stored, egui::Button::new("Clear target"))
                .clicked()
            {
                self.edit(Command::TargetLength {
                    panel: panel.id.clone(),
                    edge: name.clone(),
                    target_m: 0.,
                });
            }
        });
    }
    pub(super) fn authoring_properties(&mut self, ui: &mut egui::Ui) {
        self.existing_seams(ui);
        if self.authoring.tool == Tool::Sew || !self.authoring.ends.is_empty() {
            self.sewing_controls(ui);
        }
        if let Some(error) = &self.authoring.error {
            ui.colored_label(Color32::LIGHT_RED, error);
        }
        self.edge_properties(ui);
        self.internal_line_properties(ui);
        ui.strong("Active panel");
        let Some(panel) = self
            .project
            .template
            .panels
            .iter()
            .find(|p| Some(&p.id) == self.authoring.selected.as_ref())
            .cloned()
        else {
            ui.small("Select a piece in the list or in a view. Pen / Rectangle to draw; Sew to assemble.");
            return;
        };
        ui.label(&panel.name);
        if let Some(fabric) = self
            .project
            .template
            .fabrics
            .iter()
            .find(|f| f.id == panel.fabric)
        {
            let label = format!(
                "{} · {:.0} g/m²",
                fabric.name,
                fabric.properties.density * 1000.
            );
            if ui
                .button(label)
                .on_hover_text("Open material, weight and stretch for this piece")
                .clicked()
            {
                self.inspector_tab = super::chrome::InspectorTab::Fabric;
            }
        }
        if let Some(range) = self.scene.garment.panels.iter().find(|p| p.id == panel.id) {
            let area: f64 = self.scene.garment.mesh.triangles[range.triangles.clone()]
                .iter()
                .map(|t| t.area)
                .sum();
            ui.small(format!(
                "Rest area {:.3} m² · {} triangles",
                area,
                range.triangles.len()
            ));
        }
        ui.small(format!(
            "{:.0} × {:.0} mm",
            panel.pattern.width * 1000.,
            panel.pattern.height * 1000.
        ));
        // Numeric entry stays in a draft until Apply, so one click is exactly one
        // document edit and one history entry. Millimetres convert by division:
        // 400 mm / 1000 is the exact f64 0.4, unlike a 0.001 multiplication.
        if self.authoring.numeric_panel.as_deref() != Some(panel.id.as_str()) {
            self.authoring.numeric_panel = Some(panel.id.clone());
            self.authoring.width_mm = panel.pattern.width * 1000.;
            self.authoring.height_mm = panel.pattern.height * 1000.;
            self.authoring.numeric_anchor = None;
        }
        ui.collapsing("Dimensions and points", |ui| {
            ui.strong("Dimensions (mm)");
            ui.horizontal_wrapped(|ui| {
                ui.label("Width");
                millimetre_field(ui, &mut self.authoring.width_mm);
                ui.label("Height");
                millimetre_field(ui, &mut self.authoring.height_mm);
            });
            if ui
                .button("Apply dimensions")
                .on_hover_text("Exact millimetre size; invalid values leave the document unchanged")
                .clicked()
            {
                self.edit(Command::Dimensions {
                    panel: panel.id.clone(),
                    width: authoring::mm_to_m(self.authoring.width_mm),
                    height: authoring::mm_to_m(self.authoring.height_mm),
                });
            }
            if let Some(polygon) = panel.polygon.as_ref() {
                if !polygon.target_diagnostics().is_empty() {
                    ui.colored_label(
                        Color32::GOLD,
                        "A stored target length is invalid and is ignored.",
                    );
                }
                if let Some(k) = self
                    .authoring
                    .anchor
                    .as_ref()
                    .filter(|(id, k)| id == &panel.id && *k < polygon.points.len())
                    .map(|(_, k)| *k)
                {
                    if self.authoring.numeric_anchor != Some(k) {
                        self.authoring.numeric_anchor = Some(k);
                        self.authoring.anchor_x_mm = authoring::m_to_mm(polygon.points[k].x);
                        self.authoring.anchor_y_mm = authoring::m_to_mm(polygon.points[k].y);
                    }
                    ui.strong(format!("Point {} (mm)", k + 1));
                    ui.horizontal_wrapped(|ui| {
                        ui.label("X");
                        millimetre_field(ui, &mut self.authoring.anchor_x_mm);
                        ui.label("Y");
                        millimetre_field(ui, &mut self.authoring.anchor_y_mm);
                    });
                    // Visible nudge buttons for discoverability. They dispatch the
                    // same `Command::Nudge` as the board's arrow keys, so the two
                    // paths cannot drift apart in behaviour.
                    for (label, steps) in [
                        (
                            "Nudge X",
                            [
                                ("-1", DVec2::new(-1., 0.)),
                                ("+1", DVec2::new(1., 0.)),
                                ("-10", DVec2::new(-10., 0.)),
                                ("+10", DVec2::new(10., 0.)),
                            ],
                        ),
                        (
                            "Nudge Y",
                            [
                                ("-1", DVec2::new(0., -1.)),
                                ("+1", DVec2::new(0., 1.)),
                                ("-10", DVec2::new(0., -10.)),
                                ("+10", DVec2::new(0., 10.)),
                            ],
                        ),
                    ] {
                        ui.horizontal_wrapped(|ui| {
                            ui.label(label);
                            for (step_label, step) in steps {
                                if ui.small_button(step_label).clicked() {
                                    self.edit(Command::Nudge {
                                        panel: panel.id.clone(),
                                        points: vec![k],
                                        delta_mm: step,
                                    });
                                }
                            }
                        });
                    }
                    if ui
                        .button("Apply point")
                        .on_hover_text(
                            "Material coordinates in millimetres; the rest origin is re-based \
                         without moving the other points",
                        )
                        .clicked()
                    {
                        let position = DVec2::new(
                            authoring::mm_to_m(self.authoring.anchor_x_mm),
                            authoring::mm_to_m(self.authoring.anchor_y_mm),
                        );
                        self.edit(Command::Anchor {
                            panel: panel.id.clone(),
                            anchor: k,
                            position,
                        });
                    }
                } else {
                    ui.small("Click a point on the 2D board to edit its exact position.");
                }
                self.target_length_properties(ui, &panel, polygon);
            }
        });
        if self.authoring.tool == Tool::Edit
            && let Some((_, k)) = self
                .authoring
                .anchor
                .as_ref()
                .filter(|(id, _)| id == &panel.id)
            && let Some(edge) = panel.polygon.as_ref().and_then(|poly| poly.edges.get(*k))
        {
            let target = ConstructionRef {
                panel: panel.id.clone(),
                edge: edge.clone(),
            };
            egui::CollapsingHeader::new(format!("Point {} · Construction", k+1)).default_open(true).show(ui, |ui| {
                let controls = construction_controls(ui, &mut self.authoring.construction, &self.project.template, &target);
                controls.field.on_hover_text("Signed millimetres; typing does not change the pattern");
                controls.apply.on_hover_text("Move this point only; invalid contours and incompatible seams are rejected");
                if let Some(command) = controls.command { self.edit(command); }
            });
        }
        self.drafting_properties(ui, &panel);
        ui.horizontal(|ui| {
            let duplicate = ui.button("Duplicate");
            self.smoke_target("duplicate", duplicate.rect.center());
            if duplicate.clicked() {
                self.edit(Command::Duplicate {
                    panel: panel.id.clone(),
                });
            }
            if ui.button("Delete panel").clicked() {
                self.edit(Command::RemovePanel {
                    panel: panel.id.clone(),
                });
            }
        });
        if self.authoring.tool != Tool::Place {
            ui.small("Move 3D (G) / Rotate 3D (R) in the toolbar.");
            return;
        }
        ui.horizontal(|ui| {
            if ui
                .selectable_label(!self.authoring.rotate, "Move (G)")
                .clicked()
            {
                self.set_authoring_tool(Tool::Place, false);
            }
            if ui
                .selectable_label(self.authoring.rotate, "Rotate (R)")
                .clicked()
            {
                self.set_authoring_tool(Tool::Place, true);
            }
        });
        ui.small("Flat placement: this piece takes the shape of its pattern. The other pieces stay in place.");
        let focus = ui.button("Frame the panel");
        self.smoke_target("focus", focus.rect.center());
        if focus.clicked() {
            let placement = self.authoring.preview.as_ref().unwrap_or(&panel.placement);
            self.camera.target = placement
                .transform(DVec3::new(
                    panel.pattern.width * 0.5,
                    -panel.pattern.height * 0.5,
                    0.,
                ))
                .as_vec3();
            self.camera.distance =
                (panel.pattern.width.max(panel.pattern.height) * 3.).max(1.) as f32;
        }
        let mut p = self.authoring.preview.clone().unwrap_or(panel.placement);
        let before = p.clone();
        let mut changed = false;
        for (label, value, speed, suffix) in [
            ("X", &mut p.translation.x, 0.005, " m"),
            ("Y", &mut p.translation.y, 0.005, " m"),
            ("Z", &mut p.translation.z, 0.005, " m"),
            ("RX", &mut p.rotation_degrees.x, 1., "°"),
            ("RY", &mut p.rotation_degrees.y, 1., "°"),
            ("RZ", &mut p.rotation_degrees.z, 1., "°"),
        ] {
            ui.horizontal(|ui| {
                ui.label(label);
                changed |= ui
                    .add(egui::DragValue::new(value).speed(speed).suffix(suffix))
                    .changed();
            });
        }
        if changed {
            // Numeric rotations use the same center pivot as the rings.
            let pivot = DVec3::new(panel.pattern.width * 0.5, -panel.pattern.height * 0.5, 0.);
            let rotated_pivot = p.transform(pivot) - p.translation;
            p.translation =
                before.transform(pivot) + (p.translation - before.translation) - rotated_pivot;
            self.preview_placement(p);
        }
        ui.horizontal(|ui| {
            if ui
                .add_enabled(self.authoring.preview.is_some(), egui::Button::new("Apply"))
                .clicked()
            {
                self.commit_placement();
            }
            if ui.button("Discard").clicked() {
                self.cancel_preview();
            }
        });
        ui.small("Drag an axis / ring · Shift: 15° angles · release: commit · Escape: cancel.");
        ui.separator();
    }
    pub(super) fn create_polygon(&mut self) {
        if matches!(self.authoring.tool, Tool::Ellipse | Tool::Sector)
            && self.authoring.draft.len() == 4
        {
            use marvelous_cloth::garment::shapes::Primitive;
            let command = Command::Primitive {
                kind: if self.authoring.tool == Tool::Ellipse {
                    Primitive::Ellipse
                } else {
                    Primitive::Sector
                },
                size: self.authoring.draft[2] - self.authoring.draft[0],
                origin: self.authoring.draft[0],
                sweep_degrees: self.authoring.drafting.sweep,
                meshing: MeshingSettings {
                    target_edge_m: self.mesh_mm * 0.001,
                    anisotropy: self.anisotropy,
                    axis_degrees: self.mesh_axis,
                    ..Default::default()
                },
                fabric: self.project.template.fabrics[0].id.clone(),
                replace: self.authoring.replace,
            };
            if self.edit(command) {
                self.authoring.draft.clear();
                self.authoring.tangents.clear();
                self.authoring.replace = false;
                self.authoring.tool = Tool::Place;
            }
            return;
        }
        let command = Command::Polygon {
            tangents: self.authoring.tangents.clone(),
            points: self.authoring.draft.clone(),
            meshing: MeshingSettings {
                target_edge_m: self.mesh_mm * 0.001,
                anisotropy: self.anisotropy,
                axis_degrees: self.mesh_axis,
                ..Default::default()
            },
            fabric: self.project.template.fabrics[0].id.clone(),
            replace: self.authoring.replace,
        };
        if self.edit(command) {
            self.authoring.draft.clear();
            self.authoring.tangents.clear();
            self.authoring.replace = false;
            self.authoring.tool = Tool::Place;
        }
    }
    pub(super) fn prepare_simulation(&mut self) -> bool {
        if !self.authoring.board.freehand.samples.is_empty() {
            self.status = "Create or cancel the freehand panel before simulating".into();
            return false;
        }
        if self.authoring.sewing.chain_mode
            && self.authoring.sewing.sides.iter().any(|s| !s.is_empty())
        {
            self.status = "Commit or cancel the multi-edge seam before simulating".into();
            return false;
        }
        if self.authoring.ends.len() == 2 && !self.commit_seam() {
            return false;
        }
        if !self.commit_placement() {
            return false;
        }
        self.authoring.tool = Tool::Grab;
        true
    }
}

#[cfg(test)]
mod construction_tests {
    use super::*;
    fn template() -> marvelous_cloth::garment::GarmentTemplate {
        use marvelous_cloth::garment::presets::{self, GarmentKind};
        authoring::apply(
            &presets::basic(GarmentKind::Tshirt, 0),
            Command::Polygon {
                points: vec![
                    DVec2::ZERO,
                    DVec2::new(0.4, 0.),
                    DVec2::new(0.4, 0.3),
                    DVec2::new(0., 0.3),
                ],
                tangents: vec![],
                meshing: MeshingSettings {
                    target_edge_m: 0.1,
                    ..Default::default()
                },
                fabric: "woven-reference".into(),
                replace: true,
            },
        )
        .unwrap()
        .template
    }
    fn frame(
        ctx: &egui::Context,
        draft: &mut ConstructionDraft,
        t: &marvelous_cloth::garment::GarmentTemplate,
        events: Vec<egui::Event>,
    ) -> (ConstructionControls, Vec<String>) {
        let target = ConstructionRef {
            panel: t.panels[0].id.clone(),
            edge: "edge_4".into(),
        };
        let mut controls = None;
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
                    controls = Some(construction_controls(ui, draft, t, &target));
                });
            },
        );
        let labels = output
            .shapes
            .iter()
            .filter_map(|s| {
                if let egui::Shape::Text(text) = &s.shape {
                    Some(text.galley.job.text.clone())
                } else {
                    None
                }
            })
            .collect();
        output.textures_delta.clear(); // This CPU input test has no texture backend.
        (controls.unwrap(), labels)
    }
    fn button(pos: egui::Pos2, pressed: bool) -> egui::Event {
        egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        }
    }
    #[test]
    fn construction_controls_show_units_and_dispatch_only_on_apply() {
        let t = template();
        let before = serde_json::to_vec(&t).unwrap();
        let ctx = egui::Context::default();
        let mut draft = ConstructionDraft {
            mode: 1,
            ..Default::default()
        };
        let (initial, labels) = frame(&ctx, &mut draft, &t, vec![]);
        assert!(initial.command.is_none());
        assert!(labels.iter().any(|s| s == "mm"));
        assert!(labels.iter().any(|s| s == "→ Reference"));
        assert!(labels.iter().any(|s| s == "● Proposed"));
        let at = initial.apply.rect.center();
        assert!(
            frame(
                &ctx,
                &mut draft,
                &t,
                vec![egui::Event::PointerMoved(at), button(at, true)]
            )
            .0
            .command
            .is_none()
        );
        let command = frame(&ctx, &mut draft, &t, vec![button(at, false)])
            .0
            .command
            .unwrap();
        assert!(
            matches!(command,Command::ConstructPoint {operation:PointConstruction::Distance(d),..} if d==0.05)
        );
        assert_eq!(serde_json::to_vec(&t).unwrap(), before);
        draft.value_mm = "NaN".into();
        let (invalid, _) = frame(&ctx, &mut draft, &t, vec![]);
        assert!(!invalid.apply.enabled());
        assert!(invalid.command.is_none());
    }
    #[test]
    fn construction_text_entry_owns_keyboard_and_does_not_apply() {
        let t = template();
        let ctx = egui::Context::default();
        let mut draft = ConstructionDraft {
            mode: 1,
            ..Default::default()
        };
        let (initial, _) = frame(&ctx, &mut draft, &t, vec![]);
        let at = initial.field.rect.center();
        frame(
            &ctx,
            &mut draft,
            &t,
            vec![egui::Event::PointerMoved(at), button(at, true)],
        );
        frame(&ctx, &mut draft, &t, vec![button(at, false)]);
        assert!(
            ctx.egui_wants_keyboard_input(),
            "Global editor shortcuts must yield to this field"
        );
        let (typed, _) = frame(&ctx, &mut draft, &t, vec![egui::Event::Text("g".into())]);
        assert!(draft.value_mm.contains('g'));
        assert!(typed.command.is_none());
        assert!(!typed.apply.enabled());
    }

    #[test]
    fn construction_diagram_tracks_rotated_board_geometry_and_stale_references() {
        let mut t = template();
        let target = ConstructionRef {
            panel: t.panels[0].id.clone(),
            edge: "edge_4".into(),
        };
        let reference = ConstructionRef {
            edge: "edge_1".into(),
            ..target.clone()
        };
        let operation = PointConstruction::Distance(0.05);
        let local = authoring::constructed_point(&t, &target, &reference, operation).unwrap();
        let initial = construction_preview_points(&t, &target, &reference, local).unwrap();
        let origin = authoring::layout(&t, 0);
        t.panels[0].layout_rotation_degrees = 90.;
        let local = authoring::constructed_point(&t, &target, &reference, operation).unwrap();
        let rotated = construction_preview_points(&t, &target, &reference, local).unwrap();
        let new_origin = authoring::layout(&t, 0);
        for (a, b) in initial.into_iter().zip(rotated) {
            assert!((b - (new_origin + authoring::rotate_2d(a - origin, 90.))).length() < 1e-12);
        }
        let missing = ConstructionRef {
            edge: "deleted".into(),
            ..reference
        };
        assert!(construction_preview_points(&t, &target, &missing, local).is_none());
    }
}
