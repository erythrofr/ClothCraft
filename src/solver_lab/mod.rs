//! Opt-in CPU research solvers. Never selected by the editor. See docs/solver-lab.md.
mod constraints;
pub mod contact_newton;
pub mod contact_qp;
pub mod contact_residual;
pub mod coupled_patch;
pub mod deforming_contact;
pub mod dense_contact;
pub mod discrete_contact;
mod dual;
mod primal;
use crate::{
    avatar::SurfaceMesh,
    garment::CompiledGarment,
    math::{Jet, Scalar},
    model::State,
    ogc::ContactSet,
    vbd::{Grab, VbdMetrics, VbdSettings, VbdSolver},
};
use constraints::{Constraint, Kind};
use dual::Dual;
use glam::{DMat3, DVec3};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Instant};

#[derive(Clone, Copy, Debug, Serialize, Deserialize, clap::ValueEnum)]
pub enum Algorithm {
    Vbd,
    Xpbd,
    AvbdFinite,
    /// Full primal residual, matrix-free Gauss-Newton/PCG; not sequential XPBD.
    XpbdPrimal,
    /// Finite AVBD curvature, bounded target ramp and coupled primal polishing.
    AvbdTarget,
}

/// Describes the finite-iteration material model, not a convergence guarantee.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StiffnessSchedule {
    Target,
    AdaptiveFinite,
    TargetCompletion,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResidualSampling {
    LastColorSweepAllVertices,
    FinalPrimalFreeVertices,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ContactMetricSampling {
    LastDetection,
    FinalDistanceLastDetectionCounts,
}

/// Versioned descriptive metadata for the existing CPU lab interface. No plugin
/// negotiation or editor promotion is implied. See docs/solver-adapter-contract.md.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct Capabilities {
    pub version: u32,
    pub id: &'static str,
    pub experimental: bool,
    pub execution: &'static str,
    pub target_material: &'static str,
    pub contact: &'static str,
    pub max_factor_vertices: usize,
    pub stiffness_schedule: StiffnessSchedule,
    pub residual_sampling: ResidualSampling,
    pub contact_metric_sampling: ContactMetricSampling,
    pub coulomb_friction: bool,
    pub animated_avatar: bool,
    pub portable_warm_start: bool,
}

impl Algorithm {
    /// Only names real stepping implementations. The production hybrid GPU
    /// solver, historical Newton and external Box3D harness are separate APIs.
    pub const fn capabilities(self) -> Capabilities {
        let (id, stiffness_schedule) = match self {
            Self::Vbd => ("vbd", StiffnessSchedule::Target),
            Self::Xpbd => ("xpbd", StiffnessSchedule::Target),
            Self::AvbdFinite => ("avbd-finite", StiffnessSchedule::AdaptiveFinite),
            Self::XpbdPrimal => ("xpbd-primal", StiffnessSchedule::Target),
            Self::AvbdTarget => ("avbd-target", StiffnessSchedule::TargetCompletion),
        };
        let control = matches!(self, Self::Vbd);
        Capabilities {
            version: 1,
            id,
            experimental: !control,
            execution: "cpu_f64",
            target_material: "orthotropic_membrane_normal_difference_bending_weighted_seams",
            contact: "ogc_surface_bounds_with_local_sewing_exclusions",
            max_factor_vertices: 4,
            stiffness_schedule,
            residual_sampling: if control {
                ResidualSampling::LastColorSweepAllVertices
            } else {
                ResidualSampling::FinalPrimalFreeVertices
            },
            contact_metric_sampling: if control {
                ContactMetricSampling::LastDetection
            } else {
                ContactMetricSampling::FinalDistanceLastDetectionCounts
            },
            coulomb_friction: false,
            animated_avatar: false,
            portable_warm_start: false,
        }
    }
}
/// Actual adapters, sharing compiled rest data, state and diagnostics. Switching
/// means a cold restart; no predictor, contact history or multiplier transfer.
pub struct Backend {
    algorithm: Algorithm,
    pub reference: VbdSolver,
    constraints: Vec<Constraint>,
    incident: Vec<Vec<usize>>,
    stiffness: Vec<f64>,
    trace_enabled: bool,
    pub trace: Vec<primal::SweepDiagnostic>,
    pub worst_refresh: Option<primal::RefreshEvent>,
}
impl Backend {
    pub const fn capabilities(&self) -> Capabilities {
        self.algorithm.capabilities()
    }
    /// Expensive per-sweep convergence evidence, off by default.
    pub fn trace_convergence(&mut self, enabled: bool) {
        self.trace_enabled = enabled;
    }
    pub fn new(
        algorithm: Algorithm,
        garment: Arc<CompiledGarment>,
        avatar: Option<&SurfaceMesh>,
        state: &State,
    ) -> Result<Self, String> {
        // Reject corrupt checkpoints before constructing contact/incidence caches.
        // VbdSolver validates dimensions and geometry but defers velocity/time
        // finiteness to step; the adapter's initialization contract is stricter.
        if !state.time.is_finite() || state.x.iter().chain(&state.v).any(|p| !p.is_finite()) {
            return Err("Lab checkpoint positions, velocities and time must be finite".into());
        }
        let reference = VbdSolver::new(garment, avatar, state)?;
        let constraints = constraints::compile(&reference.garment);
        if constraints
            .iter()
            .any(|c| c.ids.is_empty() || c.ids.len() > 4 || !c.k.is_finite() || c.k <= 0.)
        {
            return Err(
                "Lab constraints require 1..4 vertices and positive finite stiffness".into(),
            );
        }
        let mut incident = vec![vec![]; state.x.len()];
        for (j, c) in constraints.iter().enumerate() {
            for i in &c.ids {
                incident[*i].push(j);
            }
        }
        let stiffness = constraints.iter().map(|c| c.k * 0.1).collect();
        Ok(Self {
            algorithm,
            reference,
            constraints,
            incident,
            stiffness,
            trace_enabled: false,
            trace: Vec::new(),
            worst_refresh: None,
        })
    }
    pub fn step(
        &mut self,
        state: &mut State,
        s: &VbdSettings,
        grab: Option<&Grab>,
    ) -> Result<VbdMetrics, String> {
        if matches!(self.algorithm, Algorithm::Vbd) {
            return self.reference.step(state, s, grab);
        }
        s.validate()?;
        self.trace.clear();
        self.worst_refresh = None;
        let start = Instant::now();
        let g = &self.reference.garment;
        let n = g.mesh.masses.len();
        if state.x.len() != n
            || state.v.len() != n
            || !state.time.is_finite()
            || state.x.iter().chain(&state.v).any(|x| !x.is_finite())
        {
            return Err("Invalid lab state".into());
        }
        if let Some(b) = grab
            && (b.vertices.iter().any(|i| *i >= n)
                || !b.stiffness.is_finite()
                || b.stiffness <= 0.
                || !b.target.is_finite()
                || b.weights.iter().any(|w| !w.is_finite() || *w < 0.)
                || (b.weights.iter().sum::<f64>() - 1.).abs() > 1e-10
                || b.vertices[0] == b.vertices[1]
                || b.vertices[1] == b.vertices[2]
                || b.vertices[0] == b.vertices[2]
                || !b.valid_patch(n))
        {
            return Err("Invalid lab grab".into());
        }
        let damp = 1. + s.damping * s.dt;
        let inertia: Vec<_> = g
            .mesh
            .masses
            .iter()
            .map(|m| m * damp / s.dt.powi(2))
            .collect();
        let inverse: Vec<_> = inertia
            .iter()
            .enumerate()
            .map(|(i, k)| if g.mesh.pins[i].is_some() { 0. } else { 1. / k })
            .collect();
        let target: Vec<_> = state
            .x
            .iter()
            .zip(&state.v)
            .map(|(x, v)| *x + (*v * s.dt + s.gravity * s.dt.powi(2)) / damp)
            .collect();
        let rq = (s.contact.radius
            + target
                .iter()
                .zip(&state.x)
                .map(|(a, b)| a.distance(*b))
                .fold(0., f64::max))
        .clamp(2. * s.contact.radius, 4. * s.contact.radius);
        let mut x = self.reference.world.positions(&state.x);
        let mut metrics = VbdMetrics {
            dt_s: s.dt,
            iterations: s.iterations,
            ..Default::default()
        };
        let mut contacts = self.reference.world.detect(&x, rq, &s.contact)?;
        metrics.detection_ms = start.elapsed().as_secs_f64() * 1000.;
        if contacts.minimum_distance <= 1e-12 {
            return Err("Lab start has zero contact separation".into());
        }
        metrics.detection_updates = 1;
        let mut extra = Vec::new();
        if let Some(b) = grab {
            for axis in 0..3 {
                extra.push(Constraint {
                    ids: b.vertices.to_vec(),
                    k: b.point_stiffness(),
                    kind: Kind::Linear(b.weights.to_vec(), axis, b.target[axis]),
                });
            }
            for a in &b.patch {
                for axis in 0..3 {
                    extra.push(Constraint {
                        ids: vec![a.vertex],
                        k: b.patch_stiffness() * a.weight,
                        kind: Kind::Linear(vec![1.], axis, (b.target + a.offset)[axis]),
                    });
                }
            }
        }
        let mut lambda = vec![0.; self.constraints.len() + extra.len()];
        let mut contact_lambda = std::collections::BTreeMap::new();
        let mut clipped = 0;
        // XPBD starts at the inertial prediction, guarded by the same OGC regions.
        // This safety-limited prediction is deliberately reported as a hybrid.
        for i in 0..n {
            if inverse[i] > 0. && !matches!(self.algorithm, Algorithm::XpbdPrimal) {
                let (p, c) = contacts.truncate(i, target[i]);
                x[i] = p;
                clipped += usize::from(c);
            }
        }
        let mut stiffness = self.stiffness.clone();
        for (k, c) in stiffness.iter_mut().zip(&self.constraints) {
            *k = if matches!(
                self.algorithm,
                Algorithm::AvbdFinite | Algorithm::AvbdTarget
            ) {
                (*k * 0.99).max(0.1 * c.k)
            } else {
                c.k
            };
        }
        let initial_clipped = clipped;
        if self.trace_enabled {
            self.trace.push(primal::diagnostic(
                g,
                &self.constraints,
                &extra,
                &contacts,
                &x,
                &target,
                &inertia,
                &inverse,
                s,
                0,
                &stiffness,
                initial_clipped,
            )?);
        }
        for sweep in 0..s.iterations {
            let mut contact_refresh_delta = 0.;
            if clipped > 0 {
                // Conservative refresh, not a reduced-contact fast path.
                let now = Instant::now();
                let previous_contact_energy = if self.trace_enabled {
                    contacts
                        .contacts
                        .iter()
                        .map(|c| c.value(&x, s.contact.radius, s.contact.stiffness))
                        .sum::<f64>()
                } else {
                    0.
                };
                let refreshed = self.reference.world.detect(&x, rq, &s.contact)?;
                if self.trace_enabled {
                    contact_refresh_delta = refreshed
                        .contacts
                        .iter()
                        .map(|c| c.value(&x, s.contact.radius, s.contact.stiffness))
                        .sum::<f64>()
                        - previous_contact_energy;
                    if contact_refresh_delta.abs()
                        > self.worst_refresh.as_ref().map_or(0., |e| e.delta_j.abs())
                    {
                        self.worst_refresh = Some(primal::refresh_event(
                            &contacts,
                            &refreshed,
                            &x,
                            n,
                            &s.contact,
                            sweep + 1,
                            contact_refresh_delta,
                        ));
                    }
                }
                contacts = refreshed;
                metrics.detection_ms += now.elapsed().as_secs_f64() * 1000.;
                metrics.detection_updates += 1;
                if contacts.minimum_distance <= 1e-12 {
                    return Err("Lab contact separation lost; state unchanged".into());
                }
            }
            clipped = 0;
            match self.algorithm {
                Algorithm::XpbdPrimal => {
                    // Eliminating compliant multipliers from XPBD equations 8-12
                    // retains M(x-y), including when collision bounds clip x.
                    // Full-target energy line search; no material softening.
                    let system = primal::System::assemble(
                        g,
                        &self.constraints,
                        &extra,
                        &contacts,
                        &x,
                        &target,
                        &inertia,
                        &inverse,
                        s,
                    )?;
                    let (direction, _) = system.direction(&inertia, &inverse, 64, 1e-4)?;
                    clipped = primal::descend(
                        g,
                        &self.constraints,
                        &extra,
                        &contacts,
                        &mut x,
                        &target,
                        &inertia,
                        &inverse,
                        s,
                        &system,
                        direction,
                    )?;
                }
                Algorithm::Xpbd => {
                    for (j, c) in self.constraints.iter().chain(&extra).enumerate() {
                        let p: [[Dual<12>; 3]; 4] = std::array::from_fn(|a| {
                            std::array::from_fn(|k| {
                                Dual::<12>::variable(x[c.ids[a.min(c.ids.len() - 1)]][k], a * 3 + k)
                            })
                        });
                        let e = c.value(g, &p);
                        let gradients: [DVec3; 4] = std::array::from_fn(|i| {
                            DVec3::new(e.g[3 * i], e.g[3 * i + 1], e.g[3 * i + 2])
                        });
                        clipped += xpbd_update(
                            &mut x,
                            &contacts,
                            &inverse,
                            &c.ids,
                            &gradients[..c.ids.len()],
                            e.v,
                            1. / c.k,
                            &mut lambda[j],
                        )?;
                    }
                    // Contact energy is exactly the current OGC energy, factored as C=sqrt(2U).
                    // Keep multipliers by exact feature identity across conservative refreshes.
                    for contact in &contacts.contacts {
                        let p = std::array::from_fn(|a| {
                            std::array::from_fn(|k| {
                                Dual::<12>::variable(x[contact.vertices[a]][k], a * 3 + k)
                            })
                        });
                        let energy = contact.energy(p, s.contact.radius, s.contact.stiffness);
                        if energy.v <= 0. {
                            contact_lambda.remove(&(
                                contact.kind,
                                contact.vertices,
                                contact.mollifier_epsilon.to_bits(),
                            ));
                            continue;
                        }
                        let c = (energy * Dual::c(2.)).sqrt();
                        let ids = &contact.vertices[..contact.count];
                        let gradients: [DVec3; 4] = std::array::from_fn(|i| {
                            DVec3::new(c.g[3 * i], c.g[3 * i + 1], c.g[3 * i + 2])
                        });
                        let lambda = contact_lambda
                            .entry((
                                contact.kind,
                                contact.vertices,
                                contact.mollifier_epsilon.to_bits(),
                            ))
                            .or_insert(0.);
                        clipped += xpbd_update(
                            &mut x,
                            &contacts,
                            &inverse,
                            ids,
                            &gradients[..ids.len()],
                            c.v,
                            1.,
                            lambda,
                        )?;
                    }
                }
                Algorithm::AvbdFinite | Algorithm::AvbdTarget => {
                    if matches!(self.algorithm, Algorithm::AvbdTarget) {
                        // A continuation schedule, not a changed material law.
                        // At least the final 3/4 of sweeps use full stiffness.
                        let ramp = (s.iterations / 4).max(1);
                        let floor = ((sweep + 1) as f64 / ramp as f64).min(1.);
                        for (k, c) in stiffness.iter_mut().zip(&self.constraints) {
                            *k = k.max(floor * c.k);
                        }
                    }
                    for v in 0..n {
                        if inverse[v] == 0. {
                            continue;
                        }
                        let mut gradient = (x[v] - target[v]) * inertia[v];
                        let mut h = DMat3::from_diagonal(DVec3::splat(inertia[v]));
                        for (c, k) in self.incident[v]
                            .iter()
                            .map(|j| (&self.constraints[*j], stiffness[*j]))
                            .chain(
                                extra
                                    .iter()
                                    .filter(|c| c.ids.contains(&v))
                                    .map(|c| (c, c.k)),
                            )
                        {
                            let p: [[Jet<3>; 3]; 4] = std::array::from_fn(|slot| {
                                let i = c.ids[slot.min(c.ids.len() - 1)];
                                std::array::from_fn(|a| {
                                    if i == v {
                                        Jet::<3>::variable(x[i][a], a)
                                    } else {
                                        Jet::c(x[i][a])
                                    }
                                })
                            });
                            let q = c.value(g, &p);
                            let d = DVec3::from_array(q.g);
                            gradient += d * (k * q.v);
                            let curvature = DVec3::from_array(std::array::from_fn(|a| {
                                (0..3).map(|b| q.h[b][a].powi(2)).sum::<f64>().sqrt()
                                    * (k * q.v).abs()
                            }));
                            h += DMat3::from_cols(d * d.x, d * d.y, d * d.z) * k
                                + DMat3::from_diagonal(curvature);
                        }
                        for j in &contacts.incident[v] {
                            let (energy, d, hc) = contacts.contacts[*j].block(
                                &x,
                                v,
                                s.contact.radius,
                                s.contact.stiffness,
                            );
                            gradient += d;
                            if matches!(self.algorithm, Algorithm::AvbdTarget) {
                                h += contact_curvature(energy, d, hc);
                            } else {
                                // Historical isotropic approximation, retained as a control.
                                let norm =
                                    hc.to_cols_array().iter().map(|a| a * a).sum::<f64>().sqrt();
                                h += DMat3::from_diagonal(DVec3::splat(norm));
                            }
                        }
                        let delta = -(h.inverse() * gradient);
                        if !delta.is_finite() {
                            return Err("Non-finite AVBD local solve".into());
                        }
                        let before = local_energy(
                            g,
                            &self.constraints,
                            &self.incident[v],
                            &stiffness,
                            &extra,
                            &contacts,
                            &x,
                            v,
                            target[v],
                            inertia[v],
                            s,
                        );
                        let old = x[v];
                        let mut accepted = false;
                        for trial in 0..24 {
                            let (p, c) =
                                contacts.truncate_step(v, old, old + delta * 0.5_f64.powi(trial));
                            x[v] = p;
                            let e = local_energy(
                                g,
                                &self.constraints,
                                &self.incident[v],
                                &stiffness,
                                &extra,
                                &contacts,
                                &x,
                                v,
                                target[v],
                                inertia[v],
                                s,
                            );
                            if e.is_finite() && e <= before {
                                clipped += usize::from(c);
                                accepted = true;
                                break;
                            }
                        }
                        if !accepted {
                            x[v] = old;
                        }
                    }
                    // AVBD paper eq.16, finite stiffness only; no dual force for finite springs.
                    for (k, c) in stiffness.iter_mut().zip(&self.constraints) {
                        // Normalization scale: one metre for linear constraints, one for strain/normal.
                        *k = (*k + 10. * c.k * c.at(g, &x).abs()).min(c.k);
                    }
                    if matches!(self.algorithm, Algorithm::AvbdTarget)
                        && ((sweep + 1).is_multiple_of(4) || sweep + 1 == s.iterations)
                        && stiffness
                            .iter()
                            .zip(&self.constraints)
                            .all(|(k, c)| *k >= c.k)
                    {
                        // Local blocks propagate long-wavelength strain slowly.
                        // This independent hybrid uses a full-target coupled step
                        // every four sweeps, with the same objective and OGC guards.
                        let system = primal::System::assemble(
                            g,
                            &self.constraints,
                            &extra,
                            &contacts,
                            &x,
                            &target,
                            &inertia,
                            &inverse,
                            s,
                        )?;
                        let (direction, _) = system.direction(&inertia, &inverse, 64, 1e-4)?;
                        clipped += primal::descend(
                            g,
                            &self.constraints,
                            &extra,
                            &contacts,
                            &mut x,
                            &target,
                            &inertia,
                            &inverse,
                            s,
                            &system,
                            direction,
                        )?;
                    }
                }
                Algorithm::Vbd => unreachable!(),
            }
            metrics.truncated_vertices += clipped;
            if self.trace_enabled {
                self.trace.push(primal::diagnostic(
                    g,
                    &self.constraints,
                    &extra,
                    &contacts,
                    &x,
                    &target,
                    &inertia,
                    &inverse,
                    s,
                    sweep + 1,
                    &stiffness,
                    clipped,
                )?);
                self.trace.last_mut().unwrap().contact_refresh_delta_j = contact_refresh_delta;
            }
        }
        if (0..n).any(|i| !contacts.contains(i, x[i], 1e-10)) {
            return Err("Lab OGC region invariant failed; state unchanged".into());
        }
        // Audit with fresh geometry before committing, not a stale force norm.
        let now = Instant::now();
        let final_contacts = self.reference.world.detect(&x, rq, &s.contact)?;
        metrics.detection_ms += now.elapsed().as_secs_f64() * 1000.;
        metrics.detection_updates += 1;
        if final_contacts.minimum_distance <= 1e-12 {
            return Err("Lab final separation lost; state unchanged".into());
        }
        let final_system = primal::System::assemble(
            g,
            &self.constraints,
            &extra,
            &final_contacts,
            &x,
            &target,
            &inertia,
            &inverse,
            s,
        )?;
        metrics.residual_rms_n = Some(final_system.residual_rms(&inverse));
        for (i, p) in x.iter().take(n).enumerate() {
            state.v[i] = (*p - state.x[i]) / s.dt;
            state.x[i] = *p;
        }
        state.time += s.dt;
        self.stiffness = stiffness;
        metrics.time_s = state.time;
        metrics.contacts = contacts.active_contacts;
        metrics.contact_terms = contacts.contacts.len();
        metrics.minimum_distance_m = final_contacts.minimum_distance;
        metrics.max_seam_gap_m = g.max_seam_gap(&state.x);
        [metrics.extension_p95_percent, metrics.extension_max_percent] =
            crate::garment::diagnostics::extension_percent(g, state);
        metrics.step_ms = start.elapsed().as_secs_f64() * 1000.;
        metrics.solve_ms = metrics.step_ms - metrics.detection_ms;
        Ok(metrics)
    }
}

/// AVBD's scalar-factor curvature approximation applied to C=sqrt(2U).
/// Preserve the normal rank-one term instead of making all directions stiff.
/// For a plane's quadratic contact, H = gg^T/(2U): tangent curvature is zero.
fn contact_curvature(energy: f64, gradient: DVec3, hessian: DMat3) -> DMat3 {
    if energy <= 0. {
        return DMat3::ZERO;
    }
    let normal = DMat3::from_cols(
        gradient * gradient.x,
        gradient * gradient.y,
        gradient * gradient.z,
    ) / (2. * energy);
    let geometric = hessian - normal;
    normal
        + DMat3::from_diagonal(DVec3::new(
            geometric.x_axis.length(),
            geometric.y_axis.length(),
            geometric.z_axis.length(),
        ))
}

#[allow(clippy::too_many_arguments)]
fn local_energy(
    g: &CompiledGarment,
    c: &[Constraint],
    incident: &[usize],
    k: &[f64],
    extra: &[Constraint],
    contacts: &ContactSet,
    x: &[DVec3],
    v: usize,
    target: DVec3,
    inertia: f64,
    s: &VbdSettings,
) -> f64 {
    0.5 * inertia * x[v].distance_squared(target)
        + incident
            .iter()
            .map(|j| 0.5 * k[*j] * c[*j].at(g, x).powi(2))
            .sum::<f64>()
        + extra
            .iter()
            .filter(|c| c.ids.contains(&v))
            .map(|c| 0.5 * c.k * c.at(g, x).powi(2))
            .sum::<f64>()
        + contacts.incident[v]
            .iter()
            .map(|j| contacts.contacts[*j].value(x, s.contact.radius, s.contact.stiffness))
            .sum::<f64>()
}
#[allow(clippy::too_many_arguments)]
fn xpbd_update(
    x: &mut [DVec3],
    contacts: &ContactSet,
    inverse: &[f64],
    ids: &[usize],
    grad: &[DVec3],
    c: f64,
    alpha: f64,
    lambda: &mut f64,
) -> Result<usize, String> {
    let weight = |i: usize| inverse.get(i).copied().unwrap_or(0.);
    let denominator = alpha
        + ids
            .iter()
            .zip(grad)
            .map(|(i, g)| weight(*i) * g.length_squared())
            .sum::<f64>();
    let dl = (-c - alpha * *lambda) / denominator;
    if !dl.is_finite() || grad.iter().any(|g| !g.is_finite()) {
        return Err("Non-finite XPBD constraint; state unchanged".into());
    }
    let mut a = 1.;
    let mut clipped = 0;
    for (i, g) in ids.iter().zip(grad) {
        if weight(*i) == 0. {
            continue;
        }
        let d = *g * (weight(*i) * dl);
        let fraction = feasible_fraction(contacts, *i, x[*i], d);
        if fraction < 1. {
            clipped = 1;
            a = f64::min(a, fraction);
        }
    }
    for (i, g) in ids.iter().zip(grad) {
        x[*i] += *g * (weight(*i) * dl * a);
    }
    *lambda += dl * a;
    Ok(clipped)
}

/// Segment from the current iterate, within the original detection region.
fn feasible_fraction(contacts: &ContactSet, i: usize, x: DVec3, d: DVec3) -> f64 {
    let offset = x - contacts.centers[i];
    let mut fraction = 1.0_f64;
    for plane in contacts.directional.at(i) {
        let toward = plane.normal.dot(d);
        let slack = (plane.limit - plane.normal.dot(offset)).max(0.);
        if toward > slack {
            fraction = fraction.min(slack / toward);
        }
    }
    if (offset + d).length() > contacts.radii[i] {
        let aa = d.length_squared();
        let b = offset.dot(d);
        let c = (offset.length_squared() - contacts.radii[i].powi(2)).min(0.);
        if aa > 0. {
            let root = (b * b - aa * c).max(0.).sqrt();
            let t = if b >= 0. {
                -c / (b + root).max(f64::MIN_POSITIVE)
            } else {
                (-b + root) / aa
            };
            fraction = fraction.min(t.clamp(0., 1.));
        }
    }
    if fraction < 1. {
        fraction *= 1. - 32. * f64::EPSILON;
    }
    fraction
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::ValueEnum;

    fn contract_garment() -> Arc<CompiledGarment> {
        let mut template = crate::garment::GarmentTemplate::two_panel_demo();
        template.panels.truncate(1);
        template.seams.clear();
        template.panels[0].pins.clear();
        template.panels[0].pattern.nx = 1;
        template.panels[0].pattern.ny = 1;
        Arc::new(template.compile().unwrap())
    }

    #[test]
    fn adapter_contract_rejects_invalid_checkpoints_at_construction() {
        let garment = contract_garment();
        for &algorithm in Algorithm::value_variants() {
            for case in 0..5 {
                let mut state = garment.initial_state.clone();
                match case {
                    0 => state.time = f64::NAN,
                    1 => state.v[0].x = f64::INFINITY,
                    2 => state.x[0].y = f64::NAN,
                    3 => {
                        state.x.pop();
                    }
                    _ => {
                        state.v.pop();
                    }
                }
                assert!(
                    Backend::new(algorithm, garment.clone(), None, &state).is_err(),
                    "{algorithm:?} accepted invalid checkpoint case {case}"
                );
            }
        }
    }

    #[test]
    fn adapter_contract_rejects_negative_grab_weights_without_changing_state() {
        let garment = contract_garment();
        for &algorithm in Algorithm::value_variants() {
            let mut state = garment.initial_state.clone();
            let before = serde_json::to_string(&state).unwrap();
            let mut backend = Backend::new(algorithm, garment.clone(), None, &state).unwrap();
            let vertices = garment.mesh.triangles[0].vertices;
            let grab = Grab {
                vertices,
                weights: [-0.2, 0.6, 0.6],
                target: state.x[vertices[0]],
                stiffness: 10.,
                patch: vec![],
            };
            let settings = VbdSettings {
                gravity: DVec3::ZERO,
                iterations: 1,
                ..Default::default()
            };
            assert!(
                backend.step(&mut state, &settings, Some(&grab)).is_err(),
                "{algorithm:?} accepted extrapolating grab weights"
            );
            assert_eq!(serde_json::to_string(&state).unwrap(), before);
        }
    }

    #[test]
    fn adapter_contract_real_steps_preserve_rest_and_report_physical_time() {
        let garment = contract_garment();
        let rest = garment.mesh.uv.clone();
        for &algorithm in Algorithm::value_variants() {
            let mut state = garment.initial_state.clone();
            state.time = 2.5;
            let initial = state.clone();
            let mut backend = Backend::new(algorithm, garment.clone(), None, &state).unwrap();
            let caps = backend.capabilities();
            assert_eq!(caps, algorithm.capabilities());
            assert_eq!(caps.id, algorithm.to_possible_value().unwrap().get_name());
            let settings = VbdSettings {
                dt: 0.005,
                iterations: 2,
                ..Default::default()
            };
            let metrics = backend.step(&mut state, &settings, None).unwrap();
            assert!((state.time - 2.505).abs() < 1e-12, "{}", caps.id);
            assert_eq!(metrics.time_s, state.time);
            assert_eq!(metrics.dt_s, settings.dt);
            assert!(metrics.step_ms.is_finite() && metrics.step_ms >= 0.);
            assert!(
                state
                    .x
                    .iter()
                    .zip(&initial.x)
                    .any(|(a, b)| a.distance(*b) > 1e-8)
            );
            assert_eq!(garment.mesh.uv, rest);

            // A new adapter from the SAME input is reproducible. This does not
            // assert equivalence with warm predictor/contact/stiffness history.
            let mut repeat = initial.clone();
            let mut cold = Backend::new(algorithm, garment.clone(), None, &repeat).unwrap();
            cold.step(&mut repeat, &settings, None).unwrap();
            for (a, b) in state.x.iter().zip(&repeat.x) {
                assert!(a.distance(*b) < 1e-12);
            }
            for (a, b) in state.v.iter().zip(&repeat.v) {
                assert!(a.distance(*b) < 1e-12);
            }
            assert_eq!(repeat.time, state.time);

            let before = serde_json::to_string(&state).unwrap();
            let invalid = VbdSettings { dt: 0., ..settings };
            assert!(backend.step(&mut state, &invalid, None).is_err());
            assert_eq!(serde_json::to_string(&state).unwrap(), before);
        }
    }

    #[test]
    fn adapter_contract_valid_convex_grab_remains_accepted() {
        let garment = contract_garment();
        for &algorithm in Algorithm::value_variants() {
            let mut state = garment.initial_state.clone();
            let mut backend = Backend::new(algorithm, garment.clone(), None, &state).unwrap();
            let vertices = garment.mesh.triangles[0].vertices;
            let target =
                vertices.iter().map(|i| state.x[*i] / 3.).sum::<DVec3>() + DVec3::Z * 0.001;
            let grab = Grab {
                vertices,
                weights: [1. / 3.; 3],
                target,
                stiffness: 5.,
                patch: vec![],
            };
            let settings = VbdSettings {
                gravity: DVec3::ZERO,
                iterations: 2,
                ..Default::default()
            };
            backend.step(&mut state, &settings, Some(&grab)).unwrap();
            assert_eq!(state.time, settings.dt);
            assert!(state.x.iter().chain(&state.v).all(|p| p.is_finite()));
        }
    }

    #[test]
    fn adapter_contract_metadata_distinguishes_ramps_and_sampling() {
        assert_eq!(
            Algorithm::AvbdFinite.capabilities().stiffness_schedule,
            StiffnessSchedule::AdaptiveFinite
        );
        assert_eq!(
            Algorithm::AvbdTarget.capabilities().stiffness_schedule,
            StiffnessSchedule::TargetCompletion
        );
        assert_eq!(
            Algorithm::Vbd.capabilities().residual_sampling,
            ResidualSampling::LastColorSweepAllVertices
        );
        for &algorithm in Algorithm::value_variants() {
            let caps = algorithm.capabilities();
            let json = serde_json::to_value(caps).unwrap();
            assert_eq!(json["execution"], "cpu_f64");
            assert_eq!(json["portable_warm_start"], false);
            assert!(!caps.coulomb_friction && !caps.animated_avatar);
            if !matches!(algorithm, Algorithm::Vbd) {
                assert!(caps.experimental);
                assert_eq!(
                    caps.residual_sampling,
                    ResidualSampling::FinalPrimalFreeVertices
                );
                assert_eq!(
                    caps.contact_metric_sampling,
                    ContactMetricSampling::FinalDistanceLastDetectionCounts
                );
            }
        }
    }
    #[test]
    fn quadratic_plane_contact_keeps_tangential_curvature_zero() {
        for n in [DVec3::Y, DVec3::new(1., 2., -3.).normalize()] {
            let k = 100_000.;
            let gap = 0.0004;
            let h = DMat3::from_cols(n * n.x, n * n.y, n * n.z) * k;
            let approximate = contact_curvature(0.5 * k * gap * gap, -n * k * gap, h);
            let tangent = n.cross(DVec3::X).normalize();
            assert!((approximate * tangent).length() < 1e-8);
            assert!((approximate * n).distance(n * k) < 1e-8);
        }
    }
}

pub mod bounded_least_squares;
pub mod constrained_least_squares;
pub mod unilateral_newton;
