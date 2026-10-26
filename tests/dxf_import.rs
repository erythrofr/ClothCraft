//! Hand-authored fixtures following Autodesk group-code tables, not our exporter.
use glam::DVec2;
use marvelous_cloth::garment::dxf_import::{Options, read_ascii};

fn document(units: Option<i32>, entities: &str) -> String {
    let header = units
        .map(|u| format!("0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n{u}\n0\nENDSEC\n"))
        .unwrap_or_default();
    format!("{header}0\nSECTION\n2\nENTITIES\n{entities}0\nENDSEC\n0\nEOF\n")
}
const LINE: &str = "0\nLINE\n5\nA1\n8\nSEW\n10\n0\n20\n0\n11\n100\n21\n0\n";
const RECT: &str = "0\nLWPOLYLINE\n8\nCUT\n90\n4\n70\n1\n10\n0\n20\n0\n10\n100\n20\n0\n10\n100\n20\n200\n10\n0\n20\n200\n";

#[test]
fn finite_inputs_with_overflowing_geometry_are_rejected() {
    for input in [
        "0\nARC\n10\n1e308\n20\n0\n40\n1e308\n50\n0\n51\n90\n",
        "0\nLWPOLYLINE\n90\n2\n10\n-1e308\n20\n0\n10\n1e308\n20\n0\n",
    ] {
        let d = read_ascii(&document(Some(6), input), Options::default()).unwrap();
        assert!(d.paths.is_empty());
        assert_eq!(d.issues.len(), 1);
    }
}

#[test]
fn millimetre_layers_are_separate_and_open_lines_are_not_sewn_or_closed() {
    let d = read_ascii(
        &document(Some(4), &format!("{RECT}{LINE}")),
        Options::default(),
    )
    .unwrap();
    assert!(d.issues.is_empty());
    assert_eq!(d.paths.len(), 2);
    let p = &d.paths[0];
    assert_eq!(p.layer, "CUT");
    assert!(p.closed);
    assert_eq!(p.points.len(), 5);
    assert_eq!(p.points[2], DVec2::new(0.1, 0.2));
    let area: f64 = p
        .points
        .windows(2)
        .map(|p| p[0].perp_dot(p[1]))
        .sum::<f64>()
        * 0.5;
    assert!((area - 0.02).abs() < 1e-12);
    assert_eq!(d.paths[1].layer, "SEW");
    assert_eq!(d.paths[1].handle.as_deref(), Some("A1"));
    assert!(!d.paths[1].closed);
    assert_eq!(d.paths[1].points.len(), 2);
}

#[test]
fn missing_units_require_choice_and_override_is_recorded() {
    assert!(read_ascii(&document(None, LINE), Options::default()).is_err());
    assert!(read_ascii(&document(Some(0), LINE), Options::default()).is_err());
    let d = read_ascii(
        &document(None, LINE),
        Options {
            metres_per_unit: Some(0.01),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(d.scale_overridden);
    assert_eq!(d.paths[0].points[1].x, 1.);
    let inches = read_ascii(&document(Some(1), LINE), Options::default()).unwrap();
    assert!((inches.paths[0].points[1].x - 2.54).abs() < 1e-12);
    for scale in [0., -1., f64::NAN, f64::INFINITY] {
        assert!(
            read_ascii(
                &document(Some(4), LINE),
                Options {
                    metres_per_unit: Some(scale),
                    ..Default::default()
                }
            )
            .is_err()
        );
    }
}

#[test]
fn legacy_closed_polyline_preserves_literal_layer_and_dimensions() {
    let input = "0\nPOLYLINE\n8\nCUT front\n66\n1\n70\n1\n0\nVERTEX\n10\n0\n20\n0\n0\nVERTEX\n10\n100\n20\n0\n0\nVERTEX\n10\n0\n20\n100\n0\nSEQEND\n";
    let d = read_ascii(&document(Some(4), input), Options::default()).unwrap();
    assert!(d.issues.is_empty());
    assert_eq!(d.paths[0].layer, "CUT front");
    assert_eq!(
        d.paths[0].points,
        vec![
            DVec2::ZERO,
            DVec2::new(0.1, 0.),
            DVec2::new(0., 0.1),
            DVec2::ZERO
        ]
    );
    assert!(
        read_ascii(
            &document(Some(4), &input.replace("0\nSEQEND\n", "")),
            Options::default()
        )
        .is_err()
    );
}

#[test]
fn quarter_arc_has_analytic_endpoints_and_chord_error_bound() {
    let input = "0\nARC\n8\ncurve\n10\n0\n20\n0\n40\n100\n50\n0\n51\n90\n";
    let d = read_ascii(&document(Some(4), input), Options::default()).unwrap();
    assert!(d.issues.is_empty());
    let p = &d.paths[0];
    assert!(p.points[0].distance(DVec2::new(0.1, 0.)) < 1e-12);
    assert!(p.points.last().unwrap().distance(DVec2::new(0., 0.1)) < 1e-12);
    assert!(!p.closed);
    for segment in p.points.windows(2) {
        let mid = (segment[0] + segment[1]) * 0.5;
        assert!(0.1 - mid.length() <= 0.0001 + 1e-12);
        assert!(segment[0].perp_dot(segment[1]) > 0.);
    }
}

#[test]
fn signed_bulges_follow_counterclockwise_and_clockwise_semicircles() {
    for (bulge, sign) in [(1., -1.), (-1., 1.)] {
        let input = format!("0\nLWPOLYLINE\n90\n2\n10\n0\n20\n0\n42\n{bulge}\n10\n100\n20\n0\n");
        let d = read_ascii(&document(Some(4), &input), Options::default()).unwrap();
        assert!(d.issues.is_empty());
        let p = &d.paths[0].points;
        assert_eq!(p[0], DVec2::ZERO);
        assert_eq!(*p.last().unwrap(), DVec2::new(0.1, 0.));
        assert!(p.iter().any(|p| p.y * sign > 0.049));
        for v in p {
            assert!((v.distance(DVec2::new(0.05, 0.)) - 0.05).abs() < 1e-12);
        }
    }
}

#[test]
fn unsupported_entities_and_transforms_remain_visible_as_issues() {
    let input = format!(
        "{LINE}0\nINSERT\n8\nSEW\n2\nblock\n0\nTEXT\n8\nlabels\n1\nfront\n{}",
        LINE.replace("11\n100", "210\n0\n220\n0\n230\n-1\n11\n100")
    );
    let d = read_ascii(&document(Some(4), &input), Options::default()).unwrap();
    assert_eq!(d.paths.len(), 1);
    assert_eq!(d.issues.len(), 3);
    assert_eq!(d.issues[0].entity, "INSERT");
    assert_eq!(d.issues[1].layer, "labels");
    assert!(d.issues[2].reason.contains("extrusion"));
}

#[test]
fn malformed_and_nonfinite_inputs_do_not_become_silent_geometry() {
    for text in ["0\nSECTION", "AutoCAD Binary DXF\0", "0\nEOF\n0\nLINE\n"] {
        assert!(read_ascii(text, Options::default()).is_err());
    }
    for input in [
        LINE.replace("11\n100", "11\nNaN"),
        RECT.replace("90\n4", "90\n3"),
        LINE.replace("11\n100", "30\n1\n11\n100"),
    ] {
        let d = read_ascii(&document(Some(4), &input), Options::default()).unwrap();
        assert!(d.paths.is_empty());
        assert_eq!(d.issues.len(), 1);
    }
}

#[test]
fn circle_is_closed_and_excessive_sampling_is_reported() {
    let input = "0\nCIRCLE\n10\n20\n20\n30\n40\n10\n";
    let d = read_ascii(&document(Some(4), input), Options::default()).unwrap();
    assert!(d.issues.is_empty());
    let p = &d.paths[0];
    assert!(p.closed);
    assert_eq!(p.points.first(), p.points.last());
    for v in &p.points {
        assert!((v.distance(DVec2::new(0.02, 0.03)) - 0.01).abs() < 1e-12);
    }
    let d = read_ascii(
        &document(Some(4), input),
        Options {
            chord_error_m: 1e-30,
            ..Default::default()
        },
    )
    .unwrap();
    assert!(d.paths.is_empty());
    assert!(d.issues[0].reason.contains("budget"));
}
