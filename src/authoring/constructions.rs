//! Numeric drafting in a single material-space coordinate frame, in metres.
//!
//! Lines are infinite: projections and signed distances are not clamped to
//! endpoints. Results are previews, not document edits. Callers must commit
//! through the existing authoring transaction to validate the resulting shape.
//!
//! ```
//! use glam::DVec2;
//! use marvelous_cloth::authoring::constructions::Line;
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // A 25 mm construction from the beginning of a horizontal pattern edge.
//! let edge = Line::through(DVec2::ZERO, DVec2::new(0.3, 0.0))?;
//! let mark = edge.point_at_distance_m(0.025)?;
//! assert_eq!(mark, DVec2::new(0.025, 0.0));
//! # Ok(())
//! # }
//! ```
//!
//! These f64 constructions are not exact-arithmetic predicates. The caller
//! chooses the coordinate frame; mixing panel-local and board coordinates is
//! invalid. There is no UI, snapping, persistent geometry or solver dependency.
use glam::DVec2;

/// Ill-conditioned intersections are rejected rather than producing distant
/// points from nearly parallel directions. This is an angular sine threshold,
/// independent of the length unit and the endpoint spacing.
pub const MIN_INTERSECTION_SINE: f64 = 1e-12;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConstructionError {
    NonFiniteInput,
    DegenerateLine,
    ParallelOrIllConditioned,
    NonFiniteResult,
}

impl std::fmt::Display for ConstructionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::NonFiniteInput => "Construction inputs must be finite",
            Self::DegenerateLine => "A line requires two distinct points",
            Self::ParallelOrIllConditioned => "Lines are parallel or too nearly parallel",
            Self::NonFiniteResult => "Construction exceeds the numeric coordinate range",
        })
    }
}
impl std::error::Error for ConstructionError {}

/// A directed infinite line from `start` toward `end`, both in metres.
#[derive(Debug, Clone, Copy)]
pub struct Line {
    origin: DVec2,
    direction: DVec2,
}

impl Line {
    pub fn through(start: DVec2, end: DVec2) -> Result<Self, ConstructionError> {
        if !start.is_finite() || !end.is_finite() {
            return Err(ConstructionError::NonFiniteInput);
        }
        let delta = checked(end - start)?;
        // Scale before normalizing to avoid squared-length overflow/underflow.
        let scale = delta.abs().max_element();
        if scale == 0.0 {
            return Err(ConstructionError::DegenerateLine);
        }
        let scaled = delta / scale;
        Ok(Self {
            origin: start,
            direction: scaled / scaled.length(),
        })
    }

    /// Signed distance in metres from the first endpoint toward the second.
    /// Negative distances extend the line behind its origin.
    pub fn point_at_distance_m(self, distance_m: f64) -> Result<DVec2, ConstructionError> {
        if !distance_m.is_finite() {
            return Err(ConstructionError::NonFiniteInput);
        }
        checked(self.origin + self.direction * distance_m)
    }

    /// Orthogonal projection onto the infinite line, without endpoint clamping.
    pub fn project(self, point: DVec2) -> Result<DVec2, ConstructionError> {
        if !point.is_finite() {
            return Err(ConstructionError::NonFiniteInput);
        }
        let offset = checked(point - self.origin)?;
        let distance = offset.dot(self.direction);
        if !distance.is_finite() {
            return Err(ConstructionError::NonFiniteResult);
        }
        checked(self.origin + self.direction * distance)
    }

    /// Unique intersection of infinite lines. Coincident lines are rejected
    /// with parallel lines because neither has a unique intersection point.
    pub fn intersection(self, other: Self) -> Result<DVec2, ConstructionError> {
        let determinant = self.direction.perp_dot(other.direction);
        if determinant.abs() <= MIN_INTERSECTION_SINE {
            return Err(ConstructionError::ParallelOrIllConditioned);
        }
        let offset = checked(other.origin - self.origin)?;
        let distance = offset.perp_dot(other.direction) / determinant;
        if !distance.is_finite() {
            return Err(ConstructionError::NonFiniteResult);
        }
        checked(self.origin + self.direction * distance)
    }
}

fn checked(point: DVec2) -> Result<DVec2, ConstructionError> {
    if point.is_finite() {
        Ok(point)
    } else {
        Err(ConstructionError::NonFiniteResult)
    }
}
