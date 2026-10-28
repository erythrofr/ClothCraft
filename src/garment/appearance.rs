//! Authored optical properties. These never calibrate or modify cloth mechanics.
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FabricAppearance {
    /// Display sRGB bytes. Rendering decodes these before optical shading.
    pub color_srgb: [u8; 3],
    /// Dimensionless perceptual roughness, in [0, 1].
    pub roughness: f64,
    /// Optional embedded, opaque sRGB albedo; visual only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub albedo: Option<AlbedoTexture>,
}

/// Portable decoded pixels, with dimensions and tile size independent of the
/// draped mesh. A texture is applied in the panel's material coordinates.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AlbedoTexture {
    pub width: u32,
    pub height: u32,
    #[serde(with = "shared_pixels")]
    pub rgba_srgb: Arc<[u8]>,
    /// Size of one repeated image, in material metres along U and V.
    pub tile_m: [f64; 2],
    pub rotation_degrees: f64,
}

impl PartialEq for AlbedoTexture {
    fn eq(&self, other: &Self) -> bool {
        self.width == other.width
            && self.height == other.height
            && self.tile_m == other.tile_m
            && self.rotation_degrees == other.rotation_degrees
            && (Arc::ptr_eq(&self.rgba_srgb, &other.rgba_srgb) || self.rgba_srgb == other.rgba_srgb)
    }
}

mod shared_pixels {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::sync::Arc;

    pub fn serialize<S: Serializer>(pixels: &Arc<[u8]>, serializer: S) -> Result<S::Ok, S::Error> {
        pixels.as_ref().serialize(serializer)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Arc<[u8]>, D::Error> {
        Vec::<u8>::deserialize(deserializer).map(Arc::from)
    }
}

impl AlbedoTexture {
    pub const MAX_DIMENSION: u32 = 256;

    pub fn validate(&self) -> Result<(), String> {
        self.validate_parameters()?;
        if self
            .rgba_srgb
            .as_chunks::<4>()
            .0
            .iter()
            .any(|p| p[3] != 255)
        {
            return Err("Albedo pixels must be opaque".into());
        }
        Ok(())
    }
    pub(crate) fn validate_parameters(&self) -> Result<(), String> {
        if self.width == 0
            || self.height == 0
            || self.width > Self::MAX_DIMENSION
            || self.height > Self::MAX_DIMENSION
            || self.rgba_srgb.len() != self.width as usize * self.height as usize * 4
            || self
                .tile_m
                .iter()
                .any(|v| !v.is_finite() || !(0.001..=100.0).contains(v))
            || !self.rotation_degrees.is_finite()
            || self.rotation_degrees.abs() > 360_000.0
        {
            return Err("Albedo requires opaque RGBA pixels up to 256×256, tile size 0.001–100 m, and finite rotation".into());
        }
        Ok(())
    }

    /// Map local panel material coordinates in metres to repeating image UVs.
    /// The caller must validate this texture and the coordinate before use.
    pub fn material_uv(&self, uv: glam::DVec2) -> glam::DVec2 {
        (glam::DMat2::from_angle(self.rotation_degrees.to_radians()) * uv)
            / glam::DVec2::from_array(self.tile_m)
    }
}
impl Default for FabricAppearance {
    fn default() -> Self {
        Self {
            color_srgb: [232, 235, 240],
            roughness: 0.8,
            albedo: None,
        }
    }
}
impl FabricAppearance {
    pub fn validate(&self) -> Result<(), String> {
        if !self.roughness.is_finite() || !(0.0..=1.0).contains(&self.roughness) {
            return Err("Optical roughness must be finite and between 0 and 1".into());
        }
        if let Some(albedo) = &self.albedo {
            albedo.validate()?;
        }
        Ok(())
    }
    pub fn linear_color(&self) -> [f32; 3] {
        self.color_srgb.map(|v| {
            let s = f32::from(v) / 255.;
            if s <= 0.04045 {
                s / 12.92
            } else {
                ((s + 0.055) / 1.055).powf(2.4)
            }
        })
    }
}

/// Rebind current document optics to physical panel material slots without
/// modifying or rebuilding the compiled garment retained by the worker.
pub fn bind<'a>(
    template: &'a super::GarmentTemplate,
    garment: &super::CompiledGarment,
) -> Vec<Option<&'a FabricAppearance>> {
    let mut result = vec![None; garment.materials.len()];
    for panel in &garment.panels {
        if let Some(source) = template.panels.iter().find(|p| p.id == panel.id) {
            result[panel.material] = template.fabric_appearance.get(&source.fabric);
        }
    }
    result
}
