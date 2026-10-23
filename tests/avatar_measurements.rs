use glam::{DMat3, DVec3};
use marvelous_cloth::avatar_measurements::*;

fn body() -> AvatarMeasurements {
    // Original synthetic cuboid: 0.4 m wide, 0.2 m deep, 1.8 m tall.
    // The section is user-authored, not detected from these dimensions.
    let landmarks = [
        ("heel", DVec3::ZERO),
        ("crown", DVec3::new(0., 1.8, 0.)),
        ("a", DVec3::new(-0.2, 1., -0.1)),
        ("b", DVec3::new(0.2, 1., -0.1)),
        ("c", DVec3::new(0.2, 1., 0.1)),
        ("d", DVec3::new(-0.2, 1., 0.1)),
    ]
    .into_iter()
    .map(|(id, position_m)| Landmark {
        id: id.into(),
        position_m,
    })
    .collect();
    AvatarMeasurements {
        version: 1,
        units: LengthUnit::Metres,
        frame: AvatarFrame { avatar_id: "cuboid".into(), revision: 3 },
        meshes: MeshRoles { visible_asset: "detailed_body".into(), collision_asset: Some("coarse_collider".into()) },
        landmarks,
        measurements: vec![
            Measurement {
                id: "height".into(),
                convention: Convention { description: "Upright pose, straight heel-to-crown distance.".into(), confirmed: true },
                path: MeasurementPath::Distance { from: "heel".into(), to: "crown".into() },
            },
            Measurement {
                id: "section".into(),
                convention: Convention { description: "Closed polygon at authored section y=1 m; straight segments, not a body-size standard.".into(), confirmed: true },
                path: MeasurementPath::Polyline { landmarks: ["a", "b", "c", "d"].map(String::from).to_vec(), closed: true },
            },
        ],
    }
}

fn close(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-12, "{a} != {b}");
}

#[test]
fn analytic_body_distances_and_explicit_open_closed_paths() {
    let mut b = body();
    let report = b.evaluate(&b.frame).unwrap();
    close(report.values[0].length_m, 1.8);
    close(report.values[1].length_m, 1.2);
    assert_eq!(report.values[1].definition, b.measurements[1]);
    assert_eq!(report.units, LengthUnit::Metres);
    if let MeasurementPath::Polyline { closed, .. } = &mut b.measurements[1].path {
        *closed = false;
    }
    close(b.evaluate(&b.frame).unwrap().values[1].length_m, 1.0);
}

#[test]
fn rigid_motion_preserves_lengths_but_changes_frame_identity() {
    let mut b = body();
    let old = b.frame.clone();
    let before = b.evaluate(&old).unwrap();
    let rotation = DMat3::from_rotation_z(0.71) * DMat3::from_rotation_y(-0.29);
    for p in &mut b.landmarks {
        p.position_m = rotation * p.position_m + DVec3::new(2., -3., 4.);
    }
    b.frame.revision += 1;
    assert!(b.evaluate(&old).unwrap_err().contains("stale"));
    let after = b.evaluate(&b.frame).unwrap();
    for (a, z) in before.values.iter().zip(after.values) {
        close(a.length_m, z.length_m);
    }
    let other = AvatarFrame {
        avatar_id: "other_body".into(),
        ..b.frame.clone()
    };
    assert!(b.evaluate(&other).is_err());
}

#[test]
fn collider_identity_never_substitutes_for_visible_body_landmarks() {
    let mut b = body();
    let original = b.evaluate(&b.frame).unwrap();
    b.meshes.collision_asset = Some("different_simplified_collider".into());
    assert_eq!(original, b.evaluate(&b.frame).unwrap());
    b.meshes.collision_asset = None;
    assert_eq!(original, b.evaluate(&b.frame).unwrap());
    b.landmarks.clear();
    assert!(
        b.evaluate(&b.frame)
            .unwrap_err()
            .contains("Missing landmark")
    );
}

#[test]
fn draft_conventions_round_trip_but_cannot_produce_a_report() {
    let mut b = body();
    b.measurements[1].convention.confirmed = false;
    let json = b.to_json().unwrap();
    let read = AvatarMeasurements::from_json(&json).unwrap();
    assert_eq!(b, read);
    assert!(
        read.evaluate(&read.frame)
            .unwrap_err()
            .contains("Unconfirmed convention")
    );
    b.measurements[1].convention.description = "  ".into();
    assert!(b.to_json().is_err());
}

#[test]
fn missing_duplicate_and_repeated_landmarks_fail_without_guessing() {
    let mut b = body();
    b.landmarks.push(b.landmarks[0].clone());
    assert!(b.validate().unwrap_err().contains("Duplicate landmark"));
    b = body();
    b.landmarks.remove(0);
    assert!(b.validate().unwrap_err().contains("Missing landmark heel"));
    b = body();
    b.measurements[1].path = MeasurementPath::Polyline {
        landmarks: vec!["a".into(), "b".into(), "a".into()],
        closed: true,
    };
    assert!(b.validate().unwrap_err().contains("Repeated landmark"));
    b.measurements[1].path = MeasurementPath::Polyline {
        landmarks: vec!["a".into(), "b".into()],
        closed: true,
    };
    assert!(b.validate().unwrap_err().contains("Too few"));
    b.measurements[1].path = MeasurementPath::Polyline {
        landmarks: vec![],
        closed: false,
    };
    assert!(b.validate().is_err());
    b = body();
    b.measurements.push(b.measurements[0].clone());
    assert!(b.validate().unwrap_err().contains("duplicate measurement"));
}

#[test]
fn nonfinite_coincident_and_overflow_geometry_is_rejected() {
    for p in [
        DVec3::splat(f64::NAN),
        DVec3::splat(f64::INFINITY),
        DVec3::ZERO,
    ] {
        let mut b = body();
        b.landmarks[1].position_m = p;
        assert!(b.evaluate(&b.frame).is_err());
    }
    let mut b = body();
    b.landmarks[0].position_m.x = -f64::MAX;
    b.landmarks[1].position_m.x = f64::MAX;
    assert!(b.validate().is_err());
}

#[test]
fn strict_json_preserves_si_and_rejects_unknown_or_unconfirmed_inputs() {
    let original = body();
    let json = original.to_json().unwrap();
    assert_eq!(original, AvatarMeasurements::from_json(&json).unwrap());
    let base: serde_json::Value = serde_json::from_str(&json).unwrap();
    let mut bad = base.clone();
    bad["units"] = "centimetres".into();
    assert!(AvatarMeasurements::from_json(&bad.to_string()).is_err());
    bad = base.clone();
    bad["version"] = 2.into();
    assert!(AvatarMeasurements::from_json(&bad.to_string()).is_err());
    bad = base.clone();
    bad["landmarks"][0]["vertex_index"] = 3.into();
    assert!(AvatarMeasurements::from_json(&bad.to_string()).is_err());
    bad = base.clone();
    bad["measurements"][0]["convention"]
        .as_object_mut()
        .unwrap()
        .remove("confirmed");
    assert!(AvatarMeasurements::from_json(&bad.to_string()).is_err());
    bad = base;
    bad["measurements"][0]["path"]["guess_size"] = true.into();
    assert!(AvatarMeasurements::from_json(&bad.to_string()).is_err());
}

#[test]
fn circular_samples_report_the_polygon_length_not_an_inferred_tape_measure() {
    let radius = 0.2;
    for count in [8, 32] {
        let mut b = body();
        b.landmarks = (0..count)
            .map(|i| {
                let angle = std::f64::consts::TAU * i as f64 / count as f64;
                Landmark {
                    id: format!("sample_{i}"),
                    position_m: DVec3::new(radius * angle.cos(), 1., radius * angle.sin()),
                }
            })
            .collect();
        b.measurements = vec![Measurement {
            id: "sampled_section".into(),
            convention: Convention {
                description: "Closed regular polygon on a synthetic cylinder; chord length only."
                    .into(),
                confirmed: true,
            },
            path: MeasurementPath::Polyline {
                landmarks: b.landmarks.iter().map(|p| p.id.clone()).collect(),
                closed: true,
            },
        }];
        let measured = b.evaluate(&b.frame).unwrap().values[0].length_m;
        close(
            measured,
            2. * count as f64 * radius * (std::f64::consts::PI / count as f64).sin(),
        );
        assert!(measured < std::f64::consts::TAU * radius);
        for point in &mut b.landmarks {
            point.position_m *= 2.;
        }
        b.frame.revision += 1;
        close(
            b.evaluate(&b.frame).unwrap().values[0].length_m,
            2. * measured,
        );
    }
}
