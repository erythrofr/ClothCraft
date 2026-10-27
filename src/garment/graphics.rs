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

/// Transient image coordinates for one compiled triangle. Vertex IDs belong
/// only to that compiled mesh: discard and rebuild these records on remeshing.
/// Coordinates may lie outside [0,1]; a consumer must clip or discard them.
#[derive(Clone, Debug, PartialEq)]
pub struct GraphicTriangleUv {
    pub vertices: [usize; 3],
    pub image_uv: [DVec2; 3],
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

impl GraphicPlacement {
    /// Validate numerical and identifier shape only. Each dimension must be
    /// at least 4096 f64 epsilon times the largest of 1 metre, the absolute
    /// center coordinates and the dimensions. This bounds extreme cancellation
    /// in ordinary [0,1] image UV; it is not an exact round-trip guarantee.
    /// The caller must resolve IDs and define containment, asset portability
    /// and topology policies.
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
        let scale = self
            .center_m
            .abs()
            .max_element()
            .max(self.size_m.max_element())
            .max(1.);
        if self.size_m.min_element() < 4096. * f64::EPSILON * scale {
            return Err("Graphic dimensions are too small relative to their position or aspect ratio for reliable coordinates".into());
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

    /// Build image UVs from the named panel's material rest coordinates.
    /// This does not inspect 3D positions, render, clip or load an asset.
    /// Rebuild the returned records after every remesh or placement change.
    pub fn triangle_uvs(
        &self,
        garment: &super::CompiledGarment,
    ) -> Result<Vec<GraphicTriangleUv>, String> {
        self.validate()?;
        let panel = garment
            .panels
            .iter()
            .find(|panel| panel.id == self.panel_id)
            .ok_or("Graphic references a missing compiled panel")?;
        let triangles = garment
            .mesh
            .triangles
            .get(panel.triangles.clone())
            .ok_or("Invalid compiled panel triangle range")?;
        let mut result = Vec::new();
        result
            .try_reserve(triangles.len())
            .map_err(|_| "Graphic triangle allocation failed")?;
        let (sin, cos) = self
            .rotation_degrees
            .rem_euclid(360.)
            .to_radians()
            .sin_cos();
        for triangle in triangles {
            if triangle
                .vertices
                .iter()
                .any(|v| !panel.vertices.contains(v))
            {
                return Err("Compiled triangle crosses panel vertex ranges".into());
            }
            let mut image_uv = [DVec2::ZERO; 3];
            for (i, &vertex) in triangle.vertices.iter().enumerate() {
                let material_uv = garment
                    .mesh
                    .uv
                    .get(vertex)
                    .ok_or("Missing compiled material vertex")?;
                image_uv[i] = self.inverse_with_rotation(*material_uv, sin, cos)?;
            }
            result.push(GraphicTriangleUv {
                vertices: triangle.vertices,
                image_uv,
            });
        }
        Ok(result)
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
        let angle = self.rotation_degrees.rem_euclid(360.).to_radians();
        let (sin, cos) = angle.sin_cos();
        self.inverse_with_rotation(point_m, sin, cos)
    }

    fn inverse_with_rotation(&self, point_m: DVec2, sin: f64, cos: f64) -> Result<DVec2, String> {
        if !point_m.is_finite() {
            return Err("Material position must be finite".into());
        }
        let p = point_m - self.center_m;
        let result = DVec2::new(cos * p.x + sin * p.y, -sin * p.x + cos * p.y) / self.size_m
            + DVec2::splat(0.5);
        if !result.is_finite() {
            return Err("Graphic inverse transform exceeds finite coordinates".into());
        }
        Ok(result)
    }
}
