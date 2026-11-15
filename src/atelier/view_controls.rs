//! View bars for the 3D garment window and the 2D pattern board.
//!
//! Presentation only. The 3D bar moves the orbit camera, frames the scene and
//! switches the projection; the 2D bar moves the board's view transform. Neither
//! writes material coordinates, rest geometry, grain, masses or cache signatures,
//! and no control here commits an authoring command.
use super::{authoring_ui::Tool, board::Board, *};
use crate::render::{Camera, PresetView};
use glam::{DVec3, Vec3};

/// World-space bounds the 3D bar can frame, in metres.
#[derive(Clone, Copy, Default)]
pub(super) struct ViewBounds {
    /// The garment plus the mannequin.
    pub all: Option<(Vec3, Vec3)>,
    /// The selected panel, when it is part of the compiled garment.
    pub selection: Option<(Vec3, Vec3)>,
}

/// Bounds of a point set, or `None` when it is empty or entirely non-finite.
fn bounds_of<'a>(points: impl IntoIterator<Item = &'a DVec3>) -> Option<(Vec3, Vec3)> {
    let mut lo = Vec3::splat(f32::INFINITY);
    let mut hi = Vec3::splat(f32::NEG_INFINITY);
    let mut seen = false;
    for p in points {
        let p = p.as_vec3();
        if !p.is_finite() {
            continue;
        }
        lo = lo.min(p);
        hi = hi.max(p);
        seen = true;
    }
    seen.then_some((lo, hi))
}

/// Centre and bounding-sphere radius of a box.
fn center_radius(bounds: Option<(Vec3, Vec3)>) -> Option<(Vec3, f32)> {
    bounds.map(|(lo, hi)| ((lo + hi) * 0.5, ((hi - lo) * 0.5).length().max(1e-3)))
}

/// On-screen binding hint for the 3D viewport, matching the active tool. Every
/// arm ends with the same navigation bindings, because the 3D camera responds to
/// them in every tool.
pub(super) fn hint_3d(tool: Tool) -> &'static str {
    match tool {
        Tool::Inspect => {
            "Paint visible faces · Shift: erase · right drag: orbit · middle drag: pan · wheel: zoom"
        }
        Tool::Place => {
            "G: move · R: rotate · X/Y/Z rings · Shift: 15° · Esc: cancel · right drag: orbit · middle drag: pan · wheel: zoom toward the cursor"
        }
        Tool::Sew => {
            "Click boundaries to sew · right drag: orbit · middle drag: pan · wheel: zoom toward the cursor"
        }
        Tool::Grab => {
            "Left: grab the fabric · right drag: orbit · middle drag: pan · wheel: zoom toward the cursor"
        }
        Tool::Edit
        | Tool::Draw
        | Tool::Rectangle
        | Tool::Ellipse
        | Tool::Sector
        | Tool::Measure
        | Tool::InternalLine => {
            "Select a boundary · right drag: orbit · middle drag: pan · wheel: zoom toward the cursor"
        }
    }
}

/// On-screen binding hint for the 2D board navigation.
pub(super) const HINT_2D_VIEW: &str = "Alt + left drag: rotate · middle or right drag: pan · wheel: zoom toward the cursor · [ and ]: rotate 15° · Home: reset view";

impl Atelier {
    /// Framing bounds for the 3D view bar.
    pub(super) fn view_bounds(&self) -> ViewBounds {
        let garment = bounds_of(self.scene.state.x.iter());
        let mannequin = bounds_of(self.scene.collider.surface.vertices.iter());
        let all = match (garment, mannequin) {
            (Some((a, b)), Some((c, d))) => Some((a.min(c), b.max(d))),
            (garment, mannequin) => garment.or(mannequin),
        };
        let selection = self.authoring.selected.as_ref().and_then(|id| {
            let index = self
                .project
                .template
                .panels
                .iter()
                .position(|p| &p.id == id)?;
            let range = self.scene.garment.panels.get(index)?;
            bounds_of(self.scene.state.x[range.vertices.clone()].iter())
        });
        ViewBounds { all, selection }
    }
    /// Draw the 3D view bar for this workspace. Call it once per frame, above
    /// the 3D canvas; the frame request is applied when the canvas rectangle is
    /// known.
    pub(super) fn show_view_bar(&mut self, ui: &mut egui::Ui) {
        let bounds = self.view_bounds();
        view_bar(ui, &mut self.camera, bounds);
    }
}

/// Outline of a cube face with outward normal `n`, as four corners in order.
fn face_quad(n: Vec3) -> [Vec3; 4] {
    let (a, b) = if n.x != 0. {
        (Vec3::Y, Vec3::Z)
    } else if n.y != 0. {
        (Vec3::X, Vec3::Z)
    } else {
        (Vec3::X, Vec3::Y)
    };
    [n + a + b, n - a + b, n - a - b, n + a - b]
}

/// Whether `p` lies inside a convex quadrilateral given in order.
fn inside_quad(p: egui::Pos2, q: &[egui::Pos2; 4]) -> bool {
    let mut sign = 0.0_f32;
    for i in 0..4 {
        let (a, b) = (q[i], q[(i + 1) % 4]);
        let cross = (b - a).x * (p - a).y - (b - a).y * (p - a).x;
        if cross.abs() < 1e-6 {
            continue;
        }
        if sign == 0. {
            sign = cross.signum();
        } else if sign != cross.signum() {
            return false;
        }
    }
    true
}

/// View cube: click a visible face for that preset view, or a corner for Iso.
/// The cube turns with the camera, so it always shows what the view is looking at.
fn view_cube(ui: &mut egui::Ui, camera: &mut Camera) {
    const SIZE: f32 = 76.;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(SIZE, SIZE), egui::Sense::click());
    let painter = ui.painter_at(rect);
    let centre = rect.center();
    let scale = SIZE * 0.3;
    let (right, up, dir) = (camera.right(), camera.up(), camera.direction());
    let project = |v: Vec3| {
        egui::pos2(
            centre.x + v.dot(right) * scale,
            centre.y - v.dot(up) * scale,
        )
    };
    let hover = response.hover_pos();
    let mut hovered: Option<PresetView> = None;
    let mut faces = Vec::new();
    for preset in PresetView::ALL {
        if preset == PresetView::Isometric {
            continue;
        }
        let n = preset.direction();
        if n.dot(dir) <= 0. {
            continue;
        }
        let quad = face_quad(n).map(project);
        if hover.is_some_and(|p| inside_quad(p, &quad)) {
            hovered = Some(preset);
        }
        faces.push((preset, quad));
    }
    // Visible corners: the three faces meeting there are all in view.
    let mut corners = Vec::new();
    for sx in [-1., 1.] {
        for sy in [-1., 1.] {
            for sz in [-1., 1.] {
                let c = Vec3::new(sx, sy, sz);
                if c.dot(dir) > 0. {
                    corners.push(project(c));
                }
            }
        }
    }
    for corner in &corners {
        if hover.is_some_and(|p| p.distance(*corner) < 6.) {
            hovered = Some(PresetView::Isometric);
        }
    }
    let fill = egui::Color32::from_gray(238);
    let lit = egui::Color32::from_rgb(0xC9, 0xDD, 0xF5);
    let stroke = egui::Stroke::new(1., egui::Color32::from_gray(120));
    for (preset, quad) in &faces {
        let colour = if hovered == Some(*preset) { lit } else { fill };
        painter.add(egui::Shape::convex_polygon(quad.to_vec(), colour, stroke));
        painter.text(
            quad.iter().fold(egui::Pos2::ZERO, |acc, p| acc + p.to_vec2() / 4.),
            egui::Align2::CENTER_CENTER,
            preset.label(),
            egui::FontId::proportional(11.),
            egui::Color32::from_gray(40),
        );
    }
    for corner in &corners {
        let colour = if hovered == Some(PresetView::Isometric) {
            lit
        } else {
            egui::Color32::from_gray(120)
        };
        painter.circle_filled(*corner, 3.5, colour);
    }
    if response.clicked()
        && let Some(preset) = hovered
    {
        camera.apply_preset(preset);
    }
    response.on_hover_text("Click a face for that view, a corner for Iso");
}

/// 3D view bar: view cube with projection toggle, preset directions, framing and
/// restore.
pub(super) fn view_bar(ui: &mut egui::Ui, camera: &mut Camera, bounds: ViewBounds) {
    ui.horizontal_wrapped(|ui| {
        ui.vertical(|ui| {
            view_cube(ui, camera);
            let projection = if camera.orthographic {
                "Orthographic"
            } else {
                "Perspective"
            };
            if ui
                .small_button(projection)
                .on_hover_text("Switch between the matched perspective and orthographic projections")
                .clicked()
            {
                camera.toggle_projection();
            }
        });
        ui.separator();
        ui.label(egui::RichText::new("View").small());
        for preset in PresetView::ALL {
            if ui
                .selectable_label(false, preset.label())
                .on_hover_text(format!(
                    "Look at the model from the {} direction",
                    preset.label()
                ))
                .clicked()
            {
                camera.apply_preset(preset);
            }
        }
        ui.separator();
        let all = center_radius(bounds.all);
        if ui
            .add_enabled(all.is_some(), egui::Button::new("Frame all"))
            .on_hover_text("Frame the garment and the mannequin")
            .clicked()
            && let Some((center, radius)) = all
        {
            camera.request_frame(center, radius);
        }
        let selection = center_radius(bounds.selection);
        if ui
            .add_enabled(selection.is_some(), egui::Button::new("Frame selection"))
            .on_hover_text("Frame the selected piece")
            .clicked()
            && let Some((center, radius)) = selection
        {
            camera.request_frame(center, radius);
        }
        ui.separator();
        if ui
            .add_enabled(camera.has_saved_pose(), egui::Button::new("Restore"))
            .on_hover_text("Swap back to the view from before the last preset or frame")
            .clicked()
        {
            camera.restore_pose();
        }
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.small(format!("distance {:.2} m", camera.distance));
        });
    });
}

/// 2D board bar: view rotation, fit and reset. Presentation only.
pub(super) fn board_bar(ui: &mut egui::Ui, board: &mut Board) {
    ui.horizontal_wrapped(|ui| {
        ui.label(egui::RichText::new("Board view").small());
        if ui
            .button("Rotate -90°")
            .on_hover_text("Turn the board a quarter turn anticlockwise")
            .clicked()
        {
            board.rotate_view_by(-90.);
        }
        if ui
            .button("Rotate +90°")
            .on_hover_text("Turn the board a quarter turn clockwise")
            .clicked()
        {
            board.rotate_view_by(90.);
        }
        let mut degrees = board.view_rotation_degrees();
        if ui
            .add(
                egui::DragValue::new(&mut degrees)
                    .speed(1.)
                    .range(-180.0..=180.0)
                    .suffix("°"),
            )
            .on_hover_text("Board view angle in degrees")
            .changed()
        {
            board.set_view_rotation_degrees(degrees);
        }
        ui.separator();
        if ui
            .button("Fit all")
            .on_hover_text("Fit every piece in the window")
            .clicked()
        {
            board.request_fit();
        }
        if ui
            .button("Reset view")
            .on_hover_text("Reset the rotation and fit the pieces again")
            .clicked()
        {
            board.reset_view();
        }
        ui.separator();
        ui.label(egui::RichText::new(HINT_2D_VIEW).small());
    });
}
