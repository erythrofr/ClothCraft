//! CPU fitting run; optional GPU view/benchmark will be handled explicitly.
#![recursion_limit = "256"]
use clap::Parser;
use marvelous_cloth::{
    contact::Collider,
    fitting::FittingProject,
    garment::{export, presets::GarmentKind},
};
use std::{fs, io::Write, path::PathBuf, time::Instant};
#[cfg(feature = "desktop")]
#[path = "../atelier.rs"]
mod fitting_editor;
#[cfg(feature = "desktop")]
#[path = "../gpu_bench.rs"]
mod gpu_bench;
#[cfg(feature = "desktop")]
use marvelous_cloth::render;

#[derive(Parser)]
#[command(about = "Fit simple test garments on a static OBJ mannequin")]
struct Args {
    #[arg(long,value_enum,default_value_t=GarmentKind::Tshirt)]
    garment: GarmentKind,
    #[arg(long, default_value_t = 2)]
    subdivisions: u32,
    /// Nominal Delaunay spacing in millimetres (overrides the preset).
    #[arg(long)]
    mesh_mm: Option<f64>,
    #[arg(long, default_value = "assets/makehuman/mannequin.obj")]
    avatar: PathBuf,
    #[arg(long)]
    project: Option<PathBuf>,
    #[arg(long, default_value_t = 30)]
    steps: usize,
    #[arg(long, default_value_t = 2)]
    threads: usize,
    #[arg(long, default_value = "output/fitting")]
    output: PathBuf,
    /// Explicit opt-in: hardware GPU render timestamps and PNG captures.
    #[arg(long)]
    gpu_benchmark: bool,
    #[arg(long)]
    view: bool,
    /// Capture the actual native UI then close (explicit GPU smoke).
    #[arg(long)]
    ui_smoke: bool,
    /// Exercise a real egui pointer drag, verify an accepted grab step, capture and close.
    #[arg(long)]
    ui_interaction_smoke: bool,
    /// Measure five seconds of actual window cadence and physical clock, then close.
    #[arg(long, conflicts_with = "ui_interaction_smoke")]
    ui_perf_smoke: bool,
    /// Draw, sew, move, undo/redo and export using real native UI pointer events.
    #[arg(long, conflicts_with_all = ["ui_interaction_smoke", "ui_perf_smoke"])]
    ui_authoring_smoke: bool,
    /// Use the slow global Newton reference instead of interactive VBD + OGC.
    #[arg(long)]
    reference: bool,
    /// VBD local iterations per physical time step.
    #[arg(long)]
    iterations: Option<usize>,
    /// Physical time step in seconds; independent of rendering rate.
    #[arg(long)]
    dt: Option<f64>,
    /// Hardware compute opt-in: GPU candidate filtering + VBD, f64 contact geometry.
    #[arg(long, conflicts_with = "reference")]
    gpu_sim: bool,
    /// Compare GPU energies/forces against f64 AD before each step (slow).
    #[arg(long, requires = "gpu_sim")]
    check_gpu_gradients: bool,
    /// Compare performance with complete CPU candidate filtering (same physics).
    #[arg(long, requires = "gpu_sim")]
    cpu_contact_filter: bool,
    /// Compare contacts and movement balls with the full f64 detector every step (slow).
    #[arg(long, requires = "gpu_sim")]
    check_gpu_contacts: bool,
}
fn run_ogc(
    args: &Args,
    mut project: FittingProject,
    mut scene: marvelous_cloth::fitting::FittingScene,
) -> Result<(), Box<dyn std::error::Error>> {
    use marvelous_cloth::vbd::{VbdSettings, VbdSolver};
    let mut solver = VbdSolver::new(
        scene.garment.clone(),
        Some(&scene.collider.surface),
        &scene.state,
    )?;
    let mut settings = project.simulation.clone().unwrap_or(VbdSettings {
        dt: 1. / 60.,
        ..Default::default()
    });
    if let Some(iterations) = args.iterations {
        settings.iterations = iterations;
    }
    if let Some(dt) = args.dt {
        settings.dt = dt;
    }
    settings.validate()?;
    project.simulation = Some(settings.clone());
    #[cfg(feature = "desktop")]
    let gpu = if args.gpu_sim {
        use eframe::wgpu;
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            ..Default::default()
        }))?;
        let info = adapter.get_info();
        if info.device_type == wgpu::DeviceType::Cpu {
            return Err("Hardware GPU required for --gpu-sim".into());
        }
        eprintln!("Compute adapter: {} ({:?})", info.name, info.backend);
        let (device, queue) =
            pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
                label: Some("OGC VBD benchmark"),
                required_features: adapter.features()
                    & (wgpu::Features::TIMESTAMP_QUERY | wgpu::Features::SUBGROUP),
                ..Default::default()
            }))?;
        let mut gpu = marvelous_cloth::gpu_vbd::GpuVbd::new(device, queue);
        gpu.check_gradients = args.check_gpu_gradients;
        gpu.check_contacts = args.check_gpu_contacts;
        gpu.filter_contacts = !args.cpu_contact_filter;
        Some(gpu)
    } else {
        None
    };
    #[cfg(not(feature = "desktop"))]
    if args.gpu_sim {
        return Err("Rebuild with desktop for --gpu-sim".into());
    }
    fs::write(
        args.output.join("initial.obj"),
        export::obj(&scene.garment, &scene.state),
    )?;
    let mut log = std::io::BufWriter::with_capacity(
        64 * 1024,
        fs::File::create(args.output.join("metrics.jsonl"))?,
    );
    let start = Instant::now();
    let mut rows = Vec::new();
    for i in 0..args.steps {
        #[cfg(feature = "desktop")]
        let m = if let Some(gpu) = &gpu {
            gpu.step(&mut solver, &mut scene.state, &settings, None)?
        } else {
            solver.step(&mut scene.state, &settings, None)?
        };
        #[cfg(not(feature = "desktop"))]
        let m = solver.step(&mut scene.state, &settings, None)?;
        serde_json::to_writer(&mut log, &m)?;
        writeln!(log)?;
        if i % 30 == 0 || i + 1 == args.steps {
            eprintln!(
                "OGC {}/{} time={:.3}s gap={:.2}mm wall={:.2}ms contacts={}",
                i + 1,
                args.steps,
                m.time_s,
                1000. * m.max_seam_gap_m,
                m.step_ms,
                m.contacts
            );
        }
        rows.push(m);
    }
    log.flush()?;
    let wall_ms = start.elapsed().as_secs_f64() * 1000.;
    export::write_artifacts(
        &project.template,
        &scene.garment,
        &scene.state,
        &args.output,
    )?;
    project.state = Some(scene.state.clone());
    project.save(&args.output.join("fitting-project.json"))?;
    let report = serde_json::json!({"backend":if args.gpu_sim{"hybrid-cpu-ogc-gpu-vbd"}else{"cpu-f64-vbd-ogc"},"steps":args.steps,"settings":settings,"cpu_contact_filter":args.cpu_contact_filter,"check_gpu_contacts":args.check_gpu_contacts,"check_gpu_gradients":args.check_gpu_gradients,
        "vertices":scene.state.x.len(),"triangles":scene.garment.mesh.triangles.len(),"wall_ms":wall_ms,
        "mean_step_ms":if rows.is_empty(){0.}else{wall_ms/rows.len() as f64},"last":rows.last(),
        "seams":scene.garment.seams.iter().map(|s|serde_json::json!({"id":s.id,"max_gap_m":s.max_gap(&scene.state.x)})).collect::<Vec<_>>(),
        "scope":"OGC two-sided VF/EE normal contact, self-contact, sparse directional bounds with isotropic fallback; local seam exclusions; no friction; fixed iteration budgets do not certify equilibrium"});
    fs::write(
        args.output.join("run.json"),
        serde_json::to_string_pretty(&report)?,
    )?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    if args.gpu_benchmark {
        #[cfg(feature = "desktop")]
        gpu_bench::run(&scene, &args.output)?;
        #[cfg(not(feature = "desktop"))]
        return Err("Rebuild with desktop for --gpu-benchmark".into());
    }
    if args.view
        || args.ui_smoke
        || args.ui_interaction_smoke
        || args.ui_perf_smoke
        || args.ui_authoring_smoke
    {
        #[cfg(feature = "desktop")]
        fitting_editor::run(
            project,
            scene,
            fitting_editor::DocumentFiles {
                output: args.output.clone(),
                source: args.project.clone(),
                modified: args.steps > 0 || args.mesh_mm.is_some(),
            },
            args.ui_smoke,
            args.ui_interaction_smoke,
            args.ui_perf_smoke,
            args.ui_authoring_smoke,
        )
        .map_err(|e| e.to_string())?;
        #[cfg(not(feature = "desktop"))]
        return Err("Rebuild with desktop for --view".into());
    }
    Ok(())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    if !(1..=16).contains(&args.threads) || args.steps > 10_000 {
        return Err("Require 1..16 threads and at most 10000 steps".into());
    }
    rayon::ThreadPoolBuilder::new()
        .num_threads(args.threads)
        .build_global()?;
    let mut project = if let Some(path) = &args.project {
        FittingProject::load(path)?
    } else {
        FittingProject::basic(args.garment, args.subdivisions, args.avatar.clone())
    };
    if let Some(mm) = args.mesh_mm {
        for panel in &mut project.template.panels {
            if let Some(polygon) = &mut panel.polygon {
                polygon
                    .meshing
                    .get_or_insert_with(Default::default)
                    .target_edge_m = mm * 0.001;
            }
        }
        project.state = None;
        project.mesh_signature = None;
    }
    let mut scene = project.compile()?;
    fs::create_dir_all(&args.output)?;
    if !args.reference {
        return run_ogc(&args, project, scene);
    }
    let initial_gap = scene.garment.max_seam_gap(&scene.state.x);
    let initial_penetration = scene
        .state
        .x
        .iter()
        .enumerate()
        .map(|(i, p)| {
            scene.collider.penetration(
                *p,
                scene.garment.materials[scene.garment.vertex_material[i]].thickness,
            )
        })
        .fold(0.0, f64::max);
    fs::write(
        args.output.join("initial.obj"),
        export::obj(&scene.garment, &scene.state),
    )?;
    let mut log = fs::File::create(args.output.join("metrics.jsonl"))?;
    let mut converged = 0;
    let mut total_ms = 0.0;
    let mut last = None;
    let mut retries = 0;
    let started = Instant::now();
    let mut failure = None;
    let mut completed = 0;
    for i in 0..args.steps {
        let step_started = Instant::now();
        let (metrics, attempts) = match scene.step(&project.solver) {
            Ok(value) => value,
            Err(error) => {
                failure = Some(error);
                break;
            }
        };
        completed += 1;
        retries += attempts;
        let mut row = serde_json::to_value(&metrics)?;
        row["wall_ms_including_retries"] = (step_started.elapsed().as_secs_f64() * 1000.0).into();
        row["retries"] = attempts.into();
        serde_json::to_writer(&mut log, &row)?;
        writeln!(log)?;
        converged += usize::from(metrics.converged);
        total_ms += metrics.step_ms;
        if i % 10 == 0 || i + 1 == args.steps {
            eprintln!(
                "{}/{} gap={:.2}mm penetration={:.2}mm CPU={:.1}ms converged={}",
                i + 1,
                args.steps,
                1000.0 * metrics.max_seam_gap_m,
                1000.0 * metrics.max_vertex_penetration_m,
                metrics.step_ms,
                metrics.converged
            );
        }
        last = Some(metrics);
    }
    let wall_ms = started.elapsed().as_secs_f64() * 1000.0;
    export::write_artifacts(
        &project.template,
        &scene.garment,
        &scene.state,
        &args.output,
    )?;
    project.state = Some(scene.state.clone());
    project.save(&args.output.join("fitting-project.json"))?;
    let meshes: Vec<_> = project.template.panels.iter().zip(&scene.garment.panels).map(|(panel,range)| {
        let mut settings=panel.polygon.as_ref().map(|p|p.meshing_settings()).unwrap_or_default();
        if let Some(plan)=&mut settings.physics_sizing {
            let material=&scene.garment.materials[range.material];
            plan.bending_nm=[material.bend_warp,material.bend_weft];plan.axis_degrees=material.grain_degrees;
        }
        serde_json::json!({"panel":panel.id,"vertices":range.vertices.len(),"settings":settings,
            "quality":marvelous_cloth::garment::meshing::quality(&scene.garment.mesh.triangles[range.triangles.clone()],&settings)})
    }).collect();
    let report = serde_json::json!({
        "status":if failure.is_some() {"failed"} else {"completed"},
        "error":failure,
        "mode":if project.quasistatic {"incremental assembly relaxation; zero velocity at each accepted step, pseudo-time only"} else {"implicit Euler dynamics"},
        "requested_steps":args.steps,"completed_steps":completed,
        "total_wall_ms_including_retries":wall_ms,"backend":"cpu-f64",
        "avatar_triangles":scene.collider.surface.triangles.len(),
        "meshes":meshes,"retries":retries,"converged_steps":converged,
        "mean_accepted_step_ms":if completed>0 {total_ms/completed as f64} else {0.0},
        "initial_seam_gap_m":initial_gap,"initial_penetration_m":initial_penetration,
        "contact_clearance_m":project.contact_clearance,
        "last_step":last,
        "contact":"discrete vertex/avatar local-signed-distance penalty; no CCD, no friction, no self-collision; face interiors can intersect"
    });
    fs::write(
        args.output.join("run.json"),
        serde_json::to_string_pretty(&report)?,
    )?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    if args.gpu_benchmark {
        #[cfg(feature = "desktop")]
        gpu_bench::run(&scene, &args.output)?;
        #[cfg(not(feature = "desktop"))]
        return Err("Rebuild with default desktop feature for --gpu-benchmark".into());
    }
    if args.view
        || args.ui_smoke
        || args.ui_interaction_smoke
        || args.ui_perf_smoke
        || args.ui_authoring_smoke
    {
        #[cfg(feature = "desktop")]
        fitting_editor::run(
            project,
            scene,
            fitting_editor::DocumentFiles {
                output: args.output,
                source: args.project,
                modified: args.steps > 0 || args.mesh_mm.is_some(),
            },
            args.ui_smoke,
            args.ui_interaction_smoke,
            args.ui_perf_smoke,
            args.ui_authoring_smoke,
        )
        .map_err(|e| e.to_string())?;
        #[cfg(not(feature = "desktop"))]
        return Err("Rebuild with default desktop feature for --view".into());
    }
    if let Some(error) = failure {
        return Err(error.into());
    }
    Ok(())
}
