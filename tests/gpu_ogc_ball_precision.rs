//! CPU-only numerical contract for centered f32 OGC ball packing.
//! This is a finite synthetic-direction check, not a proof for arbitrary WGSL arithmetic.

const U: f64 = f32::EPSILON as f64 / 2.0;

fn norm(v: [f64; 3]) -> f64 { v.iter().map(|x| x*x).sum::<f64>().sqrt() }
fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    std::array::from_fn(|i| a[i] - b[i])
}
fn packed_center(center: [f64; 3], origin: [f64; 3]) -> [f32; 3] {
    std::array::from_fn(|i| (center[i] - origin[i]) as f32)
}
fn old_radius(radius: f64, local: [f64; 3]) -> f32 {
    let largest = local.iter().fold(0f64, |acc, x| acc.max(x.abs()));
    (radius - 16.0 * f32::EPSILON as f64 * largest.max(1.0)).max(0.0) as f32
}

// Conservative for the explicitly tested operation model: candidate is built
// from the rounded center plus f32 multiply/add of a radius-limited direction.
// Gamma bounds three rounded arithmetic operations per coordinate, plus the
// *measured* f64-to-f32 center encoding error and radius cast roundoff.
// Does not claim coverage for arbitrary WGSL reassociation or flush-to-zero.
fn precision_radius(radius: f64, local: [f64; 3], center32: [f32; 3]) -> f32 {
    let decoded = center32.map(|x| x as f64);
    let packing_error = norm(sub(decoded, local));
    let coordinate_scale = norm(decoded) + radius;
    let gamma3 = (3.0 * U) / (1.0 - 3.0 * U);
    let arithmetic_error = (3.0f64).sqrt() * gamma3 * coordinate_scale;
    let safe = (radius - packing_error - arithmetic_error).max(0.0);
    // f32 cast may round upward: move one representable step toward zero.
    let rounded = safe as f32;
    if rounded as f64 > safe { f32::from_bits(rounded.to_bits() - 1) } else { rounded }
}

#[test]
fn old_one_metre_floor_erases_micrometre_ball_at_local_point_two() {
    let local = [0.2, -0.1, 0.04];
    let separation = 4.26e-6;
    let radius = 0.45 * separation;
    let floor = 16.0 * f32::EPSILON as f64;
    assert!((floor - 1.9073486328125e-6).abs() < 1e-18);
    assert!(radius > floor, "4.26um separation gives a barely positive old ball");
    assert!(old_radius(radius, local) < 1.0e-8, "old packed ball is nearly zero");
    let packed = packed_center(local, [0.0;3]);
    let new_radius = precision_radius(radius, local, packed);
    assert!(new_radius > 1.0e-6, "local precision should preserve useful positive motion: {new_radius}");
}

#[test]
fn finite_directions_and_translated_origins_remain_inside_true_f64_ball() {
    let local = [0.2, -0.1, 0.04];
    let radius = 0.45 * 4.26e-6;
    let origins = [[0.0;3], [1000.0, -500.0, 78.0], [-42.5, 18.0, 200.0]];
    let directions = [
        [1.0,0.0,0.0],[-1.0,0.0,0.0],[0.0,1.0,0.0],
        [0.0,-1.0,0.0],[0.0,0.0,1.0],[0.0,0.0,-1.0],
        [1.0,1.0,1.0],[-1.0,1.0,-1.0],[0.3,-0.7,0.2],
    ];
    for origin in origins {
        let world: [f64;3] = std::array::from_fn(|i| origin[i] + local[i]);
        let exact_local = sub(world, origin);
        let encoded = packed_center(world, origin);
        let safe_radius = precision_radius(radius, exact_local, encoded);
        assert!(safe_radius > 0.0);
        for d in directions {
            let unit = norm(d);
            let displacement: [f32;3] = std::array::from_fn(|i| ((d[i]/unit) as f32 * safe_radius) as f32);
            let candidate: [f32;3] = std::array::from_fn(|i| encoded[i] + displacement[i]);
            let decoded: [f64;3] = candidate.map(|x| x as f64);
            let error = norm(sub(decoded, exact_local));
            assert!(error <= radius, "origin={origin:?}, direction={d:?}, error={error:e}, radius={radius:e}");
        }
    }
}
