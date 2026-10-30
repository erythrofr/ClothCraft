//! CPU-only investigation of geometric easing. No production law is changed.
use clap::Parser;
use glam::DVec3;
use marvelous_cloth::{
    garment::{GarmentTemplate, template::Corner},
    vbd::{Grab, VbdSettings, VbdSolver},
};
use serde_json::json;
use std::{fs, io::Write, path::PathBuf, sync::Arc, time::Instant};

#[derive(Parser)]
struct Args {
    #[arg(long, default_value = "output/elastic-seam-probe")]
    output: PathBuf,
    #[arg(long, default_value_t = 360)]
    steps: usize,
    #[arg(long, default_value_t = 16)]
    iterations: usize,
    /// Simulation steps per second; choose 40, 60 or 120.
    #[arg(long, default_value_t = 60)]
    hz: usize,
    #[arg(long, default_value_t = 1.15)]
    ease_ratio: f64,
    /// Replay a previous run directory after checking its template and initial state.
    #[arg(long)]
    replay: Option<PathBuf>,
    /// Downsample a higher-frequency replay at matching physical step times.
    #[arg(long, requires = "replay", conflicts_with = "equal_seam_control")]
    resample_replay: bool,
    /// Replay the full-edge fixture with an equal-length partial-edge seam.
    #[arg(long, requires = "replay")]
    equal_seam_control: bool,
    /// Run without grab input, to inspect settling under the seam and gravity.
    #[arg(long)]
    idle_only: bool,
    /// Audit the initial and every accepted state, separately from the solver.
    #[arg(long)]
    audit_every_step: bool,
}

#[derive(serde::Deserialize)]
struct Control {
    step: usize,
    phase: String,
    grab_target_m: Option<DVec3>,
}

struct IntersectionAudit {
    world: marvelous_cloth::ogc::OgcWorld,
    samples: usize,
    elapsed_ms: f64,
}
impl IntersectionAudit {
    fn sample(&mut self, state: &marvelous_cloth::model::State, label: &str) -> Result<(), String> {
        let clock = Instant::now();
        let result = self.world.validate_start(&self.world.positions(&state.x));
        self.elapsed_ms += clock.elapsed().as_secs_f64() * 1000.;
        self.samples += 1;
        result.map_err(|error| format!("Intersection audit at {label}: {error}"))
    }
}

fn phase(step: usize, hz: usize, idle_only: bool) -> &'static str {
    if idle_only {
        return "idle";
    }
    if step < 2 * hz {
        "settle"
    } else if step < 3 * hz {
        "pull"
    } else if step < 7 * hz / 2 {
        "hold"
    } else {
        "release"
    }
}

fn validate_controls(
    rows: &[Control],
    steps: usize,
    hz: usize,
    idle_only: bool,
) -> Result<(), &'static str> {
    if rows.len() != steps {
        return Err("Replay step count differs");
    }
    for (i, row) in rows.iter().enumerate() {
        if row.step != i
            || row.phase != phase(i, hz, idle_only)
            || row.grab_target_m.is_some() != (!idle_only && (2 * hz..7 * hz / 2).contains(&i))
            || row.grab_target_m.is_some_and(|p| !p.is_finite())
        {
            return Err("Replay control sequence is invalid");
        }
    }
    Ok(())
}

fn downsample_controls(
    rows: &[Control],
    source_hz: usize,
    target_hz: usize,
    steps: usize,
    idle_only: bool,
) -> Result<Vec<Control>, &'static str> {
    if ![40, 60, 120].contains(&source_hz)
        || ![40, 60, 120].contains(&target_hz)
        || source_hz < target_hz
        || !source_hz.is_multiple_of(target_hz)
    {
        return Err("Replay rates require an integer downsampling ratio");
    }
    let ratio = source_hz / target_hz;
    let source_steps = steps
        .checked_mul(ratio)
        .ok_or("Replay step count overflow")?;
    validate_controls(rows, source_steps, source_hz, idle_only)?;
    let mut result = Vec::with_capacity(steps);
    for step in 0..steps {
        // Both indices represent the end of the same physical interval.
        let source = &rows[(step + 1) * ratio - 1];
        let phase = phase(step, target_hz, idle_only);
        if source.phase != phase {
            return Err("Replay phases do not align");
        }
        result.push(Control {
            step,
            phase: phase.into(),
            grab_target_m: source.grab_target_m,
        });
    }
    validate_controls(&result, steps, target_hz, idle_only)?;
    Ok(result)
}

fn fixture(ratio: f64) -> GarmentTemplate {
    let mut t = GarmentTemplate::two_panel_demo();
    for (i, p) in t.panels.iter_mut().enumerate() {
        p.pattern.width = 0.15;
        p.pattern.height = 0.3 * if i == 0 { 1. } else { ratio };
        p.pattern.nx = 3;
        p.pattern.ny = if i == 0 { 4 } else { 6 };
        p.placement.rotation_degrees = DVec3::ZERO;
        p.placement.translation = if i == 0 {
            DVec3::new(-0.15, 1., 0.)
        } else {
            DVec3::new(0.004, 1., 0.006)
        };
        p.pins = vec![if i == 0 {
            Corner::TopLeft
        } else {
            Corner::TopRight
        }];
    }
    t.seams[0].allow_ease = true;
    t.seams[0].notches.clear();
    t
}

fn comparison_fixture(ratio: f64, equal_seam_control: bool) -> GarmentTemplate {
    let mut template = fixture(ratio);
    if equal_seam_control {
        template.seams[0].b.range = [0., 1. / ratio];
    }
    template
}

fn validate_matched_settings(
    summary: &serde_json::Value,
    settings: &VbdSettings,
    steps: usize,
    idle_only: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let recorded_idle = match summary.get("idle_only") {
        None => false, // Historical pull/hold/release reports predate this field.
        Some(value) => value.as_bool().ok_or("Replay idle_only must be boolean")?,
    };
    if summary.get("settings") != Some(&serde_json::to_value(settings)?)
        || summary.get("steps").and_then(serde_json::Value::as_u64) != Some(steps as u64)
        || recorded_idle != idle_only
    {
        return Err("Matched replay requires identical settings and step count".into());
    }
    Ok(())
}

fn validate_replay_timestep(
    summary: Option<&serde_json::Value>,
    hz: usize,
) -> Result<(), &'static str> {
    let Some(summary) = summary else {
        return if hz == 60 {
            Ok(())
        } else {
            Err("Replay without timing metadata is only supported at 60 Hz")
        };
    };
    let dt = summary
        .get("settings")
        .and_then(|s| s.get("dt"))
        .and_then(serde_json::Value::as_f64)
        .ok_or("Replay summary has no timestep")?;
    if !dt.is_finite() || (dt - 1. / hz as f64).abs() > 1e-12 {
        return Err("Replay timestep differs; controls are indexed by step");
    }
    Ok(())
}

/// Independent proposed tension-only thread law, NOT installed in VBD.
/// EA [N], material rest length [m], current length [m]; returns (J, N).
fn thread_law(length: f64, rest: f64, ea: f64) -> (f64, f64) {
    let extension = (length - rest).max(0.);
    (
        0.5 * ea / rest * extension * extension,
        ea / rest * extension,
    )
}

/// Reconcile independently evaluated models without attributing contact or
/// user-control changes to the mechanical work of the frozen model.
fn reconcile(
    previous: Option<&marvelous_cloth::vbd::audit::Energy>,
    prior: &marvelous_cloth::vbd::audit::Energy,
    next_control_j: f64,
    balance: &marvelous_cloth::vbd::audit::StepEnergy,
    final_energy: &marvelous_cloth::vbd::audit::Energy,
) -> (f64, f64, f64, f64) {
    let start_refresh = previous.map_or(0., |old| prior.contact_j - old.contact_j);
    let prior_total = previous.map_or_else(|| prior.total_j(), |old| old.total_j());
    let control_change = next_control_j - prior.grab_j;
    let contact_refresh = final_energy.contact_j - balance.after.contact_j;
    let error = (final_energy.total_j() - prior_total)
        - (start_refresh + control_change + balance.delta_mechanical_j + contact_refresh);
    (start_refresh, control_change, contact_refresh, error)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    if ![40, 60, 120].contains(&args.hz)
        || args.steps < 5 * args.hz
        || args.iterations == 0
        || !args.ease_ratio.is_finite()
        || !(1.0..=1.5).contains(&args.ease_ratio)
    {
        return Err("Require hz 40, 60 or 120, at least five simulated seconds, positive iterations and ease ratio in [1, 1.5]".into());
    }
    rayon::ThreadPoolBuilder::new()
        .num_threads(2)
        .build_global()?;
    if args.equal_seam_control && args.ease_ratio <= 1. {
        return Err("Equal seam control requires an ease ratio greater than 1".into());
    }
    let settings = VbdSettings {
        dt: 1. / args.hz as f64,
        iterations: args.iterations,
        ..Default::default()
    };
    settings.validate()?;
    let garment = Arc::new(comparison_fixture(args.ease_ratio, args.equal_seam_control).compile()?);
    let initial = garment.initial_state.clone();
    let replay = args
        .replay
        .as_ref()
        .map(|dir| -> Result<Vec<Control>, Box<dyn std::error::Error>> {
            for (file, expected) in [
                (
                    "template.json",
                    serde_json::to_value(fixture(args.ease_ratio))?,
                ),
                ("initial.json", serde_json::to_value(&initial)?),
            ] {
                let actual: serde_json::Value = serde_json::from_slice(&fs::read(dir.join(file))?)?;
                if actual != expected {
                    return Err(format!("Replay {file} differs from current fixture").into());
                }
            }
            let summary_path = dir.join("summary.json");
            let summary: Option<serde_json::Value> = if summary_path.exists() {
                Some(serde_json::from_slice(&fs::read(&summary_path)?)?)
            } else {
                None
            };
            let source_hz = if args.resample_replay {
                let summary = summary
                    .as_ref()
                    .ok_or("Resampled replay requires timing metadata")?;
                let dt = summary
                    .get("settings")
                    .and_then(|s| s.get("dt"))
                    .and_then(serde_json::Value::as_f64)
                    .ok_or("Replay summary has no timestep")?;
                [40, 60, 120]
                    .into_iter()
                    .find(|hz| (dt - 1. / *hz as f64).abs() <= 1e-12)
                    .ok_or("Replay timestep is not supported for resampling")?
            } else {
                validate_replay_timestep(summary.as_ref(), args.hz)?;
                args.hz
            };
            if args.equal_seam_control {
                validate_matched_settings(
                    summary
                        .as_ref()
                        .ok_or("Matched replay requires a summary")?,
                    &settings,
                    args.steps,
                    args.idle_only,
                )?;
            }
            let rows = fs::read_to_string(dir.join("trace.jsonl"))?
                .lines()
                .map(serde_json::from_str)
                .collect::<Result<Vec<Control>, _>>()?;
            if args.resample_replay {
                Ok(downsample_controls(
                    &rows,
                    source_hz,
                    args.hz,
                    args.steps,
                    args.idle_only,
                )?)
            } else {
                validate_controls(&rows, args.steps, args.hz, args.idle_only)?;
                Ok(rows)
            }
        })
        .transpose()?;
    // Validate controls and settings before creating any experiment output.
    fs::create_dir(&args.output)?;
    let seam = &garment.seams[0];
    let mut gradient = vec![DVec3::ZERO; initial.x.len()];
    for e in seam.elements(&initial.x) {
        for (&d, &g) in e.dofs.iter().zip(&e.gradient) {
            gradient[d / 3][d % 3] += g;
        }
    }
    let mut max_error = 0_f64;
    for d in 0..initial.x.len() * 3 {
        let mut plus = initial.x.clone();
        let mut minus = initial.x.clone();
        plus[d / 3][d % 3] += 1e-6;
        minus[d / 3][d % 3] -= 1e-6;
        let fd = (seam.energy(&plus) - seam.energy(&minus)) / 2e-6;
        max_error = max_error.max((fd - gradient[d / 3][d % 3]).abs());
    }
    if max_error > 1e-7 {
        return Err("Production seam derivative check failed".into());
    }
    let mut solver = VbdSolver::new(garment.clone(), None, &initial)?;
    let mut state = initial.clone();
    let mut intersection_audit = args.audit_every_step.then(|| IntersectionAudit {
        world: solver.world.clone(),
        samples: 0,
        elapsed_ms: 0.,
    });
    if let Some(audit) = &mut intersection_audit {
        audit.sample(&state, "initial state")?;
    }
    // Select a free triangle by rest coordinates, not a serialized mesh index.
    let panel = &garment.panels[1];
    let vertices = garment
        .mesh
        .triangles
        .iter()
        .filter(|t| t.vertices.iter().all(|v| panel.vertices.contains(v)))
        .max_by(|a, b| {
            let y = |v: [usize; 3]| v.iter().map(|&i| garment.mesh.uv[i].y).sum::<f64>();
            y(a.vertices).total_cmp(&y(b.vertices))
        })
        .ok_or("Missing grab triangle")?
        .vertices;
    let point = |x: &[DVec3]| vertices.iter().map(|&v| x[v] / 3.).sum::<DVec3>();
    let mut anchor = DVec3::ZERO;
    let mut trace = fs::File::create(args.output.join("trace.jsonl"))?;
    fs::write(
        args.output.join("template.json"),
        serde_json::to_vec_pretty(&comparison_fixture(
            args.ease_ratio,
            args.equal_seam_control,
        ))?,
    )?;
    fs::write(
        args.output.join("initial.json"),
        serde_json::to_vec_pretty(&initial)?,
    )?;
    let mut previous: Option<(String, f64)> = None;
    // The diagnostic detector never touches the solver's contact cache. Freeze
    // its pre-step contacts across each balance, then separately measure the
    // refreshed contact model at the accepted position.
    let mut detector = solver.world.clone();
    let mut previous_grab: Option<Grab> = None;
    let mut previous_energy: Option<marvelous_cloth::vbd::audit::Energy> = None;
    let mut tail_residual = Vec::new();
    let mut maximum_balance_error = 0_f64;
    let mut maximum_contact_refresh = 0_f64;
    let mut maximum_start_refresh = 0_f64;
    let mut maximum_reconciliation_error = 0_f64;
    let mut total_diagnostic_ms = 0_f64;
    let mut release_rises = 0;
    let mut maximum_release_rise = 0_f64;
    let mut tail_rises = 0;
    let mut maximum_tail_rise = 0_f64;
    let mut release_start = 0.;
    let mut final_energy = 0.;
    let mut costs = Vec::new();
    let mut tail_motion = Vec::new();
    for step in 0..args.steps {
        if step == 2 * args.hz {
            anchor = point(&state.x);
        }
        let phase = phase(step, args.hz, args.idle_only);
        let u = ((step as f64 - (2 * args.hz - 1) as f64) / args.hz as f64).clamp(0., 1.);
        let target = replay.as_ref().map_or_else(
            || {
                (!args.idle_only && (2 * args.hz..7 * args.hz / 2).contains(&step))
                    .then_some(anchor + DVec3::Z * (0.04 * u * u * (3. - 2. * u)))
            },
            |rows| rows[step].grab_target_m,
        );
        let grab = target.map(|target| Grab {
            patch: Vec::new(),
            vertices,
            weights: [1. / 3.; 3],
            target,
            stiffness: 100.,
        });
        let diagnostic_clock = Instant::now();
        let before = state.clone();
        let contacts_before = detector.detect(
            &detector.positions(&before.x),
            settings.contact.radius * 4.,
            &settings.contact,
        )?;
        let prior_energy =
            solver.audit_energy(&before, &settings, &contacts_before, previous_grab.as_ref())?;
        let next_control = solver
            .audit_energy(&before, &settings, &contacts_before, grab.as_ref())?
            .grab_j;
        total_diagnostic_ms += diagnostic_clock.elapsed().as_secs_f64() * 1000.;
        let clock = Instant::now();
        let metrics = solver.step(&mut state, &settings, grab.as_ref())?;
        let wall_ms = clock.elapsed().as_secs_f64() * 1000.;
        if let Some(audit) = &mut intersection_audit {
            audit.sample(&state, &format!("accepted step {step}"))?;
        }
        let diagnostic_clock = Instant::now();
        let balance =
            solver.audit_step(&before, &state, &settings, &contacts_before, grab.as_ref())?;
        let contacts = detector.detect(
            &detector.positions(&state.x),
            settings.contact.radius * 4.,
            &settings.contact,
        )?;
        let energy = solver.audit_energy(&state, &settings, &contacts, grab.as_ref())?;
        // A repeated detection at the same position can change the diagnostic
        // feature set too; account for that before changing the grab target.
        let (start_refresh, control_change, contact_refresh, reconciliation_error) = reconcile(
            previous_energy.as_ref(),
            &prior_energy,
            next_control,
            &balance,
            &energy,
        );
        maximum_balance_error = maximum_balance_error.max(balance.balance_error_j.abs());
        maximum_contact_refresh = maximum_contact_refresh.max(contact_refresh.abs());
        maximum_start_refresh = maximum_start_refresh.max(start_refresh.abs());
        maximum_reconciliation_error = maximum_reconciliation_error.max(reconciliation_error.abs());
        if step >= args.steps - args.hz {
            tail_residual.push(balance.residual_rms_n);
        }
        total_diagnostic_ms += diagnostic_clock.elapsed().as_secs_f64() * 1000.;
        let velocity_rms =
            (state.v.iter().map(|v| v.length_squared()).sum::<f64>() / state.v.len() as f64).sqrt();
        final_energy = energy.total_j();
        if !final_energy.is_finite() {
            return Err("Nonfinite energy".into());
        }
        if step == if args.idle_only { 0 } else { 7 * args.hz / 2 } {
            release_start = final_energy;
        }
        if let Some((old_phase, old_energy)) = &previous
            && phase == if args.idle_only { "idle" } else { "release" }
            && old_phase == phase
        {
            let rise = final_energy - old_energy;
            release_rises += usize::from(rise > 1e-12);
            maximum_release_rise = maximum_release_rise.max(rise);
            if step >= args.steps - args.hz {
                tail_rises += usize::from(rise > 1e-12);
                maximum_tail_rise = maximum_tail_rise.max(rise);
            }
        }
        previous = Some((phase.into(), final_energy));
        let motion = metrics.motion.as_ref().map(|m| m.highpass_rms_m);
        if step >= args.hz {
            costs.push(wall_ms);
        }
        if step >= args.steps - args.hz
            && let Some(m) = motion
        {
            tail_motion.push(m);
        }
        writeln!(
            trace,
            "{}",
            json!({"step":step,"phase":phase,"energy":energy,
            "total_j":final_energy,"step_wall_ms":wall_ms,"highpass_rms_m":motion,"velocity_rms_m_s":velocity_rms,
            "grab_target_m":grab.as_ref().map(|g|g.target),"seam_gap_m":seam.max_gap(&state.x),
            "frozen_contact_balance":balance,"contact_refresh_j":contact_refresh,
            "contact_refresh_at_start_j":start_refresh,"control_change_j":control_change,
            "reconciliation_error_j":reconciliation_error})
        )?;
        previous_grab = grab;
        previous_energy = Some(energy);
    }
    solver
        .world
        .validate_start(&solver.world.positions(&state.x))?;
    costs.sort_by(f64::total_cmp);
    let mut report = json!({"kind":if args.equal_seam_control { "matched equal-length partial seam control" } else { "production geometric easing baseline" },
        "gpu_used":false,"replay":args.replay,"resample_replay":args.resample_replay,"settings":settings,"vertices":initial.x.len(),"iterations":args.iterations,"steps":args.steps,
        "simulation_hz":args.hz,"simulated_seconds":args.steps as f64 / args.hz as f64,"tail_seconds":1.0,
        "ease_ratio":args.ease_ratio,"equal_seam_control":args.equal_seam_control,"idle_only":args.idle_only,"gradient_max_error_n":max_error,
        "observation_phase":if args.idle_only { "idle" } else { "release" },
        "observation_energy_start_j":release_start,"observation_energy_end_j":final_energy,
        "observation_positive_deltas":release_rises,"observation_max_rise_j":maximum_release_rise,
        "tail_positive_deltas":tail_rises,"tail_max_rise_j":maximum_tail_rise,
        "release_energy_start_j":(!args.idle_only).then_some(release_start),"release_energy_end_j":(!args.idle_only).then_some(final_energy),
        "release_positive_deltas":(!args.idle_only).then_some(release_rises),"release_max_rise_j":(!args.idle_only).then_some(maximum_release_rise),
        "step_wall_mean_ms":costs.iter().sum::<f64>()/costs.len() as f64,
        "step_wall_p95_ms":costs[(costs.len()-1)*95/100],
        "tail_highpass_mean_m":tail_motion.iter().sum::<f64>()/tail_motion.len() as f64,
        "tail_frozen_contact_residual_mean_n":tail_residual.iter().sum::<f64>()/tail_residual.len() as f64,
        "max_balance_error_j":maximum_balance_error,"max_abs_contact_refresh_j":maximum_contact_refresh,
        "max_abs_start_contact_refresh_j":maximum_start_refresh,
        "max_reconciliation_error_j":maximum_reconciliation_error,
        "diagnostic_mean_ms":total_diagnostic_ms / args.steps as f64,
        "final_intersection_check":"passed",
        "thread_law_example":{"rest_m":0.3,"current_m":0.33,"ea_n":10.,"energy_and_tension":thread_law(0.33,0.3,10.)},
        "limits":"Frozen pre-step diagnostic contacts may differ from the solver's internal contacts; residual includes movement-bound reactions and is not a convergence certificate. Control and contact refresh changes are separate. Uncalibrated thread law is analytical only."});
    report["sampled_intersection_audit"] = intersection_audit
        .as_ref()
        .map(|audit| json!({"samples":audit.samples,"elapsed_ms":audit.elapsed_ms,"status":"passed"}))
        .unwrap_or(serde_json::Value::Null);
    fs::write(
        args.output.join("summary.json"),
        serde_json::to_vec_pretty(&report)?,
    )?;
    println!("{report}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn independent_intersection_audit_detects_collapsed_state() {
        let garment = Arc::new(fixture(1.15).compile().unwrap());
        let initial = garment.initial_state.clone();
        let mut solver = VbdSolver::new(garment, None, &initial).unwrap();
        let mut audit = IntersectionAudit {
            world: solver.world.clone(),
            samples: 0,
            elapsed_ms: 0.,
        };
        audit.sample(&initial, "initial").unwrap();
        let mut collapsed = initial.clone();
        collapsed.x.fill(DVec3::ZERO);
        assert!(audit.sample(&collapsed, "collapsed").is_err());
        assert_eq!(audit.samples, 2);
        let solver_positions = solver.world.positions(&initial.x);
        solver.world.validate_start(&solver_positions).unwrap();
    }
    #[test]
    fn matched_control_changes_only_seam_coverage() {
        let base = fixture(1.15);
        let control = comparison_fixture(1.15, true);
        let mut normalized = control.clone();
        normalized.seams = base.seams.clone();
        assert_eq!(
            serde_json::to_value(&base).unwrap(),
            serde_json::to_value(&normalized).unwrap()
        );
        assert!((control.seams[0].b.range[1] * 0.3 * 1.15 - 0.3).abs() < 1e-12);
        let a = base.compile().unwrap();
        let b = control.compile().unwrap();
        assert_eq!(
            serde_json::to_value(&a.initial_state).unwrap(),
            serde_json::to_value(&b.initial_state).unwrap()
        );
    }
    #[test]
    fn matched_control_rejects_settings_and_step_changes() {
        let settings = VbdSettings {
            dt: 1. / 60.,
            iterations: 16,
            ..Default::default()
        };
        let mut report = json!({"settings": settings, "steps": 300});
        assert!(validate_matched_settings(&report, &settings, 300, false).is_ok());
        assert!(validate_matched_settings(&report, &settings, 300, true).is_err());
        assert!(validate_matched_settings(&report, &settings, 301, false).is_err());
        report["idle_only"] = json!(true);
        assert!(validate_matched_settings(&report, &settings, 300, true).is_ok());
        assert!(validate_matched_settings(&report, &settings, 300, false).is_err());
        report["idle_only"] = json!("invalid");
        assert!(validate_matched_settings(&report, &settings, 300, false).is_err());
        report["idle_only"] = json!(true);
        report["settings"]["iterations"] = json!(32);
        assert!(validate_matched_settings(&report, &settings, 300, true).is_err());
    }
    #[test]
    fn moving_patch_observes_natural_contact_refresh() {
        use marvelous_cloth::{avatar::SurfaceMesh, model::Pattern};
        use std::collections::BTreeSet;
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels.truncate(1);
        template.seams.clear();
        let panel = &mut template.panels[0];
        panel.pins.clear();
        panel.pattern = Pattern {
            width: 0.12,
            height: 0.12,
            nx: 3,
            ny: 3,
        };
        panel.placement.rotation_degrees = DVec3::new(90., 0., 0.);
        panel.placement.translation = DVec3::new(-0.06, 0.0028, 0.06);
        let floor = SurfaceMesh {
            vertices: vec![
                DVec3::new(-0.06, 0., -1.),
                DVec3::new(0.06, 0., -1.),
                DVec3::new(0., 0., 1.),
            ],
            triangles: vec![[0, 1, 2]],
        };
        let garment = Arc::new(template.compile().unwrap());
        let mut state = garment.initial_state.clone();
        let mut solver = VbdSolver::new(garment.clone(), Some(&floor), &state).unwrap();
        let settings = VbdSettings {
            dt: 1. / 60.,
            ..Default::default()
        };
        let vertices = garment.mesh.triangles[0].vertices;
        let center = vertices.iter().map(|&i| state.x[i] / 3.).sum::<DVec3>();
        let grab = Grab {
            patch: Vec::new(),
            vertices,
            weights: [1. / 3.; 3],
            target: center + DVec3::X * 0.05,
            stiffness: 100.,
        };
        let mut detector = solver.world.clone();
        let keys = |set: &marvelous_cloth::ogc::ContactSet| -> BTreeSet<_> {
            set.contacts
                .iter()
                .map(|c| (c.kind, c.vertices, c.count))
                .collect()
        };
        let mut changes = 0;
        let mut max_refresh = 0_f64;
        let mut previous = None;
        let mut previous_grab: Option<Grab> = None;
        for step in 0..30 {
            let before = state.clone();
            let prior = detector
                .detect(
                    &detector.positions(&before.x),
                    settings.contact.radius * 4.,
                    &settings.contact,
                )
                .unwrap();
            let old = solver
                .audit_energy(&before, &settings, &prior, previous_grab.as_ref())
                .unwrap();
            let control = if step < 20 { Some(&grab) } else { None };
            let new_grab_j = solver
                .audit_energy(&before, &settings, &prior, control)
                .unwrap()
                .grab_j;
            solver.step(&mut state, &settings, control).unwrap();
            let balance = solver
                .audit_step(&before, &state, &settings, &prior, control)
                .unwrap();
            let after = detector
                .detect(
                    &detector.positions(&state.x),
                    settings.contact.radius * 4.,
                    &settings.contact,
                )
                .unwrap();
            if keys(&prior) != keys(&after) {
                changes += 1;
            }
            let energy = solver
                .audit_energy(&state, &settings, &after, control)
                .unwrap();
            let refresh = energy.contact_j - balance.after.contact_j;
            assert!(refresh.is_finite());
            let (_, _, _, error) =
                reconcile(previous.as_ref(), &old, new_grab_j, &balance, &energy);
            assert!(error.abs() < 1e-10, "reconciliation error {error:e} J");
            max_refresh = max_refresh.max(refresh.abs());
            solver
                .world
                .validate_start(&solver.world.positions(&state.x))
                .unwrap();
            previous = Some(energy);
            previous_grab = control.cloned();
        }
        eprintln!("natural contact changes={changes}, max refresh={max_refresh:e} J");
        assert!(
            changes > 0,
            "fixture did not change the detected contact set"
        );
        assert!(
            max_refresh > 1e-9,
            "fixture did not change the contact energy model"
        );
    }
    #[test]
    fn accounting_separates_changed_contacts_from_grab_and_step_work() {
        use marvelous_cloth::{avatar::SurfaceMesh, model::Pattern};
        let mut template = GarmentTemplate::two_panel_demo();
        template.panels.truncate(1);
        template.seams.clear();
        let panel = &mut template.panels[0];
        panel.pins.clear();
        panel.pattern = Pattern {
            width: 0.12,
            height: 0.12,
            nx: 3,
            ny: 3,
        };
        panel.placement.rotation_degrees = DVec3::new(90., 0., 0.);
        panel.placement.translation = DVec3::new(-0.06, 0.0028, 0.06);
        let floor = SurfaceMesh {
            vertices: vec![
                DVec3::new(-1., 0., -1.),
                DVec3::new(1., 0., -1.),
                DVec3::new(0., 0., 1.),
            ],
            triangles: vec![[0, 1, 2]],
        };
        let garment = Arc::new(template.compile().unwrap());
        let mut state = garment.initial_state.clone();
        let mut solver = VbdSolver::new(garment.clone(), Some(&floor), &state).unwrap();
        let settings = VbdSettings {
            dt: 1. / 60.,
            ..Default::default()
        };
        let before = state.clone();
        let contacts = solver
            .world
            .detect(
                &solver.world.positions(&before.x),
                settings.contact.radius * 4.,
                &settings.contact,
            )
            .unwrap();
        let mut no_contacts = contacts.clone();
        // Deliberately change only the diagnostic energy model. This is a
        // bookkeeping adversary, not a real collision detector transition.
        no_contacts.contacts.clear();
        no_contacts.incident =
            marvelous_cloth::ogc::ContactIncidence::new(before.x.len(), &no_contacts.contacts);
        let previous = solver
            .audit_energy(&before, &settings, &no_contacts, None)
            .unwrap();
        let prior = solver
            .audit_energy(&before, &settings, &contacts, None)
            .unwrap();
        let vertices = garment.mesh.triangles[0].vertices;
        let center = vertices.iter().map(|&i| before.x[i] / 3.).sum::<DVec3>();
        let grab = Grab {
            patch: Vec::new(),
            vertices,
            weights: [1. / 3.; 3],
            target: center + DVec3::X * 0.01,
            stiffness: 100.,
        };
        let next_control = solver
            .audit_energy(&before, &settings, &contacts, Some(&grab))
            .unwrap()
            .grab_j;
        solver.step(&mut state, &settings, Some(&grab)).unwrap();
        let balance = solver
            .audit_step(&before, &state, &settings, &contacts, Some(&grab))
            .unwrap();
        let final_energy = solver
            .audit_energy(&state, &settings, &no_contacts, Some(&grab))
            .unwrap();
        let (start, control, end, error) = reconcile(
            Some(&previous),
            &prior,
            next_control,
            &balance,
            &final_energy,
        );
        assert!(prior.contact_j > 0. && balance.after.contact_j > 0.);
        assert!((start - prior.contact_j).abs() < 1e-14);
        assert!((control - 0.005).abs() < 1e-12);
        assert!((end + balance.after.contact_j).abs() < 1e-14);
        assert!(error.abs() < 1e-12);
        // A missing or reversed contact term must be observable, even though
        // the complete algebraic reconciliation closes.
        let observed = final_energy.total_j() - previous.total_j();
        assert!((observed - (control + balance.delta_mechanical_j)).abs() > 1e-10);
    }
    #[test]
    fn replay_rejects_missing_reordered_and_nonfinite_controls() {
        let make = || {
            (0..300)
                .map(|i| Control {
                    step: i,
                    phase: phase(i, 60, false).into(),
                    grab_target_m: (120..210).contains(&i).then_some(DVec3::ZERO),
                })
                .collect::<Vec<_>>()
        };
        let mut rows = make();
        assert!(validate_controls(&rows, 300, 60, false).is_ok());
        assert!(validate_controls(&rows, 300, 60, true).is_err());
        assert!(validate_controls(&rows, 301, 60, false).is_err());
        rows.swap(120, 121);
        assert!(validate_controls(&rows, 300, 60, false).is_err());
        let mut rows = make();
        rows[210].grab_target_m = Some(DVec3::ZERO);
        assert!(validate_controls(&rows, 300, 60, false).is_err());
        let mut rows = make();
        rows[120].grab_target_m = Some(DVec3::splat(f64::NAN));
        assert!(validate_controls(&rows, 300, 60, false).is_err());
        let idle: Vec<_> = (0..300)
            .map(|i| Control {
                step: i,
                phase: phase(i, 60, true).into(),
                grab_target_m: None,
            })
            .collect();
        assert!(validate_controls(&idle, 300, 60, true).is_ok());
        assert!(validate_controls(&idle, 300, 60, false).is_err());
    }
    #[test]
    fn timestep_schedules_have_matching_physical_phase_boundaries() {
        for hz in [40, 60, 120] {
            assert_eq!(phase(2 * hz - 1, hz, false), "settle");
            assert_eq!(phase(2 * hz, hz, false), "pull");
            assert_eq!(phase(3 * hz, hz, false), "hold");
            assert_eq!(phase(7 * hz / 2, hz, false), "release");
            assert_eq!(phase(7 * hz / 2, hz, true), "idle");
        }
    }
    #[test]
    fn replay_timing_requires_a_matching_step_interval() {
        let summary = json!({"settings": {"dt": 1. / 60.}});
        assert!(validate_replay_timestep(Some(&summary), 60).is_ok());
        assert!(validate_replay_timestep(Some(&summary), 120).is_err());
        assert!(validate_replay_timestep(Some(&json!({})), 60).is_err());
        assert!(validate_replay_timestep(None, 60).is_ok());
        assert!(validate_replay_timestep(None, 40).is_err());
    }
    #[test]
    fn downsample_replay_uses_exact_aligned_world_targets() {
        let source_hz = 120;
        let rows: Vec<_> = (0..6 * source_hz)
            .map(|step| Control {
                step,
                phase: phase(step, source_hz, false).into(),
                grab_target_m: (2 * source_hz..7 * source_hz / 2)
                    .contains(&step)
                    .then_some(DVec3::splat((step + 1) as f64 / source_hz as f64)),
            })
            .collect();
        for target_hz in [40, 60] {
            let result =
                downsample_controls(&rows, source_hz, target_hz, 6 * target_hz, false).unwrap();
            for row in &result {
                if let Some(target) = row.grab_target_m {
                    assert_eq!(
                        target,
                        DVec3::splat((row.step + 1) as f64 / target_hz as f64)
                    );
                }
            }
        }
        assert!(downsample_controls(&rows, 60, 40, 240, false).is_err());
        assert!(downsample_controls(&rows, 120, 40, 239, false).is_err());
        assert!(downsample_controls(&rows, 120, 40, 240, true).is_err());
    }
    #[test]
    fn proposed_thread_law_has_correct_derivative_and_slack_limit() {
        for length in [0.2, 0.3, 0.33, 0.6] {
            let (energy, force) = thread_law(length, 0.3, 10.);
            let eps = 1e-7;
            let fd = (thread_law(length + eps, 0.3, 10.).0 - thread_law(length - eps, 0.3, 10.).0)
                / (2. * eps);
            assert!((fd - force).abs() < 1e-5);
            assert!(energy >= 0. && force >= 0.);
            if length <= 0.3 {
                assert_eq!((energy, force), (0., 0.));
            }
        }
    }
}
