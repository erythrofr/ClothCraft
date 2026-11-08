struct View {
    projection: mat4x4f,
    // xyz is the eye for perspective (w=1), or direction to eye for ortho (w=0).
    eye: vec4f,
    light: vec4f, // world direction, key gain
    ambient: vec4f, // ambient gain, padding
};
@group(0) @binding(0) var<uniform> view: View;
@group(1) @binding(0) var albedo_maps: texture_2d_array<f32>;
@group(1) @binding(1) var albedo_sampler: sampler;
struct VertexOut {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec4<f32>,
    @location(2) barycentric: vec3<f32>,
    @location(3) world: vec3f,
    @location(4) roughness: f32,
    @location(5) texcoord: vec2f,
    @location(6) @interpolate(flat) layer: i32,
};

@vertex
fn vs_main(@location(0) clip: vec4<f32>, @location(1) normal: vec3<f32>,
           @location(2) color: vec4<f32>, @location(3) bary: vec3<f32>, @location(4) roughness: f32,
           @location(5) tex: vec3f) -> VertexOut {
    var out: VertexOut;
    out.position = view.projection * clip;
    out.world = clip.xyz;
    out.roughness = roughness;
    out.texcoord = tex.xy;
    out.layer = i32(tex.z);
    out.normal = normal;
    out.color = color;
    out.barycentric = bary;
    return out;
}

// Explicit custom optics use a bounded dielectric GGX highlight. This is a
// presentation model, not a measured textile BRDF. Legacy/diagnostic colors
// retain their existing lighting and encoded-output path.
fn encode_srgb(linear: vec3f) -> vec3f {
    let c = clamp(linear, vec3f(0.0), vec3f(1.0));
    return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, 12.92 * c, c <= vec3f(0.0031308));
}

@fragment
fn fs_main(in: VertexOut, @builtin(front_facing) front: bool) -> @location(0) vec4<f32> {
    let n = in.normal / max(length(in.normal), 0.000001) * select(-1.0, 1.0, front);
    let lighting = 0.35 * view.ambient.x + 0.65 * view.light.w * abs(dot(n, normalize(view.light.xyz)));
    let derivative = max(fwidth(in.barycentric), vec3<f32>(0.00001));
    let edges = smoothstep(vec3<f32>(0.0), derivative * 1.2, in.barycentric);
    let wire = min(edges.x, min(edges.y, edges.z));
    let wire_factor = mix(1.0, 0.28 + 0.72 * wire, in.color.a);
    let tex_dx = dpdx(in.texcoord);
    let tex_dy = dpdy(in.texcoord);
    if in.roughness < 0.0 {
        return vec4f(in.color.rgb * lighting * wire_factor, 1.0);
    }
    let l = normalize(view.light.xyz);
    let to_eye = view.eye.xyz - in.world * view.eye.w;
    let v = to_eye / max(length(to_eye), 0.000001);
    let h = (l + v) / max(length(l + v), 0.000001);
    let nl = clamp(dot(n, l), 0.0, 1.0);
    let nv = clamp(dot(n, v), 0.0001, 1.0);
    let nh = clamp(dot(n, h), 0.0, 1.0);
    let vh = clamp(dot(v, h), 0.0, 1.0);
    let alpha = max(in.roughness * in.roughness, 0.02);
    let a2 = alpha * alpha;
    let denom = nh * nh * (a2 - 1.0) + 1.0;
    let distribution = a2 / (3.14159265 * denom * denom);
    let gv = 2.0 * nv / (nv + sqrt(a2 + (1.0 - a2) * nv * nv));
    let gl = 2.0 * nl / max(nl + sqrt(a2 + (1.0 - a2) * nl * nl), 0.0001);
    let fresnel = 0.04 + 0.96 * pow(1.0 - vh, 5.0);
    let specular = distribution * gv * gl * fresnel / max(4.0 * nv, 0.0001);
    var base_color = in.color.rgb;
    if in.layer >= 0 {
        base_color *= textureSampleGrad(albedo_maps, albedo_sampler, in.texcoord, in.layer, tex_dx, tex_dy).rgb;
    }
    let rgb = (base_color * (0.25 * view.ambient.x + 0.7 * view.light.w * nl * (1.0 - fresnel)) + vec3f(0.2 * view.light.w * specular)) * wire_factor;
    return vec4f(encode_srgb(rgb), 1.0);
}
