//! Transient selection and system clipboard adapters, separate from the document.
use super::*;
use glam::DVec2;
use marvelous_cloth::authoring::{Command, clipboard::PatternClipboard};
use std::collections::BTreeSet;

#[derive(Default, PartialEq, Eq, Clone, Copy)]
pub(super) enum BoxTarget {
    #[default]
    Panels,
    Points,
}

#[derive(Default, PartialEq, Eq, Clone, Copy)]
pub(super) enum SelectionShape {
    #[default]
    Box,
    Lasso,
}

/// Screen-space selection, independent of rest geometry and simulation state.
pub(super) enum Region {
    Box(egui::Rect),
    Lasso(Vec<egui::Pos2>),
}
impl Region {
    pub fn contains(&self, p: egui::Pos2) -> bool {
        match self {
            Self::Box(r) => r.contains(p),
            Self::Lasso(points) => {
                let mut inside = false;
                for (a, b) in polygon_edges(points) {
                    if super::authoring_ui::segment_distance(p, a, b) < 0.5 {
                        return true;
                    }
                    if (a.y > p.y) != (b.y > p.y)
                        && p.x < a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y)
                    {
                        inside = !inside;
                    }
                }
                inside
            }
        }
    }
    fn intersects(&self, tri: [egui::Pos2; 3]) -> bool {
        match self {
            Self::Box(r) => triangle_in_rect(tri, *r),
            Self::Lasso(points) => {
                tri.iter().any(|p| self.contains(*p))
                    || points
                        .iter()
                        .any(|p| triangle_in_rect(tri, egui::Rect::from_min_max(*p, *p)))
                    || polygon_edges(points).any(|(a, b)| {
                        polygon_edges(&tri).any(|(c, d)| segments_intersect(a, b, c, d))
                    })
            }
        }
    }
}
fn polygon_edges(points: &[egui::Pos2]) -> impl Iterator<Item = (egui::Pos2, egui::Pos2)> + '_ {
    points
        .iter()
        .copied()
        .zip(points.iter().copied().cycle().skip(1))
        .take(points.len())
}
fn segments_intersect(a: egui::Pos2, b: egui::Pos2, c: egui::Pos2, d: egui::Pos2) -> bool {
    let cross = |u: Vec2, v: Vec2| u.x * v.y - u.y * v.x;
    let ab = [cross(b - a, c - a), cross(b - a, d - a)];
    let cd = [cross(d - c, a - c), cross(d - c, b - c)];
    ab[0] * ab[1] <= 0.
        && cd[0] * cd[1] <= 0.
        && egui::Rect::from_two_pos(a, b).intersects(egui::Rect::from_two_pos(c, d))
}

#[derive(Default)]
pub(super) struct Selection {
    pub panels: BTreeSet<String>,
    pub target: BoxTarget,
    pub shape: SelectionShape,
    pub seam: Option<String>,
    pub seam_card: Option<egui::Pos2>,
    pub board_rect: Option<egui::Rect>,
    pub garment_rect: Option<egui::Rect>,
    pub clipboard: Option<PatternClipboard>,
    pub paste_count: u32,
    pub placement_marquee: Option<PlacementMarquee>,
    visibility_cache: ClothVisibilityCache,
}

pub(super) struct PlacementMarquee {
    pub start: egui::Pos2,
    pub end: egui::Pos2,
    pub through: bool,
    pub add: bool,
    pub subtract: bool,
    pub lasso: bool,
    pub path: Vec<egui::Pos2>,
    pub overflow: bool,
}

const MAX_LASSO_POINTS: usize = 128;
const MAX_LASSO_RAW_POINTS: usize = 512;
const LASSO_SIMPLIFY_TOLERANCE_PX: f32 = 1.0;

/// Simplify the open stroke before the implicit final closing edge is added.
/// Every discarded sample lies within one pixel of its retained segment.
/// The explicit work and point bounds prevent an unbounded gesture.
fn simplify_lasso(points: &[egui::Pos2]) -> Result<Vec<egui::Pos2>, String> {
    if points.len() < 3
        || points.len() > MAX_LASSO_RAW_POINTS
        || points.iter().any(|p| !p.is_finite())
    {
        return Err("Draw a lasso with at least three finite points".into());
    }
    let mut keep = vec![false; points.len()];
    keep[0] = true;
    keep[points.len() - 1] = true;
    let mut count = 2;
    let mut stack = vec![(0, points.len() - 1)];
    while let Some((first, last)) = stack.pop() {
        let mut max_distance = LASSO_SIMPLIFY_TOLERANCE_PX;
        let mut furthest = None;
        for i in first + 1..last {
            let distance =
                super::authoring_ui::segment_distance(points[i], points[first], points[last]);
            if !distance.is_finite() {
                return Err("Lasso coordinates exceed finite geometry".into());
            }
            if distance > max_distance {
                max_distance = distance;
                furthest = Some(i);
            }
        }
        if let Some(index) = furthest {
            keep[index] = true;
            count += 1;
            if count > MAX_LASSO_POINTS {
                return Err("Lasso is too complex; draw a simpler shape".into());
            }
            stack.push((first, index));
            stack.push((index, last));
        }
    }
    Ok(points
        .iter()
        .zip(keep)
        .filter_map(|(&p, keep)| keep.then_some(p))
        .collect())
}

pub(super) fn marquee_input(
    gesture: &mut Option<PlacementMarquee>,
    response: &egui::Response,
    allow_start: bool,
) -> Option<PlacementMarquee> {
    if response
        .ctx
        .input(|i| !i.focused || i.key_pressed(egui::Key::Escape))
    {
        *gesture = None;
        return None;
    }
    if allow_start
        && response.drag_started_by(egui::PointerButton::Primary)
        && let Some(start) = response.ctx.input(|i| i.pointer.press_origin())
    {
        *gesture = Some(PlacementMarquee {
            start,
            end: start,
            through: response.ctx.input(|i| i.modifiers.alt),
            add: response.ctx.input(|i| i.modifiers.shift),
            subtract: response.ctx.input(|i| i.modifiers.command),
            lasso: response.ctx.input(|i| i.key_down(egui::Key::L)),
            path: vec![start],
            overflow: false,
        });
    }
    if let Some(gesture) = gesture.as_mut()
        && let Some(pointer) = response.interact_pointer_pos()
    {
        gesture.end = pointer;
        if gesture.lasso
            && gesture
                .path
                .last()
                .is_none_or(|p| p.distance(pointer) >= 8.)
        {
            if gesture.path.len() < MAX_LASSO_RAW_POINTS {
                gesture.path.push(pointer);
            } else {
                gesture.overflow = true;
            }
        }
    }
    if response.drag_stopped_by(egui::PointerButton::Primary) {
        gesture.take()
    } else {
        None
    }
}

fn apply_marquee_selection<T: Ord>(
    mut current: BTreeSet<T>,
    hits: impl IntoIterator<Item = T>,
    add: bool,
    subtract: bool,
) -> BTreeSet<T> {
    if subtract {
        for hit in hits {
            current.remove(&hit);
        }
    } else {
        if !add {
            current.clear();
        }
        current.extend(hits);
    }
    current
}

/// Visibility broad phase, refitted from the current draped positions.
/// This is only for editor markers; it is not used by collision detection.
struct ClothVisibility {
    tree: marvelous_cloth::ogc::bvh::Bvh,
    nodes: Vec<marvelous_cloth::ogc::bvh::NodeView>,
}
// Extreme coordinates fall back to the existing exhaustive query, avoiding
// unbounded cancellation in the optional visibility accelerator.
const MAX_VISIBILITY_COORD: f64 = 1e6;
impl ClothVisibility {
    fn new(
        positions: &[glam::DVec3],
        triangles: &[marvelous_cloth::model::Triangle],
    ) -> Option<Self> {
        let boxes = visibility_bounds(positions, triangles)?;
        let tree = marvelous_cloth::ogc::bvh::Bvh::new(&boxes, &vec![true; boxes.len()]);
        let nodes = tree.nodes().collect();
        Some(Self { tree, nodes })
    }
    fn occludes(
        &self,
        origin: glam::DVec3,
        direction: glam::DVec3,
        max_t: f64,
        positions: &[glam::DVec3],
        triangles: &[marvelous_cloth::model::Triangle],
    ) -> bool {
        self.any_candidate(origin, direction, max_t, |i| {
            picking::ray_triangle(
                origin,
                direction,
                triangles[i].vertices.map(|v| positions[v]),
            )
            .is_some_and(|(d, _)| d < max_t)
        })
    }
    fn any_candidate(
        &self,
        origin: glam::DVec3,
        direction: glam::DVec3,
        max_t: f64,
        mut hit: impl FnMut(usize) -> bool,
    ) -> bool {
        let mut index = 0;
        while index < self.nodes.len() {
            let node = &self.nodes[index];
            if !ray_hits_bounds(origin, direction, max_t, node.bounds) {
                index = node.escape;
                continue;
            }
            if node.children.is_none() {
                for &i in &self.tree.primitive_order()[node.start..node.end] {
                    if hit(i) {
                        return true;
                    }
                }
            }
            index += 1;
        }
        false
    }
}

fn visibility_bounds(
    positions: &[glam::DVec3],
    triangles: &[marvelous_cloth::model::Triangle],
) -> Option<Vec<marvelous_cloth::ogc::bvh::Bounds>> {
    use marvelous_cloth::ogc::bvh::Bounds;
    let mut boxes = Vec::with_capacity(triangles.len());
    for triangle in triangles {
        let [a, b, c] = triangle.vertices;
        let p = [*positions.get(a)?, *positions.get(b)?, *positions.get(c)?];
        if p.iter()
            .any(|v| !v.is_finite() || v.abs().max_element() > MAX_VISIBILITY_COORD)
        {
            return None;
        }
        let magnitude = p.iter().map(|v| v.abs().max_element()).fold(1., f64::max);
        boxes.push(Bounds::points(p).inflate(1e-12 + 16. * f64::EPSILON * magnitude));
    }
    Some(boxes)
}

/// The exact topology and position snapshots prevent using stale visibility boxes.
#[derive(Default)]
struct ClothVisibilityCache {
    tree: Option<ClothVisibility>,
    topology: Vec<[usize; 3]>,
    positions: Vec<glam::DVec3>,
}
impl ClothVisibilityCache {
    fn prepare(
        &mut self,
        positions: &[glam::DVec3],
        triangles: &[marvelous_cloth::model::Triangle],
    ) {
        let same_topology = self.tree.is_some()
            && self.topology.len() == triangles.len()
            && self
                .topology
                .iter()
                .zip(triangles)
                .all(|(a, b)| *a == b.vertices);
        if same_topology && self.positions == positions {
            return;
        }
        if same_topology {
            if let Some(boxes) = visibility_bounds(positions, triangles) {
                let tree = self.tree.as_mut().unwrap();
                tree.tree.refit(&boxes);
                tree.nodes.clear();
                tree.nodes.extend(tree.tree.nodes());
                self.positions.clear();
                self.positions.extend_from_slice(positions);
                return;
            }
            *self = Self::default();
            return;
        }
        let tree = ClothVisibility::new(positions, triangles);
        if tree.is_none() {
            *self = Self::default();
            return;
        }
        self.tree = tree;
        self.topology = triangles.iter().map(|t| t.vertices).collect();
        self.positions = positions.to_vec();
    }
}

/// Start with the exact exhaustive query. Build only after the accumulated
/// work is comparable to eight full scans, on a subsequent valid query. This
/// avoids building for cheap early occluders and adapts to mixed visibility.
struct ClothVisibilityQueries<'a> {
    positions: &'a [glam::DVec3],
    triangles: &'a [marvelous_cloth::model::Triangle],
    eligible: bool,
    attempted: bool,
    scanned: usize,
    cache: &'a mut ClothVisibilityCache,
}
impl<'a> ClothVisibilityQueries<'a> {
    fn new(
        positions: &'a [glam::DVec3],
        triangles: &'a [marvelous_cloth::model::Triangle],
        point_count: usize,
        cache: &'a mut ClothVisibilityCache,
    ) -> Self {
        Self {
            positions,
            triangles,
            eligible: point_count >= 64 && triangles.len() >= 256,
            attempted: false,
            scanned: 0,
            cache,
        }
    }
    fn occludes(&mut self, origin: glam::DVec3, direction: glam::DVec3, limit: f64) -> bool {
        if limit <= 0. {
            return false;
        }
        let valid = origin.is_finite()
            && origin.abs().max_element() <= MAX_VISIBILITY_COORD
            && direction.is_finite()
            && limit.is_finite();
        if self.eligible
            && valid
            && !self.attempted
            && self.scanned >= self.triangles.len().saturating_mul(8)
        {
            self.attempted = true;
            self.cache.prepare(self.positions, self.triangles);
        }
        if let Some(tree) = &self.cache.tree
            && self.attempted
            && valid
        {
            return tree.occludes(origin, direction, limit, self.positions, self.triangles);
        }
        let found = self.triangles.iter().position(|t| {
            picking::ray_triangle(origin, direction, t.vertices.map(|i| self.positions[i]))
                .is_some_and(|(d, _)| d < limit)
        });
        if self.eligible && !self.attempted {
            self.scanned = self
                .scanned
                .saturating_add(found.map_or(self.triangles.len(), |i| i + 1));
        }
        found.is_some()
    }
}

fn ray_hits_bounds(
    origin: glam::DVec3,
    direction: glam::DVec3,
    max_t: f64,
    bounds: marvelous_cloth::ogc::bvh::Bounds,
) -> bool {
    if max_t <= 0. {
        return false;
    }
    // Expand for rounding in the ray origin as well as in the geometry.
    // False positives are harmless: the original exact triangle test decides.
    let scale = origin
        .abs()
        .max(bounds.min.abs())
        .max(bounds.max.abs())
        .max_element()
        .max(1.);
    let margin = 32. * f64::EPSILON * scale;
    let mut lo: f64 = 0.;
    let mut hi = max_t + 32. * f64::EPSILON * max_t.abs().max(1.);
    for axis in 0..3 {
        if direction[axis] == 0. {
            if origin[axis] < bounds.min[axis] - margin || origin[axis] > bounds.max[axis] + margin
            {
                return false;
            }
        } else {
            let a = (bounds.min[axis] - margin - origin[axis]) / direction[axis];
            let b = (bounds.max[axis] + margin - origin[axis]) / direction[axis];
            lo = lo.max(a.min(b));
            hi = hi.min(a.max(b));
            if hi < lo {
                return false;
            }
        }
    }
    true
}

// Clip before perspective division, including triangles crossing the near plane.
fn clip_triangle(triangle: [glam::DVec4; 3]) -> Vec<glam::DVec4> {
    if triangle.iter().any(|p| !p.is_finite()) {
        return vec![];
    }
    let mut polygon = triangle.to_vec();
    for plane in 0..6 {
        let distance = |p: glam::DVec4| match plane {
            0 => p.w + p.x,
            1 => p.w - p.x,
            2 => p.w + p.y,
            3 => p.w - p.y,
            4 => p.z,
            _ => p.w - p.z,
        };
        let mut next = vec![];
        for i in 0..polygon.len() {
            let a = polygon[i];
            let b = polygon[(i + 1) % polygon.len()];
            let da = distance(a);
            let db = distance(b);
            if da >= 0. {
                next.push(a);
            }
            if (da >= 0.) != (db >= 0.) {
                next.push(a + (b - a) * (da / (da - db)));
            }
        }
        polygon = next;
        if polygon.is_empty() {
            break;
        }
    }
    polygon
}

/// Visible mode samples a bounded CPU depth buffer (up to 512 by 512).
/// Through mode tests projected triangle overlap without an occlusion test.
/// None is an occluder such as the avatar, never a selectable panel.
fn select_region(
    matrix: glam::Mat4,
    viewport: egui::Rect,
    selection: &Region,
    through: bool,
    triangles: impl IntoIterator<Item = (Option<usize>, [glam::DVec3; 3])>,
) -> Result<BTreeSet<usize>, String> {
    let region = match selection {
        Region::Box(rect) => *rect,
        Region::Lasso(points) => {
            if points.len() < 3
                || points.len() > MAX_LASSO_POINTS
                || points.iter().any(|p| !p.is_finite())
            {
                return Err("Draw a lasso with 3–128 finite points".into());
            }
            let origin = points[0];
            let has_area = points.windows(2).any(|pair| {
                let a = pair[0] - origin;
                let b = pair[1] - origin;
                (a.x * b.y - a.y * b.x).abs() > 0.5
            });
            if !has_area {
                return Err("Lasso needs a nonzero enclosed area".into());
            }
            egui::Rect::from_points(points)
        }
    }
    .intersect(viewport);
    if !region.is_positive() || !viewport.is_finite() || !matrix.is_finite() {
        return Ok(BTreeSet::new());
    }
    let width = region.width().ceil().clamp(1., 512.) as usize;
    let height = region.height().ceil().clamp(1., 512.) as usize;
    let mut work = 0usize;
    let mask = if let Region::Lasso(points) = selection {
        if !through {
            work = width.saturating_mul(height).saturating_mul(points.len());
            if work > 30_000_000 {
                return Err(
                    "Lasso exceeded its work budget; draw a smaller or simpler shape".into(),
                );
            }
            Some(
                (0..height)
                    .flat_map(|y| {
                        (0..width).map(move |x| {
                            egui::pos2(
                                region.left() + (x as f32 + 0.5) * region.width() / width as f32,
                                region.top() + (y as f32 + 0.5) * region.height() / height as f32,
                            )
                        })
                    })
                    .map(|p| selection.contains(p))
                    .collect::<Vec<_>>(),
            )
        } else {
            None
        }
    } else {
        None
    };
    let mut depth = vec![f64::INFINITY; width * height];
    let mut owners = vec![None; width * height];
    let mut selected = BTreeSet::new();
    let matrix = matrix.as_dmat4();
    for (owner, triangle) in triangles {
        if through && owner.is_none() {
            continue;
        }
        let polygon = clip_triangle(triangle.map(|p| matrix * p.extend(1.)));
        if polygon.len() < 3 || polygon.iter().any(|p| !p.is_finite() || p.w <= 0.) {
            continue;
        }
        let screen: Vec<_> = polygon
            .iter()
            .map(|p| {
                let q = p.truncate() / p.w;
                glam::DVec3::new(
                    f64::from(viewport.center().x) + q.x * f64::from(viewport.width()) * 0.5,
                    f64::from(viewport.center().y) - q.y * f64::from(viewport.height()) * 0.5,
                    q.z,
                )
            })
            .collect();
        for i in 1..screen.len() - 1 {
            let tri = [screen[0], screen[i], screen[i + 1]];
            let pos = tri.map(|p| egui::pos2(p.x as f32, p.y as f32));
            if !triangle_in_rect(pos, region) {
                continue;
            }
            if let Region::Lasso(points) = selection {
                work = work.saturating_add(points.len().saturating_mul(12));
                if work > 30_000_000 {
                    return Err(
                        "Lasso exceeded its work budget; draw a smaller or simpler shape".into(),
                    );
                }
                if !selection.intersects(pos) {
                    continue;
                }
            }
            if through {
                selected.insert(owner.unwrap());
                continue;
            }
            let bounds = egui::Rect::from_points(&pos).intersect(region);
            let grid = |p: egui::Pos2| {
                glam::DVec2::new(
                    f64::from((p.x - region.left()) / region.width()) * width as f64,
                    f64::from((p.y - region.top()) / region.height()) * height as f64,
                )
            };
            let lo = grid(bounds.min);
            let hi = grid(bounds.max);
            let x0 = lo.x.floor().max(0.) as usize;
            let x1 = (hi.x.ceil() as usize).min(width);
            let y0 = lo.y.floor().max(0.) as usize;
            let y1 = (hi.y.ceil() as usize).min(height);
            work = work.saturating_add((x1 - x0) * (y1 - y0));
            if work > 30_000_000 {
                return Err("Visible selection exceeded its work budget; use a smaller rectangle or Alt for through selection".into());
            }
            let a = tri[0].truncate();
            let b = tri[1].truncate();
            let c = tri[2].truncate();
            let area = (b - a).perp_dot(c - a);
            if area.abs() < 1e-12 {
                continue;
            }
            for y in y0..y1 {
                for x in x0..x1 {
                    if mask.as_ref().is_some_and(|mask| !mask[y * width + x]) {
                        continue;
                    }
                    let p = glam::DVec2::new(
                        f64::from(region.left())
                            + (x as f64 + 0.5) * f64::from(region.width()) / width as f64,
                        f64::from(region.top())
                            + (y as f64 + 0.5) * f64::from(region.height()) / height as f64,
                    );
                    let u = (b - p).perp_dot(c - p) / area;
                    let v = (c - p).perp_dot(a - p) / area;
                    let w = 1. - u - v;
                    if u < -1e-10 || v < -1e-10 || w < -1e-10 {
                        continue;
                    }
                    let z = u * tri[0].z + v * tri[1].z + w * tri[2].z;
                    let index = y * width + x;
                    if z < depth[index] || (owner.is_none() && z <= depth[index] + 1e-12) {
                        depth[index] = z;
                        owners[index] = owner;
                    }
                }
            }
        }
    }
    if !through {
        selected.extend(owners.into_iter().flatten());
    }
    Ok(selected)
}

#[cfg(test)]
fn select_rect(
    matrix: glam::Mat4,
    viewport: egui::Rect,
    region: egui::Rect,
    through: bool,
    triangles: impl IntoIterator<Item = (Option<usize>, [glam::DVec3; 3])>,
) -> Result<BTreeSet<usize>, String> {
    select_region(matrix, viewport, &Region::Box(region), through, triangles)
}

impl Atelier {
    pub(super) fn finish_placement_marquee(
        &mut self,
        viewport: egui::Rect,
        gesture: PlacementMarquee,
    ) {
        let garment = &self.scene.garment;
        let state = &self.scene.state;
        let cloth = garment.panels.iter().enumerate().flat_map(|(index, p)| {
            garment.mesh.triangles[p.triangles.clone()]
                .iter()
                .map(move |t| (Some(index), t.vertices.map(|v| state.x[v])))
        });
        let surface = &self.scene.collider.surface;
        let avatar = surface
            .triangles
            .iter()
            .map(|t| (None, t.map(|v| surface.vertices[v])));
        if gesture.overflow {
            self.status = "Lasso is too complex; draw a shorter, simpler shape".into();
            return;
        }
        let selection = if gesture.lasso {
            match simplify_lasso(&gesture.path) {
                Ok(points) => Region::Lasso(points),
                Err(error) => {
                    self.status = error;
                    return;
                }
            }
        } else {
            Region::Box(egui::Rect::from_two_pos(gesture.start, gesture.end))
        };
        match select_region(
            self.camera.matrix(viewport.width() / viewport.height()),
            viewport,
            &selection,
            gesture.through,
            cloth.chain(avatar),
        ) {
            Ok(indices) => {
                let selected = apply_marquee_selection(
                    self.selected_panels().into_iter().collect(),
                    indices
                        .into_iter()
                        .map(|i| self.scene.garment.panels[i].id.clone()),
                    gesture.add,
                    gesture.subtract,
                );
                self.authoring.selected = self
                    .authoring
                    .selected
                    .take()
                    .filter(|id| selected.contains(id))
                    .or_else(|| selected.iter().next().cloned());
                self.authoring.selection.panels = selected;
                self.authoring.edge = None;
                self.authoring.anchor = None;
                self.authoring.board.selection.clear();
                self.authoring.board.selection_panel = None;
                self.authoring.board.point_groups.clear();
                self.authoring.selection.seam = None;
                self.authoring.selection.seam_card = None;
                self.status = format!(
                    "{} panels selected · {} · {} · group placement resets selected drape",
                    self.selected_panels().len(),
                    if gesture.subtract {
                        "subtract"
                    } else if gesture.add {
                        "add"
                    } else {
                        "replace"
                    },
                    if gesture.through {
                        "through"
                    } else {
                        "visible surface samples"
                    }
                );
            }
            Err(error) => self.status = error,
        }
    }
    pub(super) fn paint_selected_points_3d(&mut self, ui: &egui::Ui, rect: egui::Rect) {
        if self.authoring.tool != Tool::Edit {
            return;
        }
        let board = &self.authoring.board;
        let selections = board.point_selections();
        let mesh = &self.scene.garment.mesh;
        let positions = &self.scene.state.x;
        let point_count: usize = selections.values().map(Vec::len).sum();
        let mut visibility = ClothVisibilityQueries::new(
            positions,
            &mesh.triangles,
            point_count,
            &mut self.authoring.selection.visibility_cache,
        );
        for (index, panel) in self.project.template.panels.iter().enumerate() {
            let Some(points) = selections.get(&panel.id) else {
                continue;
            };
            let Some(poly) = &panel.polygon else {
                continue;
            };
            let range = &self.scene.garment.panels[index];
            let painter = ui.painter().with_clip_rect(rect);
            let matrix = self.camera.matrix(rect.width() / rect.height());
            for &k in points {
                let Some(uv) = poly.points.get(k) else {
                    continue;
                };
                let Some(v) = range
                    .vertices
                    .clone()
                    .find(|v| self.scene.garment.mesh.uv[*v].distance_squared(*uv) < 1e-18)
                else {
                    continue;
                };
                let p = self.scene.state.x[v];
                let Some(at) = super::gizmo::project_matrix(matrix, rect, p) else {
                    continue;
                };
                let (origin, direction) = self.camera.ray(at, rect);
                let limit = origin.distance(p) - 0.0001;
                if self.scene.collider.occludes_ray(origin, direction, limit) {
                    continue;
                }
                if visibility.occludes(origin, direction, limit) {
                    continue;
                }
                painter.circle_filled(at, 5., Color32::from_rgb(24, 130, 239));
                painter.circle_stroke(at, 6., Stroke::new(1.5, Color32::WHITE));
                painter.text(
                    at + Vec2::new(9., -9.),
                    egui::Align2::LEFT_BOTTOM,
                    format!("{}", k + 1),
                    egui::FontId::monospace(11.),
                    Color32::WHITE,
                );
            }
        }
    }
    pub(super) fn finish_marquee(
        &mut self,
        canvas: egui::Rect,
        region: Region,
        add: bool,
        points: bool,
    ) {
        if points {
            let mut groups = if add {
                self.authoring.board.point_selections()
            } else {
                Default::default()
            };
            for (index, panel) in self.project.template.panels.iter().enumerate() {
                let Some(poly) = &panel.polygon else {
                    continue;
                };
                let selected = groups.entry(panel.id.clone()).or_insert_with(Vec::new);
                for (k, uv) in poly.points.iter().enumerate() {
                    let q = self.board_origin(index)
                        + marvelous_cloth::authoring::rotate_2d(*uv, self.board_angle(index));
                    if region.contains(self.authoring.board.screen(canvas, q))
                        && !selected.contains(&k)
                    {
                        selected.push(k);
                    }
                }
                selected.sort_unstable();
            }
            groups.retain(|_, points| !points.is_empty());
            self.authoring.anchor = groups
                .iter()
                .next()
                .map(|(id, points)| (id.clone(), points[0]));
            self.authoring.selected = self.authoring.anchor.as_ref().map(|(id, _)| id.clone());
            self.authoring.board.selection_panel = self.authoring.selected.clone();
            self.authoring.board.selection = self
                .authoring
                .selected
                .as_ref()
                .and_then(|id| groups.get(id))
                .cloned()
                .unwrap_or_default();
            self.authoring.board.point_groups = groups;
            self.authoring.selection.panels.clear();
            self.status = format!(
                "{} contour points selected across {} panels � drag a selected point or use arrow keys",
                self.authoring.board.point_count(),
                self.authoring.board.point_groups.len()
            );
        } else {
            let mut selected: BTreeSet<_> = if add {
                self.selected_panels().into_iter().collect()
            } else {
                BTreeSet::new()
            };
            for (i, panel) in self.project.template.panels.iter().enumerate() {
                let project = |uv| {
                    self.authoring.board.screen(
                        canvas,
                        self.board_origin(i)
                            + marvelous_cloth::authoring::rotate_2d(uv, self.board_angle(i)),
                    )
                };
                let range = &self.scene.garment.panels[i];
                if self.scene.garment.mesh.triangles[range.triangles.clone()]
                    .iter()
                    .any(|t| {
                        region
                            .intersects(t.vertices.map(|v| project(self.scene.garment.mesh.uv[v])))
                    })
                {
                    selected.insert(panel.id.clone());
                }
            }
            self.authoring.selected = self
                .authoring
                .selected
                .take()
                .filter(|id| selected.contains(id))
                .or_else(|| selected.iter().next().cloned());
            self.authoring.selection.panels = selected;
            self.authoring.board.selection.clear();
            self.authoring.board.selection_panel = None;
            self.authoring.board.point_groups.clear();
            self.authoring.anchor = None;
            self.status = format!(
                "{} panels selected · drag to arrange in 2D · Ctrl+C to copy",
                self.selected_panels().len()
            );
        }
        self.authoring.edge = None;
        self.authoring.selection.seam = None;
        self.authoring.selection.seam_card = None;
    }
    pub(super) fn selected_panels(&self) -> Vec<String> {
        let s = &self.authoring.selection.panels;
        if self
            .authoring
            .selected
            .as_ref()
            .is_some_and(|id| s.contains(id))
        {
            s.iter()
                .filter(|id| self.project.template.panels.iter().any(|p| &p.id == *id))
                .cloned()
                .collect()
        } else {
            self.authoring.selected.clone().into_iter().collect()
        }
    }
    pub(super) fn panel_selected(&self, id: &str) -> bool {
        self.authoring.selected.as_deref() == Some(id)
            || (self
                .authoring
                .selected
                .as_ref()
                .is_some_and(|p| self.authoring.selection.panels.contains(p))
                && self.authoring.selection.panels.contains(id))
    }
    pub(super) fn select_panel(&mut self, id: String, toggle: bool) {
        self.inspector_tab = super::chrome::InspectorTab::Piece;
        self.authoring.selection.seam = None;
        self.authoring.selection.seam_card = None;
        let mut ids: BTreeSet<_> = if toggle {
            self.selected_panels().into_iter().collect()
        } else {
            BTreeSet::new()
        };
        if toggle && ids.contains(&id) {
            ids.remove(&id);
        } else {
            ids.insert(id.clone());
        }
        self.authoring.selected = if ids.contains(&id) {
            Some(id)
        } else {
            ids.iter().next().cloned()
        };
        self.authoring.selection.panels = ids;
        self.authoring.anchor = None;
        self.authoring.board.selection.clear();
        self.authoring.board.selection_panel = None;
        self.authoring.board.point_groups.clear();
        self.authoring.edge = None;
    }
    pub(super) fn selection_controls(&mut self, ui: &mut egui::Ui) {
        if self.authoring.tool != Tool::Edit {
            return;
        }
        ui.horizontal_wrapped(|ui| {
            let r = ui
                .selectable_value(
                    &mut self.authoring.selection.shape,
                    SelectionShape::Box,
                    "Box",
                )
                .on_hover_text(
                    "Drag to select panels or contour points across multiple panels. Shift adds.",
                );
            self.smoke_target_ui(ui, "selection_box", r.rect);
            let r = ui
                .selectable_value(
                    &mut self.authoring.selection.shape,
                    SelectionShape::Lasso,
                    "Lasso",
                )
                .on_hover_text(
                    "Draw a freehand selection on the board. Shift adds to the selection.",
                );
            self.smoke_target_ui(ui, "selection_lasso", r.rect);
            ui.separator();
            ui.selectable_value(
                &mut self.authoring.selection.target,
                BoxTarget::Panels,
                "Panels",
            );
            let r = ui.selectable_value(
                &mut self.authoring.selection.target,
                BoxTarget::Points,
                "Points",
            );
            self.smoke_target_ui(ui, "selection_points", r.rect);
            let count = self.selected_panels().len();
            ui.separator();
            if self.authoring.selection.target == BoxTarget::Points {
                ui.small(format!("{} points", self.authoring.board.point_count()));
            } else {
                ui.small(format!("{count} panels"));
            }
            ui.menu_button("Clipboard", |ui| {
                if ui
                    .add_enabled(count > 0, egui::Button::new("Copy panels"))
                    .on_hover_text("Ctrl+C · copy panels and seams between them")
                    .clicked()
                {
                    self.copy_panels(ui.ctx());
                }
                if ui
                    .add_enabled(
                        self.authoring.selection.clipboard.is_some(),
                        egui::Button::new("Paste"),
                    )
                    .on_hover_text(
                        "Paste the last copied panels · Ctrl+V reads the system clipboard",
                    )
                    .clicked()
                    && let Some(clip) = self.authoring.selection.clipboard.clone()
                {
                    self.paste_panels(clip, ui.ctx());
                }
            });
        });
    }
    fn copy_panels(&mut self, ctx: &egui::Context) {
        match PatternClipboard::capture(&self.project.template, &self.selected_panels())
            .and_then(|clip| clip.to_text().map(|text| (clip, text)))
        {
            Ok((clip, text)) => {
                ctx.copy_text(text);
                self.status = format!(
                    "Copied {} panels and {} internal seams · Ctrl+V to paste",
                    clip.panel_count(),
                    clip.seam_count()
                );
                self.authoring.selection.clipboard = Some(clip);
                self.authoring.selection.paste_count = 0;
            }
            Err(error) => self.status = error,
        }
    }
    fn paste_panels(&mut self, clip: PatternClipboard, ctx: &egui::Context) {
        let board = &self.authoring.board;
        let cursor = ctx.input(|i| i.pointer.hover_pos());
        let center = self
            .authoring
            .selection
            .board_rect
            .zip(cursor)
            .filter(|(r, p)| r.contains(*p))
            .map(|(r, p)| board.world(r, p))
            .unwrap_or(board.center);
        let center = center + DVec2::splat(f64::from(self.authoring.selection.paste_count) * 0.03);
        let old: BTreeSet<_> = self
            .project
            .template
            .panels
            .iter()
            .map(|p| p.id.clone())
            .collect();
        if self.edit(Command::Paste {
            clipboard: clip.clone(),
            center,
        }) {
            self.set_authoring_tool(Tool::Edit, false);
            self.authoring.selection.panels = self
                .project
                .template
                .panels
                .iter()
                .filter(|p| !old.contains(&p.id))
                .map(|p| p.id.clone())
                .collect();
            self.authoring.selected = self.authoring.selection.panels.iter().next().cloned();
            self.authoring.anchor = None;
            self.authoring.edge = None;
            self.authoring.selection.clipboard = Some(clip);
            self.authoring.selection.paste_count += 1;
            self.status = "Panels pasted · internal seams retained · arrange copies in 3D before simulation · Ctrl+Z to undo".into();
        }
    }
    pub(super) fn clipboard_shortcuts(&mut self, ctx: &egui::Context) {
        if ctx.egui_wants_keyboard_input()
            || self.authoring.radial.blocked
            || self.quick.blocked
            || self.authoring.board.gesture_active()
            || self.authoring.drag.is_some()
        {
            return;
        }
        if ctx.input(|i| i.key_pressed(egui::Key::Delete))
            && matches!(self.authoring.tool, Tool::Edit | Tool::Place)
            && self.authoring.anchor.is_none()
            && self.authoring.edge.is_none()
            && self.authoring.selection.seam.is_none()
            && self.authoring.board.point_count() == 0
        {
            let panels = self.selected_panels();
            if !panels.is_empty() {
                self.edit(Command::RemovePanels { panels });
            }
        }
        let events = ctx.input(|i| i.events.clone());
        // eframe emits Copy/Paste events rather than ordinary C/V key presses.
        if events.iter().any(|e| matches!(e, egui::Event::Copy)) {
            self.copy_panels(ctx);
        }
        if let Some(text) = events.iter().find_map(|e| {
            if let egui::Event::Paste(s) = e {
                Some(s)
            } else {
                None
            }
        }) {
            match PatternClipboard::from_text(text) {
                Ok(clip) => self.paste_panels(clip, ctx),
                Err(error) => self.status = error,
            }
        }
    }
}

/// Separating axis test on actual cloth triangles, not their bounding boxes.
/// A selection rectangle wholly inside a cutout must not select the panel.
fn triangle_in_rect(triangle: [egui::Pos2; 3], rect: egui::Rect) -> bool {
    let corners = [
        rect.left_top(),
        rect.right_top(),
        rect.right_bottom(),
        rect.left_bottom(),
    ];
    let edges = [
        triangle[1] - triangle[0],
        triangle[2] - triangle[1],
        triangle[0] - triangle[2],
    ];
    for axis in [Vec2::X, Vec2::Y]
        .into_iter()
        .chain(edges.map(|v| Vec2::new(-v.y, v.x)))
    {
        let project = |p: egui::Pos2| p.to_vec2().dot(axis);
        let a = triangle.map(project);
        let b = corners.map(project);
        let min = |a: &[f32]| a.iter().copied().fold(f32::INFINITY, f32::min);
        let max = |a: &[f32]| a.iter().copied().fold(f32::NEG_INFINITY, f32::max);
        if max(&a) < min(&b) || max(&b) < min(&a) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloth_visibility_bvh_matches_exhaustive_queries_and_prunes_work() {
        use glam::{DMat2, DVec3};
        use marvelous_cloth::model::Triangle;
        let mut positions = Vec::new();
        let mut triangles = Vec::new();
        for y in 0..32 {
            for x in 0..32 {
                let a = positions.len();
                positions.extend([
                    DVec3::new(x as f64, y as f64, 0.),
                    DVec3::new(x as f64 + 0.8, y as f64, 0.),
                    DVec3::new(x as f64, y as f64 + 0.8, 0.),
                ]);
                triangles.push(Triangle {
                    vertices: [a, a + 1, a + 2],
                    rest: [DVec2::ZERO; 3],
                    inv_dm: DMat2::IDENTITY,
                    area: 1.,
                    material: 0,
                });
            }
        }
        triangles[0].vertices = [0, 0, 0]; // Degenerate triangles use the same narrow phase.
        let bvh = ClothVisibility::new(&positions, &triangles).unwrap();
        let mut invalid_positions = positions.clone();
        invalid_positions[3].x = f64::NAN;
        assert!(ClothVisibility::new(&invalid_positions, &triangles).is_none());
        invalid_positions[3].x = MAX_VISIBILITY_COORD * 2.;
        assert!(ClothVisibility::new(&invalid_positions, &triangles).is_none());
        for x in 0..32 {
            for y in [0, 7, 19, 31] {
                for (u, v, limit) in [
                    (0.2, 0.2, 2.),
                    (0.7, 0.7, 2.),
                    (0., 0., 2.),
                    (0.2, 0.2, 1.),
                    (0.2, 0.2, 0.5),
                ] {
                    let origin = DVec3::new(x as f64 + u, y as f64 + v, 1.);
                    let direction = -DVec3::Z;
                    let direct = triangles.iter().any(|t| {
                        picking::ray_triangle(origin, direction, t.vertices.map(|i| positions[i]))
                            .is_some_and(|(d, _)| d < limit)
                    });
                    assert_eq!(
                        bvh.occludes(origin, direction, limit, &positions, &triangles),
                        direct
                    );
                }
            }
        }
        for direction in [DVec3::X, DVec3::Y, DVec3::ZERO, DVec3::new(1e-20, 0., -1.)] {
            let origin = DVec3::new(0.2, 0.2, 1.);
            let direct = triangles.iter().any(|t| {
                picking::ray_triangle(origin, direction, t.vertices.map(|i| positions[i]))
                    .is_some_and(|(d, _)| d < 2.)
            });
            assert_eq!(
                bvh.occludes(origin, direction, 2., &positions, &triangles),
                direct
            );
        }
        let mut seed = 0x12345678_u64;
        let mut deformed = positions.clone();
        for (i, p) in deformed.iter_mut().enumerate() {
            p.z = (i as f64 * 0.31).sin() * 0.4;
        }
        let deformed_bvh = ClothVisibility::new(&deformed, &triangles).unwrap();
        let mut sample = || {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            (seed >> 32) as f64 / u32::MAX as f64
        };
        for _ in 0..512 {
            let origin = DVec3::new(sample() * 32., sample() * 32., 0.1 + sample() * 10.);
            let direction = DVec3::new(sample() * 2. - 1., sample() * 2. - 1., -sample());
            let limit = 0.1 + sample() * 20.;
            for (vertices, tree) in [(&positions, &bvh), (&deformed, &deformed_bvh)] {
                let direct = triangles.iter().any(|t| {
                    picking::ray_triangle(origin, direction, t.vertices.map(|i| vertices[i]))
                        .is_some_and(|(d, _)| d < limit)
                });
                assert_eq!(
                    tree.occludes(origin, direction, limit, vertices, &triangles),
                    direct
                );
            }
        }
        let mut tested = 0;
        let origin = DVec3::new(15.7, 15.7, 1.);
        assert!(!bvh.any_candidate(origin, -DVec3::Z, 2., |i| {
            tested += 1;
            picking::ray_triangle(
                origin,
                -DVec3::Z,
                triangles[i].vertices.map(|v| positions[v]),
            )
            .is_some_and(|(d, _)| d < 2.)
        }));
        assert!(
            tested < triangles.len() / 4,
            "tested {tested} of {} triangles",
            triangles.len()
        );
        let mut early_cache = ClothVisibilityCache::default();
        let mut early = ClothVisibilityQueries::new(&positions, &triangles, 64, &mut early_cache);
        for _ in 0..64 {
            assert!(early.occludes(DVec3::new(1.2, 0.2, 1.), -DVec3::Z, 2.));
        }
        assert!(!early.attempted && early.cache.tree.is_none());
        let mut mixed_cache = ClothVisibilityCache::default();
        let mut mixed = ClothVisibilityQueries::new(&positions, &triangles, 64, &mut mixed_cache);
        for _ in 0..8 {
            assert!(!mixed.occludes(DVec3::new(15.7, 15.7, 1.), -DVec3::Z, 2.));
        }
        assert!(!mixed.attempted);
        assert!(mixed.occludes(DVec3::new(1.2, 0.2, 1.), -DVec3::Z, 2.));
        assert!(mixed.attempted && mixed.cache.tree.is_some());
        let mut small_cache = ClothVisibilityCache::default();
        let mut small = ClothVisibilityQueries::new(&positions, &triangles, 63, &mut small_cache);
        for _ in 0..64 {
            assert!(!small.occludes(DVec3::new(15.7, 15.7, 1.), -DVec3::Z, 2.));
        }
        assert!(!small.attempted && small.cache.tree.is_none());
        for i in 0..64 {
            let origin = DVec3::new((i % 32) as f64 + 0.2, (i / 32) as f64 + 0.2, 1.);
            let direct = triangles.iter().any(|t| {
                picking::ray_triangle(origin, -DVec3::Z, t.vertices.map(|v| positions[v]))
                    .is_some_and(|(d, _)| d < 2.)
            });
            assert_eq!(mixed.occludes(origin, -DVec3::Z, 2.), direct);
        }
        let mut cache = ClothVisibilityCache::default();
        cache.prepare(&positions, &triangles);
        assert!(cache.tree.is_some());
        let mut moved = positions.clone();
        for vertex in triangles[1].vertices {
            moved[vertex].z = 0.5;
        }
        let origin = DVec3::new(1.2, 0.2, 1.);
        assert!(!cache.tree.as_ref().unwrap().occludes(
            origin,
            -DVec3::Z,
            0.75,
            &positions,
            &triangles
        ));
        cache.prepare(&moved, &triangles);
        assert!(
            cache
                .tree
                .as_ref()
                .unwrap()
                .occludes(origin, -DVec3::Z, 0.75, &moved, &triangles)
        );
        cache.prepare(&deformed, &triangles);
        assert_eq!(cache.positions, deformed);
        for i in 0..64 {
            let origin = DVec3::new((i % 32) as f64 + 0.2, (i / 32) as f64 + 0.2, 1.);
            let direct = triangles.iter().any(|t| {
                picking::ray_triangle(origin, -DVec3::Z, t.vertices.map(|v| deformed[v]))
                    .is_some_and(|(d, _)| d < 2.)
            });
            assert_eq!(
                cache
                    .tree
                    .as_ref()
                    .unwrap()
                    .occludes(origin, -DVec3::Z, 2., &deformed, &triangles),
                direct
            );
        }
        let mut reordered = triangles.clone();
        reordered.swap(1, 2);
        cache.prepare(&deformed, &reordered);
        assert_eq!(cache.topology[1], reordered[1].vertices);
        for i in 0..32 {
            let origin = DVec3::new(i as f64 + 0.2, 0.2, 1.);
            let direct = reordered.iter().any(|t| {
                picking::ray_triangle(origin, -DVec3::Z, t.vertices.map(|v| deformed[v]))
                    .is_some_and(|(d, _)| d < 2.)
            });
            assert_eq!(
                cache
                    .tree
                    .as_ref()
                    .unwrap()
                    .occludes(origin, -DVec3::Z, 2., &deformed, &reordered),
                direct
            );
        }
        cache.prepare(&invalid_positions, &reordered);
        assert!(cache.tree.is_none());
        cache.prepare(&positions, &triangles);
        assert!(cache.tree.is_some());
        // An informational synthetic timing, never a machine-dependent gate.
        // Each ray passes through a triangle's box but misses its surface.
        for count in [32, 64, 128, 512] {
            let rays: Vec<_> = (0..count)
                .map(|i| DVec3::new((i % 32) as f64 + 0.7, ((i / 32) % 32) as f64 + 0.7, 1.))
                .collect();
            let start = std::time::Instant::now();
            for _ in 0..10 {
                for &origin in &rays {
                    std::hint::black_box(triangles.iter().any(|t| {
                        picking::ray_triangle(origin, -DVec3::Z, t.vertices.map(|i| positions[i]))
                            .is_some_and(|(d, _)| d < 2.)
                    }));
                }
            }
            let direct = start.elapsed();
            let start = std::time::Instant::now();
            for _ in 0..10 {
                let mut cache = ClothVisibilityCache::default();
                let mut queries =
                    ClothVisibilityQueries::new(&positions, &triangles, count, &mut cache);
                for &origin in &rays {
                    std::hint::black_box(queries.occludes(origin, -DVec3::Z, 2.));
                }
            }
            eprintln!(
                "synthetic visibility: {count} rays, 1024 triangles, 10 repeats: direct={direct:?}, adaptive={:?}",
                start.elapsed()
            );
        }
        if std::env::var_os("CLOTHCRAFT_VISIBILITY_BENCH").is_some() {
            let mut large_positions = Vec::new();
            let mut large_triangles = Vec::new();
            for tile in 0..16 {
                let offset = DVec3::new((tile % 4) as f64 * 32., (tile / 4) as f64 * 32., 0.);
                let base = large_positions.len();
                large_positions.extend(positions.iter().map(|p| *p + offset));
                large_triangles.extend(triangles.iter().cloned().map(|mut t| {
                    t.vertices = t.vertices.map(|i| i + base);
                    t
                }));
            }
            for count in [32, 64, 128, 512] {
                let rays: Vec<_> = (0..count)
                    .map(|i| DVec3::new((i % 128) as f64 + 0.7, ((i / 128) % 128) as f64 + 0.7, 1.))
                    .collect();
                let start = std::time::Instant::now();
                for _ in 0..3 {
                    for &origin in &rays {
                        std::hint::black_box(large_triangles.iter().any(|t| {
                            picking::ray_triangle(
                                origin,
                                -DVec3::Z,
                                t.vertices.map(|i| large_positions[i]),
                            )
                            .is_some_and(|(d, _)| d < 2.)
                        }));
                    }
                }
                let direct = start.elapsed();
                let start = std::time::Instant::now();
                for _ in 0..3 {
                    let mut cache = ClothVisibilityCache::default();
                    let mut queries = ClothVisibilityQueries::new(
                        &large_positions,
                        &large_triangles,
                        count,
                        &mut cache,
                    );
                    for &origin in &rays {
                        std::hint::black_box(queries.occludes(origin, -DVec3::Z, 2.));
                    }
                }
                eprintln!(
                    "large synthetic visibility: {count} rays, {} triangles, 3 repeats: direct={direct:?}, adaptive={:?}",
                    large_triangles.len(),
                    start.elapsed()
                );
            }
            for mode in ["early-hit", "mixed"] {
                let rays: Vec<_> = (0..64)
                    .map(|i| {
                        if mode == "early-hit" || i % 2 == 0 {
                            DVec3::new(1.2, 0.2, 1.)
                        } else {
                            DVec3::new((i % 128) as f64 + 0.7, 0.7, 1.)
                        }
                    })
                    .collect();
                let start = std::time::Instant::now();
                for _ in 0..3 {
                    for &origin in &rays {
                        std::hint::black_box(large_triangles.iter().any(|t| {
                            picking::ray_triangle(
                                origin,
                                -DVec3::Z,
                                t.vertices.map(|i| large_positions[i]),
                            )
                            .is_some_and(|(d, _)| d < 2.)
                        }));
                    }
                }
                let direct = start.elapsed();
                let start = std::time::Instant::now();
                for _ in 0..3 {
                    let mut cache = ClothVisibilityCache::default();
                    let mut queries = ClothVisibilityQueries::new(
                        &large_positions,
                        &large_triangles,
                        64,
                        &mut cache,
                    );
                    for &origin in &rays {
                        std::hint::black_box(queries.occludes(origin, -DVec3::Z, 2.));
                    }
                }
                eprintln!(
                    "large synthetic visibility: {mode}, 64 rays, {} triangles, 3 repeats: direct={direct:?}, adaptive={:?}",
                    large_triangles.len(),
                    start.elapsed()
                );
            }
            let start = std::time::Instant::now();
            for _ in 0..3 {
                std::hint::black_box(
                    ClothVisibility::new(&large_positions, &large_triangles).unwrap(),
                );
            }
            let rebuild = start.elapsed();
            let mut cache = ClothVisibilityCache::default();
            cache.prepare(&large_positions, &large_triangles);
            let start = std::time::Instant::now();
            for _ in 0..3 {
                cache.prepare(&large_positions, &large_triangles);
            }
            let reuse = start.elapsed();
            let mut moving = large_positions.clone();
            let start = std::time::Instant::now();
            for _ in 0..3 {
                moving[3].z += 0.001;
                cache.prepare(&moving, &large_triangles);
            }
            eprintln!(
                "large visibility cache, {} triangles, 3 repeats: rebuild={rebuild:?}, unchanged={reuse:?}, refit={:?}",
                large_triangles.len(),
                start.elapsed()
            );
        }
    }
    #[test]
    fn ordinary_large_lasso_gesture_simplifies_without_losing_selection() {
        let ctx = egui::Context::default();
        let modifiers = egui::Modifiers::NONE;
        let mut gesture = None;
        let mut completed = None;
        let mut run = |events: Vec<egui::Event>| {
            let mut output = ctx.run_ui(
                egui::RawInput {
                    focused: true,
                    events,
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        Vec2::splat(650.),
                    )),
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        let (_, response) = ui
                            .allocate_exact_size(Vec2::splat(520.), egui::Sense::click_and_drag());
                        if let Some(g) = marquee_input(&mut gesture, &response, true) {
                            completed = Some(g);
                        }
                    });
                },
            );
            output.textures_delta.clear();
        };
        let start = egui::pos2(30., 30.);
        run(vec![egui::Event::Key {
            key: egui::Key::L,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers,
        }]);
        run(vec![
            egui::Event::PointerMoved(start),
            egui::Event::PointerButton {
                pos: start,
                button: egui::PointerButton::Primary,
                pressed: true,
                modifiers,
            },
        ]);
        let path = (1..=50)
            .map(|i| egui::pos2(30. + i as f32 * 8., 30.))
            .chain((1..=50).map(|i| egui::pos2(430., 30. + i as f32 * 8.)))
            .chain((1..=50).map(|i| egui::pos2(430. - i as f32 * 8., 430.)))
            .chain((1..=50).map(|i| egui::pos2(30., 430. - i as f32 * 8.)));
        for point in path {
            run(vec![egui::Event::PointerMoved(point)]);
        }
        run(vec![egui::Event::PointerButton {
            pos: start,
            button: egui::PointerButton::Primary,
            pressed: false,
            modifiers,
        }]);
        let g = completed.expect("lasso must finish");
        assert!(g.lasso && !g.overflow && g.path.len() > MAX_LASSO_POINTS);
        let simplified = simplify_lasso(&g.path).unwrap();
        assert!(simplified.len() <= 6);
        assert!(g.path.iter().all(|&p| simplified.windows(2).any(|w| {
            super::super::authoring_ui::segment_distance(p, w[0], w[1])
                <= LASSO_SIMPLIFY_TOLERANCE_PX
        })));
        let region = Region::Lasso(simplified);
        assert!(region.contains(egui::pos2(100., 100.)));
        assert!(!region.contains(egui::pos2(500., 500.)));
        let viewport = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(520.));
        let selected = select_region(
            glam::Mat4::IDENTITY,
            viewport,
            &region,
            true,
            [(Some(0), face(0.3))],
        )
        .unwrap();
        assert_eq!(selected, BTreeSet::from([0]));
        let visible = select_region(
            glam::Mat4::IDENTITY,
            viewport,
            &region,
            false,
            [(Some(0), face(0.3)), (None, face(0.1))],
        )
        .unwrap();
        assert!(visible.is_empty());
    }
    #[test]
    fn simplification_bounds_curve_error_and_refuses_excess_detail() {
        let circle: Vec<_> = (0..=250)
            .map(|i| {
                let t = i as f32 * std::f32::consts::TAU / 250.;
                egui::pos2(200. + 150. * t.cos(), 200. + 150. * t.sin())
            })
            .collect();
        let simplified = simplify_lasso(&circle).unwrap();
        assert!(simplified.len() <= MAX_LASSO_POINTS);
        for &point in &circle {
            assert!(
                simplified
                    .windows(2)
                    .any(
                        |w| super::super::authoring_ui::segment_distance(point, w[0], w[1])
                            <= LASSO_SIMPLIFY_TOLERANCE_PX + 1e-4
                    )
            );
        }
        let zigzag: Vec<_> = (0..300)
            .map(|i| egui::pos2(i as f32 * 8., if i % 2 == 0 { 0. } else { 20. }))
            .collect();
        assert!(simplify_lasso(&zigzag).is_err());
        assert!(
            simplify_lasso(&[
                egui::pos2(f32::MAX, 0.),
                egui::pos2(-f32::MAX, 1.),
                egui::pos2(0., 2.)
            ])
            .is_err()
        );
    }
    #[test]
    fn lasso_uses_concave_geometry_and_preserves_visible_and_through_occlusion() {
        let viewport = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(100.));
        let region = Region::Lasso(vec![
            egui::pos2(10., 10.),
            egui::pos2(55., 10.),
            egui::pos2(55., 40.),
            egui::pos2(40., 40.),
            egui::pos2(40., 90.),
            egui::pos2(10., 90.),
        ]);
        let triangle = |x: f64, y: f64, z: f64| {
            [
                glam::DVec3::new(x - 0.08, y - 0.08, z),
                glam::DVec3::new(x + 0.08, y - 0.08, z),
                glam::DVec3::new(x, y + 0.08, z),
            ]
        };
        let faces = [
            (Some(0), triangle(-0.5, 0., 0.2)),
            (Some(1), triangle(-0.5, 0., 0.6)),
            (Some(2), triangle(0., -0.4, 0.2)),
        ];
        assert_eq!(
            select_region(glam::Mat4::IDENTITY, viewport, &region, false, faces).unwrap(),
            BTreeSet::from([0])
        );
        assert_eq!(
            select_region(glam::Mat4::IDENTITY, viewport, &region, true, faces).unwrap(),
            BTreeSet::from([0, 1])
        );
        let with_avatar = faces.into_iter().chain([(None, triangle(-0.5, 0., 0.1))]);
        assert!(
            select_region(
                glam::Mat4::IDENTITY,
                viewport,
                &region,
                false,
                with_avatar.clone()
            )
            .unwrap()
            .is_empty()
        );
        assert_eq!(
            select_region(glam::Mat4::IDENTITY, viewport, &region, true, with_avatar).unwrap(),
            BTreeSet::from([0, 1])
        );
    }
    #[test]
    fn malformed_and_excessive_lasso_paths_are_rejected() {
        let viewport = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(100.));
        let invalid = [
            vec![],
            vec![egui::pos2(1., 1.), egui::pos2(2., 2.), egui::pos2(3., 3.)],
            vec![egui::pos2(f32::NAN, 1.); 3],
            vec![egui::pos2(1., 1.); MAX_LASSO_POINTS + 1],
        ];
        for points in invalid {
            assert!(
                select_region(
                    glam::Mat4::IDENTITY,
                    viewport,
                    &Region::Lasso(points),
                    true,
                    []
                )
                .is_err()
            );
        }
        let large_view = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(512.));
        let circle = (0..MAX_LASSO_POINTS)
            .map(|i| {
                let angle = (i as f32) * std::f32::consts::TAU / MAX_LASSO_POINTS as f32;
                egui::pos2(256. + 255. * angle.cos(), 256. + 255. * angle.sin())
            })
            .collect();
        let error = select_region(
            glam::Mat4::IDENTITY,
            large_view,
            &Region::Lasso(circle),
            false,
            [],
        )
        .unwrap_err();
        assert!(error.contains("work budget"));
    }
    #[test]
    fn held_l_and_pointer_events_create_a_lasso_with_modifiers() {
        let ctx = egui::Context::default();
        let modifiers = egui::Modifiers {
            command: true,
            ctrl: true,
            alt: true,
            ..Default::default()
        };
        let mut gesture = None;
        let mut completed = None;
        let mut run = |mut events: Vec<egui::Event>| {
            events.insert(0, egui::Event::ModifiersChanged(modifiers));
            let mut output = ctx.run_ui(
                egui::RawInput {
                    focused: true,
                    events,
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        Vec2::splat(300.),
                    )),
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        let (_, response) = ui
                            .allocate_exact_size(Vec2::splat(200.), egui::Sense::click_and_drag());
                        if let Some(g) = marquee_input(&mut gesture, &response, true) {
                            completed = Some(g);
                        }
                    });
                },
            );
            output.textures_delta.clear();
        };
        let a = egui::pos2(30., 30.);
        let b = egui::pos2(100., 30.);
        let c = egui::pos2(100., 100.);
        run(vec![egui::Event::Key {
            key: egui::Key::L,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers,
        }]);
        run(vec![
            egui::Event::PointerMoved(a),
            egui::Event::PointerButton {
                pos: a,
                button: egui::PointerButton::Primary,
                pressed: true,
                modifiers,
            },
        ]);
        run(vec![egui::Event::PointerMoved(b)]);
        run(vec![egui::Event::PointerMoved(c)]);
        run(vec![egui::Event::PointerButton {
            pos: c,
            button: egui::PointerButton::Primary,
            pressed: false,
            modifiers,
        }]);
        let g = completed.expect("lasso must complete");
        assert!(g.lasso && g.subtract && g.through && !g.overflow);
        assert_eq!(g.path, vec![a, b, c]);
    }
    #[test]
    fn marquee_subtract_keeps_other_panels_and_takes_precedence_over_add() {
        let current = BTreeSet::from(["front", "back", "sleeve"]);
        assert_eq!(
            apply_marquee_selection(current.clone(), ["front", "unknown"], false, true),
            BTreeSet::from(["back", "sleeve"])
        );
        assert_eq!(
            apply_marquee_selection(current.clone(), ["front"], true, true),
            BTreeSet::from(["back", "sleeve"])
        );
        assert_eq!(
            apply_marquee_selection(current.clone(), ["new"], true, false),
            BTreeSet::from(["front", "back", "sleeve", "new"])
        );
        assert_eq!(
            apply_marquee_selection(current, ["new"], false, false),
            BTreeSet::from(["new"])
        );
    }
    #[test]
    fn command_and_alt_pointer_drag_selects_subtract_through_mode() {
        let ctx = egui::Context::default();
        let modifiers = egui::Modifiers {
            command: true,
            ctrl: true,
            alt: true,
            ..Default::default()
        };
        let start = egui::pos2(50., 50.);
        let end = egui::pos2(100., 100.);
        let mut gesture = None;
        let mut completed = None;
        let mut run = |mut events: Vec<egui::Event>| {
            events.insert(0, egui::Event::ModifiersChanged(modifiers));
            let mut output = ctx.run_ui(
                egui::RawInput {
                    focused: true,
                    events,
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        Vec2::splat(300.),
                    )),
                    ..Default::default()
                },
                |ui| {
                    egui::CentralPanel::default().show(ui, |ui| {
                        let (_, response) = ui
                            .allocate_exact_size(Vec2::splat(200.), egui::Sense::click_and_drag());
                        if let Some(g) = marquee_input(&mut gesture, &response, true) {
                            completed = Some(g);
                        }
                    });
                },
            );
            output.textures_delta.clear();
        };
        run(vec![]);
        run(vec![
            egui::Event::PointerMoved(start),
            egui::Event::PointerButton {
                pos: start,
                button: egui::PointerButton::Primary,
                pressed: true,
                modifiers,
            },
        ]);
        run(vec![egui::Event::PointerMoved(end)]);
        run(vec![egui::Event::PointerButton {
            pos: end,
            button: egui::PointerButton::Primary,
            pressed: false,
            modifiers,
        }]);
        let completed = completed.expect("drag should finish");
        assert!(completed.subtract && completed.through && !completed.add);
    }
    #[test]
    fn focus_loss_discards_an_active_marquee_without_committing() {
        let ctx = egui::Context::default();
        let mut gesture = Some(PlacementMarquee {
            start: egui::pos2(20., 20.),
            end: egui::pos2(60., 60.),
            through: false,
            add: false,
            subtract: false,
            lasso: false,
            path: Vec::new(),
            overflow: false,
        });
        let mut commits = 0;
        let mut output = ctx.run_ui(
            egui::RawInput {
                focused: false,
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    Vec2::splat(300.),
                )),
                ..Default::default()
            },
            |ui| {
                egui::CentralPanel::default().show(ui, |ui| {
                    let (_, response) =
                        ui.allocate_exact_size(Vec2::splat(200.), egui::Sense::click_and_drag());
                    assert!(!response.ctx.input(|i| i.focused));
                    if marquee_input(&mut gesture, &response, true).is_some() {
                        commits += 1;
                    }
                });
            },
        );
        output.textures_delta.clear();
        assert_eq!(commits, 0);
        assert!(gesture.is_none());
    }
    #[test]
    fn named_canvas_finishes_once_and_escape_cancels_without_a_selection() {
        use super::super::authoring_smoke::widget_harness::{Harness, named};
        #[derive(Default)]
        struct Case {
            gesture: Option<PlacementMarquee>,
            completed: Vec<PlacementMarquee>,
            allow: bool,
        }
        fn draw(ui: &mut egui::Ui, c: &mut Case) {
            let (_, response) =
                ui.allocate_exact_size(Vec2::splat(200.), egui::Sense::click_and_drag());
            response.request_focus();
            named(ui, &response, "placement.canvas");
            if let Some(g) = marquee_input(&mut c.gesture, &response, c.allow) {
                c.completed.push(g);
            }
        }
        let mut c = Case {
            allow: true,
            ..Default::default()
        };
        let mut h = Harness::new(Vec2::splat(400.));
        h.frame(&mut c, &mut draw);
        h.drag(
            "placement.canvas",
            Vec2::new(30., 40.),
            3,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.completed.len(), 1);
        assert!((c.completed[0].end - c.completed[0].start - Vec2::new(30., 40.)).length() < 1e-4);
        assert!(!c.completed[0].through && !c.completed[0].add && !c.completed[0].subtract);
        assert!(c.gesture.is_none());
        c.gesture = Some(PlacementMarquee {
            start: egui::Pos2::ZERO,
            end: egui::pos2(20., 30.),
            through: true,
            add: true,
            subtract: false,
            lasso: false,
            path: Vec::new(),
            overflow: false,
        });
        h.key(
            "placement.canvas",
            egui::Key::Escape,
            egui::Modifiers::NONE,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert!(c.gesture.is_none());
        assert_eq!(c.completed.len(), 1);
        c.allow = false; // An active gizmo owns the drag, so it cannot also box-select.
        h.drag(
            "placement.canvas",
            Vec2::new(30., 40.),
            3,
            &mut c,
            &mut draw,
        )
        .unwrap();
        assert_eq!(c.completed.len(), 1);
    }
    fn face(z: f64) -> [glam::DVec3; 3] {
        [
            glam::DVec3::new(-0.8, -0.8, z),
            glam::DVec3::new(0.8, -0.8, z),
            glam::DVec3::new(0., 0.8, z),
        ]
    }
    #[test]
    fn visible_marquee_respects_cloth_and_avatar_depth_while_through_is_explicit() {
        let rect = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(100.));
        let cloth = [(Some(0), face(0.2)), (Some(1), face(0.6))];
        assert_eq!(
            select_rect(glam::Mat4::IDENTITY, rect, rect, false, cloth).unwrap(),
            BTreeSet::from([0])
        );
        let blocked = cloth.into_iter().chain([(None, face(0.1))]);
        assert!(
            select_rect(glam::Mat4::IDENTITY, rect, rect, false, blocked.clone())
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            select_rect(glam::Mat4::IDENTITY, rect, rect, true, blocked).unwrap(),
            BTreeSet::from([0, 1])
        );
        assert!(
            select_rect(
                glam::Mat4::IDENTITY,
                rect,
                rect,
                false,
                [(Some(0), face(-0.5))]
            )
            .unwrap()
            .is_empty()
        );
    }
    #[test]
    fn near_plane_clipping_keeps_crossing_occluders_and_geometric_bounds() {
        use glam::DVec3 as V;
        let rect = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(100.));
        let avatar = [
            V::new(-1., -1., -0.2),
            V::new(1., -1., 0.2),
            V::new(1., 1., 0.2),
        ];
        let cloth = [
            V::new(0.4, -0.6, 0.7),
            V::new(0.6, -0.6, 0.7),
            V::new(0.5, -0.4, 0.7),
        ];
        assert_eq!(
            select_rect(glam::Mat4::IDENTITY, rect, rect, false, [(Some(0), cloth)]).unwrap(),
            BTreeSet::from([0])
        );
        assert!(
            select_rect(
                glam::Mat4::IDENTITY,
                rect,
                rect,
                false,
                [(Some(0), cloth), (None, avatar)]
            )
            .unwrap()
            .is_empty()
        );
        let clipped = clip_triangle(avatar.map(|p| p.extend(1.)));
        assert!(clipped.len() >= 3);
        assert!(clipped.iter().all(|p| p.z >= -1e-12 && p.z <= p.w + 1e-12));
        let corner = egui::Rect::from_min_size(egui::pos2(0., 0.), Vec2::splat(5.));
        assert!(
            select_rect(
                glam::Mat4::IDENTITY,
                rect,
                corner,
                true,
                [(Some(0), face(0.5))]
            )
            .unwrap()
            .is_empty()
        );
    }
    #[test]
    fn excessive_overdraw_reports_failure_instead_of_partial_selection() {
        let rect = egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::splat(512.));
        assert!(
            select_rect(
                glam::Mat4::IDENTITY,
                rect,
                rect,
                false,
                std::iter::repeat_n((Some(0), face(0.5)), 1000)
            )
            .is_err()
        );
    }
    #[test]
    fn concave_lasso_selects_edges_and_interior_but_not_empty_corners() {
        let p = |x, y| egui::pos2(x, y);
        let region = Region::Lasso(vec![
            p(0., 0.),
            p(10., 0.),
            p(10., 3.),
            p(3., 3.),
            p(3., 10.),
            p(0., 10.),
        ]);
        assert!(region.contains(p(2., 8.)));
        assert!(!region.contains(p(8., 8.)));
        assert!(region.intersects([p(-10., 1.), p(20., 1.), p(20., 2.)]));
        assert!(region.intersects([p(-10., -10.), p(30., -10.), p(-10., 30.)]));
        assert!(!region.intersects([p(6., 6.), p(7., 6.), p(6., 7.)]));
        assert!(!segments_intersect(
            p(0., 0.),
            p(1., 0.),
            p(2., 0.),
            p(3., 0.)
        ));
    }
    #[test]
    fn marquee_uses_geometry_instead_of_aabb() {
        let t = [egui::pos2(0., 0.), egui::pos2(10., 0.), egui::pos2(0., 10.)];
        let r = |x, y, size| egui::Rect::from_min_size(egui::pos2(x, y), Vec2::splat(size));
        assert!(triangle_in_rect(t, r(1., 1., 2.)));
        assert!(triangle_in_rect(t, r(-1., -1., 12.)));
        assert!(triangle_in_rect(t, r(4., -1., 2.)));
        assert!(!triangle_in_rect(t, r(7., 7., 2.)));
    }
}
