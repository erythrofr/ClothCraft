//! Avatar reference drawn behind the 2D pattern board: orthographic silhouettes of
//! the body seen from the front and from the back, optionally with an outline.
//! It is only drawn. It takes no clicks and never enters the pattern, the garment
//! or the solver.
//!
//! Position is absolute: the avatar is drawn in the same fixed board frame that
//! pieces use (`garment::template::board_to_world`, inverted). There is no offset
//! and no fitting to pieces, so the silhouette and the pieces always agree.
use super::{board::Board, *};
use glam::DVec3;
use marvelous_cloth::avatar::SurfaceMesh;
use marvelous_cloth::garment::template::world_to_board;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone, Debug)]
pub(super) struct Backdrop {
    /// Front silhouette: the body as seen from the front.
    pub fill: bool,
    /// Back silhouette: the body as seen from behind, placed beside the front.
    pub back: bool,
    pub outline: bool,
    /// Strength of the silhouettes, from 0 (invisible) to 1.
    pub opacity: f32,
    /// Distance of the back silhouette to the right of the front one, in metres.
    pub back_gap: f64,
    cache: Option<(usize, Arc<Geometry>)>,
}

impl Default for Backdrop {
    fn default() -> Self {
        Self {
            fill: true,
            back: false,
            outline: false,
            opacity: 0.2,
            back_gap: 0.9,
            cache: None,
        }
    }
}

/// Avatar geometry in board coordinates (metres, y down), from the fixed board map.
#[derive(Debug)]
struct Geometry {
    /// Triangles facing the front (+z).
    front: Vec<[DVec2; 3]>,
    /// Triangles facing the back (-z).
    back: Vec<[DVec2; 3]>,
    /// Silhouette edges: shared by one front-facing and one back-facing triangle.
    outline: Vec<[DVec2; 2]>,
    /// Horizontal centre and width of the avatar, in world metres.
    centre: f64,
    width: f64,
}

use glam::DVec2;

fn geometry(surface: &SurfaceMesh) -> Geometry {
    let (mut low, mut high) = (
        DVec3::splat(f64::INFINITY),
        DVec3::splat(f64::NEG_INFINITY),
    );
    for v in &surface.vertices {
        low = low.min(*v);
        high = high.max(*v);
    }
    if !low.is_finite() || !high.is_finite() {
        return Geometry {
            front: vec![],
            back: vec![],
            outline: vec![],
            centre: 0.,
            width: 0.,
        };
    }
    let centre = (low.x + high.x) * 0.5;
    let width = high.x - low.x;
    let flat = |v: DVec3| world_to_board(v);

    let (mut front, mut back) = (Vec::new(), Vec::new());
    // Per edge: how many front-facing and back-facing triangles use it.
    let mut edges: HashMap<(usize, usize), [u32; 2]> = HashMap::new();
    for [a, b, c] in &surface.triangles {
        let (pa, pb, pc) = (surface.vertices[*a], surface.vertices[*b], surface.vertices[*c]);
        let nz = (pb - pa).cross(pc - pa).z;
        let is_front = nz > 0.0;
        if nz > 0.0 {
            front.push([flat(pa), flat(pb), flat(pc)]);
        } else if nz < 0.0 {
            back.push([flat(pa), flat(pb), flat(pc)]);
        }
        for (i, j) in [(*a, *b), (*b, *c), (*c, *a)] {
            let key = (i.min(j), i.max(j));
            let counts = edges.entry(key).or_insert([0, 0]);
            counts[usize::from(!is_front)] += 1;
        }
    }
    let outline = edges
        .into_iter()
        .filter(|(_, counts)| counts[0] > 0 && counts[1] > 0)
        .map(|((i, j), _)| [flat(surface.vertices[i]), flat(surface.vertices[j])])
        .collect();
    Geometry {
        front,
        back,
        outline,
        centre,
        width,
    }
}

/// Rebuild the cached views when the avatar changes. Cheap to call every frame.
pub(super) fn refresh(backdrop: &mut Backdrop, surface: &Arc<SurfaceMesh>) {
    if !(backdrop.fill || backdrop.back || backdrop.outline) {
        return;
    }
    let key = Arc::as_ptr(surface) as usize;
    if backdrop.cache.as_ref().is_some_and(|(k, _)| *k == key) {
        return;
    }
    backdrop.cache = Some((key, Arc::new(geometry(surface))));
}

/// Draw the cached views on the board, behind the panels.
pub(super) fn paint(painter: &egui::Painter, rect: egui::Rect, board: &Board, backdrop: &Backdrop) {
    let Some((_, geometry)) = &backdrop.cache else {
        return;
    };
    let alpha = (backdrop.opacity.clamp(0., 1.) * 255.) as u8;
    if alpha == 0 {
        return;
    }
    let fill_colour = Color32::from_rgba_unmultiplied(0x6E, 0x8F, 0xB8, alpha);
    let outline_colour = Color32::from_rgba_unmultiplied(0x4A, 0x63, 0x85, alpha.max(110));
    // Front: board coordinates as they are. Back: mirrored about the avatar's centre
    // and moved right by its width and the gap, so it sits beside the front view.
    let front = |p: DVec2| board.screen(rect, p);
    let shift = geometry.width + backdrop.back_gap;
    let behind = |p: DVec2| {
        board.screen(
            rect,
            DVec2::new(2. * geometry.centre - p.x + shift, p.y),
        )
    };
    let draw = |tris: &[[DVec2; 3]], map: &dyn Fn(DVec2) -> egui::Pos2| {
        let mut mesh = egui::Mesh::default();
        mesh.vertices.reserve(tris.len() * 3);
        for tri in tris {
            let base = mesh.vertices.len() as u32;
            for p in tri {
                mesh.colored_vertex(map(*p), fill_colour);
            }
            mesh.add_triangle(base, base + 1, base + 2);
        }
        painter.add(egui::Shape::mesh(mesh));
    };
    if backdrop.fill {
        draw(&geometry.front, &front);
    }
    if backdrop.back {
        draw(&geometry.back, &behind);
    }
    if backdrop.outline {
        let stroke = Stroke::new(1.2, outline_colour);
        for [a, b] in &geometry.outline {
            painter.line_segment([front(*a), front(*b)], stroke);
            if backdrop.back {
                painter.line_segment([behind(*a), behind(*b)], stroke);
            }
        }
    }
}

/// Settings for the backdrop, in the board toolbar.
pub(super) fn menu(ui: &mut egui::Ui, backdrop: &mut Backdrop) {
    ui.menu_button("Avatar", |ui| {
        ui.checkbox(&mut backdrop.fill, "Front silhouette");
        ui.checkbox(&mut backdrop.back, "Back silhouette");
        ui.checkbox(&mut backdrop.outline, "Outline");
        ui.add(egui::Slider::new(&mut backdrop.opacity, 0.02..=0.8).text("Opacity"));
        ui.horizontal(|ui| {
            ui.label("Back gap mm");
            let mut gap = backdrop.back_gap * 1000.;
            if ui.add(egui::DragValue::new(&mut gap).speed(1.0)).changed() {
                backdrop.back_gap = gap / 1000.;
            }
        });
    });
}
