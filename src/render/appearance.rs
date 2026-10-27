//! Viewport presentation only. These values never affect physical contact.
use serde::{Deserialize, Serialize};

/// Illustrative world-space light rig; gains are relative to the original renderer.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Lighting {
    pub yaw_degrees: f32,
    pub tilt_degrees: f32,
    pub ambient: f32,
    pub key: f32,
}
impl Default for Lighting {
    fn default() -> Self {
        Self {
            yaw_degrees: 0.,
            tilt_degrees: 0.,
            ambient: 1.,
            key: 1.,
        }
    }
}
impl Lighting {
    pub fn valid(&self) -> bool {
        [self.yaw_degrees, self.tilt_degrees, self.ambient, self.key]
            .iter()
            .all(|x| x.is_finite())
            && (-180. ..=180.).contains(&self.yaw_degrees)
            && (-90. ..=90.).contains(&self.tilt_degrees)
            && (0. ..=2.).contains(&self.ambient)
            && (0. ..=2.).contains(&self.key)
    }
    pub fn sanitize(&mut self) {
        for (value, fallback, min, max) in [
            (&mut self.yaw_degrees, 0., -180., 180.),
            (&mut self.tilt_degrees, 0., -90., 90.),
            (&mut self.ambient, 1., 0., 2.),
            (&mut self.key, 1., 0., 2.),
        ] {
            *value = if value.is_finite() {
                value.clamp(min, max)
            } else {
                fallback
            };
        }
    }
    /// Two vec4 slots following projection and eye in the WGSL View uniform.
    pub fn uniform(&self) -> [f32; 8] {
        let mut safe = *self;
        safe.sanitize();
        let direction = glam::Quat::from_rotation_y(safe.yaw_degrees.to_radians())
            * glam::Quat::from_rotation_x(safe.tilt_degrees.to_radians())
            * glam::Vec3::new(0.4, 0.8, 0.6);
        [
            direction.x,
            direction.y,
            direction.z,
            safe.key,
            safe.ambient,
            0.,
            0.,
            0.,
        ]
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AntiAliasing {
    Off,
    #[default]
    Msaa4,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Appearance {
    pub lighting: Lighting,
    pub anti_aliasing: AntiAliasing,
    pub gradient: bool,
    pub top: [u8; 3],
    pub bottom: [u8; 3],
    pub floor_color: [u8; 3],
    pub floor: bool,
    pub grid: bool,
    pub shadow: bool,
    pub shadow_opacity: f32,
}
impl Default for Appearance {
    fn default() -> Self {
        Self {
            lighting: Lighting::default(),
            anti_aliasing: AntiAliasing::Msaa4,
            gradient: true,
            top: [60, 67, 78],
            bottom: [116, 126, 140],
            floor_color: [98, 107, 119],
            floor: true,
            grid: true,
            shadow: true,
            shadow_opacity: 0.3,
        }
    }
}
impl Appearance {
    pub fn sanitize(&mut self) {
        self.lighting.sanitize();
        self.shadow_opacity = if self.shadow_opacity.is_finite() {
            self.shadow_opacity.clamp(0., 0.8)
        } else {
            0.3
        };
    }
    pub fn samples(&self, supports_msaa4: bool) -> u32 {
        if self.anti_aliasing == AntiAliasing::Msaa4 && supports_msaa4 {
            4
        } else {
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lighting_preserves_default_direction_and_rotates_without_degeneracy() {
        let light = Lighting::default();
        assert_eq!(light.uniform(), [0.4, 0.8, 0.6, 1., 1., 0., 0., 0.]);
        for yaw in [-180., -90., 0., 90., 180.] {
            for tilt in [-90., 0., 90.] {
                let u = Lighting {
                    yaw_degrees: yaw,
                    tilt_degrees: tilt,
                    ..light
                }
                .uniform();
                assert!((u[0] * u[0] + u[1] * u[1] + u[2] * u[2] - 1.16).abs() < 1e-5);
            }
        }
        let u = Lighting {
            yaw_degrees: 90.,
            ..light
        }
        .uniform();
        assert!((u[0] - 0.6).abs() < 1e-6 && (u[2] + 0.4).abs() < 1e-6);
        let mut invalid = Lighting {
            yaw_degrees: f32::NAN,
            tilt_degrees: 200.,
            ambient: -1.,
            key: f32::INFINITY,
        };
        assert!(!invalid.valid());
        invalid.sanitize();
        assert!(invalid.valid());
        assert_eq!(
            (
                invalid.yaw_degrees,
                invalid.tilt_degrees,
                invalid.ambient,
                invalid.key
            ),
            (0., 90., 0., 1.)
        );
    }
    #[test]
    fn old_preferences_default_and_msaa_fallback_are_defined() {
        let mut settings: Appearance = serde_json::from_str("{\"floor\":false}").unwrap();
        assert!(!settings.floor);
        assert_eq!(settings.samples(true), 4);
        assert_eq!(settings.samples(false), 1);
        settings.anti_aliasing = AntiAliasing::Off;
        assert_eq!(settings.samples(true), 1);
        settings.shadow_opacity = f32::NAN;
        settings.sanitize();
        assert_eq!(settings.shadow_opacity, 0.3);
    }
}
