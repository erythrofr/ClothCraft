//! Uncompiled pattern geometry must be safe to sample during interactive edits.
use glam::DVec2;
use marvelous_cloth::garment::{polygon::FreeCurvePoint, presets::{self, GarmentKind}};

#[test]
fn sampling_rejects_invalid_topology_and_coordinates_without_panicking() {
    let garment = presets::basic(GarmentKind::Tshirt, 0);
    let base = garment.panels[0].polygon.as_ref().unwrap().clone();
    let mut broken = base.clone();
    assert!(broken.edge_points(broken.edges.len()).is_err());
    broken.edges.pop();
    assert!(broken.edge_points(0).is_err());

    let mut broken = base.clone();
    broken.points[0].x = f64::NAN;
    assert!(broken.edge_points(0).is_err());

    let mut broken = base.clone();
    let edge = broken.edges[0].clone();
    broken.curves.insert(edge.clone(), [DVec2::splat(f64::INFINITY), DVec2::ZERO]);
    assert!(broken.edge_points(0).is_err());

    let mut broken = base.clone();
    broken.free_curve_points.insert(edge.clone(), vec![
        FreeCurvePoint { id: "a".into(), t: 0.7, position: DVec2::new(0.1, 0.1), mirror_group: None, derivative: None,  derivative_in:None, derivative_out:None,},
        FreeCurvePoint { id: "b".into(), t: 0.3, position: DVec2::new(0.2, 0.1), mirror_group: None, derivative: None,  derivative_in:None, derivative_out:None,},
    ]);
    assert!(broken.edge_points(0).is_err());
    broken.free_curve_points.get_mut(&edge).unwrap()[1].t = f64::NAN;
    assert!(broken.edge_points(0).is_err());
    broken.free_curve_points.get_mut(&edge).unwrap()[1].t = 0.9;
    broken.free_curve_points.get_mut(&edge).unwrap()[1].position.x = f64::INFINITY;
    assert!(broken.edge_points(0).is_err());

    // Valid controls remain an exact anchor in the sampled chain.
    let mut valid = base.clone();
    let a = valid.points[0];
    let b = valid.points[1];
    let midpoint = a.lerp(b, 0.5) + DVec2::new(0., 0.012);
    valid.free_curve_points.insert(edge, vec![FreeCurvePoint {
        id: "good".into(), t: 0.5, position: midpoint, mirror_group: None, derivative: None, derivative_in:None, derivative_out:None,
    }]);
    assert!(valid.edge_points(0).unwrap().contains(&midpoint));
}
