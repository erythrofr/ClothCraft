//! Authored optical properties. These never calibrate or modify cloth mechanics.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FabricAppearance {
    /// Display sRGB bytes. Rendering decodes these before optical shading.
    pub color_srgb: [u8; 3],
    /// Dimensionless perceptual roughness, in [0, 1].
    pub roughness: f64,
    /// Display texture multiplied over the colour in the 3D view. Display only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub texture: Option<FabricTexture>,
}
impl Default for FabricAppearance {
    fn default() -> Self {
        Self {
            color_srgb: [232, 235, 240],
            roughness: 0.8,
            texture: None,
        }
    }
}
impl FabricAppearance {
    pub fn validate(&self) -> Result<(), String> {
        if !self.roughness.is_finite() || !(0.0..=1.0).contains(&self.roughness) {
            return Err("Optical roughness must be finite and between 0 and 1".into());
        }
        if let Some(texture) = &self.texture {
            texture.validate()?;
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

/// A display texture repeated over the fabric. It multiplies the colour, so a white
/// colour shows the texture as it is. It never changes the mechanics.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FabricTexture {
    /// A built-in tile, repeating every `repeat_mm` millimetres of fabric.
    Pattern {
        pattern: PatternKind,
        repeat_mm: f64,
    },
    /// An image tile stored as PNG bytes in hex, repeating every `repeat_mm`.
    /// The image is stretched to a square when it is imported.
    Image {
        name: String,
        png_hex: String,
        repeat_mm: f64,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PatternKind {
    Weave,
    Checker,
    Stripes,
    Dots,
}

impl PatternKind {
    pub const ALL: [Self; 4] = [Self::Weave, Self::Checker, Self::Stripes, Self::Dots];
    pub fn label(self) -> &'static str {
        match self {
            Self::Weave => "Weave (3x3)",
            Self::Checker => "Checker",
            Self::Stripes => "Stripes",
            Self::Dots => "Dots",
        }
    }
}

impl FabricTexture {
    /// Size of one repeat, in metres of fabric.
    pub fn repeat_m(&self) -> f64 {
        match self {
            Self::Pattern { repeat_mm, .. } | Self::Image { repeat_mm, .. } => repeat_mm / 1000.,
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        let repeat = match self {
            Self::Pattern { repeat_mm, .. } | Self::Image { repeat_mm, .. } => *repeat_mm,
        };
        if !repeat.is_finite() || !(0.5..=1000.).contains(&repeat) {
            return Err("Texture repeat must be between 0.5 and 1000 mm".into());
        }
        if let Self::Image { png_hex, .. } = self
            && hex_bytes(png_hex).is_none()
        {
            return Err("Texture image is not valid hex-encoded PNG data".into());
        }
        Ok(())
    }
}

/// Lowercase hex of `bytes`, two digits per byte.
pub fn to_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
            let _ = write!(s, "{b:02x}");
            s
        })
}

/// Bytes from hex text, or `None` when it has an odd length or a non-hex digit.
pub fn hex_bytes(text: &str) -> Option<Vec<u8>> {
    if !text.len().is_multiple_of(2) || !text.is_ascii() {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&text[i..i + 2], 16).ok())
        .collect()
}

/// Rebind current document optics to physical panel material slots without
/// modifying or rebuilding the compiled garment retained by the worker.
pub fn bind(
    template: &super::GarmentTemplate,
    garment: &super::CompiledGarment,
) -> Vec<Option<FabricAppearance>> {
    let mut result = vec![None; garment.materials.len()];
    for panel in &garment.panels {
        if let Some(source) = template.panels.iter().find(|p| p.id == panel.id) {
            result[panel.material] = template.fabric_appearance.get(&source.fabric).cloned();
        }
    }
    result
}
