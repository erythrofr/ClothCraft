//! Hybrid backend: f64 CPU OGC detection/bounds; f32 GPU VBD local solves.
//! Explicitly NOT a fully GPU-resident OGC pipeline. Timings include readback.
use crate::{
    model::State,
    ogc::potential::Kind,
    vbd::{Grab, VbdMetrics, VbdSettings, VbdSolver},
};
use eframe::wgpu;
mod cache;
use crate::garment::CompiledGarment;
use cache::Resources;
use glam::DVec3;
use std::cell::RefCell;
use std::{sync::Arc, time::Instant};
pub struct GpuVbd {
    device: wgpu::Device,
    queue: wgpu::Queue,
    pipeline: wgpu::ComputePipeline,
    predict: wgpu::ComputePipeline,
    probe: wgpu::ComputePipeline,
    layout: wgpu::BindGroupLayout,
    pub check_gradients: bool,
    resources: RefCell<Resources>,
    prepared: RefCell<Option<Prepared>>,
}
#[derive(Clone, Copy)]
#[repr(C)]
struct Term {
    ids: [u32; 4],
    info: [u32; 4],
    a: [f32; 4],
    b: [f32; 4],
    c: [f32; 4],
    d: [f32; 4],
}
// All fields are 4-lane arrays; repr(C) has no padding and the WGSL stride is 96.
unsafe impl bytemuck::Zeroable for Term {}
unsafe impl bytemuck::Pod for Term {}
impl Term {
    fn new(ids: &[usize], kind: u32) -> Self {
        let mut t = Self {
            ids: [0; 4],
            info: [kind, ids.len() as u32, 0, 0],
            a: [0.; 4],
            b: [0.; 4],
            c: [0.; 4],
            d: [0.; 4],
        };
        for (i, v) in ids.iter().enumerate() {
            t.ids[i] = *v as u32;
        }
        t
    }
}
impl GpuVbd {
    pub fn new(device: wgpu::Device, queue: wgpu::Queue) -> Self {
        let entries: Vec<_> = (0..9)
            .map(|i| wgpu::BindGroupLayoutEntry {
                binding: i,
                visibility: wgpu::ShaderStages::COMPUTE,
                ty: wgpu::BindingType::Buffer {
                    ty: if i == 7 {
                        wgpu::BufferBindingType::Uniform
                    } else {
                        wgpu::BufferBindingType::Storage {
                            read_only: i != 0 && i != 8,
                        }
                    },
                    has_dynamic_offset: i == 7,
                    min_binding_size: None,
                },
                count: None,
            })
            .collect();
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("VBD layout"),
            entries: &entries,
        });
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("VBD pipeline layout"),
            bind_group_layouts: &[Some(&layout)],
            immediate_size: 0,
        });
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("VBD + OGC compute"),
            source: wgpu::ShaderSource::Wgsl(include_str!("vbd.wgsl").into()),
        });
        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("VBD local solve"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("iterate"),
            compilation_options: Default::default(),
            cache: None,
        });
        let probe = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("VBD force validation"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("probe"),
            compilation_options: Default::default(),
            cache: None,
        });
        let predict = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("VBD conservative inertial prediction"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("predict"),
            compilation_options: Default::default(),
            cache: None,
        });
        let resources = RefCell::new(Resources::new(&device));
        Self {
            resources,
            prepared: RefCell::new(None),
            device,
            queue,
            pipeline,
            predict,
            probe,
            layout,
            check_gradients: false,
        }
    }
    pub fn step(
        &self,
        solver: &mut VbdSolver,
        state: &mut State,
        settings: &VbdSettings,
        grab: Option<&Grab>,
    ) -> Result<VbdMetrics, String> {
        settings.validate()?;
        let start = Instant::now();
        let n = state.x.len();
        let x = solver.world.positions(&state.x);
        if n != solver.world.moving
            || !state.time.is_finite()
            || state.v.len() != n
            || x.iter().chain(&state.v).any(|p| !p.is_finite())
        {
            return Err("Invalid GPU VBD state".into());
        }
        if let Some(g) = grab
            && (g.vertices.iter().any(|i| *i >= n)
                || !g.target.is_finite()
                || !g.stiffness.is_finite()
                || g.stiffness <= 0.
                || g.weights.iter().any(|w| !w.is_finite() || *w < 0.)
                || (g.weights.iter().sum::<f64>() - 1.).abs() > 1e-8)
        {
            return Err("Invalid GPU mouse attachment".into());
        }
        let dt = settings.dt;
        // Work near the cloth, not the world origin: f32 contact gaps must not
        // lose precision merely because the garment sits at shoulder height.
        let origin = state.x.iter().copied().sum::<DVec3>() / n as f64;
        let old_velocity = state.v.clone();
        let guess = solver.prediction.guess(state, settings);
        let damp = 1. + settings.damping * dt;
        let motion = state
            .v
            .iter()
            .map(|v| ((*v * dt + settings.gravity * dt * dt) / damp).length())
            .fold(0., f64::max);
        // A bounded query controls broad-phase work. This can slow convergence,
        // never enlarge the allowable movement beyond a conservative ball.
        let rq = (settings.contact.radius + motion)
            .clamp(settings.contact.radius * 2., settings.contact.radius * 4.);
        let contacts = solver.world.detect(&x, rq, &settings.contact)?;
        if contacts.minimum_distance < 2e-6 {
            return Err("GPU OGC separation below f32 safety margin (2 micrometres); use f64 reference or reset".into());
        }
        let colors = solver.colors(&contacts, grab);
        let detection_ms = start.elapsed().as_secs_f64() * 1000.;
        let g = &solver.garment;
        let mut prepared = self.prepared.borrow_mut();
        if prepared
            .as_ref()
            .is_none_or(|p| !Arc::ptr_eq(&p.garment, g))
        {
            *prepared = Some(Prepared::new(g.clone()));
        }
        let prepared = prepared.as_ref().unwrap();
        let mut terms = prepared.terms.clone();
        for c in &contacts.contacts {
            let kind = match c.kind {
                Kind::PointPoint => 10,
                Kind::PointEdge => 11,
                Kind::PointFace => 12,
                Kind::EdgeEdge => 13,
            };
            let mut t = Term::new(&c.vertices[..c.count], kind);
            t.a = [
                settings.contact.radius as f32,
                settings.contact.stiffness as f32,
                c.mollifier_epsilon as f32,
                0.,
            ];
            terms.push(t);
        }
        if let Some(grab) = grab {
            let mut t = Term::new(&grab.vertices, 2);
            for i in 0..3 {
                t.a[i] = grab.weights[i] as f32;
            }
            t.b[0] = grab.stiffness as f32;
            let target = grab.target - origin;
            t.c = [target.x as f32, target.y as f32, target.z as f32, 1.];
            terms.push(t);
        }
        let mut adjacency = vec![Vec::new(); n];
        for (i, t) in terms.iter().enumerate().skip(prepared.terms.len()) {
            for v in &t.ids[..t.info[1] as usize] {
                if (*v as usize) < n {
                    adjacency[*v as usize].push(i as u32);
                }
            }
        }
        let mut ranges = Vec::new();
        let mut incident =
            Vec::with_capacity(prepared.incident.len() + contacts.contacts.len() * 4 + 12);
        for (v, a) in adjacency.into_iter().enumerate() {
            let start = incident.len() as u32;
            incident.extend_from_slice(
                &prepared.incident[prepared.ranges[v][0]..prepared.ranges[v][1]],
            );
            incident.extend(a);
            ranges.push([start, incident.len() as u32]);
        }
        let positions: Vec<_> = x
            .iter()
            .enumerate()
            .map(|(i, p)| {
                let p = *p - origin;
                [
                    p.x as f32,
                    p.y as f32,
                    p.z as f32,
                    if i >= n || g.mesh.pins[i].is_some() {
                        1.
                    } else {
                        0.
                    },
                ]
            })
            .collect();
        let targets: Vec<_> = (0..n)
            .map(|i| {
                let t = state.x[i] - origin + (state.v[i] * dt + settings.gravity * dt * dt) / damp;
                [
                    t.x as f32,
                    t.y as f32,
                    t.z as f32,
                    (g.mesh.masses[i] * damp / (dt * dt)) as f32,
                ]
            })
            .collect();
        let balls: Vec<_> = (0..n)
            .map(|i| {
                let p = contacts.centers[i] - origin;
                let roundoff = 16. * f32::EPSILON as f64 * p.abs().max_element().max(1.);
                let guess = guess[i] - origin;
                [
                    p.x as f32,
                    p.y as f32,
                    p.z as f32,
                    (contacts.radii[i] - roundoff).max(0.) as f32,
                    guess.x as f32,
                    guess.y as f32,
                    guess.z as f32,
                    0.,
                ]
            })
            .collect();
        let mut order = Vec::new();
        let mut configs = Vec::new();
        for color in &colors {
            configs.push([order.len() as u32, color.len() as u32, n as u32, 0]);
            order.extend(color.iter().map(|i| *i as u32));
        }
        let alignment = self.device.limits().min_uniform_buffer_offset_alignment as usize;
        let mut config_data = vec![0u8; alignment * configs.len()];
        for (i, c) in configs.iter().enumerate() {
            config_data[i * alignment..i * alignment + 16].copy_from_slice(bytemuck::cast_slice(c));
        }
        let mut resources = self.resources.borrow_mut();
        resources.prepare(
            &self.device,
            &self.queue,
            &self.layout,
            [
                bytemuck::cast_slice(&positions),
                bytemuck::cast_slice(&targets),
                bytemuck::cast_slice(&ranges),
                bytemuck::cast_slice(&terms),
                bytemuck::cast_slice(&incident),
                bytemuck::cast_slice(&balls),
                bytemuck::cast_slice(&order),
                &config_data,
            ],
            n,
        );
        let buffers = &resources.buffers;
        let bind = resources.bind.as_ref().unwrap();
        if self.check_gradients {
            use crate::math::Jet;
            let read = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("force checks"),
                size: (n * 16) as u64,
                usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            let mut e = self.device.create_command_encoder(&Default::default());
            {
                let mut p = e.begin_compute_pass(&Default::default());
                p.set_pipeline(&self.probe);
                p.set_bind_group(0, bind, &[0]);
                p.dispatch_workgroups(n as u32, 1, 1);
            }
            e.copy_buffer_to_buffer(&buffers[8], 0, &read, 0, (n * 16) as u64);
            self.queue.submit([e.finish()]);
            let (tx, rx) = std::sync::mpsc::channel();
            read.map_async(wgpu::MapMode::Read, .., move |r| {
                let _ = tx.send(r);
            });
            self.device
                .poll(wgpu::PollType::wait_indefinitely())
                .map_err(|e| e.to_string())?;
            rx.recv()
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?;
            let data = read.get_mapped_range(..).map_err(|e| e.to_string())?;
            let probes: &[[f32; 4]] = bytemuck::cast_slice(&data);
            // Compare at IDENTICAL rounded geometry/targets, so this checks the
            // GPU formulas, not the f32 quantization of a stiff rest state.
            let rounded: Vec<_> = positions
                .iter()
                .map(|p| DVec3::new(p[0] as f64, p[1] as f64, p[2] as f64) + origin)
                .collect();
            let mut max_error = 0.0_f64;
            for i in 0..n {
                let j = solver.local(
                    i,
                    std::array::from_fn(|k| Jet::<3>::variable(rounded[i][k], k)),
                    &rounded,
                    &contacts,
                    settings,
                    grab,
                );
                let target = DVec3::new(
                    targets[i][0] as f64,
                    targets[i][1] as f64,
                    targets[i][2] as f64,
                ) + origin;
                let g = DVec3::from_array(j.g) + (rounded[i] - target) * targets[i][3] as f64;
                let actual = DVec3::new(
                    probes[i][0] as f64,
                    probes[i][1] as f64,
                    probes[i][2] as f64,
                );
                let error = (actual - g).length();
                if !error.is_finite() || error > 0.003 + 0.003 * g.length() {
                    return Err(format!(
                        "GPU gradient mismatch at {i}: {actual:?} vs {g:?}, error {error}"
                    ));
                }
                max_error = max_error.max(error);
                let energy =
                    j.v + 0.5 * targets[i][3] as f64 * (rounded[i] - target).length_squared();
                if (energy - probes[i][3] as f64).abs() > 1e-5 + 0.001 * energy.abs() {
                    return Err(format!("GPU energy mismatch at {i}"));
                }
            }
            eprintln!(
                "GPU/CPU local gradients verified: {n} vertices, maximum absolute error {max_error:.3e} N"
            );
            drop(data);
            read.unmap();
        }
        let query = &resources.query;
        let resolve = &resources.resolve;
        let read = &resources.read;
        let mut encoder = self.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("VBD iterations"),
                timestamp_writes: query.as_ref().map(|q| wgpu::ComputePassTimestampWrites {
                    query_set: q,
                    beginning_of_pass_write_index: Some(0),
                    end_of_pass_write_index: Some(1),
                }),
            });
            // Same warm start as CPU VBD, clipped to the original detection
            // balls (including the f32 safety margin). Never reset their centers.
            pass.set_pipeline(&self.predict);
            pass.set_bind_group(0, bind, &[0]);
            pass.dispatch_workgroups((n as u32).div_ceil(64), 1, 1);
            pass.set_pipeline(&self.pipeline);
            for _ in 0..settings.iterations {
                for (i, c) in configs.iter().enumerate() {
                    pass.set_bind_group(0, bind, &[(i * alignment) as u32]);
                    pass.dispatch_workgroups(c[1], 1, 1);
                }
            }
        }
        encoder.copy_buffer_to_buffer(&buffers[0], 0, read, 0, (n * 16) as u64);
        if let (Some(q), Some(resolve)) = (query, resolve) {
            encoder.resolve_query_set(q, 0..2, resolve, 0);
            encoder.copy_buffer_to_buffer(resolve, 0, read, (n * 16) as u64, 16);
        }
        self.queue.submit([encoder.finish()]);
        let (tx, rx) = std::sync::mpsc::channel();
        read.map_async(wgpu::MapMode::Read, .., move |r| {
            let _ = tx.send(r);
        });
        self.device
            .poll(wgpu::PollType::wait_indefinitely())
            .map_err(|e| e.to_string())?;
        rx.recv()
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
        let mapped = read.get_mapped_range(..).map_err(|e| e.to_string())?;
        let gpu_compute_ms = query.as_ref().map(|_| {
            let a = u64::from_le_bytes(mapped[n * 16..n * 16 + 8].try_into().unwrap());
            let b = u64::from_le_bytes(mapped[n * 16 + 8..n * 16 + 16].try_into().unwrap());
            b.wrapping_sub(a) as f64 * self.queue.get_timestamp_period() as f64 / 1e6
        });
        let values: &[[f32; 4]] = bytemuck::cast_slice(&mapped[..n * 16]);
        let new: Vec<_> = values
            .iter()
            .map(|p| DVec3::new(p[0] as f64, p[1] as f64, p[2] as f64) + origin)
            .collect();
        drop(mapped);
        read.unmap();
        for (i, p) in new.iter().enumerate() {
            if !p.is_finite() || p.distance(contacts.centers[i]) > contacts.radii[i] + 1e-8 {
                return Err("GPU OGC trust-region check failed; state unchanged".into());
            }
        }
        // Final diagnostics are evaluated against the actual f32 GPU result
        // reconstructed in f64. Initial OGC detection belongs to the incoming
        // state and would misreport final gaps/contact counts after motion.
        let post_detection_start = Instant::now();
        let final_x = solver.world.positions(&new);
        let final_contacts = solver.world.detect(&final_x, rq, &settings.contact)?;
        if final_contacts.minimum_distance < 2e-6 {
            return Err("GPU OGC final separation below f32 safety margin; state unchanged".into());
        }
        let detection_ms = detection_ms + post_detection_start.elapsed().as_secs_f64() * 1000.;
        let mut contact_profile = contacts.profile;
        contact_profile += final_contacts.profile;
        for (i, position) in new.iter().enumerate() {
            if g.mesh.pins[i].is_none() {
                state.v[i] = (*position - state.x[i]) / dt;
                state.x[i] = *position;
            } else {
                state.v[i] = DVec3::ZERO;
            }
        }
        state.time += dt;
        solver.prediction.record(&old_velocity, state, settings);
        let [extension_p95_percent, extension_max_percent] =
            crate::garment::diagnostics::extension_percent(g, state);
        let step_ms = start.elapsed().as_secs_f64() * 1000.;
        Ok(VbdMetrics {
            time_s: state.time,
            dt_s: dt,
            step_ms,
            detection_ms,
            contact_profile,
            solve_ms: step_ms - detection_ms,
            gpu_compute_ms,
            iterations: settings.iterations,
            contacts: final_contacts.active_contacts,
            contact_terms: final_contacts.contacts.len(),
            detection_updates: 2,
            broad_phase_rebuilds: usize::from(contacts.broad_phase_rebuilt)
                + usize::from(final_contacts.broad_phase_rebuilt),
            minimum_distance_m: final_contacts.minimum_distance,
            max_seam_gap_m: g.max_seam_gap(&state.x),
            extension_p95_percent,
            extension_max_percent,
            ..Default::default()
        })
    }
}

/// Rest geometry/material packing and static incidence survive time steps. The
/// retained Arc prevents in-place mutation and pointer reuse; remeshing or a new
/// garment automatically invalidates the cache.
struct Prepared {
    garment: Arc<CompiledGarment>,
    terms: Vec<Term>,
    ranges: Vec<[usize; 2]>,
    incident: Vec<u32>,
}
impl Prepared {
    fn new(garment: Arc<CompiledGarment>) -> Self {
        let g = &garment;
        let mut terms = Vec::new();
        for tri in &g.mesh.triangles {
            let m = &g.materials[tri.material];
            let (s, c) = m.grain_degrees.to_radians().sin_cos();
            let u = tri.inv_dm.x_axis * c + tri.inv_dm.y_axis * s;
            let v = -tri.inv_dm.x_axis * s + tri.inv_dm.y_axis * c;
            let mut t = Term::new(&tri.vertices, 0);
            t.a = [(-u.x - u.y) as f32, u.x as f32, u.y as f32, tri.area as f32];
            t.b = [(-v.x - v.y) as f32, v.x as f32, v.y as f32, m.warp as f32];
            t.c = [
                m.weft as f32,
                m.shear as f32,
                m.compression_ratio as f32,
                m.compression_transition as f32,
            ];
            terms.push(t);
        }
        for h in &g.mesh.hinges {
            let m = &g.materials[h.material];
            let (s, c) = m.grain_degrees.to_radians().sin_cos();
            let aw = h.across.x * c + h.across.y * s;
            let af = -h.across.x * s + h.across.y * c;
            let mut t = Term::new(&h.vertices, 1);
            t.a[0] = (h.weight * (m.bend_warp * aw * aw + m.bend_weft * af * af)) as f32;
            terms.push(t);
        }
        for seam in &g.seams {
            for s in &seam.samples {
                let mut t = Term::new(
                    &s.point.terms.iter().map(|(i, _)| *i).collect::<Vec<_>>(),
                    2,
                );
                for (i, (_, w)) in s.point.terms.iter().enumerate() {
                    t.a[i] = *w as f32;
                }
                t.b[0] = (s.weight_m * seam.stiffness) as f32;
                terms.push(t);
            }
        }

        let mut adjacency = vec![Vec::new(); g.mesh.uv.len()];
        for (i, t) in terms.iter().enumerate() {
            for v in &t.ids[..t.info[1] as usize] {
                adjacency[*v as usize].push(i as u32);
            }
        }
        let mut incident = Vec::new();
        let mut ranges = Vec::new();
        for row in adjacency {
            let start = incident.len();
            incident.extend(row);
            ranges.push([start, incident.len()]);
        }
        Self {
            garment,
            terms,
            ranges,
            incident,
        }
    }
}
