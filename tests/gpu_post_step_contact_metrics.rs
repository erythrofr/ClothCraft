//! Opt-in hardware GPU contract: reported OGC distances refer to accepted
//! Metal positions, not to the previous frame's collision query.
#![cfg(feature="desktop")]
use eframe::wgpu;
use glam::DVec3;
use marvelous_cloth::{gpu_vbd::GpuVbd,vbd::{VbdSettings,VbdSolver}};
mod common;

#[test]
#[ignore="requires hardware Metal GPU; run explicitly with --ignored"]
fn gpu_contact_diagnostics_sample_accepted_positions() {
    let instance=wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
    let adapter=pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference:wgpu::PowerPreference::HighPerformance,..Default::default()
    })).expect("hardware GPU adapter");
    assert_ne!(adapter.get_info().device_type,wgpu::DeviceType::Cpu);
    let (device,queue)=pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).unwrap();
    let gpu=GpuVbd::new(device,queue);
    let (garment,floor)=common::resting_patch(DVec3::ZERO);
    let mut state=garment.initial_state.clone();
    let mut solver=VbdSolver::new(garment,Some(&floor),&state).unwrap();
    let settings=VbdSettings {dt:1. / 60.,..Default::default()};
    let rq=2. * settings.contact.radius;
    let pre=solver.world.clone().detect(&solver.world.positions(&state.x),rq,&settings.contact).unwrap();
    let metrics=gpu.step(&mut solver,&mut state,&settings,None).unwrap();
    let post=solver.world.clone().detect(&solver.world.positions(&state.x),rq,&settings.contact).unwrap();
    assert!((metrics.minimum_distance_m-post.minimum_distance).abs()<1e-10);
    assert_eq!(metrics.contacts,post.active_contacts);
    assert_eq!(metrics.contact_terms,post.contacts.len());
    assert_eq!(metrics.detection_updates,2);
    assert!((pre.minimum_distance-post.minimum_distance).abs()>1e-8,
        "fixture must move relative to the fixed avatar");
    assert!(metrics.step_ms>=metrics.detection_ms);
}
