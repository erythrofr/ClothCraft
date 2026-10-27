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
    #[arg(long, default_value_t = 1.15)]
    ease_ratio: f64,
    /// Replay a previous run directory after checking its template and initial state.
    #[arg(long)]
    replay: Option<PathBuf>,
}

#[derive(serde::Deserialize)]
struct Control {
    step: usize,
    phase: String,
    grab_target_m: Option<DVec3>,
}

fn phase(step: usize) -> &'static str {
    match step {
        0..120 => "settle",
        120..180 => "pull",
        180..210 => "hold",
        _ => "release",
    }
}

fn validate_controls(rows: &[Control], steps: usize) -> Result<(), &'static str> {
    if rows.len() != steps {
        return Err("Replay step count differs");
    }
    for (i, row) in rows.iter().enumerate() {
        if row.step != i
            || row.phase != phase(i)
            || row.grab_target_m.is_some() != (120..210).contains(&i)
            || row.grab_target_m.is_some_and(|p| !p.is_finite())
        {
            return Err("Replay control sequence is invalid");
        }
    }
    Ok(())
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

/// Independent proposed tension-only thread law, NOT installed in VBD.
/// EA [N], material rest length [m], current length [m]; returns (J, N).
fn thread_law(length: f64, rest: f64, ea: f64) -> (f64, f64) {
    let extension = (length - rest).max(0.);
    (
        0.5 * ea / rest * extension * extension,
        ea / rest * extension,
    )
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    if args.steps < 300
        || args.iterations == 0
        || !args.ease_ratio.is_finite()
        || !(1.0..=1.5).contains(&args.ease_ratio)
    {
        return Err("Require steps >= 300, positive iterations and ease ratio in [1, 1.5]".into());
    }
    rayon::ThreadPoolBuilder::new()
        .num_threads(2)
        .build_global()?;
    // Refuse accidental replacement of an earlier experiment.
    fs::create_dir(&args.output)?;
    let garment = Arc::new(fixture(args.ease_ratio).compile()?);
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
            let rows = fs::read_to_string(dir.join("trace.jsonl"))?
                .lines()
                .map(serde_json::from_str)
                .collect::<Result<Vec<Control>, _>>()?;
            validate_controls(&rows, args.steps)?;
            Ok(rows)
        })
        .transpose()?;
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
    let settings = VbdSettings {
        dt: 1. / 60.,
        iterations: args.iterations,
        ..Default::default()
    };
    settings.validate()?;
    let mut solver = VbdSolver::new(garment.clone(), None, &initial)?;
    let mut state = initial.clone();
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
        serde_json::to_vec_pretty(&fixture(args.ease_ratio))?,
    )?;
    fs::write(
        args.output.join("initial.json"),
        serde_json::to_vec_pretty(&initial)?,
    )?;
    let mut previous: Option<(String, f64)> = None;
    let mut release_rises = 0;
    let mut maximum_release_rise = 0_f64;
    let mut release_start = 0.;
    let mut final_energy = 0.;
    let mut costs = Vec::new();
    let mut tail_motion = Vec::new();
    for step in 0..args.steps {
        if step == 120 {
            anchor = point(&state.x);
        }
        let phase = phase(step);
        let u = ((step as f64 - 119.) / 60.).clamp(0., 1.);
        let target = replay.as_ref().map_or_else(
            || {
                (120..210)
                    .contains(&step)
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
        let clock = Instant::now();
        let metrics = solver.step(&mut state, &settings, grab.as_ref())?;
        let wall_ms = clock.elapsed().as_secs_f64() * 1000.;
        // Independent fresh detector; excluded from complete solver-call timing.
        let mut detector = solver.world.clone();
        let contacts = detector.detect(
            &detector.positions(&state.x),
            settings.contact.radius * 4.,
            &settings.contact,
        )?;
        let energy = solver.audit_energy(&state, &settings, &contacts, grab.as_ref())?;
        let velocity_rms =
            (state.v.iter().map(|v| v.length_squared()).sum::<f64>() / state.v.len() as f64).sqrt();
        final_energy = energy.total_j();
        if !final_energy.is_finite() {
            return Err("Nonfinite energy".into());
        }
        if step == 210 {
            release_start = final_energy;
        }
        if let Some((old_phase, old_energy)) = &previous
            && phase == "release"
            && old_phase == phase
        {
            let rise = final_energy - old_energy;
            release_rises += usize::from(rise > 1e-12);
            maximum_release_rise = maximum_release_rise.max(rise);
        }
        previous = Some((phase.into(), final_energy));
        let motion = metrics.motion.as_ref().map(|m| m.highpass_rms_m);
        if step >= 60 {
            costs.push(wall_ms);
        }
        if step >= args.steps - 60
            && let Some(m) = motion
        {
            tail_motion.push(m);
        }
        writeln!(
            trace,
            "{}",
            json!({"step":step,"phase":phase,"energy":energy,
            "total_j":final_energy,"step_wall_ms":wall_ms,"highpass_rms_m":motion,"velocity_rms_m_s":velocity_rms,
            "grab_target_m":grab.as_ref().map(|g|g.target),"seam_gap_m":seam.max_gap(&state.x)})
        )?;
    }
    solver
        .world
        .validate_start(&solver.world.positions(&state.x))?;
    costs.sort_by(f64::total_cmp);
    let report = json!({"kind":"production geometric easing baseline; no elastic thread integration",
        "gpu_used":false,"replay":args.replay,"settings":settings,"vertices":initial.x.len(),"iterations":args.iterations,"steps":args.steps,
        "ease_ratio":args.ease_ratio,"gradient_max_error_n":max_error,
        "release_energy_start_j":release_start,"release_energy_end_j":final_energy,
        "release_positive_deltas":release_rises,"release_max_rise_j":maximum_release_rise,
        "step_wall_mean_ms":costs.iter().sum::<f64>()/costs.len() as f64,
        "step_wall_p95_ms":costs[(costs.len()-1)*95/100],
        "tail_highpass_mean_m":tail_motion.iter().sum::<f64>()/tail_motion.len() as f64,
        "final_intersection_check":"passed",
        "thread_law_example":{"rest_m":0.3,"current_m":0.33,"ea_n":10.,"energy_and_tension":thread_law(0.33,0.3,10.)},
        "limits":"Uncalibrated thread law is evaluated analytically only. No claim of improved settling or cloth-scale performance."});
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
    fn replay_rejects_missing_reordered_and_nonfinite_controls() {
        let make = || {
            (0..300)
                .map(|i| Control {
                    step: i,
                    phase: phase(i).into(),
                    grab_target_m: (120..210).contains(&i).then_some(DVec3::ZERO),
                })
                .collect::<Vec<_>>()
        };
        let mut rows = make();
        assert!(validate_controls(&rows, 300).is_ok());
        assert!(validate_controls(&rows, 301).is_err());
        rows.swap(120, 121);
        assert!(validate_controls(&rows, 300).is_err());
        let mut rows = make();
        rows[210].grab_target_m = Some(DVec3::ZERO);
        assert!(validate_controls(&rows, 300).is_err());
        let mut rows = make();
        rows[120].grab_target_m = Some(DVec3::splat(f64::NAN));
        assert!(validate_controls(&rows, 300).is_err());
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
