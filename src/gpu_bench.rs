//! Opt-in renderer benchmark. Timestamp results exclude CPU preparation/readback.
use crate::render::{Camera, DrawModel, Viewport};
use eframe::{egui, egui_wgpu, wgpu};
use marvelous_cloth::fitting::FittingScene;
use std::{path::Path, sync::Arc, time::Instant};

pub fn run(scene: &FittingScene, output: &Path) -> Result<(), Box<dyn std::error::Error>> {
    pollster::block_on(run_async(scene, output))
}
async fn run_async(scene: &FittingScene, output: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            ..Default::default()
        })
        .await?;
    let info = adapter.get_info();
    if info.device_type == wgpu::DeviceType::Cpu {
        return Err(
            "Software adapter selected; refusing to label it a hardware GPU benchmark".into(),
        );
    }
    let features = adapter.features() & wgpu::Features::TIMESTAMP_QUERY;
    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor {
            label: Some("cloth-fit-benchmark"),
            required_features: features,
            ..Default::default()
        })
        .await?;
    let renderer =
        egui_wgpu::Renderer::new(&device, wgpu::TextureFormat::Rgba8Unorm, Default::default());
    let state = egui_wgpu::RenderState {
        adapter: adapter.clone(),
        available_adapters: vec![adapter],
        instance,
        device: device.clone(),
        queue: queue.clone(),
        target_format: wgpu::TextureFormat::Rgba8Unorm,
        renderer: Arc::new(egui::mutex::RwLock::new(renderer)),
        surface_config: egui_wgpu::SurfaceConfig::LOW_LATENCY,
    };
    let mut viewport = Viewport::new(state);
    let timed = viewport.enable_timing();
    let mut camera = Camera {
        yaw: 0.35,
        pitch: 0.12,
        distance: 2.65,
        target: glam::Vec3::new(0.0, 0.91, 0.0),
        ..Default::default()
    };
    let mut gpu = vec![];
    let mut total = vec![];
    for frame in 0..72 {
        let begin = Instant::now();
        viewport.draw_scene(
            [1200, 1200],
            &camera,
            DrawModel {
                optics: None,
                marked_faces: None,
                mesh: &scene.garment.mesh,
                state: &scene.state,
                materials: &scene.garment.materials,
                sphere: None,
                avatar: Some(&scene.collider.surface),
                collider: Some(scene.collider.as_ref()),
                seams: &scene.garment.seams,
            },
            false,
            false,
            false,
        );
        let t = viewport.gpu_time_ms()?;
        device.poll(wgpu::PollType::wait_indefinitely())?;
        if frame >= 12 {
            if let Some(t) = t {
                gpu.push(t);
            }
            total.push(begin.elapsed().as_secs_f64() * 1000.0);
        }
    }
    viewport.capture(&output.join("preview.png"))?;
    for (name, yaw) in [("front", 0.0), ("back", std::f32::consts::PI)] {
        camera.yaw = yaw;
        viewport.draw_scene(
            [1200, 1200],
            &camera,
            DrawModel {
                optics: None,
                marked_faces: None,
                mesh: &scene.garment.mesh,
                state: &scene.state,
                materials: &scene.garment.materials,
                sphere: None,
                avatar: Some(&scene.collider.surface),
                collider: Some(scene.collider.as_ref()),
                seams: &scene.garment.seams,
            },
            false,
            false,
            false,
        );
        viewport.capture(&output.join(format!("{name}.png")))?;
    }
    gpu.sort_by(f64::total_cmp);
    total.sort_by(f64::total_cmp);
    let report = serde_json::json!({"adapter":info.name,"backend":format!("{:?}",info.backend),"device_type":format!("{:?}",info.device_type),"driver":info.driver,"driver_info":info.driver_info,"resolution":[1200,1200],"warmup_frames":12,"measured_frames":60,"avatar_triangles":scene.collider.surface.triangles.len(),"cloth_triangles":scene.garment.mesh.triangles.len(),"timestamp_query":timed,"gpu_render_median_ms":percentile(&gpu,0.5),"gpu_render_p95_ms":percentile(&gpu,0.95),"cpu_prepare_submit_and_wait_median_ms":percentile(&total,0.5),"scope":"Offscreen static 3D render pass; no window presentation, no physics solve, no FPS claim"});
    std::fs::write(
        output.join("gpu-render.json"),
        serde_json::to_string_pretty(&report)?,
    )?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
fn percentile(values: &[f64], p: f64) -> Option<f64> {
    if values.is_empty() {
        None
    } else {
        Some(values[((values.len() - 1) as f64 * p).ceil() as usize])
    }
}
