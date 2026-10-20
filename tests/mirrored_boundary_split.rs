//! Acceptance contract: splitting one linked mirrored free knot splits its peer atomically.
//! All fixtures are disposable and remain in memory.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        curves,
        meshing::MeshingSettings,
        polygon::{EdgeNotch, FreeCurvePoint, PolygonPattern},
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
        GarmentTemplate,
    },
};

const RIGHT: &str = "edge_2";
const LEFT: &str = "edge_4";

fn station(poly: &PolygonPattern, edge: &str, span: usize) -> f64 {
    let i = poly.edges.iter().position(|e| e == edge).unwrap();
    poly.edge_cubic_spans(i)
        .unwrap()
        .iter()
        .take(span)
        .map(|(_, cubic)| {
            curves::flatten(*cubic, curves::FLATNESS_M)
                .unwrap()
                .windows(2)
                .map(|segment| segment[0].distance(segment[1]))
                .sum::<f64>()
        })
        .sum()
}

fn distance_to_path(point: DVec2, path: &[DVec2]) -> f64 {
    path.windows(2)
        .map(|segment| {
            let delta = segment[1] - segment[0];
            let t = ((point - segment[0]).dot(delta) / delta.length_squared()).clamp(0., 1.);
            point.distance(segment[0] + delta * t)
        })
        .fold(f64::INFINITY, f64::min)
}

fn assert_reflected_boundary(poly: &PolygonPattern) {
    let center_x = (poly
        .points
        .iter()
        .map(|p| p.x)
        .fold(f64::INFINITY, f64::min)
        + poly
            .points
            .iter()
            .map(|p| p.x)
            .fold(f64::NEG_INFINITY, f64::max))
        * 0.5;
    let samples = |edges: [&str; 2]| {
        let mut joined = Vec::new();
        for edge in edges {
            let index = poly.edges.iter().position(|name| name == edge).unwrap();
            let points = poly.edge_points(index).unwrap();
            joined.extend(points.into_iter().skip(usize::from(!joined.is_empty())));
        }
        joined
    };
    let right = samples([RIGHT, "edge_2_2"]);
    let left = samples([LEFT, "edge_4_2"]);
    for point in &right {
        assert!(
            distance_to_path(DVec2::new(2. * center_x - point.x, point.y), &left) < 0.00055,
            "linked contour lost reflected geometry at {point:?}"
        );
    }
    for point in &left {
        assert!(
            distance_to_path(DVec2::new(2. * center_x - point.x, point.y), &right) < 0.00055,
            "reflected contour lost linked geometry at {point:?}"
        );
    }
}

fn fixture(sewn: bool) -> GarmentTemplate {
    let base = presets::basic(GarmentKind::Tshirt, 0);
    let mut t = authoring::apply(
        &base,
        Command::Polygon {
            points: vec![
                DVec2::ZERO,
                DVec2::new(0.4, 0.),
                DVec2::new(0.4, 0.3),
                DVec2::new(0., 0.3),
            ],
            tangents: vec![],
            meshing: MeshingSettings {
                target_edge_m: 0.05,
                ..Default::default()
            },
            fabric: "woven-reference".into(),
            replace: true,
        },
    )
    .unwrap()
    .template;
    let panel = t.panels[0].id.clone();
    let poly = t.panels[0].polygon.as_mut().unwrap();
    // Right runs downward and left runs upward: matching knots have t + t' = 1.
    for (edge, controls) in [
        (
            RIGHT,
            vec![
                ("right-primary", 0.4, 0.415, 0.12, "primary"),
                ("right-secondary", 0.8, 0.412, 0.24, "secondary"),
            ],
        ),
        (
            LEFT,
            vec![
                ("left-secondary", 0.2, -0.012, 0.24, "secondary"),
                ("left-primary", 0.6, -0.015, 0.12, "primary"),
            ],
        ),
    ] {
        poly.free_curve_points.insert(
            edge.into(),
            controls
                .into_iter()
                .map(|(id, u, x, y, group)| FreeCurvePoint {
                    id: id.into(),
                    t: u,
                    position: DVec2::new(x, y),
                    derivative: None, derivative_in:None, derivative_out:None,
                    mirror_group: Some(group.into()),
                })
                .collect(),
        );
        poly.seam_allowances.insert(edge.into(), 0.012);
        poly.notches.insert(
            edge.into(),
            vec![
                EdgeNotch {
                    t: 0.1,
                    depth_m: 0.003,
                },
                EdgeNotch {
                    t: 0.9,
                    depth_m: 0.003,
                },
            ],
        );
    }
    let shape = poly.clone();
    t = authoring::apply(
        &t,
        Command::Shape {
            panel,
            polygon: shape,
        },
    )
    .unwrap()
    .template;
    for edge in [RIGHT, LEFT] {
        let len = authoring::edge_length(t.panels[0].polygon.as_ref().unwrap(), edge).unwrap();
        t.panels[0]
            .polygon
            .as_mut()
            .unwrap()
            .target_lengths
            .insert(edge.into(), len);
    }
    if sewn {
        t = authoring::apply(
            &t,
            Command::Duplicate {
                panel: t.panels[0].id.clone(),
            },
        )
        .unwrap()
        .template;
        for (edge, side) in [(RIGHT, Side::Right), (LEFT, Side::Left)] {
            let boundary = |panel: String| BoundaryRef {
                panel,
                side,
                edge: Some(edge.into()),
                range: [0., 1.],
            };
            t.seams.push(SeamSpec {
                id: format!("sew-{edge}"),
                a: boundary(t.panels[0].id.clone()),
                b: boundary(t.panels[1].id.clone()),
                reverse_b: false,
                notches: vec![[0.2, 0.2], [0.8, 0.8]],
                stiffness: 50_000.,
                allow_ease: false,
            });
        }
    }
    t.compile()
        .expect("mirrored authoring fixture must compile");
    t
}

#[test]
fn paired_split_promotes_both_knots_and_preserves_references_history_and_json() {
    for sewn in [false, true] {
        let original = fixture(sewn);
        let old_json = serde_json::to_vec(&original).unwrap();
        let before = original.panels[0].polygon.as_ref().unwrap();
        let old_marks: Vec<_> = [RIGHT, LEFT]
            .into_iter()
            .flat_map(|edge| {
                before.notches[edge]
                    .iter()
                    .map(move |notch| before.notch_segment(edge, notch).unwrap()[0])
            })
            .collect();
        let old_lengths: Vec<_> = [RIGHT, LEFT]
            .into_iter()
            .map(|edge| authoring::edge_length(before, edge).unwrap())
            .collect();
        let mut history = History::default();
        history.record(original.clone());
        let result = authoring::apply(
            &original,
            Command::SplitBoundary {
                panel: original.panels[0].id.clone(),
                edge: RIGHT.into(),
                at_m: station(before, RIGHT, 1),
            },
        )
        .expect("one linked knot must split both boundaries")
        .template;
        assert_eq!(serde_json::to_vec(&original).unwrap(), old_json);
        let after = result.panels[0].polygon.as_ref().unwrap();
        assert_eq!(after.edges.len(), before.edges.len() + 2);
        assert_reflected_boundary(after);
        for (edge, expected_id, expected_length) in [
            (RIGHT, "right-primary", old_lengths[0]),
            (LEFT, "left-primary", old_lengths[1]),
        ] {
            let child = format!("{edge}_2");
            assert!(after.edges.contains(&child), "missing successor {child}");
            assert_eq!(
                after.vertex_ids.get(&child).map(String::as_str),
                Some(expected_id)
            );
            assert!(after
                .free_curve_points
                .values()
                .flatten()
                .all(|k| k.id != expected_id));
            assert_eq!(after.seam_allowances.get(edge), Some(&0.012));
            assert_eq!(after.seam_allowances.get(&child), Some(&0.012));
            assert!(
                (after.target_lengths[edge] + after.target_lengths[&child] - expected_length).abs()
                    < 1e-8
            );
            assert!(
                (authoring::edge_length(after, edge).unwrap()
                    + authoring::edge_length(after, &child).unwrap()
                    - expected_length)
                    .abs()
                    < 0.00035
            );
        }
        assert_eq!(
            after
                .free_curve_points
                .values()
                .flatten()
                .filter(|k| k.mirror_group.as_deref() == Some("secondary"))
                .count(),
            2
        );
        let shift = after.points[0] - before.points[0];
        for mark in old_marks {
            let migrated: Vec<_> = [RIGHT, "edge_2_2", LEFT, "edge_4_2"]
                .into_iter()
                .flat_map(|edge| {
                    after
                        .notches
                        .get(edge)
                        .into_iter()
                        .flatten()
                        .map(move |notch| after.notch_segment(edge, notch).unwrap()[0])
                })
                .collect();
            assert!(migrated
                .iter()
                .any(|new| new.distance(mark + shift) < 0.00055));
        }
        if sewn {
            assert_eq!(result.seams.len(), 4);
            assert!(result.seams.iter().all(|seam| seam.notches.len() <= 2));
        }
        result.compile().unwrap();
        let json = serde_json::to_vec(&result).unwrap();
        let reopened: GarmentTemplate = serde_json::from_slice(&json).unwrap();
        assert_eq!(serde_json::to_vec(&reopened).unwrap(), json);
        reopened.compile().unwrap();
        let undo = history.restore(&result, false).unwrap().template;
        assert_eq!(serde_json::to_vec(&undo).unwrap(), old_json);
        let redo = history.restore(&undo, true).unwrap().template;
        assert_eq!(serde_json::to_vec(&redo).unwrap(), json);
    }
}

#[test]
fn paired_split_rejects_mismatched_geometry_and_manufacturing_notch_atomically() {
    for notch_collision in [false, true] {
        let mut source = fixture(false);
        if notch_collision {
            let poly = source.panels[0].polygon.as_mut().unwrap();
            let fraction = station(poly, LEFT, 2) / authoring::edge_length(poly, LEFT).unwrap();
            poly.notches.get_mut(LEFT).unwrap()[0].t = fraction;
        } else {
            // A stored reflected peer with incompatible geometry must not be split alone.
            source.panels[0]
                .polygon
                .as_mut()
                .unwrap()
                .free_curve_points
                .get_mut(LEFT)
                .unwrap()[1]
                .position
                .x -= 0.003;
        }
        let bytes = serde_json::to_vec(&source).unwrap();
        let poly = source.panels[0].polygon.as_ref().unwrap();
        let result = authoring::apply(
            &source,
            Command::SplitBoundary {
                panel: source.panels[0].id.clone(),
                edge: RIGHT.into(),
                at_m: station(poly, RIGHT, 1),
            },
        );
        assert!(
            result.is_err(),
            "invalid mirrored transaction must fail closed"
        );
        assert_eq!(serde_json::to_vec(&source).unwrap(), bytes);
    }
}
