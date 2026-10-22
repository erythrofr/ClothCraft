use glam::DVec2;
use marvelous_cloth::authoring::constructions::{ConstructionError as Error, Line};

fn near(a: DVec2, b: DVec2) {
    assert!((a - b).length() < 1e-10, "{a:?} != {b:?}");
}

#[test]
fn metric_distance_and_projection_extend_beyond_endpoints() {
    let line = Line::through(DVec2::ZERO, DVec2::new(0.03, 0.04)).unwrap();
    near(
        line.point_at_distance_m(0.1).unwrap(),
        DVec2::new(0.06, 0.08),
    );
    near(
        line.point_at_distance_m(-0.1).unwrap(),
        DVec2::new(-0.06, -0.08),
    );
    let p = DVec2::new(0.12, 0.01);
    let projected = line.project(p).unwrap();
    assert!((p - projected).dot(DVec2::new(0.6, 0.8)).abs() < 1e-14);
    near(line.project(projected).unwrap(), projected);
}

#[test]
fn constructions_commute_with_rotation_and_translation() {
    for angle in [0.0_f64, 0.3, 1.8, -2.1] {
        let rotation = DVec2::from_angle(angle);
        let transform = |p: DVec2| rotation.rotate(p) + DVec2::new(12.0, -3.0);
        let a = Line::through(transform(DVec2::ZERO), transform(DVec2::X)).unwrap();
        let b = Line::through(
            transform(DVec2::new(0.4, -1.0)),
            transform(DVec2::new(0.4, 1.0)),
        )
        .unwrap();
        near(a.intersection(b).unwrap(), transform(DVec2::new(0.4, 0.0)));
        near(b.intersection(a).unwrap(), a.intersection(b).unwrap());
        near(
            a.project(transform(DVec2::new(-0.2, 0.5))).unwrap(),
            transform(DVec2::new(-0.2, 0.0)),
        );
        near(
            a.point_at_distance_m(0.125).unwrap(),
            transform(DVec2::new(0.125, 0.0)),
        );
    }
}

#[test]
fn parallel_coincident_and_nearly_parallel_lines_are_explicit_errors() {
    let a = Line::through(DVec2::ZERO, DVec2::X).unwrap();
    for (start, end) in [
        (DVec2::Y, DVec2::ONE),
        (DVec2::X, DVec2::ZERO),
        (DVec2::Y, DVec2::new(1.0, 1.0 + 1e-13)),
    ] {
        assert_eq!(
            a.intersection(Line::through(start, end).unwrap()),
            Err(Error::ParallelOrIllConditioned)
        );
    }
}

#[test]
fn invalid_and_overflowing_inputs_never_return_nonfinite_points() {
    assert_eq!(
        Line::through(DVec2::ZERO, DVec2::ZERO).unwrap_err(),
        Error::DegenerateLine
    );
    assert_eq!(
        Line::through(DVec2::NAN, DVec2::X).unwrap_err(),
        Error::NonFiniteInput
    );
    assert_eq!(
        Line::through(DVec2::splat(-f64::MAX), DVec2::splat(f64::MAX)).unwrap_err(),
        Error::NonFiniteResult
    );
    let a = Line::through(DVec2::ZERO, DVec2::X).unwrap();
    assert_eq!(a.project(DVec2::INFINITY), Err(Error::NonFiniteInput));
    assert_eq!(a.point_at_distance_m(f64::NAN), Err(Error::NonFiniteInput));
    let huge = Line::through(DVec2::new(f64::MAX / 2.0, 0.0), DVec2::new(f64::MAX, 0.0)).unwrap();
    assert_eq!(
        huge.point_at_distance_m(f64::MAX),
        Err(Error::NonFiniteResult)
    );
}

#[test]
fn endpoint_spacing_does_not_change_direction_or_projection() {
    for spacing in [1e-200, 1e-3, 1.0, 1e200] {
        let line = Line::through(DVec2::ZERO, DVec2::new(spacing, spacing)).unwrap();
        near(line.project(DVec2::X).unwrap(), DVec2::splat(0.5));
        near(
            line.point_at_distance_m(2.0_f64.sqrt()).unwrap(),
            DVec2::ONE,
        );
    }
}
