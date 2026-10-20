//! Early structural intake and grading contract fixture. These checks express
//! factory-relevant invariants; the current authoring engine has no integrated
//! folded cloth dart topology or size-rule document yet.
use glam::DVec2;
use marvelous_cloth::garment::polygon::{MeasurementAnchor, PatternMeasurement, PolygonPattern};
use serde_json::json;

fn rectangle() -> PolygonPattern {
    serde_json::from_value(json!({
        "points": [[0.,0.],[0.3,0.],[0.3,0.2],[0.,0.2]],
        "edges": ["top","right","bottom","left"],
        "subdivisions": 0,
    })).unwrap()
}

/// Prototype darts are recorded as precise boundary stations plus tip. Before
/// cutting or folding material, validate a nondegenerate wedge on the panel.
fn dart_intake(panel: &PolygonPattern, edge: &str, left: f64, right: f64, tip: DVec2) -> Result<f64,String> {
    if !left.is_finite() || !right.is_finite() || left < 0. || right > 1. || right-left < 1e-4 {
        return Err("Dart legs must be distinct ordered edge stations".into());
    }
    if !tip.is_finite() { return Err("Dart tip must be finite".into()); }
    let a=panel.measurement_anchor_position(&MeasurementAnchor{edge:edge.into(),t:left})?;
    let b=panel.measurement_anchor_position(&MeasurementAnchor{edge:edge.into(),t:right})?;
    let uptake=a.distance(b);
    let altitude=((b-a).perp_dot(tip-a)).abs()/uptake;
    if uptake < 0.001 || altitude < 0.001 {return Err("Dart needs a real wedge and intake".into());}
    Ok(uptake)
}

#[test]
fn dart_station_intake_and_degeneracy_contract() {
    let poly=rectangle();
    assert!((dart_intake(&poly,"top",0.35,0.45,DVec2::new(0.12,0.08)).unwrap()-0.03).abs()<1e-10);
    assert!(dart_intake(&poly,"top",0.45,0.35,DVec2::new(0.12,0.08)).is_err());
    assert!(dart_intake(&poly,"top",0.35,0.45,DVec2::new(0.12,0.)).is_err());
    assert!(dart_intake(&poly,"unknown",0.35,0.45,DVec2::new(0.12,0.08)).is_err());
}

#[test]
fn measurement_identity_survives_numeric_size_variation() {
    let mut source=rectangle();
    source.measurements.push(PatternMeasurement {
        id:"chest-width".into(), label:"Chest width".into(),
        a:MeasurementAnchor{edge:"left".into(),t:0.5},
        b:MeasurementAnchor{edge:"right".into(),t:0.5},
    });
    let baseline=source.measurement_length(&source.measurements[0]).unwrap();
    for delta in [-0.02,0.,0.02,0.04] {
        let mut graded=source.clone();
        let factor=(baseline+delta)/baseline;
        for p in &mut graded.points {p.x*=factor;}
        graded.validate_measurements().unwrap();
        assert_eq!(graded.measurements,source.measurements);
        assert!((graded.measurement_length(&graded.measurements[0]).unwrap()-(baseline+delta)).abs()<1e-10);
        let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&graded).unwrap()).unwrap();
        assert_eq!(reopened.measurements[0].id,"chest-width");
    }
}
