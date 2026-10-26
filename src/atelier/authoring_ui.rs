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
    pub dart: Option<DartDraft>,
    pub construction: ConstructionDraft,
    pub sewing: super::sewing_ui::SewingDraft,
    pub sewing_audit: super::sewing_ui::SewingAuditUi,
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

/// Transient material-space draft; no mesh is compiled while typing or painting.
pub(super) struct DartDraft {
    panel: String,
    edge: String,
    position_mm: String,
    width_mm: String,
    depth_mm: String,
}

fn dart_edge(
    template: &marvelous_cloth::garment::GarmentTemplate,
    panel: &str,
    edge: &str,
) -> Result<[DVec2; 2], String> {
    let p = template
        .panels
        .iter()
        .find(|p| p.id == panel)
        .ok_or("Dart panel no longer exists")?;
    let poly = p.polygon.as_ref().ok_or("Select an editable polygon")?;
    let k = poly
        .edges
        .iter()
        .position(|e| e == edge)
        .ok_or("Dart boundary no longer exists")?;
    if poly.curves.contains_key(edge) || poly.target_lengths.contains_key(edge) {
        return Err("Choose a straight boundary without a target length".into());
    }
    if template.seams.iter().any(|s| {
        s.references()
            .any(|r| r.panel == panel && r.edge.as_deref() == Some(edge))
    }) {
        return Err("Choose an unsewn boundary (including sewing-chain segments)".into());
    }
    if template
        .mirror_links
        .iter()
        .any(|l| l.a == panel || l.b == panel)
    {
        return Err("Unlink the mirrored pair before cutting a dart".into());
    }
    if !poly.holes.is_empty() || !poly.lines.is_empty() {
        return Err("Darts on panels with holes or internal lines are not supported yet".into());
    }
    let points = [poly.points[k], poly.points[(k + 1) % poly.points.len()]];
    if points[0].distance(points[1]) < 0.02 {
        return Err("The source boundary must be at least 20 mm long".into());
    }
    Ok(points)
}

impl DartDraft {
    fn new(
        template: &marvelous_cloth::garment::GarmentTemplate,
        panel: String,
        edge: String,
    ) -> Result<Self, String> {
        let [a, b] = dart_edge(template, &panel, &edge)?;
        let length = a.distance(b) * 1000.;
        Ok(Self {
            panel,
            edge,
            position_mm: format!("{:.3}", length * 0.5),
            width_mm: format!("{:.3}", (length * 0.1).clamp(3., 20.)),
            depth_mm: "60".into(),
        })
    }

    pub(super) fn preview(
        &self,
        template: &marvelous_cloth::garment::GarmentTemplate,
    ) -> Result<[DVec2; 3], String> {
        let [a, b] = dart_edge(template, &self.panel, &self.edge)?;
        let parse = |s: &str| {
            s.trim()
                .parse::<f64>()
                .ok()
                .filter(|n| n.is_finite())
                .map(authoring::mm_to_m)
                .ok_or_else(|| "Enter finite dimensions in mm".to_owned())
        };
        let position = parse(&self.position_mm)?;
        let width = parse(&self.width_mm)?;
        let depth = parse(&self.depth_mm)?;
        if !(0.003..=0.15).contains(&width) || !(0.008..=0.5).contains(&depth) {
            return Err("Intake: 3–150 mm. Depth: 8–500 mm.".into());
        }
        let length = a.distance(b);
        let left_t = (position - width * 0.5) / length;
        let right_t = (position + width * 0.5) / length;
        if left_t <= 0.01 || right_t >= 0.99 || right_t - left_t < 0.005 {
            return Err("Keep the intake inside the boundary, beyond its 1% end margins".into());
        }
        let direction = (b - a) / length;
        let left = a.lerp(b, left_t);
        let right = a.lerp(b, right_t);
        let apex = (left + right) * 0.5 + DVec2::new(-direction.y, direction.x) * depth;
        Ok([left, apex, right])
    }

    fn command(
        &self,
        template: &marvelous_cloth::garment::GarmentTemplate,
    ) -> Result<Command, String> {
        let [left, apex, right] = self.preview(template)?;
        let [a, b] = dart_edge(template, &self.panel, &self.edge)?;
        Ok(Command::DartCutSew {
            panel: self.panel.clone(),
            edge: self.edge.clone(),
            left_t: a.distance(left) / a.distance(b),
            right_t: a.distance(right) / a.distance(b),
            apex,
        })
    }

    pub(super) fn panel(&self) -> &str {
        &self.panel
    }

    pub(super) fn matches_boundary(&self, selected: Option<&BoundaryRef>) -> bool {
        selected.is_some_and(|r| r.panel == self.panel && r.edge.as_deref() == Some(&self.edge))
    }

    pub(super) fn boundary_start(
        &self,
        template: &marvelous_cloth::garment::GarmentTemplate,
    ) -> Option<DVec2> {
        dart_edge(template, &self.panel, &self.edge)
            .ok()
            .map(|points| points[0])
    }
}

/// Real inspector controls, also exercised with the CPU egui event harness.
fn dart_controls(
    ui: &mut egui::Ui,
    draft: &mut Option<DartDraft>,
    template: &marvelous_cloth::garment::GarmentTemplate,
    selected: Option<(&str, &str)>,
) -> Option<Command> {
    if draft
        .as_ref()
        .is_some_and(|d| selected != Some((d.panel.as_str(), d.edge.as_str())))
    {
        *draft = None;
    }
    let (panel, edge) = selected?;
    let available = dart_edge(template, panel, edge);
    {
        // Retain this row while open so fields do not move after the opening click.
        let open = ui.add_enabled(
            available.is_ok() && draft.is_none(),
            egui::Button::new("Cut-and-sewn dart…"),
        );
        #[cfg(test)]
        super::authoring_smoke::widget_harness::named(ui, &open, "dart.open");
        let clicked = open.clicked();
        if let Err(reason) = available {
            open.on_disabled_hover_text(reason);
        }
        if clicked {
            *draft = DartDraft::new(template, panel.into(), edge.into()).ok();
        }
    }
    let d = draft.as_mut()?;
    for (id, label, value) in [
        ("position", "Center from edge start", &mut d.position_mm),
        ("width", "Intake width", &mut d.width_mm),
        ("depth", "Inward depth", &mut d.depth_mm),
    ] {
        ui.horizontal(|ui| {
            ui.label(label);
            let _field = ui.add(
                egui::TextEdit::singleline(value)
                    .id_salt(("dart", panel, edge, id))
                    .desired_width(65.),
            );
            ui.label("mm");
            #[cfg(test)]
            super::authoring_smoke::widget_harness::named(ui, &_field, format!("dart.{id}"));
            #[cfg(not(test))]
            let _ = id;
        });
    }
    let command = d.command(template);
    match &command {
        Ok(_) => {
            ui.small("Preview on the 2D board. Apply cuts away the triangle and sews its legs; the full contour is validated on Apply.");
        }
        Err(reason) => {
            ui.colored_label(Color32::GOLD, reason);
        }
    }
    let (apply, cancel) = ui
        .horizontal(|ui| {
            let apply = ui.add_enabled(command.is_ok(), egui::Button::new("Apply dart"));
            let cancel = ui.button("Cancel dart");
            #[cfg(test)]
            {
                super::authoring_smoke::widget_harness::named(ui, &apply, "dart.apply");
                super::authoring_smoke::widget_harness::named(ui, &cancel, "dart.cancel");
            }
            (apply.clicked(), cancel.clicked())
        })
        .inner;
    if cancel {
        *draft = None;
        return None;
    }
    apply.then(|| command.ok()).flatten()
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
    second_reference: Option<ConstructionRef>,
    mode: usize,
    value_mm: String,
}
impl Default for ConstructionDraft {
    fn default() -> Self {
        Self {
            reference: None,
            second_reference: None,
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

fn paint_construction_preview(ui: &mut egui::Ui, points: [DVec2; 4], second: Option<[DVec2; 2]>) {
    let all = points.iter().chain(second.iter().flatten());
    let min = all.clone().copied().fold(points[0], DVec2::min);
    let max = all.copied().fold(points[0], DVec2::max);
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
    if let Some(second) = second {
        let [c, d] = second.map(screen);
        let color = Color32::from_rgb(215, 150, 240);
        painter.line_segment([a, proposed], egui::Stroke::new(1., reference));
        painter.line_segment([c, proposed], egui::Stroke::new(1., color));
        painter.arrow(c, d - c, egui::Stroke::new(2., color));
    }
    painter.line_segment([current, proposed], egui::Stroke::new(1., Color32::GRAY));
    painter.circle_stroke(current, 5., egui::Stroke::new(2., Color32::GOLD));
    painter.circle_filled(proposed, 3., result);
    ui.horizontal_wrapped(|ui| {
        ui.colored_label(
            reference,
            if second.is_some() {
                "→ Reference A"
            } else {
                "→ Reference"
            },
        );
        if second.is_some() {
            ui.colored_label(Color32::from_rgb(215, 150, 240), "→ Reference B");
        }
        ui.colored_label(Color32::GOLD, "○ Current");
        ui.colored_label(result, "● Proposed");
    });
    ui.small("Auto-scaled board view · Apply still validates the contour and seams.");
}
fn construction_reference_selector(
    ui: &mut egui::Ui,
    slot: &str,
    label: &str,
    selected: &mut Option<ConstructionRef>,
    choices: &[(ConstructionRef, String)],
) {
    ui.label(label);
    let text = choices
        .iter()
        .find(|(r, _)| Some(r) == selected.as_ref())
        .map(|(_, label)| label.as_str())
        .unwrap_or("Choose a straight edge");
    let _combo = egui::ComboBox::from_id_salt(("construction-reference", slot))
        .selected_text(text)
        .width(220.)
        .show_ui(ui, |ui| {
            for (reference, label) in choices {
                let _response = ui.selectable_value(selected, Some(reference.clone()), label);
                if _response.clicked() {
                    ui.close();
                }
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(
                    ui,
                    &_response,
                    format!(
                        "construction.reference.{slot}.{}.{}",
                        reference.panel, reference.edge
                    ),
                );
            }
        });
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(
        ui,
        &_combo.response,
        format!("construction.reference.{slot}"),
    );
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
    construction_reference_selector(
        ui,
        "a",
        "Reference A · start → end",
        &mut draft.reference,
        &choices,
    );
    ui.horizontal_wrapped(|ui| {
        for (i, label) in ["Project", "Distance", "Perpendicular", "Intersection"]
            .iter()
            .enumerate()
        {
            let _response = ui.selectable_value(&mut draft.mode, i, *label);
            #[cfg(test)]
            super::authoring_smoke::widget_harness::named(
                ui,
                &_response,
                format!("construction.mode.{i}"),
            );
        }
    });
    if draft.mode == 3 {
        construction_reference_selector(
            ui,
            "b",
            "Reference B · start → end",
            &mut draft.second_reference,
            &choices,
        );
    }
    let field = ui
        .horizontal(|ui| {
            let response = ui.add_enabled(
                matches!(draft.mode, 1 | 2),
                egui::TextEdit::singleline(&mut draft.value_mm).desired_width(90.),
            );
            ui.label("mm");
            response
        })
        .inner;
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(ui, &field, "construction.value");
    ui.small(match draft.mode {
        0 => "Project onto the infinite line; endpoints do not clamp it.",
        1 => "Signed distance from the reference start toward its end.",
        3 => "Intersection of two infinite straight lines; not clamped to edge endpoints.",
        _ => "Offset from the projection; + follows a 90° turn in board coordinates.",
    });
    let operation = if draft.mode == 0 {
        Ok(PointConstruction::Project)
    } else if draft.mode == 3 {
        draft
            .second_reference
            .clone()
            .map(PointConstruction::Intersection)
            .ok_or_else(|| "Choose a straight second reference edge".to_owned())
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
                let second = (draft.mode == 3)
                    .then_some(draft.second_reference.as_ref())
                    .flatten()
                    .and_then(|reference| {
                        construction_preview_points(template, target, reference, *p)
                    })
                    .map(|p| [p[0], p[1]]);
                paint_construction_preview(ui, points, second);
            }
        }
        Err(error) => {
            ui.colored_label(Color32::GOLD, error);
        }
    }
    let apply = ui.add_enabled(preview.is_ok(), egui::Button::new("Apply construction"));
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(ui, &apply, "construction.apply");
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
    fn dart_properties(&mut self, ui: &mut egui::Ui) {
        if self.authoring.tool != Tool::Edit {
            self.authoring.dart = None;
            return;
        }
        let edge = self.authoring.edge.clone();
        let selected = edge
            .as_ref()
            .and_then(|e| e.edge.as_deref().map(|name| (e.panel.as_str(), name)));
        if self.authoring.dart.is_some()
            && ui.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        {
            self.authoring.dart = None;
        }
        if let Some(command) = dart_controls(
            ui,
            &mut self.authoring.dart,
            &self.project.template,
            selected,
        ) {
            self.edit(command);
        }
    }

    fn editor_transition(&mut self) -> EditorTransition<'_> {
        EditorTransition {
            authoring: &mut self.authoring,
            project: &mut self.project,
            scene: &mut self.scene,
            issue: &mut self.issue,
            dirty: &mut self.document.dirty,
            generation: &mut self.generation,
            playing: &mut self.playing,
            pending: &mut self.pending,
            metrics: &mut self.metrics,
            grab: &mut self.grab,
            drag_plane: &mut self.drag_plane,
            simulation_error: &mut self.simulation_error,
            status: &mut self.status,
            dt: self.settings.dt,
        }
    }
    pub(super) fn install_edit(&mut self, edit: Edit) {
        self.editor_transition().install(edit);
    }
    pub(super) fn edit(&mut self, command: Command) -> bool {
        match authoring::apply(&self.project.template, command) {
            Ok(edit) => {
                if edit.reset_simulation
                    && (!self.project.template.pin_targets.is_empty()
                        || !self.project.template.frozen_panels.is_empty()
                        || !edit.template.pin_targets.is_empty()
                        || !edit.template.frozen_panels.is_empty())
                    && let Err(error) = super::pins_ui::validate(
                        &edit,
                        &edit.state_after(&self.scene.garment, &self.scene.state),
                        Some(&self.scene.collider.surface),
                    )
                {
                    self.authoring.error = Some(error.clone());
                    self.status = error;
                    return false;
                }
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
        let previous = self.scene.garment.clone();
        let state = &self.scene.state;
        let avatar = &self.scene.collider.surface;
        let had_holds = !self.project.template.pin_targets.is_empty()
            || !self.project.template.frozen_panels.is_empty();
        match self
            .authoring
            .history
            .restore_checked(&self.project.template, redo, |edit| {
                if edit.reset_simulation
                    && (had_holds
                        || !edit.template.pin_targets.is_empty()
                        || !edit.template.frozen_panels.is_empty())
                {
                    super::pins_ui::validate(
                        edit,
                        &edit.state_after(&previous, state),
                        Some(avatar),
                    )?;
                }
                Ok(())
            }) {
            Ok(edit) => self.install_edit(edit),
            Err(e) => self.status = e,
        }
    }
    pub(super) fn cancel_preview(&mut self) {
        self.editor_transition().cancel_preview();
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
            if super::icons::icon_only(
                ui,
                super::icons::Icon::Grid,
                36.,
                self.template_browser_open(),
                "Templates · browse original examples or import a native template",
            )
            .clicked()
            {
                self.open_template_browser(ui.ctx());
            }
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
        self.authoring.dart = None;
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
        if self.template_browser_open() {
            return;
        }
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
            if self.authoring.dart.take().is_some() {
                return;
            }
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
        self.sewing_audit_controls(ui);
        if self.authoring.tool == Tool::Sew || !self.authoring.ends.is_empty() {
            self.sewing_controls(ui);
        }
        if let Some(error) = &self.authoring.error {
            ui.colored_label(Color32::LIGHT_RED, error);
        }
        self.edge_properties(ui);
        self.dart_properties(ui);
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
        self.pin_properties(ui, &panel);
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

/// Borrowed CPU state used by the real editor and headless transition fixtures.
/// Does not own or construct a viewport, device or simulation worker.
pub(super) struct EditorTransition<'a> {
    pub authoring: &'a mut AuthoringUi,
    pub project: &'a mut FittingProject,
    pub scene: &'a mut FittingScene,
    pub issue: &'a mut super::issue_ui::IssueUi,
    pub dirty: &'a mut bool,
    pub generation: &'a mut u64,
    pub playing: &'a mut bool,
    pub pending: &'a mut bool,
    pub metrics: &'a mut Option<VbdMetrics>,
    pub grab: &'a mut Option<Grab>,
    pub drag_plane: &'a mut Option<(DVec3, DVec3)>,
    pub simulation_error: &'a mut Option<String>,
    pub status: &'a mut String,
    pub dt: f64,
}
impl EditorTransition<'_> {
    pub(super) fn install(&mut self, edit: Edit) {
        self.authoring.dart = None;
        *self.simulation_error = None;
        *self.dirty = true;
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
        self.scene.next_dt = self.dt;
        *self.generation += 1;
        *self.playing = false;
        *self.pending = false;
        *self.metrics = None;
        *self.grab = None;
        *self.drag_plane = None;
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
        *self.status = if edit.reset_simulation {
            "Edit applied · unchanged panels retained · ready to simulate"
        } else {
            "2D layout changed · 3D state preserved"
        }
        .into();
    }
    pub(super) fn cancel_preview(&mut self) {
        if self.authoring.preview.take().is_some() {
            if let Some(state) = self.authoring.preview_state.take() {
                self.scene.state = state;
            }
            *self.generation += 1;
        }
        self.authoring.drag = None;
    }
}

#[cfg(test)]
mod construction_tests {
    use super::*;

    #[test]
    fn named_widgets_dart_minimum_inspector_width_keeps_fields_and_actions_visible() {
        use super::super::authoring_smoke::widget_harness::Harness;
        let template = template();
        let panel = &template.panels[0].id;
        let mut draft = None;
        let mut draw = |ui: &mut egui::Ui, draft: &mut Option<DartDraft>| {
            assert!(dart_controls(ui, draft, &template, Some((panel, "edge_1"))).is_none());
        };
        let mut h = Harness::new(Vec2::new(240., 650.));
        h.frame(&mut draft, &mut draw);
        h.click("dart.open", &mut draft, &mut draw).unwrap();
        for (name, value) in [("position", "200"), ("width", "20"), ("depth", "60")] {
            h.replace_text(&format!("dart.{name}"), value, &mut draft, &mut draw)
                .unwrap();
        }
        h.click("dart.cancel", &mut draft, &mut draw).unwrap();
        assert!(draft.is_none());
    }

    #[test]
    fn named_widgets_dart_preview_cancel_apply_history_and_reload() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            template: marvelous_cloth::garment::GarmentTemplate,
            panel: String,
            draft: Option<DartDraft>,
            history: History,
            applies: usize,
        }
        let t = template();
        let before = serde_json::to_string(&t).unwrap();
        let mut c = Case {
            panel: t.panels[0].id.clone(),
            template: t,
            draft: None,
            history: History::default(),
            applies: 0,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            if let Some(command) =
                dart_controls(ui, &mut c.draft, &c.template, Some((&c.panel, "edge_1")))
            {
                let edit = authoring::apply(&c.template, command).unwrap();
                assert!(edit.reset_simulation);
                c.history.record(c.template.clone());
                c.template = edit.template;
                c.draft = None;
                c.applies += 1;
            }
        };
        let mut h = Harness::new(Vec2::new(600., 650.));
        h.frame(&mut c, &mut draw);
        h.click("dart.open", &mut c, &mut draw).unwrap();
        h.replace_text("dart.position", "160", &mut c, &mut draw)
            .unwrap();
        h.replace_text("dart.width", "40", &mut c, &mut draw)
            .unwrap();
        h.replace_text("dart.depth", "80", &mut c, &mut draw)
            .unwrap();
        let preview = c.draft.as_ref().unwrap().preview(&c.template).unwrap();
        assert!(preview[0].distance(DVec2::new(0.14, 0.)) < 1e-12);
        assert!(preview[1].distance(DVec2::new(0.16, 0.08)) < 1e-12);
        h.key(
            "dart.depth",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.applies, 0);
        assert!(!c.history.can_undo());
        assert_eq!(serde_json::to_string(&c.template).unwrap(), before);
        h.click("dart.cancel", &mut c, &mut draw).unwrap();
        assert!(c.draft.is_none());
        assert_eq!(serde_json::to_string(&c.template).unwrap(), before);

        h.frame(&mut c, &mut draw);
        h.click("dart.open", &mut c, &mut draw).unwrap();
        h.replace_text("dart.depth", "NaN", &mut c, &mut draw)
            .unwrap();
        assert!(
            h.click("dart.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.replace_text("dart.depth", "80", &mut c, &mut draw)
            .unwrap();
        h.replace_text("dart.width", "40", &mut c, &mut draw)
            .unwrap();
        let before_mass: f64 = c.template.compile().unwrap().mesh.masses.iter().sum();
        h.click("dart.apply", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert_eq!(c.applies, 1);
        assert!(c.draft.is_none());
        assert_eq!(c.template.seams.len(), 1);
        assert!(c.template.seams[0].reverse_b);
        let after_mass: f64 = c.template.compile().unwrap().mesh.masses.iter().sum();
        assert!((after_mass / before_mass - (0.12 - 0.04 * 0.08 / 2.) / 0.12).abs() < 1e-10);
        let after = serde_json::to_string(&c.template).unwrap();
        let reloaded: marvelous_cloth::garment::GarmentTemplate =
            serde_json::from_str(&after).unwrap();
        reloaded.compile().unwrap();
        assert_eq!(serde_json::to_string(&reloaded).unwrap(), after);
        c.template = c.history.restore(&c.template, false).unwrap().template;
        assert_eq!(serde_json::to_string(&c.template).unwrap(), before);
        assert!(!c.history.can_undo());
        c.template = c.history.restore(&c.template, true).unwrap().template;
        assert_eq!(serde_json::to_string(&c.template).unwrap(), after);
    }

    #[test]
    fn dart_re_resolves_boundary_and_rejects_unsupported_geometry() {
        let mut t = template();
        let id = t.panels[0].id.clone();
        let mut draft = DartDraft::new(&t, id.clone(), "edge_1".into()).unwrap();
        draft.position_mm = "1".into();
        assert!(draft.preview(&t).is_err());
        draft.position_mm = "200".into();
        draft.depth_mm = "400".into();
        // Dimension-valid preview is not a claim that the whole contour is valid.
        let before = serde_json::to_string(&t).unwrap();
        assert!(authoring::apply(&t, draft.command(&t).unwrap()).is_err());
        assert_eq!(serde_json::to_string(&t).unwrap(), before);
        t.panels[0].polygon.as_mut().unwrap().edges[0] = "renamed".into();
        assert!(
            draft
                .command(&t)
                .err()
                .unwrap()
                .contains("no longer exists")
        );
        t.panels[0].polygon.as_mut().unwrap().edges[0] = "edge_1".into();
        t.panels[0]
            .polygon
            .as_mut()
            .unwrap()
            .target_lengths
            .insert("edge_1".into(), 0.4);
        assert!(draft.command(&t).err().unwrap().contains("target length"));
    }

    #[test]
    fn named_widgets_dart_selection_change_cancels_and_sewn_edge_disables_open() {
        use super::super::authoring_smoke::widget_harness::Harness;
        let mut t = template();
        let panel = t.panels[0].id.clone();
        let mut state = (None, Some("edge_1".to_owned()));
        let mut draw = |ui: &mut egui::Ui, state: &mut (Option<DartDraft>, Option<String>)| {
            assert!(
                dart_controls(
                    ui,
                    &mut state.0,
                    &t,
                    state.1.as_deref().map(|e| (panel.as_str(), e))
                )
                .is_none()
            );
        };
        let mut h = Harness::new(Vec2::new(600., 650.));
        h.frame(&mut state, &mut draw);
        h.click("dart.open", &mut state, &mut draw).unwrap();
        assert!(state.0.is_some());
        state.1 = Some("edge_2".into());
        h.frame(&mut state, &mut draw);
        assert!(state.0.is_none());
        assert!(h.click("dart.apply", &mut state, &mut draw).is_err());
        h.click("dart.open", &mut state, &mut draw).unwrap();
        state.1 = None;
        h.frame(&mut state, &mut draw);
        assert!(state.0.is_none());

        let draft = DartDraft::new(&t, panel.clone(), "edge_1".into()).unwrap();
        t = authoring::apply(&t, draft.command(&t).unwrap())
            .unwrap()
            .template;
        let leg = t.seams[0].a.edge.clone().unwrap();
        let mut draw = |ui: &mut egui::Ui, state: &mut (Option<DartDraft>, Option<String>)| {
            assert!(dart_controls(ui, &mut state.0, &t, Some((&panel, &leg))).is_none());
        };
        h.frame(&mut state, &mut draw);
        assert!(
            h.click("dart.open", &mut state, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
    }

    #[test]
    fn named_widgets_intersection_selects_edges_rejects_stale_and_applies_once() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            template: marvelous_cloth::garment::GarmentTemplate,
            target: ConstructionRef,
            draft: ConstructionDraft,
            history: History,
            applies: usize,
            error: Option<String>,
        }
        let mut template = template();
        let mut reference = template.panels[0].clone();
        reference.id = "reference".into();
        reference.name = "Reference".into();
        reference.layout_2d = Some(DVec2::splat(-0.05));
        template.panels.push(reference);
        let target = ConstructionRef {
            panel: template.panels[0].id.clone(),
            edge: "edge_1".into(),
        };
        let before = serde_json::to_vec(&template).unwrap();
        let mut c = Case {
            template,
            target,
            draft: Default::default(),
            history: Default::default(),
            applies: 0,
            error: None,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            if let Some(command) =
                construction_controls(ui, &mut c.draft, &c.template, &c.target).command
            {
                match authoring::apply(&c.template, command) {
                    Ok(edit) => {
                        c.history.record(c.template.clone());
                        c.template = edit.template;
                        c.applies += 1;
                        c.error = None;
                    }
                    Err(e) => c.error = Some(e),
                }
            }
        };
        let mut h = Harness::new(egui::vec2(650., 800.));
        h.frame(&mut c, &mut draw);
        h.click("construction.mode.3", &mut c, &mut draw).unwrap();
        assert!(
            h.click("construction.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.click("construction.reference.a", &mut c, &mut draw)
            .unwrap();
        h.frame(&mut c, &mut draw);
        h.click(
            "construction.reference.a.reference.edge_1",
            &mut c,
            &mut draw,
        )
        .unwrap();
        h.frame(&mut c, &mut draw);
        h.click("construction.reference.b", &mut c, &mut draw)
            .unwrap();
        h.frame(&mut c, &mut draw);
        h.click(
            "construction.reference.b.reference.edge_3",
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(
            h.click("construction.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.frame(&mut c, &mut draw);
        h.click("construction.reference.b", &mut c, &mut draw)
            .unwrap();
        h.frame(&mut c, &mut draw);
        h.click(
            "construction.reference.b.reference.edge_4",
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(serde_json::to_vec(&c.template).unwrap(), before);
        assert!(!c.history.can_undo());
        // External edits can invalidate either stable reference. No silent replacement.
        let reference = c.template.panels.pop().unwrap();
        h.frame(&mut c, &mut draw);
        assert!(
            h.click("construction.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        assert_eq!(
            c.draft.second_reference.as_ref().unwrap().panel,
            "reference"
        );
        c.template.panels.push(reference);
        c.template.panels[1]
            .polygon
            .as_mut()
            .unwrap()
            .curves
            .insert("edge_4".into(), [DVec2::ZERO, DVec2::ONE]);
        h.frame(&mut c, &mut draw);
        assert!(
            h.click("construction.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        c.template.panels[1]
            .polygon
            .as_mut()
            .unwrap()
            .curves
            .clear();
        // A finite preview is not an accepted edit: collapse of an edge is rejected.
        c.template.panels[1].layout_2d = Some(DVec2::new(0.4, 0.));
        let invalid_before = serde_json::to_vec(&c.template).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("construction.apply", &mut c, &mut draw).unwrap();
        assert!(c.error.is_some());
        assert_eq!(c.applies, 0);
        assert!(!c.history.can_undo());
        assert_eq!(serde_json::to_vec(&c.template).unwrap(), invalid_before);
        c.template.panels[1].layout_2d = Some(DVec2::splat(-0.05));
        h.frame(&mut c, &mut draw);
        h.click("construction.apply", &mut c, &mut draw).unwrap();
        assert_eq!(c.applies, 1);
        assert!(c.error.is_none());
        let panel = &c.template.panels[0];
        let corner = authoring::layout(&c.template, 0)
            + authoring::rotate_2d(
                panel.polygon.as_ref().unwrap().points[0],
                panel.layout_rotation_degrees,
            );
        assert!(corner.distance(DVec2::splat(-0.05)) < 1e-10);
        let undo = c.history.restore(&c.template, false).unwrap();
        assert_eq!(serde_json::to_vec(&undo.template).unwrap(), before);
        assert!(!c.history.can_undo());
    }

    #[test]
    fn named_widgets_construction_types_validates_applies_and_undoes() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            template: marvelous_cloth::garment::GarmentTemplate,
            target: ConstructionRef,
            draft: ConstructionDraft,
            history: History,
            applies: usize,
        }
        let template = template();
        let target = ConstructionRef {
            panel: template.panels[0].id.clone(),
            edge: "edge_4".into(),
        };
        let reference = ConstructionRef {
            edge: "edge_3".into(),
            ..target.clone()
        };
        let before = serde_json::to_string(&template).unwrap();
        let mut c = Case {
            template,
            target,
            draft: ConstructionDraft {
                reference: Some(reference),
                ..Default::default()
            },
            history: Default::default(),
            applies: 0,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            let controls = construction_controls(ui, &mut c.draft, &c.template, &c.target);
            if let Some(command) = controls.command {
                // Dispatch only the command actually emitted by the real Apply widget.
                let edit = authoring::apply(&c.template, command).unwrap();
                c.history.record(c.template.clone());
                c.template = edit.template;
                c.applies += 1;
            }
        };
        let mut h = Harness::new(Vec2::new(500., 650.));
        h.frame(&mut c, &mut draw);
        assert!(
            h.click("construction.value", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.click("construction.mode.1", &mut c, &mut draw).unwrap();
        h.replace_text("construction.value", "NaN", &mut c, &mut draw)
            .unwrap();
        assert!(
            h.click("construction.apply", &mut c, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        h.replace_text("construction.value", "100", &mut c, &mut draw)
            .unwrap();
        h.key(
            "construction.value",
            egui::Key::Enter,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.applies, 0);
        assert!(!c.history.can_undo());
        assert_eq!(serde_json::to_string(&c.template).unwrap(), before);
        h.click("construction.apply", &mut c, &mut draw).unwrap();
        assert_eq!(c.applies, 1);
        assert!(c.history.can_undo());
        assert_ne!(serde_json::to_string(&c.template).unwrap(), before);
        let undo = c.history.restore(&c.template, false).unwrap();
        assert_eq!(serde_json::to_string(&undo.template).unwrap(), before);
    }
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
        let local =
            authoring::constructed_point(&t, &target, &reference, operation.clone()).unwrap();
        let initial = construction_preview_points(&t, &target, &reference, local).unwrap();
        let origin = authoring::layout(&t, 0);
        t.panels[0].layout_rotation_degrees = 90.;
        let local =
            authoring::constructed_point(&t, &target, &reference, operation.clone()).unwrap();
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

#[cfg(test)]
mod transition_tests {
    use super::*;
    #[test]
    fn production_cancel_restore_and_install_reset_are_cpu_only() {
        let dir = tempfile::tempdir().unwrap();
        let avatar = dir.path().join("avatar.obj");
        std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
        let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
        let mut scene = project.compile().unwrap();
        for x in &mut scene.state.x {
            *x += DVec3::new(0.01, 0.02, 0.03);
        }
        scene.state.v.fill(DVec3::new(0.2, 0.3, 0.4));
        scene.state.time = 4.;
        let saved = scene.state.clone();
        let original = serde_json::to_vec(&project.template).unwrap();
        let mut authoring = AuthoringUi::default();
        let mut issue = super::super::issue_ui::IssueUi::default();
        let mut dirty = false;
        let mut generation = 12;
        let mut playing = false;
        let mut pending = true;
        let mut metrics = None;
        let mut grab = None;
        let mut plane = Some((DVec3::ZERO, DVec3::Y));
        let mut error = Some("old error".into());
        let mut status = String::new();
        let mut state = EditorTransition {
            authoring: &mut authoring,
            project: &mut project,
            scene: &mut scene,
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
            dt: 1. / 60.,
        };
        state.authoring.preview = Some(state.project.template.panels[0].placement.clone());
        state.authoring.preview_state = Some(saved.clone());
        state.scene.state.x.fill(DVec3::ZERO);
        state.cancel_preview();
        assert_eq!(state.scene.state.x, saved.x);
        assert_eq!(state.scene.state.v, saved.v);
        assert_eq!(state.scene.state.time, saved.time);
        assert_eq!(*state.generation, 13);
        assert!(!*state.dirty);
        assert!(state.authoring.preview_state.is_none());
        assert_eq!(
            serde_json::to_vec(&state.project.template).unwrap(),
            original
        );
        assert!(
            state
                .authoring
                .history
                .restore(&state.project.template, false)
                .is_err()
        );
        state.cancel_preview();
        assert_eq!(*state.generation, 13); // An idle cancel is a no-op.
        let command = Command::PlaceGroup {
            panels: state
                .project
                .template
                .panels
                .iter()
                .take(2)
                .map(|p| p.id.clone())
                .collect(),
            pivot: DVec3::new(0., 1., 0.),
            translation: DVec3::new(0.1, 0.05, 0.02),
            rotation: glam::DQuat::from_rotation_y(0.3),
        };
        let edit = authoring::apply(&state.project.template, command).unwrap();
        let expected = edit.state_after(&state.scene.garment, &state.scene.state);
        state
            .authoring
            .history
            .record(state.project.template.clone());
        state.install(edit);
        assert_eq!(state.scene.state.x, expected.x);
        assert_eq!(state.scene.state.v, expected.v);
        assert_eq!(state.scene.state.time, expected.time);
        assert_eq!(*state.generation, 14);
        let response = |generation| {
            Some(super::super::worker::Done {
                generation,
                had_grab: false,
                result: Err("test response".into()),
            })
        };
        assert!(super::super::current_worker_result(response(12), *state.generation).is_none());
        assert!(super::super::current_worker_result(response(13), *state.generation).is_none());
        assert!(super::super::current_worker_result(response(14), *state.generation).is_some());
        assert!(*state.dirty);
        assert!(!*state.playing && !*state.pending);
        assert!(state.simulation_error.is_none());
        assert!(state.drag_plane.is_none());
        assert!(state.project.state.is_none() && state.project.mesh_signature.is_none());
        assert!(!state.project.prearrange);
        assert_eq!(state.scene.next_dt, 1. / 60.);
        let undo = state
            .authoring
            .history
            .restore(&state.project.template, false)
            .unwrap();
        state.install(undo);
        assert_eq!(
            serde_json::to_vec(&state.project.template).unwrap(),
            original
        );
        assert_eq!(*state.generation, 15);
        assert!(super::super::current_worker_result(response(14), *state.generation).is_none());
        let unchanged = serde_json::to_vec(&state.project.template).unwrap();
        let invalid = authoring::apply(
            &state.project.template,
            Command::PlaceGroup {
                panels: vec!["missing-panel".into()],
                pivot: DVec3::ZERO,
                translation: DVec3::X,
                rotation: glam::DQuat::IDENTITY,
            },
        );
        assert!(invalid.is_err());
        assert_eq!(*state.generation, 15);
        assert_eq!(
            serde_json::to_vec(&state.project.template).unwrap(),
            unchanged
        );
        let old_mesh = state.scene.garment.clone();
        let old_state = state.scene.state.clone();
        let layout = authoring::apply(
            &state.project.template,
            Command::BoardTransform {
                panel: state.project.template.panels[0].id.clone(),
                origin: DVec2::new(2., 3.),
                rotation_degrees: 37.,
            },
        )
        .unwrap();
        assert!(!layout.reset_simulation);
        state.install(layout);
        assert!(std::sync::Arc::ptr_eq(&old_mesh, &state.scene.garment));
        assert_eq!(state.scene.state.x, old_state.x);
        assert_eq!(state.scene.state.v, old_state.v);
        assert_eq!(state.scene.state.time, old_state.time);
        assert_eq!(*state.generation, 16);
    }
}
