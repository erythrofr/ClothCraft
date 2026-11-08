//! One metric drafting board. Layout is presentation; rest contours remain local.
use super::{
    authoring_ui::{Tool, segment_distance},
    *,
};
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        polygon::PolygonPattern,
        seam::{BoundaryRef, Side},
        template::Panel,
    },
};

/// Board magnet step used when no preference has been applied, in millimetres.
pub(super) const DEFAULT_SNAP_MM: f64 = 10.;
/// Magnet step limits in millimetres; mirrors the preference range so a
/// hand-edited value cannot reach the material coordinates as a NaN.
const SNAP_MM_MIN: f64 = 0.1;
const SNAP_MM_MAX: f64 = 100.;
/// Board zoom limits in pixels per metre.
const MIN_SCALE: f32 = 40.;
const MAX_SCALE: f32 = 2400.;
/// Rotation applied by one view-rotation step, in degrees.
pub(super) const ROTATE_STEP_DEGREES: f64 = 15.;
/// Screen-pixel capture radii for snapping. The radius is a property of the
/// pointing device, so keeping it in pixels makes the magnet feel identical at
/// every zoom; the captured coordinate itself is material and exact.
const SNAP_POINT_PX: f32 = 10.;
const SNAP_EDGE_PX: f32 = 8.;
/// Arrow-key nudge steps, in millimetres. Shift selects the coarse step.
pub(super) const NUDGE_MM: f64 = 1.;
pub(super) const NUDGE_COARSE_MM: f64 = 10.;
/// Angle increment of the Shift angle lock, in degrees.
pub(super) const ANGLE_STEP_DEGREES: f64 = 15.;
/// Above this difference the true sampled length and the chord are both shown.
const CHORD_DISPLAY_MM: f64 = 0.2;

/// What the pointer captured, named on canvas before the click.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(super) enum SnapKind {
    /// No snap: the raw pointer position, or snapping suspended by a modifier.
    Free,
    /// An existing contour point.
    Point,
    /// The midpoint of a straight segment.
    Midpoint,
    /// The perpendicular foot on a nearby segment.
    OnEdge,
    /// Locked to an angle increment from the reference point.
    Angle,
    /// The drafting grid.
    Grid,
}

/// A resolved snap: where a click will land, and why.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct Snap {
    pub point: DVec2,
    pub kind: SnapKind,
    /// Material arclength from the segment start, for [`SnapKind::OnEdge`].
    pub along_m: f64,
    /// Locked angle in degrees, for [`SnapKind::Angle`].
    pub angle_degrees: f64,
    /// True when the suspend modifier is held.
    pub suspended: bool,
}
impl Snap {
    fn new(point: DVec2, kind: SnapKind) -> Self {
        Self {
            point,
            kind,
            along_m: 0.,
            angle_degrees: 0.,
            suspended: false,
        }
    }
    /// The label shown beside the cursor, before the click.
    pub(super) fn label(&self, grid_mm: f64) -> String {
        match self.kind {
            SnapKind::Free if self.suspended => "Free · snap off".into(),
            SnapKind::Free => "Free".into(),
            SnapKind::Point => "Point".into(),
            SnapKind::Midpoint => "Midpoint".into(),
            SnapKind::OnEdge => format!("On edge · {:.1} mm", self.along_m * 1000.),
            SnapKind::Angle => format!("Angle {:.1}°", self.angle_degrees),
            SnapKind::Grid => format!("Grid {:.1} mm", grid_mm),
        }
    }
}

/// Candidate geometry the pointer can snap to, in material metres.
#[derive(Default)]
pub(super) struct SnapGeometry {
    pub points: Vec<DVec2>,
    /// Straight segments as `[start, end]`.
    pub segments: Vec<[DVec2; 2]>,
}

/// The boundary under the pointer, where a new point would be inserted.
#[derive(Clone, Debug, PartialEq)]
pub(super) struct InsertHint {
    pub panel: String,
    pub edge: String,
    /// Material position of the insertion point, in board coordinates.
    pub point: DVec2,
    /// Material position of the clickable `+` badge. It sits just outside the
    /// boundary so that clicking the boundary itself still selects it.
    pub badge: DVec2,
    /// Material arclength from the boundary's first endpoint, in metres.
    pub at_m: f64,
}

/// Summed length of an open polyline, in metres.
pub(super) fn polyline_length(points: &[DVec2]) -> f64 {
    points
        .windows(2)
        .map(|pair| pair[0].distance(pair[1]))
        .sum()
}
/// Perimeter of a closed contour through these points, in metres.
pub(super) fn closed_perimeter(points: &[DVec2]) -> f64 {
    match points.len() {
        0 | 1 => 0.,
        _ => polyline_length(points) + points[points.len() - 1].distance(points[0]),
    }
}
/// Interior angle at `corner` between the rays to `a` and `b`, in degrees.
pub(super) fn corner_angle(a: DVec2, corner: DVec2, b: DVec2) -> Option<f64> {
    let (u, v) = (a - corner, b - corner);
    if u.length_squared() < 1e-18 || v.length_squared() < 1e-18 {
        return None;
    }
    Some(u.angle_to(v).to_degrees().abs())
}

pub(super) struct FreehandDraft {
    pub enabled: bool,
    pub samples: Vec<DVec2>,
    drawing: bool,
    tolerance_mm: f64,
    preview: Option<PolygonPattern>,
    error: Option<String>,
    overflow: bool,
}
impl Default for FreehandDraft {
    fn default() -> Self {
        Self {
            enabled: false,
            samples: vec![],
            drawing: false,
            tolerance_mm: 1.,
            preview: None,
            error: None,
            overflow: false,
        }
    }
}
impl FreehandDraft {
    fn push(&mut self, point: DVec2) {
        if self.error.is_some() || self.samples.last() == Some(&point) {
            return;
        }
        if self.samples.len() == marvelous_cloth::garment::freehand::MAX_INPUT_SAMPLES {
            self.overflow = true;
            self.error = Some("Stroke exceeds 4096 samples. Draw a shorter outline.".into());
            self.preview = None;
        } else {
            self.samples.push(point);
        }
    }
}

pub(super) struct Board {
    pub freehand: FreehandDraft,
    pub center: DVec2,
    pub scale: f32,
    pub fitted: bool,
    pub snap: bool,
    /// Magnet step in millimetres. The settings preference drives this value;
    /// [`Board::snap_grid_mm`] clamps it, so a hand-edited value cannot poison
    /// the material coordinates.
    pub snap_mm: f64,
    /// View-only rotation of the whole board, in radians. Presentation only: it
    /// transforms the window, never rest geometry, grain, masses or caches.
    pub view_rotation: f64,
    /// Active-panel contour points, mirrored in the cross-panel selection. Indices into
    /// `PolygonPattern::points`; never mesh vertex indices.
    pub selection: Vec<usize>,
    /// Owner of the active point indices; other owners live in point_groups.
    pub selection_panel: Option<String>,
    /// Additional panels in the transient contour selection. Never mesh IDs.
    pub point_groups: std::collections::BTreeMap<String, Vec<usize>>,
    pub group_shapes: std::collections::BTreeMap<String, PolygonPattern>,
    /// Snap resolved for the current pointer position, shown before the click.
    pub hover_snap: Option<Snap>,
    /// Boundary under the pointer, offered as an insert-point target.
    pub insert_hint: Option<InsertHint>,
    drag: Option<Drag>,
    pub shape: Option<(String, PolygonPattern)>,
    pub layout: Option<(String, DVec2)>,
    pub rotation: Option<(String, f64)>,
    pub group_layout: Vec<(String, DVec2)>,
}
impl Default for Board {
    fn default() -> Self {
        Self {
            freehand: FreehandDraft::default(),
            center: DVec2::ZERO,
            scale: 300.,
            fitted: false,
            snap: true,
            snap_mm: DEFAULT_SNAP_MM,
            view_rotation: 0.,
            selection: Vec::new(),
            selection_panel: None,
            point_groups: Default::default(),
            group_shapes: Default::default(),
            hover_snap: None,
            insert_hint: None,
            drag: None,
            shape: None,
            layout: None,
            rotation: None,
            group_layout: Vec::new(),
        }
    }
}
impl Board {
    fn capture_freehand(
        &mut self,
        rect: egui::Rect,
        events: Vec<egui::Event>,
        can_start: bool,
    ) -> bool {
        let mut finished = false;
        for event in events {
            match event {
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed,
                    ..
                } => {
                    if pressed && rect.contains(pos) && can_start {
                        let tolerance_mm = self.freehand.tolerance_mm;
                        self.freehand = FreehandDraft {
                            enabled: true,
                            drawing: true,
                            tolerance_mm,
                            ..Default::default()
                        };
                        let point = self.world(rect, pos);
                        self.freehand.push(point);
                    } else if !pressed && self.freehand.drawing {
                        let point = self.world(rect, pos);
                        self.freehand.push(point);
                        self.freehand.drawing = false;
                        if self.freehand.error.is_none() {
                            finished = true;
                        }
                    }
                }
                egui::Event::PointerMoved(pos) if self.freehand.drawing => {
                    let point = self.world(rect, pos);
                    self.freehand.push(point);
                }
                egui::Event::WindowFocused(false) => {
                    self.clear_preview();
                }
                _ => {}
            }
        }
        finished && !self.freehand.drawing && self.freehand.enabled
    }
    pub(super) fn gesture_active(&self) -> bool {
        self.drag.is_some()
    }
    fn nudge_delta(&self, direction: DVec2, panel_degrees: f64, step_mm: f64) -> DVec2 {
        authoring::rotate_2d(
            direction * step_mm,
            -self.view_rotation_degrees() - panel_degrees,
        )
    }
    fn anchor_cursor(
        &self,
        rect: egui::Rect,
        origin: DVec2,
        angle: f64,
        local: DVec2,
        press: DVec2,
        cursor: egui::Pos2,
    ) -> egui::Pos2 {
        let anchor = origin + authoring::rotate_2d(local, angle);
        self.screen(rect, self.world(rect, cursor) + anchor - press)
    }
    pub(super) fn point_selections(&self) -> std::collections::BTreeMap<String, Vec<usize>> {
        let mut groups = self.point_groups.clone();
        if let Some(id) = &self.selection_panel {
            if self.selection.is_empty() {
                groups.remove(id);
            } else {
                groups.insert(id.clone(), self.selection.clone());
            }
        }
        groups
    }
    pub(super) fn point_selected(&self, panel: &str, index: usize) -> bool {
        if self.selection_panel.as_deref() == Some(panel) {
            self.selection.contains(&index)
        } else {
            self.point_groups
                .get(panel)
                .is_some_and(|points| points.contains(&index))
        }
    }
    pub(super) fn point_count(&self) -> usize {
        self.point_selections().values().map(Vec::len).sum()
    }
    pub(super) fn select_point(&mut self, panel: String, index: usize, add: bool) {
        let mut groups = if add {
            self.point_selections()
        } else {
            Default::default()
        };
        let points = groups.entry(panel.clone()).or_insert_with(Vec::new);
        if add && points.contains(&index) {
            points.retain(|k| *k != index);
        } else {
            points.push(index);
        }
        points.sort_unstable();
        self.selection = points.clone();
        self.selection_panel = Some(panel);
        self.point_groups = groups;
    }
    pub fn clear_preview(&mut self) {
        self.freehand = FreehandDraft::default();
        self.drag = None;
        self.shape = None;
        self.layout = None;
        self.rotation = None;
        self.group_layout.clear();
        self.group_shapes.clear();
        self.point_groups.clear();
        // A committed or cancelled edit can change the point count, so a
        // selection never outlives the edit it was made against: stale indices
        // would move the wrong points.
        self.selection.clear();
        self.selection_panel = None;
    }
    /// Magnet step actually in use, in millimetres.
    pub(super) fn snap_grid_mm(&self) -> f64 {
        if self.snap_mm.is_finite() {
            self.snap_mm.clamp(SNAP_MM_MIN, SNAP_MM_MAX)
        } else {
            DEFAULT_SNAP_MM
        }
    }
    /// Window position of a material point. The board rotation only affects this
    /// mapping; material coordinates are never rewritten.
    pub(super) fn screen(&self, rect: egui::Rect, p: DVec2) -> egui::Pos2 {
        let (sin, cos) = self.view_rotation.sin_cos();
        let d = (p - self.center) * self.scale as f64;
        egui::pos2(
            rect.center().x + (cos * d.x - sin * d.y) as f32,
            rect.center().y + (sin * d.x + cos * d.y) as f32,
        )
    }
    pub(super) fn world(&self, rect: egui::Rect, p: egui::Pos2) -> DVec2 {
        let (sin, cos) = self.view_rotation.sin_cos();
        let v = DVec2::new(
            (p.x - rect.center().x) as f64,
            (p.y - rect.center().y) as f64,
        ) / self.scale as f64;
        self.center + DVec2::new(cos * v.x + sin * v.y, -sin * v.x + cos * v.y)
    }
    /// Pan by a pointer drag in pixels, so the board follows the pointer.
    pub(super) fn pan_by(&mut self, delta: egui::Vec2) {
        let (sin, cos) = self.view_rotation.sin_cos();
        let d = DVec2::new(delta.x as f64, delta.y as f64);
        self.center -=
            DVec2::new(cos * d.x + sin * d.y, -sin * d.x + cos * d.y) / self.scale as f64;
    }
    /// Zoom by `factor` while keeping the material point under the cursor fixed.
    /// A non-positive or non-finite factor is not a zoom; NaN is rejected
    /// explicitly rather than relying on a negated comparison.
    pub(super) fn zoom_at(&mut self, rect: egui::Rect, cursor: egui::Pos2, factor: f64) {
        if factor <= 0. || factor.is_nan() {
            return;
        }
        let before = self.world(rect, cursor);
        self.scale = ((self.scale as f64 * factor) as f32).clamp(MIN_SCALE, MAX_SCALE);
        let after = self.world(rect, cursor);
        self.center += before - after;
    }
    /// Current view rotation in degrees, wrapped to (-180, 180].
    pub(super) fn view_rotation_degrees(&self) -> f64 {
        self.view_rotation.to_degrees()
    }
    /// Set the view rotation, wrapped to (-180, 180].
    pub(super) fn set_view_rotation_degrees(&mut self, degrees: f64) {
        let wrapped = (degrees + 180.).rem_euclid(360.) - 180.;
        self.view_rotation = if wrapped == -180. { 180. } else { wrapped }.to_radians();
    }
    /// Rotate the view by a delta in degrees. Presentation only.
    pub(super) fn rotate_view_by(&mut self, degrees: f64) {
        self.set_view_rotation_degrees(self.view_rotation_degrees() + degrees);
    }
    /// Ask for a fit on the next painted frame, when the rectangle is known.
    pub(super) fn request_fit(&mut self) {
        self.fitted = false;
    }
    /// Reset the view: no rotation, and refit the panels on the next frame.
    pub(super) fn reset_view(&mut self) {
        self.view_rotation = 0.;
        self.request_fit();
    }
    /// Centre and scale the board so the given material-space corners fit the
    /// rectangle under the current view rotation.
    pub(super) fn fit_corners(&mut self, rect: egui::Rect, corners: &[DVec2]) {
        let (sin, cos) = self.view_rotation.sin_cos();
        let rotate = |v: DVec2| DVec2::new(cos * v.x - sin * v.y, sin * v.x + cos * v.y);
        let mut lo = DVec2::splat(f64::INFINITY);
        let mut hi = DVec2::splat(f64::NEG_INFINITY);
        for corner in corners {
            let q = rotate(*corner);
            lo = lo.min(q);
            hi = hi.max(q);
        }
        if !lo.is_finite() || !hi.is_finite() {
            return;
        }
        let view_center = (lo + hi) * 0.5;
        self.center = DVec2::new(
            cos * view_center.x + sin * view_center.y,
            -sin * view_center.x + cos * view_center.y,
        );
        self.scale = ((rect.width() - 80.) / (hi - lo).x.max(0.1) as f32)
            .min((rect.height() - 80.) / (hi - lo).y.max(0.1) as f32)
            .clamp(60., 1600.);
        self.fitted = true;
    }
    fn snapped(&self, p: DVec2) -> DVec2 {
        if !self.snap {
            return p;
        }
        // Work in millimetre units so the stored preference is the magnet step.
        let grid = 1000. / self.snap_grid_mm();
        (p * grid).round() / grid
    }
    /// Resolve a pointer position to the material point a click would use.
    ///
    /// Priority: existing point, segment midpoint, on-edge, angle lock (Shift),
    /// then the drafting grid. Capture radii are screen pixels, so the magnet
    /// feels identical at every zoom; `suspended` (the command modifier) returns
    /// the raw pointer position and says so.
    pub(super) fn resolve_snap(
        &self,
        rect: egui::Rect,
        pointer: egui::Pos2,
        geometry: &SnapGeometry,
        reference: Option<DVec2>,
        angle_lock: bool,
        suspended: bool,
    ) -> Snap {
        let raw = self.world(rect, pointer);
        if suspended {
            return Snap {
                point: raw,
                kind: SnapKind::Free,
                along_m: 0.,
                angle_degrees: 0.,
                suspended: true,
            };
        }
        let mut best = SNAP_POINT_PX;
        let mut captured = None;
        for candidate in &geometry.points {
            let distance = self.screen(rect, *candidate).distance(pointer);
            if distance <= best {
                best = distance;
                captured = Some(*candidate);
            }
        }
        if let Some(point) = captured {
            return Snap::new(point, SnapKind::Point);
        }
        let mut best = SNAP_POINT_PX;
        for [a, b] in &geometry.segments {
            let midpoint = (*a + *b) * 0.5;
            let distance = self.screen(rect, midpoint).distance(pointer);
            if distance <= best {
                best = distance;
                captured = Some(midpoint);
            }
        }
        if let Some(point) = captured {
            return Snap::new(point, SnapKind::Midpoint);
        }
        let mut best = SNAP_EDGE_PX;
        let mut on_edge = None;
        for [a, b] in &geometry.segments {
            let (start, end) = (self.screen(rect, *a), self.screen(rect, *b));
            let d = end - start;
            let t = ((pointer - start).dot(d) / d.length_sq().max(1e-12)).clamp(0., 1.);
            let distance = pointer.distance(start + d * t);
            if distance <= best {
                best = distance;
                let point = *a + (*b - *a) * t as f64;
                on_edge = Some(Snap {
                    point,
                    kind: SnapKind::OnEdge,
                    along_m: t as f64 * a.distance(*b),
                    angle_degrees: 0.,
                    suspended: false,
                });
            }
        }
        if let Some(snap) = on_edge {
            return snap;
        }
        if angle_lock && let Some(reference) = reference {
            let v = raw - reference;
            if v.length_squared() > 1e-12 {
                let step = ANGLE_STEP_DEGREES.to_radians();
                let angle = (v.y.atan2(v.x) / step).round() * step;
                let point = reference + DVec2::new(angle.cos(), angle.sin()) * v.length();
                return Snap {
                    point,
                    kind: SnapKind::Angle,
                    along_m: 0.,
                    angle_degrees: angle.to_degrees(),
                    suspended: false,
                };
            }
        }
        // Lowest priority: the drafting grid, using the historical arithmetic so
        // the default 10 mm magnet behaves exactly as before this change. The
        // magnet checkbox controls the grid only; the modifier suspends all.
        if !self.snap {
            return Snap::new(raw, SnapKind::Free);
        }
        Snap::new(self.snapped(raw), SnapKind::Grid)
    }
}
enum Drag {
    Marquee {
        path: Vec<egui::Pos2>,
        start: egui::Pos2,
        current: egui::Pos2,
        add: bool,
        points: bool,
    },
    Draft(usize),
    Rectangle(DVec2),
    Layout {
        panel: String,
        start: DVec2,
        pointer: DVec2,
        panels: Vec<String>,
    },
    Rotate {
        panel: String,
        pivot: DVec2,
        center: DVec2,
        vector: DVec2,
        angle: f64,
    },
    Shape {
        panel: String,
        polygon: PolygonPattern,
        part: Part,
        origin: DVec2,
        pointer: DVec2,
        angle: f64,
    },
    /// Rotating the board window itself: presentation only, no command is
    /// committed when the drag ends.
    ViewRotate {
        pointer_angle: f64,
        view_rotation: f64,
    },
    /// Moving contour points: one point, or a whole multi-selection rigidly.
    /// `origins` holds the positions at press time so the preview stays exact.
    Points {
        panel: String,
        index: usize,
        polygon: PolygonPattern,
        origins: Vec<(usize, DVec2)>,
        pointer: DVec2,
        groups: Vec<(String, Vec<usize>, PolygonPattern, f64)>,
    },
    /// Moving a corner of the contour currently being drawn. Draft state only.
    DraftPoint(usize),
}
#[derive(Clone)]
enum Part {
    Body,
    Anchor(usize),
    Edge(usize),
    Path(String),
    LineAnchor(usize, usize),
    LineHandle(usize, usize),
    Handle(usize, usize),
    Rotation,
}
struct Hit {
    index: usize,
    part: Part,
}
fn inside(p: DVec2, poly: &[DVec2]) -> bool {
    let mut yes = false;
    for i in 0..poly.len() {
        let a = poly[i];
        let b = poly[(i + 1) % poly.len()];
        if (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
            yes = !yes;
        }
    }
    yes
}
pub(super) fn same_edge(a: &BoundaryRef, b: &BoundaryRef) -> bool {
    a.panel == b.panel && a.edge == b.edge && (a.edge.is_some() || a.side == b.side)
}

fn enter_freehand_draft(authoring: &mut super::authoring_ui::AuthoringUi) {
    authoring.board.clear_preview();
    authoring.board.freehand.enabled = true;
    authoring.replace = false;
    authoring.draft.clear();
    authoring.tangents.clear();
}
/// Angle of a window position around the board centre, used by the view-rotation
/// drag so the board follows the pointer.
fn board_pointer_angle(pos: egui::Pos2, rect: egui::Rect) -> f64 {
    ((pos.y - rect.center().y) as f64).atan2((pos.x - rect.center().x) as f64)
}
/// Millimetre dimension annotation for a selected piece. Presentation only: the
/// labels follow the pattern size and never feed back into the rest contour.
fn paint_panel_dimensions(
    painter: &egui::Painter,
    point: &impl Fn(DVec2) -> egui::Pos2,
    panel: &Panel,
) {
    let (w, h) = (panel.pattern.width, panel.pattern.height);
    let color = Color32::from_rgb(0x15, 0x65, 0xC0);
    let font = egui::FontId::proportional(12.);
    let tick = 4.;
    // Width, below the bottom edge.
    let a = point(DVec2::new(0., h));
    let b = point(DVec2::new(w, h));
    let y = a.y.max(b.y) + 14.;
    painter.line_segment(
        [egui::pos2(a.x, y), egui::pos2(b.x, y)],
        Stroke::new(1., color),
    );
    for x in [a.x, b.x] {
        painter.line_segment(
            [egui::pos2(x, y - tick), egui::pos2(x, y + tick)],
            Stroke::new(1., color),
        );
    }
    painter.text(
        egui::pos2((a.x + b.x) * 0.5, y + 3.),
        egui::Align2::CENTER_TOP,
        format!("{:.1} mm", w * 1000.),
        font.clone(),
        color,
    );
    // Height, beside the right edge.
    let a = point(DVec2::new(w, 0.));
    let b = point(DVec2::new(w, h));
    let x = a.x.max(b.x) + 14.;
    painter.line_segment(
        [egui::pos2(x, a.y), egui::pos2(x, b.y)],
        Stroke::new(1., color),
    );
    for y in [a.y, b.y] {
        painter.line_segment(
            [egui::pos2(x - tick, y), egui::pos2(x + tick, y)],
            Stroke::new(1., color),
        );
    }
    painter.text(
        egui::pos2(x + 3., (a.y + b.y) * 0.5),
        egui::Align2::LEFT_CENTER,
        format!("{:.1} mm", h * 1000.),
        font,
        color,
    );
}
impl Atelier {
    pub(super) fn activate_freehand(&mut self) {
        self.set_authoring_tool(Tool::Draw, false);
        enter_freehand_draft(&mut self.authoring);
    }
    fn fit_freehand_preview(&mut self) {
        let draft = &mut self.authoring.board.freehand;
        if draft.overflow {
            return;
        }
        let result = authoring::freehand_contour(
            &draft.samples,
            draft.tolerance_mm * 0.001,
            marvelous_cloth::garment::meshing::MeshingSettings {
                target_edge_m: self.mesh_mm * 0.001,
                anisotropy: self.anisotropy,
                axis_degrees: self.mesh_axis,
                ..Default::default()
            },
        );
        match result {
            Ok(poly) => {
                draft.preview = Some(poly);
                draft.error = None;
            }
            Err(error) => {
                draft.preview = None;
                draft.error = Some(error);
            }
        }
    }
    fn freehand_controls(&mut self, ui: &mut egui::Ui) {
        // Keep this row present throughout the stroke: the canvas must not
        // move when the first pointer sample arrives.
        ui.horizontal(|ui| {
            ui.label("Fit tolerance");
            let draft = &mut self.authoring.board.freehand;
            let changed = ui
                .add_enabled(
                    !draft.drawing,
                    egui::DragValue::new(&mut draft.tolerance_mm)
                        .range(0.1..=10.)
                        .speed(0.1)
                        .suffix(" mm"),
                )
                .changed();
            if changed && !draft.samples.is_empty() {
                self.fit_freehand_preview();
            }
            let ready = self.authoring.board.freehand.preview.is_some()
                && !self.authoring.board.freehand.drawing;
            if ui
                .add_enabled(ready, egui::Button::new("Create panel"))
                .clicked()
            {
                let draft = &self.authoring.board.freehand;
                if let Some(fabric) = self.project.template.fabrics.first() {
                    let command = Command::Freehand {
                        samples: draft.samples.clone(),
                        tolerance_m: draft.tolerance_mm * 0.001,
                        fabric: fabric.id.clone(),
                        meshing: marvelous_cloth::garment::meshing::MeshingSettings {
                            target_edge_m: self.mesh_mm * 0.001,
                            anisotropy: self.anisotropy,
                            axis_degrees: self.mesh_axis,
                            ..Default::default()
                        },
                    };
                    if self.edit(command) {
                        self.authoring.tool = Tool::Place;
                    }
                }
            }
            if ui.small_button("Cancel").clicked() {
                self.authoring.board.clear_preview();
            }
        });
        ui.small(
            "Drag an outline · release to preview · orange edge closes the stroke · Esc: cancel",
        );
    }
    fn freehand_canvas(&mut self, ui: &egui::Ui, rect: egui::Rect, response: &egui::Response) {
        if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.authoring.board.clear_preview();
            self.paint_board(ui, rect, response);
            return;
        }
        // Consume all delivered pointer samples, not just one per rendered frame.
        // Camera transforms remain fixed while the button is held.
        let events = ui.input(|i| i.events.clone());
        if self
            .authoring
            .board
            .capture_freehand(rect, events, response.contains_pointer())
        {
            self.fit_freehand_preview();
        }
        if !self.authoring.board.freehand.drawing {
            if response.dragged_by(egui::PointerButton::Middle) {
                self.authoring.board.pan_by(ui.input(|i| i.pointer.delta()));
            }
            if let Some(pos) = response.hover_pos() {
                let scroll = ui.input(|i| i.smooth_scroll_delta.y);
                if scroll != 0. {
                    self.authoring
                        .board
                        .zoom_at(rect, pos, (f64::from(scroll) * 0.002).exp());
                }
            }
        }
        self.authoring.board.hover_snap = None;
        self.authoring.board.insert_hint = None;
        self.paint_board(ui, rect, response);
        let board = &self.authoring.board;
        let draft = &board.freehand;
        let painter = ui.painter().with_clip_rect(rect);
        let color = Color32::from_rgb(82, 200, 230);
        if let Some(poly) = &draft.preview {
            for k in 0..poly.points.len() {
                if let Ok(points) = poly.edge_points(k) {
                    painter.add(egui::Shape::line(
                        points.into_iter().map(|p| board.screen(rect, p)).collect(),
                        Stroke::new(2., color),
                    ));
                }
            }
        } else if draft.samples.len() > 1 {
            painter.add(egui::Shape::line(
                draft
                    .samples
                    .iter()
                    .map(|p| board.screen(rect, *p))
                    .collect(),
                Stroke::new(2., color),
            ));
        }
        if let (Some(first), Some(last)) = (draft.samples.first(), draft.samples.last()) {
            painter.line_segment(
                [board.screen(rect, *last), board.screen(rect, *first)],
                Stroke::new(2., Color32::from_rgb(242, 169, 67)),
            );
        }
        if let Some(error) = &draft.error {
            painter.text(
                rect.left_top() + Vec2::splat(12.),
                egui::Align2::LEFT_TOP,
                error,
                egui::FontId::proportional(13.),
                Color32::from_rgb(255, 160, 140),
            );
        }
    }
    pub(super) fn board_angle(&self, i: usize) -> f64 {
        let panel = &self.project.template.panels[i];
        self.authoring
            .board
            .rotation
            .as_ref()
            .filter(|(id, _)| id == &panel.id)
            .map(|(_, angle)| *angle)
            .unwrap_or(panel.layout_rotation_degrees)
    }
    fn rotation_handle(&self, i: usize) -> DVec2 {
        let p = &self.project.template.panels[i];
        DVec2::new(
            p.pattern.width * 0.5,
            -32. / self.authoring.board.scale as f64,
        )
    }
    pub(super) fn board_origin(&self, i: usize) -> DVec2 {
        let p = &self.project.template.panels[i];
        if let Some((_, origin)) = self
            .authoring
            .board
            .group_layout
            .iter()
            .find(|(id, _)| id == &p.id)
        {
            return *origin;
        }
        self.authoring
            .board
            .layout
            .as_ref()
            .filter(|(id, _)| id == &p.id)
            .map(|(_, p)| *p)
            .unwrap_or_else(|| authoring::layout(&self.project.template, i))
    }
    pub(super) fn board_polygon(&self, i: usize) -> Option<&PolygonPattern> {
        let p = &self.project.template.panels[i];
        self.authoring
            .board
            .shape
            .as_ref()
            .filter(|(id, _)| id == &p.id)
            .map(|(_, poly)| poly)
            .or_else(|| self.authoring.board.group_shapes.get(&p.id))
            .or(p.polygon.as_ref())
    }
    /// Candidate geometry for the current frame: the draft plus every displayed
    /// panel, with the points being dragged excluded so a drag cannot snap to
    /// itself. Panel points are local rest coordinates, so they are mapped
    /// through the panel's presentational board transform first.
    fn snap_geometry_for(&self, dragging: Option<(&str, &[usize])>) -> SnapGeometry {
        let mut geometry = SnapGeometry::default();
        geometry.points.extend(self.authoring.draft.iter().copied());
        for pair in self.authoring.draft.windows(2) {
            geometry.segments.push([pair[0], pair[1]]);
        }
        if self.authoring.replace {
            return geometry;
        }
        for (i, panel) in self.project.template.panels.iter().enumerate() {
            let Some(poly) = self.board_polygon(i) else {
                continue;
            };
            let origin = self.board_origin(i);
            let angle = self.board_angle(i);
            let placed = |uv: DVec2| -> DVec2 { origin + authoring::rotate_2d(uv, angle) };
            let excluded = |k: usize| {
                dragging.is_some_and(|(id, points)| id == panel.id && points.contains(&k))
                    || (dragging.is_some() && self.authoring.board.point_selected(&panel.id, k))
            };
            for (k, point) in poly.points.iter().enumerate() {
                if !excluded(k) {
                    geometry.points.push(placed(*point));
                }
            }
            for k in 0..poly.points.len() {
                if excluded(k) || excluded((k + 1) % poly.points.len()) {
                    continue;
                }
                geometry.segments.push([
                    placed(poly.points[k]),
                    placed(poly.points[(k + 1) % poly.points.len()]),
                ]);
            }
        }
        geometry
    }
    fn fit_board(&mut self, rect: egui::Rect) {
        let mut corners = Vec::with_capacity(self.project.template.panels.len() * 4);
        for (i, p) in self.project.template.panels.iter().enumerate() {
            let origin = authoring::layout(&self.project.template, i);
            corners.extend(
                [
                    DVec2::ZERO,
                    DVec2::new(p.pattern.width, 0.),
                    DVec2::new(p.pattern.width, p.pattern.height),
                    DVec2::new(0., p.pattern.height),
                ]
                .map(|corner| origin + authoring::rotate_2d(corner, p.layout_rotation_degrees)),
            );
        }
        self.authoring.board.fit_corners(rect, &corners);
    }
    fn board_hit(&self, rect: egui::Rect, pos: egui::Pos2) -> Option<Hit> {
        let mut edge = None;
        let mut body = None;
        let mut best = 9.;
        for i in (0..self.project.template.panels.len()).rev() {
            let p = &self.project.template.panels[i];
            let origin = self.board_origin(i);
            let angle = self.board_angle(i);
            let point = |uv| {
                self.authoring
                    .board
                    .screen(rect, origin + authoring::rotate_2d(uv, angle))
            };
            if self.authoring.tool == Tool::Edit
                && self.authoring.selected.as_ref() == Some(&p.id)
                && point(self.rotation_handle(i)).distance(pos) < 11.
            {
                return Some(Hit {
                    index: i,
                    part: Part::Rotation,
                });
            }
            let Some(poly) = self.board_polygon(i) else {
                continue;
            };
            if self.authoring.tool == Tool::Edit && self.authoring.selected.as_ref() == Some(&p.id)
            {
                for (l, line) in poly.lines.iter().enumerate() {
                    if self
                        .authoring
                        .edge
                        .as_ref()
                        .is_some_and(|e| e.panel == p.id && e.edge.as_ref() == Some(&line.id))
                    {
                        for (k, uv) in line.points.iter().enumerate() {
                            for (at, part) in [
                                (*uv, Part::LineAnchor(l, k)),
                                (*uv + line.tangents[k], Part::LineHandle(l, k)),
                            ] {
                                if point(at).distance(pos) < 8. {
                                    return Some(Hit { index: i, part });
                                }
                            }
                        }
                    }
                }
            }
            if self.authoring.tool == Tool::Edit {
                // Any displayed point can be grabbed directly: selecting a piece
                // and moving one of its points must be a single gesture, never a
                // tool or panel re-selection.
                for (k, uv) in poly.points.iter().enumerate() {
                    if point(*uv).distance(pos) < SNAP_POINT_PX {
                        return Some(Hit {
                            index: i,
                            part: Part::Anchor(k),
                        });
                    }
                }
            }
            if self.authoring.tool == Tool::Edit
                && self.authoring.selected.as_ref() == Some(&p.id)
                && let Some(e) = self.authoring.edge.as_ref().filter(|e| e.panel == p.id)
                && let Some(k) = poly
                    .edges
                    .iter()
                    .position(|name| Some(name) == e.edge.as_ref())
                && let Some(controls) = poly.curves.get(&poly.edges[k])
            {
                for (j, uv) in controls.iter().enumerate() {
                    if point(*uv).distance(pos) < 9. {
                        return Some(Hit {
                            index: i,
                            part: Part::Handle(k, j),
                        });
                    }
                }
            }
            let mut contour = vec![];
            for k in 0..poly.points.len() {
                let Ok(points) = poly.edge_points(k) else {
                    continue;
                };
                for pair in points.windows(2) {
                    let d = segment_distance(pos, point(pair[0]), point(pair[1]));
                    if d < best {
                        best = d;
                        edge = Some(Hit {
                            index: i,
                            part: Part::Edge(k),
                        });
                    }
                }
                contour.extend_from_slice(&points[..points.len() - 1]);
            }
            if body.is_none()
                && inside(
                    authoring::rotate_2d(self.authoring.board.world(rect, pos) - origin, -angle),
                    &contour,
                )
                && !poly.holes.iter().any(|h| {
                    inside(
                        authoring::rotate_2d(
                            self.authoring.board.world(rect, pos) - origin,
                            -angle,
                        ),
                        &h.points,
                    )
                })
            {
                body = Some(Hit {
                    index: i,
                    part: Part::Body,
                });
            }
            if let Ok(paths) = poly.paths() {
                for (name, points) in paths.into_iter().skip(poly.edges.len()) {
                    for pair in points.windows(2) {
                        let d = segment_distance(pos, point(pair[0]), point(pair[1]));
                        if d < best {
                            best = d;
                            edge = Some(Hit {
                                index: i,
                                part: Part::Path(name.clone()),
                            });
                        }
                    }
                }
            }
        }
        edge.or(body)
    }
    pub(super) fn measurement_panel_at(&self, rect: egui::Rect, pos: egui::Pos2) -> Option<usize> {
        self.board_hit(rect, pos).map(|hit| hit.index)
    }
    pub(super) fn select_boundary(&mut self, edge: BoundaryRef) {
        self.cancel_preview();
        self.authoring.selection.panels.clear();
        self.authoring.selected = Some(edge.panel.clone());
        self.authoring.edge = Some(edge.clone());
        self.authoring.anchor = None;
        self.authoring.board.selection.clear();
        self.authoring.board.selection_panel = None;
        self.authoring.board.point_groups.clear();
        if self.authoring.tool == Tool::Sew {
            if self.authoring.sewing.chain_mode {
                self.authoring.sewing.sides[self.authoring.sewing.active].push(edge);
                return;
            }
            if self.authoring.ends.len() == 2 {
                self.authoring.ends.clear();
            }
            if !self.authoring.ends.iter().any(|e| same_edge(e, &edge)) {
                self.authoring.ends.push(edge);
            }
        }
    }
    pub(super) fn edge_properties(&mut self, ui: &mut egui::Ui) {
        let Some(edge) = self.authoring.edge.clone() else {
            return;
        };
        let Some(p) = self
            .project
            .template
            .panels
            .iter()
            .find(|p| p.id == edge.panel)
        else {
            return;
        };
        let Some(mut poly) = p.polygon.clone() else {
            return;
        };
        let Some(k) = poly
            .edges
            .iter()
            .position(|n| Some(n) == edge.edge.as_ref())
        else {
            return;
        };
        ui.label(format!("Boundary: {}", poly.edges[k]));
        let length = poly
            .edge_points(k)
            .unwrap_or_default()
            .windows(2)
            .map(|p| p[0].distance(p[1]))
            .sum::<f64>();
        ui.small(format!(
            "{:.1} mm · same selection in 2D / 3D",
            length * 1000.
        ));
        if self.authoring.tool == Tool::Edit {
            let curved = poly.curves.contains_key(&poly.edges[k]);
            if ui
                .button(if curved {
                    "Convert to straight segment"
                } else {
                    "Add Bézier handles"
                })
                .clicked()
            {
                if curved {
                    poly.curves.remove(&poly.edges[k]);
                } else {
                    let a = poly.points[k];
                    let b = poly.points[(k + 1) % poly.points.len()];
                    poly.curves.insert(
                        poly.edges[k].clone(),
                        [a.lerp(b, 1. / 3.), a.lerp(b, 2. / 3.)],
                    );
                }
                self.edit(Command::Shape {
                    panel: edge.panel.clone(),
                    polygon: poly.clone(),
                });
            }
            ui.small("Drag the points or handles on the 2D plane.");
        }
        self.marking_properties(ui, &edge.panel, &poly, &poly.edges[k]);
        ui.separator();
    }

    /// Seam allowance and notches for the selected outer boundary. Absorbed into
    /// the same property panel as the boundary tools so selection stays shared
    /// between the 2D and 3D views.
    fn marking_properties(
        &mut self,
        ui: &mut egui::Ui,
        panel: &str,
        polygon: &PolygonPattern,
        name: &str,
    ) {
        let mut targets = Vec::new();
        let command = super::authoring_ui::marking_controls(
            ui,
            panel,
            polygon,
            name,
            &mut self.authoring.markings,
            &mut targets,
        );
        for (target, rect) in targets {
            self.smoke_target_ui(ui, &target, rect);
        }
        if let Some(command) = command {
            self.edit(command);
        }
    }
    pub(super) fn patterns(&mut self, ui: &mut egui::Ui) {
        let header = super::chrome::view_header(
            ui,
            "2D PATTERNS",
            self.prefs.workspace.mode == super::layout::ViewMode::Patterns,
            false,
            super::view_controls::HINT_2D_VIEW,
        );
        if header.expand {
            self.prefs
                .workspace
                .toggle_focus(super::layout::ViewMode::Patterns);
        }
        if header.fit {
            self.authoring.board.request_fit();
        }
        egui::Popup::menu(&header.settings).show(|ui| {
            ui.set_max_width(300.);
            ui.strong("PATTERN DISPLAY");
            let snap_label = format!("Snap to {} mm", self.authoring.board.snap_grid_mm());
            ui.checkbox(&mut self.authoring.board.snap, snap_label);
            super::view_controls::board_bar(ui, &mut self.authoring.board);
        });
        ui.horizontal(|ui| {
            self.primitive_menu(ui);
            if ui.selectable_label(self.authoring.board.freehand.enabled, "Freehand").on_hover_text("Drag a new panel outline, release to preview, then Create panel").clicked() {
                self.activate_freehand();
            }
            let quick = ui.small_button("Quick · Q").on_hover_text("Shapes, mirrors and booleans near the cursor");
            self.smoke_target("quick_open", quick.rect.center());
            if quick.clicked() { self.quick.open(ui.ctx(), quick.rect.left_bottom()); }
            let new=ui.small_button("New sheet").on_hover_text("Draw the first panel of a new garment; replaces the current garment when the contour is closed");
            self.smoke_target("replace",new.rect.center());
            if new.clicked() {
                self.playing = false;
                self.pending = false;
                self.generation += 1;
                self.grab = None;
                self.authoring.replace = true;
                self.authoring.tool = Tool::Draw;
                self.authoring.draft.clear();
                self.authoring.tangents.clear();
                self.authoring.board.clear_preview();
                self.authoring.board.center = DVec2::splat(0.5);
                self.authoring.board.scale = 400.;
                self.authoring.board.fitted = true;
            }

            ui.label("?").on_hover_text(match self.authoring.tool {
                Tool::Draw => "Pen: click = corner · drag = curve · click the first corner to close",
                Tool::Rectangle => "Rectangle: drag between two opposite corners",
                Tool::InternalLine => "Click a boundary to choose its panel, then draw inside · Enter: finish",
                Tool::Sew => "Choose two boundaries in 2D or 3D, then create the seam in Properties",
                Tool::Edit => "Drag points to edit · Shift+click to add · drag empty space to box select · Ctrl+C / Ctrl+V",
                _ => "Right-click for tools · middle-drag to pan · wheel to zoom",
            });
        });
        if self.authoring.tool == Tool::Draw && self.authoring.board.freehand.enabled {
            self.freehand_controls(ui);
        }
        if self.authoring.tool == Tool::InternalLine {
            let target = self
                .authoring
                .drafting
                .line_panel
                .as_deref()
                .unwrap_or("Click a panel or boundary");
            ui.small(format!(
                "Internal line → {target} · Enter: finish · Esc: cancel"
            ));
        }
        if self.authoring.tool == Tool::Measure {
            ui.small("Ruler · click two boundaries on one piece, then Save measurement in Properties → Piece → Measurements. Drag a selected endpoint to stage an edit. Esc: cancel draft.");
        }
        if !self.authoring.draft.is_empty()
            && matches!(self.authoring.tool, Tool::Draw | Tool::InternalLine)
        {
            ui.horizontal(|ui| {
                let internal = self.authoring.tool == Tool::InternalLine;
                let create = ui.add_enabled(
                    self.authoring.draft.len() >= if internal { 2 } else { 3 },
                    egui::Button::new(if internal {
                        "Finish line"
                    } else {
                        "Close contour"
                    }),
                );
                self.smoke_target("create", create.rect.center());
                if create.clicked() {
                    if internal {
                        self.finish_internal_line();
                    } else {
                        self.create_polygon();
                    }
                }
                if ui.small_button("Cancel").clicked() {
                    self.authoring.draft.clear();
                    self.authoring.tangents.clear();
                    self.authoring.replace = false;
                    self.authoring.board.clear_preview();
                }
            });
        }
        self.selection_controls(ui);
        self.sewing_strip(ui);
        ui.separator();
        let (rect, _) = ui.allocate_exact_size(
            ui.available_size().max(Vec2::splat(1.)),
            egui::Sense::hover(),
        );
        // A trace may reveal contextual controls above the canvas mid-gesture.
        // Keep pointer ownership independent of the surrounding widget count.
        let response = ui.interact(
            rect,
            ui.id().with("pattern-canvas"),
            egui::Sense::click_and_drag(),
        );
        if !self.authoring.board.fitted {
            self.fit_board(rect);
        }
        self.authoring.selection.board_rect = Some(rect);
        self.smoke_target("canvas_confirm", rect.left_bottom() + Vec2::new(30., -30.));
        if let Some((i, poly)) = self
            .project
            .template
            .panels
            .iter()
            .enumerate()
            .find(|(_, p)| Some(&p.id) == self.authoring.selected.as_ref())
            .and_then(|(i, p)| p.polygon.as_ref().map(|poly| (i, poly)))
        {
            let corners: Vec<_> = poly
                .points
                .iter()
                .map(|p| {
                    self.authoring.board.screen(
                        rect,
                        self.board_origin(i) + authoring::rotate_2d(*p, self.board_angle(i)),
                    )
                })
                .collect();
            let bounds = egui::Rect::from_points(&corners).expand(16.);
            self.smoke_target("lasso_points", bounds.left_top());
            self.smoke_target("box_points", bounds.left_top());
            self.smoke_target("selection_end", bounds.right_bottom());
        }
        if self.authoring.radial.blocked || self.quick.blocked {
            self.paint_board(ui, rect, &response);
            return;
        }
        if self.authoring.tool == Tool::Draw && self.authoring.board.freehand.enabled {
            self.freehand_canvas(ui, rect, &response);
            return;
        }
        if response.secondary_clicked()
            && !self.authoring.board.gesture_active()
            && self.authoring.drag.is_none()
            && let Some(at) = response.interact_pointer_pos()
        {
            self.authoring.radial.open(ui.ctx(), at);
            self.paint_board(ui, rect, &response);
            return;
        }
        if response.dragged_by(egui::PointerButton::Middle)
            || response.dragged_by(egui::PointerButton::Secondary)
        {
            self.authoring.board.pan_by(ui.input(|i| i.pointer.delta()));
        }
        self.sewing_wheel(&response);
        if let Some(pos) = response.hover_pos() {
            let zoom = ui.input(|i| i.smooth_scroll_delta.y);
            if zoom != 0. {
                self.authoring
                    .board
                    .zoom_at(rect, pos, (f64::from(zoom) * 0.002).exp());
            }
        }
        // Resolve the snap and the insert target once per frame, so the
        // indicator, the click and the drag all agree on the same point.
        let hover_snap = response.hover_pos().map(|pos| {
            let (angle_lock, suspended) = ui.input(|i| (i.modifiers.shift, i.modifiers.command));
            let geometry = self.snap_geometry_for(None);
            let reference = self.authoring.draft.last().copied();
            self.authoring
                .board
                .resolve_snap(rect, pos, &geometry, reference, angle_lock, suspended)
        });
        self.authoring.board.hover_snap = hover_snap;
        self.authoring.board.insert_hint = if self.authoring.tool == Tool::Edit {
            response
                .hover_pos()
                .and_then(|pos| self.segment_hit(rect, pos))
        } else {
            None
        };
        if !matches!(self.authoring.tool, Tool::Inspect | Tool::Measure)
            && !self.sewing_canvas_confirm(&response)
        {
            self.board_events(&response, rect);
        }
        self.paint_board(ui, rect, &response);
        if self.authoring.tool == Tool::Measure {
            self.measure_board(ui, rect, &response);
        }
        if let Some(Drag::Marquee {
            start,
            current,
            points,
            path,
            ..
        }) = &self.authoring.board.drag
        {
            let painter = ui.painter().with_clip_rect(rect);
            let r = egui::Rect::from_two_pos(*start, *current);
            let color = Color32::from_rgb(57, 145, 238);
            if path.is_empty() {
                painter.rect_filled(r, 2., color.gamma_multiply(0.12));
                painter.rect_stroke(r, 2., Stroke::new(1.5, color), egui::StrokeKind::Inside);
            } else {
                let mut outline = path.clone();
                outline.push(*current);
                painter.add(egui::Shape::closed_line(outline, Stroke::new(2., color)));
            }
            painter.text(
                r.min - Vec2::new(0., 6.),
                egui::Align2::LEFT_BOTTOM,
                if *points {
                    "Points · Shift to add"
                } else {
                    "Panels · Shift to add"
                },
                egui::FontId::proportional(11.),
                color,
            );
        }
    }
    /// Selection tools, drawn above the canvas: an editable exact length for the
    /// selected boundary, a corner/curve control for the focused point, and point
    /// removal. Visible controls — never a hidden shortcut.
    pub(super) fn drafting_tools(&mut self, ui: &mut egui::Ui) {
        let edge = self
            .authoring
            .edge
            .clone()
            .and_then(|e| e.edge.map(|name| (e.panel, name)));
        let anchor = self
            .authoring
            .anchor
            .clone()
            .filter(|(panel, k)| self.point_exists(panel, *k));
        if edge.is_none() && anchor.is_none() {
            return;
        }
        ui.horizontal_wrapped(|ui| {
            if let Some((panel, name)) = edge {
                let measured = self.boundary_length_mm(&panel, &name);
                let stored = self
                    .project
                    .template
                    .panels
                    .iter()
                    .find(|p| p.id == panel)
                    .and_then(|p| p.polygon.as_ref())
                    .and_then(|poly| poly.target_length(&name));
                ui.label(egui::RichText::new(format!("Boundary {name}")).small());
                if let Some(measured_mm) = measured {
                    if self.authoring.target_edge.as_ref() != Some(&(panel.clone(), name.clone())) {
                        self.authoring.target_edge = Some((panel.clone(), name.clone()));
                        self.authoring.target_mm = stored.map(authoring::m_to_mm).unwrap_or(measured_mm);
                    }
                    ui.label("Target").on_hover_text(
                        "Type the length this boundary must be, then set it exactly",
                    );
                    // Shared numeric entry, so the board and the inspector format
                    // and parse millimetres identically.
                    super::authoring_ui::millimetre_field(ui, &mut self.authoring.target_mm);
                    let target_m = authoring::mm_to_m(self.authoring.target_mm);
                    let deviation =
                        authoring::deviation_mm(authoring::mm_to_m(measured_mm), target_m);
                    ui.small(if stored.is_some() {
                        format!("measured {measured_mm:.1} mm · {deviation:+.1} mm from the stored target")
                    } else {
                        format!("measured {measured_mm:.1} mm · {deviation:+.1} mm from the typed target")
                    });
                    // Mirror the command's validation instead of offering a click
                    // it would reject: a target must be positive and finite.
                    let target_ok = self.authoring.target_mm.is_finite()
                        && self.authoring.target_mm > 0.;
                    if ui
                        .add_enabled(target_ok, egui::Button::new("Set exact length"))
                        .on_hover_text("Move this boundary to the target length, as one edit")
                        .on_disabled_hover_text("Target length must be a positive finite value")
                        .clicked()
                    {
                        let target = self.authoring.target_mm;
                        self.apply_target_length(panel.clone(), name.clone(), target);
                    }
                    if stored.is_some() && ui.button("Clear target").clicked() {
                        self.apply_target_length(panel.clone(), name.clone(), 0.0);
                    }
                }
            }
            if let Some((panel, k)) = anchor {
                // The button doubles as the match guard: one visible control per
                // state, and no nested `if` to collapse.
                match self.corner_is_curved(&panel, k) {
                    Some(true)
                        if ui
                            .button("Make this corner sharp")
                            .on_hover_text("Replace both incident curves by straight boundaries")
                            .clicked() =>
                    {
                        self.edit(Command::CurvePoint {
                            panel: panel.clone(),
                            anchor: k,
                            curved: false,
                        });
                    }
                    Some(false)
                        if ui
                            .button("Round this corner")
                            .on_hover_text("Add collinear Bézier handles; the outline is unchanged")
                            .clicked() =>
                    {
                        self.edit(Command::CurvePoint {
                            panel: panel.clone(),
                            anchor: k,
                            curved: true,
                        });
                    }
                    _ => {}
                }
                let blocked = self.delete_blocked(&panel, k);
                let button = ui.add_enabled(blocked.is_none(), egui::Button::new("Delete point"));
                let response = match &blocked {
                    Some(reason) => button.on_disabled_hover_text(reason),
                    None => button.on_hover_text("Remove this point and rejoin its two boundaries (Del)"),
                };
                if response.clicked() {
                    self.edit(Command::RemovePoint {
                        panel: panel.clone(),
                        point: k,
                    });
                }
            }
            // Invalid stored targets are surfaced rather than silently trusted.
            let diagnostics = self
                .project
                .template
                .panels
                .iter()
                .find(|p| self.authoring.selected.as_ref() == Some(&p.id))
                .and_then(|p| p.polygon.as_ref())
                .map(|poly| poly.target_diagnostics())
                .unwrap_or_default();
            if let Some(first) = diagnostics.first() {
                ui.colored_label(
                    Color32::from_rgb(0xB0, 0x6A, 0x00),
                    format!("{} stored target(s) ignored", diagnostics.len()),
                )
                .on_hover_text(format!("{first}\nStored targets are ignored until corrected."));
            }
        });
    }
    /// Whether a committed seam references one of these named boundaries. The
    /// command layer refuses to split or rejoin a sewn boundary until the seam is
    /// removed, so the board must not offer that edit either.
    fn seam_uses(&self, panel: &str, edges: &[&str]) -> bool {
        self.project.template.seams.iter().any(|seam| {
            seam.references().any(|side| {
                side.panel == panel
                    && side
                        .edge
                        .as_ref()
                        .is_some_and(|name| edges.iter().any(|e| *e == name))
            })
        })
    }
    /// Why a point cannot be removed right now: the affordance is disabled rather
    /// than offering an edit the command layer would refuse.
    fn delete_blocked(&self, panel: &str, k: usize) -> Option<String> {
        let Some(poly) = self
            .project
            .template
            .panels
            .iter()
            .find(|p| p.id == panel)
            .and_then(|p| p.polygon.as_ref())
        else {
            return Some("This panel has no editable points".into());
        };
        let count = poly.points.len();
        if k >= count {
            return Some("That point no longer exists".into());
        }
        if count <= 3 {
            return Some("A contour needs at least three points".into());
        }
        let previous = (k + count - 1) % count;
        let incidents: [&str; 2] = [&poly.edges[k], &poly.edges[previous]];
        // A seam is a join, a target is a specification; both block the rejoin,
        // and neither has identifier migration yet.
        if self.seam_uses(panel, &incidents) {
            return Some("A seam uses this point's boundaries; delete the seam first".into());
        }
        for edge in incidents {
            if poly.target_lengths.contains_key(edge) {
                return Some(format!("{edge} has a stored target; clear it first"));
            }
            if poly.curves.contains_key(edge) {
                return Some(format!("{edge} is curved; make the corner sharp first"));
            }
        }
        None
    }
    /// Nearest draft corner within the screen capture radius.
    fn draft_point_at(&self, rect: egui::Rect, pos: egui::Pos2) -> Option<usize> {
        let mut best = SNAP_POINT_PX;
        let mut found = None;
        for (k, point) in self.authoring.draft.iter().enumerate() {
            let distance = self.authoring.board.screen(rect, *point).distance(pos);
            if distance <= best {
                best = distance;
                found = Some(k);
            }
        }
        found
    }
    /// Start a point move: the grabbed point alone, or the whole selection when
    /// the grabbed point is already part of it.
    fn begin_point_drag(
        &mut self,
        index: usize,
        k: usize,
        start: egui::Pos2,
        rect: egui::Rect,
        ctx: &egui::Context,
    ) -> Option<Drag> {
        let panel = &self.project.template.panels[index];
        let polygon = panel.polygon.clone()?;
        let add = ctx.input(|i| i.modifiers.shift);
        if !self.authoring.board.point_selected(&panel.id, k) {
            self.authoring.board.select_point(panel.id.clone(), k, add);
        }
        let selections = self.authoring.board.point_selections();
        self.authoring.board.selection_panel = Some(panel.id.clone());
        self.authoring.board.selection = selections.get(&panel.id).cloned().unwrap_or_default();
        self.authoring.board.point_groups = selections.clone();
        let groups = self
            .project
            .template
            .panels
            .iter()
            .filter_map(|p| {
                Some((
                    p.id.clone(),
                    selections.get(&p.id)?.clone(),
                    p.polygon.clone()?,
                    p.layout_rotation_degrees,
                ))
            })
            .collect();
        // The single "primary" point stays available to numeric entry.
        self.authoring.anchor = Some((panel.id.clone(), k));
        // Grabbing a point is a point edit: no boundary stays selected, so Del
        // cannot be ambiguous between "remove the seam" and "remove the point".
        self.authoring.edge = None;
        let mut indices: Vec<usize> = if self.authoring.board.selection.is_empty() {
            vec![k]
        } else {
            self.authoring.board.selection.clone()
        };
        indices.retain(|i| *i != k && *i < polygon.points.len());
        indices.insert(0, k);
        let pointer = self.authoring.board.world(rect, start);
        let origins = indices
            .iter()
            .map(|s| (*s, polygon.points[*s]))
            .collect::<Vec<_>>();
        Some(Drag::Points {
            panel: panel.id.clone(),
            index,
            polygon,
            origins,
            pointer,
            groups,
        })
    }
    /// Begin a tool drag from a primary press that is not a view rotation.
    ///
    /// Point placement and point grabbing both use [`Board::resolve_snap`], so
    /// the coordinate that lands is the one the on-canvas indicator promised.
    fn board_press(&mut self, start: egui::Pos2, rect: egui::Rect, ctx: &egui::Context) {
        if self.authoring.tool == Tool::InternalLine && !self.internal_line_target(rect, start) {
            return;
        }
        if self.authoring.tool == Tool::Edit {
            let hit = self.board_hit(rect, start);
            let points = self.authoring.selection.target == super::selection::BoxTarget::Points;
            if hit.is_none()
                || (points && hit.as_ref().is_some_and(|h| matches!(h.part, Part::Body)))
            {
                self.authoring.board.drag = Some(Drag::Marquee {
                    path: if self.authoring.selection.shape
                        == super::selection::SelectionShape::Lasso
                    {
                        vec![start]
                    } else {
                        vec![]
                    },
                    start,
                    current: start,
                    add: ctx.input(|i| i.modifiers.shift),
                    points,
                });
                return;
            }
        }
        let (angle_lock, suspended) = ctx.input(|i| (i.modifiers.shift, i.modifiers.command));
        let geometry = self.snap_geometry_for(None);
        let reference = self.authoring.draft.last().copied();
        let p = self
            .authoring
            .board
            .resolve_snap(rect, start, &geometry, reference, angle_lock, suspended)
            .point;
        match self.authoring.tool {
            Tool::Draw | Tool::Rectangle | Tool::Ellipse | Tool::Sector | Tool::InternalLine => {
                // A press on a corner already placed moves that corner. Fixing a
                // corner must not require leaving the pen.
                if let Some(k) = self.draft_point_at(rect, start) {
                    self.authoring.board.drag = Some(Drag::DraftPoint(k));
                    return;
                }
                if matches!(self.authoring.tool, Tool::Draw | Tool::InternalLine) {
                    if self.authoring.draft.len() < 64 {
                        let k = self.authoring.draft.len();
                        self.authoring.draft.push(p);
                        self.authoring.tangents.push(DVec2::ZERO);
                        self.authoring.board.drag = Some(Drag::Draft(k));
                    }
                } else {
                    self.authoring.board.drag = Some(Drag::Rectangle(p));
                }
            }
            Tool::Edit => {
                if let Some(hit) = self.board_hit(rect, start) {
                    let panel = &self.project.template.panels[hit.index];
                    let id = panel.id.clone();
                    let polygon = panel.polygon.clone();
                    if matches!(hit.part, Part::Body) {
                        self.authoring.edge = None;
                        if !self.panel_selected(&id) {
                            self.select_panel(id.clone(), ctx.input(|i| i.modifiers.shift));
                        }
                    } else {
                        self.authoring.selection.panels.clear();
                    }
                    self.authoring.selected = Some(id.clone());
                    self.authoring.board.drag = match hit.part {
                        Part::Rotation => {
                            let panel = &self.project.template.panels[hit.index];
                            let pivot = DVec2::new(panel.pattern.width, panel.pattern.height) * 0.5;
                            let angle = self.board_angle(hit.index);
                            let center =
                                self.board_origin(hit.index) + authoring::rotate_2d(pivot, angle);
                            Some(Drag::Rotate {
                                panel: panel.id.clone(),
                                pivot,
                                center,
                                vector: self.authoring.board.world(rect, start) - center,
                                angle,
                            })
                        }
                        Part::Body => Some(Drag::Layout {
                            panel: id,
                            start: self.board_origin(hit.index),
                            pointer: p,
                            panels: self.selected_panels(),
                        }),
                        Part::Anchor(k) => self.begin_point_drag(hit.index, k, start, rect, ctx),
                        Part::Handle(_, _) | Part::LineAnchor(_, _) | Part::LineHandle(_, _) => {
                            polygon.map(|polygon| Drag::Shape {
                                panel: id,
                                polygon,
                                part: hit.part,
                                origin: self.board_origin(hit.index),
                                pointer: p,
                                angle: self.board_angle(hit.index),
                            })
                        }
                        _ => None,
                    };
                }
            }
            _ => {}
        }
    }
    /// Commit a contour edit that keeps the same boundary names and point count.
    /// Boundary identity, not vertex indices, is what the 3D view shares.
    fn commit_contour(&mut self, panel: String, polygon: PolygonPattern) {
        self.edit(Command::Shape { panel, polygon });
    }
    /// Whether a contour point still exists, so stale references never edit.
    fn point_exists(&self, panel: &str, k: usize) -> bool {
        self.project
            .template
            .panels
            .iter()
            .find(|p| p.id == panel)
            .and_then(|p| p.polygon.as_ref())
            .is_some_and(|poly| k < poly.points.len())
    }
    /// Sampled rest length of a named boundary, in millimetres.
    fn boundary_length_mm(&self, panel: &str, edge: &str) -> Option<f64> {
        let poly = self
            .project
            .template
            .panels
            .iter()
            .find(|p| p.id == panel)?
            .polygon
            .as_ref()?;
        authoring::edge_length(poly, edge)
            .ok()
            .map(authoring::m_to_mm)
    }
    /// Whether both boundaries meeting at a point are curved.
    fn corner_is_curved(&self, panel: &str, k: usize) -> Option<bool> {
        let poly = self
            .project
            .template
            .panels
            .iter()
            .find(|p| p.id == panel)?
            .polygon
            .as_ref()?;
        let count = poly.points.len();
        if k >= count {
            return None;
        }
        let previous = (k + count - 1) % count;
        Some(
            poly.curves.contains_key(&poly.edges[k])
                && poly.curves.contains_key(&poly.edges[previous]),
        )
    }
    /// Arrow-key nudge of the current point selection: one undo entry per press.
    fn nudge_selection(&mut self, direction: DVec2, coarse: bool) {
        let groups = self.authoring.board.point_selections();
        if groups.is_empty() {
            return;
        }
        let step = if coarse { NUDGE_COARSE_MM } else { NUDGE_MM };
        let board_delta = self.authoring.board.nudge_delta(direction, 0., step) / 1000.;
        if self.edit(Command::MovePointGroups {
            groups: groups.clone().into_iter().collect(),
            board_delta,
        }) {
            self.authoring.board.point_groups = groups;
        }
    }
    /// Nearest displayed boundary to the pointer, as an insert-point target,
    /// with the material arclength of the projection. Corners are refused so the
    /// marker only appears where a point can actually go.
    fn segment_hit(&self, rect: egui::Rect, pos: egui::Pos2) -> Option<InsertHint> {
        let mut best = SNAP_EDGE_PX;
        let mut hit = None;
        for (i, panel) in self.project.template.panels.iter().enumerate() {
            let Some(poly) = self.board_polygon(i) else {
                continue;
            };
            let origin = self.board_origin(i);
            let angle = self.board_angle(i);
            // Local rest coordinates to board material coordinates.
            let placed = |uv: DVec2| origin + authoring::rotate_2d(uv, angle);
            let screen = |uv: DVec2| self.authoring.board.screen(rect, placed(uv));
            let centroid = poly.points.iter().fold(DVec2::ZERO, |sum, p| sum + *p)
                / poly.points.len().max(1) as f64;
            let placed_centroid = placed(centroid);
            // The badge offset is 18 screen pixels, expressed in material metres so
            // it stays the same size at every zoom.
            let offset_m = 18. / self.authoring.board.scale.max(1.) as f64;
            for (k, name) in poly.edges.iter().enumerate() {
                // The split command refuses a boundary that carries a stored
                // target or belongs to a seam, so the badge is not offered there.
                // Clearing the target, or deleting the seam, brings it back.
                if poly.target_lengths.contains_key(name)
                    || self.seam_uses(&panel.id, &[name.as_str()])
                {
                    continue;
                }
                let Ok(points) = poly.edge_points(k) else {
                    continue;
                };
                let total: f64 = points
                    .windows(2)
                    .map(|pair| pair[0].distance(pair[1]))
                    .sum();
                let mut along = 0.;
                for pair in points.windows(2) {
                    let (a, b) = (pair[0], pair[1]);
                    let (start, end) = (screen(a), screen(b));
                    let d = end - start;
                    let t = ((pos - start).dot(d) / d.length_sq().max(1e-12)).clamp(0., 1.);
                    let distance = pos.distance(start + d * t);
                    let length = a.distance(b);
                    let at_m = along + length * t as f64;
                    if distance < best && at_m > 1e-4 && at_m < total - 1e-4 {
                        best = distance;
                        let point = placed(a + (b - a) * t as f64);
                        let outward = (point - placed_centroid).normalize_or_zero();
                        hit = Some(InsertHint {
                            panel: panel.id.clone(),
                            edge: name.clone(),
                            point,
                            badge: point + outward * offset_m,
                            at_m,
                        });
                    }
                    along += length;
                }
            }
        }
        hit
    }
    /// Insert a point when the visible `+` badge is clicked. Returns true when
    /// the click belonged to the badge and must not select anything else. The
    /// badge sits outside the boundary, so clicking the boundary still selects it.
    fn insert_hint_clicked(&mut self, rect: egui::Rect, pos: egui::Pos2) -> bool {
        let Some(hint) = self.authoring.board.insert_hint.clone() else {
            return false;
        };
        let badge = self.authoring.board.screen(rect, hint.badge);
        if badge.distance(pos) > SNAP_POINT_PX {
            return false;
        }
        self.edit(Command::SplitBoundary {
            panel: hint.panel,
            edge: hint.edge,
            at_m: hint.at_m,
        })
    }
    /// Exact length for a named boundary. `target_mm == 0` clears the target.
    fn apply_target_length(&mut self, panel: String, edge: String, target_mm: f64) {
        let target_m = if target_mm > 0. {
            authoring::mm_to_m(target_mm)
        } else {
            0.
        };
        if self.edit(Command::TargetLength {
            panel,
            edge,
            target_m,
        }) {
            self.status = if target_m > 0. {
                format!("Boundary fixed at {target_mm:.1} mm")
            } else {
                "Target length cleared".into()
            };
        }
    }
    fn board_events(&mut self, response: &egui::Response, rect: egui::Rect) {
        let pos = response.interact_pointer_pos();
        if response.drag_started_by(egui::PointerButton::Primary)
            && let Some(start) = response.ctx.input(|i| i.pointer.press_origin())
        {
            // Alt + left drag rotates the board window. Presentation only: no
            // authoring command is created, so nothing physical can change.
            if response.ctx.input(|i| i.modifiers.alt) {
                self.authoring.board.drag = Some(Drag::ViewRotate {
                    pointer_angle: board_pointer_angle(start, rect),
                    view_rotation: self.authoring.board.view_rotation,
                });
            } else {
                let ctx = response.ctx.clone();
                self.board_press(start, rect, &ctx);
            }
        }
        if response.dragged_by(egui::PointerButton::Primary)
            && let Some(pos) = pos
        {
            let (angle_lock, suspended) = response
                .ctx
                .input(|i| (i.modifiers.shift, i.modifiers.command));
            // The angle lock leans on the last placed corner while drawing.
            let reference = match &self.authoring.board.drag {
                Some(Drag::Draft(k)) => self.authoring.draft.get(*k).copied(),
                _ => None,
            };
            let geometry = self.snap_geometry_for(None);
            let p = self
                .authoring
                .board
                .resolve_snap(rect, pos, &geometry, reference, angle_lock, suspended)
                .point;
            match &self.authoring.board.drag {
                Some(Drag::Marquee {
                    start,
                    add,
                    points,
                    path,
                    ..
                }) => {
                    let mut path = path.clone();
                    if path.last().is_some_and(|p| p.distance(pos) >= 3.) {
                        path.push(pos);
                    }
                    self.authoring.board.drag = Some(Drag::Marquee {
                        path,
                        start: *start,
                        current: pos,
                        add: *add,
                        points: *points,
                    });
                }
                Some(Drag::ViewRotate {
                    pointer_angle,
                    view_rotation,
                }) => {
                    let mut delta = board_pointer_angle(pos, rect) - *pointer_angle;
                    // Take the short way round when the drag crosses the branch cut.
                    delta = (delta + std::f64::consts::PI).rem_euclid(std::f64::consts::TAU)
                        - std::f64::consts::PI;
                    self.authoring
                        .board
                        .set_view_rotation_degrees((*view_rotation + delta).to_degrees());
                }
                Some(Drag::DraftPoint(k)) => self.authoring.draft[*k] = p,
                Some(Drag::Points {
                    panel,
                    index,
                    polygon,
                    origins,
                    pointer,
                    groups,
                }) => {
                    // The grabbed point follows the pointer with its original
                    // grip offset, then snaps; every other selected point and the
                    // attached Bézier controls shift rigidly by the same delta.
                    let angle = self.board_angle(*index);
                    let primary = self.board_origin(*index)
                        + authoring::rotate_2d(
                            origins.first().map_or(DVec2::ZERO, |(_, origin)| *origin),
                            angle,
                        );
                    let cursor = self.authoring.board.anchor_cursor(
                        rect,
                        self.board_origin(*index),
                        angle,
                        origins.first().map_or(DVec2::ZERO, |(_, origin)| *origin),
                        *pointer,
                        pos,
                    );
                    let indices: Vec<usize> = origins.iter().map(|(k, _)| *k).collect();
                    let geometry = self.snap_geometry_for(Some((panel.as_str(), &indices)));
                    let snapped = self
                        .authoring
                        .board
                        .resolve_snap(rect, cursor, &geometry, None, false, suspended);
                    let shift = authoring::rotate_2d(snapped.point - primary, -angle);
                    let mut moved = polygon.clone();
                    let count = moved.points.len();
                    for (k, origin) in origins {
                        moved.points[*k] = *origin + shift;
                        let edge = moved.edges[*k].clone();
                        if let Some(controls) = moved.curves.get_mut(&edge) {
                            controls[0] += shift;
                        }
                        let previous = (*k + count - 1) % count;
                        let edge = moved.edges[previous].clone();
                        if let Some(controls) = moved.curves.get_mut(&edge) {
                            controls[1] += shift;
                        }
                    }
                    self.authoring.board.group_shapes.clear();
                    let board_delta = snapped.point - primary;
                    for (id, points, original, degrees) in groups {
                        let delta = authoring::rotate_2d(board_delta, -*degrees);
                        let mut preview = original.clone();
                        for k in points {
                            preview.points[*k] += delta;
                            if let Some(c) = preview.curves.get_mut(&preview.edges[*k]) {
                                c[0] += delta;
                            }
                            let previous = (*k + preview.points.len() - 1) % preview.points.len();
                            if let Some(c) = preview.curves.get_mut(&preview.edges[previous]) {
                                c[1] += delta;
                            }
                        }
                        self.authoring
                            .board
                            .group_shapes
                            .insert(id.clone(), preview);
                    }
                    self.authoring.board.shape = Some((panel.clone(), moved));
                }
                Some(Drag::Draft(k)) => self.authoring.tangents[*k] = p - self.authoring.draft[*k],
                Some(Drag::Rectangle(start)) => {
                    let p = if response.ctx.input(|i| i.modifiers.shift) {
                        let delta = p - *start;
                        *start + delta.signum() * delta.abs().max_element()
                    } else {
                        p
                    };
                    let lo = start.min(p);
                    let hi = start.max(p);
                    self.authoring.draft =
                        vec![lo, DVec2::new(hi.x, lo.y), hi, DVec2::new(lo.x, hi.y)];
                    self.authoring.tangents = vec![DVec2::ZERO; 4];
                }
                Some(Drag::Layout {
                    panel,
                    start,
                    pointer,
                    panels,
                }) => {
                    let delta = p - *pointer;
                    self.authoring.board.group_layout = self
                        .project
                        .template
                        .panels
                        .iter()
                        .enumerate()
                        .filter(|(_, panel)| panels.contains(&panel.id))
                        .map(|(i, panel)| {
                            (
                                panel.id.clone(),
                                authoring::layout(&self.project.template, i) + delta,
                            )
                        })
                        .collect();
                    self.authoring.board.layout = Some((panel.clone(), *start + delta));
                }
                Some(Drag::Rotate {
                    panel,
                    pivot,
                    center,
                    vector,
                    angle,
                }) => {
                    let v = self.authoring.board.world(rect, pos) - *center;
                    if v.length_squared() > 1e-10 {
                        let mut degrees =
                            *angle + vector.perp_dot(v).atan2(vector.dot(v)).to_degrees();
                        if response.ctx.input(|i| i.modifiers.shift) {
                            degrees = (degrees / 15.).round() * 15.;
                        }
                        self.authoring.board.layout = Some((
                            panel.clone(),
                            *center - authoring::rotate_2d(*pivot, degrees),
                        ));
                        self.authoring.board.rotation = Some((panel.clone(), degrees));
                    }
                }
                Some(Drag::Shape {
                    panel,
                    polygon,
                    part,
                    origin,
                    pointer,
                    angle,
                }) => {
                    let mut poly = polygon.clone();
                    match *part {
                        Part::Anchor(k) => {
                            let delta = authoring::rotate_2d(p - *pointer, -*angle);
                            poly.points[k] += delta;
                            if let Some(c) = poly.curves.get_mut(&poly.edges[k]) {
                                c[0] += delta;
                            }
                            let prev = (k + poly.points.len() - 1) % poly.points.len();
                            if let Some(c) = poly.curves.get_mut(&poly.edges[prev]) {
                                c[1] += delta;
                            }
                        }
                        Part::Handle(k, j) => {
                            poly.curves.get_mut(&poly.edges[k]).unwrap()[j] =
                                authoring::rotate_2d(p - *origin, -*angle)
                        }
                        Part::LineAnchor(l, k) => {
                            poly.lines[l].points[k] += authoring::rotate_2d(p - *pointer, -*angle)
                        }
                        Part::LineHandle(l, k) => {
                            poly.lines[l].tangents[k] =
                                authoring::rotate_2d(p - *origin, -*angle) - poly.lines[l].points[k]
                        }
                        _ => {}
                    }
                    self.authoring.board.shape = Some((panel.clone(), poly));
                }
                _ => {}
            }
        }
        if response.drag_stopped_by(egui::PointerButton::Primary) {
            match self.authoring.board.drag.take() {
                Some(Drag::Marquee {
                    mut path,
                    start,
                    current,
                    add,
                    points,
                }) => {
                    let end = pos.unwrap_or(current);
                    if start.distance(end) < 3. && path.len() < 3 {
                        return;
                    }
                    let region = if path.is_empty() {
                        super::selection::Region::Box(egui::Rect::from_two_pos(start, end))
                    } else {
                        path.push(end);
                        super::selection::Region::Lasso(path)
                    };
                    self.finish_marquee(rect, region, add, points);
                }
                Some(Drag::Rotate { .. }) => {
                    if let (Some((panel, origin)), Some((_, rotation_degrees))) = (
                        self.authoring.board.layout.take(),
                        self.authoring.board.rotation.take(),
                    ) {
                        self.edit(Command::BoardTransform {
                            panel,
                            origin,
                            rotation_degrees,
                        });
                    }
                }
                Some(Drag::Rectangle(_)) => {
                    if self.authoring.draft.len() == 4
                        && self.authoring.draft[0].distance(self.authoring.draft[2]) > 0.02
                    {
                        self.create_polygon();
                    }
                }
                Some(Drag::Layout { start, panels, .. }) => {
                    if let Some((_, origin)) = self.authoring.board.layout.take() {
                        self.authoring.board.group_layout.clear();
                        self.edit(Command::LayoutGroup {
                            panels,
                            delta: origin - start,
                        });
                    }
                }
                Some(Drag::Shape { .. }) => {
                    if let Some((panel, polygon)) = self.authoring.board.shape.take() {
                        self.commit_contour(panel, polygon);
                    }
                }
                Some(Drag::Points {
                    origins,
                    groups,
                    index,
                    ..
                }) => {
                    if let Some((_, preview)) = self.authoring.board.shape.take()
                        && let Some((first, origin)) = origins.first()
                    {
                        let delta = preview.points[*first] - *origin;
                        let board_delta = authoring::rotate_2d(delta, self.board_angle(index));
                        self.authoring.board.group_shapes.clear();
                        if delta.length_squared() > 0. {
                            let selections: Vec<_> = groups
                                .into_iter()
                                .map(|(id, points, _, _)| (id, points))
                                .collect();
                            if self.edit(Command::MovePointGroups {
                                groups: selections.clone(),
                                board_delta,
                            }) {
                                self.authoring.board.point_groups =
                                    selections.into_iter().collect();
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        if response.clicked()
            && let Some(pos) = pos
        {
            if self.insert_hint_clicked(rect, pos) {
                // Consumed by the visible insert marker.
            } else if let Some((panel, k)) = self.delete_badge_at(rect, pos) {
                self.edit(Command::RemovePoint { panel, point: k });
            } else if matches!(self.authoring.tool, Tool::Draw | Tool::InternalLine) {
                if self.authoring.tool == Tool::InternalLine
                    && !self.internal_line_target(rect, pos)
                {
                    return;
                }
                let close = self.authoring.tool == Tool::Draw
                    && self.authoring.draft.len() >= 3
                    && self
                        .authoring
                        .board
                        .screen(rect, self.authoring.draft[0])
                        .distance(pos)
                        < 10.;
                if close {
                    self.create_polygon();
                } else if self.authoring.draft.len() < 64 {
                    let (angle_lock, suspended) = response
                        .ctx
                        .input(|i| (i.modifiers.shift, i.modifiers.command));
                    let geometry = self.snap_geometry_for(None);
                    let reference = self.authoring.draft.last().copied();
                    let p = self
                        .authoring
                        .board
                        .resolve_snap(rect, pos, &geometry, reference, angle_lock, suspended)
                        .point;
                    if self.authoring.draft.last() != Some(&p) {
                        self.authoring.draft.push(p);
                        self.authoring.tangents.push(DVec2::ZERO);
                    }
                }
            } else if let Some(hit) = self.board_hit(rect, pos) {
                let panel = &self.project.template.panels[hit.index];
                let id = panel.id.clone();
                let edge = match &hit.part {
                    Part::Edge(k) => panel
                        .polygon
                        .as_ref()
                        .map(|polygon| polygon.edges[*k].clone()),
                    Part::Path(name) => Some(name.clone()),
                    Part::LineAnchor(line, _) | Part::LineHandle(line, _) => {
                        panel.polygon.as_ref().map(|p| p.lines[*line].id.clone())
                    }
                    _ => None,
                };
                let anchor = match &hit.part {
                    Part::Anchor(k) => Some((id.clone(), *k)),
                    _ => None,
                };
                if let Some(name) = edge {
                    let reference = BoundaryRef {
                        reversed: false,
                        panel: id,
                        side: Side::Top,
                        edge: Some(name),
                        range: [0., 1.],
                    };
                    let t = self.boundary_parameter(&reference, rect, pos, false);
                    self.pick_sewing_boundary(reference, t, pos);
                } else {
                    self.cancel_preview();
                    self.authoring.edge = None;
                    if let Some((_, k)) = &anchor {
                        self.authoring.selected = Some(id.clone());
                        self.authoring.selection.panels.clear();
                        let add = response.ctx.input(|i| i.modifiers.shift);
                        self.authoring.board.select_point(id, *k, add);
                    } else {
                        self.select_panel(id, response.ctx.input(|i| i.modifiers.shift));
                    }
                    // Numeric point entry follows the point clicked on the board.
                    self.authoring.anchor = anchor;
                }
            } else if self.authoring.tool == Tool::Edit
                && !response.ctx.input(|i| i.modifiers.shift)
            {
                self.authoring.selected = None;
                self.authoring.selection.panels.clear();
                self.authoring.anchor = None;
                self.authoring.edge = None;
                self.authoring.board.selection.clear();
                self.authoring.board.selection_panel = None;
                self.authoring.board.point_groups.clear();
            }
        }
        if !response.ctx.egui_wants_keyboard_input() {
            if response.ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
                self.authoring.board.clear_preview();
                self.authoring.draft.clear();
                self.authoring.tangents.clear();
                self.authoring.replace = false;
            }
            if response.ctx.input(|i| i.key_pressed(egui::Key::Backspace)) {
                self.authoring.draft.pop();
                self.authoring.tangents.pop();
            }
            if matches!(self.authoring.tool, Tool::Draw | Tool::InternalLine)
                && response.ctx.input(|i| i.key_pressed(egui::Key::Enter))
            {
                if self.authoring.tool == Tool::InternalLine {
                    self.finish_internal_line();
                } else {
                    self.create_polygon();
                }
            }
            // Board navigation keys. They move the window only and never touch
            // the material coordinates.
            if response
                .ctx
                .input(|i| i.key_pressed(egui::Key::OpenBracket))
            {
                self.authoring.board.rotate_view_by(-ROTATE_STEP_DEGREES);
            }
            if response
                .ctx
                .input(|i| i.key_pressed(egui::Key::CloseBracket))
            {
                self.authoring.board.rotate_view_by(ROTATE_STEP_DEGREES);
            }
            if response.ctx.input(|i| i.key_pressed(egui::Key::Home)) {
                self.authoring.board.reset_view();
            }
            // Point editing keys. Arrows nudge the selection by 1 mm, or 10 mm
            // with Shift; Del removes the focused point. Both are announced on
            // canvas, so the keys are a shortcut rather than the only way in.
            let coarse = response.ctx.input(|i| i.modifiers.shift);
            for (key, direction) in [
                (egui::Key::ArrowLeft, DVec2::new(-1., 0.)),
                (egui::Key::ArrowRight, DVec2::new(1., 0.)),
                (egui::Key::ArrowUp, DVec2::new(0., -1.)),
                (egui::Key::ArrowDown, DVec2::new(0., 1.)),
            ] {
                if self.authoring.tool == Tool::Edit && response.ctx.input(|i| i.key_pressed(key)) {
                    self.nudge_selection(direction, coarse);
                }
            }
            if self.authoring.tool == Tool::Edit
                && response.ctx.input(|i| i.key_pressed(egui::Key::Delete))
                && self.authoring.edge.is_none()
                && let Some((panel, k)) = self.authoring.anchor.clone()
                && self.point_exists(&panel, k)
                && self.delete_blocked(&panel, k).is_none()
            {
                self.edit(Command::RemovePoint { panel, point: k });
            }
        }
        if let Some(pos) = response.hover_pos()
            && let Some(hit) = self.board_hit(rect, pos)
        {
            let panel = &self.project.template.panels[hit.index];
            let name = match hit.part {
                Part::Edge(k) => Some(panel.polygon.as_ref().unwrap().edges[k].clone()),
                Part::Path(name) => Some(name),
                _ => None,
            };
            self.authoring.hover_edge = name.map(|name| BoundaryRef {
                reversed: false,
                panel: panel.id.clone(),
                side: Side::Top,
                edge: Some(name),
                range: [0., 1.],
            });
        }
    }
    /// A boundary click chooses its owner without placing an invalid endpoint
    /// on the contour. Once drawing starts the target stays fixed until cancel.
    fn internal_line_target(&mut self, rect: egui::Rect, pos: egui::Pos2) -> bool {
        let hit = self.board_hit(rect, pos);
        if self.authoring.draft.is_empty() {
            let Some(hit) = hit else {
                self.status =
                    "Internal line: click inside a panel, or click its boundary to select it"
                        .into();
                return false;
            };
            let panel = &self.project.template.panels[hit.index];
            self.authoring.drafting.line_panel = Some(panel.id.clone());
            self.authoring.selected = Some(panel.id.clone());
            self.inspector_tab = super::chrome::InspectorTab::Piece;
            self.authoring.error = None;
            if !matches!(hit.part, Part::Body) {
                self.status = format!(
                    "Internal line → {} · now click inside this panel",
                    panel.name
                );
                return false;
            }
        } else if let Some(hit) = hit
            && self.authoring.drafting.line_panel.as_ref()
                != Some(&self.project.template.panels[hit.index].id)
        {
            self.status =
                "Finish or cancel the current internal line before choosing another panel".into();
            return false;
        }
        true
    }
    fn paint_board(&mut self, ui: &egui::Ui, rect: egui::Rect, response: &egui::Response) {
        // Selection can change while the Piece inspector is hidden.
        if self.authoring.dart.as_ref().is_some_and(|d| {
            self.authoring.tool != Tool::Edit || !d.matches_boundary(self.authoring.edge.as_ref())
        }) {
            self.authoring.dart = None;
        }
        let mut smoke_targets: Vec<(String, egui::Pos2)> = vec![];
        let painter = ui.painter().with_clip_rect(rect);
        // The pattern board is a white drafting sheet; the 3D window has its own
        // studio backdrop, so the two do not share a background colour.
        painter.rect_filled(rect, 0., Color32::from_rgb(0xFA, 0xFA, 0xFB));
        let board = &self.authoring.board;
        let spacing = if board.scale < 140. { 0.25 } else { 0.05 };
        let lo = board.world(rect, rect.min);
        let hi = board.world(rect, rect.max);
        for k in (lo.x / spacing).floor() as i32..=(hi.x / spacing).ceil() as i32 {
            painter.line_segment(
                [
                    board.screen(rect, DVec2::new(k as f64 * spacing, lo.y)),
                    board.screen(rect, DVec2::new(k as f64 * spacing, hi.y)),
                ],
                Stroke::new(0.5, Color32::from_gray(0xDC)),
            );
        }
        for k in (lo.y / spacing).floor() as i32..=(hi.y / spacing).ceil() as i32 {
            painter.line_segment(
                [
                    board.screen(rect, DVec2::new(lo.x, k as f64 * spacing)),
                    board.screen(rect, DVec2::new(hi.x, k as f64 * spacing)),
                ],
                Stroke::new(0.5, Color32::from_gray(0xDC)),
            );
        }
        if !self.authoring.replace {
            for (i, panel) in self.project.template.panels.iter().enumerate() {
                let origin = self.board_origin(i);
                let angle = self.board_angle(i);
                let point = |uv| board.screen(rect, origin + authoring::rotate_2d(uv, angle));
                let selected = self.authoring.selected.as_ref() == Some(&panel.id);
                if i == 0 {
                    for (name, uv) in [
                        ("inside_a", DVec2::new(0.1, 0.15)),
                        ("inside_b", DVec2::new(0.3, 0.15)),
                    ] {
                        smoke_targets.push((name.into(), point(uv)));
                    }
                }
                let range = &self.scene.garment.panels[i];
                let mut mesh = egui::Mesh::default();
                let mut wire = Vec::new();
                // Transform each material vertex once; indices are shared by its triangles.
                mesh.vertices.reserve(range.vertices.len());
                mesh.indices.reserve(range.triangles.len() * 3);
                for &uv in &self.scene.garment.mesh.uv[range.vertices.clone()] {
                    mesh.colored_vertex(
                        point(uv),
                        if self.panel_selected(&panel.id) {
                            // Light blue for the active piece, light grey for the
                            // rest: the board is white, so the fill carries the
                            // selection instead of a bright outline on dark.
                            Color32::from_rgb(0xC9, 0xDF, 0xF5)
                        } else {
                            Color32::from_rgb(0xE9, 0xEC, 0xF1)
                        },
                    );
                }
                for tri in &self.scene.garment.mesh.triangles[range.triangles.clone()] {
                    let [a, b, c] = tri.vertices.map(|v| (v - range.vertices.start) as u32);
                    mesh.add_triangle(a, b, c);
                    if self.wire {
                        for k in 0..3 {
                            wire.push(egui::Shape::line_segment(
                                [point(tri.rest[k]), point(tri.rest[(k + 1) % 3])],
                                Stroke::new(0.4, Color32::GRAY),
                            ));
                        }
                    }
                }
                painter.add(egui::Shape::mesh(mesh));
                for face in self.issue.faces.range(range.triangles.clone()) {
                    let triangle = &self.scene.garment.mesh.triangles[*face];
                    painter.add(egui::Shape::convex_polygon(
                        triangle
                            .vertices
                            .map(|v| point(self.scene.garment.mesh.uv[v]))
                            .to_vec(),
                        Color32::from_rgba_unmultiplied(255, 95, 45, 120),
                        Stroke::NONE,
                    ));
                }
                painter.extend(wire);
                smoke_targets.push((
                    format!("body_{}", panel.id),
                    point(DVec2::new(panel.pattern.width, panel.pattern.height) * 0.5),
                ));
                if selected && self.authoring.tool == Tool::Edit {
                    let handle = point(self.rotation_handle(i));
                    // Amber rather than gold: the board is white now, and gold on
                    // white does not carry enough contrast for a handle or label.
                    let handle_color = Color32::from_rgb(0xE0, 0x8A, 0x00);
                    painter.line_segment(
                        [point(DVec2::new(panel.pattern.width * 0.5, 0.)), handle],
                        Stroke::new(1.5, handle_color),
                    );
                    painter.circle_filled(handle, 8., Color32::WHITE);
                    painter.circle_stroke(handle, 8., Stroke::new(2., handle_color));
                    painter.text(
                        handle + Vec2::new(14., 0.),
                        egui::Align2::LEFT_CENTER,
                        format!("↻ {:.0}°", angle.rem_euclid(360.)),
                        egui::FontId::proportional(12.),
                        handle_color,
                    );
                    smoke_targets.push(("rotate_2d".into(), handle));
                }
                let Some(poly) = self.board_polygon(i) else {
                    continue;
                };
                for (k, (name, points)) in poly.paths().unwrap_or_default().iter().enumerate() {
                    let edge = BoundaryRef {
                        reversed: false,
                        panel: panel.id.clone(),
                        side: Side::Top,
                        edge: Some(name.clone()),
                        range: [0., 1.],
                    };
                    let end = self.authoring.ends.iter().position(|e| same_edge(e, &edge));
                    let active = self.seam_edge_highlighted(&edge);
                    let hover = self
                        .authoring
                        .hover_edge
                        .as_ref()
                        .is_some_and(|e| same_edge(e, &edge));
                    let sewn = self
                        .project
                        .template
                        .seams
                        .iter()
                        .find(|s| s.references().any(|r| same_edge(&edge, r)));
                    let color = if end.is_some() {
                        Color32::from_rgb(248, 117, 188)
                    } else if active || hover {
                        Color32::GOLD
                    } else if let Some(seam) = sewn {
                        super::seam_links::seam_color(&seam.id)
                    } else {
                        Color32::from_rgb(79, 155, 195)
                    };
                    {
                        painter.add(egui::Shape::line(
                            points.iter().map(|p| point(*p)).collect(),
                            Stroke::new(1., color.gamma_multiply(0.45)),
                        ));
                        if k == 0 {
                            let p = marvelous_cloth::garment::curves::arclength_point(points, 0.5);
                            smoke_targets.push((panel.id.clone(), point(p)));
                        }
                        if k == 1 {
                            let p = marvelous_cloth::garment::curves::arclength_point(points, 0.5);
                            smoke_targets.push((format!("next_edge_{}", panel.id), point(p)));
                        }
                    }
                    if selected
                        && self.authoring.tool == Tool::Edit
                        && active
                        && let Some([a, b]) = poly.curves.get(name)
                    {
                        for (j, (uv, control)) in [
                            (poly.points[k], *a),
                            (poly.points[(k + 1) % poly.points.len()], *b),
                        ]
                        .into_iter()
                        .enumerate()
                        {
                            painter.line_segment(
                                [point(uv), point(control)],
                                Stroke::new(1., Color32::LIGHT_BLUE),
                            );
                            painter.circle_filled(point(control), 5., Color32::LIGHT_BLUE);
                            smoke_targets.push((format!("handle_{j}"), point(control)));
                        }
                    }
                }
                // Manufacturing markings: the joined cutting line and the
                // sewing-line notch markers. They are drawn in every tool so the
                // drafter always sees both lines.
                if let Some(contour) = poly.cutting_contour().ok().flatten() {
                    for ring in std::iter::once(&contour.outer).chain(contour.holes.iter()) {
                        let mut pts: Vec<egui::Pos2> = ring.iter().map(|uv| point(*uv)).collect();
                        if let Some(first) = pts.first().copied() {
                            pts.push(first);
                        }
                        painter.add(egui::Shape::line(
                            pts,
                            Stroke::new(1.2, Color32::from_rgb(0xE6, 0x4A, 0x19)),
                        ));
                    }
                }
                for (name, notches) in &poly.notches {
                    for notch in notches {
                        if let Ok(marker) = poly.notch_marker(name, notch) {
                            painter.add(egui::Shape::line(
                                marker.iter().map(|uv| point(*uv)).collect(),
                                Stroke::new(1.2, Color32::from_rgb(0xC6, 0x28, 0x28)),
                            ));
                        }
                    }
                }
                if selected && self.authoring.tool == Tool::Edit {
                    for line in &poly.lines {
                        if self.authoring.edge.as_ref().is_some_and(|e| {
                            e.panel == panel.id && e.edge.as_ref() == Some(&line.id)
                        }) {
                            for (uv, tangent) in line.points.iter().zip(&line.tangents) {
                                painter.circle_filled(point(*uv), 4., Color32::GOLD);
                                let h = *uv + *tangent;
                                painter.line_segment(
                                    [point(*uv), point(h)],
                                    Stroke::new(1., Color32::LIGHT_BLUE),
                                );
                                painter.circle_stroke(
                                    point(h),
                                    6.,
                                    Stroke::new(1., Color32::LIGHT_BLUE),
                                );
                            }
                        }
                    }
                }
                if self.authoring.tool == Tool::Edit {
                    // Every point is visible and grabbable in Edit; the selected
                    // piece's points are emphasised and its selection ringed.
                    for (k, uv) in poly.points.iter().enumerate() {
                        let at = point(*uv);
                        if !selected
                            && !board.point_selected(&panel.id, k)
                            && !matches!(&board.drag, Some(Drag::Marquee { points: true, .. }))
                        {
                            painter.circle_filled(at, 2.5, Color32::from_gray(0x9A));
                            continue;
                        }
                        let focused = self
                            .authoring
                            .anchor
                            .as_ref()
                            .is_some_and(|(id, index)| id == &panel.id && *index == k);
                        painter.circle_filled(
                            at,
                            if focused { 6. } else { 4. },
                            if focused {
                                Color32::from_rgb(0x15, 0x65, 0xC0)
                            } else {
                                Color32::WHITE
                            },
                        );
                        painter.circle_stroke(at, 4., Stroke::new(1., Color32::BLACK));
                        let previously_selected = board.point_selected(&panel.id, k);
                        let point_selected = if let Some(Drag::Marquee {
                            start,
                            current,
                            path,
                            points: true,
                            add,
                            ..
                        }) = &board.drag
                        {
                            let region = if path.is_empty() {
                                super::selection::Region::Box(egui::Rect::from_two_pos(
                                    *start, *current,
                                ))
                            } else {
                                let mut points = path.clone();
                                points.push(*current);
                                super::selection::Region::Lasso(points)
                            };
                            region.contains(at) || (*add && previously_selected)
                        } else {
                            previously_selected
                        };
                        if point_selected {
                            painter.circle_filled(at, 6., Color32::from_rgb(24, 130, 239));
                            painter.circle_stroke(at, 6., Stroke::new(1.5, Color32::WHITE));
                            painter.circle_stroke(
                                at,
                                9.,
                                Stroke::new(1.5, Color32::from_rgb(24, 130, 239)),
                            );
                            painter.text(
                                at + Vec2::new(10., -10.),
                                egui::Align2::LEFT_BOTTOM,
                                format!("{}", k + 1),
                                egui::FontId::monospace(11.),
                                Color32::from_rgb(20, 90, 175),
                            );
                        }
                        // Smoke targets keep the historical key space: only the
                        // selected piece registers names, so nothing is shadowed.
                        if selected {
                            smoke_targets.push((format!("anchor_{k}"), at));
                        }
                    }
                }
                painter.text(
                    point(DVec2::new(panel.pattern.width * 0.5, -0.035)),
                    egui::Align2::CENTER_BOTTOM,
                    &panel.name,
                    egui::FontId::proportional(13.),
                    // Dark labels: the board is a white sheet now, so the old
                    // white-on-dark piece name would disappear.
                    if selected {
                        Color32::from_rgb(21, 101, 192)
                    } else {
                        Color32::from_rgb(0x33, 0x33, 0x33)
                    },
                );
                if selected {
                    paint_panel_dimensions(&painter, &point, panel);
                }
            }
        }
        if self.authoring.tool == Tool::Edit
            && let Some(draft) = &self.authoring.dart
            && let Some(i) = self
                .project
                .template
                .panels
                .iter()
                .position(|p| p.id == draft.panel())
            && let Ok(points) = draft.preview(&self.project.template)
        {
            let origin = self.board_origin(i);
            let angle = self.board_angle(i);
            let [left, apex, right] =
                points.map(|p| board.screen(rect, origin + authoring::rotate_2d(p, angle)));
            let color = Color32::from_rgb(190, 60, 130);
            if let Some(start) = draft.boundary_start(&self.project.template) {
                let start = board.screen(rect, origin + authoring::rotate_2d(start, angle));
                painter.circle_stroke(start, 5., Stroke::new(1.5, color));
                painter.arrow(
                    start,
                    ((left - start) + (right - start)) * 0.5,
                    Stroke::new(1., color),
                );
                painter.text(
                    start + Vec2::new(8., 8.),
                    egui::Align2::LEFT_TOP,
                    "Edge start · 0 mm",
                    egui::FontId::proportional(11.),
                    color,
                );
            }
            painter.add(egui::Shape::convex_polygon(
                vec![left, apex, right],
                color.gamma_multiply(0.15),
                Stroke::new(1., color),
            ));
            painter.line_segment([left, apex], Stroke::new(2.5, color));
            painter.line_segment([apex, right], Stroke::new(2.5, color));
            painter.circle_filled(apex, 4., color);
            painter.text(
                apex + Vec2::new(8., -8.),
                egui::Align2::LEFT_BOTTOM,
                "Dart preview",
                egui::FontId::proportional(12.),
                color,
            );
        }
        self.paint_seam_links(&painter, rect, false);
        let point = |uv| board.screen(rect, uv);
        for k in 0..self.authoring.draft.len().saturating_sub(1) {
            let p = [
                self.authoring.draft[k],
                self.authoring.draft[k] + self.authoring.tangents[k],
                self.authoring.draft[k + 1] - self.authoring.tangents[k + 1],
                self.authoring.draft[k + 1],
            ];
            if let Ok(samples) = marvelous_cloth::garment::curves::flatten(p, 0.00025) {
                painter.add(egui::Shape::line(
                    samples.into_iter().map(point).collect(),
                    Stroke::new(2., Color32::LIGHT_BLUE),
                ));
            }
        }
        for (k, p) in self.authoring.draft.iter().enumerate() {
            painter.circle_filled(point(*p), if k == 0 { 6. } else { 4. }, Color32::GOLD);
            if self.authoring.tangents[k].length_squared() > 1e-10 {
                let h = point(*p + self.authoring.tangents[k]);
                painter.line_segment([point(*p), h], Stroke::new(1., Color32::LIGHT_BLUE));
                painter.circle_filled(h, 4., Color32::LIGHT_BLUE);
            }
        }
        if matches!(self.authoring.tool, Tool::Ellipse | Tool::Sector)
            && self.authoring.draft.len() == 4
            && let Ok(poly) = marvelous_cloth::garment::shapes::primitive(
                if self.authoring.tool == Tool::Ellipse {
                    marvelous_cloth::garment::shapes::Primitive::Ellipse
                } else {
                    marvelous_cloth::garment::shapes::Primitive::Sector
                },
                self.authoring.draft[2] - self.authoring.draft[0],
                self.authoring.drafting.sweep,
                Default::default(),
            )
        {
            for k in 0..poly.edges.len() {
                if let Ok(points) = poly.edge_points(k) {
                    painter.add(egui::Shape::line(
                        points
                            .into_iter()
                            .map(|uv| point(uv + self.authoring.draft[0]))
                            .collect(),
                        Stroke::new(2., Color32::from_rgb(40, 150, 220)),
                    ));
                }
            }
        }
        if self.authoring.tool == Tool::Rectangle && self.authoring.draft.len() == 4 {
            painter.line_segment(
                [
                    point(self.authoring.draft[3]),
                    point(self.authoring.draft[0]),
                ],
                Stroke::new(2., Color32::LIGHT_BLUE),
            );
        }
        if let (Some(last), Some(pos)) = (self.authoring.draft.last(), response.hover_pos()) {
            painter.line_segment([point(*last), pos], Stroke::new(1., Color32::GRAY));
        }
        painter.text(
            rect.left_bottom() + Vec2::new(12., -12.),
            egui::Align2::LEFT_BOTTOM,
            format!("Grid {:.0} mm · {:.0} px/m", spacing * 1000., board.scale),
            egui::FontId::proportional(12.),
            // Dark enough to read on the white board.
            Color32::from_gray(0x55),
        );
        let targets = [
            ("point0", DVec2::new(0.15, 0.15)),
            ("point1", DVec2::new(0.45, 0.15)),
            ("point2", DVec2::new(0.45, 0.55)),
            ("point3", DVec2::new(0.15, 0.55)),
        ]
        .map(|(k, p)| (k, point(p)));
        for (key, p) in smoke_targets {
            self.smoke_target(&key, p);
        }
        for (key, p) in targets {
            self.smoke_target(key, p);
        }
        // Drawn last so the snap indicator, the live measurements and the insert
        // marker sit above the geometry.
        self.paint_drafting(&painter, rect, response);
        self.paint_sewing_ranges(ui, rect, false);
        self.paint_saved_measurements(ui, rect);
    }
    /// Drafting overlay: where the next click will land and why, the live
    /// measurements, and the insert/delete affordances. Presentation only; it
    /// never writes a material coordinate.
    fn paint_drafting(&self, painter: &egui::Painter, rect: egui::Rect, response: &egui::Response) {
        let board = &self.authoring.board;
        let font = egui::FontId::proportional(12.);
        let label = Color32::from_rgb(0x15, 0x65, 0xC0);
        let chip = |painter: &egui::Painter, at: egui::Pos2, text: &str| {
            painter.text(
                at + Vec2::new(10., -10.),
                egui::Align2::LEFT_BOTTOM,
                text,
                egui::FontId::proportional(12.),
                Color32::from_rgb(0x15, 0x65, 0xC0),
            );
        };
        let point = |uv: DVec2| board.screen(rect, uv);
        // Live lengths of the contour being drawn, plus its running perimeter.
        let draft = &self.authoring.draft;
        if draft.len() >= 2 {
            for k in 0..draft.len() - 1 {
                let curve = [
                    draft[k],
                    draft[k] + self.authoring.tangents[k],
                    draft[k + 1] - self.authoring.tangents[k + 1],
                    draft[k + 1],
                ];
                let length = marvelous_cloth::garment::curves::flatten(curve, 0.00025)
                    .map(|samples| polyline_length(&samples))
                    .unwrap_or_else(|_| draft[k].distance(draft[k + 1]));
                painter.text(
                    point((draft[k] + draft[k + 1]) * 0.5) + Vec2::new(0., -8.),
                    egui::Align2::CENTER_BOTTOM,
                    format!("{:.1} mm", length * 1000.),
                    font.clone(),
                    label,
                );
            }
            painter.text(
                rect.left_top() + Vec2::new(12., 12.),
                egui::Align2::LEFT_TOP,
                format!(
                    "Perimeter {:.1} mm · {} corners",
                    closed_perimeter(draft) * 1000.,
                    draft.len()
                ),
                font.clone(),
                Color32::from_gray(0x44),
            );
        }
        // The rubber segment to the snapped cursor: length and corner angle.
        if let (Some(last), Some(snap)) = (draft.last(), board.hover_snap) {
            let (a, b) = (point(*last), point(snap.point));
            painter.line_segment(
                [a, b],
                Stroke::new(1.5, Color32::from_rgb(0x66, 0x99, 0xCC)),
            );
            painter.text(
                a + (b - a) * 0.5 + Vec2::new(0., -8.),
                egui::Align2::CENTER_BOTTOM,
                format!("{:.1} mm", last.distance(snap.point) * 1000.),
                font.clone(),
                label,
            );
            if draft.len() >= 2
                && let Some(angle) = corner_angle(draft[draft.len() - 2], *last, snap.point)
            {
                painter.text(
                    a + Vec2::new(10., 10.),
                    egui::Align2::LEFT_TOP,
                    format!("{angle:.1}°"),
                    font.clone(),
                    Color32::from_gray(0x44),
                );
            }
        }
        // Moving points: live coordinates, the delta, and incident lengths.
        if let Some(Drag::Points { panel, origins, .. }) = &board.drag
            && let Some((first, origin)) = origins.first()
            && let Some((_, preview)) = &board.shape
            && let Some(i) = self
                .project
                .template
                .panels
                .iter()
                .position(|p| &p.id == panel)
        {
            let at = |uv: DVec2| {
                point(self.board_origin(i) + authoring::rotate_2d(uv, self.board_angle(i)))
            };
            let count = preview.points.len();
            for (k, _) in origins {
                for (a, b) in [((*k + count - 1) % count, *k), (*k, (*k + 1) % count)] {
                    let (pa, pb) = (at(preview.points[a]), at(preview.points[b]));
                    painter.text(
                        pa + (pb - pa) * 0.5 + Vec2::new(0., -8.),
                        egui::Align2::CENTER_BOTTOM,
                        format!(
                            "{:.1} mm",
                            preview.points[a].distance(preview.points[b]) * 1000.
                        ),
                        font.clone(),
                        label,
                    );
                }
            }
            if let Some(angle) = corner_angle(
                preview.points[(first + count - 1) % count],
                preview.points[*first],
                preview.points[(first + 1) % count],
            ) {
                painter.text(
                    at(preview.points[*first]) + Vec2::new(12., 12.),
                    egui::Align2::LEFT_TOP,
                    format!("{angle:.1}°"),
                    font.clone(),
                    Color32::from_gray(0x44),
                );
            }
            let now = preview.points[*first];
            let delta = now - *origin;
            chip(
                painter,
                at(now),
                &format!(
                    "X {:.1} · Y {:.1} mm · move {:+.1} · {:+.1}",
                    now.x * 1000.,
                    now.y * 1000.,
                    delta.x * 1000.,
                    delta.y * 1000.
                ),
            );
        }
        // Selected points, and the delete badge that removes the focused one.
        if board.point_count() > 0 {
            painter.text(
                rect.right_top() + Vec2::new(-12., 12.),
                egui::Align2::RIGHT_TOP,
                format!(
                    "{} points selected · arrows nudge 1 mm (Shift 10 mm)",
                    board.point_count()
                ),
                font.clone(),
                Color32::from_rgb(0xE0, 0x6A, 0x00),
            );
            if let Some(at) = self.delete_badge_screen(rect) {
                painter.circle_filled(at, 8., Color32::from_rgb(0xD3, 0x2F, 0x2F));
                painter.text(
                    at,
                    egui::Align2::CENTER_CENTER,
                    "×",
                    egui::FontId::proportional(14.),
                    Color32::WHITE,
                );
                painter.text(
                    at + Vec2::new(12., 0.),
                    egui::Align2::LEFT_CENTER,
                    "Delete point (Del)",
                    font.clone(),
                    Color32::from_rgb(0xD3, 0x2F, 0x2F),
                );
            }
        }
        // Insert-point affordance. The point itself is marked on the boundary, and
        // the clickable `+` badge sits just outside it, so a click on the boundary
        // still selects the boundary rather than silently splitting it.
        if board.drag.is_none()
            && let Some(hint) = &board.insert_hint
        {
            let on_edge = board.screen(rect, hint.point);
            let at = board.screen(rect, hint.badge);
            let color = Color32::from_rgb(0x00, 0x8A, 0x66);
            painter.line_segment([on_edge, at], Stroke::new(1., color));
            painter.circle_filled(on_edge, 3., color);
            painter.circle_stroke(at, 7., Stroke::new(2., color));
            painter.line_segment(
                [at + Vec2::new(-5., 0.), at + Vec2::new(5., 0.)],
                Stroke::new(2., color),
            );
            painter.line_segment(
                [at + Vec2::new(0., -5.), at + Vec2::new(0., 5.)],
                Stroke::new(2., color),
            );
            chip(
                painter,
                at,
                &format!(
                    "Insert point on {} · {:.1} mm",
                    hint.edge,
                    hint.at_m * 1000.
                ),
            );
        }
        // Persistent dimension on the selected boundary: true sampled length, and
        // the chord beside it whenever a curved boundary makes them differ.
        if let Some(edge) = &self.authoring.edge
            && let Some(name) = &edge.edge
            && let Some(i) = self
                .project
                .template
                .panels
                .iter()
                .position(|p| p.id == edge.panel)
            && let Some(poly) = self.board_polygon(i)
            && let Some(k) = poly.edges.iter().position(|n| n == name)
            && let Ok(points) = poly.edge_points(k)
            && !points.is_empty()
        {
            let true_m = polyline_length(&points);
            let chord = poly.points[k].distance(poly.points[(k + 1) % poly.points.len()]);
            let middle = marvelous_cloth::garment::curves::arclength_point(&points, 0.5);
            let centroid = poly.points.iter().fold(DVec2::ZERO, |sum, p| sum + *p)
                / poly.points.len().max(1) as f64;
            let outward = (middle - centroid).normalize_or_zero();
            let at =
                point(self.board_origin(i) + authoring::rotate_2d(middle, self.board_angle(i)))
                    + Vec2::new(outward.x as f32, outward.y as f32) * 26.;
            painter.text(
                at,
                egui::Align2::CENTER_CENTER,
                if (true_m - chord).abs() * 1000. > CHORD_DISPLAY_MM {
                    format!(
                        "{name} · {:.1} mm true · {:.1} mm chord",
                        true_m * 1000.,
                        chord * 1000.
                    )
                } else {
                    format!("{name} · {:.1} mm", true_m * 1000.)
                },
                font.clone(),
                label,
            );
        }
        // Snap indicator: the coordinate a click will use, named before the click.
        if let Some(snap) = board.hover_snap
            && let Some(cursor) = response.hover_pos()
        {
            let at = board.screen(rect, snap.point);
            let color = match snap.kind {
                SnapKind::Point => Color32::from_rgb(0x15, 0x65, 0xC0),
                SnapKind::Midpoint => Color32::from_rgb(0x00, 0x8A, 0x66),
                SnapKind::OnEdge => Color32::from_rgb(0xE0, 0x6A, 0x00),
                SnapKind::Angle => Color32::from_rgb(0x8E, 0x24, 0xAA),
                SnapKind::Grid => Color32::from_rgb(0x55, 0x55, 0x55),
                SnapKind::Free => Color32::from_rgb(0x99, 0x33, 0x33),
            };
            let stroke = Stroke::new(2., color);
            match snap.kind {
                SnapKind::Point => {
                    painter.circle_stroke(at, 7., stroke);
                }
                SnapKind::Midpoint => {
                    for (a, b) in [
                        (Vec2::new(0., -6.), Vec2::new(6., 0.)),
                        (Vec2::new(6., 0.), Vec2::new(0., 6.)),
                        (Vec2::new(0., 6.), Vec2::new(-6., 0.)),
                        (Vec2::new(-6., 0.), Vec2::new(0., -6.)),
                    ] {
                        painter.line_segment([at + a, at + b], stroke);
                    }
                }
                SnapKind::OnEdge => {
                    for (a, b) in [
                        (Vec2::new(-5., -5.), Vec2::new(5., -5.)),
                        (Vec2::new(5., -5.), Vec2::new(5., 5.)),
                        (Vec2::new(5., 5.), Vec2::new(-5., 5.)),
                        (Vec2::new(-5., 5.), Vec2::new(-5., -5.)),
                    ] {
                        painter.line_segment([at + a, at + b], stroke);
                    }
                }
                SnapKind::Angle => {
                    painter
                        .line_segment([at + Vec2::new(-7., -7.), at + Vec2::new(7., 7.)], stroke);
                    painter
                        .line_segment([at + Vec2::new(-7., 7.), at + Vec2::new(7., -7.)], stroke);
                }
                SnapKind::Grid | SnapKind::Free => {
                    painter.line_segment([at + Vec2::new(-6., 0.), at + Vec2::new(6., 0.)], stroke);
                    painter.line_segment([at + Vec2::new(0., -6.), at + Vec2::new(0., 6.)], stroke);
                }
            }
            chip(painter, cursor, &snap.label(board.snap_grid_mm()));
        }
    }
    /// Screen position of the delete badge for the focused point, when one is
    /// selected. Used by both the painter and the click handler.
    fn delete_badge_screen(&self, rect: egui::Rect) -> Option<egui::Pos2> {
        let (panel, k) = self.authoring.anchor.clone()?;
        if self.authoring.board.selection_panel.as_ref() != Some(&panel) {
            return None;
        }
        let i = self
            .project
            .template
            .panels
            .iter()
            .position(|p| p.id == panel)?;
        let poly = self.board_polygon(i)?;
        if k >= poly.points.len() {
            return None;
        }
        // No badge for a point the command layer would refuse to remove.
        self.delete_blocked(&panel, k)?;
        let at = self.authoring.board.screen(
            rect,
            self.board_origin(i) + authoring::rotate_2d(poly.points[k], self.board_angle(i)),
        );
        Some(at + Vec2::new(14., -14.))
    }
    /// The point whose delete badge is under the pointer, if any.
    fn delete_badge_at(&self, rect: egui::Rect, pos: egui::Pos2) -> Option<(String, usize)> {
        let badge = self.delete_badge_screen(rect)?;
        if badge.distance(pos) > 9. {
            return None;
        }
        self.authoring.anchor.clone()
    }
}

/// Board navigation is presentation-only math: these tests need no window, and
/// they pin the invariant that rotating or zooming the board never changes a
/// material coordinate.
#[cfg(test)]
mod tests {
    #[test]
    fn freehand_gesture_uses_all_samples_and_release_outside_canvas() {
        let mut board = Board::default();
        board.freehand.enabled = true;
        board.set_view_rotation_degrees(32.);
        let rect = canvas(600., 500.);
        let start = egui::pos2(100., 100.);
        let end = egui::pos2(610., 400.);
        let button = |pos, pressed| egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        assert!(!board.capture_freehand(rect, vec![button(start, true)], true));
        assert!(board.capture_freehand(
            rect,
            vec![
                egui::Event::PointerMoved(egui::pos2(150., 200.)),
                egui::Event::PointerMoved(egui::pos2(200., 300.)),
                button(end, false),
            ],
            false
        ));
        assert_eq!(board.freehand.samples.len(), 4);
        assert_eq!(board.freehand.samples[0], board.world(rect, start));
        assert_eq!(board.freehand.samples[3], board.world(rect, end));
        assert!(!board.freehand.drawing);
        board.clear_preview();
        assert!(board.freehand.samples.is_empty());
        assert!(!board.freehand.enabled);
    }

    #[test]
    fn freehand_overflow_and_focus_loss_cannot_commit_a_partial_stroke() {
        let mut board = Board::default();
        board.freehand.enabled = true;
        for i in 0..4097 {
            board.freehand.push(DVec2::new(i as f64, 0.));
        }
        assert!(board.freehand.overflow);
        assert!(board.freehand.error.is_some());
        assert!(board.freehand.preview.is_none());
        assert_eq!(board.freehand.samples.len(), 4096);
        assert!(!board.capture_freehand(
            canvas(600., 500.),
            vec![egui::Event::WindowFocused(false)],
            false
        ));
        assert!(board.freehand.samples.is_empty());
    }
    use super::*;

    fn canvas(width: f32, height: f32) -> egui::Rect {
        egui::Rect::from_min_size(egui::Pos2::ZERO, Vec2::new(width, height))
    }

    fn close(actual: f64, expected: f64, tolerance: f64, what: &str) {
        assert!(
            (actual - expected).abs() <= tolerance,
            "{what}: {actual} vs {expected}"
        );
    }

    /// Screen position obtained by rotating `p` about the canvas centre, the way
    /// the view rotation moves the drawn board.
    fn rotate_screen(p: egui::Pos2, centre: egui::Pos2, degrees: f64) -> egui::Pos2 {
        let (sin, cos) = degrees.to_radians().sin_cos();
        let d = Vec2::new(p.x - centre.x, p.y - centre.y);
        centre
            + Vec2::new(
                (cos * f64::from(d.x) - sin * f64::from(d.y)) as f32,
                (sin * f64::from(d.x) + cos * f64::from(d.y)) as f32,
            )
    }

    #[test]
    fn material_round_trip_survives_view_rotation_and_zoom() {
        let rect = canvas(900., 700.);
        for degrees in [0., 30., 90., 180., -137.5] {
            let mut board = Board::default();
            board.set_view_rotation_degrees(degrees);
            board.scale = 437.;
            for point in [DVec2::ZERO, DVec2::new(0.25, -0.4), DVec2::new(-1.2, 3.5)] {
                let screen = board.screen(rect, point);
                let back = board.world(rect, screen);
                assert!(
                    (back - point).length() < 1e-4,
                    "{degrees}: {point:?} -> {screen:?} -> {back:?}"
                );
            }
        }
    }

    #[test]
    fn view_rotation_moves_the_drawing_but_not_the_material_point() {
        let rect = canvas(800., 600.);
        let mut board = Board {
            center: DVec2::new(0.3, -0.2),
            scale: 250.,
            ..Default::default()
        };
        let pixel = egui::pos2(690., 130.);
        let material = board.world(rect, pixel);
        for degrees in [15., 90., 180., 270., -37.5] {
            board.set_view_rotation_degrees(degrees);
            let drawn = board.screen(rect, material);
            let expected = rotate_screen(pixel, rect.center(), degrees);
            assert!(
                (drawn - expected).length() < 0.01,
                "{degrees}: drawn {drawn:?} vs {expected:?}"
            );
            // Reading the rotated pixel back returns the identical material point.
            assert!(
                (board.world(rect, drawn) - material).length() < 1e-6,
                "{degrees}"
            );
        }
    }

    #[test]
    fn zoom_keeps_the_material_point_under_the_cursor() {
        let rect = canvas(1000., 640.);
        let cursor = egui::pos2(760., 180.);
        for degrees in [0., 42.] {
            let mut board = Board::default();
            board.set_view_rotation_degrees(degrees);
            let anchor = board.world(rect, cursor);
            board.zoom_at(rect, cursor, 2.5);
            close(board.scale as f64, 750., 1e-3, "scale");
            assert!(
                (board.world(rect, cursor) - anchor).length() < 1e-9,
                "{degrees}: the cursor anchor moved"
            );
            board.zoom_at(rect, cursor, 1. / 2.5);
            assert!(
                (board.world(rect, cursor) - anchor).length() < 1e-6,
                "{degrees}: zoom out did not return"
            );
        }
    }

    #[test]
    fn zoom_clamps_without_moving_the_cursor_anchor() {
        let rect = canvas(800., 600.);
        let cursor = egui::pos2(120., 520.);
        let mut board = Board::default();
        let anchor = board.world(rect, cursor);
        board.zoom_at(rect, cursor, 1e9);
        close(
            f64::from(board.scale),
            f64::from(MAX_SCALE),
            1e-3,
            "zoom in clamp",
        );
        assert!((board.world(rect, cursor) - anchor).length() < 1e-6);
        board.zoom_at(rect, cursor, 1e-9);
        close(
            f64::from(board.scale),
            f64::from(MIN_SCALE),
            1e-3,
            "zoom out clamp",
        );
        // A non-positive factor is not a zoom.
        board.zoom_at(rect, cursor, -1.);
        close(
            f64::from(board.scale),
            f64::from(MIN_SCALE),
            1e-3,
            "unchanged",
        );
    }

    #[test]
    fn pan_follows_the_pointer_in_view_space() {
        let rect = canvas(900., 600.);
        let delta = Vec2::new(24., -37.);
        for degrees in [0., 90., -31.5] {
            let mut board = Board::default();
            board.set_view_rotation_degrees(degrees);
            board.scale = 500.;
            let before = board.world(rect, egui::pos2(450., 300.));
            board.pan_by(delta);
            let after = board.world(rect, egui::pos2(450. + delta.x, 300. + delta.y));
            assert!(
                (after - before).length() < 1e-6,
                "{degrees}: the material point under the pointer did not follow it"
            );
        }
    }

    #[test]
    fn fit_centres_and_fits_the_corners_in_any_rotation() {
        let rect = canvas(1200., 500.);
        let corners = [
            DVec2::new(0., 0.),
            DVec2::new(0.4, 0.),
            DVec2::new(0.4, 0.6),
            DVec2::new(0., 0.6),
        ];
        for degrees in [0., 90., 45., 180.] {
            let mut board = Board::default();
            board.set_view_rotation_degrees(degrees);
            board.fit_corners(rect, &corners);
            assert!(board.fitted, "{degrees}");
            for corner in corners {
                let p = board.screen(rect, corner);
                assert!(rect.contains(p), "{degrees}: {p:?} outside {rect:?}");
            }
        }
    }

    #[test]
    fn fit_is_unaffected_by_translating_the_corner_set() {
        let rect = canvas(800., 700.);
        let base = [DVec2::ZERO, DVec2::new(0.3, 0.4), DVec2::new(0.3, 0.)];
        let mut a = Board::default();
        a.fit_corners(rect, &base);
        let shifted: Vec<_> = base.iter().map(|p| *p + DVec2::new(2.5, -1.25)).collect();
        let mut b = Board::default();
        b.fit_corners(rect, &shifted);
        close(b.scale as f64, a.scale as f64, 1e-6, "scale");
        // The same relative corner sits at the same pixel in both boards.
        let pa = a.screen(rect, base[1]);
        let pb = b.screen(rect, shifted[1]);
        assert!((pa - pb).length() < 1e-3, "{pa:?} vs {pb:?}");
    }

    #[test]
    fn reset_view_clears_rotation_and_requests_a_fit() {
        let mut board = Board::default();
        board.set_view_rotation_degrees(123.);
        board.fit_corners(
            canvas(800., 600.),
            &[DVec2::ZERO, DVec2::new(0.5, 0.5), DVec2::new(1., 0.3)],
        );
        assert!(board.fitted);
        board.reset_view();
        close(board.view_rotation_degrees(), 0., 1e-12, "rotation");
        assert!(!board.fitted, "reset asks for a refit with the rectangle");
        board.request_fit();
        assert!(!board.fitted);
    }

    #[test]
    fn magnet_step_comes_from_the_preference() {
        let mut board = Board::default();
        assert_eq!(board.snap_grid_mm(), 10.);
        // The default reproduces the historical 10 mm grid exactly.
        assert_eq!(
            board.snapped(DVec2::new(0.155, -0.194)),
            DVec2::new(0.16, -0.19)
        );
        board.snap_mm = 2.5;
        assert_eq!(board.snap_grid_mm(), 2.5);
        assert_eq!(
            board.snapped(DVec2::new(0.155, -0.194)),
            DVec2::new(0.155, -0.195)
        );
        board.snap = false;
        assert_eq!(
            board.snapped(DVec2::new(0.155, -0.194)),
            DVec2::new(0.155, -0.194)
        );
        board.snap = true;
        board.snap_mm = f64::NAN;
        assert_eq!(board.snap_grid_mm(), 10.);
        board.snap_mm = 1e9;
        assert_eq!(board.snap_grid_mm(), 100.);
        board.snap_mm = -5.;
        assert_eq!(board.snap_grid_mm(), 0.1);
    }

    #[test]
    fn rotation_wraps_to_the_short_range() {
        let mut board = Board::default();
        board.rotate_view_by(90.);
        close(board.view_rotation_degrees(), 90., 1e-9, "90");
        board.rotate_view_by(90.);
        close(board.view_rotation_degrees(), 180., 1e-9, "180");
        board.rotate_view_by(90.);
        close(board.view_rotation_degrees(), -90., 1e-9, "-90");
        board.rotate_view_by(-90.);
        close(board.view_rotation_degrees(), 180., 1e-9, "180 again");
        board.set_view_rotation_degrees(0.);
        close(board.view_rotation_degrees(), 0., 1e-12, "zero");
        board.set_view_rotation_degrees(720.);
        close(board.view_rotation_degrees(), 0., 1e-9, "720 wraps to 0");
    }

    fn geometry(points: &[DVec2], segments: &[[DVec2; 2]]) -> SnapGeometry {
        SnapGeometry {
            points: points.to_vec(),
            segments: segments.to_vec(),
        }
    }

    #[test]
    fn snap_priorities_prefer_real_geometry_over_the_grid() {
        let rect = canvas(800., 600.);
        let board = Board::default();
        let anchor = DVec2::new(0.1, 0.1);
        let segment = [DVec2::new(0.2, 0.2), DVec2::new(0.4, 0.2)];
        let geometry = geometry(&[anchor], &[segment]);

        let on_point = board.screen(rect, anchor);
        let snap = board.resolve_snap(rect, on_point, &geometry, None, false, false);
        assert_eq!(snap.kind, SnapKind::Point);
        close((snap.point - anchor).length(), 0., 1e-12, "point");

        // Three pixels away still captures the point rather than the grid.
        let near = on_point + Vec2::new(3., 0.);
        assert_eq!(
            board
                .resolve_snap(rect, near, &geometry, None, false, false)
                .kind,
            SnapKind::Point
        );

        // A segment midpoint outranks the on-edge candidate.
        let middle = board.screen(rect, DVec2::new(0.3, 0.2));
        assert_eq!(
            board
                .resolve_snap(rect, middle, &geometry, None, false, false)
                .kind,
            SnapKind::Midpoint
        );

        // Elsewhere on the segment: the perpendicular foot, with its arclength.
        let on_edge = board.screen(rect, DVec2::new(0.35, 0.2));
        let snap = board.resolve_snap(rect, on_edge, &geometry, None, false, false);
        assert_eq!(snap.kind, SnapKind::OnEdge);
        close(snap.along_m, 0.15, 1e-6, "along the boundary");

        // Far from everything: the grid, named with its step.
        let far = board.screen(rect, DVec2::new(0.32, 0.9));
        let snap = board.resolve_snap(rect, far, &geometry, None, false, false);
        assert_eq!(snap.kind, SnapKind::Grid);
        assert_eq!(snap.label(10.), "Grid 10.0 mm");
    }

    #[test]
    fn the_capture_radius_is_the_same_at_every_zoom() {
        let rect = canvas(900., 700.);
        let anchor = DVec2::new(0.5, 0.4);
        let geometry = geometry(&[anchor], &[]);
        for scale in [60., 300., 2400.] {
            let board = Board {
                scale,
                ..Default::default()
            };
            let at = board.screen(rect, anchor);
            assert_eq!(
                board
                    .resolve_snap(rect, at + Vec2::new(8., 0.), &geometry, None, false, false)
                    .kind,
                SnapKind::Point,
                "scale {scale}"
            );
            assert_ne!(
                board
                    .resolve_snap(rect, at + Vec2::new(40., 0.), &geometry, None, false, false)
                    .kind,
                SnapKind::Point,
                "scale {scale}"
            );
        }
    }

    #[test]
    fn the_suspend_modifier_places_the_raw_pointer_position() {
        let rect = canvas(800., 600.);
        let board = Board::default();
        let anchor = DVec2::new(0.1, 0.1);
        let geometry = geometry(&[anchor], &[]);
        let at = board.screen(rect, anchor);
        let snap = board.resolve_snap(rect, at, &geometry, None, false, true);
        assert_eq!(snap.kind, SnapKind::Free);
        assert!(snap.suspended);
        assert!((snap.point - board.world(rect, at)).length() < 1e-12);
        assert_eq!(snap.label(10.), "Free · snap off");
    }

    #[test]
    fn the_magnet_checkbox_only_controls_the_grid() {
        let rect = canvas(800., 600.);
        let board = Board {
            snap: false,
            ..Default::default()
        };
        let coarse = DVec2::new(0.313, 0.427);
        let snap = board.resolve_snap(
            rect,
            board.screen(rect, coarse),
            &SnapGeometry::default(),
            None,
            false,
            false,
        );
        assert_eq!(snap.kind, SnapKind::Free);
        // The pointer is resolved through f32 screen pixels, so the material
        // round trip carries pixel-quantisation error, not a grid offset.
        close((snap.point - coarse).length(), 0., 1e-6, "raw position");
        // Geometric snaps stay available with the grid magnet switched off.
        let geometry = geometry(&[DVec2::new(0.4, 0.4)], &[]);
        let on_point = board.screen(rect, DVec2::new(0.4, 0.4));
        assert_eq!(
            board
                .resolve_snap(rect, on_point, &geometry, None, false, false)
                .kind,
            SnapKind::Point
        );
    }

    #[test]
    fn the_angle_lock_lands_on_exact_increments() {
        let rect = canvas(900., 700.);
        let board = Board::default();
        let reference = DVec2::new(0.4, 0.4);
        let from = board.screen(rect, reference);
        for offset in [
            Vec2::new(60., 12.),
            Vec2::new(20., 80.),
            Vec2::new(-70., 33.),
        ] {
            let pointer = from + offset;
            let snap = board.resolve_snap(
                rect,
                pointer,
                &SnapGeometry::default(),
                Some(reference),
                true,
                false,
            );
            assert_eq!(snap.kind, SnapKind::Angle);
            let direction = (snap.point - reference).normalize();
            let degrees = direction.y.atan2(direction.x).to_degrees();
            let remainder = (degrees / ANGLE_STEP_DEGREES).round() * ANGLE_STEP_DEGREES - degrees;
            assert!(remainder.abs() < 1e-9, "{degrees} is not a step");
            // The length still follows the pointer, so the user keeps control.
            close(
                (snap.point - reference).length(),
                board.world(rect, pointer).distance(reference),
                1e-9,
                "radius",
            );
        }
        // Without the modifier the angle is free.
        let pointer = from + Vec2::new(60., 12.);
        assert_ne!(
            board
                .resolve_snap(
                    rect,
                    pointer,
                    &SnapGeometry::default(),
                    Some(reference),
                    false,
                    false
                )
                .kind,
            SnapKind::Angle
        );
    }

    #[test]
    fn measurement_helpers_report_true_lengths_and_angles() {
        let square = [
            DVec2::ZERO,
            DVec2::new(0.4, 0.),
            DVec2::new(0.4, 0.6),
            DVec2::new(0., 0.6),
        ];
        close(polyline_length(&square), 1.4, 1e-12, "open polyline");
        close(closed_perimeter(&square), 2.0, 1e-12, "perimeter");
        close(
            corner_angle(square[3], square[0], square[1]).unwrap(),
            90.,
            1e-9,
            "right angle",
        );
        close(
            corner_angle(DVec2::new(-1., 0.), DVec2::ZERO, DVec2::X).unwrap(),
            180.,
            1e-9,
            "straight corner",
        );
        // Degenerate corners report unknown rather than a fabricated number.
        assert!(corner_angle(DVec2::ZERO, DVec2::ZERO, DVec2::X).is_none());
        assert_eq!(closed_perimeter(&[DVec2::ZERO]), 0.);
        assert_eq!(polyline_length(&[]), 0.);
    }

    #[test]
    fn clearing_a_preview_drops_the_point_selection() {
        let mut board = Board {
            selection: vec![1, 3],
            selection_panel: Some("panel_1".into()),
            point_groups: [("panel_2".into(), vec![2])].into_iter().collect(),
            ..Default::default()
        };
        board.clear_preview();
        assert!(board.selection.is_empty());
        assert!(board.selection_panel.is_none());
        assert!(board.point_groups.is_empty());
        assert_eq!(board.point_count(), 0);
    }

    #[test]
    fn dragging_on_a_rotated_translated_panel_preserves_the_grip_offset() {
        let mut board = Board::default();
        board.set_view_rotation_degrees(37.);
        let rect = canvas(900., 700.);
        let origin = DVec2::new(0.8, -0.4);
        let local = DVec2::new(0.2, 0.1);
        let angle = 63.;
        let anchor = origin + authoring::rotate_2d(local, angle);
        let press = anchor + DVec2::new(0.003, -0.004);
        let pixel_delta = egui::vec2(25., -17.);
        let cursor = board.screen(rect, press) + pixel_delta;
        let moved = board.anchor_cursor(rect, origin, angle, local, press, cursor);
        assert!(moved.distance(board.screen(rect, anchor) + pixel_delta) < 0.001);
    }

    #[test]
    fn arrow_nudges_follow_screen_axes_after_both_rotations() {
        let mut board = Board::default();
        board.set_view_rotation_degrees(90.);
        let rect = canvas(900., 700.);
        for angle in [0., 37., 90.] {
            let delta = board.nudge_delta(DVec2::X, angle, 10.) / 1000.;
            let projected = board.screen(rect, authoring::rotate_2d(delta, angle))
                - board.screen(rect, DVec2::ZERO);
            assert!((projected.x - board.scale * 0.01).abs() < 0.001);
            assert!(projected.y.abs() < 0.001);
        }
    }

    #[test]
    fn shift_click_selection_toggles_and_retains_explicit_panel_owners() {
        let mut board = Board::default();
        board.select_point("a".into(), 1, false);
        board.select_point("a".into(), 3, true);
        assert_eq!(board.selection, vec![1, 3]);
        board.select_point("a".into(), 1, true);
        assert_eq!(board.selection, vec![3]);
        board.select_point("b".into(), 0, true);
        assert_eq!(board.selection, vec![0]);
        assert_eq!(board.point_count(), 2);
        assert!(board.point_selected("a", 3));
    }

    #[test]
    fn freehand_activation_resets_the_old_draft_and_replace_mode() {
        let mut authoring = super::super::authoring_ui::AuthoringUi {
            replace: true,
            ..Default::default()
        };
        authoring.draft.push(DVec2::new(0.1, 0.2));
        authoring.tangents.push(DVec2::X);
        authoring.board.freehand.enabled = true;
        authoring.board.freehand.samples.push(DVec2::new(0.3, 0.4));
        enter_freehand_draft(&mut authoring);
        assert!(authoring.board.freehand.enabled);
        assert!(authoring.board.freehand.samples.is_empty());
        assert!(!authoring.replace);
        assert!(authoring.draft.is_empty());
        assert!(authoring.tangents.is_empty());
    }
}
