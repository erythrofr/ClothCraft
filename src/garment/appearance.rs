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
    // JSON-only RGBA transport. Padding validation follows the existing
    // glTF data-URI decoder; keep their canonical rules aligned.
    use serde::{
        Deserializer, Serialize, Serializer,
        de::{Error, SeqAccess, Visitor},
        ser::Error as _,
    };
    use std::fmt;
    use std::sync::Arc;

    pub fn serialize<S: Serializer>(pixels: &Arc<[u8]>, serializer: S) -> Result<S::Ok, S::Error> {
        let limit = super::AlbedoTexture::MAX_DIMENSION as usize
            * super::AlbedoTexture::MAX_DIMENSION as usize
            * 4;
        if pixels.len() > limit {
            return Err(S::Error::custom("Albedo pixel array exceeds its limit"));
        }
        const DIGITS: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut encoded = String::with_capacity(pixels.len().div_ceil(3) * 4);
        for chunk in pixels.chunks(3) {
            let a = chunk[0];
            let b = chunk.get(1).copied().unwrap_or(0);
            let c = chunk.get(2).copied().unwrap_or(0);
            encoded.push(DIGITS[(a >> 2) as usize] as char);
            encoded.push(DIGITS[(((a & 3) << 4) | (b >> 4)) as usize] as char);
            encoded.push(if chunk.len() >= 2 {
                DIGITS[(((b & 15) << 2) | (c >> 6)) as usize] as char
            } else {
                '='
            });
            encoded.push(if chunk.len() == 3 {
                DIGITS[(c & 63) as usize] as char
            } else {
                '='
            });
        }
        encoded.serialize(serializer)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Arc<[u8]>, D::Error> {
        struct Pixels;
        impl<'de> Visitor<'de> for Pixels {
            type Value = Arc<[u8]>;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("bounded base64 RGBA bytes or a legacy byte array")
            }
            fn visit_str<E: Error>(self, value: &str) -> Result<Self::Value, E> {
                fn digit<E: Error>(b: u8) -> Result<u8, E> {
                    match b {
                        b'A'..=b'Z' => Ok(b - b'A'),
                        b'a'..=b'z' => Ok(b - b'a' + 26),
                        b'0'..=b'9' => Ok(b - b'0' + 52),
                        b'+' => Ok(62),
                        b'/' => Ok(63),
                        _ => Err(E::custom("Invalid albedo base64 character")),
                    }
                }
                let bytes = value.as_bytes();
                let limit = super::AlbedoTexture::MAX_DIMENSION as usize
                    * super::AlbedoTexture::MAX_DIMENSION as usize
                    * 4;
                if !bytes.len().is_multiple_of(4) || bytes.len() > limit.div_ceil(3) * 4 {
                    return Err(E::custom("Invalid or oversized albedo base64"));
                }
                let padding = bytes.iter().rev().take_while(|b| **b == b'=').count();
                if padding > 2 {
                    return Err(E::custom("Invalid albedo base64 padding"));
                }
                let length = (bytes.len() / 4) * 3 - padding;
                if length > limit {
                    return Err(E::custom("Albedo pixel array exceeds its limit"));
                }
                let mut pixels = Vec::with_capacity(length);
                let chunks = bytes.as_chunks::<4>().0;
                for (index, chunk) in chunks.iter().enumerate() {
                    let pad = if index + 1 == chunks.len() {
                        padding
                    } else {
                        0
                    };
                    let a = digit::<E>(chunk[0])?;
                    let b = digit::<E>(chunk[1])?;
                    let c = if pad == 2 { 0 } else { digit::<E>(chunk[2])? };
                    let d = if pad != 0 { 0 } else { digit::<E>(chunk[3])? };
                    if (pad == 2 && b & 15 != 0) || (pad == 1 && c & 3 != 0) {
                        return Err(E::custom("Nonzero albedo base64 padding bits"));
                    }
                    pixels.push((a << 2) | (b >> 4));
                    if pad < 2 {
                        pixels.push((b << 4) | (c >> 2));
                    }
                    if pad == 0 {
                        pixels.push((c << 6) | d);
                    }
                }
                Ok(Arc::from(pixels))
            }
            fn visit_seq<A: SeqAccess<'de>>(
                self,
                mut sequence: A,
            ) -> Result<Self::Value, A::Error> {
                let limit = super::AlbedoTexture::MAX_DIMENSION as usize
                    * super::AlbedoTexture::MAX_DIMENSION as usize
                    * 4;
                if sequence.size_hint().is_some_and(|n| n > limit) {
                    return Err(A::Error::custom("Albedo pixel array exceeds its limit"));
                }
                let mut pixels = Vec::with_capacity(sequence.size_hint().unwrap_or(0).min(limit));
                while let Some(pixel) = sequence.next_element::<u8>()? {
                    if pixels.len() == limit {
                        return Err(A::Error::custom("Albedo pixel array exceeds its limit"));
                    }
                    if pixels.len() == pixels.capacity() {
                        let additional = pixels.len().max(8).min(limit - pixels.len());
                        pixels.reserve_exact(additional);
                    }
                    pixels.push(pixel);
                }
                Ok(Arc::from(pixels))
            }
        }
        deserializer.deserialize_any(Pixels)
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
