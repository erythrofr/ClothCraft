//! Read-only inspection of the actual static collision surface.
//! Indexed topology warnings are not intersection or containment certificates.
use super::SurfaceMesh;
use crate::{garment::CompiledGarment, model::State, vbd::VbdSolver};
use glam::DVec3;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};

#[derive(Clone, Debug)]
pub struct Report {
    /// Versioned, order-sensitive FNV-1a fingerprint; not a security hash.
    pub fingerprint: String,
    pub vertices: usize,
    pub used_vertices: usize,
    pub triangles: usize,
    /// Bounds of vertices referenced by triangles, in simulation metres.
    pub min: DVec3,
    pub max: DVec3,
    pub boundary_edges: usize,
    pub nonmanifold_edges: usize,
    pub inconsistent_two_face_edges: usize,
    /// Repeated index triples, ignoring permutation/orientation.
    pub duplicate_triangles: usize,
}

pub fn inspect(surface: &SurfaceMesh) -> Result<Report, String> {
    surface.validate()?;
    let mut hash = 0xcbf29ce484222325_u64;
    let mut append = |bytes: &[u8]| {
        for b in bytes {
            hash ^= u64::from(*b);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    };
    append(b"clothcraft-avatar-v1");
    append(&(surface.vertices.len() as u64).to_le_bytes());
    append(&(surface.triangles.len() as u64).to_le_bytes());
    for p in &surface.vertices {
        for v in p.to_array() {
            append(&v.to_le_bytes());
        }
    }
    let mut edges: BTreeMap<[usize; 2], (usize, i64)> = BTreeMap::new();
    let mut faces = BTreeSet::new();
    let mut duplicate_triangles = 0;
    let mut used = vec![false; surface.vertices.len()];
    for t in &surface.triangles {
        for &v in t {
            append(&(v as u64).to_le_bytes());
            used[v] = true;
        }
        let mut key = *t;
        key.sort_unstable();
        if !faces.insert(key) {
            duplicate_triangles += 1;
        }
        for i in 0..3 {
            let (a, b) = (t[i], t[(i + 1) % 3]);
            let edge = edges.entry([a.min(b), a.max(b)]).or_default();
            edge.0 += 1;
            edge.1 += if a < b { 1 } else { -1 };
        }
    }
    let mut min = DVec3::splat(f64::INFINITY);
    let mut max = DVec3::splat(f64::NEG_INFINITY);
    for (&p, &is_used) in surface.vertices.iter().zip(&used) {
        if is_used {
            min = min.min(p);
            max = max.max(p);
        }
    }
    if !(max - min).is_finite() {
        return Err("Avatar bounds exceed the finite diagnostic range".into());
    }
    Ok(Report {
        fingerprint: format!("avatar-v1-{hash:016x}"),
        vertices: surface.vertices.len(),
        used_vertices: used.iter().filter(|v| **v).count(),
        triangles: surface.triangles.len(),
        min,
        max,
        boundary_edges: edges.values().filter(|(count, _)| *count == 1).count(),
        nonmanifold_edges: edges.values().filter(|(count, _)| *count > 2).count(),
        inconsistent_two_face_edges: edges
            .values()
            .filter(|(count, direction)| *count == 2 && *direction != 0)
            .count(),
        duplicate_triangles,
    })
}

/// Run the existing VBD initialization gate in an independent solver instance.
/// Includes the production local sewing exclusions. Does not step, alter the
/// caller's state, warm its contact cache, certify avatar self-intersections or
/// establish global inside/outside containment.
pub fn check_vbd_initialization(
    garment: Arc<CompiledGarment>,
    avatar: &SurfaceMesh,
    state: &State,
) -> Result<(), String> {
    VbdSolver::new(garment, Some(avatar), state).map(|_| ())
}
