//! Nonphysical garment construction metadata in panel-local metres.
use glam::DVec2;
use serde::{Deserialize, Serialize};

/// A stable document identity and its owning panel. Paths contain material
/// coordinates rather than mesh vertices or transient boundary indices.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Trim {
    pub id: String,
    pub panel_id: String,
    pub kind: TrimKind,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum TrimKind {
    Button {
        center_m: DVec2,
        diameter_m: f64,
    },
    Buttonhole {
        start_m: DVec2,
        end_m: DVec2,
        width_m: f64,
    },
    Zipper {
        path_m: Vec<DVec2>,
        width_m: f64,
    },
    Topstitch {
        path_m: Vec<DVec2>,
        rows: u8,
        spacing_m: f64,
    },
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

fn point(p: DVec2) -> bool {
    p.is_finite() && p.abs().max_element() <= 1e6
}
fn size(v: f64) -> bool {
    v.is_finite() && (1e-6..=1e3).contains(&v)
}
fn path(points: &[DVec2]) -> bool {
    (2..=1024).contains(&points.len())
        && points.iter().copied().all(point)
        && points.windows(2).all(|p| p[0].distance(p[1]) >= 1e-6)
}

impl Trim {
    /// Checks representation only; document validation resolves the panel ID.
    pub fn validate(&self) -> Result<(), String> {
        if !valid_id(&self.id) || !valid_id(&self.panel_id) {
            return Err(
                "Trim and panel IDs must use 1–80 ASCII letters, digits, '_' or '-'".into(),
            );
        }
        let valid = match &self.kind {
            TrimKind::Button {
                center_m,
                diameter_m,
            } => point(*center_m) && size(*diameter_m),
            TrimKind::Buttonhole {
                start_m,
                end_m,
                width_m,
            } => path(&[*start_m, *end_m]) && size(*width_m),
            TrimKind::Zipper { path_m, width_m } => path(path_m) && size(*width_m),
            TrimKind::Topstitch {
                path_m,
                rows,
                spacing_m,
            } => path(path_m) && (1..=8).contains(rows) && size(*spacing_m),
        };
        if !valid {
            return Err("Invalid trim geometry or dimensions".into());
        }
        Ok(())
    }
}
