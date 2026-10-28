//! Screen-space boundary picking backed by the same named edges as the 2D board.
use super::{
    authoring_ui::{Tool, segment_distance},
    board::same_edge,
    gizmo::project_matrix,
    *,
};
use marvelous_cloth::garment::seam::{BoundaryRef, Side};

impl Atelier {
    pub(super) fn edge_interaction(&mut self, response: &egui::Response, rect: egui::Rect) {
        if self.trim_3d_placement_active() {
            if response.clicked()
                && let Some(pointer) = response.interact_pointer_pos()
            {
                self.place_trim_on_3d(rect, pointer);
            }
            return;
        }
        if self.sewing_canvas_confirm(response) {
            return;
        }
        if !matches!(self.authoring.tool, Tool::Edit | Tool::Sew) {
            return;
        }
        if self.authoring.tool == Tool::Edit
            && response.clicked()
            && let Some(pointer) = response.interact_pointer_pos()
            && self.pick_trim_3d(rect, pointer)
        {
            return;
        }
        let Some(pointer) = response.hover_pos() else {
            return;
        };
        let mut hits = vec![];
        let matrix = self.camera.matrix(rect.width() / rect.height());
        let project = |p| project_matrix(matrix, rect, p);
        for panel in &self.scene.garment.panels {
            for (name, ids) in &panel.boundaries {
                for segment in ids.windows(2) {
                    let a = self.scene.state.x[segment[0]];
                    let b = self.scene.state.x[segment[1]];
                    let (Some(pa), Some(pb)) = (project(a), project(b)) else {
                        continue;
                    };
                    let distance = segment_distance(pointer, pa, pb);
                    if distance > 9. {
                        continue;
                    }
                    let v = pb - pa;
                    let t = ((pointer - pa).dot(v) / v.length_sq().max(1e-12)).clamp(0., 1.);
                    let wa = (matrix * a.as_vec3().extend(1.)).w;
                    let wb = (matrix * b.as_vec3().extend(1.)).w;
                    let t = (t / wb) / ((1. - t) / wa + t / wb);
                    let world = a.lerp(b, t as f64);
                    hits.push((distance, world, panel.id.clone(), name.clone()));
                }
            }
        }
        hits.sort_by(|a, b| a.0.total_cmp(&b.0));
        // Check visibility along the candidate's own ray, so the click tolerance
        // does not accidentally reject silhouettes. Never pick through the body.
        for (_, world, panel, name) in hits {
            let Some(screen) = project(world) else {
                continue;
            };
            let (origin, dir) = self.camera.ray(screen, rect);
            let distance = world.distance(origin);
            let avatar_blocked = self
                .scene
                .collider
                .occludes_ray(origin, dir, distance - 0.0001);
            if avatar_blocked {
                continue;
            }
            let cloth_blocked = self.scene.garment.mesh.triangles.iter().any(|t| {
                picking::ray_triangle(origin, dir, t.vertices.map(|i| self.scene.state.x[i]))
                    .is_some_and(|(d, _)| d < distance - 0.0001)
            });
            if cloth_blocked {
                continue;
            }
            let edge = BoundaryRef {
                reversed: false,
                panel,
                side: Side::Top,
                edge: Some(name),
                range: [0., 1.],
            };
            self.authoring.hover_edge = Some(edge.clone());
            if response.clicked() {
                let t = self.boundary_parameter(&edge, rect, pointer, true);
                self.pick_sewing_boundary(edge, t, pointer);
            }
            return;
        }
        if response.clicked() && self.authoring.tool == Tool::Edit {
            let (origin, dir) = self.camera.ray(pointer, rect);
            let mut best = f64::INFINITY;
            let mut selected = None;
            for panel in &self.scene.garment.panels {
                for tri in &self.scene.garment.mesh.triangles[panel.triangles.clone()] {
                    if let Some((d, _)) = picking::ray_triangle(
                        origin,
                        dir,
                        tri.vertices.map(|i| self.scene.state.x[i]),
                    ) && d < best
                    {
                        best = d;
                        selected = Some(panel.id.clone());
                    }
                }
            }
            if selected.is_some() && !self.scene.collider.occludes_ray(origin, dir, best - 0.0001) {
                self.cancel_preview();
                if let Some(id) = selected {
                    self.select_panel(id, response.ctx.input(|i| i.modifiers.shift));
                }
                self.authoring.edge = None;
            }
        }
    }
    pub(super) fn paint_edges_3d(&mut self, ui: &egui::Ui, rect: egui::Rect) {
        let painter = ui.painter().with_clip_rect(rect);
        let matrix = self.camera.matrix(rect.width() / rect.height());
        let project = |p| project_matrix(matrix, rect, p);
        let show = matches!(self.authoring.tool, Tool::Edit | Tool::Sew);
        for panel in &self.scene.garment.panels {
            for (name, ids) in &panel.boundaries {
                let edge = BoundaryRef {
                    reversed: false,
                    panel: panel.id.clone(),
                    side: Side::Top,
                    edge: Some(name.clone()),
                    range: [0., 1.],
                };
                let active = self.seam_edge_highlighted(&edge);
                let hover = self
                    .authoring
                    .hover_edge
                    .as_ref()
                    .is_some_and(|e| same_edge(e, &edge));
                let endpoint = self.authoring.ends.iter().position(|e| same_edge(e, &edge));
                let selected = self.panel_selected(&panel.id);
                if !show && !active && !selected {
                    continue;
                }
                let color = if endpoint.is_some() {
                    Color32::from_rgb(248, 117, 188)
                } else if active || hover || selected {
                    Color32::GOLD
                } else if let Some(s) = self
                    .project
                    .template
                    .seams
                    .iter()
                    .find(|s| s.references().any(|r| same_edge(&edge, r)))
                {
                    super::seam_links::seam_color(&s.id)
                } else {
                    Color32::from_rgb(81, 166, 206)
                };
                for pair in ids.windows(2) {
                    if let (Some(a), Some(b)) = (
                        project(self.scene.state.x[pair[0]]),
                        project(self.scene.state.x[pair[1]]),
                    ) {
                        painter.line_segment(
                            [a, b],
                            Stroke::new(
                                if active || hover || endpoint.is_some() {
                                    1.5
                                } else {
                                    1.3
                                },
                                color,
                            ),
                        );
                    }
                }
                if name == "edge_1"
                    && let Some(smoke) = &mut self.authoring_smoke
                {
                    let mid = ids[ids.len() / 2];
                    if let Some(p) = project(self.scene.state.x[mid]) {
                        smoke.target(&format!("edge3d_{}", panel.id), p);
                    }
                }
            }
        }
    }
}
