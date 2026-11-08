//! Opt-in CPU experiment; the native UI uses the same numerical implementation.
use clap::Parser;
use marvelous_cloth::mesh_resolution::{Experiment, Preset, artifacts};
use std::{fs, path::PathBuf};

#[derive(Parser)]
#[command(about = "Independent physics-inspired rest-space mesh sizing experiment (CPU only)")]
struct Args {
    /// Write a native fitting project with a hanging, physically gathered panel.
    #[arg(long)]
    simulation_demo: Option<PathBuf>,
    /// Saved research JSON input overrides the preset.
    #[arg(long)]
    input: Option<PathBuf>,
    #[arg(long, default_value = "shirring", value_parser=["shirring","skirt","sleeve"])]
    preset: String,
    #[arg(long, default_value = "output/pie-resolution")]
    output: PathBuf,
    /// Compare against uniform base-minimum and uniform source-minimum spacings.
    #[arg(long)]
    compare: bool,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    if let Some(path) = args.simulation_demo {
        let avatar =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
        let project = marvelous_cloth::mesh_resolution::preparation::simulation_demo(avatar)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        project.save(&path)?;
        println!("Prepared simulation example: {}", path.display());
        return Ok(());
    }
    let input: Experiment = if let Some(path) = args.input {
        if fs::metadata(&path)?.len() > 1_048_576 {
            return Err("Research input exceeds 1 MiB".into());
        }
        serde_json::from_slice(&fs::read(path)?)?
    } else {
        Experiment::preset(match args.preset.as_str() {
            "skirt" => Preset::Skirt,
            "sleeve" => Preset::Sleeve,
            _ => Preset::Shirring,
        })?
    };
    let comparison = input.generate(args.compare)?;
    artifacts::write_comparison(&args.output, &input, &comparison)?;
    for run in &comparison.runs {
        println!(
            "{}: {} vertices, {} triangles, {:.3} ms (complete CPU mesh generation)",
            run.name,
            run.output.quality.vertices,
            run.output.quality.triangles,
            run.mesh_generation_ms
        );
    }
    if let Some(percent) = comparison.vertex_reduction_percent() {
        println!("Adaptive vertex reduction vs uniform fine: {percent:.1}%");
    }
    println!("Mesh previews: {}", args.output.display());
    Ok(())
}
