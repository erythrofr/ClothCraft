//! A depth-buffered wgpu viewport. CPU FEM is entirely independent of this module.
use crate::{
    avatar::SurfaceMesh,
    contact::{Collider, Sphere},
    energy,
    garment::seam::CompiledSeam,
    model::{Material, Mesh, State},
    project::Project,
};
use eframe::{egui, egui_wgpu::RenderState, wgpu};
use glam::{Mat4, Vec3};

pub mod appearance;
mod environment;

pub struct DrawModel<'a> {
    pub marked_faces: Option<&'a std::collections::BTreeSet<usize>>,
    pub mesh: &'a Mesh,
    pub state: &'a State,
    pub materials: &'a [Material],
    pub optics: Option<&'a [Option<&'a crate::garment::appearance::FabricAppearance>]>,
    pub sphere: Option<&'a Sphere>,
    pub avatar: Option<&'a SurfaceMesh>,
    pub collider: Option<&'a dyn Collider>,
    pub seams: &'a [CompiledSeam],
}
const VERTEX_FLOATS: usize = 18;
const ALBEDO_SIZE: u32 = 256;
const ALBEDO_LEVELS: u32 = 9;

/// Filter opaque sRGB texture pixels in linear light. The caller supplies a
/// square, power-of-two image; levels are generated only when a map changes.
fn albedo_mip_chain(base: Vec<u8>, size: u32) -> Vec<Vec<u8>> {
    debug_assert!(size.is_power_of_two() && base.len() == size as usize * size as usize * 4);
    let mut linear = [0.0_f32; 256];
    for (i, value) in linear.iter_mut().enumerate() {
        let s = i as f32 / 255.;
        *value = if s <= 0.04045 {
            s / 12.92
        } else {
            ((s + 0.055) / 1.055).powf(2.4)
        };
    }
    let mut chain = vec![base];
    let mut width = size as usize;
    while width > 1 {
        let src = chain.last().expect("base mip");
        let next_width = width / 2;
        let mut next = vec![255u8; next_width * next_width * 4];
        for y in 0..next_width {
            for x in 0..next_width {
                for channel in 0..3 {
                    let mut sum = 0.;
                    for dy in 0..2 {
                        for dx in 0..2 {
                            sum += linear
                                [src[((y * 2 + dy) * width + x * 2 + dx) * 4 + channel] as usize];
                        }
                    }
                    let c = sum * 0.25;
                    let s = if c <= 0.0031308 {
                        c * 12.92
                    } else {
                        1.055 * c.powf(1. / 2.4) - 0.055
                    };
                    next[(y * next_width + x) * 4 + channel] =
                        (s.clamp(0., 1.) * 255.).round() as u8;
                }
            }
        }
        chain.push(next);
        width = next_width;
    }
    chain
}

fn valid_albedo(
    map: &crate::garment::appearance::AlbedoTexture,
    cache: &[crate::garment::appearance::AlbedoTexture],
) -> bool {
    map.validate_parameters().is_ok()
        && (cache.iter().any(|cached| {
            cached.width == map.width
                && cached.height == map.height
                && std::sync::Arc::ptr_eq(&cached.rgba_srgb, &map.rgba_srgb)
        }) || map.validate().is_ok())
}

fn same_albedo_pixels(
    a: &crate::garment::appearance::AlbedoTexture,
    b: &crate::garment::appearance::AlbedoTexture,
) -> bool {
    a.width == b.width
        && a.height == b.height
        && (std::sync::Arc::ptr_eq(&a.rgba_srgb, &b.rgba_srgb) || a.rgba_srgb == b.rgba_srgb)
}

fn cloth_surface(
    appearance: Option<&crate::garment::appearance::FabricAppearance>,
    marked: bool,
    contact: bool,
    strain: Option<f64>,
) -> ([f32; 3], f32) {
    if marked {
        return ([1.0, 0.23, 0.10], -1.);
    }
    if contact {
        return ([1.0, 0.2, 0.25], -1.);
    }
    if let Some(strain) = strain {
        let v = (strain / 0.1).clamp(0., 1.) as f32;
        return (
            [0.15 + 0.8 * v, 0.75 * (1.0 - v) + 0.15, 0.95 * (1.0 - v)],
            -1.,
        );
    }
    appearance.map_or(([0.91, 0.92, 0.94], -1.), |a| {
        (a.linear_color(), a.roughness as f32)
    })
}

struct Timers {
    query: wgpu::QuerySet,
    resolve: wgpu::Buffer,
    read: wgpu::Buffer,
}

/// Vertical field of view of the perspective projection, shared with the
/// orthographic framing so switching projection does not resize the scene.
const FOV_Y: f32 = 45.0 * std::f32::consts::PI / 180.;
const NEAR: f32 = 0.01;
const FAR: f32 = 100.;
const MIN_DISTANCE: f32 = 0.15;
const MAX_DISTANCE: f32 = 30.;
/// Orbit sensitivity: radians of rotation per pixel of pointer drag.
const ORBIT_RADIANS_PER_PIXEL: f32 = 0.008;
/// Orbit stops exactly at the poles. [`Camera::up`] stays defined there, so the
/// Top and Bottom presets are exact instead of a near-pole approximation.
const MAX_PITCH: f32 = std::f32::consts::FRAC_PI_2;

/// Canonical viewing directions offered by the 3D view bar.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PresetView {
    Isometric,
    Front,
    Back,
    Left,
    Right,
    Top,
    Bottom,
}
impl PresetView {
    /// Every preset, in the order the view bar shows them.
    pub const ALL: [Self; 7] = [
        Self::Isometric,
        Self::Front,
        Self::Back,
        Self::Left,
        Self::Right,
        Self::Top,
        Self::Bottom,
    ];
    /// Short control label.
    pub fn label(self) -> &'static str {
        match self {
            Self::Isometric => "Iso",
            Self::Front => "Front",
            Self::Back => "Back",
            Self::Left => "Left",
            Self::Right => "Right",
            Self::Top => "Top",
            Self::Bottom => "Bottom",
        }
    }
    /// Unit direction from the target towards the eye.
    pub fn direction(self) -> Vec3 {
        match self {
            Self::Isometric => Vec3::ONE.normalize(),
            Self::Front => Vec3::Z,
            Self::Back => Vec3::NEG_Z,
            Self::Left => Vec3::NEG_X,
            Self::Right => Vec3::X,
            Self::Top => Vec3::Y,
            Self::Bottom => Vec3::NEG_Y,
        }
    }
    /// Yaw and pitch that produce [`Self::direction`], exact at the poles.
    pub fn angles(self) -> (f32, f32) {
        let d = self.direction();
        (d.x.atan2(d.z), d.y.clamp(-1., 1.).asin())
    }
}
/// A camera pose the view bar can come back to.
#[derive(Clone, Copy)]
pub struct CameraPose {
    yaw: f32,
    pitch: f32,
    distance: f32,
    target: Vec3,
    orthographic: bool,
}
/// Orbit camera for the 3D viewport.
///
/// Every field is public on purpose. The authoring adapters write the orbit
/// fields directly, and the view-history fields must stay reachable from the
/// binary targets: `cloth-fit` includes `atelier.rs` in the *bin* crate but links
/// `render` from this *library* crate, so `pub(crate)` would not cross that
/// boundary. Treat the history fields as internal state and use
/// [`Camera::save_pose`], [`Camera::restore_pose`] and [`Camera::request_frame`]
/// instead of writing them, and prefer [`Camera::new`] over a bare literal.
pub struct Camera {
    pub yaw: f32,
    pub pitch: f32,
    pub distance: f32,
    pub target: Vec3,
    /// Orthographic projection matched to the perspective framing at the target.
    pub orthographic: bool,
    /// Pose remembered by the view bar's Restore button.
    pub saved: Option<CameraPose>,
    /// Bounding sphere the next viewport interaction pass should frame. The
    /// request waits because the viewport rectangle is only known once the
    /// canvas has been allocated.
    pub pending_frame: Option<(Vec3, f32)>,
}
impl Default for Camera {
    fn default() -> Self {
        Self {
            yaw: 0.55,
            pitch: 0.4,
            distance: 2.5,
            target: Vec3::new(0.0, 0.4, 0.0),
            orthographic: false,
            saved: None,
            pending_frame: None,
        }
    }
}
impl Camera {
    /// Build a camera from its orbit fields; the view history starts empty.
    /// Equivalent to `Camera { yaw, pitch, distance, target, ..Default::default() }`.
    pub fn new(yaw: f32, pitch: f32, distance: f32, target: Vec3) -> Self {
        Self {
            yaw,
            pitch,
            distance,
            target,
            ..Default::default()
        }
    }
    /// Half-height of the view volume per unit of camera distance.
    fn half_tan() -> f32 {
        (FOV_Y * 0.5).tan()
    }
    fn pose(&self) -> CameraPose {
        CameraPose {
            yaw: self.yaw,
            pitch: self.pitch,
            distance: self.distance,
            target: self.target,
            orthographic: self.orthographic,
        }
    }
    fn set_pose(&mut self, pose: CameraPose) {
        self.yaw = pose.yaw;
        self.pitch = pose.pitch;
        self.distance = pose.distance;
        self.target = pose.target;
        self.orthographic = pose.orthographic;
    }
    /// Unit vector from the target towards the eye.
    pub fn direction(&self) -> Vec3 {
        let (sy, cy) = self.yaw.sin_cos();
        let (sp, cp) = self.pitch.sin_cos();
        Vec3::new(sy * cp, sp, cy * cp)
    }
    pub fn eye(&self) -> Vec3 {
        self.target + self.distance * self.direction()
    }
    /// View direction, from the eye towards the target.
    pub fn forward(&self) -> Vec3 {
        -self.direction()
    }
    /// Camera up: world Y made perpendicular to the view direction. The value is
    /// continuous across the poles, so Top and Bottom never degenerate.
    pub fn up(&self) -> Vec3 {
        let (sy, cy) = self.yaw.sin_cos();
        let (sp, cp) = self.pitch.sin_cos();
        Vec3::new(-sp * sy, cp, -sp * cy)
    }
    /// Screen-right vector, matching the rendered image.
    pub fn right(&self) -> Vec3 {
        self.forward().cross(self.up()).normalize_or_zero()
    }
    pub fn matrix(&self, aspect: f32) -> Mat4 {
        // WebGPU uses a [0,1] depth range and Y-up NDC on every backend.
        let view = glam::camera::rh::view::look_at_mat4(self.eye(), self.target, self.up());
        let projection = if self.orthographic {
            // Match the perspective framing at the target plane so switching
            // projection keeps the same apparent size.
            let half = self.distance * Self::half_tan();
            glam::camera::rh::proj::directx::orthographic(
                -half * aspect,
                half * aspect,
                -half,
                half,
                NEAR,
                FAR,
            )
        } else {
            glam::camera::rh::proj::directx::perspective(45.0_f32.to_radians(), aspect, NEAR, FAR)
        };
        projection * view
    }
    /// Project a world point into window coordinates; `None` behind the camera.
    pub fn project(&self, world: Vec3, rect: egui::Rect) -> Option<egui::Pos2> {
        let width = rect.width().max(1.);
        let height = rect.height().max(1.);
        let clip = self.matrix(width / height) * world.extend(1.);
        if clip.w <= 1e-6 {
            return None;
        }
        let ndc = clip.truncate() / clip.w;
        Some(egui::pos2(
            rect.left() + (ndc.x * 0.5 + 0.5) * width,
            rect.top() + (0.5 - ndc.y * 0.5) * height,
        ))
    }
    /// Orbit by a pointer drag in pixels.
    pub fn orbit_by(&mut self, delta: egui::Vec2) {
        self.yaw -= delta.x * ORBIT_RADIANS_PER_PIXEL;
        self.pitch = (self.pitch + delta.y * ORBIT_RADIANS_PER_PIXEL).clamp(-MAX_PITCH, MAX_PITCH);
    }
    /// Pan so the scene follows the pointer: the world point under the pointer
    /// moves with it, at the target plane's exact scale.
    pub fn pan_by(&mut self, delta: egui::Vec2, rect: egui::Rect) {
        let world_per_pixel = 2. * self.distance * Self::half_tan() / rect.height().max(1.);
        self.target += (self.right() * -delta.x + self.up() * delta.y) * world_per_pixel;
    }
    /// Multiply the camera distance, clamped to the working range.
    pub fn zoom(&mut self, factor: f32) {
        // `!(factor > 0.)` rejected NaN as well as non-positive factors; spell
        // that out rather than negating a partial-order comparison.
        if factor <= 0. || factor.is_nan() {
            return;
        }
        self.distance = (self.distance * factor).clamp(MIN_DISTANCE, MAX_DISTANCE);
    }
    /// Zoom while keeping the world point under the cursor exactly in place.
    pub fn zoom_at(&mut self, cursor: egui::Pos2, rect: egui::Rect, factor: f32) {
        if factor <= 0. || factor.is_nan() {
            return;
        }
        let anchor = self.focal_point(cursor, rect);
        let distance = (self.distance * factor).clamp(MIN_DISTANCE, MAX_DISTANCE);
        let scale = distance / self.distance;
        self.target = anchor + (self.target - anchor) * scale;
        self.distance = distance;
    }
    /// Intersection of the cursor ray with the focal plane through the target.
    fn focal_point(&self, cursor: egui::Pos2, rect: egui::Rect) -> Vec3 {
        let (origin, direction) = self.ray(cursor, rect);
        // `ray` is f64 for picking precision; the camera itself is f32.
        let (origin, direction) = (origin.as_vec3(), direction.as_vec3());
        let forward = self.forward();
        let denominator = direction.dot(forward);
        if denominator.abs() < 1e-6 {
            return self.target;
        }
        origin + direction * ((self.target - origin).dot(forward) / denominator)
    }
    /// Wheel zoom towards the cursor when it is over the viewport.
    fn wheel_zoom(&mut self, response: &egui::Response) {
        if !response.hovered() {
            return;
        }
        let scroll = response.ctx.input(|i| i.smooth_scroll_delta.y);
        if scroll == 0. {
            return;
        }
        let factor = (-scroll * 0.002).exp();
        match response.hover_pos() {
            Some(cursor) => self.zoom_at(cursor, response.rect, factor),
            None => self.zoom(factor),
        }
    }
    /// Ask the next interaction pass to frame this bounding sphere.
    pub fn request_frame(&mut self, center: Vec3, radius: f32) {
        self.pending_frame = Some((center, radius));
    }
    /// Apply a pending frame request with the real viewport rectangle.
    pub fn apply_pending_frame(&mut self, rect: egui::Rect) -> bool {
        match self.pending_frame.take() {
            Some((center, radius)) => {
                self.frame_in(center, radius, rect);
                true
            }
            None => false,
        }
    }
    /// Frame a bounding sphere, keeping the current orbit direction and fitting
    /// both viewport axes.
    pub fn frame_in(&mut self, center: Vec3, radius: f32, rect: egui::Rect) {
        self.save_pose();
        self.target = center;
        let aspect = (rect.width() / rect.height().max(1.)).max(1e-3);
        let half_v = FOV_Y * 0.5;
        let half_h = (half_v.tan() * aspect).atan();
        let half = half_v.min(half_h);
        self.distance = (radius.max(1e-3) * 1.2 / half.sin()).clamp(MIN_DISTANCE, MAX_DISTANCE);
    }
    /// Frame a bounding sphere without a viewport; assumes a square viewport.
    pub fn frame(&mut self, center: Vec3, radius: f32) {
        let rect = egui::Rect::from_min_size(egui::Pos2::ZERO, egui::Vec2::splat(1.));
        self.frame_in(center, radius, rect);
    }
    /// Point the camera along a canonical direction, keeping target and distance.
    pub fn apply_preset(&mut self, view: PresetView) {
        self.save_pose();
        let (yaw, pitch) = view.angles();
        self.yaw = yaw;
        self.pitch = pitch;
    }
    /// Toggle between the matched perspective and orthographic projections.
    pub fn toggle_projection(&mut self) {
        self.orthographic = !self.orthographic;
    }
    /// Return to the default framing while keeping the projection mode.
    pub fn reset_view(&mut self) {
        let default = Self::default();
        self.yaw = default.yaw;
        self.pitch = default.pitch;
        self.distance = default.distance;
        self.target = default.target;
    }
    /// Remember the current pose for [`Self::restore_pose`].
    pub fn save_pose(&mut self) {
        self.saved = Some(self.pose());
    }
    pub fn has_saved_pose(&self) -> bool {
        self.saved.is_some()
    }
    /// Swap the current pose with the remembered one, so Restore toggles.
    pub fn restore_pose(&mut self) -> bool {
        match self.saved.take() {
            Some(saved) => {
                self.saved = Some(self.pose());
                self.set_pose(saved);
                true
            }
            None => false,
        }
    }
    pub fn interact(&mut self, response: &egui::Response) {
        self.apply_pending_frame(response.rect);
        let delta = response.ctx.input(|i| i.pointer.delta());
        if response.dragged_by(egui::PointerButton::Primary) {
            self.orbit_by(delta);
        }
        if response.dragged_by(egui::PointerButton::Secondary)
            || response.dragged_by(egui::PointerButton::Middle)
        {
            self.pan_by(delta, response.rect);
        }
        self.wheel_zoom(response);
        if response.double_clicked() {
            self.reset_view();
        }
    }
    pub fn garment_interact(&mut self, response: &egui::Response) {
        self.apply_pending_frame(response.rect);
        let delta = response.ctx.input(|i| i.pointer.delta());
        if response.dragged_by(egui::PointerButton::Secondary) {
            self.orbit_by(delta);
        }
        if response.dragged_by(egui::PointerButton::Middle) {
            self.pan_by(delta, response.rect);
        }
        self.wheel_zoom(response);
    }
    pub fn ray(&self, position: egui::Pos2, rect: egui::Rect) -> (glam::DVec3, glam::DVec3) {
        let inv = self.matrix(rect.width() / rect.height()).inverse();
        let u = 2. * (position.x - rect.left()) / rect.width() - 1.;
        let v = 1. - 2. * (position.y - rect.top()) / rect.height();
        let a = inv * glam::Vec4::new(u, v, 0., 1.);
        let b = inv * glam::Vec4::new(u, v, 1., 1.);
        let origin = (a.truncate() / a.w).as_dvec3();
        let far = (b.truncate() / b.w).as_dvec3();
        (origin, (far - origin).normalize())
    }
}

pub struct Viewport {
    pub appearance: appearance::Appearance,
    supports_msaa4: bool,
    samples: u32,
    msaa_color: Option<wgpu::TextureView>,
    environment: environment::Environment,
    render_state: RenderState,
    pipeline: wgpu::RenderPipeline,
    color: wgpu::TextureView,
    color_texture: wgpu::Texture,
    depth: wgpu::TextureView,
    size: [u32; 2],
    texture_id: egui::TextureId,
    vertices: wgpu::Buffer,
    capacity: u64,
    timers: Option<Timers>,
    view_uniform: wgpu::Buffer,
    view_bind: wgpu::BindGroup,
    albedo_texture: wgpu::Texture,
    albedo_view: wgpu::TextureView,
    albedo_sampler: wgpu::Sampler,
    albedo_bind: wgpu::BindGroup,
    albedo_cache: Vec<crate::garment::appearance::AlbedoTexture>,
    avatar_buffer: Option<wgpu::Buffer>,
    avatar_key: (usize, usize),
    avatar_count: u32,
}
impl Viewport {
    fn albedo_bind(
        device: &wgpu::Device,
        pipeline: &wgpu::RenderPipeline,
        view: &wgpu::TextureView,
        sampler: &wgpu::Sampler,
    ) -> wgpu::BindGroup {
        device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("fabric albedo maps"),
            layout: &pipeline.get_bind_group_layout(1),
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
            ],
        })
    }
    fn target(device: &wgpu::Device, size: [u32; 2], depth: bool, samples: u32) -> wgpu::Texture {
        device.create_texture(&wgpu::TextureDescriptor {
            label: Some(if depth { "cloth-depth" } else { "cloth-color" }),
            size: wgpu::Extent3d {
                width: size[0],
                height: size[1],
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: samples,
            dimension: wgpu::TextureDimension::D2,
            format: if depth {
                wgpu::TextureFormat::Depth32Float
            } else {
                wgpu::TextureFormat::Rgba8Unorm
            },
            usage: if depth || samples > 1 {
                wgpu::TextureUsages::RENDER_ATTACHMENT
            } else {
                wgpu::TextureUsages::RENDER_ATTACHMENT
                    | wgpu::TextureUsages::TEXTURE_BINDING
                    | wgpu::TextureUsages::COPY_SRC
            },
            view_formats: &[],
        })
    }
    fn mesh_pipeline(device: &wgpu::Device, samples: u32) -> wgpu::RenderPipeline {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("cloth-lit-wireframe"),
            source: wgpu::ShaderSource::Wgsl(include_str!("cloth.wgsl").into()),
        });
        let attrs = wgpu::vertex_attr_array![0=>Float32x4,1=>Float32x3,2=>Float32x4,3=>Float32x3,4=>Float32,5=>Float32x3];
        device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("cloth-viewport"),
            layout: None,
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                compilation_options: Default::default(),
                buffers: &[Some(wgpu::VertexBufferLayout {
                    array_stride: (VERTEX_FLOATS * std::mem::size_of::<f32>()) as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &attrs,
                })],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8Unorm,
                    blend: None,
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState {
                cull_mode: None,
                ..Default::default()
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth32Float,
                depth_write_enabled: Some(true),
                depth_compare: Some(wgpu::CompareFunction::Less),
                stencil: Default::default(),
                bias: Default::default(),
            }),
            multisample: wgpu::MultisampleState {
                count: samples,
                ..Default::default()
            },
            multiview_mask: None,
            cache: None,
        })
    }
    pub fn supports_msaa4(&self) -> bool {
        self.supports_msaa4
    }
    pub fn new(render_state: RenderState) -> Self {
        let device = &render_state.device;
        let supports_msaa4 = [
            wgpu::TextureFormat::Rgba8Unorm,
            wgpu::TextureFormat::Depth32Float,
        ]
        .into_iter()
        .all(|format| {
            render_state
                .adapter
                .get_texture_format_features(format)
                .flags
                .sample_count_supported(4)
        });
        let appearance = appearance::Appearance::default();
        let samples = appearance.samples(supports_msaa4);
        let pipeline = Self::mesh_pipeline(device, samples);
        let environment = environment::Environment::new(device, samples);
        let msaa_color = (samples > 1)
            .then(|| Self::target(device, [1, 1], false, samples).create_view(&Default::default()));
        let color_texture = Self::target(device, [1, 1], false, 1);
        let view_uniform = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("camera matrix"),
            size: 112,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let view_bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("camera"),
            layout: &pipeline.get_bind_group_layout(0),
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: view_uniform.as_entire_binding(),
            }],
        });
        let albedo_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("fabric albedo array"),
            size: wgpu::Extent3d {
                width: ALBEDO_SIZE,
                height: ALBEDO_SIZE,
                depth_or_array_layers: 16,
            },
            mip_level_count: ALBEDO_LEVELS,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let albedo_view = albedo_texture.create_view(&wgpu::TextureViewDescriptor {
            dimension: Some(wgpu::TextureViewDimension::D2Array),
            ..Default::default()
        });
        let albedo_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::MipmapFilterMode::Linear,
            ..Default::default()
        });
        let albedo_bind = Self::albedo_bind(device, &pipeline, &albedo_view, &albedo_sampler);
        let color = color_texture.create_view(&Default::default());
        let depth = Self::target(device, [1, 1], true, samples).create_view(&Default::default());
        let texture_id = render_state.renderer.write().register_native_texture(
            device,
            &color,
            wgpu::FilterMode::Linear,
        );
        let capacity = 1024;
        let vertices = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("viewport-vertices"),
            size: capacity,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        Self {
            appearance,
            supports_msaa4,
            samples,
            msaa_color,
            environment,
            render_state,
            pipeline,
            color,
            color_texture,
            depth,
            size: [1, 1],
            texture_id,
            vertices,
            capacity,
            timers: None,
            view_uniform,
            view_bind,
            albedo_texture,
            albedo_view,
            albedo_sampler,
            albedo_bind,
            albedo_cache: Vec::new(),
            avatar_buffer: None,
            avatar_key: (0, 0),
            avatar_count: 0,
        }
    }
    #[allow(clippy::too_many_arguments)]
    pub fn draw(
        &mut self,
        size: [u32; 2],
        camera: &Camera,
        mesh: &Mesh,
        state: &State,
        p: &Project,
        wire: bool,
        heat: bool,
        contacts: bool,
    ) -> egui::TextureId {
        self.draw_scene(
            size,
            camera,
            DrawModel {
                marked_faces: None,
                mesh,
                state,
                materials: std::slice::from_ref(&p.material),
                optics: None,
                sphere: p.sphere.as_ref(),
                avatar: None,
                collider: p.sphere.as_ref().map(|s| s as &dyn Collider),
                seams: &[],
            },
            wire,
            heat,
            contacts,
        )
    }
    pub fn draw_scene(
        &mut self,
        size: [u32; 2],
        camera: &Camera,
        model: DrawModel<'_>,
        wire: bool,
        heat: bool,
        contacts: bool,
    ) -> egui::TextureId {
        let DrawModel {
            marked_faces,
            mesh,
            state,
            materials,
            optics,
            sphere,
            avatar,
            collider,
            seams,
        } = model;
        let device = &self.render_state.device;
        let max = device.limits().max_texture_dimension_2d.min(4096);
        let size = size.map(|s| s.clamp(1, max));
        let samples = self.appearance.samples(self.supports_msaa4);
        if samples != self.samples {
            self.pipeline = Self::mesh_pipeline(device, samples);
            // Auto pipeline layouts are exclusive: rebuild the matching bind group.
            self.view_bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("camera"),
                layout: &self.pipeline.get_bind_group_layout(0),
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.view_uniform.as_entire_binding(),
                }],
            });
            self.albedo_bind = Self::albedo_bind(
                device,
                &self.pipeline,
                &self.albedo_view,
                &self.albedo_sampler,
            );
            self.environment = environment::Environment::new(device, samples);
        }
        if size != self.size || samples != self.samples {
            self.color_texture = Self::target(device, size, false, 1);
            self.color = self.color_texture.create_view(&Default::default());
            self.depth = Self::target(device, size, true, samples).create_view(&Default::default());
            self.msaa_color = (samples > 1).then(|| {
                Self::target(device, size, false, samples).create_view(&Default::default())
            });
            self.size = size;
            self.samples = samples;
            self.render_state
                .renderer
                .write()
                .update_egui_texture_from_wgpu_texture(
                    device,
                    &self.color,
                    wgpu::FilterMode::Linear,
                    self.texture_id,
                );
        }
        let matrix = camera.matrix(size[0] as f32 / size[1] as f32);
        self.render_state.queue.write_buffer(
            &self.view_uniform,
            0,
            bytemuck::cast_slice(&matrix.to_cols_array()),
        );
        let eye = if camera.orthographic {
            camera.direction().extend(0.)
        } else {
            camera.eye().extend(1.)
        };
        self.render_state.queue.write_buffer(
            &self.view_uniform,
            64,
            bytemuck::cast_slice(&eye.to_array()),
        );
        self.render_state.queue.write_buffer(
            &self.view_uniform,
            80,
            bytemuck::cast_slice(&self.appearance.lighting.uniform()),
        );
        self.environment.update(
            &self.render_state.queue,
            matrix,
            &self.appearance,
            avatar,
            state,
        );
        let mut maps: Vec<&crate::garment::appearance::AlbedoTexture> = Vec::new();
        let layers: Vec<Option<usize>> = optics
            .unwrap_or_default()
            .iter()
            .map(|appearance| {
                let map = appearance.and_then(|a| a.albedo.as_ref())?;
                if !valid_albedo(map, &self.albedo_cache) {
                    return None;
                }
                if let Some(index) = maps.iter().position(|item| same_albedo_pixels(item, map)) {
                    return Some(index);
                }
                if maps.len() == 16 {
                    return None;
                }
                maps.push(map);
                Some(maps.len() - 1)
            })
            .collect();
        if self.albedo_cache.len() != maps.len()
            || !self
                .albedo_cache
                .iter()
                .zip(&maps)
                .all(|(cached, map)| same_albedo_pixels(cached, map))
        {
            for (layer, map) in maps.iter().enumerate() {
                let pixels =
                    image::RgbaImage::from_raw(map.width, map.height, map.rgba_srgb.to_vec())
                        .expect("validated albedo pixel length");
                let pixels = image::imageops::resize(
                    &pixels,
                    ALBEDO_SIZE,
                    ALBEDO_SIZE,
                    image::imageops::FilterType::Nearest,
                );
                for (level, pixels) in albedo_mip_chain(pixels.into_raw(), ALBEDO_SIZE)
                    .iter()
                    .enumerate()
                {
                    let size = ALBEDO_SIZE >> level;
                    self.render_state.queue.write_texture(
                        wgpu::TexelCopyTextureInfo {
                            texture: &self.albedo_texture,
                            mip_level: level as u32,
                            origin: wgpu::Origin3d {
                                x: 0,
                                y: 0,
                                z: layer as u32,
                            },
                            aspect: wgpu::TextureAspect::All,
                        },
                        pixels,
                        wgpu::TexelCopyBufferLayout {
                            offset: 0,
                            bytes_per_row: Some(size * 4),
                            rows_per_image: Some(size),
                        },
                        wgpu::Extent3d {
                            width: size,
                            height: size,
                            depth_or_array_layers: 1,
                        },
                    );
                }
            }
            self.albedo_cache = maps.iter().map(|map| (*map).clone()).collect();
        }
        let mut data = Vec::<f32>::new();
        let mut smooth = vec![Vec3::ZERO; state.x.len()];
        for t in &mesh.triangles {
            let p = t.vertices.map(|i| state.x[i].as_vec3());
            let n = (p[1] - p[0]).cross(p[2] - p[0]);
            for i in t.vertices {
                smooth[i] += n;
            }
        }
        for n in &mut smooth {
            *n = n.normalize_or_zero();
        }
        let mut triangle = |points: [Vec3; 3],
                            color: [f32; 3],
                            wire: bool,
                            normals: Option<[Vec3; 3]>,
                            roughness: f32,
                            texcoords: Option<[glam::Vec2; 3]>,
                            layer: f32| {
            let normal = (points[1] - points[0])
                .cross(points[2] - points[0])
                .normalize_or_zero();
            if normal.length_squared() < 0.5 {
                return;
            }
            for (i, p) in points.into_iter().enumerate() {
                data.extend_from_slice(&p.extend(1.0).to_array());
                data.extend_from_slice(&normals.map_or(normal, |n| n[i]).to_array());
                data.extend_from_slice(&color);
                data.push(if wire { 1.0 } else { 0.0 });
                data.extend_from_slice(&[
                    if i == 0 { 1.0 } else { 0.0 },
                    if i == 1 { 1.0 } else { 0.0 },
                    if i == 2 { 1.0 } else { 0.0 },
                ]);
                data.push(roughness);
                let uv = texcoords.map_or(glam::Vec2::ZERO, |uv| uv[i]);
                data.extend_from_slice(&[uv.x, uv.y, layer]);
            }
        };
        for (face, t) in mesh.triangles.iter().enumerate() {
            let material = &materials[t.material];
            let strain = if heat {
                energy::stretches(&state.x, t, material)
                    .into_iter()
                    .map(|s| (s - 1.0).abs())
                    .fold(0.0, f64::max)
            } else {
                0.
            };
            let contact = contacts
                && collider.is_some_and(|s| {
                    t.vertices
                        .iter()
                        .any(|i| s.penetration(state.x[*i], material.thickness) > 0.0)
                });
            let appearance = optics
                .and_then(|values| values.get(t.material))
                .and_then(|value| *value);
            let (color, roughness) = cloth_surface(
                appearance,
                marked_faces.is_some_and(|faces| faces.contains(&face)),
                contact,
                heat.then_some(strain),
            );
            let layer = if roughness >= 0. {
                layers.get(t.material).copied().flatten()
            } else {
                None
            };
            triangle(
                t.vertices.map(|i| state.x[i].as_vec3()),
                color,
                wire,
                Some(t.vertices.map(|i| smooth[i])),
                roughness,
                layer
                    .and_then(|_| appearance.and_then(|a| a.albedo.as_ref()))
                    .map(|map| t.vertices.map(|i| map.material_uv(mesh.uv[i]).as_vec2())),
                layer.map_or(-1., |i| i as f32),
            );
        }
        for seam in seams {
            for side in [1.0, -1.0] {
                let points: Vec<_> = seam
                    .probes
                    .iter()
                    .map(|p| {
                        p.terms
                            .iter()
                            .filter(|(_, w)| w.signum() == side)
                            .map(|(i, w)| state.x[*i] * w.abs())
                            .sum::<glam::DVec3>()
                            .as_vec3()
                    })
                    .collect();
                for pair in points.windows(2) {
                    let [a, b] = [pair[0], pair[1]];
                    let d = (b - a).cross(Vec3::Z).normalize_or_zero() * 0.0013;
                    triangle(
                        [a - d, a + d, b + d],
                        [1.0, 0.72, 0.22],
                        false,
                        None,
                        -1.,
                        None,
                        -1.,
                    );
                    triangle(
                        [a - d, b + d, b - d],
                        [1.0, 0.72, 0.22],
                        false,
                        None,
                        -1.,
                        None,
                        -1.,
                    );
                }
            }
        }
        if let Some(s) = sphere {
            let point = |i: usize, j: usize| {
                let theta = std::f32::consts::TAU * i as f32 / 40.0;
                let phi = std::f32::consts::PI * j as f32 / 20.0;
                s.center.as_vec3()
                    + s.radius as f32
                        * Vec3::new(phi.sin() * theta.cos(), phi.cos(), phi.sin() * theta.sin())
            };
            for j in 0..20 {
                for i in 0..40 {
                    let [a, b, c, d] = [
                        point(i, j),
                        point(i + 1, j),
                        point(i, j + 1),
                        point(i + 1, j + 1),
                    ];
                    triangle([a, c, b], [0.38, 0.4, 0.46], false, None, -1., None, -1.);
                    triangle([b, c, d], [0.38, 0.4, 0.46], false, None, -1., None, -1.);
                }
            }
        }
        // Static avatar stays resident; camera transforms now happen in WGSL.
        if let Some(avatar) = avatar {
            let key = (
                avatar.vertices.as_ptr() as usize,
                avatar.triangles.as_ptr() as usize,
            );
            if key != self.avatar_key {
                use wgpu::util::DeviceExt;
                let mut body = Vec::<f32>::new();
                let mut normals = vec![Vec3::ZERO; avatar.vertices.len()];
                for t in &avatar.triangles {
                    let p = t.map(|i| avatar.vertices[i].as_vec3());
                    let n = (p[1] - p[0]).cross(p[2] - p[0]);
                    for i in t {
                        normals[*i] += n;
                    }
                }
                for n in &mut normals {
                    *n = n.normalize_or_zero();
                }
                for t in &avatar.triangles {
                    let p = t.map(|i| avatar.vertices[i].as_vec3());
                    for (i, v) in p.into_iter().enumerate() {
                        body.extend_from_slice(&v.extend(1.).to_array());
                        body.extend_from_slice(&normals[t[i]].to_array());
                        body.extend_from_slice(&[
                            0.46, 0.47, 0.49, 0., 0., 0., 0., -1., 0., 0., -1.,
                        ]);
                    }
                }
                self.avatar_count = (body.len() / VERTEX_FLOATS) as u32;
                self.avatar_key = key;
                self.avatar_buffer = Some(device.create_buffer_init(
                    &wgpu::util::BufferInitDescriptor {
                        label: Some("static avatar"),
                        contents: bytemuck::cast_slice(&body),
                        usage: wgpu::BufferUsages::VERTEX,
                    },
                ));
            }
        } else {
            self.avatar_count = 0;
            self.avatar_key = (0, 0);
            self.avatar_buffer = None;
        }
        let bytes = bytemuck::cast_slice(&data);
        if bytes.len() as u64 > self.capacity {
            self.capacity = (bytes.len() as u64).next_power_of_two();
            self.vertices = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("viewport-vertices"),
                size: self.capacity,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
        }
        self.render_state
            .queue
            .write_buffer(&self.vertices, 0, bytes);
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("cloth-viewport"),
        });
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("cloth-viewport"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: self.msaa_color.as_ref().unwrap_or(&self.color),
                    depth_slice: None,
                    resolve_target: self.msaa_color.as_ref().map(|_| &self.color),
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.depth,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: self
                    .timers
                    .as_ref()
                    .map(|t| wgpu::RenderPassTimestampWrites {
                        query_set: &t.query,
                        beginning_of_pass_write_index: Some(0),
                        end_of_pass_write_index: Some(1),
                    }),
                ..Default::default()
            });
            pass.set_pipeline(&self.environment.pipeline);
            pass.set_bind_group(0, &self.environment.bind, &[]);
            pass.draw(0..3, 0..1);
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &self.view_bind, &[]);
            pass.set_bind_group(1, &self.albedo_bind, &[]);
            pass.set_vertex_buffer(0, self.vertices.slice(..));
            pass.draw(0..(data.len() / VERTEX_FLOATS) as u32, 0..1);
            if let Some(body) = &self.avatar_buffer {
                pass.set_vertex_buffer(0, body.slice(..));
                pass.draw(0..self.avatar_count, 0..1);
            }
        }
        if let Some(t) = &self.timers {
            encoder.resolve_query_set(&t.query, 0..2, &t.resolve, 0);
            encoder.copy_buffer_to_buffer(&t.resolve, 0, &t.read, 0, 16);
        }
        self.render_state.queue.submit([encoder.finish()]);
        self.texture_id
    }
    pub fn enable_timing(&mut self) -> bool {
        let d = &self.render_state.device;
        if !d.features().contains(wgpu::Features::TIMESTAMP_QUERY) {
            return false;
        }
        self.timers = Some(Timers {
            query: d.create_query_set(&wgpu::QuerySetDescriptor {
                label: Some("viewport-timestamps"),
                ty: wgpu::QueryType::Timestamp,
                count: 2,
            }),
            resolve: d.create_buffer(&wgpu::BufferDescriptor {
                label: None,
                size: 16,
                usage: wgpu::BufferUsages::QUERY_RESOLVE | wgpu::BufferUsages::COPY_SRC,
                mapped_at_creation: false,
            }),
            read: d.create_buffer(&wgpu::BufferDescriptor {
                label: None,
                size: 16,
                usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            }),
        });
        true
    }
    pub fn gpu_time_ms(&self) -> Result<Option<f64>, String> {
        let Some(t) = &self.timers else {
            return Ok(None);
        };
        let bytes = read_buffer(&self.render_state.device, &t.read)?;
        let start = u64::from_le_bytes(bytes[0..8].try_into().unwrap());
        let end = u64::from_le_bytes(bytes[8..16].try_into().unwrap());
        Ok(Some(
            end.wrapping_sub(start) as f64 * self.render_state.queue.get_timestamp_period() as f64
                / 1e6,
        ))
    }
    pub fn capture(&self, path: &std::path::Path) -> Result<(), String> {
        let row = (self.size[0] * 4).div_ceil(256) * 256;
        let d = &self.render_state.device;
        let buffer = d.create_buffer(&wgpu::BufferDescriptor {
            label: Some("viewport-image"),
            size: row as u64 * self.size[1] as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let mut encoder = d.create_command_encoder(&Default::default());
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &self.color_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(row),
                    rows_per_image: None,
                },
            },
            wgpu::Extent3d {
                width: self.size[0],
                height: self.size[1],
                depth_or_array_layers: 1,
            },
        );
        self.render_state.queue.submit([encoder.finish()]);
        let data = read_buffer(d, &buffer)?;
        let pixels: Vec<_> = data
            .chunks_exact(row as usize)
            .flat_map(|r| r[..(self.size[0] * 4) as usize].iter().copied())
            .collect();
        image::save_buffer(
            path,
            &pixels,
            self.size[0],
            self.size[1],
            image::ColorType::Rgba8,
        )
        .map_err(|e| e.to_string())
    }
}
fn read_buffer(device: &wgpu::Device, buffer: &wgpu::Buffer) -> Result<Vec<u8>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    buffer.map_async(wgpu::MapMode::Read, .., move |r| {
        let _ = tx.send(r);
    });
    device
        .poll(wgpu::PollType::wait_indefinitely())
        .map_err(|e| e.to_string())?;
    rx.recv()
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let data = buffer
        .get_mapped_range(..)
        .map_err(|e| e.to_string())?
        .to_vec();
    buffer.unmap();
    Ok(data)
}
impl Drop for Viewport {
    fn drop(&mut self) {
        self.render_state
            .renderer
            .write()
            .free_texture(&self.texture_id);
    }
}

/// Camera navigation is pure math: these tests need no GPU and no window.
#[cfg(test)]
mod tests {
    #[test]
    fn albedo_mips_filter_in_linear_light_and_cover_complete_texture() {
        let mixed = vec![
            0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255,
        ];
        let chain = super::albedo_mip_chain(mixed.clone(), 2);
        assert_eq!(chain[0], mixed);
        assert_eq!(chain[1], vec![188, 188, 188, 255]);
        let base = vec![255; (super::ALBEDO_SIZE * super::ALBEDO_SIZE * 4) as usize];
        let chain = super::albedo_mip_chain(base, super::ALBEDO_SIZE);
        assert_eq!(chain.len(), super::ALBEDO_LEVELS as usize);
        for (level, pixels) in chain.iter().enumerate() {
            let size = (super::ALBEDO_SIZE >> level) as usize;
            assert_eq!(pixels.len(), size * size * 4);
            assert!(pixels.iter().all(|p| *p == 255));
        }
    }
    #[test]
    fn cached_albedo_validation_rechecks_changed_pixels_and_parameters() {
        use crate::garment::appearance::AlbedoTexture;
        let map = AlbedoTexture {
            width: 1,
            height: 1,
            rgba_srgb: vec![1, 2, 3, 255].into(),
            tile_m: [0.1, 0.1],
            rotation_degrees: 0.,
        };
        let cache = vec![map.clone()];
        assert!(super::valid_albedo(&map, &cache));
        let mut retiled = map.clone();
        retiled.tile_m = [0.2, 0.3];
        assert!(super::same_albedo_pixels(&map, &retiled));
        let mut changed = map.clone();
        std::sync::Arc::make_mut(&mut changed.rgba_srgb)[3] = 0;
        assert!(!super::same_albedo_pixels(&map, &changed));
        assert!(!super::valid_albedo(&changed, &cache));
        let mut bad_params = map.clone();
        bad_params.tile_m[0] = 0.;
        assert!(!super::valid_albedo(&bad_params, &cache));
        let mut bad_size = map;
        bad_size.width = 2;
        assert!(!super::valid_albedo(&bad_size, &cache));
    }
    use super::*;

    fn viewport(width: f32, height: f32) -> egui::Rect {
        egui::Rect::from_min_size(egui::Pos2::ZERO, egui::Vec2::new(width, height))
    }

    fn close(actual: f32, expected: f32, tolerance: f32, what: &str) {
        assert!(
            (actual - expected).abs() <= tolerance,
            "{what}: {actual} vs {expected}"
        );
    }

    /// World point under a window position, on the focal plane through the
    /// target. This is the inverse of `Camera::project` for that plane.
    fn unproject(camera: &Camera, position: egui::Pos2, rect: egui::Rect) -> Vec3 {
        let (origin, direction) = camera.ray(position, rect);
        let (origin, direction) = (origin.as_vec3(), direction.as_vec3());
        let forward = camera.forward();
        let denominator = direction.dot(forward);
        assert!(
            denominator.abs() > 1e-6,
            "cursor ray parallel to the view axis"
        );
        origin + direction * ((camera.target - origin).dot(forward) / denominator)
    }

    #[test]
    fn presets_point_along_their_canonical_direction() {
        for preset in PresetView::ALL {
            let mut camera = Camera::default();
            let (distance, target) = (camera.distance, camera.target);
            camera.apply_preset(preset);
            let expected = preset.direction();
            let actual = camera.direction();
            assert!(
                (actual - expected).length() < 1e-5,
                "{}: {actual:?} vs {expected:?}",
                preset.label()
            );
            close(camera.distance, distance, 0., preset.label());
            assert!(
                (camera.target - target).length() == 0.,
                "{}",
                preset.label()
            );
        }
    }

    #[test]
    fn up_is_defined_and_perpendicular_at_every_preset() {
        for preset in PresetView::ALL {
            let mut camera = Camera::default();
            camera.apply_preset(preset);
            let up = camera.up();
            close(up.length(), 1., 1e-5, preset.label());
            assert!(
                up.dot(camera.direction()).abs() < 1e-5,
                "{} up is not perpendicular to the view direction",
                preset.label()
            );
            assert!(
                camera.right().length() > 0.99,
                "{} has a degenerate right vector",
                preset.label()
            );
            for orthographic in [false, true] {
                camera.orthographic = orthographic;
                assert!(
                    camera.matrix(1.6).is_finite(),
                    "{} ({orthographic}) produced a non-finite matrix",
                    preset.label()
                );
            }
        }
    }

    #[test]
    fn screen_and_world_round_trip_in_both_projections() {
        let rect = viewport(1280., 720.);
        for orthographic in [false, true] {
            let camera = Camera {
                orthographic,
                ..Default::default()
            };
            let focal = camera.target;
            for world in [
                focal,
                focal + camera.right() * 0.3 + camera.up() * 0.2,
                focal - camera.right() * 0.4 - camera.up() * 0.1,
            ] {
                let screen = camera.project(world, rect).expect("in front of the camera");
                let back = unproject(&camera, screen, rect);
                assert!(
                    (back - world).length() < 1e-3,
                    "{orthographic}: {world:?} -> {screen:?} -> {back:?}"
                );
            }
        }
    }

    #[test]
    fn zoom_keeps_the_world_point_under_the_cursor() {
        let rect = viewport(1200., 700.);
        for orthographic in [false, true] {
            let mut camera = Camera {
                orthographic,
                ..Default::default()
            };
            let cursor = egui::pos2(
                rect.left() + 0.18 * rect.width(),
                rect.top() + 0.72 * rect.height(),
            );
            let anchor = unproject(&camera, cursor, rect);
            let before = camera.project(anchor, rect).unwrap();
            let (yaw, pitch) = (camera.yaw, camera.pitch);
            camera.zoom_at(cursor, rect, 0.5);
            close(
                camera.distance,
                Camera::default().distance * 0.5,
                1e-5,
                "distance",
            );
            let after = camera.project(anchor, rect).unwrap();
            assert!(
                (after - before).length() < 0.05,
                "{orthographic}: anchor moved from {before:?} to {after:?}"
            );
            close(camera.yaw, yaw, 0., "yaw");
            close(camera.pitch, pitch, 0., "pitch");
        }
    }

    #[test]
    fn zoom_towards_the_centre_only_changes_the_distance() {
        let rect = viewport(900., 600.);
        let mut camera = Camera::default();
        let target = camera.target;
        let centre = camera.project(target, rect).unwrap();
        camera.zoom_at(rect.center(), rect, 2.);
        println!("centre drift: {:?}", (camera.target - target).length());
        // The centre ray is the view axis, so the target may only drift by the
        // f32 inverse-projection noise, and never along the screen plane.
        assert!((camera.target - target).length() < 1e-3);
        let after = camera.project(target, rect).unwrap();
        assert!((after - centre).length() < 0.05, "{after:?} vs {centre:?}");
        close(
            camera.distance,
            Camera::default().distance * 2.,
            1e-5,
            "distance",
        );
    }

    #[test]
    fn zoom_clamps_and_keeps_the_anchor() {
        let rect = viewport(800., 800.);
        let cursor = egui::pos2(rect.left() + 40., rect.top() + 660.);
        let mut camera = Camera::default();
        let anchor = unproject(&camera, cursor, rect);
        camera.zoom_at(cursor, rect, 1e6);
        close(camera.distance, MAX_DISTANCE, 1e-6, "clamped out");
        let projected = camera.project(anchor, rect).unwrap();
        assert!((projected - cursor).length() < 0.05, "{projected:?}");
        let mut camera = Camera::default();
        let anchor = unproject(&camera, cursor, rect);
        camera.zoom_at(cursor, rect, 1e-6);
        close(camera.distance, MIN_DISTANCE, 1e-6, "clamped in");
        let projected = camera.project(anchor, rect).unwrap();
        assert!((projected - cursor).length() < 0.05, "{projected:?}");
        // A non-positive factor is not a zoom and must not flip the distance.
        camera.zoom_at(cursor, rect, -1.);
        close(camera.distance, MIN_DISTANCE, 1e-6, "distance unchanged");
        camera.zoom(-4.);
        close(camera.distance, MIN_DISTANCE, 1e-6, "distance unchanged");
    }

    #[test]
    fn pan_moves_the_scene_with_the_pointer_pixel_for_pixel() {
        let rect = viewport(1000., 800.);
        let mut camera = Camera::default();
        let world = camera.target + camera.right() * 0.25 - camera.up() * 0.15;
        let delta = egui::Vec2::new(37., -21.);
        let before = camera.project(world, rect).unwrap();
        camera.pan_by(delta, rect);
        let after = camera.project(world, rect).unwrap();
        assert!(
            (after - before - delta).length() < 0.05,
            "moved {:?} instead of {delta:?}",
            after - before
        );
    }

    #[test]
    fn orbit_clamps_at_the_poles_and_keeps_the_model_upright_below_them() {
        let mut camera = Camera::default();
        camera.orbit_by(egui::Vec2::new(0., 100_000.));
        close(camera.pitch, MAX_PITCH, 1e-6, "pitch");
        camera.orbit_by(egui::Vec2::new(0., -200_000.));
        close(camera.pitch, -MAX_PITCH, 1e-6, "pitch");
        // Below the poles the camera up stays the world Y axis on screen.
        let mut camera = Camera::default();
        camera.orbit_by(egui::Vec2::new(20., 10.));
        close(camera.up().y, camera.pitch.cos(), 1e-5, "up.y");
        assert!(camera.up().y > 0., "model flipped after a small orbit");
        // The poles themselves are still upright and finite.
        for pitch in [MAX_PITCH, -MAX_PITCH] {
            camera.pitch = pitch;
            assert!(camera.up().y.abs() < 1e-5, "pole up is not horizontal");
            assert!(camera.right().length() > 0.99);
        }
    }

    #[test]
    fn orthographic_matches_the_perspective_scale_at_the_focal_plane() {
        let rect = viewport(1024., 768.);
        let mut camera = Camera::default();
        let focal_half_height = camera.distance * (FOV_Y * 0.5).tan();
        let top = camera.target + camera.up() * focal_half_height;
        let perspective_top = camera.project(top, rect).unwrap();
        close(perspective_top.y, rect.top(), 0.01, "perspective framing");
        camera.orthographic = true;
        let orthographic_top = camera.project(top, rect).unwrap();
        close(orthographic_top.y, rect.top(), 0.01, "orthographic framing");
        let centre = camera.project(camera.target, rect).unwrap();
        close(centre.x, rect.center().x, 0.01, "target stays centred");
        close(centre.y, rect.center().y, 0.01, "target stays centred");
    }

    #[test]
    fn orthographic_projects_parallel_lines_onto_the_same_screen_point() {
        let rect = viewport(900., 700.);
        let mut camera = Camera {
            orthographic: true,
            ..Default::default()
        };
        let lateral = camera.right() * 0.2;
        let near = camera.target + lateral - camera.forward() * 0.4;
        let far = camera.target + lateral + camera.forward() * 0.4;
        let a = camera.project(near, rect).unwrap();
        let b = camera.project(far, rect).unwrap();
        assert!(
            (a - b).length() < 0.01,
            "orthographic is not parallel: {a:?} vs {b:?}"
        );
        // Perspective is not: the same offset shrinks with depth.
        camera.orthographic = false;
        let a = camera.project(near, rect).unwrap();
        let b = camera.project(far, rect).unwrap();
        assert!((a.x - b.x).abs() > 1., "perspective should foreshorten");
    }

    #[test]
    fn frame_fits_the_bounding_sphere_in_both_projections() {
        let rect = viewport(900., 600.);
        let center = Vec3::new(0.1, 0.9, -0.2);
        let radius = 0.6;
        for orthographic in [false, true] {
            let mut camera = Camera {
                orthographic,
                ..Default::default()
            };
            camera.frame_in(center, radius, rect);
            assert!((camera.target - center).length() < 1e-6);
            for axis in [Vec3::X, Vec3::Y, Vec3::Z] {
                for sign in [1., -1.] {
                    let extreme = center + axis * (sign * radius);
                    let screen = camera.project(extreme, rect).unwrap();
                    assert!(
                        rect.contains(screen),
                        "{orthographic}: {screen:?} outside {rect:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn pending_frame_waits_for_the_viewport_rectangle() {
        let mut camera = Camera::default();
        let rect = viewport(400., 900.);
        camera.request_frame(Vec3::new(0., 1., 0.), 0.5);
        assert!(camera.apply_pending_frame(rect));
        assert!(
            !camera.apply_pending_frame(rect),
            "the request is consumed once"
        );
        // A narrow viewport needs more distance than a square one.
        let mut square = Camera::default();
        square.frame(Vec3::new(0., 1., 0.), 0.5);
        assert!(camera.distance > square.distance);
    }

    #[test]
    fn presets_and_frames_can_be_undone_with_restore() {
        let mut camera = Camera::default();
        let original = (camera.yaw, camera.pitch, camera.distance, camera.target);
        camera.apply_preset(PresetView::Top);
        assert!(camera.has_saved_pose());
        let (yaw, pitch) = PresetView::Top.angles();
        close(camera.yaw, yaw, 1e-6, "yaw");
        close(camera.pitch, pitch, 1e-6, "pitch");
        assert!(camera.restore_pose());
        close(camera.yaw, original.0, 0., "restored yaw");
        close(camera.pitch, original.1, 0., "restored pitch");
        close(camera.distance, original.2, 0., "restored distance");
        assert!((camera.target - original.3).length() == 0.);
        // Restore toggles back to the preset it replaced.
        assert!(camera.restore_pose());
        close(camera.pitch, pitch, 1e-6, "toggled pitch");
        assert!(!Camera::default().restore_pose(), "nothing saved yet");
    }

    #[test]
    fn reset_view_keeps_the_projection_mode() {
        let mut camera = Camera::default();
        camera.apply_preset(PresetView::Bottom);
        camera.toggle_projection();
        camera.frame_in(Vec3::new(1., 1., 1.), 2., viewport(800., 600.));
        camera.reset_view();
        let default = Camera::default();
        close(camera.yaw, default.yaw, 0., "yaw");
        close(camera.distance, default.distance, 0., "distance");
        assert!(
            camera.orthographic,
            "the projection choice survives a reset"
        );
    }
    #[test]
    fn diagnostic_overlays_keep_precedence_over_custom_optics() {
        let optics = crate::garment::appearance::FabricAppearance {
            color_srgb: [255, 0, 0],
            roughness: 0.3,
            albedo: None,
        };
        assert_eq!(
            cloth_surface(None, false, false, None),
            ([0.91, 0.92, 0.94], -1.)
        );
        assert_eq!(
            cloth_surface(Some(&optics), false, false, None),
            ([1., 0., 0.], 0.3)
        );
        assert_eq!(
            cloth_surface(Some(&optics), true, true, Some(0.1)),
            ([1., 0.23, 0.10], -1.)
        );
        assert_eq!(
            cloth_surface(Some(&optics), false, true, Some(0.1)),
            ([1., 0.2, 0.25], -1.)
        );
        assert_eq!(cloth_surface(Some(&optics), false, false, Some(0.1)).1, -1.);
    }
}
