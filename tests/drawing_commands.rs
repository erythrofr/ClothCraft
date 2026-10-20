//! Command-layer tests for the reworked drawing process: exact metric point
//! edits, splitting and rejoining a contour, corner/curve conversion and
//! required boundary lengths. Property tests cover the failure mode that a
//! contour is *almost* right.
use glam::{DVec2, DVec3};
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        GarmentTemplate, curves,
        meshing::MeshingSettings,
        polygon::PolygonPattern,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, Side},
        template::Panel,
    },
};
use std::collections::BTreeSet;

/// Deterministic xorshift, so every property test is reproducible.
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
    fn range(&mut self, low: f64, high: f64) -> f64 {
        low + (high - low) * self.next()
    }
    fn below(&mut self, limit: usize) -> usize {
        (self.next() * limit as f64) as usize % limit
    }
}

fn polygon(points: Vec<DVec2>) -> GarmentTemplate {
    authoring::apply(
        &presets::basic(GarmentKind::Tshirt, 0),
        Command::Polygon {
            points,
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
    .template
}

fn rectangle(width: f64, height: f64) -> GarmentTemplate {
    polygon(vec![
        DVec2::ZERO,
        DVec2::new(width, 0.),
        DVec2::new(width, height),
        DVec2::new(0., height),
    ])
}

/// A simple star-shaped contour: points sorted by angle never self-cross.
fn random_contour(rng: &mut Rng, count: usize) -> Vec<DVec2> {
    (0..count)
        .map(|i| {
            let angle = i as f64 * std::f64::consts::TAU / count as f64 + rng.range(0., 0.15);
            let radius = rng.range(0.18, 0.45);
            DVec2::new(0.6 + angle.cos() * radius, 0.6 + angle.sin() * radius)
        })
        .collect()
}

fn contour(template: &GarmentTemplate) -> &PolygonPattern {
    template.panels[0].polygon.as_ref().unwrap()
}

fn measured(template: &GarmentTemplate, edge: &str) -> f64 {
    authoring::edge_length(contour(template), edge).unwrap()
}

fn assert_contour(template: &GarmentTemplate) {
    let polygon = contour(template);
    assert_eq!(polygon.points.len(), polygon.edges.len());
    let names: BTreeSet<&String> = polygon.edges.iter().collect();
    assert_eq!(names.len(), polygon.edges.len(), "duplicate boundary name");
    assert!(
        polygon
            .points
            .iter()
            .all(|p| p.x >= -1e-12 && p.y >= -1e-12)
    );
    assert!(template.compile().is_ok());
}

fn serde_round_trip(template: &GarmentTemplate) -> GarmentTemplate {
    let json = serde_json::to_string(template).unwrap();
    let read: GarmentTemplate = serde_json::from_str(&json).unwrap();
    assert_eq!(
        serde_json::to_vec(&read).unwrap(),
        serde_json::to_vec(template).unwrap()
    );
    read
}

fn file_round_trip(template: &GarmentTemplate, tag: &str) -> GarmentTemplate {
    let path = std::env::temp_dir().join(format!(
        "clothcraft-drawing-{tag}-{}.json",
        std::process::id()
    ));
    template.save(&path).unwrap();
    let read = GarmentTemplate::load(&path).unwrap();
    std::fs::remove_file(&path).unwrap();
    read
}

/// Distance from a point to a cubic, by projection on a fine polyline. Used to
/// prove that a split reproduces the original curve instead of approximating it.
fn distance_to_cubic(cubic: [DVec2; 4], point: DVec2) -> f64 {
    let samples: Vec<DVec2> = (0..=20_000)
        .map(|i| curves::cubic(cubic, i as f64 / 20_000.))
        .collect();
    samples
        .windows(2)
        .map(|pair| {
            let d = pair[1] - pair[0];
            let t = ((point - pair[0]).dot(d) / d.length_squared().max(1e-30)).clamp(0., 1.);
            point.distance(pair[0] + d * t)
        })
        .fold(f64::MAX, f64::min)
}

/// One command, one history entry: a single undo returns the exact document and
/// leaves nothing else to undo; a single redo restores the edited document.
fn apply_one_undo(template: &GarmentTemplate, command: Command) -> GarmentTemplate {
    let before = serde_json::to_vec(template).unwrap();
    let edit = authoring::apply(template, command).unwrap();
    let mut history = History::default();
    history.record(template.clone());
    assert!(history.can_undo());
    let undo = history.restore(&edit.template, false).unwrap();
    assert_eq!(serde_json::to_vec(&undo.template).unwrap(), before);
    assert!(!history.can_undo());
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(
        serde_json::to_vec(&redo.template).unwrap(),
        serde_json::to_vec(&edit.template).unwrap()
    );
    redo.template
}

fn two_rectangles() -> GarmentTemplate {
    let start = rectangle(0.4, 0.6);
    authoring::apply(
        &start,
        Command::Duplicate {
            panel: start.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template
}

fn edge(panel: &str, name: &str) -> BoundaryRef {
    BoundaryRef {
        reversed: false,
        panel: panel.into(),
        side: Side::Top,
        edge: Some(name.into()),
        range: [0., 1.],
    }
}

#[test]
fn millimetres_convert_to_metres_exactly() {
    // The whole units discipline in one place. 350 mm is the value that makes a
    // `* 0.001` implementation visibly wrong.
    assert_eq!(authoring::mm_to_m(400.), 0.4);
    assert_eq!(authoring::mm_to_m(600.), 0.6);
    assert_eq!(authoring::mm_to_m(350.), 0.35);
    assert_eq!(authoring::mm_to_m(1.), 0.001);
    assert_eq!(authoring::mm_to_m(10.), 0.01);
    assert_ne!(350. * 0.001, authoring::mm_to_m(350.));
    assert_eq!(authoring::m_to_mm(0.4), 400.);
    assert_eq!(authoring::deviation_mm(0.4, 0.4), 0.);
    // 1 mm measured on a 400 mm target; the subtraction itself rounds, so this
    // is a readout tolerance, not an exactness claim.
    assert!((authoring::deviation_mm(0.401, 0.4) - 1.).abs() < 1e-9);
}

/// The two pre-existing byte drifts are: a trailing newline in `curved-panels`
/// and `local-ease` (this repo's `save()` emits none), and `8e-05`/`4e-05`
/// exponent float text in `curved-panels` (serde_json writes `0.00008`/`0.00004`).
/// Do not "clean these up": the drift assertion below is a guard, and changing
/// the files would both hide it and invalidate recorded validation results.
#[test]
fn existing_fixtures_keep_their_content_and_gain_no_targets() {
    let mut checked = 0;
    let mut byte_drift = Vec::new();
    for entry in std::fs::read_dir("examples/templates").unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }
        let original = std::fs::read_to_string(&path).unwrap();
        let template = GarmentTemplate::load(&path).unwrap();
        let reserialized = serde_json::to_string_pretty(&template).unwrap();
        // The schema addition must not add, remove or change one field value.
        // Compare the parsed trees: some existing fixtures use non-canonical
        // float text (`8e-05`), which is pre-existing and not regenerated here.
        assert_eq!(
            serde_json::to_value(&template).unwrap(),
            serde_json::from_str::<serde_json::Value>(&original).unwrap(),
            "{} changed content when loaded",
            path.display()
        );
        if reserialized != original.trim_end_matches('\n') {
            // Pre-existing text formatting only (a trailing newline or exponent
            // float notation); the content comparison above is the real check.
            byte_drift.push(path.display().to_string().replace('\\', "/"));
        }
        assert!(
            !reserialized.contains("target_lengths"),
            "{} gained an empty target map",
            path.display()
        );
        // Re-saving the loaded document is a fixed point, so no fixture would be
        // rewritten by a later save.
        let reloaded = file_round_trip(&template, "fixture");
        assert_eq!(
            serde_json::to_vec(&reloaded).unwrap(),
            serde_json::to_vec(&template).unwrap()
        );
        checked += 1;
    }
    // Two fixtures carry pre-existing, non-canonical float text (`8e-05`) and a
    // trailing newline. Their content is unchanged and they must not be
    // regenerated, so this is the accepted, enforced drift set.
    byte_drift.sort();
    assert_eq!(
        byte_drift,
        vec![
            "examples/templates/curved-panels.json".to_string(),
            "examples/templates/local-ease.json".to_string()
        ],
        "unexpected fixture byte drift"
    );
    assert!(
        checked >= 4,
        "expected the template fixtures, found {checked}"
    );
}

#[test]
fn split_boundary_inserts_at_the_exact_material_arclength() {
    let start = rectangle(0.4, 0.6);
    let id = start.panels[0].id.clone();
    let edit = authoring::apply(
        &start,
        Command::SplitBoundary {
            panel: id.clone(),
            edge: "edge_1".into(),
            at_m: authoring::mm_to_m(100.),
        },
    )
    .unwrap();
    assert_eq!(edit.new_point, Some(1));
    let polygon = contour(&edit.template);
    assert_eq!(polygon.points.len(), 5);
    assert_eq!(polygon.edges.len(), 5);
    // The first half keeps the name; the second half is derived and deterministic.
    assert_eq!(polygon.edges[0], "edge_1");
    assert_eq!(polygon.edges[1], "edge_1_2");
    assert_eq!(
        polygon.points[1],
        DVec2::new(authoring::mm_to_m(100.), 0.),
        "the inserted point must sit at exactly 100 mm along the edge"
    );
    let first = measured(&edit.template, "edge_1");
    let second = measured(&edit.template, "edge_1_2");
    assert_eq!(first, authoring::mm_to_m(100.));
    assert!((first + second - 0.4).abs() < 1e-12);
    assert_contour(&edit.template);

    // Exact through serde and through a real file save/load.
    let read = serde_round_trip(&edit.template);
    assert_eq!(contour(&read).points, polygon.points);
    let loaded = file_round_trip(&read, "split");
    assert_eq!(
        measured(&loaded, "edge_1"),
        measured(&edit.template, "edge_1")
    );
    assert_eq!(contour(&loaded).edges, polygon.edges);

    let redone = apply_one_undo(
        &start,
        Command::SplitBoundary {
            panel: id,
            edge: "edge_1".into(),
            at_m: authoring::mm_to_m(100.),
        },
    );
    assert_eq!(contour(&redone).points.len(), 5);
}

#[test]
fn split_and_remove_restore_the_original_contour_exactly() {
    let mut rng = Rng(0x5eed_1234);
    for _ in 0..40 {
        let count = 3 + rng.below(6);
        let start = polygon(random_contour(&mut rng, count));
        let id = start.panels[0].id.clone();
        let before = contour(&start).clone();
        let edge_index = rng.below(count);
        let name = before.edges[edge_index].clone();
        let length = measured(&start, &name);
        let at_m = length * rng.range(0.05, 0.95);
        let split = authoring::apply(
            &start,
            Command::SplitBoundary {
                panel: id.clone(),
                edge: name,
                at_m,
            },
        )
        .unwrap();
        let new_index = split.new_point.unwrap();
        assert_eq!(new_index, edge_index + 1);
        assert_contour(&split.template);
        // The inserted point is on the original segment.
        let a = before.points[edge_index];
        let b = before.points[(edge_index + 1) % count];
        let t = at_m / length;
        let inserted = contour(&split.template).points[new_index];
        assert!(inserted.distance(a.lerp(b, t)) < 1e-12);
        let removed = authoring::apply(
            &split.template,
            Command::RemovePoint {
                panel: id.clone(),
                point: new_index,
            },
        )
        .unwrap();
        let after = contour(&removed.template);
        assert_eq!(after.points, before.points);
        assert_eq!(after.edges, before.edges);
        assert_eq!(after.curves, before.curves);
        let loaded = file_round_trip(&removed.template, "rejoin");
        assert_eq!(contour(&loaded).points, before.points);
        assert_eq!(contour(&loaded).edges, before.edges);
    }
}

#[test]
fn split_preserves_area_and_perimeter() {
    fn area(polygon: &PolygonPattern) -> f64 {
        (0..polygon.points.len())
            .map(|i| polygon.points[i].perp_dot(polygon.points[(i + 1) % polygon.points.len()]))
            .sum::<f64>()
            * 0.5
    }
    fn perimeter(polygon: &PolygonPattern) -> f64 {
        polygon
            .edges
            .iter()
            .map(|name| authoring::edge_length(polygon, name).unwrap())
            .sum()
    }
    let mut rng = Rng(0xabcd_ef01);
    for _ in 0..40 {
        let count = 3 + rng.below(6);
        let start = polygon(random_contour(&mut rng, count));
        let id = start.panels[0].id.clone();
        let edge_index = rng.below(count);
        let name = contour(&start).edges[edge_index].clone();
        let length = measured(&start, &name);
        let at_m = length * rng.range(0.05, 0.95);
        let area_before = area(contour(&start));
        let perimeter_before = perimeter(contour(&start));
        let edit = authoring::apply(
            &start,
            Command::SplitBoundary {
                panel: id,
                edge: name,
                at_m,
            },
        )
        .unwrap();
        assert_contour(&edit.template);
        assert!((area(contour(&edit.template)) - area_before).abs() < 1e-9);
        assert!((perimeter(contour(&edit.template)) - perimeter_before).abs() < 1e-12);
    }
}

#[test]
fn splitting_a_curved_boundary_keeps_the_outline() {
    // One edge of a rectangle becomes a real cubic, then it is split.
    let start = rectangle(0.4, 0.6);
    let id = start.panels[0].id.clone();
    let cubic = [
        DVec2::ZERO,
        DVec2::new(0.1, 0.12),
        DVec2::new(0.3, 0.12),
        DVec2::new(0.4, 0.),
    ];
    let mut with_curve = contour(&start).clone();
    with_curve
        .curves
        .insert("edge_1".into(), [cubic[1], cubic[2]]);
    let curved = authoring::apply(
        &start,
        Command::Shape {
            panel: id.clone(),
            polygon: with_curve,
        },
    )
    .unwrap()
    .template;
    let outline_before: f64 = contour(&curved)
        .edges
        .iter()
        .map(|name| measured(&curved, name))
        .sum();
    let length = measured(&curved, "edge_1");
    let at_m = length * 0.37;
    let edit = authoring::apply(
        &curved,
        Command::SplitBoundary {
            panel: id,
            edge: "edge_1".into(),
            at_m,
        },
    )
    .unwrap();
    assert_contour(&edit.template);
    let polygon = contour(&edit.template);
    assert_eq!(polygon.curves.len(), 2);
    assert!(polygon.curves.contains_key("edge_1"));
    assert!(polygon.curves.contains_key("edge_1_2"));
    // de Casteljau splitting reproduces the same curve: every sample of either
    // half lies on the original cubic, so the split is geometric, not approximate.
    for name in ["edge_1", "edge_1_2"] {
        let index = polygon
            .edges
            .iter()
            .position(|candidate| candidate == name)
            .unwrap();
        for sample in polygon.edge_points(index).unwrap() {
            let distance = distance_to_cubic(cubic, sample);
            assert!(
                distance < 1e-9,
                "{name} sample {sample:?} leaves the original curve by {distance}"
            );
        }
    }
    // Totals may differ only by tessellation of one cubic versus two halves.
    let outline_after: f64 = polygon
        .edges
        .iter()
        .map(|name| measured(&edit.template, name))
        .sum();
    assert!(
        (outline_after - outline_before).abs() < 1e-4,
        "{outline_after} vs {outline_before}"
    );
    // The inserted point lands at the requested material arclength.
    let inserted = polygon.points[edit.new_point.unwrap()];
    let arc = authoring::edge_length(polygon, "edge_1").unwrap();
    assert!((arc - at_m).abs() < 1e-6, "{arc} vs {at_m}");
    assert!(authoring::edge_length(polygon, "edge_1_2").unwrap() > 0.);
    assert!(inserted.x.is_finite() && inserted.y.is_finite());
    // Exact through a file round trip.
    let loaded = file_round_trip(&edit.template, "curvedsplit");
    assert_eq!(contour(&loaded).points, polygon.points);
    assert_eq!(contour(&loaded).curves, polygon.curves);
}

#[test]
fn corner_curve_round_trip_preserves_the_contour() {
    let mut rng = Rng(0x1234_abcd);
    for _ in 0..40 {
        let count = 3 + rng.below(6);
        let start = polygon(random_contour(&mut rng, count));
        let id = start.panels[0].id.clone();
        let before = contour(&start).clone();
        let anchor = rng.below(count);
        let outline_before: f64 = before
            .edges
            .iter()
            .map(|name| authoring::edge_length(&before, name).unwrap())
            .sum();
        let curved = authoring::apply(
            &start,
            Command::CurvePoint {
                panel: id.clone(),
                anchor,
                curved: true,
            },
        )
        .unwrap()
        .template;
        assert_contour(&curved);
        let polygon = contour(&curved);
        // Converting a corner to a curve must not move the contour.
        assert_eq!(polygon.points, before.points);
        assert_eq!(polygon.edges, before.edges);
        let incoming = (anchor + count - 1) % count;
        assert!(polygon.curves.contains_key(&before.edges[incoming]));
        assert!(polygon.curves.contains_key(&before.edges[anchor]));
        let outline_curved: f64 = polygon
            .edges
            .iter()
            .map(|name| authoring::edge_length(polygon, name).unwrap())
            .sum();
        assert!((outline_curved - outline_before).abs() < 1e-9);
        // Straightening again restores the exact original contour.
        let straight = authoring::apply(
            &curved,
            Command::CurvePoint {
                panel: id.clone(),
                anchor,
                curved: false,
            },
        )
        .unwrap()
        .template;
        assert_eq!(contour(&straight).points, before.points);
        assert_eq!(contour(&straight).edges, before.edges);
        assert!(contour(&straight).curves.is_empty());
        // Exact through a file round trip.
        let loaded = file_round_trip(&straight, "curve");
        assert_eq!(contour(&loaded).points, before.points);
        assert_eq!(contour(&loaded).curves, before.curves);
    }
}

fn world(panel: &Panel, uv: DVec2) -> DVec3 {
    panel.placement.transform(DVec3::new(uv.x, -uv.y, 0.))
}

#[test]
fn move_selection_translates_exactly_the_selected_points() {
    // Exact case: the moved points are not the local-origin corners, so the
    // command's re-basing does not shift the stored coordinates.
    let start = rectangle(0.4, 0.6);
    let before = contour(&start).clone();
    let delta = DVec2::new(0.001, 0.01);
    let edit = authoring::apply(
        &start,
        Command::MovePoints {
            panel: start.panels[0].id.clone(),
            points: vec![1, 2, 1],
            delta,
        },
    )
    .unwrap();
    let after = contour(&edit.template);
    assert_eq!(after.edges, before.edges);
    assert_eq!(after.points[0], before.points[0]);
    assert_eq!(after.points[3], before.points[3]);
    assert_eq!(after.points[1], before.points[1] + delta);
    assert_eq!(after.points[2], before.points[2] + delta);
    let loaded = file_round_trip(&edit.template, "moves");
    assert_eq!(contour(&loaded).points, after.points);

    // Property: the selection moves together and the re-basing never changes
    // world geometry of the selected or untouched points.
    let mut rng = Rng(0x0f0f_0f0f);
    for _ in 0..30 {
        let count = 4 + rng.below(5);
        let start = polygon(random_contour(&mut rng, count));
        let id = start.panels[0].id.clone();
        let before_panel = start.panels[0].clone();
        let before = contour(&start).clone();
        let first = rng.below(count);
        let mut second = rng.below(count);
        while second == first {
            second = rng.below(count);
        }
        let delta = DVec2::new(0.001, -0.01);
        let edit = authoring::apply(
            &start,
            Command::MovePoints {
                panel: id,
                points: vec![first, second, first],
                delta,
            },
        )
        .unwrap();
        assert_contour(&edit.template);
        let after_panel = &edit.template.panels[0];
        let after = contour(&edit.template);
        assert_eq!(after.edges, before.edges);
        assert_eq!(after.curves, before.curves);
        for index in 0..count {
            let moved = index == first || index == second;
            let displacement = world(after_panel, after.points[index])
                - world(&before_panel, before.points[index]);
            // Material y is negated into the world's z-up coordinates.
            let expected = if moved {
                DVec2::new(delta.x, -delta.y)
            } else {
                DVec2::ZERO
            };
            assert!(
                (displacement - DVec3::new(expected.x, expected.y, 0.)).length() < 1e-12,
                "point {index}: {displacement:?}"
            );
        }
        let loaded = file_round_trip(&edit.template, "moveproperty");
        assert_eq!(contour(&loaded).points, after.points);
    }
}

#[test]
fn nudge_converts_metric_steps_exactly() {
    let start = rectangle(0.4, 0.6);
    let id = start.panels[0].id.clone();
    let before = contour(&start).points[1];
    // 350 mm is the value where a `* 0.001` conversion is visibly wrong. The
    // positive y step keeps the moved point away from the local-origin corner,
    // so the stored coordinates are exactly the requested translation.
    let edit = authoring::apply(
        &start,
        Command::Nudge {
            panel: id.clone(),
            points: vec![1],
            delta_mm: DVec2::new(350., 10.),
        },
    )
    .unwrap();
    let after = contour(&edit.template).points[1];
    assert_eq!(after.x, before.x + 0.35);
    assert_eq!(after.y, before.y + 0.01);
    assert_eq!(after.x, before.x + authoring::mm_to_m(350.));
    assert_eq!(after.y, before.y + authoring::mm_to_m(10.));
    assert_contour(&edit.template);
    let loaded = file_round_trip(&edit.template, "nudge");
    assert_eq!(contour(&loaded).points[1], after);
    let redone = apply_one_undo(
        &start,
        Command::Nudge {
            panel: id,
            points: vec![1],
            delta_mm: DVec2::new(350., 10.),
        },
    );
    assert_eq!(contour(&redone).points[1], after);
}

#[test]
fn target_length_is_enforced_persisted_and_reported() {
    let start = rectangle(0.4, 0.6);
    let id = start.panels[0].id.clone();
    let edit = authoring::apply(
        &start,
        Command::TargetLength {
            panel: id.clone(),
            edge: "edge_1".into(),
            target_m: authoring::mm_to_m(350.),
        },
    )
    .unwrap();
    let polygon = contour(&edit.template);
    assert_eq!(polygon.target_lengths["edge_1"], 0.35);
    assert_eq!(polygon.target_length("edge_1"), Some(0.35));
    let length = measured(&edit.template, "edge_1");
    assert!((length - 0.35).abs() < 1e-9, "{length}");
    assert!(authoring::deviation_mm(length, 0.35).abs() < 1e-6);
    // The first anchor stays fixed; the direction is preserved.
    assert_eq!(polygon.points[0], contour(&start).points[0]);
    let before_direction = (contour(&start).points[1] - contour(&start).points[0]).normalize();
    let after_direction = (polygon.points[1] - polygon.points[0]).normalize();
    assert!(before_direction.distance(after_direction) < 1e-12);
    assert_contour(&edit.template);
    // Persisted exactly through serde and a file.
    let read = serde_round_trip(&edit.template);
    assert_eq!(contour(&read).target_length("edge_1"), Some(0.35));
    assert_eq!(measured(&read, "edge_1"), length);
    let loaded = file_round_trip(&edit.template, "target");
    assert_eq!(contour(&loaded).target_length("edge_1"), Some(0.35));
    assert_eq!(measured(&loaded, "edge_1"), length);
    // Clearing the target moves no geometry and drops the specification.
    let cleared = authoring::apply(
        &loaded,
        Command::TargetLength {
            panel: id.clone(),
            edge: "edge_1".into(),
            target_m: 0.,
        },
    )
    .unwrap();
    assert_eq!(contour(&cleared.template).target_length("edge_1"), None);
    assert_eq!(contour(&cleared.template).points, polygon.points);
    // A specification is not rest geometry: storing or clearing one must not
    // invalidate the drape. Enforcing a different length does move rest geometry.
    assert!(edit.reset_simulation);
    assert!(!cleared.reset_simulation);
    let unchanged = authoring::apply(
        &loaded,
        Command::TargetLength {
            panel: id.clone(),
            edge: "edge_1".into(),
            target_m: length,
        },
    )
    .unwrap();
    assert!(!unchanged.reset_simulation);
    let redone = apply_one_undo(
        &start,
        Command::TargetLength {
            panel: id,
            edge: "edge_1".into(),
            target_m: authoring::mm_to_m(350.),
        },
    );
    assert_eq!(contour(&redone).target_length("edge_1"), Some(0.35));
}

#[test]
fn target_length_converges_on_many_contours() {
    let mut rng = Rng(0x7777_1111);
    for _ in 0..30 {
        let count = 3 + rng.below(6);
        let start = polygon(random_contour(&mut rng, count));
        let id = start.panels[0].id.clone();
        let edge_index = rng.below(count);
        let name = contour(&start).edges[edge_index].clone();
        let target = rng.range(0.15, 0.5);
        let edit = authoring::apply(
            &start,
            Command::TargetLength {
                panel: id,
                edge: name.clone(),
                target_m: target,
            },
        )
        .unwrap();
        assert_contour(&edit.template);
        let length = measured(&edit.template, &name);
        assert!((length - target).abs() < 1e-9, "{length} vs {target}");
        assert_eq!(contour(&edit.template).target_length(&name), Some(target));
    }
}

#[test]
fn target_length_is_not_enforced_on_load() {
    let start = rectangle(0.4, 0.6);
    let id = start.panels[0].id.clone();
    let targeted = authoring::apply(
        &start,
        Command::TargetLength {
            panel: id.clone(),
            edge: "edge_1".into(),
            target_m: 0.4,
        },
    )
    .unwrap()
    .template;
    // Make the geometry violate the stored specification.
    let stretched = authoring::apply(
        &targeted,
        Command::Nudge {
            panel: id,
            points: vec![1],
            delta_mm: DVec2::new(20., 0.),
        },
    )
    .unwrap()
    .template;
    let violating = measured(&stretched, "edge_1");
    assert!((violating - 0.42).abs() < 1e-9);
    // Loading must not resize anything: file content never mutates rest geometry.
    let loaded = file_round_trip(&stretched, "noteenforce");
    assert_eq!(measured(&loaded, "edge_1"), violating);
    assert_eq!(contour(&loaded).points, contour(&stretched).points);
    assert_eq!(contour(&loaded).target_length("edge_1"), Some(0.4));
    assert_eq!(
        serde_json::to_vec(&loaded).unwrap(),
        serde_json::to_vec(&stretched).unwrap()
    );
}

#[test]
fn invalid_stored_targets_are_ignored_not_trusted() {
    let start = rectangle(0.4, 0.6);
    let mut broken = start.clone();
    {
        let polygon = broken.panels[0].polygon.as_mut().unwrap();
        polygon.target_lengths.insert("edge_1".into(), f64::NAN);
        polygon.target_lengths.insert("edge_2".into(), 0.);
        polygon.target_lengths.insert("edge_3".into(), -0.5);
        polygon.target_lengths.insert("missing".into(), 0.4);
    }
    let polygon = contour(&broken);
    assert_eq!(polygon.target_length("edge_1"), None);
    assert_eq!(polygon.target_length("edge_2"), None);
    assert_eq!(polygon.target_length("edge_3"), None);
    assert_eq!(polygon.target_length("missing"), None);
    assert_eq!(polygon.target_diagnostics().len(), 4);
    // A bad value never reaches geometry or breaks compilation.
    assert!(broken.compile().is_ok());
    assert_eq!(
        broken.compile().unwrap().mesh.uv,
        start.compile().unwrap().mesh.uv
    );
    let loaded = file_round_trip(&broken, "badtarget");
    assert_eq!(contour(&loaded).target_length("edge_1"), None);
    assert_eq!(contour(&loaded).target_diagnostics().len(), 4);
}

#[test]
fn invalid_commands_are_atomic() {
    // A rectangle and a triangle, plus a two-panel document with a seam.
    let square = rectangle(0.4, 0.6);
    let triangle = polygon(vec![DVec2::ZERO, DVec2::new(0.5, 0.), DVec2::new(0., 0.5)]);
    let id = square.panels[0].id.clone();
    let sewn = {
        let two = two_rectangles();
        authoring::apply(
            &two,
            Command::Sew {
                a: edge(&two.panels[0].id, "edge_1"),
                b: edge(&two.panels[1].id, "edge_1"),
                reverse: false,
                ease: false,
            },
        )
        .unwrap()
        .template
    };
    let targeted = authoring::apply(
        &square,
        Command::TargetLength {
            panel: id.clone(),
            edge: "edge_1".into(),
            target_m: 0.4,
        },
    )
    .unwrap()
    .template;
    assert!(!sewn.seams.is_empty());

    // A legacy v1 rectangle has no contour to edit.
    let legacy = {
        let mut template = rectangle(0.4, 0.6);
        for panel in &mut template.panels {
            panel.polygon = None;
        }
        template.version = 1;
        assert!(template.compile().is_ok());
        template
    };
    let cases: Vec<(&str, GarmentTemplate, Command)> = vec![
        (
            "split at zero",
            square.clone(),
            Command::SplitBoundary {
                panel: id.clone(),
                edge: "edge_1".into(),
                at_m: 0.,
            },
        ),
        (
            "split at NaN",
            square.clone(),
            Command::SplitBoundary {
                panel: id.clone(),
                edge: "edge_1".into(),
                at_m: f64::NAN,
            },
        ),
        (
            "split beyond the boundary",
            square.clone(),
            Command::SplitBoundary {
                panel: id.clone(),
                edge: "edge_1".into(),
                at_m: 0.5,
            },
        ),
        (
            "split unknown boundary",
            square.clone(),
            Command::SplitBoundary {
                panel: id.clone(),
                edge: "edge_9".into(),
                at_m: 0.1,
            },
        ),
        (
            "split unknown panel",
            square.clone(),
            Command::SplitBoundary {
                panel: "missing".into(),
                edge: "edge_1".into(),
                at_m: 0.1,
            },
        ),
        (
            "remove out of range",
            square.clone(),
            Command::RemovePoint {
                panel: id.clone(),
                point: 9,
            },
        ),
        (
            "remove below three points",
            triangle.clone(),
            Command::RemovePoint {
                panel: triangle.panels[0].id.clone(),
                point: 1,
            },
        ),
        (
            "remove unknown panel",
            square.clone(),
            Command::RemovePoint {
                panel: "missing".into(),
                point: 1,
            },
        ),
        (
            "remove a point of a sewn boundary",
            sewn.clone(),
            Command::RemovePoint {
                panel: sewn.panels[0].id.clone(),
                point: 1,
            },
        ),
        (
            "remove a point of a targeted boundary",
            targeted.clone(),
            Command::RemovePoint {
                panel: id.clone(),
                point: 1,
            },
        ),
        (
            "curve out of range",
            square.clone(),
            Command::CurvePoint {
                panel: id.clone(),
                anchor: 9,
                curved: true,
            },
        ),
        (
            "curve on a legacy rectangle",
            legacy.clone(),
            Command::CurvePoint {
                panel: legacy.panels[0].id.clone(),
                anchor: 0,
                curved: true,
            },
        ),
        (
            "move an empty selection",
            square.clone(),
            Command::MovePoints {
                panel: id.clone(),
                points: vec![],
                delta: DVec2::new(0.001, 0.),
            },
        ),
        (
            "move out of range",
            square.clone(),
            Command::MovePoints {
                panel: id.clone(),
                points: vec![9],
                delta: DVec2::new(0.001, 0.),
            },
        ),
        (
            "move by NaN",
            square.clone(),
            Command::MovePoints {
                panel: id.clone(),
                points: vec![0],
                delta: DVec2::new(f64::NAN, 0.),
            },
        ),
        (
            "nudge by NaN",
            square.clone(),
            Command::Nudge {
                panel: id.clone(),
                points: vec![0],
                delta_mm: DVec2::new(f64::INFINITY, 0.),
            },
        ),
        (
            "target NaN",
            square.clone(),
            Command::TargetLength {
                panel: id.clone(),
                edge: "edge_1".into(),
                target_m: f64::NAN,
            },
        ),
        (
            "negative target",
            square.clone(),
            Command::TargetLength {
                panel: id.clone(),
                edge: "edge_1".into(),
                target_m: -0.4,
            },
        ),
        (
            "target unknown boundary",
            square.clone(),
            Command::TargetLength {
                panel: id.clone(),
                edge: "edge_9".into(),
                target_m: 0.4,
            },
        ),
        (
            "anchor NaN",
            square.clone(),
            Command::Anchor {
                panel: id.clone(),
                anchor: 0,
                position: DVec2::new(f64::NAN, 0.),
            },
        ),
        (
            "anchor out of range",
            square.clone(),
            Command::Anchor {
                panel: id.clone(),
                anchor: 9,
                position: DVec2::ZERO,
            },
        ),
    ];
    for (label, template, command) in cases {
        let before = serde_json::to_vec(&template).unwrap();
        assert!(
            authoring::apply(&template, command).is_err(),
            "{label} should have been rejected"
        );
        assert_eq!(
            before,
            serde_json::to_vec(&template).unwrap(),
            "{label} mutated the document"
        );
    }
    // A point on a curved boundary cannot be deleted until its handles go.
    let mut curved = contour(&square).clone();
    curved.curves.insert(
        "edge_1".into(),
        [DVec2::new(0.1, 0.05), DVec2::new(0.2, 0.05)],
    );
    let curved = authoring::apply(
        &square,
        Command::Shape {
            panel: id,
            polygon: curved,
        },
    )
    .unwrap()
    .template;
    assert!(
        authoring::apply(
            &curved,
            Command::RemovePoint {
                panel: curved.panels[0].id.clone(),
                point: 1,
            },
        )
        .is_err()
    );
}

#[test]
fn one_action_is_one_undo_entry_for_every_command() {
    let start = rectangle(0.4, 0.6);
    let id = start.panels[0].id.clone();
    let cases = vec![
        Command::Anchor {
            panel: id.clone(),
            anchor: 0,
            position: DVec2::new(0.01, 0.01),
        },
        Command::MovePoints {
            panel: id.clone(),
            points: vec![0, 2],
            delta: DVec2::new(0.001, 0.),
        },
        Command::Nudge {
            panel: id.clone(),
            points: vec![1],
            delta_mm: DVec2::new(1., 10.),
        },
        Command::CurvePoint {
            panel: id.clone(),
            anchor: 0,
            curved: true,
        },
        Command::TargetLength {
            panel: id.clone(),
            edge: "edge_1".into(),
            target_m: 0.35,
        },
    ];
    for command in cases {
        let redone = apply_one_undo(&start, command);
        assert!(redone.compile().is_ok());
    }
    // Split and remove are checked on the contour they produce.
    let split = apply_one_undo(
        &start,
        Command::SplitBoundary {
            panel: id.clone(),
            edge: "edge_2".into(),
            at_m: 0.2,
        },
    );
    let index = contour(&split)
        .edges
        .iter()
        .position(|name| name == "edge_2_2")
        .unwrap();
    let removed = apply_one_undo(
        &split,
        Command::RemovePoint {
            panel: id,
            point: index,
        },
    );
    assert!(removed.compile().is_ok());
}
