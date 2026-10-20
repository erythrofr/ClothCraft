//! CPU f64 Vertex Block Descent with OGC trust regions. Exact local gradients
//! and Hessians, positive local solve + objective-checked steps. No XPBD.
use crate::{
    avatar::SurfaceMesh,
    energy,
    garment::CompiledGarment,
    math::{Jet, Scalar},
    model::State,
    ogc::{ContactSet, OgcSettings, OgcWorld},
};
use glam::{DMat3, DVec3};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, sync::Arc, time::Instant};
mod coloring;
mod prediction;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct VbdSettings {
    pub dt: f64,
    pub iterations: usize,
    pub damping: f64,
    pub gravity: DVec3,
    pub contact: OgcSettings,
}
impl Default for VbdSettings {
    fn default() -> Self {
        Self {
            dt: 1.0 / 240.0,
            iterations: 16,
            damping: 1.5,
            gravity: DVec3::new(0.0, -9.81, 0.0),
            contact: Default::default(),
        }
    }
}
impl VbdSettings {
    pub fn validate(&self) -> Result<(), String> {
        self.contact.validate()?;
        if !self.dt.is_finite()
            || !(1e-6..=0.025).contains(&self.dt)
            || self.iterations == 0
            || self.iterations > 200
            || !self.damping.is_finite()
            || self.damping < 0.0
            || !self.gravity.is_finite()
        {
            return Err("Invalid VBD settings".into());
        }
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct Grab {
    pub vertices: [usize; 3],
    pub weights: [f64; 3],
    pub target: DVec3,
    pub stiffness: f64,
}
#[derive(Clone, Debug, Default, Serialize)]
pub struct VbdMetrics {
    pub time_s: f64,
    pub dt_s: f64,
    pub step_ms: f64,
    pub detection_ms: f64,
    pub contact_profile: crate::ogc::DetectionProfile,
    pub solve_ms: f64,
    /// Hardware timestamps; absent for CPU or unsupported timestamp queries.
    pub gpu_compute_ms: Option<f64>,
    pub iterations: usize,
    pub contacts: usize,
    /// Retained nearby interactions, including currently inactive potentials.
    pub contact_terms: usize,
    pub detection_updates: usize,
    pub broad_phase_rebuilds: usize,
    pub truncated_vertices: usize,
    /// Final accepted-position feature separation within the contact search
    /// radius, clamped by that radius; not an independent penetration audit.
    pub minimum_distance_m: f64,
    pub max_seam_gap_m: f64,
    pub extension_p95_percent: f64,
    pub extension_max_percent: f64,
    /// RMS unconstrained energy gradient of the accepted final positions,
    /// excluding pins. Not a trust-region KKT or physical-fit certificate.
    pub residual_rms_n: Option<f64>,
}
#[derive(Clone)]
struct Stitch {
    terms: Vec<(usize, f64)>,
    stiffness: f64,
}
#[derive(Clone)]
pub struct VbdSolver {
    pub(crate) prediction: prediction::Prediction,
    pub garment: Arc<CompiledGarment>,
    pub world: OgcWorld,
    triangles: Vec<Vec<usize>>,
    hinges: Vec<Vec<usize>>,
    stitches: Vec<Stitch>,
    vertex_stitches: Vec<Vec<usize>>,
    graph: Vec<Vec<usize>>,
}
impl VbdSolver {
    pub fn new(
        garment: Arc<CompiledGarment>,
        avatar: Option<&SurfaceMesh>,
        state: &State,
    ) -> Result<Self, String> {
        let n = garment.mesh.uv.len();
        if state.x.len() != n || state.v.len() != n {
            return Err("VBD state dimensions do not match garment".into());
        }
        if garment
            .mesh
            .pins
            .iter()
            .enumerate()
            .any(|(i, p)| p.is_some_and(|p| state.x[i].distance(p) > 1e-10))
        {
            return Err(
                "VBD pinned positions must match their constraints before initialization".into(),
            );
        }
        let mut x = state.x.clone();
        let mut faces: Vec<_> = garment.mesh.triangles.iter().map(|t| t.vertices).collect();
        if let Some(a) = avatar {
            a.validate()?;
            x.extend_from_slice(&a.vertices);
            faces.extend(a.triangles.iter().map(|t| t.map(|i| i + n)));
        }
        let mut excluded = BTreeSet::new();
        let mut stitches = Vec::new();
        for seam in &garment.seams {
            for sample in &seam.samples {
                for (a, wa) in &sample.point.terms {
                    for (b, wb) in &sample.point.terms {
                        if wa * wb < 0.0 {
                            excluded.insert([(*a).min(*b), (*a).max(*b)]);
                        }
                    }
                }
                stitches.push(Stitch {
                    terms: sample.point.terms.clone(),
                    stiffness: seam.stiffness * sample.weight_m,
                });
            }
        }
        let mut world = OgcWorld::new(&x, faces, n, excluded)?;
        world.validate_start(&x)?;
        let mut triangles = vec![vec![]; n];
        let mut hinges = vec![vec![]; n];
        let mut vertex_stitches = vec![vec![]; n];
        let mut graph = vec![BTreeSet::new(); n];
        let mut connect = |ids: &[usize]| {
            for a in ids {
                for b in ids {
                    if a != b {
                        graph[*a].insert(*b);
                    }
                }
            }
        };
        for (i, t) in garment.mesh.triangles.iter().enumerate() {
            for v in t.vertices {
                triangles[v].push(i);
            }
            connect(&t.vertices);
        }
        for (i, h) in garment.mesh.hinges.iter().enumerate() {
            for v in h.vertices {
                hinges[v].push(i);
            }
            connect(&h.vertices);
        }
        for (i, s) in stitches.iter().enumerate() {
            let ids: Vec<_> = s.terms.iter().map(|(v, _)| *v).collect();
            for v in &ids {
                vertex_stitches[*v].push(i);
            }
            connect(&ids);
        }
        Ok(Self {
            prediction: Default::default(),
            garment,
            world,
            triangles,
            hinges,
            stitches,
            vertex_stitches,
            graph: graph
                .into_iter()
                .map(|neighbors| neighbors.into_iter().collect())
                .collect(),
        })
    }
    pub(crate) fn colors(&self, contact: &ContactSet, grab: Option<&Grab>) -> Vec<Vec<usize>> {
        coloring::colors(&self.graph, contact, grab)
    }
    pub(crate) fn local<S: Scalar>(
        &self,
        v: usize,
        p: [S; 3],
        x: &[DVec3],
        contact: &ContactSet,
        settings: &VbdSettings,
        grab: Option<&Grab>,
    ) -> S {
        let get = |i: usize| if i == v { p } else { x[i].to_array().map(S::c) };
        let mut value = S::c(0.0);
        for i in &self.triangles[v] {
            let t = &self.garment.mesh.triangles[*i];
            value = value
                + energy::membrane(t.vertices.map(get), t, &self.garment.materials[t.material]);
        }
        for i in &self.hinges[v] {
            let h = &self.garment.mesh.hinges[*i];
            value = value
                + energy::bending(h.vertices.map(get), h, &self.garment.materials[h.material]);
        }
        for i in &self.vertex_stitches[v] {
            let s = &self.stitches[*i];
            let mut d = [S::c(0.0); 3];
            for (j, w) in &s.terms {
                let q = get(*j);
                for k in 0..3 {
                    d[k] = d[k] + S::c(*w) * q[k];
                }
            }
            value = value + S::c(0.5 * s.stiffness) * crate::math::dot(d, d);
        }
        for i in &contact.incident[v] {
            let c = &contact.contacts[*i];
            value = value
                + c.energy(
                    c.vertices.map(get),
                    settings.contact.radius,
                    settings.contact.stiffness,
                );
        }
        if let Some(g) = grab.filter(|g| g.vertices.contains(&v)) {
            let mut d = g.target.to_array().map(|a| S::c(-a));
            for (j, w) in g.vertices.iter().zip(g.weights) {
                let q = get(*j);
                for k in 0..3 {
                    d[k] = d[k] + S::c(w) * q[k];
                }
            }
            value = value + S::c(0.5 * g.stiffness) * crate::math::dot(d, d);
        }
        value
    }
    /// State is committed only after a finite step. Fixed geometry never moves.
    pub fn step(
        &mut self,
        state: &mut State,
        settings: &VbdSettings,
        grab: Option<&Grab>,
    ) -> Result<VbdMetrics, String> {
        settings.validate()?;
        let n = self.garment.mesh.uv.len();
        if state.x.len() != n
            || state.v.len() != n
            || !state.time.is_finite()
            || state.x.iter().chain(&state.v).any(|v| !v.is_finite())
        {
            return Err("Invalid VBD state".into());
        }
        if let Some(g) = grab
            && (g.vertices.iter().any(|i| *i >= n)
                || !g.target.is_finite()
                || !g.stiffness.is_finite()
                || g.stiffness <= 0.0
                || g.weights.iter().any(|w| !w.is_finite() || *w < 0.0)
                || (g.weights.iter().sum::<f64>() - 1.0).abs() > 1e-8)
        {
            return Err("Invalid mouse attachment".into());
        }
        let start = Instant::now();
        let mut metrics = VbdMetrics {
            dt_s: settings.dt,
            iterations: settings.iterations,
            ..Default::default()
        };
        let dt = settings.dt;
        let old_velocity = state.v.clone();
        let guess = self.prediction.guess(state, settings);
        let damp = 1.0 + settings.damping * dt;
        let target: Vec<_> = state
            .x
            .iter()
            .zip(&state.v)
            .map(|(x, v)| *x + (*v * dt + settings.gravity * dt * dt) / damp)
            .collect();
        let inertia: Vec<_> = self
            .garment
            .mesh
            .masses
            .iter()
            .map(|m| m * damp / (dt * dt))
            .collect();
        let predicted_motion = target
            .iter()
            .zip(&state.x)
            .map(|(a, b)| a.distance(*b))
            .fold(0.0, f64::max);
        let rq = (settings.contact.radius + predicted_motion)
            .clamp(2.0 * settings.contact.radius, 4.0 * settings.contact.radius);
        let mut x = self.world.positions(&state.x);
        let detect = Instant::now();
        let mut contacts = self.world.detect(&x, rq, &settings.contact)?;
        if contacts.minimum_distance <= 1e-12 {
            return Err("OGC zero separation; step rejected, reset the arrangement".into());
        }
        metrics.detection_ms += detect.elapsed().as_secs_f64() * 1000.0;
        metrics.detection_updates += 1;
        metrics.broad_phase_rebuilds += usize::from(contacts.broad_phase_rebuilt);
        metrics.contact_profile += contacts.profile;
        let mut colors = self.colors(&contacts, grab);
        // Conservative warm start; no unbounded inertial prediction crosses a face.
        let mut clipped = 0;
        for i in 0..n {
            if self.garment.mesh.pins[i].is_none() {
                let (p, b) = contacts.truncate(i, guess[i]);
                x[i] = p;
                clipped += usize::from(b);
            }
        }
        for _ in 0..settings.iterations {
            if clipped > 0 && clipped as f64 >= settings.contact.refresh_fraction * n as f64 {
                let detect = Instant::now();
                contacts = self.world.detect(&x, rq, &settings.contact)?;
                colors = self.colors(&contacts, grab);
                metrics.detection_ms += detect.elapsed().as_secs_f64() * 1000.0;
                metrics.detection_updates += 1;
                metrics.broad_phase_rebuilds += usize::from(contacts.broad_phase_rebuilt);
                metrics.contact_profile += contacts.profile;
            }
            clipped = 0;
            for color in &colors {
                let updates: Vec<_> = color
                    .par_iter()
                    .map(|v| {
                        let v = *v;
                        if self.garment.mesh.pins[v].is_some() {
                            return (v, x[v], false);
                        }
                        let jet = self.local(
                            v,
                            std::array::from_fn(|k| Jet::<3>::variable(x[v][k], k)),
                            &x,
                            &contacts,
                            settings,
                            grab,
                        );
                        let g = DVec3::from_array(jet.g) + (x[v] - target[v]) * inertia[v];
                        let mut h = DMat3::from_cols_array(&std::array::from_fn::<_, 9, _>(|i| {
                            jet.h[i % 3][i / 3]
                        })) + DMat3::IDENTITY * inertia[v];
                        let diag = h.to_cols_array_2d();
                        let lower = (0..3)
                            .map(|i| {
                                diag[i][i]
                                    - (0..3)
                                        .filter(|j| *j != i)
                                        .map(|j| diag[i][j].abs())
                                        .sum::<f64>()
                            })
                            .fold(f64::INFINITY, f64::min);
                        // Gershgorin SPD shift is local, never changes the energy law.
                        if lower < 1e-8 {
                            h += DMat3::IDENTITY * (1e-8 - lower + 0.01 * inertia[v]);
                        }
                        let delta = -(h.inverse() * g);
                        let old = jet.v + 0.5 * inertia[v] * (x[v] - target[v]).length_squared();
                        let mut accepted = x[v];
                        let mut truncated = false;
                        for attempt in 0..10 {
                            let candidate = x[v] + delta * 0.5_f64.powi(attempt);
                            let (candidate, bound) = contacts.truncate(v, candidate);
                            truncated |= bound;
                            let e =
                                self.local(v, candidate.to_array(), &x, &contacts, settings, grab)
                                    + 0.5 * inertia[v] * (candidate - target[v]).length_squared();
                            if candidate.is_finite() && e.is_finite() && e <= old + 1e-14 {
                                accepted = candidate;
                                break;
                            }
                        }
                        (v, accepted, truncated)
                    })
                    .collect();
                for (v, p, c) in updates {
                    x[v] = p;
                    clipped += usize::from(c);
                }
            }
            metrics.truncated_vertices += clipped;
        }
        if x.iter().any(|v| !v.is_finite()) {
            return Err("Non-finite VBD result; state unchanged".into());
        }
        // Final bound feasibility is an invariant, not a post-Newton correction.
        if (0..n).any(|i| x[i].distance(contacts.centers[i]) > contacts.radii[i] + 1e-10) {
            return Err("OGC trust-region invariant failed".into());
        }
        // Detection during the minimization uses the previous configuration
        // and is periodically refreshed. Measurements for a completed step
        // must describe its *accepted* positions, including final contacts.
        // Do this before writing to State so an invalid geometry is rejected
        // transactionally. It also supplies the correct final contact gradient.
        let detect = Instant::now();
        let final_contacts = self.world.detect(&x, rq, &settings.contact)?;
        if final_contacts.minimum_distance <= 1e-12 {
            return Err("OGC final separation is zero; state unchanged".into());
        }
        metrics.detection_ms += detect.elapsed().as_secs_f64() * 1000.0;
        metrics.detection_updates += 1;
        metrics.broad_phase_rebuilds += usize::from(final_contacts.broad_phase_rebuilt);
        metrics.contact_profile += final_contacts.profile;
        // Report the gradient of the ACTUAL accepted state, rather than the
        // gradients sampled before sequential color updates. The previous
        // in-loop sum mixed different configurations and understated/overstated
        // stationarity depending on color ordering. Pinned DOFs do not enter
        // the unconstrained residual.
        let free = (0..n)
            .filter(|i| self.garment.mesh.pins[*i].is_none())
            .collect::<Vec<_>>();
        let residual_sq: f64 = free
            .par_iter()
            .map(|&v| {
                let gradient = self.local(
                    v,
                    std::array::from_fn(|k| Jet::<3>::variable(x[v][k], k)),
                    &x,
                    &final_contacts,
                    settings,
                    grab,
                );
                let g = DVec3::from_array(gradient.g) + (x[v] - target[v]) * inertia[v];
                g.length_squared()
            })
            .sum();
        metrics.residual_rms_n = Some(if free.is_empty() {
            0.0
        } else {
            (residual_sq / (3 * free.len()) as f64).sqrt()
        });
        for (i, position) in x.iter().take(n).enumerate() {
            state.v[i] = (*position - state.x[i]) / dt;
            state.x[i] = *position;
        }
        state.time += dt;
        self.prediction.record(&old_velocity, state, settings);
        metrics.time_s = state.time;
        metrics.contacts = final_contacts.active_contacts;
        metrics.contact_terms = final_contacts.contacts.len();
        metrics.minimum_distance_m = final_contacts.minimum_distance;
        metrics.max_seam_gap_m = self.garment.max_seam_gap(&state.x);
        [metrics.extension_p95_percent, metrics.extension_max_percent] =
            crate::garment::diagnostics::extension_percent(&self.garment, state);
        metrics.step_ms = start.elapsed().as_secs_f64() * 1000.0;
        metrics.solve_ms = metrics.step_ms - metrics.detection_ms;
        Ok(metrics)
    }
}
