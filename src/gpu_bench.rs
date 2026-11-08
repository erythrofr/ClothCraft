//! Opt-in renderer benchmark. Timestamp results exclude CPU preparation/readback.
use crate::render::{Camera, DrawModel, Viewport};
use eframe::{egui, egui_wgpu, wgpu};
use marvelous_cloth::fitting::FittingScene;
use marvelous_cloth::garment::appearance::{AlbedoTexture, FabricAppearance};
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
    camera.yaw = 0.;
    let plain = FabricAppearance {
        color_srgb: [255; 3],
        roughness: 0.8,
        albedo: None,
    };
    let textured = FabricAppearance {
        albedo: Some(checker_albedo()),
        ..plain.clone()
    };
    let mut fixture_reports = Vec::new();
    for (name, appearance) in [("albedo-plain", &plain), ("albedo-checker", &textured)] {
        let optics = vec![Some(appearance); scene.garment.materials.len()];
        let mut durations = Vec::new();
        let mut timestamps = Vec::new();
        for frame in 0..8 {
            let begin = Instant::now();
            viewport.draw_scene(
                [1200, 1200],
                &camera,
                DrawModel {
                    optics: Some(&optics),
                    marked_faces: None,
                    mesh: &scene.garment.mesh,
                    state: &scene.state,
                    materials: &scene.garment.materials,
                    sphere: None,
                    avatar: Some(&scene.collider.surface),
                    collider: None,
                    seams: &scene.garment.seams,
                },
                false,
                false,
                false,
            );
            let gpu_ms = viewport.gpu_time_ms()?;
            device.poll(wgpu::PollType::wait_indefinitely())?;
            if frame >= 2 {
                durations.push(begin.elapsed().as_secs_f64() * 1000.);
                if let Some(ms) = gpu_ms {
                    timestamps.push(ms);
                }
            }
        }
        viewport.capture(&output.join(format!("{name}.png")))?;
        durations.sort_by(f64::total_cmp);
        timestamps.sort_by(f64::total_cmp);
        fixture_reports.push(serde_json::json!({
            "name": name, "warmup_frames": 2, "measured_frames": 6,
            "gpu_render_median_ms": percentile(&timestamps, 0.5),
            "cpu_prepare_submit_and_wait_median_ms": percentile(&durations, 0.5),
        }));
    }
    let plain_image = image::open(output.join("albedo-plain.png"))?.to_rgba8();
    let checker_image = image::open(output.join("albedo-checker.png"))?.to_rgba8();
    let changed = changed_pixels(&plain_image, &checker_image)?;
    gpu.sort_by(f64::total_cmp);
    total.sort_by(f64::total_cmp);
    let report = serde_json::json!({"adapter":info.name,"backend":format!("{:?}",info.backend),"device_type":format!("{:?}",info.device_type),"driver":info.driver,"driver_info":info.driver_info,"resolution":[1200,1200],"warmup_frames":12,"measured_frames":60,"avatar_triangles":scene.collider.surface.triangles.len(),"cloth_triangles":scene.garment.mesh.triangles.len(),"timestamp_query":timed,"gpu_render_median_ms":percentile(&gpu,0.5),"gpu_render_p95_ms":percentile(&gpu,0.95),"cpu_prepare_submit_and_wait_median_ms":percentile(&total,0.5),"albedo_fixture":{"variants":fixture_reports,"changed_pixels_rgb_over_2":changed,"interpretation":"Zero can mean hidden or offscreen cloth; a difference is not proof of correct texture filtering."},"scope":"Offscreen static 3D render pass; no window presentation, no physics solve, no FPS claim"});
    std::fs::write(
        output.join("gpu-render.json"),
        serde_json::to_string_pretty(&report)?,
    )?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn checker_albedo() -> AlbedoTexture {
    let mut pixels = Vec::with_capacity(8 * 8 * 4);
    for y in 0..8 {
        for x in 0..8 {
            let value = if (x + y) % 2 == 0 { 235 } else { 25 };
            pixels.extend_from_slice(&[value, value, value, 255]);
        }
    }
    AlbedoTexture {
        width: 8,
        height: 8,
        rgba_srgb: pixels.into(),
        tile_m: [0.12, 0.12],
        rotation_degrees: 0.,
    }
}

fn changed_pixels(a: &image::RgbaImage, b: &image::RgbaImage) -> Result<usize, String> {
    if a.dimensions() != b.dimensions() {
        return Err("Albedo captures have different dimensions".into());
    }
    Ok(a.pixels()
        .zip(b.pixels())
        .filter(|(a, b)| (0..3).any(|i| a[i].abs_diff(b[i]) > 2))
        .count())
}
fn percentile(values: &[f64], p: f64) -> Option<f64> {
    if values.is_empty() {
        None
    } else {
        Some(values[((values.len() - 1) as f64 * p).ceil() as usize])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn albedo_fixture_and_image_difference_are_cpu_only() {
        let texture = checker_albedo();
        texture.validate().unwrap();
        assert_eq!((texture.width, texture.height), (8, 8));
        assert_eq!(
            &texture.rgba_srgb[..8],
            &[235, 235, 235, 255, 25, 25, 25, 255]
        );
        let a = image::RgbaImage::from_pixel(2, 1, image::Rgba([1, 2, 3, 255]));
        let mut b = a.clone();
        b.put_pixel(0, 0, image::Rgba([3, 2, 3, 0]));
        b.put_pixel(1, 0, image::Rgba([1, 2, 6, 255]));
        assert_eq!(changed_pixels(&a, &b).unwrap(), 1);
        assert!(changed_pixels(&a, &image::RgbaImage::new(1, 1)).is_err());
    }
}
