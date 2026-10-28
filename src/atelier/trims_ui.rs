//! Native inspector drafts for nonphysical construction trims.
use super::*;
use glam::DVec2;
use marvelous_cloth::authoring::Command;
use marvelous_cloth::garment::{
    template::Panel,
    trims::{Trim, TrimKind},
};

#[derive(Default)]
pub(super) struct TrimUi {
    draft: Option<TrimDraft>,
    kind: usize,
}

struct TrimDraft {
    panel: String,
    id: String,
    kind: usize,
    points: String,
    width: String,
    rows: String,
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
    let color = Color32::from_rgb(0x9B, 0x42, 0x95);
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
        }
    }

    fn parse(&self) -> Result<Trim, String> {
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

impl Atelier {
    pub(super) fn trim_properties(&mut self, ui: &mut egui::Ui, panel: &Panel) {
        if self
            .authoring
            .trims
            .draft
            .as_ref()
            .is_some_and(|d| d.panel != panel.id)
        {
            self.authoring.trims.draft = None;
        }
        let mut command = None;
        ui.collapsing("Construction trims", |ui| {
            ui.small("Visual construction notes · no physical closures. Paths preview their center line; widths may extend outside the panel.");
            for trim in self
                .project
                .template
                .trims
                .iter()
                .filter(|t| t.panel_id == panel.id)
            {
                ui.horizontal(|ui| {
                    if ui
                        .small_button(format!("{} · {}", label(&trim.kind), trim.id))
                        .clicked()
                    {
                        self.authoring.trims.draft = Some(TrimDraft::from_trim(trim));
                    }
                    if ui.small_button("Delete").clicked() {
                        command = Some(Command::RemoveTrim {
                            id: trim.id.clone(),
                        });
                    }
                });
            }
            ui.horizontal(|ui| {
                egui::ComboBox::from_id_salt("trim-kind")
                    .selected_text(
                        ["Button", "Buttonhole", "Zipper", "Topstitch"][self.authoring.trims.kind],
                    )
                    .show_ui(ui, |ui| {
                        for (i, name) in ["Button", "Buttonhole", "Zipper", "Topstitch"]
                            .iter()
                            .enumerate()
                        {
                            ui.selectable_value(&mut self.authoring.trims.kind, i, *name);
                        }
                    });
                if ui.button("New").clicked() {
                    let center = DVec2::new(panel.pattern.width, panel.pattern.height) * 0.5;
                    let kind = self.authoring.trims.kind;
                    let points = if kind == 0 {
                        vec![center]
                    } else {
                        vec![center - DVec2::X * 0.02, center + DVec2::X * 0.02]
                    };
                    self.authoring.trims.draft = Some(TrimDraft {
                        panel: panel.id.clone(),
                        id: next_id(&self.project.template.trims),
                        kind,
                        points: points_text(&points),
                        width: if kind == 0 { "18" } else { "4" }.into(),
                        rows: "1".into(),
                    });
                }
            });
            if let Some(draft) = self.authoring.trims.draft.as_mut() {
                ui.label("Material X, Y (mm) · one point per line");
                ui.add(
                    egui::TextEdit::multiline(&mut draft.points).desired_rows(if draft.kind == 0 {
                        1
                    } else {
                        3
                    }),
                );
                ui.horizontal(|ui| {
                    ui.label(if draft.kind == 0 {
                        "Diameter (mm)"
                    } else if draft.kind == 3 {
                        "Row spacing (mm)"
                    } else {
                        "Width (mm)"
                    });
                    ui.text_edit_singleline(&mut draft.width);
                });
                if draft.kind == 3 {
                    ui.horizontal(|ui| {
                        ui.label("Rows");
                        ui.text_edit_singleline(&mut draft.rows);
                    });
                }
                let parsed = draft.parse();
                if let Err(error) = &parsed {
                    ui.colored_label(Color32::GOLD, error);
                }
                ui.horizontal(|ui| {
                    if ui
                        .add_enabled(parsed.is_ok(), egui::Button::new("Apply"))
                        .clicked()
                    {
                        command = parsed.ok().map(|trim| Command::SetTrim { trim });
                    }
                    if ui.button("Cancel").clicked() {
                        self.authoring.trims.draft = None;
                    }
                });
            }
        });
        if let Some(command) = command {
            if let Command::SetTrim { trim } = &command
                && let Err(error) = validate_surface(trim, &self.scene.garment)
            {
                self.authoring.error = Some(error.clone());
                self.status = error;
                return;
            }
            if self.edit(command) {
                self.authoring.trims.draft = None;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use marvelous_cloth::garment::GarmentTemplate;

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
}
