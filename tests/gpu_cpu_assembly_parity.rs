//! Opt-in numerical parity gate on the SAME Rust source, native avatar and
//! 2D pattern. Tests actual CPU versus GPU cloth seam closure, not timing.
//! This is deliberately ignored while GPU in-solve OGC refresh is unfinished.
#![cfg(feature = "desktop")]

use eframe::wgpu;
use marvelous_cloth::{
    fitting::FittingProject,
    garment::presets::GarmentKind,
    gpu_vbd::GpuVbd,
    vbd::{VbdSettings, VbdSolver},
};
use std::path::PathBuf;

#[test]
#[ignore = "requires Metal GPU; first fix GPU mid-iteration OGC refresh parity"]
fn gpu_matches_cpu_initial_tshirt_assembly() {
    let avatar = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("assets/makehuman/mannequin.obj");
    let scene = FittingProject::basic(GarmentKind::Tshirt, 2, avatar)
        .compile()
        .expect("reproducible avatar and T-shirt mesh");
    let g = scene.garment.clone();
    let mut cpu_state = scene.state.clone();
    let mut gpu_state = scene.state;
    let mut cpu = VbdSolver::new(g.clone(), Some(&scene.collider.surface), &cpu_state)
        .expect("CPU world");
    let mut gpu_solver = VbdSolver::new(g, Some(&scene.collider.surface), &gpu_state)
        .expect("GPU world");
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        ..Default::default()
    }))
    .expect("hardware GPU adapter");
    assert_ne!(adapter.get_info().device_type, wgpu::DeviceType::Cpu);
    let (device, queue) =
        pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default()))
            .expect("GPU device");
    let gpu = GpuVbd::new(device, queue);
    let settings = VbdSettings { dt: 1. / 60., iterations: 16, ..Default::default() };
    for step in 0..3 {
        let cm = cpu.step(&mut cpu_state, &settings, None).expect("CPU cloth step");
        let gm = gpu.step(&mut gpu_solver, &mut gpu_state, &settings, None)
            .expect("Metal cloth step");
        let difference_mm = 1000. * (cm.max_seam_gap_m - gm.max_seam_gap_m).abs();
        eprintln!(
            "initial T-shirt assembly step {}: CPU {:.3} mm, GPU {:.3} mm, \
             delta {:.3} mm, CPU OGC {}, GPU OGC {}",
            step + 1,
            cm.max_seam_gap_m * 1000.,
            gm.max_seam_gap_m * 1000.,
            difference_mm,
            cm.detection_updates,
            gm.detection_updates
        );
        assert!(
            difference_mm <= 5.,
            "CPU/GPU initial T-shirt seam parity failed after step {}: \
             {difference_mm:.3} mm separation, required <=5 mm. \
             Faster GPU wall time is not equivalent-quality cloth performance",
            step + 1
        );
    }
}
