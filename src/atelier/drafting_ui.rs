//! Drafting tools only issue CPU transactions; they never touch the solver.
use super::{authoring_ui::Tool, *};
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        meshing::MeshingSettings,
        shapes::{BooleanOp, MirrorAxis, Primitive},
        template::Panel,
    },
};

pub(super) struct DraftingUi {
    kind: Primitive,
    size_mm: [f64; 2],
    pub sweep: f64,
    operand: String,
    keep_tool: bool,
    width_mm: f64,
    ratio: f64,
    pub line_panel: Option<String>,
}
impl Default for DraftingUi {
    fn default() -> Self {
        Self {
            kind: Primitive::Ellipse,
            size_mm: [300., 300.],
            sweep: 180.,
            operand: String::new(),
            keep_tool: false,
            width_mm: 80.,
            ratio: 1.5,
            line_panel: None,
        }
    }
}
impl Atelier {
    pub(super) fn primitive_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Shapes", |ui| {
            let d = &mut self.authoring.drafting;
            ui.horizontal(|ui| {
                for (kind, label) in [
                    (Primitive::Rectangle, "Rectangle"),
                    (Primitive::Ellipse, "Circle / ellipse"),
                    (Primitive::Sector, "Arc sector"),
                ] {
                    ui.selectable_value(&mut d.kind, kind, label);
                }
            });
            for (label, value) in ["Width", "Height"].into_iter().zip(d.size_mm.iter_mut()) {
                ui.horizontal(|ui| {
                    ui.label(label);
                    ui.add(
                        egui::DragValue::new(value)
                            .range(5. ..=10_000.)
                            .suffix(" mm"),
                    );
                });
            }
            if d.kind == Primitive::Ellipse && ui.small_button("Circle: H = W").clicked() {
                d.size_mm[1] = d.size_mm[0];
            }
            if d.kind == Primitive::Sector {
                ui.add(egui::Slider::new(&mut d.sweep, 5. ..=355.).text("Angle"));
                ui.small("Size of the supporting ellipse. The sector is closed by two radii.");
            }
            if ui.button("Add at board center").clicked() {
                let size = DVec2::from_array(d.size_mm) / 1000.;
                let command = Command::Primitive {
                    kind: d.kind,
                    size,
                    sweep_degrees: d.sweep,
                    origin: self.authoring.board.center - size * 0.5,
                    meshing: MeshingSettings {
                        target_edge_m: self.mesh_mm * 0.001,
                        anisotropy: self.anisotropy,
                        axis_degrees: self.mesh_axis,
                        ..Default::default()
                    },
                    fabric: self.project.template.fabrics[0].id.clone(),
                    replace: false,
                };
                if self.edit(command) {
                    self.set_authoring_tool(Tool::Edit, false);
                    ui.close();
                }
            }
        });
    }
    pub(super) fn drafting_properties(&mut self, ui: &mut egui::Ui, panel: &Panel) {
        let mut simulated = !panel.hidden;
        if ui
            .checkbox(&mut simulated, "Simulate in 3D")
            .on_hover_text("Off: this piece and its seams are left out of the simulation. It stays on the 2D board.")
            .changed()
        {
            self.edit(Command::SetHidden {
                panel: panel.id.clone(),
                hidden: !simulated,
            });
        }
        self.linked_mirror_properties(ui, &panel.id);
        ui.collapsing("Mirrors and booleans", |ui| {
            ui.small("X: left / right · Y: up / down in local pattern coordinates.");
            ui.horizontal_wrapped(|ui| {
                for (axis, label) in [(MirrorAxis::X, "Mirror X"), (MirrorAxis::Y, "Mirror Y")] {
                    if ui.button(label).clicked() {
                        self.edit(Command::Mirror {
                            panel: panel.id.clone(),
                            axis,
                            copy_side: None,
                        });
                    }
                }
            });
            ui.label("Create an independent mirrored copy");
            ui.horizontal(|ui| {
                for (axis, side, label) in [
                    (MirrorAxis::X, -1, "−X"),
                    (MirrorAxis::X, 1, "+X"),
                    (MirrorAxis::Y, -1, "−Y"),
                    (MirrorAxis::Y, 1, "+Y"),
                ] {
                    if ui.button(label).clicked() {
                        self.edit(Command::Mirror {
                            panel: panel.id.clone(),
                            axis,
                            copy_side: Some(side),
                        });
                    }
                }
            });
            ui.separator();
            self.boolean_properties(ui, panel);
        });
    }
    pub(super) fn linked_mirror_properties(&mut self, ui: &mut egui::Ui, panel: &str) {
        let link = self
            .project
            .template
            .mirror_links
            .iter()
            .find(|l| l.a == panel || l.b == panel)
            .cloned();
        if let Some(link) = link {
            let partner = if link.a == panel { link.b } else { link.a };
            ui.strong(format!("Linked mirror {:?} · {partner}", link.axis));
            ui.small("Edit either piece. Shape, curves, internal lines and grain update together on release. Placement and fabric stay independent.");
            if ui.button("Unlink mirror").clicked() {
                self.edit(Command::UnlinkMirror {
                    panel: panel.into(),
                });
            }
        } else {
            ui.horizontal(|ui| {
                ui.label("Linked copy");
                for (axis, name) in [(MirrorAxis::X, "X"), (MirrorAxis::Y, "Y")] {
                    let button = ui.button(name).on_hover_text("Create a mirrored partner. Later shape edits update both pieces; undo restores both.");
                    self.smoke_target_ui(ui, &format!("linked_mirror_{name}"), button.rect);
                    if button.clicked() {
                        self.edit(Command::LinkedMirror { panel: panel.into(), axis });
                    }
                }
            });
        }
    }
    fn boolean_properties(&mut self, ui: &mut egui::Ui, panel: &Panel) {
        ui.label("Boolean · A = active panel");
        let choices: Vec<_> = self
            .project
            .template
            .panels
            .iter()
            .filter(|p| p.id != panel.id)
            .map(|p| (p.id.clone(), p.name.clone()))
            .collect();
        let d = &mut self.authoring.drafting;
        if !choices.iter().any(|(id, _)| id == &d.operand) {
            d.operand = choices.first().map(|p| p.0.clone()).unwrap_or_default();
        }
        egui::ComboBox::from_id_salt("boolean_b")
            .selected_text(
                choices
                    .iter()
                    .find(|p| p.0 == d.operand)
                    .map_or("Choose B", |p| p.1.as_str()),
            )
            .show_ui(ui, |ui| {
                for (id, name) in choices {
                    ui.selectable_value(&mut d.operand, id, name);
                }
            });
        ui.checkbox(&mut d.keep_tool, "Keep B");
        ui.small("Overlap the pieces on the 2D board. A supplies fabric and placement.");
        ui.small("Remove seams, pins, internal lines and target lengths first.");
        ui.horizontal_wrapped(|ui| {
            for (op, label) in [
                (BooleanOp::Union, "Union"),
                (BooleanOp::Difference, "A − B"),
                (BooleanOp::Intersection, "Intersection"),
            ] {
                if ui
                    .add_enabled(
                        !self.authoring.drafting.operand.is_empty(),
                        egui::Button::new(label),
                    )
                    .clicked()
                {
                    self.edit(Command::Boolean {
                        a: panel.id.clone(),
                        b: self.authoring.drafting.operand.clone(),
                        op,
                        keep_tool: self.authoring.drafting.keep_tool,
                    });
                }
            }
        });
    }
    pub(super) fn finish_internal_line(&mut self) {
        let Some(id) = self.authoring.drafting.line_panel.clone() else {
            self.authoring.error = Some("Select a panel before using Internal line".into());
            return;
        };
        let Some(i) = self.project.template.panels.iter().position(|p| p.id == id) else {
            self.authoring.error = Some("The target panel no longer exists; select a piece and activate Internal line again".into());
            return;
        };
        let origin = authoring::layout(&self.project.template, i);
        let angle = self.project.template.panels[i].layout_rotation_degrees;
        let command = Command::InternalLine {
            panel: id,
            points: self
                .authoring
                .draft
                .iter()
                .map(|p| authoring::rotate_2d(*p - origin, -angle))
                .collect(),
            tangents: self
                .authoring
                .tangents
                .iter()
                .map(|p| authoring::rotate_2d(*p, -angle))
                .collect(),
        };
        if self.edit(command) {
            let panel = self.authoring.selected.clone().unwrap();
            let line = self
                .project
                .template
                .panels
                .iter()
                .find(|p| p.id == panel)
                .unwrap()
                .polygon
                .as_ref()
                .unwrap()
                .lines
                .last()
                .unwrap()
                .id
                .clone();
            self.set_authoring_tool(Tool::Edit, false);
            self.authoring.edge = Some(marvelous_cloth::garment::seam::BoundaryRef {
                reversed: false,
                panel,
                edge: Some(line),
                side: marvelous_cloth::garment::seam::Side::Top,
                range: [0., 1.],
            });
            self.status =
                "Internal line created · Sew to a boundary or add a ruffle in the inspector".into();
        }
    }
    pub(super) fn internal_line_properties(&mut self, ui: &mut egui::Ui) {
        let Some(edge) = self.authoring.edge.clone() else {
            return;
        };
        let Some(name) = edge.edge.clone() else {
            return;
        };
        let Some(line) = self
            .project
            .template
            .panels
            .iter()
            .find(|p| p.id == edge.panel)
            .and_then(|p| p.polygon.as_ref())
            .and_then(|p| p.lines.iter().find(|l| l.id == name))
            .cloned()
        else {
            return;
        };
        ui.strong(format!("Internal line · {name}"));
        let length: f64 = line
            .samples()
            .unwrap_or_default()
            .windows(2)
            .map(|p| p[0].distance(p[1]))
            .sum();
        ui.small(format!(
            "{:.1} mm · sew in 2D / 3D · draggable points and tangents",
            length * 1000.
        ));
        if ui.small_button("Smooth tangents").clicked() {
            let mut poly = self
                .project
                .template
                .panels
                .iter()
                .find(|p| p.id == edge.panel)
                .unwrap()
                .polygon
                .clone()
                .unwrap();
            let l = poly.lines.iter_mut().find(|l| l.id == name).unwrap();
            for k in 0..l.points.len() {
                l.tangents[k] = (l.points[(k + 1).min(l.points.len() - 1)]
                    - l.points[k.saturating_sub(1)])
                    / 6.;
            }
            self.edit(Command::Shape {
                panel: edge.panel.clone(),
                polygon: poly,
            });
        }
        let d = &mut self.authoring.drafting;
        ui.horizontal(|ui| {
            ui.label("Ruffle width");
            ui.add(
                egui::DragValue::new(&mut d.width_mm)
                    .range(5. ..=1000.)
                    .suffix(" mm"),
            );
        });
        ui.add(egui::Slider::new(&mut d.ratio, 1. ..=4.).text("Length ×"));
        if ui.button("Create and sew a ruffle").clicked() {
            let command = Command::Ruffle {
                panel: edge.panel.clone(),
                line: name.clone(),
                width: d.width_mm * 0.001,
                ratio: d.ratio,
            };
            if self.edit(command) {
                self.authoring.edge = None;
                self.set_authoring_tool(Tool::Place, false);
                self.status =
                    "Ruffle created with ease · adjust its 3D placement before simulation".into();
            }
        }
        ui.small("A ratio > 1 adds ease. Adjust the initial placement, especially along a curve.");
        if ui.small_button("Delete line").clicked() {
            self.edit(Command::RemoveLine {
                panel: edge.panel,
                line: name,
            });
        }
        ui.separator();
    }
    pub(super) fn online_patterns(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Free patterns · Web", |ui| {
            ui.label("FreeSewing · parametric patterns");
            for (label,url) in [("Teagan · T-shirt","https://freesewing.eu/designs/teagan/"),("Titan · trouser block","https://freesewing.eu/designs/titan/"),("Jett · bomber","https://freesewing.eu/designs/jett/")] {
                ui.hyperlink_to(label,url);
            }
            ui.separator();
            ui.small("Open the website to generate a pattern from your measurements. FreeSewing / SVG import is planned; these links do not add pieces to the scene.");
            ui.hyperlink_to("FreeSewing terms of use","https://freesewing.eu/docs/about/faq/commercial-use/");
        });
    }
}
