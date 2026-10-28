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
    place_on_3d: bool,
    draw_backup: Option<String>,
    draw_points: Vec<DVec2>,
    original: Option<Trim>,
    base: Option<Trim>,
    repeat: bool,
    repeat_copies: usize,
    repeat_offset_mm: [f64; 2],
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

fn stage_surface_hit(draft: &mut TrimDraft, hit: Option<(String, DVec2)>) -> Result<bool, String> {
    let Some((panel, uv)) = hit else {
        return Ok(false);
    };
    if panel != draft.panel {
        return Ok(false);
    }
    stage_board_click(draft, uv)?;
    Ok(true)
}

/// Resolve the nearest visible cloth hit into its panel-local material UV.
/// This is an editor click query, not a physical collision test.
fn visible_material_hit(
    garment: &marvelous_cloth::garment::CompiledGarment,
    state: &marvelous_cloth::model::State,
    origin: glam::DVec3,
    direction: glam::DVec3,
    avatar_occludes: impl Fn(glam::DVec3, glam::DVec3, f64) -> bool,
) -> Result<Option<(String, DVec2)>, String> {
    if !origin.is_finite()
        || !direction.is_finite()
        || direction.length_squared() < 1e-24
        || state.x.len() != garment.mesh.uv.len()
        || garment.mesh.triangles.len() > 100_000
    {
        return Err("Cannot pick this cloth surface".into());
    }
    let direction = direction.normalize();
    if !direction.is_finite() || direction.length_squared() < 0.5 {
        return Err("Cannot pick this cloth surface".into());
    }
    let mut closest: Option<(usize, f64, [f64; 3])> = None;
    for (face, tri) in garment.mesh.triangles.iter().enumerate() {
        if tri.vertices.iter().any(|i| {
            *i >= state.x.len() || !state.x[*i].is_finite() || !garment.mesh.uv[*i].is_finite()
        }) {
            return Err("Invalid cloth geometry for 3D placement".into());
        }
        if let Some((distance, weights)) = marvelous_cloth::picking::ray_triangle(
            origin,
            direction,
            tri.vertices.map(|i| state.x[i]),
        ) && distance.is_finite()
            && weights.iter().all(|w| w.is_finite())
            && closest
                .as_ref()
                .is_none_or(|(_, previous, _)| distance < *previous)
        {
            closest = Some((face, distance, weights));
        }
    }
    let Some((face, distance, weights)) = closest else {
        return Ok(None);
    };
    if avatar_occludes(origin, direction, (distance - 1e-5).max(0.)) {
        return Ok(None);
    }
    let panel = garment
        .panels
        .iter()
        .find(|p| p.triangles.contains(&face))
        .ok_or("Cloth hit has no owning panel")?;
    let tri = &garment.mesh.triangles[face];
    let uv = tri
        .vertices
        .into_iter()
        .zip(weights)
        .map(|(i, w)| garment.mesh.uv[i] * w)
        .sum::<DVec2>();
    if !uv.is_finite() {
        return Err("Non-finite material coordinate".into());
    }
    Ok(Some((panel.id.clone(), uv)))
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

/// Pick among trims belonging to the board's already-resolved topmost panel.
fn pick_board_trim(
    trims: &[Trim],
    owner: &str,
    screen: egui::Pos2,
    project: &impl Fn(DVec2) -> egui::Pos2,
) -> Option<usize> {
    let mut best: Option<((f32, f32), usize)> = None;
    let mut remaining = 4096usize;
    for (index, trim) in trims.iter().enumerate() {
        if trim.panel_id != owner {
            continue;
        }
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
        let distance = if let Some((rows, spacing)) = topstitch {
            board_topstitch_distance(screen, &points, rows, spacing, project)
        } else {
            board_trim_distance(screen, &points, width, project)
        };
        let score = (
            distance,
            board_trim_distance(screen, &points, None, project),
        );
        if distance <= 8.
            && best
                .as_ref()
                .is_none_or(|(old, _)| closer_trim(score, *old))
        {
            best = Some((score, index));
        }
    }
    best.map(|(_, index)| index)
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
            place_on_3d: false,
            draw_backup: None,
            draw_points: Vec::new(),
            original: Some(trim.clone()),
            base: Some(trim.clone()),
            repeat: false,
            repeat_copies: 3,
            repeat_offset_mm: [20., 0.],
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
        self.place_on_3d = false;
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
        self.place_on_3d = false;
    }
}

fn next_id(items: &[Trim]) -> String {
    let used: std::collections::HashSet<&str> = items.iter().map(|trim| trim.id.as_str()).collect();
    (1..)
        .map(|i| format!("trim_{i}"))
        .find(|id| !used.contains(id.as_str()))
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

/// Validate the complete repeated set with a shared work budget before the
/// caller records history or installs any of it.
fn prepare_repeat(
    template: &marvelous_cloth::garment::GarmentTemplate,
    garment: &marvelous_cloth::garment::CompiledGarment,
    draft: &TrimDraft,
) -> Result<authoring::Edit, String> {
    check_draft_revision(draft, template)?;
    let original = draft.base.as_ref().ok_or("Select a saved trim first")?;
    let panel = garment
        .panels
        .iter()
        .find(|p| p.id == original.panel_id)
        .ok_or("Panel no longer exists")?;
    let n = panel.triangles.len();
    let segments = match &original.kind {
        TrimKind::Button { .. } => None,
        TrimKind::Buttonhole { .. } => Some(1),
        TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
            Some(path_m.len().saturating_sub(1))
        }
    };
    let direct = segments.map_or(n, |s| n.saturating_mul(n).saturating_mul(s));
    let per_copy = if direct <= 8_000_000 {
        direct
    } else if n <= 20_000 && segments.is_some() {
        2_000_000
    } else {
        return Err("Repeat surface check exceeds the work limit".into());
    };
    if per_copy.saturating_mul(draft.repeat_copies) > 8_000_000 {
        return Err(
            "Repeat surface check exceeds the work limit; reduce the count or mesh density".into(),
        );
    }
    let edit = authoring::apply(
        template,
        Command::RepeatTrim {
            id: original.id.clone(),
            copies: draft.repeat_copies,
            offset_m: DVec2::new(draft.repeat_offset_mm[0], draft.repeat_offset_mm[1]) * 0.001,
        },
    )?;
    if edit.reset_simulation {
        return Err("Repeat unexpectedly changed physical state".into());
    }
    for trim in &edit.template.trims[template.trims.len()..] {
        validate_surface(trim, garment)?;
    }
    Ok(edit)
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

/// Assemble bounded display-only inputs. The staged object replaces its old
/// preview and is never inserted in the document until the author confirms it.
fn preview_inputs<'a>(
    committed: &'a [Trim],
    draft: Option<&TrimDraft>,
) -> (std::borrow::Cow<'a, [Trim]>, Option<(usize, usize)>, bool) {
    let mut inputs = std::borrow::Cow::Borrowed(committed);
    let Some(draft) = draft else {
        return (inputs, None, false);
    };
    if draft.repeat {
        let Some(base) = draft.base.as_ref() else {
            return (inputs, None, true);
        };
        if !committed.iter().any(|item| item == base) || !(1..=128).contains(&draft.repeat_copies) {
            return (inputs, None, true);
        }
        let offset = DVec2::new(draft.repeat_offset_mm[0], draft.repeat_offset_mm[1]) * 0.001;
        if !offset.is_finite() || offset.length_squared() < 1e-24 {
            return (inputs, None, true);
        }
        let first = match &base.kind {
            TrimKind::Button { center_m, .. } => *center_m,
            TrimKind::Buttonhole { start_m, .. } => *start_m,
            TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => {
                let Some(point) = path_m.first() else {
                    return (inputs, None, true);
                };
                *point
            }
        };
        let start = inputs.len();
        let point_count = |trim: &Trim| match &trim.kind {
            TrimKind::Button { .. } => 1usize,
            TrimKind::Buttonhole { .. } => 2,
            TrimKind::Zipper { path_m, .. } | TrimKind::Topstitch { path_m, .. } => path_m.len(),
        };
        let used_points = committed
            .iter()
            .fold(0usize, |sum, trim| sum.saturating_add(point_count(trim)));
        let point_slots = 4096usize.saturating_sub(used_points) / point_count(base).max(1);
        let count = draft
            .repeat_copies
            .min(16)
            .min(128usize.saturating_sub(start))
            .min(point_slots);
        for i in 1..=count {
            let Ok(copy) = translate_first_point(base.clone(), first + offset * i as f64) else {
                let added = inputs.len() - start;
                return (inputs, (added > 0).then_some((start, added)), true);
            };
            inputs.to_mut().push(copy);
        }
        return (
            inputs,
            (count > 0).then_some((start, count)),
            count < draft.repeat_copies,
        );
    }
    let staged = if draft.draw_backup.is_some() && draft.draw_points.len() == 1 {
        Some(Trim {
            id: draft.id.clone(),
            panel_id: draft.panel.clone(),
            kind: TrimKind::Button {
                center_m: draft.draw_points[0],
                diameter_m: 0.01,
            },
        })
    } else if draft.draw_backup.is_some() && draft.draw_points.is_empty() {
        None
    } else {
        draft.parse().ok()
    };
    let Some(staged) = staged else {
        return (inputs, None, false);
    };
    if let Some(index) = draft
        .base
        .as_ref()
        .and_then(|base| inputs.iter().position(|item| item.id == base.id))
    {
        inputs.to_mut()[index] = staged;
        return (inputs, Some((index, 1)), false);
    }
    if inputs.len() >= 128 {
        return (inputs, None, true);
    }
    let index = inputs.len();
    inputs.to_mut().push(staged);
    (inputs, Some((index, 1)), false)
}

impl TrimUi {
    pub(super) fn has_pending_history_step(&self) -> bool {
        self.draft.as_ref().is_some_and(|draft| {
            draft.repeat
                || draft.place_on_board
                || draft.place_on_3d
                || draft.draw_backup.is_some()
                || draft
                    .base
                    .as_ref()
                    .is_none_or(|base| !draft.parse().as_ref().is_ok_and(|current| current == base))
        })
    }

    /// Cancel a transient step before document history, or refuse redo while
    /// that step is pending. Clean saved selections do not intercept history.
    pub(super) fn intercept_history(&mut self, redo: bool) -> Option<&'static str> {
        if !self.has_pending_history_step() {
            return None;
        }
        if redo {
            return Some("Finish or cancel the trim draft before redoing");
        }
        let draft = self.draft.as_mut().expect("pending trim draft");
        if draft.repeat {
            draft.repeat = false;
            return Some("Trim repeat cancelled · Undo again for document history");
        }
        if draft.place_on_board || draft.place_on_3d || draft.draw_backup.is_some() {
            draft.place_on_board = false;
            draft.place_on_3d = false;
            draft.cancel_path();
            Some("Trim gesture cancelled · Undo again for document history")
        } else {
            self.draft = None;
            Some("Trim draft cancelled · Undo again for document history")
        }
    }

    /// An active trim draft owns Delete, even when it cannot be deleted yet.
    /// `None` means there is no trim draft and panel deletion may proceed.
    pub(super) fn delete_shortcut(
        &self,
        template: &marvelous_cloth::garment::GarmentTemplate,
        edit_mode: bool,
    ) -> Option<Result<Command, String>> {
        let draft = self.draft.as_ref()?;
        Some((|| {
            if !edit_mode
                || draft.base.is_none()
                || draft.repeat
                || draft.draw_backup.is_some()
                || draft.place_on_board
                || draft.place_on_3d
            {
                return Err("Finish or cancel the trim operation before deleting".into());
            }
            check_draft_revision(draft, template)?;
            Ok(Command::RemoveTrim {
                id: draft.id.clone(),
            })
        })())
    }

    pub(super) fn clear_deleted_draft(&mut self) {
        self.draft = None;
    }

    /// Display-only copies; material coordinates stay in the owning panel frame.
    pub(super) fn repeat_board_previews(&self, panel: &str, committed: &[Trim]) -> Vec<Trim> {
        let Some(draft) = self
            .draft
            .as_ref()
            .filter(|draft| draft.repeat && draft.panel == panel)
        else {
            return Vec::new();
        };
        let (inputs, range, _) = preview_inputs(committed, Some(draft));
        range.map_or_else(Vec::new, |(start, count)| {
            inputs[start..start + count].to_vec()
        })
    }

    pub(super) fn board_placement_active(&self) -> bool {
        self.draft.as_ref().is_some_and(|draft| {
            draft.place_on_board || draft.place_on_3d || draft.draw_backup.is_some()
        })
    }

    pub(super) fn cancel_board_placement(&mut self) {
        if let Some(draft) = self.draft.as_mut() {
            draft.place_on_board = false;
            draft.place_on_3d = false;
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
            .filter(|d| d.panel == panel && !d.repeat)
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
        let (inputs, draft_index, draft_limit) = preview_inputs(
            &self.project.template.trims,
            self.authoring.trims.draft.as_ref(),
        );
        self.authoring
            .trims
            .refresh_preview(&self.scene.garment, &inputs);
        let Some(preview) = self.authoring.trims.preview.as_ref() else {
            if draft_limit && self.authoring.trims.preview_warning.is_none() {
                self.authoring.trims.preview_warning =
                    Some("3D draft preview incomplete: invalid input or preview limit".into());
            }
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
        if draft_limit {
            self.authoring.trims.preview_warning =
                Some("3D draft preview incomplete: invalid input or preview limit".into());
        }
        for (index, button, embedded) in &preview.paths {
            let color = if draft_index
                .is_some_and(|(start, count)| *index >= start && *index < start + count)
            {
                Color32::from_rgb(0xFF, 0xC0, 0x58)
            } else {
                Color32::from_rgb(0xEA, 0x78, 0xD4)
            };
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
    can_place_3d: bool,
) -> Option<Command> {
    if state.draft.as_ref().is_some_and(|d| d.panel != panel.id) {
        state.draft = None;
    }
    if state.draft.as_ref().is_some_and(|d| d.repeat)
        && !ui.ctx().egui_wants_keyboard_input()
        && ui.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        && let Some(draft) = state.draft.as_mut()
    {
        draft.repeat = false;
    }
    if state
        .draft
        .as_ref()
        .is_some_and(|d| d.place_on_board || d.place_on_3d || d.draw_backup.is_some())
        && ui.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        && let Some(draft) = state.draft.as_mut()
    {
        draft.place_on_board = false;
        draft.place_on_3d = false;
        draft.cancel_path();
    }
    let mut command = None;
    let section = egui::CollapsingHeader::new("Construction trims")
        .open(state.draft.as_ref().map(|_| true))
        .show(ui, |ui| {
            ui.small("Visual construction notes · no physical closures. Widths may extend outside the panel.");
            if let Some(warning) = &state.preview_warning { ui.colored_label(Color32::GOLD, warning); }
        let editing = state.draft.is_some();
            let items: Vec<_> = template.trims.iter().filter(|t| t.panel_id == panel.id).collect();
            if !items.is_empty() {
                egui::ScrollArea::vertical()
                    .id_salt(("trim-list", &panel.id))
                    .max_height(192.)
                    .show_rows(ui, 24., items.len(), |ui, rows| {
                        for i in rows {
                            let trim = items[i];
                            ui.push_id(&trim.id, |ui| {
                                ui.horizontal(|ui| {
                                    let title = format!("{} · {}", label(&trim.kind), trim.id);
                                    let edit_width = (ui.available_width() - 120.).max(30.);
                                    let edit = ui.add_enabled_ui(!editing, |ui| {
                                        ui.add_sized([edit_width, 20.], egui::Button::new(&title).small().truncate())
                                    }).inner.on_hover_text(&title);
                                    #[cfg(test)]
                                    super::authoring_smoke::widget_harness::named(ui, &edit, format!("trim.edit.{}", trim.id));
                                    if edit.clicked() { state.draft = Some(TrimDraft::from_trim(trim)); }
                                    let duplicate = ui.add_enabled(!editing, egui::Button::new("Duplicate").small())
                                        .on_hover_text("Create a movable draft copy; Apply commits it");
                                    #[cfg(test)]
                                    super::authoring_smoke::widget_harness::named(ui, &duplicate, format!("trim.duplicate.{}", trim.id));
                                    if duplicate.clicked() {
                                        let mut copy = trim.clone();
                                        copy.id = next_id(&template.trims);
                                        let mut draft = TrimDraft::from_trim(&copy);
                                        draft.base = None;
                                        state.draft = Some(draft);
                                    }
                                    let delete = ui.add_enabled(!editing, egui::Button::new("Delete").small());
                                    #[cfg(test)]
                                    super::authoring_smoke::widget_harness::named(ui, &delete, format!("trim.delete.{}", trim.id));
                                    if delete.clicked() { command = Some(Command::RemoveTrim { id: trim.id.clone() }); }
                                });
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
                        place_on_3d: false,
                        draw_backup: None,
                        draw_points: Vec::new(),
                        original: None,
                        base: None,
                        repeat: false,
                        repeat_copies: 3,
                        repeat_offset_mm: [20., 0.],
                    });
                }
            });
            if let Some(draft) = state.draft.as_mut() {
                if draft.repeat {
                    ui.strong("Repeat construction trim");
                    ui.small("Copies use panel-local millimetres; Apply checks every center or path. The 2D/3D preview shows at most 16 copies and may be incomplete in busy scenes. Escape cancels when not editing text.");
                    ui.horizontal(|ui| {
                        ui.label("Copies");
                        let count = ui.add(egui::DragValue::new(&mut draft.repeat_copies).range(1..=128));
                        #[cfg(test)] super::authoring_smoke::widget_harness::named(ui, &count, "trim.repeat.count");
                        #[cfg(not(test))] let _ = count;
                    });
                    ui.horizontal_wrapped(|ui| {
                        ui.label("Offset X / Y (mm)");
                        ui.add(egui::DragValue::new(&mut draft.repeat_offset_mm[0]).speed(1.));
                        ui.add(egui::DragValue::new(&mut draft.repeat_offset_mm[1]).speed(1.));
                    });
                    ui.horizontal(|ui| {
                        let apply = ui.button("Apply repeat");
                        #[cfg(test)] super::authoring_smoke::widget_harness::named(ui, &apply, "trim.repeat.apply");
                        if apply.clicked() {
                            command = Some(Command::RepeatTrim { id: draft.id.clone(), copies: draft.repeat_copies,
                                offset_m: DVec2::new(draft.repeat_offset_mm[0], draft.repeat_offset_mm[1]) * 0.001 });
                        }
                        let cancel = ui.button("Cancel repeat");
                        #[cfg(test)] super::authoring_smoke::widget_harness::named(ui, &cancel, "trim.repeat.cancel");
                        if cancel.clicked() { draft.repeat = false; }
                    });
                } else {
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
                    draft.place_on_3d = false;
                }
                if draft.place_on_board { ui.small("Click the panel to position the first point · Escape cancels"); }
                let place_3d = ui.add_enabled(can_place_3d && draft.draw_backup.is_none(), egui::Button::new("Position first point on 3D cloth"))
                    .on_disabled_hover_text("Choose Edit mode and finish drawing first");
                #[cfg(test)]
                super::authoring_smoke::widget_harness::named(ui, &place_3d, "trim.place_3d");
                if place_3d.clicked() {
                    draft.place_on_board = false;
                    draft.place_on_3d = true;
                }
                if draft.place_on_3d && draft.draw_backup.is_none() { ui.small("Click the visible owning panel in 3D · Escape cancels"); }
                if matches!(draft.kind, 1..=3) {
                    if draft.draw_backup.is_none() {
                        let draw = ui.button("Draw path on 2D board");
                        #[cfg(test)]
                        super::authoring_smoke::widget_harness::named(ui, &draw, "trim.draw");
                        if draw.clicked() { draft.begin_path(); }
                        let draw_3d = ui.add_enabled(can_place_3d, egui::Button::new("Draw path on 3D cloth"))
                            .on_disabled_hover_text("Choose Edit mode first");
                        #[cfg(test)]
                        super::authoring_smoke::widget_harness::named(ui, &draw_3d, "trim.draw_3d");
                        if draw_3d.clicked() { draft.begin_path(); draft.place_on_3d = true; }
                    } else {
                        ui.small(if draft.place_on_3d && draft.kind == 1 {
                            "Click the two buttonhole endpoints on the visible panel in 3D"
                        } else if draft.place_on_3d {
                            "Click points on the visible panel in 3D · 128 points maximum"
                        } else if draft.kind == 1 {
                            "Click the two buttonhole endpoints on the selected panel"
                        } else {
                            "Click points on the selected panel · 128 points maximum"
                        });
                        ui.horizontal(|ui| {
                            let finish = ui.add_enabled(draft.parse().is_ok(), egui::Button::new("Finish path"));
                            #[cfg(test)]
                            super::authoring_smoke::widget_harness::named(ui, &finish, "trim.finish_path");
                            if finish.clicked() { draft.draw_backup = None; draft.draw_points.clear(); draft.place_on_3d = false; }
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
                let linked = template.mirror_links.iter().any(|link| link.a == draft.panel || link.b == draft.panel);
                let can_repeat = !linked && draft.draw_backup.is_none() && !draft.place_on_board && !draft.place_on_3d
                    && draft.base.as_ref().is_some_and(|base| parsed.as_ref().is_ok_and(|trim| trim == base));
                let repeat = ui.add_enabled(can_repeat, egui::Button::new("Repeat…"))
                    .on_disabled_hover_text(if linked { "Unlink the mirrored panel before repeating trims" } else { "Apply or cancel changes to the saved trim before repeating it" });
                #[cfg(test)] super::authoring_smoke::widget_harness::named(ui, &repeat, "trim.repeat");
                if repeat.clicked() { draft.repeat = true; }
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
        let command = trim_controls(
            ui,
            &mut self.authoring.trims,
            &self.project.template,
            panel,
            self.authoring.tool == super::authoring_ui::Tool::Edit,
        );
        if let Some(command) = command {
            if matches!(&command, Command::RepeatTrim { .. }) {
                let result = self
                    .authoring
                    .trims
                    .draft
                    .as_ref()
                    .ok_or("Repeat draft missing".to_owned())
                    .and_then(|draft| {
                        prepare_repeat(&self.project.template, &self.scene.garment, draft)
                    });
                match result {
                    Ok(edit) => {
                        self.authoring.history.record(self.project.template.clone());
                        self.install_edit(edit);
                        self.authoring.trims.draft = None;
                    }
                    Err(error) => {
                        self.authoring.error = Some(error.clone());
                        self.status = error;
                    }
                }
                return;
            }
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
        let Some(index) = self
            .project
            .template
            .panels
            .iter()
            .position(|p| p.id == owner)
        else {
            return false;
        };
        let origin = self.board_origin(index);
        let angle = self.board_angle(index);
        let screen_point = |p| {
            self.authoring
                .board
                .screen(rect, origin + authoring::rotate_2d(p, angle))
        };
        let Some(trim_index) =
            pick_board_trim(&self.project.template.trims, owner, screen, &screen_point)
        else {
            return false;
        };
        let trim = self.project.template.trims[trim_index].clone();
        self.select_panel(trim.panel_id.clone(), false);
        self.authoring.trims.draft = Some(TrimDraft::from_trim(&trim));
        self.status = format!("Selected {} · {}", label(&trim.kind), trim.id);
        true
    }

    pub(super) fn trim_3d_placement_active(&self) -> bool {
        self.authoring
            .trims
            .draft
            .as_ref()
            .is_some_and(|draft| draft.place_on_3d)
    }

    /// Stage a 3D surface hit in the existing material-space draft.
    pub(super) fn place_trim_on_3d(&mut self, rect: egui::Rect, screen: egui::Pos2) {
        if !self.trim_3d_placement_active() {
            return;
        }
        let (origin, direction) = self.camera.ray(screen, rect);
        let hit = visible_material_hit(
            &self.scene.garment,
            &self.scene.state,
            origin,
            direction,
            |origin, direction, distance| {
                self.scene
                    .collider
                    .occludes_ray(origin, direction, distance)
            },
        );
        let draft = self
            .authoring
            .trims
            .draft
            .as_mut()
            .expect("active trim draft");
        match hit.and_then(|hit| stage_surface_hit(draft, hit)) {
            Ok(true) => {
                self.status = if draft.draw_backup.is_some() {
                    "Path point staged · Finish path to continue".into()
                } else {
                    "Trim position staged · Apply to commit".into()
                }
            }
            Ok(false) => self.status = "Click the visible owning panel to position the trim".into(),
            Err(error) => {
                self.authoring.error = Some(error.clone());
                self.status = error;
            }
        }
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
        if draft.place_on_3d {
            self.status = "Continue placing this trim on the 3D cloth".into();
            return true;
        }
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
    fn trim_controls_report_pending_work_for_pin_mode_exclusion() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
        }
        let mut template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(trim);
        let before = serde_json::to_vec(&template).unwrap();
        let mut c = Case {
            ui: TrimUi::default(),
            template,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            let panel = c.template.panels[0].clone();
            assert!(trim_controls(ui, &mut c.ui, &c.template, &panel, true).is_none());
        };
        let mut h = Harness::new(egui::vec2(1000., 900.));
        h.frame(&mut c, &mut draw);
        h.click("trim.section", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        assert!(!c.ui.has_pending_history_step());
        h.click("trim.edit.trim_1", &mut c, &mut draw).unwrap();
        assert!(!c.ui.has_pending_history_step());
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat", &mut c, &mut draw).unwrap();
        assert!(c.ui.has_pending_history_step());
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat.cancel", &mut c, &mut draw).unwrap();
        assert!(!c.ui.has_pending_history_step());
        h.frame(&mut c, &mut draw);
        h.click("trim.place_3d", &mut c, &mut draw).unwrap();
        assert!(c.ui.has_pending_history_step());
        c.ui.cancel_board_placement();
        assert!(!c.ui.has_pending_history_step());
        h.frame(&mut c, &mut draw);
        h.replace_text("trim.width", "invalid", &mut c, &mut draw)
            .unwrap();
        assert!(c.ui.has_pending_history_step());
        h.click("trim.cancel", &mut c, &mut draw).unwrap();
        assert!(!c.ui.has_pending_history_step());
        h.frame(&mut c, &mut draw);
        h.click("trim.new", &mut c, &mut draw).unwrap();
        assert!(c.ui.has_pending_history_step());
        h.click("trim.cancel", &mut c, &mut draw).unwrap();
        assert!(!c.ui.has_pending_history_step());
        assert_eq!(serde_json::to_vec(&c.template).unwrap(), before);
    }

    #[test]
    fn pending_trim_history_cancels_gesture_then_draft_without_touching_history() {
        let mut template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.1, 0.1), DVec2::new(0.2, 0.1)],
                width_m: 0.01,
            },
        };
        template.trims.push(trim.clone());
        let mut history = authoring::History::default();
        history.record(template.clone());
        let original = serde_json::to_vec(&template).unwrap();
        let mut ui = TrimUi::default();
        assert!(!ui.has_pending_history_step());
        ui.draft = Some(TrimDraft::from_trim(&trim));
        assert!(!ui.has_pending_history_step());
        assert_eq!(ui.intercept_history(false), None);
        assert_eq!(ui.intercept_history(true), None);

        ui.draft.as_mut().unwrap().width = "invalid".into();
        assert!(ui.has_pending_history_step());
        assert!(ui.intercept_history(true).is_some());
        assert_eq!(ui.draft.as_ref().unwrap().width, "invalid");
        assert!(ui.intercept_history(false).is_some());
        assert!(ui.draft.is_none());

        let mut draft = TrimDraft::from_trim(&trim);
        draft.base = None;
        draft.begin_path();
        draft.append_path_point(DVec2::new(0.15, 0.2)).unwrap();
        ui.draft = Some(draft);
        assert!(ui.intercept_history(false).is_some());
        let restored = ui.draft.as_ref().unwrap();
        assert!(restored.draw_backup.is_none());
        assert_eq!(restored.points, TrimDraft::from_trim(&trim).points);
        assert!(ui.has_pending_history_step()); // Unsaved new item remains.
        assert!(ui.intercept_history(false).is_some());
        assert!(ui.draft.is_none());

        ui.draft = Some(TrimDraft::from_trim(&trim));
        ui.draft.as_mut().unwrap().place_on_board = true;
        assert!(ui.intercept_history(false).is_some());
        assert!(!ui.has_pending_history_step());
        assert!(ui.draft.is_some());
        ui.draft.as_mut().unwrap().place_on_3d = true;
        assert!(ui.intercept_history(false).is_some());
        assert!(!ui.has_pending_history_step());
        ui.draft.as_mut().unwrap().repeat = true;
        assert!(ui.has_pending_history_step());
        assert!(ui.intercept_history(true).is_some());
        assert!(ui.draft.as_ref().unwrap().repeat);
        assert!(ui.intercept_history(false).is_some());
        assert!(!ui.draft.as_ref().unwrap().repeat);
        assert!(!ui.has_pending_history_step());
        assert_eq!(serde_json::to_vec(&template).unwrap(), original);
        assert!(history.can_undo());
        assert!(!history.can_redo());
    }

    #[test]
    fn routed_delete_is_consumed_before_later_seam_shortcuts() {
        let mut template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(trim.clone());
        for case in 0..12 {
            let scenario = case % 6;
            let mut trims = TrimUi::default();
            if scenario <= 2 || scenario == 5 {
                let mut draft = TrimDraft::from_trim(&trim);
                if scenario == 1 {
                    draft.base = None; // Unsaved creation.
                }
                if scenario == 2 {
                    draft.base.as_mut().unwrap().id = "stale".into();
                }
                if scenario == 5 {
                    draft.repeat = true;
                }
                trims.draft = Some(draft);
            }
            let ctx = egui::Context::default();
            let mut observed = None;
            let input = egui::RawInput {
                focused: true,
                events: vec![egui::Event::Key {
                    key: egui::Key::Delete,
                    physical_key: None,
                    pressed: true,
                    repeat: false,
                    modifiers: if case >= 6 {
                        egui::Modifiers {
                            ctrl: true,
                            command: true,
                            ..Default::default()
                        }
                    } else {
                        egui::Modifiers::NONE
                    },
                }],
                ..Default::default()
            };
            let mut output = ctx.run_ui(input, |ui| {
                let routed = super::super::selection::delete_target(
                    ui.ctx(),
                    &trims,
                    &template,
                    true,
                    scenario == 3,
                    vec![trim.panel_id.clone()],
                );
                let later_handler_sees_key = ui.ctx().input(|i| i.key_pressed(egui::Key::Delete));
                observed = Some((routed, later_handler_sees_key));
            });
            output.textures_delta.clear();
            let (routed, later) = observed.unwrap();
            match scenario {
                0 => assert!(matches!(routed, Some(Ok(Command::RemoveTrim { .. })))),
                1 | 2 | 5 => assert!(matches!(routed, Some(Err(_)))),
                3 => assert!(matches!(routed, Some(Ok(Command::RemovePanels { .. })))),
                _ => assert!(routed.is_none()),
            }
            assert_eq!(later, scenario == 4, "case {case}");
        }
    }

    #[test]
    fn delete_shortcut_targets_saved_trim_and_never_falls_through_a_draft() {
        let mut template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(trim.clone());
        let mut ui = TrimUi::default();
        assert!(ui.delete_shortcut(&template, true).is_none());
        ui.draft = Some(TrimDraft::from_trim(&trim));
        let command = ui.delete_shortcut(&template, true).unwrap().unwrap();
        assert!(matches!(&command, Command::RemoveTrim { id } if id == "trim_1"));
        let mut history = authoring::History::default();
        let edit = authoring::apply(&template, command).unwrap();
        assert!(!edit.reset_simulation);
        assert_eq!(edit.template.panels.len(), template.panels.len());
        assert!(edit.template.trims.is_empty());
        history.record(template.clone());
        let undo = history.restore(&edit.template, false).unwrap();
        assert_eq!(undo.template.trims, template.trims);

        let draft = ui.draft.as_mut().unwrap();
        draft.base = None;
        assert!(ui.delete_shortcut(&template, true).unwrap().is_err());
        ui.draft.as_mut().unwrap().base = Some(trim.clone());
        assert!(ui.delete_shortcut(&template, false).unwrap().is_err());
        for operation in 0..4 {
            let draft = ui.draft.as_mut().unwrap();
            draft.repeat = operation == 0;
            draft.place_on_board = operation == 1;
            draft.place_on_3d = operation == 2;
            draft.draw_backup = (operation == 3).then(String::new);
            assert!(ui.delete_shortcut(&template, true).unwrap().is_err());
        }
        ui.draft = Some(TrimDraft::from_trim(&trim));
        template.trims.clear();
        assert!(ui.delete_shortcut(&template, true).unwrap().is_err());
    }

    #[test]
    fn delete_routing_respects_text_focus_and_preserves_panel_shortcut() {
        use super::super::authoring_smoke::widget_harness::{Harness, named};
        struct Case {
            trims: TrimUi,
            template: GarmentTemplate,
            text: String,
            commands: Vec<Command>,
        }
        let mut template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "trim_1".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(trim.clone());
        let mut case = Case {
            trims: TrimUi::default(),
            template,
            text: "test".into(),
            commands: vec![],
        };
        case.trims.draft = Some(TrimDraft::from_trim(&trim));
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let text = ui.text_edit_singleline(&mut case.text);
            named(ui, &text, "delete.text");
            if let Some(Ok(command)) = super::super::selection::delete_target(
                ui.ctx(),
                &case.trims,
                &case.template,
                true,
                true,
                vec![trim.panel_id.clone()],
            ) {
                case.commands.push(command);
            }
        };
        let mut harness = Harness::new(egui::vec2(400., 300.));
        harness.frame(&mut case, &mut draw);
        harness.click("delete.text", &mut case, &mut draw).unwrap();
        harness
            .key(
                "delete.text",
                egui::Key::Delete,
                egui::Modifiers::NONE,
                &mut case,
                &mut draw,
            )
            .unwrap();
        assert!(case.commands.is_empty());
        harness.ctx.memory_mut(|memory| {
            if let Some(focus) = memory.focused() {
                memory.surrender_focus(focus);
            }
        });
        let input = || egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::vec2(400., 300.),
            )),
            focused: true,
            events: [true, false]
                .map(|pressed| egui::Event::Key {
                    key: egui::Key::Delete,
                    physical_key: None,
                    pressed,
                    repeat: false,
                    modifiers: egui::Modifiers::NONE,
                })
                .to_vec(),
            ..Default::default()
        };
        let _ = harness.ctx.run_ui(input(), |ui| {
            egui::CentralPanel::default().show(ui, |ui| draw(ui, &mut case));
        });
        assert!(matches!(case.commands.pop(), Some(Command::RemoveTrim { id }) if id == "trim_1"));
        case.trims.draft = None;
        let _ = harness.ctx.run_ui(input(), |ui| {
            egui::CentralPanel::default().show(ui, |ui| draw(ui, &mut case));
        });
        assert!(
            matches!(case.commands.pop(), Some(Command::RemovePanels { panels }) if panels == vec![trim.panel_id.clone()])
        );
    }

    #[test]
    #[ignore = "opt-in CPU dense trim picking benchmark"]
    fn benchmark_dense_surface_pick_cpu() {
        use glam::DVec3;
        let mut template = GarmentTemplate::two_panel_demo();
        template.seams.clear();
        let mut third = template.panels[0].clone();
        third.id = "benchmark_third".into();
        third.placement.translation += DVec3::new(3., 0., 0.);
        template.panels.push(third);
        for panel in &mut template.panels {
            panel.pattern.nx = 128;
            panel.pattern.ny = 128;
        }
        let garment = template.compile().unwrap();
        assert_eq!(garment.mesh.triangles.len(), 98_304);
        let state = &garment.initial_state;
        let triangle = &garment.mesh.triangles[garment.panels[0].triangles.start];
        let p = triangle.vertices.map(|i| state.x[i]);
        let center = (p[0] + p[1] + p[2]) / 3.;
        let normal = (p[1] - p[0]).cross(p[2] - p[0]).normalize();
        let mut samples = [Vec::new(), Vec::new()];
        for i in 0..20 {
            for (which, origin, direction) in [
                (0, center + normal * 0.001, -normal),
                (1, DVec3::splat(10_000.), DVec3::X),
            ] {
                let start = std::time::Instant::now();
                let hit = visible_material_hit(&garment, state, origin, direction, |_, _, _| false)
                    .unwrap();
                if which == 0 {
                    assert!(hit.is_some());
                } else {
                    assert!(hit.is_none());
                }
                if i >= 2 {
                    samples[which].push(start.elapsed().as_secs_f64() * 1000.);
                }
            }
        }
        for (label, values) in ["hit", "miss"].into_iter().zip(&mut samples) {
            values.sort_by(f64::total_cmp);
            eprintln!(
                "98,304 triangles {label}: median {:.3} ms, p95 {:.3} ms (18 samples, excludes avatar)",
                values[values.len() / 2],
                values[((values.len() - 1) as f64 * 0.95).ceil() as usize]
            );
        }
    }

    #[test]
    fn repeat_board_previews_use_material_frame_and_shared_budget() {
        let mut template = GarmentTemplate::two_panel_demo();
        let original = Trim {
            id: "source".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(original.clone());
        let mut draft = TrimDraft::from_trim(&original);
        draft.repeat = true;
        draft.repeat_copies = 3;
        let ui = TrimUi {
            draft: Some(draft),
            ..Default::default()
        };
        let copies = ui.repeat_board_previews(&original.panel_id, &template.trims);
        assert_eq!(copies.len(), 3);
        assert!(
            ui.repeat_board_previews("other", &template.trims)
                .is_empty()
        );
        let before = serde_json::to_vec(&template).unwrap();
        let ctx = egui::Context::default();
        let mut budget = 2;
        let mut output = ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(500., 500.),
                )),
                ..Default::default()
            },
            |ui| {
                let point = |p| {
                    let p = authoring::rotate_2d(p, 90.);
                    egui::pos2(200. + p.x as f32 * 1000., 50. + p.y as f32 * 1000.)
                };
                for trim in &copies {
                    paint_trim_2d(ui.painter(), &point, trim, &mut budget, Color32::GOLD);
                }
            },
        );
        let centers: Vec<_> = output
            .shapes
            .iter()
            .filter_map(|shape| match &shape.shape {
                egui::Shape::Circle(circle) if circle.fill == Color32::GOLD => Some(circle.center),
                _ => None,
            })
            .collect();
        output.textures_delta.clear();
        assert_eq!(centers.len(), 2);
        assert!(centers[0].distance(egui::pos2(100., 170.)) < 0.01);
        assert!(centers[1].distance(egui::pos2(100., 190.)) < 0.01);
        assert_eq!(budget, 0);
        assert_eq!(serde_json::to_vec(&template).unwrap(), before);
    }

    #[test]
    fn repeat_preview_is_bounded_tracks_motion_and_never_commits() {
        let mut template = GarmentTemplate::two_panel_demo();
        let original = Trim {
            id: "source".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(original.clone());
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let before = serde_json::to_vec(&template).unwrap();
        let mut draft = TrimDraft::from_trim(&original);
        draft.repeat = true;
        draft.repeat_copies = 3;
        let (inputs, range, truncated) = preview_inputs(&template.trims, Some(&draft));
        assert_eq!(range, Some((1, 3)));
        assert!(!truncated);
        assert_eq!(inputs[0], original);
        let preview = build_preview(garment.clone(), &inputs).unwrap();
        assert_eq!(preview.skipped, 0);
        assert_eq!(preview.paths.len(), 4);
        let world = preview.paths[1].2[0]
            .evaluate(&garment.initial_state.x)
            .unwrap();
        let moved: Vec<_> = garment
            .initial_state
            .x
            .iter()
            .map(|p| *p + glam::DVec3::Y)
            .collect();
        assert!(
            (preview.paths[1].2[0].evaluate(&moved).unwrap() - world - glam::DVec3::Y).length()
                < 1e-10
        );
        assert_eq!(serde_json::to_vec(&template).unwrap(), before);
        draft.repeat_copies = 128;
        let (inputs, range, truncated) = preview_inputs(&template.trims, Some(&draft));
        assert_eq!(range, Some((1, 16)));
        assert!(truncated);
        assert_eq!(inputs.len(), 17);
        draft.repeat_offset_mm = [f64::NAN, 0.];
        let (inputs, range, truncated) = preview_inputs(&template.trims, Some(&draft));
        assert_eq!(inputs.len(), 1);
        assert!(range.is_none() && truncated);
        draft.repeat_offset_mm = [20., 0.];
        let mut changed = template.trims.clone();
        changed[0].id = "changed".into();
        let (inputs, range, truncated) = preview_inputs(&changed, Some(&draft));
        assert_eq!(inputs.len(), 1);
        assert!(range.is_none() && truncated);
        let long = Trim {
            kind: TrimKind::Zipper {
                path_m: (0..1000)
                    .map(|i| DVec2::new(i as f64 * 0.00001, 0.1))
                    .collect(),
                width_m: 0.01,
            },
            ..original.clone()
        };
        let mut long_draft = TrimDraft::from_trim(&long);
        long_draft.repeat = true;
        long_draft.repeat_copies = 16;
        let (inputs, range, truncated) =
            preview_inputs(std::slice::from_ref(&long), Some(&long_draft));
        assert_eq!(range, Some((1, 3)));
        assert!(truncated);
        assert_eq!(inputs.len(), 4);
        draft.repeat = false;
        let (_, range, truncated) = preview_inputs(&template.trims, Some(&draft));
        assert_eq!(range, Some((0, 1)));
        assert!(!truncated);
    }

    #[test]
    fn staged_3d_preview_tracks_drawing_and_cancel_without_document_edits() {
        let template = GarmentTemplate::two_panel_demo();
        let garment = std::sync::Arc::new(template.compile().unwrap());
        let trim = Trim {
            id: "draft".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.1, 0.1), DVec2::new(0.2, 0.2)],
                width_m: 0.01,
            },
        };
        let mut draft = TrimDraft::from_trim(&trim);
        draft.begin_path();
        assert!(preview_inputs(&template.trims, Some(&draft)).0.is_empty());
        draft.append_path_point(DVec2::new(0.1, 0.1)).unwrap();
        let (inputs, index, limited) = preview_inputs(&template.trims, Some(&draft));
        assert_eq!(index, Some((0, 1)));
        assert!(!limited);
        let marker = build_preview(garment.clone(), &inputs).unwrap();
        assert!(marker.paths[0].1);
        let original = marker.paths[0].2[0]
            .evaluate(&garment.initial_state.x)
            .unwrap();
        let moved: Vec<_> = garment
            .initial_state
            .x
            .iter()
            .map(|p| *p + glam::DVec3::Y)
            .collect();
        assert!(
            (marker.paths[0].2[0].evaluate(&moved).unwrap() - original - glam::DVec3::Y).length()
                < 1e-10
        );
        draft.append_path_point(DVec2::new(0.2, 0.2)).unwrap();
        let (inputs, index, _) = preview_inputs(&template.trims, Some(&draft));
        assert_eq!(index, Some((0, 1)));
        let path = build_preview(garment, &inputs).unwrap();
        assert!(!path.paths.is_empty() && !path.paths[0].1);
        assert!(template.trims.is_empty());
        draft.cancel_path();
        assert_eq!(draft.parse().unwrap(), trim);
        let (inputs, index, _) = preview_inputs(std::slice::from_ref(&trim), Some(&draft));
        assert_eq!(inputs.len(), 1);
        assert_eq!(index, Some((0, 1)));
    }

    #[test]
    fn draft_preview_respects_object_limit_and_does_not_replace_other_ids() {
        let trim = Trim {
            id: "first".into(),
            panel_id: "panel".into(),
            kind: TrimKind::Button {
                center_m: DVec2::ZERO,
                diameter_m: 0.01,
            },
        };
        let other = Trim {
            id: "other".into(),
            ..trim.clone()
        };
        let mut edit = TrimDraft::from_trim(&trim);
        edit.id = "other".into();
        let existing = [trim.clone(), other.clone()];
        let (inputs, index, limited) = preview_inputs(&existing, Some(&edit));
        assert_eq!(index, Some((0, 1)));
        assert!(!limited);
        assert_eq!(inputs[1], other);
        let mut new_draft = TrimDraft::from_trim(&trim);
        new_draft.base = None;
        let many = vec![trim; 128];
        let (inputs, index, limited) = preview_inputs(&many, Some(&new_draft));
        assert!(limited && index.is_none());
        assert_eq!(inputs.len(), 128);
    }

    #[test]
    fn surface_hit_maps_deformed_cloth_to_material_and_respects_occlusion_and_owner() {
        use glam::DVec3;
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels[1].pattern.nx = template.panels[0].pattern.nx;
        template.panels[1].pattern.ny = template.panels[0].pattern.ny;
        let garment = template.compile().unwrap();
        let mut state = garment.initial_state.clone();
        for point in &mut state.x {
            point.z += point.x * point.y * 0.05;
        }
        let panel = &garment.panels[0];
        let triangle = &garment.mesh.triangles[panel.triangles.start];
        let positions = triangle.vertices.map(|i| state.x[i]);
        let center = (positions[0] + positions[1] + positions[2]) / 3.;
        let normal = (positions[1] - positions[0])
            .cross(positions[2] - positions[0])
            .normalize();
        let expected = triangle
            .vertices
            .into_iter()
            .map(|i| garment.mesh.uv[i] / 3.)
            .sum::<DVec2>();
        let origin = center + normal * 0.001;
        let hit = visible_material_hit(&garment, &state, origin, -normal, |_, _, _| false)
            .unwrap()
            .unwrap();
        assert_eq!(hit.0, panel.id);
        assert!(hit.1.distance(expected) < 1e-10);
        assert!(
            visible_material_hit(&garment, &state, origin, -normal, |_, _, _| true)
                .unwrap()
                .is_none()
        );
        assert!(
            visible_material_hit(&garment, &state, origin, DVec3::ZERO, |_, _, _| false).is_err()
        );

        let trim = Trim {
            id: "zip".into(),
            panel_id: panel.id.clone(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.05, 0.05), DVec2::new(0.1, 0.1)],
                width_m: 0.01,
            },
        };
        let mut draft = TrimDraft::from_trim(&trim);
        draft.place_on_3d = true;
        assert!(!stage_surface_hit(&mut draft, Some(("other".into(), expected))).unwrap());
        assert_eq!(draft.parse().unwrap(), trim);
        assert!(draft.place_on_3d);
        assert!(stage_surface_hit(&mut draft, Some(hit)).unwrap());
        assert!(!draft.place_on_3d);
        let TrimKind::Zipper { path_m, .. } = draft.parse().unwrap().kind else {
            panic!("zipper expected")
        };
        assert!(path_m[0].distance(expected) < 1e-10);
        assert!((path_m[1] - path_m[0]).distance(DVec2::new(0.05, 0.05)) < 1e-10);
        let other_panel = &garment.panels[1];
        assert_eq!(panel.vertices.len(), other_panel.vertices.len());
        let mut layered = state.clone();
        for (a, b) in panel.vertices.clone().zip(other_panel.vertices.clone()) {
            layered.x[b] = state.x[a] + normal * 0.0005;
        }
        let front = visible_material_hit(&garment, &layered, origin, -normal, |_, _, _| false)
            .unwrap()
            .unwrap();
        assert_eq!(front.0, other_panel.id, "nearest layer must win");
        let mut invalid = state;
        invalid.x.pop();
        assert!(
            visible_material_hit(&garment, &invalid, origin, -normal, |_, _, _| false).is_err()
        );
    }

    #[test]
    fn three_dimensional_placement_control_requires_edit_mode() {
        use super::super::authoring_smoke::widget_harness::Harness;
        let template = GarmentTemplate::two_panel_demo();
        let trim = Trim {
            id: "button".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        let mut state = TrimUi {
            draft: Some(TrimDraft::from_trim(&trim)),
            ..Default::default()
        };
        let panel = template.panels[0].clone();
        let mut draw = |ui: &mut egui::Ui, state: &mut TrimUi| {
            trim_controls(ui, state, &template, &panel, false);
        };
        let mut h = Harness::new(egui::vec2(1000., 700.));
        h.frame(&mut state, &mut draw);
        assert!(h.click("trim.place_3d", &mut state, &mut draw).is_err());
        assert!(!state.draft.as_ref().unwrap().place_on_3d);
    }

    #[test]
    fn named_3d_path_drawing_stages_cancels_and_applies_once() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
            history: authoring::History,
        }
        let mut case = Case {
            ui: TrimUi {
                kind: 2,
                ..Default::default()
            },
            template: GarmentTemplate::two_panel_demo(),
            history: Default::default(),
        };
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let panel = case.template.panels[0].clone();
            if let Some(command) = trim_controls(ui, &mut case.ui, &case.template, &panel, true) {
                let edit = authoring::apply(&case.template, command).unwrap();
                assert!(!edit.reset_simulation);
                case.history.record(case.template.clone());
                case.template = edit.template;
                case.ui.draft = None;
            }
        };
        let mut h = Harness::new(egui::vec2(1000., 700.));
        h.frame(&mut case, &mut draw);
        h.click("trim.section", &mut case, &mut draw).unwrap();
        h.click("trim.new", &mut case, &mut draw).unwrap();
        let previous = case.ui.draft.as_ref().unwrap().points.clone();
        h.click("trim.draw_3d", &mut case, &mut draw).unwrap();
        let panel = case.template.panels[0].id.clone();
        let draft = case.ui.draft.as_mut().unwrap();
        assert!(draft.place_on_3d && draft.draw_backup.is_some());
        assert!(!stage_surface_hit(draft, Some(("other".into(), DVec2::new(0.1, 0.1)))).unwrap());
        assert!(stage_surface_hit(draft, Some((panel.clone(), DVec2::new(0.1, 0.1)))).unwrap());
        assert!(draft.place_on_3d);
        h.frame(&mut case, &mut draw);
        assert!(h.click("trim.finish_path", &mut case, &mut draw).is_err());
        h.click("trim.width", &mut case, &mut draw).unwrap();
        h.key(
            "trim.width",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut case,
            &mut draw,
        )
        .unwrap();
        assert_eq!(case.ui.draft.as_ref().unwrap().points, previous);
        assert!(!case.ui.draft.as_ref().unwrap().place_on_3d);
        h.frame(&mut case, &mut draw);
        h.click("trim.draw_3d", &mut case, &mut draw).unwrap();
        assert!(
            stage_surface_hit(
                case.ui.draft.as_mut().unwrap(),
                Some((panel.clone(), DVec2::new(0.1, 0.1)))
            )
            .unwrap()
        );
        h.frame(&mut case, &mut draw);
        h.click("trim.cancel_path", &mut case, &mut draw).unwrap();
        assert_eq!(case.ui.draft.as_ref().unwrap().points, previous);
        h.frame(&mut case, &mut draw);
        h.click("trim.draw_3d", &mut case, &mut draw).unwrap();
        let draft = case.ui.draft.as_mut().unwrap();
        for point in [
            DVec2::new(0.1, 0.1),
            DVec2::new(0.2, 0.2),
            DVec2::new(0.3, 0.2),
        ] {
            assert!(stage_surface_hit(draft, Some((panel.clone(), point))).unwrap());
        }
        h.frame(&mut case, &mut draw);
        h.click("trim.finish_path", &mut case, &mut draw).unwrap();
        assert!(!case.ui.draft.as_ref().unwrap().place_on_3d);
        assert!(case.template.trims.is_empty() && !case.history.can_undo());
        h.click("trim.apply", &mut case, &mut draw).unwrap();
        assert_eq!(case.template.trims.len(), 1);
        let TrimKind::Zipper { path_m, .. } = &case.template.trims[0].kind else {
            panic!("zipper expected")
        };
        assert_eq!(
            path_m,
            &vec![
                DVec2::new(0.1, 0.1),
                DVec2::new(0.2, 0.2),
                DVec2::new(0.3, 0.2)
            ]
        );
        let undo = case.history.restore(&case.template, false).unwrap();
        assert!(undo.template.trims.is_empty());
    }

    #[test]
    fn three_dimensional_buttonhole_drawing_keeps_two_endpoint_limit() {
        let trim = Trim {
            id: "hole".into(),
            panel_id: "left".into(),
            kind: TrimKind::Buttonhole {
                start_m: DVec2::new(0.1, 0.1),
                end_m: DVec2::new(0.2, 0.1),
                width_m: 0.01,
            },
        };
        let mut draft = TrimDraft::from_trim(&trim);
        draft.begin_path();
        draft.place_on_3d = true;
        for p in [DVec2::new(0.12, 0.2), DVec2::new(0.22, 0.2)] {
            assert!(stage_surface_hit(&mut draft, Some(("left".into(), p))).unwrap());
        }
        let staged = draft.points.clone();
        assert!(
            stage_surface_hit(&mut draft, Some(("left".into(), DVec2::new(0.3, 0.2)))).is_err()
        );
        assert_eq!(draft.points, staged);
        draft.cancel_path();
        assert!(!draft.place_on_3d);
        assert_eq!(draft.parse().unwrap(), trim);
    }

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
    fn named_board_click_resolves_overlapping_panel_and_hole_owner() {
        use super::super::authoring_smoke::widget_harness::{Harness, named};
        use marvelous_cloth::garment::{
            domain::Hole,
            shapes::{Primitive, primitive},
        };
        struct Case {
            board: super::super::board::Board,
            template: GarmentTemplate,
            trims: Vec<Trim>,
            at: DVec2,
            selected: Option<usize>,
        }
        let mut template = GarmentTemplate::two_panel_demo();
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
        template.panels[1].polygon = Some(polygon);
        let button = |id: &str, panel: &str, p: DVec2| Trim {
            id: id.into(),
            panel_id: panel.into(),
            kind: TrimKind::Button {
                center_m: p,
                diameter_m: 0.02,
            },
        };
        let mut board = super::super::board::Board::default();
        board.set_view_rotation_degrees(33.);
        let mut case = Case {
            board,
            template,
            at: DVec2::new(0.1, 0.3),
            selected: None,
            trims: vec![
                button("left_outer", "left", DVec2::new(0.1, 0.3)),
                button("right_outer", "right", DVec2::new(0.1, 0.3)),
                button("left_hole", "left", DVec2::new(0.2, 0.3)),
                button("right_hole", "right", DVec2::new(0.2, 0.3)),
                button("right_edge", "right", DVec2::new(0.15, 0.3)),
            ],
        };
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(400., 400.), egui::Sense::click());
            named(ui, &response, "trim.owner.canvas");
            if response.clicked()
                && let Some(pointer) = response.interact_pointer_pos()
            {
                let angle = 23.;
                let origin =
                    case.board.world(rect, rect.center()) - authoring::rotate_2d(case.at, angle);
                let owner = super::super::board::panel_body_owner(
                    case.template
                        .panels
                        .iter()
                        .rev()
                        .map(|panel| (panel, panel.polygon.as_ref(), origin, angle)),
                    case.board.world(rect, pointer),
                );
                let project = |p| {
                    case.board
                        .screen(rect, origin + authoring::rotate_2d(p, angle))
                };
                case.selected =
                    owner.and_then(|id| pick_board_trim(&case.trims, id, pointer, &project));
            }
        };
        let mut harness = Harness::new(egui::vec2(500., 500.));
        for (at, expected) in [
            (DVec2::new(0.1, 0.3), Some(1)),
            (DVec2::new(0.2, 0.3), Some(2)),
            (DVec2::new(0.15, 0.3), Some(4)),
            (DVec2::new(0.6, 0.3), None),
        ] {
            case.at = at;
            harness.frame(&mut case, &mut draw);
            harness
                .click("trim.owner.canvas", &mut case, &mut draw)
                .unwrap();
            assert_eq!(case.selected, expected, "{at:?}");
        }
    }

    #[test]
    fn named_board_click_picks_owned_trim_and_nearest_visible_geometry() {
        use super::super::authoring_smoke::widget_harness::{Harness, named};
        struct Case {
            trims: Vec<Trim>,
            owner: String,
            at: DVec2,
            selected: Option<usize>,
        }
        let zipper = |id: &str, panel: &str, y: f64| Trim {
            id: id.into(),
            panel_id: panel.into(),
            kind: TrimKind::Zipper {
                path_m: vec![DVec2::new(0.1, y), DVec2::new(0.3, y)],
                width_m: 0.04,
            },
        };
        let points = vec![
            DVec2::new(0.1, 0.1),
            DVec2::new(0.2, 0.1),
            DVec2::new(0.2, 0.2),
        ];
        let rows = topstitch_paths(&points, 2, 0.02).unwrap();
        let bevel_midpoint = (rows[0][1] + rows[0][2]) * 0.5;
        let mut case = Case {
            trims: vec![
                zipper("first", "front", 0.1),
                zipper("near", "front", 0.115),
                zipper("back", "back", 0.1),
                Trim {
                    id: "row".into(),
                    panel_id: "stitch".into(),
                    kind: TrimKind::Topstitch {
                        path_m: points,
                        rows: 2,
                        spacing_m: 0.02,
                    },
                },
            ],
            owner: "front".into(),
            at: DVec2::new(0.2, 0.114),
            selected: None,
        };
        let mut draw = |ui: &mut egui::Ui, case: &mut Case| {
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(400., 400.), egui::Sense::click());
            named(ui, &response, "trim.pick.canvas");
            if response.clicked()
                && let Some(pointer) = response.interact_pointer_pos()
            {
                let rotation = glam::DMat2::from_angle(0.53);
                let project = |p: DVec2| {
                    let p = rotation * (p - case.at) * 1000.;
                    rect.center() + egui::vec2(p.x as f32, p.y as f32)
                };
                case.selected = pick_board_trim(&case.trims, &case.owner, pointer, &project);
            }
        };
        let mut harness = Harness::new(egui::vec2(500., 500.));
        harness.frame(&mut case, &mut draw);
        harness
            .click("trim.pick.canvas", &mut case, &mut draw)
            .unwrap();
        assert_eq!(case.selected, Some(1));
        case.owner = "back".into();
        case.at = DVec2::new(0.2, 0.1);
        harness.frame(&mut case, &mut draw);
        harness
            .click("trim.pick.canvas", &mut case, &mut draw)
            .unwrap();
        assert_eq!(case.selected, Some(2));
        case.owner = "stitch".into();
        case.at = bevel_midpoint;
        harness.frame(&mut case, &mut draw);
        harness
            .click("trim.pick.canvas", &mut case, &mut draw)
            .unwrap();
        assert_eq!(case.selected, Some(3));
        case.at = DVec2::new(0.8, 0.8);
        harness.frame(&mut case, &mut draw);
        harness
            .click("trim.pick.canvas", &mut case, &mut draw)
            .unwrap();
        assert_eq!(case.selected, None);
        let oversized = Trim {
            id: "oversized".into(),
            panel_id: "front".into(),
            kind: TrimKind::Topstitch {
                path_m: vec![DVec2::ZERO; 1024],
                rows: 8,
                spacing_m: 0.01,
            },
        };
        assert_eq!(
            pick_board_trim(
                &[oversized, case.trims[0].clone()],
                "front",
                egui::Pos2::ZERO,
                &|p| egui::pos2(p.x as f32, p.y as f32)
            ),
            None
        );
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
        authoring.tool = Tool::Edit;
        authoring.trims.draft.as_mut().unwrap().place_on_3d = true;
        assert!(prepare_tool_transition(&mut authoring, Tool::Edit, false));
        assert!(!authoring.trims.draft.as_ref().unwrap().place_on_3d);
        assert_eq!(
            authoring.trims.draft.as_ref().unwrap().parse().unwrap(),
            trim
        );
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
            if let Some(command) = trim_controls(ui, &mut case.ui, &case.template, &panel, true) {
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
    fn repeat_install_preserves_held_drape_worker_flags_and_saved_project() {
        use super::super::authoring_ui::{AuthoringUi, EditorTransition};
        use marvelous_cloth::{
            authoring::prepare_pin_edit, fitting::FittingProject, garment::presets::GarmentKind,
        };
        let dir = tempfile::tempdir().unwrap();
        let avatar = dir.path().join("avatar.obj");
        std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
        let file = dir.path().join("repeat.clothcraft");
        let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
        project.template = GarmentTemplate::two_panel_demo();
        project.template.seams.clear();
        for (i, panel) in project.template.panels.iter_mut().enumerate() {
            panel.pins.clear();
            panel.pattern.nx = 2;
            panel.pattern.ny = 2;
            panel.placement.translation.x += i as f64 * 4.;
        }
        let garment = project.template.compile().unwrap();
        let mut initial = garment.initial_state.clone();
        let free = garment.panels[1].vertices.start;
        initial.time = 5.;
        initial.v[free] = glam::DVec3::new(0.1, 0.2, 0.3);
        let panel = garment.panels[0].id.clone();
        let center = garment.mesh.uv[garment.panels[0].vertices.start + 4];
        let (held_edit, held) = prepare_pin_edit(
            &project.template,
            &garment,
            &initial,
            &panel,
            &[center],
            true,
        )
        .unwrap();
        let original = Trim {
            id: "source".into(),
            panel_id: panel,
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        project.template = authoring::apply(
            &held_edit.template,
            Command::SetTrim {
                trim: original.clone(),
            },
        )
        .unwrap()
        .template;
        project.state = Some(held.clone());
        project.save(&file).unwrap();
        let mut project = FittingProject::load(&file).unwrap();
        let mut scene = project.compile().unwrap();
        let retained_mesh = scene.garment.clone();
        let signature = project.mesh_signature.clone();
        let mut authoring = AuthoringUi::default();
        let mut issue = super::super::issue_ui::IssueUi::default();
        let mut dirty = false;
        let mut generation = 12;
        let mut playing = true;
        let mut pending = true;
        let mut metrics = None;
        let mut grab = None;
        let mut plane = None;
        let mut error = None;
        let mut status = String::new();
        let mut editor = EditorTransition {
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
        let mut draft = TrimDraft::from_trim(&original);
        draft.repeat = true;
        let edit = prepare_repeat(&editor.project.template, &editor.scene.garment, &draft).unwrap();
        editor
            .authoring
            .history
            .record(editor.project.template.clone());
        editor.install(edit);
        assert_eq!(editor.project.template.trims.len(), 4);
        assert!(*editor.playing && *editor.pending && *editor.generation == 12);
        assert!(std::sync::Arc::ptr_eq(
            &retained_mesh,
            &editor.scene.garment
        ));
        assert_eq!(editor.project.mesh_signature, signature);
        assert_eq!(editor.scene.state.x, held.x);
        assert_eq!(editor.scene.state.v, held.v);
        assert_eq!(editor.scene.state.time, held.time);
        for (redo, count) in [(false, 1), (true, 4)] {
            let edit = editor
                .authoring
                .history
                .restore(&editor.project.template, redo)
                .unwrap();
            editor.install(edit);
            assert_eq!(editor.project.template.trims.len(), count);
            assert!(*editor.playing && *editor.pending && *editor.generation == 12);
            assert!(std::sync::Arc::ptr_eq(
                &retained_mesh,
                &editor.scene.garment
            ));
            assert_eq!(editor.scene.state.x, held.x);
            assert_eq!(editor.scene.state.v, held.v);
            assert_eq!(editor.scene.state.time, held.time);
        }
        editor.project.state = Some(editor.scene.state.clone());
        editor.project.save(&file).unwrap();
        let reopened = FittingProject::load(&file).unwrap();
        let scene = reopened.compile().unwrap();
        assert_eq!(scene.state.x, held.x);
        assert_eq!(scene.state.v, held.v);
        assert_eq!(scene.state.time, held.time);
        assert_eq!(reopened.template.trims, editor.project.template.trims);
        assert_eq!(
            reopened.template.pin_targets,
            editor.project.template.pin_targets
        );
        assert_eq!(reopened.template.pin_targets.len(), 1);
    }

    #[test]
    fn linked_repeat_is_disabled_and_escape_cancels_only_outside_text_input() {
        use super::super::authoring_smoke::widget_harness::Harness;
        use marvelous_cloth::garment::{shapes::MirrorAxis, template::MirrorLink};
        let mut template = GarmentTemplate::two_panel_demo();
        let original = Trim {
            id: "source".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(original.clone());
        template.mirror_links.push(MirrorLink {
            a: template.panels[0].id.clone(),
            b: template.panels[1].id.clone(),
            axis: MirrorAxis::X,
        });
        let panel = template.panels[0].clone();
        let mut state = TrimUi {
            draft: Some(TrimDraft::from_trim(&original)),
            ..Default::default()
        };
        let before = serde_json::to_vec(&template).unwrap();
        let mut h = Harness::new(egui::vec2(1000., 700.));
        let mut draw = |ui: &mut egui::Ui, state: &mut TrimUi| {
            assert!(trim_controls(ui, state, &template, &panel, true).is_none());
        };
        h.frame(&mut state, &mut draw);
        assert!(h.click("trim.repeat", &mut state, &mut draw).is_err());
        assert!(!state.draft.as_ref().unwrap().repeat);
        let ctx = egui::Context::default();
        let mut text = String::new();
        let mut frame = |focus_text: bool, escape: bool, state: &mut TrimUi| {
            let events = if escape {
                vec![egui::Event::Key {
                    key: egui::Key::Escape,
                    physical_key: None,
                    pressed: true,
                    repeat: false,
                    modifiers: egui::Modifiers::NONE,
                }]
            } else {
                vec![]
            };
            let mut output = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(1000., 700.),
                    )),
                    focused: true,
                    events,
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        if focus_text {
                            ui.text_edit_singleline(&mut text).request_focus();
                        }
                        assert!(trim_controls(ui, state, &template, &panel, true).is_none());
                    });
                },
            );
            output.textures_delta.clear();
        };
        state.draft.as_mut().unwrap().repeat = true;
        frame(true, false, &mut state);
        frame(true, true, &mut state);
        assert!(state.draft.as_ref().unwrap().repeat);
        ctx.memory_mut(|m| m.surrender_focus(m.focused().unwrap()));
        frame(false, false, &mut state);
        frame(false, true, &mut state);
        assert!(!state.draft.as_ref().unwrap().repeat);
        assert_eq!(state.draft.as_ref().unwrap().parse().unwrap(), original);
        assert_eq!(serde_json::to_vec(&template).unwrap(), before);
    }

    #[test]
    fn named_repeat_validates_all_copies_and_commits_once() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
            history: authoring::History,
            error: Option<String>,
        }
        let mut template = GarmentTemplate::two_panel_demo();
        let source = Trim {
            id: "source".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(source.clone());
        let mut c = Case {
            ui: TrimUi::default(),
            template,
            history: Default::default(),
            error: None,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            let panel = c.template.panels[0].clone();
            if let Some(command) = trim_controls(ui, &mut c.ui, &c.template, &panel, true)
                && matches!(command, Command::RepeatTrim { .. })
            {
                let garment = c.template.compile().unwrap();
                match prepare_repeat(&c.template, &garment, c.ui.draft.as_ref().unwrap()) {
                    Ok(edit) => {
                        c.history.record(c.template.clone());
                        c.template = edit.template;
                        c.ui.draft = None;
                        c.error = None;
                    }
                    Err(error) => c.error = Some(error),
                }
            }
        };
        let mut h = Harness::new(egui::vec2(1100., 900.));
        h.frame(&mut c, &mut draw);
        h.click("trim.section", &mut c, &mut draw).unwrap();
        h.click("trim.edit.source", &mut c, &mut draw).unwrap();
        h.resize(egui::vec2(240., 900.));
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat", &mut c, &mut draw).unwrap();
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat.cancel", &mut c, &mut draw).unwrap();
        assert_eq!(c.template.trims, vec![source.clone()]);
        assert!(!c.history.can_undo());
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat", &mut c, &mut draw).unwrap();
        c.ui.draft.as_mut().unwrap().repeat_offset_mm = [10000., 0.];
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat.apply", &mut c, &mut draw).unwrap();
        assert!(c.error.is_some());
        assert_eq!(c.template.trims, vec![source.clone()]);
        assert!(!c.history.can_undo());
        c.ui.draft.as_mut().unwrap().repeat_offset_mm = [20., 0.];
        h.frame(&mut c, &mut draw);
        h.click("trim.repeat.apply", &mut c, &mut draw).unwrap();
        assert!(c.error.is_none(), "{:?}", c.error);
        assert_eq!(c.template.trims.len(), 4);
        let undo = c.history.restore(&c.template, false).unwrap();
        assert_eq!(undo.template.trims, vec![source]);
        assert!(!undo.reset_simulation);
    }

    #[test]
    fn repeat_surface_budget_and_stale_source_fail_atomically() {
        let mut template = GarmentTemplate::two_panel_demo();
        let original = Trim {
            id: "source".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
        };
        template.trims.push(original.clone());
        let garment = template.compile().unwrap();
        let mut draft = TrimDraft::from_trim(&original);
        draft.repeat = true;
        let mut changed = template.clone();
        changed.trims[0].kind = TrimKind::Button {
            center_m: DVec2::new(0.2, 0.1),
            diameter_m: 0.01,
        };
        assert!(prepare_repeat(&changed, &garment, &draft).is_err());
        let mut oversized = garment.clone();
        oversized.panels[0].triangles = 0..100_000;
        draft.repeat_copies = 128;
        assert!(
            prepare_repeat(&template, &oversized, &draft)
                .err()
                .unwrap()
                .contains("work limit")
        );
        assert_eq!(template.trims, vec![original]);
    }

    #[test]
    fn repeat_rejects_a_copy_inside_a_hole_without_partial_edit() {
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
        let original = Trim {
            id: "source".into(),
            panel_id: template.panels[0].id.clone(),
            kind: TrimKind::Button {
                center_m: DVec2::new(0.1, 0.3),
                diameter_m: 0.01,
            },
        };
        template.trims.push(original.clone());
        let garment = template.compile().unwrap();
        let mut draft = TrimDraft::from_trim(&original);
        draft.repeat = true;
        draft.repeat_copies = 2;
        draft.repeat_offset_mm = [50., 0.];
        let before = serde_json::to_vec(&template).unwrap();
        assert!(prepare_repeat(&template, &garment, &draft).is_err());
        assert_eq!(serde_json::to_vec(&template).unwrap(), before);
    }

    #[test]
    fn trim_ids_choose_lowest_unused_with_gaps_and_dense_inputs() {
        let make = |id: String| Trim {
            id,
            panel_id: "panel".into(),
            kind: TrimKind::Button {
                center_m: DVec2::ZERO,
                diameter_m: 0.01,
            },
        };
        let mut items: Vec<_> = (1..=4096).map(|i| make(format!("trim_{i}"))).collect();
        assert_eq!(next_id(&items), "trim_4097");
        items.remove(1);
        items.push(make("trim_02".into()));
        items.push(make("trim_0".into()));
        assert_eq!(next_id(&items), "trim_2");
        assert_eq!(next_id(&[]), "trim_1");
    }

    #[test]
    fn trim_list_virtualizes_and_scrolls_to_last_narrow_row() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
            top: egui::Pos2,
        }
        let mut template = GarmentTemplate::two_panel_demo();
        for i in 0..1000 {
            template.trims.push(Trim {
                id: format!("item_{i}"),
                panel_id: template.panels[0].id.clone(),
                kind: TrimKind::Button {
                    center_m: DVec2::new(0.1, 0.1),
                    diameter_m: 0.01,
                },
            });
        }
        let mut case = Case {
            ui: TrimUi::default(),
            template,
            top: egui::Pos2::ZERO,
        };
        let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
            c.top = ui.next_widget_position();
            let panel = c.template.panels[0].clone();
            assert!(trim_controls(ui, &mut c.ui, &c.template, &panel, true).is_none());
        };
        let mut h = Harness::new(egui::vec2(240., 500.));
        h.frame(&mut case, &mut draw);
        h.click("trim.section", &mut case, &mut draw).unwrap();
        assert!(
            h.click("trim.duplicate.item_999", &mut case, &mut draw)
                .is_err()
        );
        let pointer = case.top + egui::vec2(35., 65.);
        let mut output = h.ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(240., 500.),
                )),
                time: Some(0.055),
                focused: true,
                events: vec![
                    egui::Event::PointerMoved(pointer),
                    egui::Event::MouseWheel {
                        unit: egui::MouseWheelUnit::Point,
                        delta: egui::vec2(0., -100_000.),
                        phase: egui::TouchPhase::Move,
                        modifiers: egui::Modifiers::NONE,
                    },
                ],
                ..Default::default()
            },
            |ui| {
                egui::CentralPanel::default().show(ui, |ui| draw(ui, &mut case));
            },
        );
        output.textures_delta.clear();
        for _ in 0..20 {
            h.frame(&mut case, &mut draw);
        }
        h.click("trim.duplicate.item_999", &mut case, &mut draw)
            .unwrap();
        assert_eq!(
            case.ui.draft.as_ref().unwrap().parse().unwrap().id,
            "trim_1"
        );
        assert_eq!(case.template.trims.len(), 1000);
    }

    #[test]
    fn named_duplicate_stages_all_trim_types_and_commits_one_undo() {
        use super::super::authoring_smoke::widget_harness::Harness;
        struct Case {
            ui: TrimUi,
            template: GarmentTemplate,
            history: authoring::History,
        }
        let kinds = [
            TrimKind::Button {
                center_m: DVec2::new(0.1, 0.1),
                diameter_m: 0.01,
            },
            TrimKind::Buttonhole {
                start_m: DVec2::new(0.1, 0.1),
                end_m: DVec2::new(0.2, 0.1),
                width_m: 0.01,
            },
            TrimKind::Zipper {
                path_m: vec![DVec2::new(0.1, 0.1), DVec2::new(0.2, 0.1)],
                width_m: 0.01,
            },
            TrimKind::Topstitch {
                path_m: vec![DVec2::new(0.1, 0.1), DVec2::new(0.2, 0.1)],
                rows: 2,
                spacing_m: 0.005,
            },
        ];
        for (i, kind) in kinds.into_iter().enumerate() {
            let mut template = GarmentTemplate::two_panel_demo();
            let source = Trim {
                id: "source".into(),
                panel_id: template.panels[0].id.clone(),
                kind,
            };
            template.trims.push(source.clone());
            let mut case = Case {
                ui: TrimUi::default(),
                template,
                history: Default::default(),
            };
            let mut draw = |ui: &mut egui::Ui, c: &mut Case| {
                let panel = c.template.panels[0].clone();
                if let Some(command) = trim_controls(ui, &mut c.ui, &c.template, &panel, true) {
                    if let Command::SetTrim { trim } = &command {
                        check_draft_revision(c.ui.draft.as_ref().unwrap(), &c.template).unwrap();
                        validate_surface(trim, &c.template.compile().unwrap()).unwrap();
                    }
                    let edit = authoring::apply(&c.template, command).unwrap();
                    assert!(!edit.reset_simulation);
                    c.history.record(c.template.clone());
                    c.template = edit.template;
                    c.ui.draft = None;
                }
            };
            let mut h = Harness::new(egui::vec2(1100., 900.));
            h.frame(&mut case, &mut draw);
            h.click("trim.section", &mut case, &mut draw).unwrap();
            h.click("trim.duplicate.source", &mut case, &mut draw)
                .unwrap();
            let draft = case.ui.draft.as_ref().unwrap();
            let copy = draft.parse().unwrap();
            assert_ne!(copy.id, source.id);
            assert_eq!(copy.kind, source.kind);
            assert!(draft.base.is_none());
            let mut changed = case.template.clone();
            changed.trims.push(copy.clone());
            assert!(check_draft_revision(draft, &changed).is_err());
            assert_eq!(case.template.trims, vec![source.clone()]);
            h.click("trim.cancel", &mut case, &mut draw).unwrap();
            assert!(case.ui.draft.is_none() && !case.history.can_undo());
            h.frame(&mut case, &mut draw);
            h.click("trim.duplicate.source", &mut case, &mut draw)
                .unwrap();
            let draft = case.ui.draft.as_mut().unwrap();
            if i % 2 == 0 {
                stage_board_click(draft, DVec2::new(0.12, 0.12)).unwrap();
            } else {
                assert!(
                    stage_surface_hit(
                        draft,
                        Some((source.panel_id.clone(), DVec2::new(0.12, 0.12)))
                    )
                    .unwrap()
                );
            }
            h.frame(&mut case, &mut draw);
            h.click("trim.apply", &mut case, &mut draw).unwrap();
            assert_eq!(case.template.trims.len(), 2);
            assert_eq!(case.template.trims[0], source);
            assert_ne!(case.template.trims[1].id, source.id);
            let undo = case.history.restore(&case.template, false).unwrap();
            assert_eq!(undo.template.trims, vec![source]);
            assert!(!undo.reset_simulation);
        }
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
            if let Some(command) = trim_controls(ui, &mut case.ui, &case.template, &panel, true) {
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
        harness
            .click("trim.place_3d", &mut case, &mut draw)
            .unwrap();
        assert!(case.ui.draft.as_ref().unwrap().place_on_3d);
        harness.click("trim.points", &mut case, &mut draw).unwrap();
        harness
            .key(
                "trim.points",
                egui::Key::Escape,
                egui::Modifiers::NONE,
                &mut case,
                &mut draw,
            )
            .unwrap();
        assert!(!case.ui.draft.as_ref().unwrap().place_on_3d);
        assert!(case.template.trims.is_empty() && !case.history.can_undo());
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
