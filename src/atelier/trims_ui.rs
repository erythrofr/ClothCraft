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
    visibility: super::selection::ClothVisibilityCache,
}

struct TrimPreview {
    garment: std::sync::Arc<marvelous_cloth::garment::CompiledGarment>,
    trims: Vec<Trim>,
    paths: Vec<(
        usize,
        bool,
        Vec<marvelous_cloth::garment::embedding::EmbeddedPoint>,
    )>,
    skipped: usize,
    simplified: usize,
}

const MAX_PREVIEW_POINTS: usize = 512;

struct TrimDraft {
    panel: String,
    id: String,
    kind: usize,
    points: String,
    width: String,
    rows: String,
    place_on_board: bool,
    draw_backup: Option<String>,
    draw_points: Vec<DVec2>,
    original: Option<Trim>,
    base: Option<Trim>,
}

/// Stage a board click in material coordinates without editing the project.
fn stage_board_click(draft: &mut TrimDraft, point: DVec2) -> Result<(), String> {
    if draft.draw_backup.is_some() {
        return draft.append_path_point(point);
    }
    let trim = draft
        .parse()
        .and_then(|trim| translate_first_point(trim, point))?;
    let base = draft.base.clone();
    *draft = TrimDraft::from_trim(&trim);
    draft.base = base;
    Ok(())
}

fn board_local_point(
    board: &super::board::Board,
    rect: egui::Rect,
    screen: egui::Pos2,
    origin: DVec2,
    angle: f64,
) -> DVec2 {
    authoring::rotate_2d(board.world(rect, screen) - origin, -angle)
}

fn label(kind: &TrimKind) -> &'static str {
    match kind {
        TrimKind::Button { .. } => "Button",
        TrimKind::Buttonhole { .. } => "Buttonhole",
        TrimKind::Zipper { .. } => "Zipper",
        TrimKind::Topstitch { .. } => "Topstitch",
    }
}

/// Material-space strip corners for one straight preview segment.
fn strip_corners(a: DVec2, b: DVec2, width: f64) -> Option<[DVec2; 4]> {
    let d = b - a;
    let length = d.length();
    if !a.is_finite()
        || !b.is_finite()
        || !width.is_finite()
        || width <= 0.
        || !length.is_finite()
        || length <= 0.
    {
        return None;
    }
    let n = DVec2::new(-d.y, d.x) * (0.5 * width / length);
    let corners = [a + n, b + n, b - n, a - n];
    corners.iter().all(|p| p.is_finite()).then_some(corners)
}

fn topstitch_row(a: DVec2, b: DVec2, rows: u8, spacing: f64, row: u8) -> Option<[DVec2; 2]> {
    let d = b - a;
    let length = d.length();
    if !(1..=8).contains(&rows)
        || row >= rows
        || !spacing.is_finite()
        || spacing <= 0.
        || !a.is_finite()
        || !b.is_finite()
        || !length.is_finite()
        || length <= 0.
    {
        return None;
    }
    let offset = (f64::from(row) - (f64::from(rows) - 1.) * 0.5) * spacing;
    let normal = DVec2::new(-d.y, d.x) * (offset / length);
    let result = [a + normal, b + normal];
    result.iter().all(|p| p.is_finite()).then_some(result)
}

/// Join offset segments with a straight bevel in material space. A join is
/// omitted when adjacent offsets already coincide (for example on a straight line).
fn topstitch_paths(points: &[DVec2], rows: u8, spacing: f64) -> Option<Vec<Vec<DVec2>>> {
    if !(2..=1024).contains(&points.len()) || !(1..=8).contains(&rows) {
        return None;
    }
    let mut result = Vec::new();
    for row in 0..rows {
        let mut path = Vec::new();
        let mut previous_end: Option<DVec2> = None;
        for pair in points.windows(2) {
            let segment = topstitch_row(pair[0], pair[1], rows, spacing, row)?;
            if previous_end.is_none_or(|end| end.distance(segment[0]) > 1e-12) {
                path.push(segment[0]);
            }
            path.push(segment[1]);
            previous_end = Some(segment[1]);
        }
        result.push(path);
    }
    Some(result)
}

/// Two offset edges connected at both ends, in material coordinates.
fn trim_width_outline(points: &[DVec2], width: f64) -> Option<Vec<DVec2>> {
    let mut edges = topstitch_paths(points, 2, width)?.into_iter();
    let mut outline = edges.next()?;
    let first = *outline.first()?;
    outline.extend(edges.next()?.into_iter().rev());
    outline.push(first);
    Some(outline)
}

fn board_trim_cost(points: usize, strip: bool, rows: Option<u8>) -> usize {
    let extra = if strip {
        4
    } else {
        rows.unwrap_or(1).saturating_sub(1) as usize
    };
    points
        .saturating_add(points.saturating_sub(1).saturating_mul(extra))
        .saturating_add((rows.unwrap_or(0) as usize).saturating_mul(points.saturating_sub(2)))
}

/// Distance to a projected strip, including its interior. A degenerate or
/// non-finite projection cannot make the whole viewport selectable.
fn projected_strip_distance(pointer: egui::Pos2, corners: [egui::Pos2; 4]) -> Option<f32> {
    if !pointer.is_finite() || corners.iter().any(|point| !point.is_finite()) {
        return None;
    }
    let cross = |a: egui::Vec2, b: egui::Vec2| a.x * b.y - a.y * b.x;
    let area = cross(corners[1] - corners[0], corners[3] - corners[0]);
    let mut positive = false;
    let mut negative = false;
    let mut distance = f32::INFINITY;
    for i in 0..4 {
        let a = corners[i];
        let b = corners[(i + 1) % 4];
        let side = cross(b - a, pointer - a);
        if !side.is_finite() {
            return None;
        }
        positive |= side > 0.;
        negative |= side < 0.;
        distance = distance.min(super::authoring_ui::segment_distance(pointer, a, b));
    }
    if !area.is_finite() || !distance.is_finite() {
        None
    } else if area.abs() > 1e-6 && !(positive && negative) {
        Some(0.)
    } else {
        Some(distance)
    }
}

fn board_trim_distance(
    screen: egui::Pos2,
    points: &[DVec2],
    width: Option<f64>,
    project: &impl Fn(DVec2) -> egui::Pos2,
) -> f32 {
    if points.len() == 1 {
        return screen.distance(project(points[0]));
    }
    points
        .windows(2)
        .map(|pair| {
            let mut distance =
                super::authoring_ui::segment_distance(screen, project(pair[0]), project(pair[1]));
            if let Some(corners) = width.and_then(|w| strip_corners(pair[0], pair[1], w))
                && let Some(strip_distance) = projected_strip_distance(screen, corners.map(project))
            {
                distance = distance.min(strip_distance);
            }
            distance
        })
        .fold(f32::INFINITY, f32::min)
}

fn board_topstitch_distance(
    screen: egui::Pos2,
    points: &[DVec2],
    rows: u8,
    spacing: f64,
    project: &impl Fn(DVec2) -> egui::Pos2,
) -> f32 {
    let mut distance = board_trim_distance(screen, points, None, project);
    if let Some(paths) = topstitch_paths(points, rows, spacing) {
        for segment in paths.iter().flat_map(|path| path.windows(2)) {
            distance = distance.min(super::authoring_ui::segment_distance(
                screen,
                project(segment[0]),
                project(segment[1]),
            ));
        }
    }
    distance
}

fn closer_trim(candidate: (f32, f32), previous: (f32, f32)) -> bool {
    candidate.0 < previous.0 || (candidate.0 == previous.0 && candidate.1 < previous.1)
}

pub(super) fn paint_trim_2d(
    painter: &egui::Painter,
    point: &impl Fn(DVec2) -> egui::Pos2,
    trim: &Trim,
    budget: &mut usize,
    color: Color32,
) {
    let (points, diameter, strip_width, topstitch) = match &trim.kind {
        TrimKind::Button {
            center_m,
            diameter_m,
        } => (vec![*center_m], Some(*diameter_m), None, None),
        TrimKind::Buttonhole {
            start_m,
            end_m,
            width_m,
        } => (vec![*start_m, *end_m], None, Some(*width_m), None),
        TrimKind::Zipper { path_m, width_m } => (path_m.clone(), None, Some(*width_m), None),
        TrimKind::Topstitch {
            path_m,
            rows,
            spacing_m,
        } => (path_m.clone(), None, None, Some((*rows, *spacing_m))),
    };
    // Each outlined segment contributes four more shapes. Account for these
    // in the shared board budget so width previews remain bounded.
    let cost = board_trim_cost(
        points.len(),
        strip_width.is_some(),
        topstitch.map(|(rows, _)| rows),
    );
    if cost > *budget {
        *budget = 0;
        return;
    }
    *budget -= cost;
    if let Some(diameter) = diameter {
        let p = point(points[0]);
        let radius = p
            .distance(point(points[0] + DVec2::X * (diameter * 0.5)))
            .clamp(2., 100.);
        painter.circle_stroke(p, radius, Stroke::new(1.5, color));
        painter.circle_filled(p, 2., color);
    } else {
        if let Some((rows, spacing)) = topstitch {
            if let Some(paths) = topstitch_paths(&points, rows, spacing) {
                for segment in paths.iter().flat_map(|path| path.windows(2)) {
                    painter.line_segment(
                        [point(segment[0]), point(segment[1])],
                        Stroke::new(2., color),
                    );
                }
            }
            return;
        }
        for pair in points.windows(2) {
            painter.line_segment([point(pair[0]), point(pair[1])], Stroke::new(2., color));
            if let Some(corners) =
                strip_width.and_then(|width| strip_corners(pair[0], pair[1], width))
            {
                for i in 0..4 {
                    painter.line_segment(
                        [point(corners[i]), point(corners[(i + 1) % 4])],
                        Stroke::new(1., color),
                    );
                }
            }
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
            draw_backup: None,
            draw_points: Vec::new(),
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

    fn begin_path(&mut self) {
        self.draw_backup = Some(self.points.clone());
        self.draw_points.clear();
        self.points.clear();
        self.place_on_board = false;
    }

    fn append_path_point(&mut self, point: DVec2) -> Result<(), String> {
        if self.kind == 1 && self.draw_points.len() >= 2 {
            return Err("Buttonholes need exactly two points; finish or cancel drawing".into());
        }
        if !point.is_finite() || self.draw_points.len() >= 128 {
            return Err("Path needs finite coordinates and at most 128 points".into());
        }
        if self
            .draw_points
            .last()
            .is_some_and(|p| p.distance(point) < 1e-6)
        {
            return Err("Choose a different point".into());
        }
        self.draw_points.push(point);
        self.points = points_text(&self.draw_points);
        Ok(())
    }

    fn cancel_path(&mut self) {
        if let Some(previous) = self.draw_backup.take() {
            self.points = previous;
        }
        self.draw_points.clear();
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

/// Refuse invalid surface paths and bound embedding work on Apply, never per frame.
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
    let path = MaterialPath {
        panel: trim.panel_id.clone(),
        points,
    };
    if budget <= 8_000_000 {
        garment.embed_path(&path)?;
    } else if n <= 20_000 {
        garment.embed_path_bounded(&path)?;
    } else {
        return Err(
            "Path is too complex for surface preview; simplify it or use a coarser mesh".into(),
        );
    }
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
    let mut simplified = 0usize;
    for (index, trim) in trims.iter().enumerate() {
        let Some(n) = garment
            .panels
            .iter()
            .find(|p| p.id == trim.panel_id)
            .map(|p| p.triangles.len())
        else {
            skipped += 1;
            continue;
        };
        let (button, candidates, width_fallback): (bool, Option<Vec<Vec<DVec2>>>, bool) =
            match &trim.kind {
                TrimKind::Button { center_m, .. } => (true, Some(vec![vec![*center_m]]), false),
                TrimKind::Buttonhole {
                    start_m,
                    end_m,
                    width_m,
                } => {
                    let center = vec![*start_m, *end_m];
                    let outline = trim_width_outline(&center, *width_m);
                    let mut candidates = vec![center];
                    if let Some(outline) = outline {
                        candidates.push(outline);
                    }
                    (false, Some(candidates), true)
                }
                TrimKind::Zipper { path_m, width_m } => {
                    let mut candidates = vec![path_m.clone()];
                    if let Some(outline) = trim_width_outline(path_m, *width_m) {
                        candidates.push(outline);
                    }
                    (false, Some(candidates), true)
                }
                TrimKind::Topstitch {
                    path_m, rows: 1, ..
                } => (false, Some(vec![path_m.clone()]), false),
                TrimKind::Topstitch {
                    path_m,
                    rows,
                    spacing_m,
                } => {
                    let lines = topstitch_paths(path_m, *rows, *spacing_m).filter(|paths| {
                        paths
                            .iter()
                            .fold(0usize, |sum, path| sum.saturating_add(path.len()))
                            <= MAX_PREVIEW_POINTS.saturating_sub(count)
                    });
                    (false, lines, false)
                }
            };
        let Some(candidates) = candidates else {
            skipped += 1;
            continue;
        };
        let width_missing = width_fallback && candidates.len() != 2;
        // Multiple short rows can exceed the shared direct-work budget even
        // when each row fits alone. Use the bounded index in that case too.
        let total_direct = candidates.iter().fold(0usize, |total, points| {
            total.saturating_add(if button {
                n
            } else {
                n.saturating_mul(n)
                    .saturating_mul(points.len().saturating_sub(1))
            })
        });
        let prefer_indexed = !button && !width_fallback && n <= 20_000 && total_direct > 8_000_000;
        let mut staged = Vec::new();
        let mut staged_count = 0usize;
        let mut valid = !candidates.is_empty();
        for points in candidates {
            let direct_cost = if button {
                n
            } else {
                n.saturating_mul(n)
                    .saturating_mul(points.len().saturating_sub(1))
            };
            let indexed = !button && n <= 20_000 && (direct_cost > 8_000_000 || prefer_indexed);
            // The shared budget bounds both ordinary and indexed attempts.
            let cost = if indexed { 2_000_000 } else { direct_cost };
            if work.saturating_add(cost) > 8_000_000 {
                valid = false;
                break;
            }
            work += cost;
            let embedded = if button {
                garment
                    .embed_point(&trim.panel_id, points[0])
                    .map(|p| vec![p])
            } else {
                let path = MaterialPath {
                    panel: trim.panel_id.clone(),
                    points,
                };
                if indexed {
                    garment.embed_path_bounded(&path)
                } else {
                    garment.embed_path(&path)
                }
            };
            let Ok(embedded) = embedded else {
                valid = false;
                break;
            };
            staged_count = staged_count.saturating_add(embedded.len());
            if count.saturating_add(staged_count) > MAX_PREVIEW_POINTS {
                valid = false;
                break;
            }
            staged.push((index, button, embedded));
        }
        if !valid && width_fallback && !staged.is_empty() {
            staged.truncate(1);
            staged_count = staged[0].2.len();
            simplified += 1;
            valid = true;
        }
        if !valid {
            skipped += 1;
            continue;
        }
        if width_missing {
            simplified += 1;
        }
        count += staged_count;
        paths.extend(staged);
    }
    Ok(TrimPreview {
        garment,
        trims: trims.to_vec(),
        paths,
        skipped,
        simplified,
    })
}

impl TrimUi {
    pub(super) fn board_placement_active(&self) -> bool {
        self.draft
            .as_ref()
            .is_some_and(|draft| draft.place_on_board || draft.draw_backup.is_some())
    }

    pub(super) fn cancel_board_placement(&mut self) {
        if let Some(draft) = self.draft.as_mut() {
            draft.place_on_board = false;
            draft.cancel_path();
        }
    }

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

/// Find the closest projected marker or segment whose sampled surface is visible.
/// The caller bounds the number of points and the cost of visibility queries.
fn pick_visible_trim(
    pointer: egui::Pos2,
    paths: &[(usize, bool, Vec<Option<glam::DVec3>>)],
    project: &impl Fn(glam::DVec3) -> Option<(egui::Pos2, f32)>,
    visible: &mut impl FnMut(glam::DVec3) -> bool,
) -> Option<usize> {
    let mut best = 8.0f32;
    let mut selected = None;
    for (index, button, points) in paths {
        if *button {
            if let Some(world) = points.first().copied().flatten()
                && let Some((screen, _)) = project(world)
                && screen.distance(pointer) <= best
                && visible(world)
            {
                best = screen.distance(pointer);
                selected = Some(*index);
            }
            continue;
        }
        for pair in points.windows(2) {
            let (Some(a), Some(b)) = (pair[0], pair[1]) else {
                continue;
            };
            let (Some((pa, wa)), Some((pb, wb))) = (project(a), project(b)) else {
                continue;
            };
            let distance = super::authoring_ui::segment_distance(pointer, pa, pb);
            if distance > best {
                continue;
            }
            let direction = pb - pa;
            let screen_t =
                ((pointer - pa).dot(direction) / direction.length_sq().max(1e-12)).clamp(0., 1.);
            let denominator = (1. - screen_t) / wa + screen_t / wb;
            if !denominator.is_finite() || denominator <= 0. {
                continue;
            }
            let t = (screen_t / wb) / denominator;
            let world = a.lerp(b, t as f64);
            if visible(a) && visible(b) && visible((a + b) * 0.5) && visible(world) {
                best = distance;
                selected = Some(*index);
            }
        }
    }
    selected
}

impl Atelier {
    pub(super) fn pick_trim_3d(&mut self, rect: egui::Rect, pointer: egui::Pos2) -> bool {
        if self.clean_view || self.authoring.trims.draft.is_some() {
            return false;
        }
        self.authoring
            .trims
            .refresh_preview(&self.scene.garment, &self.project.template.trims);
        let Some(preview) = self.authoring.trims.preview.as_ref() else {
            return false;
        };
        let points: usize = preview.paths.iter().map(|(_, _, p)| p.len()).sum();
        let Some(mut visibility) = super::selection::ClothVisibilityQueries::bounded(
            &self.scene.state.x,
            &self.scene.garment.mesh.triangles,
            points.saturating_mul(4),
            &mut self.authoring.trims.visibility,
        ) else {
            return false;
        };
        let matrix = self.camera.matrix(rect.width() / rect.height());
        let project = |world: glam::DVec3| {
            let p = super::gizmo::project_matrix(matrix, rect, world)?;
            let w = (matrix * world.as_vec3().extend(1.)).w;
            (w.is_finite() && w > 0.).then_some((p, w))
        };
        let mut visible = |world: glam::DVec3| {
            let Some((screen, _)) = project(world) else {
                return false;
            };
            let (origin, direction) = self.camera.ray(screen, rect);
            let distance = world.distance(origin) - 0.0001;
            distance > 0.
                && !self
                    .scene
                    .collider
                    .occludes_ray(origin, direction, distance)
                && !visibility
                    .bounded_occludes(origin, direction, distance)
                    .unwrap_or(true)
        };
        let paths = preview
            .paths
            .iter()
            .map(|(id, button, embedded)| {
                (
                    *id,
                    *button,
                    embedded
                        .iter()
                        .map(|p| p.evaluate(&self.scene.state.x).ok())
                        .collect(),
                )
            })
            .collect::<Vec<_>>();
        let Some(index) = pick_visible_trim(pointer, &paths, &project, &mut visible) else {
            return false;
        };
        let Some(trim) = preview.trims.get(index).cloned() else {
            return false;
        };
        self.select_panel(trim.panel_id.clone(), false);
        self.authoring.trims.draft = Some(TrimDraft::from_trim(&trim));
        self.status = format!("Selected {} · {}", label(&trim.kind), trim.id);
        true
    }
    pub(super) fn trim_draft_preview(&self, panel: &str) -> Option<Trim> {
        self.authoring
            .trims
            .draft
            .as_ref()
            .filter(|d| d.panel == panel)
            .and_then(|d| d.parse().ok())
    }
    pub(super) fn trim_drawing_points(&self, panel: &str) -> Option<&[DVec2]> {
        self.authoring
            .trims
            .draft
            .as_ref()
            .filter(|d| d.panel == panel && d.draw_backup.is_some())
            .map(|d| d.draw_points.as_slice())
    }
    pub(super) fn paint_trims_3d(&mut self, ui: &egui::Ui, rect: egui::Rect) {
        self.authoring
            .trims
            .refresh_preview(&self.scene.garment, &self.project.template.trims);
        let Some(preview) = self.authoring.trims.preview.as_ref() else {
            return;
        };
        let points: usize = preview.paths.iter().map(|(_, _, p)| p.len()).sum();
        let Some(mut visibility) = super::selection::ClothVisibilityQueries::bounded(
            &self.scene.state.x,
            &self.scene.garment.mesh.triangles,
            points.saturating_mul(3),
            &mut self.authoring.trims.visibility,
        ) else {
            self.authoring.trims.preview_warning =
                Some("3D trim preview hidden to limit visibility-test cost".into());
            return;
        };
        self.authoring.trims.preview_warning = (preview.skipped > 0 || preview.simplified > 0).then(|| {
            format!(
                "{} trims hidden; {} width previews simplified to centerlines (outside panel or preview budget)",
                preview.skipped, preview.simplified
            )
        });
        let painter = ui.painter().with_clip_rect(rect);
        let matrix = self.camera.matrix(rect.width() / rect.height());
        let project = |p| super::gizmo::project_matrix(matrix, rect, p);
        let mut visible = |world: glam::DVec3| -> Option<egui::Pos2> {
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
            if visibility
                .bounded_occludes(origin, direction, distance)
                .unwrap_or(true)
            {
                return None;
            }
            Some(screen)
        };
        let color = Color32::from_rgb(0xEA, 0x78, 0xD4);
        for (_, button, embedded) in &preview.paths {
            let world: Vec<_> = embedded
                .iter()
                .map(|p| p.evaluate(&self.scene.state.x).ok())
                .collect();
            if *button {
                if let Some(screen) = world.first().copied().flatten().and_then(&mut visible) {
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
    if state
        .draft
        .as_ref()
        .is_some_and(|d| d.place_on_board || d.draw_backup.is_some())
        && ui.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        && let Some(draft) = state.draft.as_mut()
    {
        draft.place_on_board = false;
        draft.cancel_path();
    }
    let mut command = None;
    let section = egui::CollapsingHeader::new("Construction trims")
        .open(state.draft.as_ref().map(|_| true))
        .show(ui, |ui| {
            ui.small("Visual construction notes · no physical closures. Widths may extend outside the panel.");
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
                        draw_backup: None,
                        draw_points: Vec::new(),
                        original: None,
                        base: None,
                    });
                }
            });
            if let Some(draft) = state.draft.as_mut() {
                ui.label("Material X, Y (mm) · one point per line");
                let points = ui.add_enabled(draft.draw_backup.is_none(),
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
                let place = ui.add_enabled(draft.draw_backup.is_none(), egui::Button::new("Position first point on 2D board"));
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &place, "trim.place");
                if place.clicked() {
                    draft.place_on_board = true;
                }
                if draft.place_on_board { ui.small("Click the panel to position the first point · Escape cancels"); }
                if matches!(draft.kind, 1..=3) {
                    if draft.draw_backup.is_none() {
                        let draw = ui.button("Draw path on 2D board");
                        #[cfg(test)]
                        super::authoring_smoke::widget_harness::named(ui, &draw, "trim.draw");
                        if draw.clicked() { draft.begin_path(); }
                    } else {
                        ui.small(if draft.kind == 1 {
                            "Click the two buttonhole endpoints on the selected panel"
                        } else {
                            "Click points on the selected panel · 128 points maximum"
                        });
                        ui.horizontal(|ui| {
                            let finish = ui.add_enabled(draft.parse().is_ok(), egui::Button::new("Finish path"));
                            #[cfg(test)]
                            super::authoring_smoke::widget_harness::named(ui, &finish, "trim.finish_path");
                            if finish.clicked() { draft.draw_backup = None; draft.draw_points.clear(); }
                            let cancel_path = ui.button("Cancel drawing");
                            #[cfg(test)]
                            super::authoring_smoke::widget_harness::named(ui, &cancel_path, "trim.cancel_path");
                            if cancel_path.clicked() { draft.cancel_path(); }
                        });
                    }
                }
                let parsed = draft.parse();
                if let Err(error) = &parsed {
                    ui.colored_label(Color32::GOLD, error);
                }
                let can_apply = parsed.is_ok() && draft.draw_backup.is_none();
                ui.horizontal(|ui| {
                    let apply = ui.add_enabled(can_apply, egui::Button::new("Apply"));
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
        let mut best: Option<((f32, f32), Trim)> = None;
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
            let (points, width, topstitch) = match &trim.kind {
                TrimKind::Button { center_m, .. } => (vec![*center_m], None, None),
                TrimKind::Buttonhole {
                    start_m,
                    end_m,
                    width_m,
                } => (vec![*start_m, *end_m], Some(*width_m), None),
                TrimKind::Zipper { path_m, width_m } => (path_m.clone(), Some(*width_m), None),
                TrimKind::Topstitch {
                    path_m,
                    rows,
                    spacing_m,
                } => (path_m.clone(), None, Some((*rows, *spacing_m))),
            };
            let cost = board_trim_cost(
                points.len(),
                width.is_some(),
                topstitch.map(|(rows, _)| rows),
            );
            if cost > remaining {
                break;
            }
            remaining -= cost;
            let origin = self.board_origin(index);
            let angle = self.board_angle(index);
            let screen_point = |p| {
                self.authoring
                    .board
                    .screen(rect, origin + authoring::rotate_2d(p, angle))
            };
            let distance = if let Some((rows, spacing)) = topstitch {
                board_topstitch_distance(screen, &points, rows, spacing, &screen_point)
            } else {
                board_trim_distance(screen, &points, width, &screen_point)
            };
            let center_distance = board_trim_distance(screen, &points, None, &screen_point);
            let score = (distance, center_distance);
            if distance <= 8.
                && best
                    .as_ref()
                    .is_none_or(|(old, _)| closer_trim(score, *old))
            {
                best = Some((score, trim.clone()));
            }
        }
        let Some((_, trim)) = best else { return false };
        self.select_panel(trim.panel_id.clone(), false);
        self.authoring.trims.draft = Some(TrimDraft::from_trim(&trim));
        self.status = format!("Selected {} · {}", label(&trim.kind), trim.id);
        true
    }

    pub(super) fn trim_board_placement_active(&self) -> bool {
        self.authoring.trims.board_placement_active()
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
        let local = board_local_point(
            &self.authoring.board,
            rect,
            screen,
            self.board_origin(index),
            self.board_angle(index),
        );
        let draft = self.authoring.trims.draft.as_mut().unwrap();
        if let Err(error) = stage_board_click(draft, local) {
            self.authoring.error = Some(error.clone());
            self.status = error;
        }
        true
    }

    pub(super) fn cancel_trim_board_placement(&mut self) {
        self.authoring.trims.cancel_board_placement();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use marvelous_cloth::garment::GarmentTemplate;

    #[test]
    fn zipper_width_tracks_folded_surface_and_preserves_centerline_on_failure() {
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels[0].pattern.nx = 2;
        template.panels[0].pattern.ny = 1;
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let trim = Trim {
            id: "zip".into(),
            panel_id: "left".into(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.3), DVec2::new(0.35, 0.3)],
                width_m: 0.04,
            },
        };
        let preview = build_preview(garment.clone(), std::slice::from_ref(&trim)).unwrap();
        assert_eq!(
            (preview.skipped, preview.simplified, preview.paths.len()),
            (0, 0, 2)
        );
        let mut x = garment.initial_state.x.clone();
        for (i, p) in x.iter_mut().enumerate() {
            let uv = garment.mesh.uv[i];
            *p = if uv.x <= 0.2 {
                glam::DVec3::new(uv.x, uv.y, 0.)
            } else {
                glam::DVec3::new(0.2, uv.y, uv.x - 0.2)
            };
        }
        for ((_, _, embedded), expected_length) in preview.paths.iter().zip([0.3, 0.68]) {
            assert!(embedded.iter().any(|p| (p.uv.x - 0.2).abs() < 1e-12));
            let positions: Vec<_> = embedded.iter().map(|p| p.evaluate(&x).unwrap()).collect();
            assert!(
                (positions
                    .windows(2)
                    .map(|p| p[0].distance(p[1]))
                    .sum::<f64>()
                    - expected_length)
                    .abs()
                    < 1e-12
            );
        }
        let projected_paths: Vec<_> = preview
            .paths
            .iter()
            .map(|(id, button, points)| {
                (
                    *id,
                    *button,
                    points.iter().map(|p| p.evaluate(&x).ok()).collect(),
                )
            })
            .collect();
        let project =
            |p: glam::DVec3| Some((egui::pos2((p.x * 1000.) as f32, (p.y * 1000.) as f32), 1.));
        assert_eq!(
            pick_visible_trim(
                egui::pos2(100., 280.),
                &projected_paths,
                &project,
                &mut |_| true
            ),
            Some(0)
        );
        assert_eq!(
            pick_visible_trim(
                egui::pos2(50., 290.),
                &projected_paths,
                &project,
                &mut |_| true
            ),
            Some(0)
        );
        assert_eq!(
            pick_visible_trim(
                egui::pos2(100., 280.),
                &projected_paths,
                &project,
                &mut |_| false
            ),
            None
        );
        let near_edge = Trim {
            kind: TrimKind::Buttonhole {
                start_m: DVec2::new(0.05, 0.001),
                end_m: DVec2::new(0.35, 0.001),
                width_m: 0.04,
            },
            ..trim
        };
        let fallback = build_preview(garment, &[near_edge]).unwrap();
        assert_eq!(
            (fallback.skipped, fallback.simplified, fallback.paths.len()),
            (0, 1, 1)
        );
        assert!(
            fallback.paths[0]
                .2
                .iter()
                .all(|p| (p.uv.y - 0.001).abs() < 1e-12)
        );
    }

    #[test]
    fn topstitch_rows_follow_folded_surface_and_refuse_partial_previews() {
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels[0].pattern.nx = 2;
        template.panels[0].pattern.ny = 1;
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let trim = Trim {
            id: "stitch".into(),
            panel_id: "left".into(),
            kind: TrimKind::Topstitch {
                path_m: vec![DVec2::new(0.05, 0.3), DVec2::new(0.35, 0.3)],
                rows: 3,
                spacing_m: 0.02,
            },
        };
        let preview = build_preview(garment.clone(), std::slice::from_ref(&trim)).unwrap();
        assert_eq!(preview.skipped, 0);
        assert_eq!(preview.paths.len(), 3);
        let mut x = garment.initial_state.x.clone();
        for (i, p) in x.iter_mut().enumerate() {
            let uv = garment.mesh.uv[i];
            *p = if uv.x <= 0.2 {
                glam::DVec3::new(uv.x, uv.y, 0.)
            } else {
                glam::DVec3::new(0.2, uv.y, uv.x - 0.2)
            };
        }
        for (i, (_, button, embedded)) in preview.paths.iter().enumerate() {
            assert!(!button);
            let expected_y = 0.28 + 0.02 * i as f64;
            assert!(embedded.iter().all(|p| (p.uv.y - expected_y).abs() < 1e-12));
            assert!(embedded.iter().any(|p| (p.uv.x - 0.2).abs() < 1e-12));
            let positions: Vec<_> = embedded.iter().map(|p| p.evaluate(&x).unwrap()).collect();
            let length: f64 = positions
                .windows(2)
                .map(|pair| pair[0].distance(pair[1]))
                .sum();
            assert!((length - 0.3).abs() < 1e-12);
        }
        let projected_paths: Vec<_> = preview
            .paths
            .iter()
            .map(|(id, button, points)| {
                (
                    *id,
                    *button,
                    points.iter().map(|p| p.evaluate(&x).ok()).collect(),
                )
            })
            .collect();
        let project =
            |p: glam::DVec3| Some((egui::pos2((p.x * 1000.) as f32, (p.y * 1000.) as f32), 1.));
        assert_eq!(
            pick_visible_trim(
                egui::pos2(100., 280.),
                &projected_paths,
                &project,
                &mut |_| true
            ),
            Some(0)
        );
        assert_eq!(
            pick_visible_trim(
                egui::pos2(100., 280.),
                &projected_paths,
                &project,
                &mut |_| false
            ),
            None
        );
        let outside = Trim {
            kind: TrimKind::Topstitch {
                path_m: vec![DVec2::new(0.05, 0.001), DVec2::new(0.35, 0.001)],
                rows: 3,
                spacing_m: 0.02,
            },
            ..trim.clone()
        };
        let button = Trim {
            id: "button".into(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
            ..trim.clone()
        };
        let rejected = build_preview(garment.clone(), &[outside, button]).unwrap();
        assert_eq!(rejected.skipped, 1);
        assert_eq!(rejected.paths.len(), 1);
        assert_eq!(rejected.paths[0].0, 1);
        let corner_points = vec![
            DVec2::new(0.05, 0.15),
            DVec2::new(0.2, 0.15),
            DVec2::new(0.2, 0.3),
        ];
        let joined = topstitch_paths(&corner_points, 2, 0.02).unwrap();
        let corner_trim = Trim {
            kind: TrimKind::Topstitch {
                path_m: corner_points,
                rows: 2,
                spacing_m: 0.02,
            },
            ..trim.clone()
        };
        let corner_preview = build_preview(garment.clone(), &[corner_trim]).unwrap();
        assert_eq!(corner_preview.skipped, 0);
        assert_eq!(corner_preview.paths.len(), 2);
        for (row, (_, _, embedded)) in corner_preview.paths.iter().enumerate() {
            for target in &joined[row] {
                assert!(
                    embedded
                        .iter()
                        .any(|point| point.uv.distance(*target) < 1e-12)
                );
            }
        }
        let oversized = Trim {
            kind: TrimKind::Topstitch {
                path_m: (0..81)
                    .map(|i| DVec2::new(0.05 + 0.003 * i as f64, 0.3))
                    .collect(),
                rows: 8,
                spacing_m: 0.005,
            },
            ..trim
        };
        let rejected = build_preview(garment, &[oversized]).unwrap();
        assert_eq!(rejected.skipped, 1);
        assert!(rejected.paths.is_empty());
    }

    #[test]
    fn multiple_topstitch_rows_use_bounded_index_when_direct_work_exceeds_budget() {
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels[0].pattern.nx = 34;
        template.panels[0].pattern.ny = 34;
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let n = garment.panels[0].triangles.len();
        assert!(n * n < 8_000_000 && n * n * 3 > 8_000_000);
        let trim = Trim {
            id: "stitch".into(),
            panel_id: "left".into(),
            kind: TrimKind::Topstitch {
                path_m: vec![DVec2::new(0.05, 0.3), DVec2::new(0.35, 0.3)],
                rows: 3,
                spacing_m: 0.02,
            },
        };
        let preview = build_preview(garment, &[trim]).unwrap();
        assert_eq!(preview.skipped, 0);
        assert_eq!(preview.paths.len(), 3);
    }

    #[test]
    fn topstitch_row_crossing_hole_skips_the_whole_preview() {
        use marvelous_cloth::garment::{
            domain::Hole,
            shapes::{Primitive, primitive},
        };
        let mut template = GarmentTemplate::two_panel_demo();
        template.version = 2;
        template.seams.clear();
        template.panels[0].pins.clear();
        let mut polygon = primitive(
            Primitive::Rectangle,
            DVec2::new(0.4, 0.6),
            90.,
            Default::default(),
        )
        .unwrap();
        polygon.holes.push(Hole {
            points: vec![
                DVec2::new(0.15, 0.2),
                DVec2::new(0.15, 0.4),
                DVec2::new(0.25, 0.4),
                DVec2::new(0.25, 0.2),
            ],
            edges: (0..4).map(|i| format!("hole_{i}")).collect(),
        });
        template.panels[0].polygon = Some(polygon);
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let trim = Trim {
            id: "stitch".into(),
            panel_id: "left".into(),
            kind: TrimKind::Topstitch {
                path_m: vec![DVec2::new(0.05, 0.19), DVec2::new(0.35, 0.19)],
                rows: 3,
                spacing_m: 0.02,
            },
        };
        validate_surface(&trim, &garment).unwrap();
        let preview = build_preview(garment.clone(), std::slice::from_ref(&trim)).unwrap();
        assert_eq!(preview.skipped, 1);
        assert!(preview.paths.is_empty());
        let buttonhole = Trim {
            kind: TrimKind::Buttonhole {
                start_m: DVec2::new(0.05, 0.19),
                end_m: DVec2::new(0.35, 0.19),
                width_m: 0.04,
            },
            ..trim.clone()
        };
        let fallback = build_preview(garment.clone(), &[buttonhole]).unwrap();
        assert_eq!(
            (fallback.skipped, fallback.simplified, fallback.paths.len()),
            (0, 1, 1)
        );
        let points = vec![
            DVec2::new(0.05, 0.195),
            DVec2::new(0.145, 0.195),
            DVec2::new(0.145, 0.1),
        ];
        let rows = topstitch_paths(&points, 2, 0.04).unwrap();
        let row = &rows[1];
        assert_eq!(row.len(), 4);
        for (range, valid) in [((0, 1), true), ((1, 2), false), ((2, 3), true)] {
            let path = marvelous_cloth::garment::embedding::MaterialPath {
                panel: "left".into(),
                points: vec![row[range.0], row[range.1]],
            };
            assert_eq!(garment.embed_path(&path).is_ok(), valid);
        }
        let corner = Trim {
            kind: TrimKind::Topstitch {
                path_m: points,
                rows: 2,
                spacing_m: 0.04,
            },
            ..trim
        };
        validate_surface(&corner, &garment).unwrap();
        let preview = build_preview(garment, &[corner]).unwrap();
        assert_eq!(preview.skipped, 1);
        assert!(preview.paths.is_empty());
    }

    #[test]
    fn buttonhole_end_cap_crossing_hole_keeps_only_centerline() {
        use marvelous_cloth::garment::{
            domain::Hole,
            embedding::MaterialPath,
            shapes::{Primitive, primitive},
        };
        let mut template = GarmentTemplate::two_panel_demo();
        template.version = 2;
        template.seams.clear();
        template.panels[0].pins.clear();
        let mut polygon = primitive(
            Primitive::Rectangle,
            DVec2::new(0.4, 0.6),
            90.,
            Default::default(),
        )
        .unwrap();
        polygon.holes.push(Hole {
            points: vec![
                DVec2::new(0.15, 0.21),
                DVec2::new(0.15, 0.22),
                DVec2::new(0.25, 0.22),
                DVec2::new(0.25, 0.21),
            ],
            edges: (0..4).map(|i| format!("hole_{i}")).collect(),
        });
        template.panels[0].polygon = Some(polygon);
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let start = DVec2::new(0.2, 0.19);
        let end = DVec2::new(0.35, 0.19);
        let edges = topstitch_paths(&[start, end], 2, 0.1).unwrap();
        for points in &edges {
            assert!(
                garment
                    .embed_path(&MaterialPath {
                        panel: "left".into(),
                        points: points.clone()
                    })
                    .is_ok()
            );
        }
        let cap = MaterialPath {
            panel: "left".into(),
            points: vec![edges[0][0], edges[1][0]],
        };
        assert!(garment.embed_path(&cap).is_err());
        let trim = Trim {
            id: "hole".into(),
            panel_id: "left".into(),
            kind: TrimKind::Buttonhole {
                start_m: start,
                end_m: end,
                width_m: 0.1,
            },
        };
        validate_surface(&trim, &garment).unwrap();
        let preview = build_preview(garment, &[trim]).unwrap();
        assert_eq!(
            (preview.skipped, preview.simplified, preview.paths.len()),
            (0, 1, 1)
        );
    }

    #[test]
    fn topstitch_bevels_join_and_pick_across_rotated_corners() {
        let a = DVec2::new(0.1, 0.1);
        let b = DVec2::new(0.2, 0.1);
        let c = DVec2::new(0.2, 0.2);
        let paths = topstitch_paths(&[a, b, c], 2, 0.02).unwrap();
        assert_eq!(paths.len(), 2);
        assert!(paths.iter().all(|path| path.len() == 4));
        let first = topstitch_row(a, b, 2, 0.02, 0).unwrap();
        let second = topstitch_row(b, c, 2, 0.02, 0).unwrap();
        assert_eq!(paths[0], vec![first[0], first[1], second[0], second[1]]);
        let rotation = glam::DMat2::from_angle(0.51);
        let shift = DVec2::new(0.3, -0.1);
        let transformed = topstitch_paths(
            &[
                shift + rotation * a,
                shift + rotation * b,
                shift + rotation * c,
            ],
            2,
            0.02,
        )
        .unwrap();
        for (original, rotated) in paths.iter().flatten().zip(transformed.iter().flatten()) {
            assert!((shift + rotation * *original).distance(*rotated) < 1e-13);
        }
        let project = |p: DVec2| {
            let p = rotation * p * 1000.;
            egui::pos2(p.x as f32, p.y as f32)
        };
        let join_middle = project((first[1] + second[0]) * 0.5);
        assert!(board_topstitch_distance(join_middle, &[a, b, c], 2, 0.02, &project) < 0.01);
        let straight = topstitch_paths(&[a, b, b + (b - a)], 2, 0.02).unwrap();
        assert!(straight.iter().all(|path| path.len() == 3));
        let reversal = topstitch_paths(&[a, b, a], 2, 0.02).unwrap();
        assert!(reversal.iter().flatten().all(|point| point.is_finite()));
    }

    #[test]
    fn topstitch_rows_render_and_pick_in_material_space() {
        let a = DVec2::new(0.1, 0.2);
        let b = DVec2::new(0.3, 0.2);
        for (rows, expected) in [
            (1, vec![0.]),
            (2, vec![-0.01, 0.01]),
            (3, vec![-0.02, 0., 0.02]),
        ] {
            for (row, y) in expected.into_iter().enumerate() {
                let segment = topstitch_row(a, b, rows, 0.02, row as u8).unwrap();
                assert!((segment[0] - (a + DVec2::Y * y)).length() < 1e-14);
                assert!((segment[1] - (b + DVec2::Y * y)).length() < 1e-14);
            }
        }
        assert!(topstitch_row(a, a, 2, 0.02, 0).is_none());
        assert!(topstitch_row(a, b, 8, 0.02, 7).is_some());
        assert!(topstitch_row(a, b, 9, 0.02, 0).is_none());
        assert!(topstitch_row(a, b, 2, f64::NAN, 0).is_none());
        let rotation = glam::DMat2::from_angle(0.71);
        let project = |p: DVec2| {
            let p = rotation * p * 1000. + DVec2::new(300., 200.);
            egui::pos2(p.x as f32, p.y as f32)
        };
        let pointer = project(DVec2::new(0.2, 0.22));
        assert!(board_topstitch_distance(pointer, &[a, b], 3, 0.02, &project) < 0.01);
        assert!(board_topstitch_distance(pointer, &[a, b], 1, 0.02, &project) > 8.);
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: "left".into(),
            kind: TrimKind::Topstitch {
                path_m: vec![a, b],
                rows: 3,
                spacing_m: 0.02,
            },
        };
        let context = egui::Context::default();
        let paint = |budget: &mut usize| {
            let mut output = context.run_ui(egui::RawInput::default(), |ui| {
                paint_trim_2d(
                    &ui.ctx().layer_painter(egui::LayerId::background()),
                    &project,
                    &trim,
                    budget,
                    Color32::WHITE,
                );
            });
            output.textures_delta.clear();
            output.shapes.len()
        };
        let mut budget = 4;
        assert_eq!(paint(&mut budget), 3);
        assert_eq!(budget, 0);
        let mut budget = 3;
        assert_eq!(paint(&mut budget), 0);
        assert_eq!(budget, 0);
    }

    #[test]
    fn board_trim_hit_testing_matches_visible_strips() {
        let angle = glam::DMat2::from_angle(0.73);
        let project = |p: DVec2| {
            let p = angle * p * 1000. + DVec2::new(300., 200.);
            egui::pos2(p.x as f32, p.y as f32)
        };
        let points = [DVec2::ZERO, DVec2::new(0.2, 0.), DVec2::new(0.2, 0.1)];
        let inside = project(DVec2::new(0.1, 0.009));
        let outside = project(DVec2::new(0.1, 0.019));
        assert_eq!(
            board_trim_distance(inside, &points, Some(0.02), &project),
            0.
        );
        assert!(board_trim_distance(outside, &points, Some(0.02), &project) > 8.);
        assert!(board_trim_distance(inside, &points, None, &project) > 8.);
        let second_segment = project(DVec2::new(0.209, 0.05));
        assert_eq!(
            board_trim_distance(second_segment, &points, Some(0.02), &project),
            0.
        );
        let near_join = project(DVec2::new(0.199, 0.009));
        assert_eq!(
            board_trim_distance(near_join, &points, Some(0.02), &project),
            0.
        );
        // Overlapping interiors choose the closer center line; exact ties stay stable.
        assert!(closer_trim((0., 3.), (0., 5.)));
        assert!(!closer_trim((0., 5.), (0., 5.)));
        assert!(closer_trim((2., 20.), (3., 1.)));
        assert!(
            projected_strip_distance(egui::pos2(0., 0.), [egui::pos2(f32::NAN, 0.); 4]).is_none()
        );
        assert!(
            projected_strip_distance(egui::pos2(100., 100.), [egui::pos2(0., 0.); 4]).unwrap() > 8.
        );
    }

    #[test]
    fn material_strip_preview_tracks_width_rotation_and_budget() {
        let a = DVec2::new(0.1, 0.2);
        let b = DVec2::new(0.3, 0.2);
        let corners = strip_corners(a, b, 0.02).unwrap();
        assert!((corners[0].distance(corners[3]) - 0.02).abs() < 1e-14);
        assert!((corners[1].distance(corners[2]) - 0.02).abs() < 1e-14);
        let rotation = glam::DMat2::from_angle(0.71);
        let translation = DVec2::new(2., -3.);
        let transformed =
            strip_corners(translation + rotation * a, translation + rotation * b, 0.02).unwrap();
        for (original, rotated) in corners.into_iter().zip(transformed) {
            assert!((translation + rotation * original).distance(rotated) < 1e-14);
        }
        assert!(strip_corners(a, a, 0.02).is_none());
        assert!(strip_corners(a, b, f64::NAN).is_none());
        assert!(strip_corners(a, a + DVec2::new(1e-6, 0.), 0.02).is_some());

        let trim = Trim {
            id: "trim_1".into(),
            panel_id: "left".into(),
            kind: TrimKind::Buttonhole {
                start_m: a,
                end_m: b,
                width_m: 0.02,
            },
        };
        let context = egui::Context::default();
        let paint = |trim: &Trim, budget: &mut usize| {
            let mut output = context.run_ui(egui::RawInput::default(), |ui| {
                let painter = ui.ctx().layer_painter(egui::LayerId::background());
                paint_trim_2d(
                    &painter,
                    &|p| egui::pos2(p.x as f32, p.y as f32),
                    trim,
                    budget,
                    Color32::WHITE,
                );
            });
            output.textures_delta.clear();
            output.shapes.len()
        };
        let mut budget = 6;
        assert_eq!(paint(&trim, &mut budget), 5);
        assert_eq!(budget, 0);
        let mut budget = 5;
        assert_eq!(paint(&trim, &mut budget), 0);
        assert_eq!(budget, 0);
        let zipper = Trim {
            kind: TrimKind::Zipper {
                path_m: vec![a, b, b + DVec2::Y * 0.1],
                width_m: 0.02,
            },
            ..trim
        };
        let mut budget = 11;
        assert_eq!(paint(&zipper, &mut budget), 10);
        assert_eq!(budget, 0);
    }

    #[test]
    fn changing_or_reselecting_a_tool_cancels_unfinished_trim_gestures() {
        use super::super::authoring_ui::{AuthoringUi, Tool, prepare_tool_transition};
        let template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "zip".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
                width_m: 0.01,
            },
        };
        let mut authoring = AuthoringUi {
            tool: Tool::Draw,
            ..Default::default()
        };
        let mut draft = TrimDraft::from_trim(&trim);
        draft.begin_path();
        draft.append_path_point(DVec2::new(0.08, 0.08)).unwrap();
        authoring.trims.draft = Some(draft);
        assert!(prepare_tool_transition(&mut authoring, Tool::Draw, false));
        assert!(!authoring.trims.board_placement_active());
        assert_eq!(
            authoring.trims.draft.as_ref().unwrap().parse().unwrap(),
            trim
        );
        assert!(!authoring.history.can_undo());
        assert!(!prepare_tool_transition(&mut authoring, Tool::Draw, false));
        authoring.trims.draft.as_mut().unwrap().place_on_board = true;
        assert!(prepare_tool_transition(&mut authoring, Tool::Sew, false));
        assert!(!authoring.trims.board_placement_active());
        assert_eq!(
            authoring.trims.draft.as_ref().unwrap().parse().unwrap(),
            trim
        );
        assert!(!authoring.history.can_undo());
    }

    #[test]
    fn three_dimensional_trim_pick_respects_visibility_and_original_ids() {
        use glam::DVec3;
        let paths = vec![
            (2, true, vec![Some(DVec3::new(20., 20., 1.))]),
            (
                7,
                false,
                vec![
                    Some(DVec3::new(10., 20., 2.)),
                    Some(DVec3::new(30., 20., 2.)),
                ],
            ),
        ];
        let project = |p: DVec3| Some((egui::pos2(p.x as f32, p.y as f32), 1.));
        let pointer = egui::pos2(20., 20.);
        assert_eq!(
            pick_visible_trim(pointer, &paths, &project, &mut |p| p.z == 1.),
            Some(2)
        );
        assert_eq!(
            pick_visible_trim(pointer, &paths, &project, &mut |p| p.z == 2.),
            Some(7)
        );
        assert_eq!(
            pick_visible_trim(pointer, &paths, &project, &mut |_| false),
            None
        );
        assert_eq!(
            pick_visible_trim(egui::pos2(20., 40.), &paths, &project, &mut |_| true),
            None
        );
        // An occluder at the cursor is not bypassed by visible endpoints.
        assert_eq!(
            pick_visible_trim(pointer, &paths[1..], &project, &mut |p| p.x != 20.),
            None
        );
    }

    #[test]
    fn named_board_clicks_stage_a_rotated_path_without_editing_the_template() {
        use super::super::authoring_smoke::widget_harness::{Harness, named};
        struct Case {
            board: super::super::board::Board,
            template: GarmentTemplate,
            draft: TrimDraft,
            origin: DVec2,
            angle: f64,
        }
        let template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "draft".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
                width_m: 0.01,
            },
        };
        let mut draft = TrimDraft::from_trim(&trim);
        draft.begin_path();
        let mut board = super::super::board::Board::default();
        board.set_view_rotation_degrees(33.);
        let mut case = Case {
            board,
            template,
            draft,
            origin: DVec2::new(0.4, -0.2),
            angle: 47.,
        };
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(400., 400.), egui::Sense::click_and_drag());
            named(ui, &response, "trim.board");
            if response.clicked()
                && let Some(pos) = response.interact_pointer_pos()
            {
                let local = board_local_point(&case.board, rect, pos, case.origin, case.angle);
                stage_board_click(&mut case.draft, local).unwrap();
            }
        };
        let mut harness = Harness::new(egui::vec2(500., 500.));
        harness.frame(&mut case, &mut draw);
        harness.click("trim.board", &mut case, &mut draw).unwrap();
        assert_eq!(case.draft.draw_points.len(), 1);
        assert!(case.template.trims.is_empty());
        let first = case.draft.draw_points[0];
        case.origin += authoring::rotate_2d(DVec2::new(-0.1, -0.2), case.angle);
        harness.frame(&mut case, &mut draw);
        harness.click("trim.board", &mut case, &mut draw).unwrap();
        assert_eq!(case.draft.draw_points.len(), 2);
        assert!((case.draft.draw_points[1] - first).distance(DVec2::new(0.1, 0.2)) < 1e-6);
        assert!(case.template.trims.is_empty());
        case.draft.cancel_path();
        assert_eq!(case.draft.parse().unwrap(), trim);
    }

    #[test]
    fn inspector_created_trim_survives_mirrored_panel_copy() {
        use super::super::authoring_smoke::widget_harness::Harness;
        use marvelous_cloth::garment::shapes::{MirrorAxis, Primitive, primitive};
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
            panel: String,
        }
        let mut template = GarmentTemplate::two_panel_demo();
        template.version = 2;
        template.seams.clear();
        template.panels[0].pins.clear();
        template.panels[0].polygon = Some(
            primitive(
                Primitive::Rectangle,
                DVec2::new(0.4, 0.6),
                90.,
                Default::default(),
            )
            .unwrap(),
        );
        let panel = template.panels[0].id.clone();
        let mut case = Case {
            ui: TrimUi::default(),
            template,
            panel,
        };
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let panel = case
                .template
                .panels
                .iter()
                .find(|p| p.id == case.panel)
                .unwrap()
                .clone();
            if let Some(command) = trim_controls(ui, &mut case.ui, &case.template, &panel) {
                if let Command::SetTrim { trim } = &command {
                    validate_surface(trim, &case.template.compile().unwrap()).unwrap();
                }
                case.template = authoring::apply(&case.template, command).unwrap().template;
                case.ui.draft = None;
            }
        };
        let mut harness = Harness::new(egui::vec2(1000., 700.));
        harness.frame(&mut case, &mut draw);
        harness.click("trim.section", &mut case, &mut draw).unwrap();
        harness.click("trim.new", &mut case, &mut draw).unwrap();
        case.ui.draft.as_mut().unwrap().points = "100, 200".into();
        harness.click("trim.apply", &mut case, &mut draw).unwrap();
        let original = case.template.trims[0].clone();
        let edit = authoring::apply(
            &case.template,
            Command::Mirror {
                panel: case.panel.clone(),
                axis: MirrorAxis::X,
                copy_side: Some(1),
            },
        )
        .unwrap();
        case.panel = edit.selected.unwrap();
        case.template = edit.template;
        let mirrored = case
            .template
            .trims
            .iter()
            .find(|t| t.panel_id == case.panel)
            .unwrap()
            .clone();
        assert_ne!(mirrored.id, original.id);
        assert_eq!(
            mirrored.kind,
            TrimKind::Button {
                center_m: DVec2::new(0.4 - 0.1, 0.2),
                diameter_m: 0.018
            }
        );
        let garment = std::sync::Arc::new(case.template.compile().unwrap());
        let preview = build_preview(garment, &case.template.trims).unwrap();
        assert_eq!(preview.paths.len(), 2);
        assert_eq!(preview.skipped, 0);
        assert_eq!(preview.paths[1].2[0].uv, DVec2::new(0.4 - 0.1, 0.2));
        harness.frame(&mut case, &mut draw);
        harness
            .click(&format!("trim.edit.{}", mirrored.id), &mut case, &mut draw)
            .unwrap();
        assert_eq!(case.ui.draft.as_ref().unwrap().parse().unwrap(), mirrored);
    }

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
            if index == 1 {
                let previous = case.ui.draft.as_ref().unwrap().points.clone();
                harness.click("trim.draw", &mut case, &mut draw).unwrap();
                harness.frame(&mut case, &mut draw);
                assert!(
                    harness
                        .click("trim.finish_path", &mut case, &mut draw)
                        .is_err()
                );
                let draft = case.ui.draft.as_mut().unwrap();
                stage_board_click(draft, DVec2::new(0.05, 0.05)).unwrap();
                harness.frame(&mut case, &mut draw);
                assert!(
                    harness
                        .click("trim.finish_path", &mut case, &mut draw)
                        .is_err()
                );
                let draft = case.ui.draft.as_mut().unwrap();
                stage_board_click(draft, DVec2::new(0.1, 0.1)).unwrap();
                let points = draft.points.clone();
                assert!(stage_board_click(draft, DVec2::new(0.15, 0.15)).is_err());
                assert_eq!(draft.points, points);
                assert!(case.template.trims.is_empty());
                harness.frame(&mut case, &mut draw);
                harness
                    .click("trim.cancel_path", &mut case, &mut draw)
                    .unwrap();
                assert_eq!(case.ui.draft.as_ref().unwrap().points, previous);
                harness.frame(&mut case, &mut draw);
                harness.click("trim.draw", &mut case, &mut draw).unwrap();
                let draft = case.ui.draft.as_mut().unwrap();
                stage_board_click(draft, DVec2::new(0.05, 0.05)).unwrap();
                stage_board_click(draft, DVec2::new(0.1, 0.1)).unwrap();
                harness.frame(&mut case, &mut draw);
                harness
                    .click("trim.finish_path", &mut case, &mut draw)
                    .unwrap();
                harness.frame(&mut case, &mut draw);
            }
            if index == 2 {
                let previous = case.ui.draft.as_ref().unwrap().points.clone();
                harness.click("trim.draw", &mut case, &mut draw).unwrap();
                harness.frame(&mut case, &mut draw);
                assert!(harness.click("trim.apply", &mut case, &mut draw).is_err());
                harness
                    .click("trim.cancel_path", &mut case, &mut draw)
                    .unwrap();
                assert_eq!(case.ui.draft.as_ref().unwrap().points, previous);
                harness.frame(&mut case, &mut draw);
                harness.click("trim.draw", &mut case, &mut draw).unwrap();
                case.ui
                    .draft
                    .as_mut()
                    .unwrap()
                    .append_path_point(DVec2::new(0.05, 0.05))
                    .unwrap();
                harness.frame(&mut case, &mut draw);
                harness.click("trim.width", &mut case, &mut draw).unwrap();
                harness
                    .key(
                        "trim.width",
                        egui::Key::Escape,
                        egui::Modifiers::NONE,
                        &mut case,
                        &mut draw,
                    )
                    .unwrap();
                assert_eq!(case.ui.draft.as_ref().unwrap().points, previous);
                harness.frame(&mut case, &mut draw);
                harness.click("trim.draw", &mut case, &mut draw).unwrap();
                let draft = case.ui.draft.as_mut().unwrap();
                draft.append_path_point(DVec2::new(0.05, 0.05)).unwrap();
                draft.append_path_point(DVec2::new(0.1, 0.1)).unwrap();
                harness.frame(&mut case, &mut draw);
                harness
                    .click("trim.finish_path", &mut case, &mut draw)
                    .unwrap();
                harness.frame(&mut case, &mut draw);
            }
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
    fn dense_panel_paths_use_bounded_embedding_for_validation_and_preview() {
        use std::sync::Arc;
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels[0].pattern.nx = 50;
        template.panels[0].pattern.ny = 50;
        let garment = Arc::new(template.compile().unwrap());
        assert!(garment.panels[0].triangles.len().pow(2) > 8_000_000);
        let trim = Trim {
            id: "dense_zipper".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
                width_m: 0.01,
            },
        };
        validate_surface(&trim, &garment).unwrap();
        let preview = build_preview(garment, &[trim]).unwrap();
        assert_eq!(preview.skipped, 0);
        assert_eq!(preview.simplified, 0);
        assert_eq!(preview.paths.len(), 2);
    }

    #[test]
    fn long_dense_path_is_retained_for_bounded_preview() {
        use std::sync::Arc;
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels[0].pattern.nx = 100;
        template.panels[0].pattern.ny = 100;
        let garment = Arc::new(template.compile().unwrap());
        let trim = Trim {
            id: "long_zipper".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![
                    DVec2::new(0.04, 0.12),
                    DVec2::new(0.31, 0.47),
                    DVec2::new(0.02, 0.55),
                ],
                width_m: 0.01,
            },
        };
        validate_surface(&trim, &garment).unwrap();
        let mut second = trim.clone();
        second.id = "long_zipper_2".into();
        let preview = build_preview(garment, &[trim, second]).unwrap();
        assert_eq!(preview.skipped, 1);
        assert_eq!(preview.paths.len(), 1);
        assert!(preview.paths[0].2.len() > 128);
        assert!(preview.paths[0].2.len() <= MAX_PREVIEW_POINTS);
        assert!(preview.paths[0].2.len() * 2 > MAX_PREVIEW_POINTS);
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
        let attachment = &preview.paths[0].2[0];
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
        assert_eq!(preview.paths[0].0, 1);
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
    fn path_drawing_bounds_and_cancel_preserve_the_prior_draft() {
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: "panel".into(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::ZERO, DVec2::X],
                width_m: 0.01,
            },
        };
        let mut draft = TrimDraft::from_trim(&trim);
        let original = draft.points.clone();
        draft.begin_path();
        assert!(draft.append_path_point(DVec2::splat(f64::NAN)).is_err());
        for i in 0..128 {
            draft
                .append_path_point(DVec2::new(i as f64 * 0.001, 0.))
                .unwrap();
        }
        assert!(draft.append_path_point(DVec2::new(1., 0.)).is_err());
        draft.cancel_path();
        assert_eq!(draft.points, original);
        assert_eq!(draft.parse().unwrap(), trim);
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
