//! User-authored avatar landmarks and explicit measurement conventions.
//!
//! This standalone CPU contract is not yet part of FittingProject or the editor.
//! Points are in a caller-defined avatar frame, in metres, never mesh indices.
//! The caller must advance the frame revision after geometry, pose or coordinate
//! changes and reconfirm landmarks. Visual and collision asset IDs are metadata;
//! this module does not load either mesh or infer anatomy from a collider.
//! A polyline measures only its supplied straight segments, not a surface
//! geodesic or an anatomically certified circumference. No clothing size is inferred.
use glam::DVec3;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LengthUnit {
    Metres,
}

/// Identity of the coordinate frame in which the landmarks were authored.
/// Revision is controlled by the caller, not inferred from vertex counts.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AvatarFrame {
    pub avatar_id: String,
    pub revision: u64,
}

/// These references may identify the same asset, but neither role substitutes
/// for the other. Changing a collider alone does not change a body measurement.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeshRoles {
    pub visible_asset: String,
    pub collision_asset: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Landmark {
    pub id: String,
    pub position_m: DVec3,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum MeasurementPath {
    Distance {
        from: String,
        to: String,
    },
    /// Ordered samples. For a closed path the last-to-first segment is implicit;
    /// do not repeat the first landmark in the list.
    Polyline {
        landmarks: Vec<String>,
        closed: bool,
    },
}

impl MeasurementPath {
    fn references(&self) -> Vec<&str> {
        match self {
            Self::Distance { from, to } => vec![from, to],
            Self::Polyline { landmarks, .. } => landmarks.iter().map(String::as_str).collect(),
        }
    }

    fn closed(&self) -> bool {
        matches!(self, Self::Polyline { closed: true, .. })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Convention {
    /// User-visible definition including pose, anatomical placement and path
    /// interpretation. A label such as "waist" alone cannot establish these.
    pub description: String,
    /// Explicit caller/user acknowledgement; never defaulted to true on import.
    pub confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Measurement {
    pub id: String,
    pub convention: Convention,
    pub path: MeasurementPath,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AvatarMeasurements {
    pub version: u32,
    pub units: LengthUnit,
    pub frame: AvatarFrame,
    pub meshes: MeshRoles,
    pub landmarks: Vec<Landmark>,
    pub measurements: Vec<Measurement>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeasuredLength {
    /// Preserve the exact path and convention alongside the value.
    pub definition: Measurement,
    pub length_m: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MeasurementReport {
    pub version: u32,
    pub units: LengthUnit,
    pub frame: AvatarFrame,
    pub values: Vec<MeasuredLength>,
}

fn identifier(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}

impl AvatarMeasurements {
    /// Validate a draft, including unconfirmed conventions. Duplicate IDs and
    /// missing references are errors, not first-match or nearest-point guesses.
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 1 {
            return Err("Unsupported avatar measurement version".into());
        }
        if !identifier(&self.frame.avatar_id)
            || !identifier(&self.meshes.visible_asset)
            || self
                .meshes
                .collision_asset
                .as_deref()
                .is_some_and(|id| !identifier(id))
        {
            return Err("Invalid avatar or mesh asset ID".into());
        }
        let mut landmarks = BTreeMap::new();
        for point in &self.landmarks {
            if !identifier(&point.id) || !point.position_m.is_finite() {
                return Err(format!("Invalid landmark {}", point.id));
            }
            if landmarks
                .insert(point.id.as_str(), point.position_m)
                .is_some()
            {
                return Err(format!("Duplicate landmark {}", point.id));
            }
        }
        let mut ids = BTreeSet::new();
        for measurement in &self.measurements {
            if !identifier(&measurement.id) || !ids.insert(&measurement.id) {
                return Err(format!(
                    "Invalid or duplicate measurement {}",
                    measurement.id
                ));
            }
            let description = &measurement.convention.description;
            if description.trim().is_empty()
                || description.chars().count() > 2000
                || description.chars().any(|c| c.is_control() && c != '\n')
            {
                return Err(format!(
                    "Missing or invalid convention for {}",
                    measurement.id
                ));
            }
            let refs = measurement.path.references();
            let minimum = if measurement.path.closed() { 3 } else { 2 };
            if refs.len() < minimum {
                return Err(format!("Too few landmarks for {}", measurement.id));
            }
            let mut seen = BTreeSet::new();
            for id in &refs {
                if !landmarks.contains_key(id) {
                    return Err(format!("Missing landmark {id} for {}", measurement.id));
                }
                if !seen.insert(id) {
                    return Err(format!("Repeated landmark {id} for {}", measurement.id));
                }
            }
            // Compute here as well to reject zero segments and overflow in drafts.
            path_length(&measurement.path, &landmarks)?;
        }
        Ok(())
    }

    pub fn from_json(json: &str) -> Result<Self, String> {
        let document: Self = serde_json::from_str(json).map_err(|e| e.to_string())?;
        document.validate()?;
        Ok(document)
    }

    pub fn to_json(&self) -> Result<String, String> {
        self.validate()?;
        serde_json::to_string_pretty(self).map_err(|e| e.to_string())
    }

    /// All-or-nothing report. The live frame must match and every convention
    /// must be explicitly confirmed. No stale or partially guessed measurements.
    pub fn evaluate(&self, live_frame: &AvatarFrame) -> Result<MeasurementReport, String> {
        self.validate()?;
        if &self.frame != live_frame {
            return Err("Avatar measurement frame is stale or belongs to another avatar".into());
        }
        let landmarks = self
            .landmarks
            .iter()
            .map(|p| (p.id.as_str(), p.position_m))
            .collect();
        let mut values = Vec::with_capacity(self.measurements.len());
        for measurement in &self.measurements {
            if !measurement.convention.confirmed {
                return Err(format!("Unconfirmed convention for {}", measurement.id));
            }
            values.push(MeasuredLength {
                definition: measurement.clone(),
                length_m: path_length(&measurement.path, &landmarks)?,
            });
        }
        Ok(MeasurementReport {
            version: 1,
            units: LengthUnit::Metres,
            frame: self.frame.clone(),
            values,
        })
    }
}

fn path_length(path: &MeasurementPath, landmarks: &BTreeMap<&str, DVec3>) -> Result<f64, String> {
    let refs = path.references();
    let mut length = 0.;
    let count = refs.len() - usize::from(!path.closed());
    for i in 0..count {
        let a = landmarks[refs[i]];
        let b = landmarks[refs[(i + 1) % refs.len()]];
        let delta = b - a;
        // hypot avoids premature square overflow, while rejecting a non-finite
        // subtraction or total. Coincident consecutive points are ambiguous.
        let segment = delta.x.hypot(delta.y).hypot(delta.z);
        if !segment.is_finite() || segment <= 0. {
            return Err("Measurement has a non-finite or zero-length segment".into());
        }
        length += segment;
    }
    if !length.is_finite() {
        return Err("Measurement length overflow".into());
    }
    Ok(length)
}
