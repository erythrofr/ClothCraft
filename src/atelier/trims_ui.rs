//! Native inspector drafts for nonphysical construction trims.
use super::*;
use glam::DVec2;
use marvelous_cloth::authoring::{self, Command};
use marvelous_cloth::garment::{
    template::Panel,
    trims::{Trim, TrimKind},
};

#[derive(Default)]
pub(super) struct TrimUi {
    draft: Option<TrimDraft>,
    kind: usize,
    preview: Option<TrimPreview>,
    preview_error: Option<(
        std::sync::Arc<marvelous_cloth::garment::CompiledGarment>,
        Vec<Trim>,
        String,
    )>,
    preview_warning: Option<String>,
}

struct TrimPreview {
    garment: std::sync::Arc<marvelous_cloth::garment::CompiledGarment>,
    trims: Vec<Trim>,
    paths: Vec<(
        bool,
        Vec<marvelous_cloth::garment::embedding::EmbeddedPoint>,
    )>,
    skipped: usize,
}

struct TrimDraft {
    panel: String,
    id: String,
    kind: usize,
    points: String,
    width: String,
    rows: String,
    place_on_board: bool,
    original: Option<Trim>,
    base: Option<Trim>,
}

fn label(kind: &TrimKind) -> &'static str {
    match kind {
        TrimKind::Button { .. } => "Button",
        TrimKind::Buttonhole { .. } => "Buttonhole",
        TrimKind::Zipper { .. } => "Zipper",
        TrimKind::Topstitch { .. } => "Topstitch",
    }
}

/// Draw a bounded center-line preview on the drafting board. Coordinates are
/// transformed by the owning panel's presentation, never by the cloth state.
pub(super) fn paint_trim_2d(
    painter: &egui::Painter,
    point: &impl Fn(DVec2) -> egui::Pos2,
    trim: &Trim,
    budget: &mut usize,
    color: Color32,
) {
    let (points, diameter) = match &trim.kind {
        TrimKind::Button {
            center_m,
            diameter_m,
        } => (vec![*center_m], Some(*diameter_m)),
        TrimKind::Buttonhole { start_m, end_m, .. } => (vec![*start_m, *end_m], None),
        TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
            (path_m.clone(), None)
        }
    };
    if points.len() > *budget {
        *budget = 0;
        return;
    }
    *budget -= points.len();
    if let Some(diameter) = diameter {
        let p = point(points[0]);
        let radius = p
            .distance(point(points[0] + DVec2::X * (diameter * 0.5)))
            .clamp(2., 100.);
        painter.circle_stroke(p, radius, Stroke::new(1.5, color));
        painter.circle_filled(p, 2., color);
    } else {
        for pair in points.windows(2) {
            painter.line_segment([point(pair[0]), point(pair[1])], Stroke::new(2., color));
        }
    }
}

fn points_text(points: &[DVec2]) -> String {
    points
        .iter()
        .map(|p| format!("{}, {}", p.x * 1000., p.y * 1000.))
        .collect::<Vec<_>>()
        .join("\n")
}

impl TrimDraft {
    fn from_trim(trim: &Trim) -> Self {
        let (kind, points, width, rows) = match &trim.kind {
            TrimKind::Button {
                center_m,
                diameter_m,
            } => (0, vec![*center_m], *diameter_m, 1),
            TrimKind::Buttonhole {
                start_m,
                end_m,
                width_m,
            } => (1, vec![*start_m, *end_m], *width_m, 1),
            TrimKind::Zipper { path_m, width_m } => (2, path_m.clone(), *width_m, 1),
            TrimKind::Topstitch {
                path_m,
                rows,
                spacing_m,
            } => (3, path_m.clone(), *spacing_m, *rows),
        };
        Self {
            panel: trim.panel_id.clone(),
            id: trim.id.clone(),
            kind,
            points: points_text(&points),
            width: (width * 1000.).to_string(),
            rows: rows.to_string(),
            place_on_board: false,
            original: Some(trim.clone()),
            base: Some(trim.clone()),
        }
    }

    fn parse(&self) -> Result<Trim, String> {
        if let Some(original) = &self.original {
            let initial = Self::from_trim(original);
            if self.panel == initial.panel
                && self.id == initial.id
                && self.kind == initial.kind
                && self.points == initial.points
                && self.width == initial.width
                && self.rows == initial.rows
            {
                return Ok(original.clone());
            }
        }
        if self.points.len() > 32_768 {
            return Err("Path text is too long".into());
        }
        let points = self
            .points
            .lines()
            .map(|line| {
                let (x, y) = line.split_once(',').ok_or("Use one X, Y pair per line")?;
                let x = x
                    .trim()
                    .parse::<f64>()
                    .map_err(|_| "Enter finite X coordinates in mm")?
                    / 1000.;
                let y = y
                    .trim()
                    .parse::<f64>()
                    .map_err(|_| "Enter finite Y coordinates in mm")?
                    / 1000.;
                Ok(DVec2::new(x, y))
            })
            .collect::<Result<Vec<_>, &str>>()
            .map_err(str::to_owned)?;
        let width = self
            .width
            .trim()
            .parse::<f64>()
            .map_err(|_| "Enter a finite size in mm")?
            / 1000.;
        let kind = match self.kind {
            0 if points.len() == 1 => TrimKind::Button {
                center_m: points[0],
                diameter_m: width,
            },
            1 if points.len() == 2 => TrimKind::Buttonhole {
                start_m: points[0],
                end_m: points[1],
                width_m: width,
            },
            2 => TrimKind::Zipper {
                path_m: points,
                width_m: width,
            },
            3 => TrimKind::Topstitch {
                path_m: points,
                rows: self.rows.trim().parse().map_err(|_| "Enter 1–8 rows")?,
                spacing_m: width,
            },
            _ => return Err("Button needs one point; buttonhole needs two".into()),
        };
        let trim = Trim {
            id: self.id.clone(),
            panel_id: self.panel.clone(),
            kind,
        };
        trim.validate()?;
        Ok(trim)
    }
}

fn next_id(items: &[Trim]) -> String {
    (1..)
        .map(|i| format!("trim_{i}"))
        .find(|id| items.iter().all(|t| &t.id != id))
        .unwrap()
}

fn check_draft_revision(
    draft: &TrimDraft,
    template: &marvelous_cloth::garment::GarmentTemplate,
) -> Result<(), String> {
    let current = template.trims.iter().find(|trim| trim.id == draft.id);
    if current != draft.base.as_ref() {
        return Err("Trim changed or was removed while editing; cancel and select it again".into());
    }
    Ok(())
}

fn translate_first_point(mut trim: Trim, local: DVec2) -> Result<Trim, String> {
    trim.validate()?;
    let first = match &trim.kind {
        TrimKind::Button { center_m, .. } => *center_m,
        TrimKind::Buttonhole { start_m, .. } => *start_m,
        TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => path_m[0],
    };
    let delta = local - first;
    match &mut trim.kind {
        TrimKind::Button { center_m, .. } => *center_m += delta,
        TrimKind::Buttonhole { start_m, end_m, .. } => {
            *start_m += delta;
            *end_m += delta;
        }
        TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
            for p in path_m {
                *p += delta;
            }
        }
    }
    trim.validate()?;
    Ok(trim)
}

/// Refuse invalid surface paths and bound the quadratic worst case of the
/// current embedding implementation. This runs on Apply, never per frame.
fn validate_surface(
    trim: &Trim,
    garment: &marvelous_cloth::garment::CompiledGarment,
) -> Result<(), String> {
    use marvelous_cloth::garment::embedding::MaterialPath;
    let range = garment
        .panels
        .iter()
        .find(|p| p.id == trim.panel_id)
        .ok_or("Panel no longer exists")?;
    let points = match &trim.kind {
        TrimKind::Button { center_m, .. } => {
            garment.embed_point(&trim.panel_id, *center_m)?;
            return Ok(());
        }
        TrimKind::Buttonhole { start_m, end_m, .. } => vec![*start_m, *end_m],
        TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => path_m.clone(),
    };
    let n = range.triangles.len();
    let budget = n
        .saturating_mul(n)
        .saturating_mul(points.len().saturating_sub(1));
    if budget > 8_000_000 {
        return Err(
            "Path is too complex for surface preview; simplify it or use a coarser mesh".into(),
        );
    }
    garment.embed_path(&MaterialPath {
        panel: trim.panel_id.clone(),
        points,
    })?;
    Ok(())
}

fn build_preview(
    garment: std::sync::Arc<marvelous_cloth::garment::CompiledGarment>,
    trims: &[Trim],
) -> Result<TrimPreview, String> {
    use marvelous_cloth::garment::embedding::MaterialPath;
    if trims.len() > 128 {
        return Err("3D trim preview is limited to 128 objects".into());
    }
    let mut work = 0usize;
    let mut paths = Vec::with_capacity(trims.len());
    let mut count = 0usize;
    let mut skipped = 0usize;
    for trim in trims {
        let Some(n) = garment
            .panels
            .iter()
            .find(|p| p.id == trim.panel_id)
            .map(|p| p.triangles.len())
        else {
            skipped += 1;
            continue;
        };
        let (button, points) = match &trim.kind {
            TrimKind::Button { center_m, .. } => (true, vec![*center_m]),
            TrimKind::Buttonhole { start_m, end_m, .. } => (false, vec![*start_m, *end_m]),
            TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
                (false, path_m.clone())
            }
        };
        let cost = if button {
            n
        } else {
            n.saturating_mul(n)
                .saturating_mul(points.len().saturating_sub(1))
        };
        if work.saturating_add(cost) > 8_000_000 {
            skipped += 1;
            continue;
        }
        work += cost;
        let embedded = if button {
            garment
                .embed_point(&trim.panel_id, points[0])
                .map(|p| vec![p])
        } else {
            garment.embed_path(&MaterialPath {
                panel: trim.panel_id.clone(),
                points,
            })
        };
        let Ok(embedded) = embedded else {
            skipped += 1;
            continue;
        };
        if count.saturating_add(embedded.len()) > 128 {
            skipped += 1;
            continue;
        }
        count += embedded.len();
        paths.push((button, embedded));
    }
    Ok(TrimPreview {
        garment,
        trims: trims.to_vec(),
        paths,
        skipped,
    })
}

impl TrimUi {
    fn refresh_preview(
        &mut self,
        garment: &std::sync::Arc<marvelous_cloth::garment::CompiledGarment>,
        trims: &[Trim],
    ) {
        if trims.is_empty() {
            self.preview = None;
            self.preview_error = None;
            self.preview_warning = None;
            return;
        }
        let input_points: usize = trims
            .iter()
            .map(|t| match &t.kind {
                TrimKind::Button { .. } => 1,
                TrimKind::Buttonhole { .. } => 2,
                TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
                    path_m.len()
                }
            })
            .sum();
        if trims.len() > 128 || input_points > 4096 {
            self.preview = None;
            self.preview_error = None;
            self.preview_warning = Some("3D trim preview exceeds the object or point limit".into());
            return;
        }
        let reusable = self.preview.as_ref().is_some_and(|p| {
            std::sync::Arc::ptr_eq(&p.garment, garment) && p.trims.as_slice() == trims
        });
        if !reusable {
            if let Some((old_garment, old, error)) = &self.preview_error
                && std::sync::Arc::ptr_eq(old_garment, garment)
                && old.as_slice() == trims
            {
                self.preview_warning = Some(error.clone());
                return;
            }
            match build_preview(garment.clone(), trims) {
                Ok(preview) => {
                    self.preview = Some(preview);
                    self.preview_error = None;
                    self.preview_warning = None;
                }
                Err(error) => {
                    self.preview = None;
                    self.preview_error = Some((garment.clone(), trims.to_vec(), error.clone()));
                    self.preview_warning = Some(error);
                }
            }
        }
    }
}

impl Atelier {
    pub(super) fn trim_draft_preview(&self, panel: &str) -> Option<Trim> {
        self.authoring
            .trims
            .draft
            .as_ref()
            .filter(|d| d.panel == panel)
            .and_then(|d| d.parse().ok())
    }
    pub(super) fn paint_trims_3d(&mut self, ui: &egui::Ui, rect: egui::Rect) {
        self.authoring
            .trims
            .refresh_preview(&self.scene.garment, &self.project.template.trims);
        let Some(preview) = self.authoring.trims.preview.as_ref() else {
            return;
        };
        let triangle_count = self.scene.garment.mesh.triangles.len();
        let points: usize = preview.paths.iter().map(|(_, p)| p.len()).sum();
        if points.saturating_mul(3).saturating_mul(triangle_count) > 200_000 {
            self.authoring.trims.preview_warning =
                Some("3D trim preview hidden to limit visibility-test cost".into());
            return;
        }
        self.authoring.trims.preview_warning = (preview.skipped > 0).then(|| {
            format!(
                "{} trims hidden in 3D: outside the panel or preview budget",
                preview.skipped
            )
        });
        let painter = ui.painter().with_clip_rect(rect);
        let matrix = self.camera.matrix(rect.width() / rect.height());
        let project = |p| super::gizmo::project_matrix(matrix, rect, p);
        let visible = |world: glam::DVec3| -> Option<egui::Pos2> {
            let screen = project(world)?;
            let (origin, direction) = self.camera.ray(screen, rect);
            let distance = world.distance(origin) - 0.0001;
            if distance <= 0.
                || self
                    .scene
                    .collider
                    .occludes_ray(origin, direction, distance)
            {
                return None;
            }
            if self.scene.garment.mesh.triangles.iter().any(|t| {
                picking::ray_triangle(origin, direction, t.vertices.map(|i| self.scene.state.x[i]))
                    .is_some_and(|(d, _)| d < distance)
            }) {
                return None;
            }
            Some(screen)
        };
        let color = Color32::from_rgb(0xEA, 0x78, 0xD4);
        for (button, embedded) in &preview.paths {
            let world: Vec<_> = embedded
                .iter()
                .map(|p| p.evaluate(&self.scene.state.x).ok())
                .collect();
            if *button {
                if let Some(screen) = world.first().copied().flatten().and_then(visible) {
                    painter.circle_filled(screen, 4., color);
                }
            } else {
                for pair in world.windows(2) {
                    let (Some(first), Some(second)) = (pair[0], pair[1]) else {
                        continue;
                    };
                    if let (Some(a), Some(b), Some(_)) = (
                        visible(first),
                        visible(second),
                        visible((first + second) * 0.5),
                    ) {
                        painter.line_segment([a, b], Stroke::new(2., color));
                    }
                }
            }
        }
    }
}

fn trim_controls(
    ui: &mut egui::Ui,
    state: &mut TrimUi,
    template: &marvelous_cloth::garment::GarmentTemplate,
    panel: &Panel,
) -> Option<Command> {
    if state.draft.as_ref().is_some_and(|d| d.panel != panel.id) {
        state.draft = None;
    }
    let mut command = None;
    let section = egui::CollapsingHeader::new("Construction trims")
        .open(state.draft.as_ref().map(|_| true))
        .show(ui, |ui| {
            ui.small("Visual construction notes · no physical closures. Paths preview their center line; widths may extend outside the panel.");
            if let Some(warning) = &state.preview_warning { ui.colored_label(Color32::GOLD, warning); }
        let editing = state.draft.is_some();
            for trim in template.trims
                .iter()
                .filter(|t| t.panel_id == panel.id)
            {
                ui.horizontal(|ui| {
                let edit = ui.add_enabled(!editing, egui::Button::new(format!("{} · {}", label(&trim.kind), trim.id)).small());
                    #[cfg(test)]
                    super::authoring_smoke::widget_harness::named(ui, &edit, format!("trim.edit.{}", trim.id));
                    if edit.clicked() {
                        state.draft = Some(TrimDraft::from_trim(trim));
                    }
                let delete = ui.add_enabled(!editing, egui::Button::new("Delete").small());
                    #[cfg(test)]
                    super::authoring_smoke::widget_harness::named(ui, &delete, format!("trim.delete.{}", trim.id));
                    if delete.clicked() {
                        command = Some(Command::RemoveTrim {
                            id: trim.id.clone(),
                        });
                    }
                });
            }
            ui.horizontal(|ui| {
                let kinds = egui::ComboBox::from_id_salt("trim-kind")
                    .selected_text(
                        ["Button", "Buttonhole", "Zipper", "Topstitch"][state.kind],
                    )
                    .show_ui(ui, |ui| {
                        for (i, name) in ["Button", "Buttonhole", "Zipper", "Topstitch"]
                            .iter()
                            .enumerate()
                        {
                            let item = ui.selectable_value(&mut state.kind, i, *name);
                            #[cfg(test)]
                            super::authoring_smoke::widget_harness::named(ui, &item, format!("trim.kind.{i}"));
                            #[cfg(not(test))]
                            let _ = item;
                        }
                    });
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &kinds.response, "trim.kind");
                #[cfg(not(test))]
                let _ = kinds;
            let new = ui.add_enabled(!editing, egui::Button::new("New"));
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &new, "trim.new");
                if new.clicked() {
                    let center = DVec2::new(panel.pattern.width, panel.pattern.height) * 0.5;
                    let kind = state.kind;
                    let points = if kind == 0 {
                        vec![center]
                    } else {
                        vec![center - DVec2::X * 0.02, center + DVec2::X * 0.02]
                    };
                    state.draft = Some(TrimDraft {
                        panel: panel.id.clone(),
                        id: next_id(&template.trims),
                        kind,
                        points: points_text(&points),
                        width: if kind == 0 { "18" } else { "4" }.into(),
                        rows: "1".into(),
                        place_on_board: false,
                        original: None,
                        base: None,
                    });
                }
            });
            if let Some(draft) = state.draft.as_mut() {
                ui.label("Material X, Y (mm) · one point per line");
                let points = ui.add(
                    egui::TextEdit::multiline(&mut draft.points).desired_rows(if draft.kind == 0 {
                        1
                    } else {
                        3
                    }),
                );
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &points, "trim.points");
                #[cfg(not(test))]
                let _ = points;
                ui.horizontal(|ui| {
                    ui.label(if draft.kind == 0 {
                        "Diameter (mm)"
                    } else if draft.kind == 3 {
                        "Row spacing (mm)"
                    } else {
                        "Width (mm)"
                    });
                    let width = ui.text_edit_singleline(&mut draft.width);
                    #[cfg(test)]
                    super::authoring_smoke::widget_harness::named(ui, &width, "trim.width");
                    #[cfg(not(test))]
                    let _ = width;
                });
                if draft.kind == 3 {
                    ui.horizontal(|ui| {
                        ui.label("Rows");
                        ui.text_edit_singleline(&mut draft.rows);
                    });
                }
                let place = ui.button("Position first point on 2D board");
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &place, "trim.place");
                if place.clicked() {
                    draft.place_on_board = true;
                }
                if draft.place_on_board { ui.small("Click the panel to position the first point · Escape cancels"); }
                let parsed = draft.parse();
                if let Err(error) = &parsed {
                    ui.colored_label(Color32::GOLD, error);
                }
                ui.horizontal(|ui| {
                    let apply = ui.add_enabled(parsed.is_ok(), egui::Button::new("Apply"));
                    #[cfg(test)]
                    super::authoring_smoke::widget_harness::named(ui, &apply, "trim.apply");
                    if apply.clicked() {
                        command = parsed.ok().map(|trim| Command::SetTrim { trim });
                    }
                    let cancel = ui.button("Cancel");
                    #[cfg(test)]
                    super::authoring_smoke::widget_harness::named(ui, &cancel, "trim.cancel");
                    if cancel.clicked() {
                        state.draft = None;
                    }
                });
            }
        });
    #[cfg(test)]
    super::authoring_smoke::widget_harness::named(ui, &section.header_response, "trim.section");
    #[cfg(not(test))]
    let _ = section;
    command
}

impl Atelier {
    pub(super) fn trim_properties(&mut self, ui: &mut egui::Ui, panel: &Panel) {
        let command = trim_controls(ui, &mut self.authoring.trims, &self.project.template, panel);
        if let Some(command) = command {
            if matches!(&command, Command::SetTrim { .. })
                && let Some(draft) = self.authoring.trims.draft.as_ref()
                && let Err(error) = check_draft_revision(draft, &self.project.template)
            {
                self.authoring.error = Some(error.clone());
                self.status = error;
                return;
            }
            if let Command::SetTrim { trim } = &command
                && let Err(error) = validate_surface(trim, &self.scene.garment)
            {
                self.authoring.error = Some(error.clone());
                self.status = error;
                return;
            }
            if let Command::SetTrim { trim } = &command
                && self.project.template.trims.iter().any(|old| old == trim)
            {
                self.authoring.trims.draft = None;
                self.status = "Trim unchanged".into();
                return;
            }
            if self.edit(command) {
                self.authoring.trims.draft = None;
            }
        }
    }
}

impl Atelier {
    pub(super) fn pick_trim_on_board(&mut self, rect: egui::Rect, screen: egui::Pos2) -> bool {
        if self.authoring.tool != super::authoring_ui::Tool::Edit
            || self.authoring.trims.draft.is_some()
        {
            return false;
        }
        let Some(owner) = self.board_panel_at(rect, screen) else {
            return false;
        };
        let mut best: Option<(f32, Trim)> = None;
        let mut remaining = 4096usize;
        for trim in &self.project.template.trims {
            if trim.panel_id != owner {
                continue;
            }
            let Some(index) = self
                .project
                .template
                .panels
                .iter()
                .position(|p| p.id == trim.panel_id)
            else {
                continue;
            };
            let points = match &trim.kind {
                TrimKind::Button { center_m, .. } => vec![*center_m],
                TrimKind::Buttonhole { start_m, end_m, .. } => vec![*start_m, *end_m],
                TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
                    path_m.clone()
                }
            };
            if points.len() > remaining {
                break;
            }
            remaining -= points.len();
            let origin = self.board_origin(index);
            let angle = self.board_angle(index);
            let screen_point = |p| {
                self.authoring
                    .board
                    .screen(rect, origin + authoring::rotate_2d(p, angle))
            };
            let distance = if points.len() == 1 {
                screen.distance(screen_point(points[0]))
            } else {
                points
                    .windows(2)
                    .map(|p| {
                        super::authoring_ui::segment_distance(
                            screen,
                            screen_point(p[0]),
                            screen_point(p[1]),
                        )
                    })
                    .fold(f32::INFINITY, f32::min)
            };
            if distance <= 8. && best.as_ref().is_none_or(|(old, _)| distance < *old) {
                best = Some((distance, trim.clone()));
            }
        }
        let Some((_, trim)) = best else { return false };
        self.select_panel(trim.panel_id.clone(), false);
        self.authoring.trims.draft = Some(TrimDraft::from_trim(&trim));
        self.status = format!("Selected {} · {}", label(&trim.kind), trim.id);
        true
    }

    pub(super) fn trim_board_placement_active(&self) -> bool {
        self.authoring
            .trims
            .draft
            .as_ref()
            .is_some_and(|d| d.place_on_board)
    }

    /// A board click moves the entire draft without committing an edit.
    pub(super) fn place_trim_on_board(&mut self, rect: egui::Rect, screen: egui::Pos2) -> bool {
        if !self.trim_board_placement_active() {
            return false;
        }
        let Some(draft) = self.authoring.trims.draft.as_ref() else {
            return false;
        };
        if self.board_panel_at(rect, screen) != Some(draft.panel.as_str()) {
            self.status = "Click the trim's panel to position it".into();
            return true;
        }
        let Some(index) = self
            .project
            .template
            .panels
            .iter()
            .position(|p| p.id == draft.panel)
        else {
            self.authoring.trims.draft = None;
            return true;
        };
        let local = authoring::rotate_2d(
            self.authoring.board.world(rect, screen) - self.board_origin(index),
            -self.board_angle(index),
        );
        let result = draft
            .parse()
            .and_then(|trim| translate_first_point(trim, local));
        match result {
            Ok(trim) => {
                let base = self
                    .authoring
                    .trims
                    .draft
                    .as_ref()
                    .and_then(|d| d.base.clone());
                let mut next = TrimDraft::from_trim(&trim);
                next.base = base;
                self.authoring.trims.draft = Some(next);
            }
            Err(error) => {
                self.authoring.error = Some(error.clone());
                self.status = error;
            }
        }
        true
    }

    pub(super) fn cancel_trim_board_placement(&mut self) {
        if let Some(draft) = self.authoring.trims.draft.as_mut() {
            draft.place_on_board = false;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use marvelous_cloth::garment::GarmentTemplate;

    #[test]
    fn named_controls_create_cancel_edit_and_delete_a_trim() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
            history: authoring::History,
        }
        let mut case = Case {
            ui: TrimUi::default(),
            template: GarmentTemplate::two_panel_demo(),
            history: authoring::History::default(),
        };
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let panel = case.template.panels[0].clone();
            if let Some(command) = trim_controls(ui, &mut case.ui, &case.template, &panel) {
                if let Command::SetTrim { trim } = &command {
                    let garment = case.template.compile().unwrap();
                    validate_surface(trim, &garment).unwrap();
                }
                let edit = authoring::apply(&case.template, command).unwrap();
                assert!(!edit.reset_simulation);
                case.history.record(case.template.clone());
                case.template = edit.template;
                case.ui.draft = None;
            }
        };
        let mut harness = Harness::new(egui::vec2(1000., 700.));
        harness.frame(&mut case, &mut draw);
        harness.click("trim.section", &mut case, &mut draw).unwrap();
        harness.click("trim.new", &mut case, &mut draw).unwrap();
        assert!(case.template.trims.is_empty());
        harness.click("trim.cancel", &mut case, &mut draw).unwrap();
        assert!(case.template.trims.is_empty() && !case.history.can_undo());
        harness.frame(&mut case, &mut draw);
        harness.click("trim.new", &mut case, &mut draw).unwrap();
        harness.click("trim.apply", &mut case, &mut draw).unwrap();
        assert_eq!(case.template.trims.len(), 1);
        assert!(case.history.can_undo());
        harness.frame(&mut case, &mut draw);
        harness
            .click("trim.edit.trim_1", &mut case, &mut draw)
            .unwrap();
        assert!(case.ui.draft.is_some());
        harness.click("trim.cancel", &mut case, &mut draw).unwrap();
        harness.frame(&mut case, &mut draw);
        harness
            .click("trim.delete.trim_1", &mut case, &mut draw)
            .unwrap();
        assert!(case.template.trims.is_empty());
        let undo = case.history.restore(&case.template, false).unwrap();
        assert!(!undo.reset_simulation);
        assert_eq!(undo.template.trims.len(), 1);
        for (index, expected) in [(1, "Buttonhole"), (2, "Zipper"), (3, "Topstitch")] {
            harness.frame(&mut case, &mut draw);
            harness.click("trim.kind", &mut case, &mut draw).unwrap();
            harness.frame(&mut case, &mut draw);
            harness
                .click(&format!("trim.kind.{index}"), &mut case, &mut draw)
                .unwrap();
            harness.frame(&mut case, &mut draw);
            harness.click("trim.new", &mut case, &mut draw).unwrap();
            harness.click("trim.apply", &mut case, &mut draw).unwrap();
            assert_eq!(label(&case.template.trims[0].kind), expected);
            harness.frame(&mut case, &mut draw);
            harness
                .click("trim.delete.trim_1", &mut case, &mut draw)
                .unwrap();
        }
    }

    #[test]
    fn inspector_drafts_preserve_all_supported_trim_kinds() {
        let panel = GarmentTemplate::two_panel_demo().panels[0].id.clone();
        let points = vec![
            DVec2::new(0.02, 0.04),
            DVec2::new(0.1, 0.1),
            DVec2::new(0.15, 0.15),
        ];
        for kind in [
            TrimKind::Button {
                center_m: points[0],
                diameter_m: 0.018,
            },
            TrimKind::Buttonhole {
                start_m: points[0],
                end_m: points[1],
                width_m: 0.004,
            },
            TrimKind::Zipper {
                path_m: points.clone(),
                width_m: 0.012,
            },
            TrimKind::Topstitch {
                path_m: points.clone(),
                rows: 2,
                spacing_m: 0.004,
            },
        ] {
            let trim = Trim {
                id: "trim_1".into(),
                panel_id: panel.clone(),
                kind,
            };
            assert_eq!(TrimDraft::from_trim(&trim).parse().unwrap(), trim);
        }
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: panel,
            kind: TrimKind::Button {
                center_m: DVec2::ZERO,
                diameter_m: 0.018,
            },
        };
        let mut draft = TrimDraft::from_trim(&trim);
        draft.points = "nan, 3".into();
        assert!(draft.parse().is_err());
        draft.points = "0, 0\n1, 1".into();
        assert!(draft.parse().is_err());
    }

    #[test]
    fn validates_surface_membership_and_bounded_work() {
        let template = GarmentTemplate::two_panel_demo();
        let garment = template.compile().unwrap();
        let id = template.panels[0].id.clone();
        let button = Trim {
            id: "trim_1".into(),
            panel_id: id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.05, 0.05),
                diameter_m: 0.018,
            },
        };
        validate_surface(&button, &garment).unwrap();
        let outside = Trim {
            kind: TrimKind::Button {
                center_m: DVec2::splat(50.),
                diameter_m: 0.018,
            },
            ..button.clone()
        };
        assert!(validate_surface(&outside, &garment).is_err());
        let zipper = Trim {
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
                width_m: 0.01,
            },
            ..button
        };
        validate_surface(&zipper, &garment).unwrap();
    }

    #[test]
    fn surface_preview_tracks_deformation_and_rejects_invalid_anchors() {
        use std::sync::Arc;
        let template = GarmentTemplate::two_panel_demo();
        let garment = Arc::new(template.compile().unwrap());
        let id = template.panels[0].id.clone();
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: id,
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
                width_m: 0.01,
            },
        };
        let preview = build_preview(garment.clone(), std::slice::from_ref(&trim)).unwrap();
        let attachment = &preview.paths[0].1[0];
        let before = attachment.evaluate(&garment.initial_state.x).unwrap();
        let mut moved = garment.initial_state.x.clone();
        for p in &mut moved {
            *p += glam::DVec3::new(0.2, 0.3, 0.4);
        }
        let after = attachment.evaluate(&moved).unwrap();
        assert!((after - before - glam::DVec3::new(0.2, 0.3, 0.4)).length() < 1e-12);
        assert!(std::sync::Arc::ptr_eq(&preview.garment, &garment));
        let mut finer = template.clone();
        finer.panels[0].pattern.nx += 1;
        let remeshed = Arc::new(finer.compile().unwrap());
        assert!(!std::sync::Arc::ptr_eq(&preview.garment, &remeshed));
        assert_ne!(garment.mesh.uv.len(), remeshed.mesh.uv.len());
        let outside = Trim {
            kind: TrimKind::Button {
                center_m: DVec2::splat(20.),
                diameter_m: 0.018,
            },
            ..trim
        };
        let valid = Trim {
            id: "trim_2".into(),
            panel_id: outside.panel_id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.05, 0.05),
                diameter_m: 0.018,
            },
        };
        let preview = build_preview(garment, &[outside, valid]).unwrap();
        assert_eq!(preview.skipped, 1);
        assert_eq!(preview.paths.len(), 1);
    }

    #[test]
    fn board_placement_translates_path_in_rotated_panel_coordinates() {
        let mut board = super::super::board::Board::default();
        board.set_view_rotation_degrees(33.);
        let rect = egui::Rect::from_min_size(egui::Pos2::ZERO, egui::vec2(900., 600.));
        let origin = DVec2::new(0.4, -0.2);
        let angle = 47.;
        let target = DVec2::new(0.1, 0.2);
        let screen = board.screen(rect, origin + authoring::rotate_2d(target, angle));
        let recovered = authoring::rotate_2d(board.world(rect, screen) - origin, -angle);
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: "panel".into(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.01, 0.02), DVec2::new(0.07, 0.08)],
                width_m: 0.01,
            },
        };
        let moved = translate_first_point(trim, recovered).unwrap();
        let TrimKind::Zipper { path_m, .. } = moved.kind else {
            panic!("wrong trim type")
        };
        assert!(path_m[0].distance(target) < 1e-6);
        assert!((path_m[1] - path_m[0]).distance(DVec2::new(0.06, 0.06)) < 1e-12);
    }

    #[test]
    fn stale_drafts_cannot_replace_changed_or_removed_trims() {
        let mut template = GarmentTemplate::two_panel_demo();
        let item = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.018,
            },
        };
        template.trims.push(item.clone());
        let draft = TrimDraft::from_trim(&item);
        check_draft_revision(&draft, &template).unwrap();
        template.trims.clear();
        assert!(check_draft_revision(&draft, &template).is_err());
        let mut changed = item;
        changed.kind = TrimKind::Button {
            center_m: DVec2::new(0.2, 0.1),
            diameter_m: 0.018,
        };
        template.trims.push(changed);
        assert!(check_draft_revision(&draft, &template).is_err());
    }

    #[test]
    fn preview_cache_reuses_and_invalidates_on_edit_or_remesh() {
        use std::sync::Arc;
        let template = GarmentTemplate::two_panel_demo();
        let garment = Arc::new(template.compile().unwrap());
        let mut trim = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.05, 0.05),
                diameter_m: 0.018,
            },
        };
        let mut ui = TrimUi::default();
        ui.refresh_preview(&garment, std::slice::from_ref(&trim));
        let ptr = ui.preview.as_ref().unwrap().paths.as_ptr();
        ui.refresh_preview(&garment, std::slice::from_ref(&trim));
        assert_eq!(ptr, ui.preview.as_ref().unwrap().paths.as_ptr());
        trim.kind = TrimKind::Button {
            center_m: DVec2::new(0.1, 0.1),
            diameter_m: 0.018,
        };
        ui.refresh_preview(&garment, std::slice::from_ref(&trim));
        assert_eq!(ui.preview.as_ref().unwrap().trims, vec![trim.clone()]);
        let mut finer = template.clone();
        finer.panels[0].pattern.nx += 1;
        let remeshed = Arc::new(finer.compile().unwrap());
        ui.refresh_preview(&remeshed, &[trim]);
        assert!(Arc::ptr_eq(
            &ui.preview.as_ref().unwrap().garment,
            &remeshed
        ));
        ui.refresh_preview(&remeshed, &[]);
        assert!(ui.preview.is_none());
    }
}
