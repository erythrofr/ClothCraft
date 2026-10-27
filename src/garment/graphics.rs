//! CPU material-space placement math for future artwork integration.
//!
//! This module does not load assets, store them in a project, render artwork,
//! or establish that the artwork rectangle lies inside a panel contour.
use glam::DVec2;
use serde::{Deserialize, Serialize};

/// A face of the authored panel, not an instruction to mirror image pixels.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphicSide {
    Front,
    Back,
}

/// Rectangle in panel-local material coordinates, in metres.
///
/// Image UV (0,0) maps to the local negative half-size corner before rotation;
/// (1,1) maps to the positive corner. Positive rotation follows the 2D material
/// coordinate axes. Identifiers are opaque IDs, not paths or URLs.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GraphicPlacement {
    pub id: String,
    pub panel_id: String,
    pub asset_id: String,
    pub center_m: DVec2,
    pub size_m: DVec2,
    pub rotation_degrees: f64,
    pub side: GraphicSide,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

impl GraphicPlacement {
    /// Validate numerical and identifier shape only. The caller must resolve
    /// IDs and define containment, asset portability and topology policies.
    pub fn validate(&self) -> Result<(), String> {
        if !valid_id(&self.id) || !valid_id(&self.panel_id) || !valid_id(&self.asset_id) {
            return Err(
                "Graphic, panel and asset IDs must use 1–80 ASCII letters, digits, '_' or '-'"
                    .into(),
            );
        }
        if !self.center_m.is_finite()
            || self.center_m.abs().max_element() > 1e6
            || !self.size_m.is_finite()
            || self.size_m.min_element() < 1e-9
            || self.size_m.max_element() > 1e6
            || !self.rotation_degrees.is_finite()
        {
            return Err("Graphic placement requires finite metre coordinates, positive size and finite rotation".into());
        }
        Ok(())
    }

    /// Check panel identity against an existing template. Asset resolution and
    /// the clipping policy for a placement crossing the contour remain the
    /// caller's responsibility.
    pub fn validate_panel(&self, template: &super::GarmentTemplate) -> Result<(), String> {
        self.validate()?;
        if !template
            .panels
            .iter()
            .any(|panel| panel.id == self.panel_id)
        {
            return Err("Graphic references a missing panel".into());
        }
        Ok(())
    }

    /// Convert normalized image coordinates to panel-local material metres.
    /// Values outside [0,1] are allowed for mathematical extrapolation.
    pub fn uv_to_material(&self, uv: DVec2) -> Result<DVec2, String> {
        self.validate()?;
        if !uv.is_finite() {
            return Err("Graphic UV must be finite".into());
        }
        let angle = self.rotation_degrees.rem_euclid(360.).to_radians();
        let (sin, cos) = angle.sin_cos();
        let p = (uv - DVec2::splat(0.5)) * self.size_m;
        let result = self.center_m + DVec2::new(cos * p.x - sin * p.y, sin * p.x + cos * p.y);
        if !result.is_finite() {
            return Err("Graphic transform exceeds finite coordinates".into());
        }
        Ok(result)
    }

    /// Convert panel-local metres to normalized image coordinates.
    pub fn material_to_uv(&self, point_m: DVec2) -> Result<DVec2, String> {
        self.validate()?;
        if !point_m.is_finite() {
            return Err("Material position must be finite".into());
        }
        let angle = self.rotation_degrees.rem_euclid(360.).to_radians();
        let (sin, cos) = angle.sin_cos();
        let p = point_m - self.center_m;
        let result = DVec2::new(cos * p.x + sin * p.y, -sin * p.x + cos * p.y) / self.size_m
            + DVec2::splat(0.5);
        if !result.is_finite() {
            return Err("Graphic inverse transform exceeds finite coordinates".into());
        }
        Ok(result)
    }
}
