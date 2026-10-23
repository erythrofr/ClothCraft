use marvelous_cloth::garment::{
    GarmentTemplate,
    seam::{BoundaryRef, Side, audit::report},
};

fn close(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-11, "{a} != {b}");
}

#[test]
fn valid_report_matches_compiler_without_mutating_input() {
    let t = GarmentTemplate::two_panel_demo();
    let before = serde_json::to_string(&t).unwrap();
    let a = report(&t).unwrap();
    assert!(a.valid);
    assert_eq!(
        a.seams[0].lengths_m.unwrap(),
        t.compile().unwrap().seams[0].lengths
    );
    close(a.seams[0].lengths_m.unwrap()[0], 0.6);
    assert_eq!(a.seams[0].intervals.len(), 2);
    assert!(a.seams[0].intervals.iter().all(|i| !i.requires_easing));
    assert_eq!(serde_json::to_string(&t).unwrap(), before);
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&report(&t).unwrap()).unwrap()
    );
    let mut moved = t.clone();
    moved.panels[1].placement.translation *= 5.;
    moved.panels[1].grain_degrees += 45.;
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&report(&moved).unwrap()).unwrap()
    );
}

#[test]
fn equal_total_lengths_can_require_local_easing() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams[0].notches = vec![[0.25, 0.75]];
    let a = report(&t).unwrap();
    assert!(!a.valid);
    close(a.seams[0].difference_m.unwrap(), 0.);
    assert!(a.seams[0].intervals.iter().all(|i| i.requires_easing));
    close(a.seams[0].intervals[0].difference_m, 0.3);
    close(a.seams[0].intervals[1].difference_m, -0.3);
    assert!(t.compile().is_err());
    t.seams[0].allow_ease = true;
    assert!(report(&t).unwrap().valid);
    assert!(t.compile().is_ok());
}

#[test]
fn partial_chained_and_reversed_lengths_use_compiler_correspondence() {
    let mut t = GarmentTemplate::two_panel_demo();
    let s = &mut t.seams[0];
    s.a.range = [0., 0.25];
    s.a.reversed = true;
    let mut tail = s.a.clone();
    tail.range = [0.5, 0.75];
    s.a_tail.push(tail);
    s.b.range = [0.25, 0.75];
    s.b.reversed = true;
    s.reverse_b = true;
    s.notches = vec![[0.3, 0.4]];
    s.allow_ease = true;
    let a = report(&t).unwrap();
    assert!(a.valid);
    let compiled = t.compile().unwrap();
    assert_eq!(a.seams[0].lengths_m.unwrap(), compiled.seams[0].lengths);
    close(a.seams[0].a[0].length_m.unwrap(), 0.15);
    close(a.seams[0].a[1].length_m.unwrap(), 0.15);
    close(a.seams[0].intervals[0].lengths_m[0], 0.09);
    close(a.seams[0].intervals[0].lengths_m[1], 0.12);
}

#[test]
fn broken_seam_does_not_hide_other_seams_or_valid_side_lengths() {
    let mut t = GarmentTemplate::two_panel_demo();
    let mut broken = t.seams[0].clone();
    broken.id = "broken".into();
    broken.a.panel = "missing".into();
    broken.b.range = [0., 0.1];
    t.seams[0].a.range = [0.2, 1.];
    t.seams[0].b.range = [0.2, 1.];
    t.seams.push(broken);
    let a = report(&t).unwrap();
    assert!(!a.valid);
    assert!(a.seams[0].errors.is_empty());
    assert!(a.seams[1].lengths_m.is_none());
    assert_eq!(a.seams[1].a[0].errors[0].code, "invalid_reference");
    close(a.seams[1].b[0].length_m.unwrap(), 0.06);
}

#[test]
fn invalid_ranges_notches_and_stiffness_are_reported() {
    for range in [[0.5, 0.5], [-0.1, 1.], [0., 1.1], [f64::NAN, 1.]] {
        let mut t = GarmentTemplate::two_panel_demo();
        t.seams[0].a.range = range;
        let a = report(&t).unwrap();
        assert!(!a.valid);
        assert!(!a.seams[0].a[0].errors.is_empty());
        assert!(serde_json::to_string(&a).is_ok());
    }
    for notches in [
        vec![[0., 0.1]],
        vec![[0.7, 0.7], [0.5, 0.5]],
        vec![[f64::NAN, 0.5]],
    ] {
        let mut t = GarmentTemplate::two_panel_demo();
        t.seams[0].notches = notches;
        let a = report(&t).unwrap();
        assert!(!a.valid);
        assert!(a.seams[0].intervals.is_empty());
    }
    for stiffness in [0., -1., f64::INFINITY, f64::NAN] {
        let mut t = GarmentTemplate::two_panel_demo();
        t.seams[0].stiffness = stiffness;
        assert!(!report(&t).unwrap().valid);
    }
}

#[test]
fn duplicate_ids_and_self_ownership_are_errors() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams.push(t.seams[0].clone());
    let a = report(&t).unwrap();
    assert!(!a.valid);
    for s in a.seams {
        assert!(s.errors.iter().any(|e| e.code == "duplicate_id"));
        assert!(s.errors.iter().any(|e| e.code == "overlapping_ownership"));
    }
    t.seams.truncate(1);
    t.seams[0].b = t.seams[0].a.clone();
    assert!(!report(&t).unwrap().valid);
    t.seams[0].id = "invalid id".into();
    assert!(
        report(&t).unwrap().seams[0]
            .errors
            .iter()
            .any(|e| e.code == "invalid_id")
    );
}

#[test]
fn touching_ranges_are_junctions_but_not_overlapping_ownership() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams[0].a.range = [0., 0.5];
    t.seams[0].b.range = [0., 0.5];
    let mut second = t.seams[0].clone();
    second.id = "second".into();
    second.a.range = [0.5, 1.];
    second.b.range = [0.5, 1.];
    second.a.reversed = true;
    t.seams.push(second);
    let a = report(&t).unwrap();
    assert!(a.valid);
    assert_eq!(a.junctions.len(), 2);
    assert!(a.junctions.iter().all(|j| j.degree == 2));
    assert!(
        a.junctions
            .iter()
            .flat_map(|j| &j.endpoints)
            .all(|e| e.boundary_parameter == 0.5)
    );
    t.seams[1].a.range[0] = 0.49;
    t.seams[1].allow_ease = true;
    assert!(!report(&t).unwrap().valid);
}

#[test]
fn different_edges_meet_at_material_corners_not_world_positions() {
    let mut t = GarmentTemplate::two_panel_demo();
    let mut second = t.seams[0].clone();
    second.id = "top".into();
    second.a.side = Side::Top;
    second.b.side = Side::Top;
    t.seams.push(second);
    let a = report(&t).unwrap();
    assert!(a.valid);
    assert_eq!(a.junctions.len(), 2);
    assert!(a.junctions.iter().all(|j| j.degree == 2));
}

#[test]
fn unsupported_geometry_and_excessive_counts_fail_explicitly() {
    let mut t = GarmentTemplate::two_panel_demo();
    t.panels[0].pattern.width = -1.;
    assert!(report(&t).is_err());
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams = vec![t.seams[0].clone(); 513];
    assert!(report(&t).is_err());
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams[0].a_tail = vec![t.seams[0].a.clone(); 128];
    assert!(!report(&t).unwrap().valid);
    let mut t = GarmentTemplate::two_panel_demo();
    t.seams.clear();
    assert!(report(&t).unwrap().valid);
}

#[test]
fn polygon_named_edges_and_missing_edges_are_resolved_like_compiler() {
    use glam::DVec2;
    use marvelous_cloth::garment::{
        meshing::MeshingSettings,
        shapes::{self, Primitive},
    };
    let mut t = GarmentTemplate::two_panel_demo();
    t.version = 2;
    for p in &mut t.panels {
        p.pins.clear();
        p.polygon = Some(
            shapes::primitive(
                Primitive::Rectangle,
                DVec2::new(0.4, 0.6),
                90.,
                MeshingSettings {
                    target_edge_m: 0.1,
                    ..Default::default()
                },
            )
            .unwrap(),
        );
    }
    t.seams[0].a.edge = Some(t.panels[0].polygon.as_ref().unwrap().edges[0].clone());
    t.seams[0].b.edge = Some(t.panels[1].polygon.as_ref().unwrap().edges[0].clone());
    let a = report(&t).unwrap();
    assert!(a.valid);
    assert_eq!(
        a.seams[0].lengths_m.unwrap(),
        t.compile().unwrap().seams[0].lengths
    );
    t.seams[0].b.edge = Some("absent".into());
    assert!(!report(&t).unwrap().valid);
    t.seams[0].b.edge = None;
    assert!(!report(&t).unwrap().valid);
}

#[test]
fn cli_emits_json_for_bad_sewing_and_exits_nonzero() {
    let t = GarmentTemplate::two_panel_demo();
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("template with spaces.json");
    let invoke = || {
        std::process::Command::new(env!("CARGO_BIN_EXE_cloth-template"))
            .args(["audit-sewing", file.to_str().unwrap()])
            .output()
            .unwrap()
    };
    std::fs::write(&file, serde_json::to_vec(&t).unwrap()).unwrap();
    let output = invoke();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let mut t = t;
    t.seams[0].a = BoundaryRef {
        panel: "absent".into(),
        ..t.seams[0].a.clone()
    };
    std::fs::write(&file, serde_json::to_vec(&t).unwrap()).unwrap();
    let output = invoke();
    assert!(!output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["valid"], false);
    assert_eq!(value["seams"][0]["a"][0]["panel_id"], "absent");
}

#[test]
fn dense_conflicts_report_every_affected_seam_without_pair_explosion() {
    let mut t = GarmentTemplate::two_panel_demo();
    let original = t.seams[0].clone();
    t.seams = (0..96)
        .map(|i| {
            let mut s = original.clone();
            s.id = format!("seam-{i}");
            s
        })
        .collect();
    let a = report(&t).unwrap();
    assert!(!a.valid);
    assert_eq!(a.seams.len(), 96);
    for s in &a.seams {
        assert_eq!(
            s.errors
                .iter()
                .filter(|e| e.code == "overlapping_ownership")
                .count(),
            2
        );
    }
    assert!(a.junctions.iter().all(|j| j.degree == 96));
}

#[test]
fn audit_validity_agrees_with_compiler_across_sewing_policies() {
    for range in [[0., 1.], [0.1, 0.6], [0.9, 0.2]] {
        for reverse in [false, true] {
            for ease in [false, true] {
                for knots in [vec![], vec![[0.2, 0.7]], vec![[0.8, 0.2], [0.4, 0.5]]] {
                    let mut t = GarmentTemplate::two_panel_demo();
                    t.seams[0].a.range = range;
                    t.seams[0].a.reversed = reverse;
                    t.seams[0].reverse_b = !reverse;
                    t.seams[0].allow_ease = ease;
                    t.seams[0].notches = knots;
                    assert_eq!(report(&t).unwrap().valid, t.compile().is_ok());
                }
            }
        }
    }
}

#[test]
fn curved_boundary_audit_matches_compiler_and_finds_local_mismatch() {
    use glam::DVec2;
    use marvelous_cloth::garment::{
        meshing::MeshingSettings,
        shapes::{self, Primitive},
    };
    let mut t = GarmentTemplate::two_panel_demo();
    t.version = 2;
    for p in &mut t.panels {
        p.pins.clear();
        p.polygon = Some(
            shapes::primitive(
                Primitive::Ellipse,
                DVec2::new(0.4, 0.6),
                90.,
                MeshingSettings {
                    target_edge_m: 0.08,
                    ..Default::default()
                },
            )
            .unwrap(),
        );
    }
    t.seams[0].a.edge = Some(t.panels[0].polygon.as_ref().unwrap().edges[0].clone());
    t.seams[0].b.edge = Some(t.panels[1].polygon.as_ref().unwrap().edges[0].clone());
    t.seams[0].a.range = [0.2, 0.8];
    t.seams[0].b.range = [0.2, 0.8];
    t.seams[0].b.reversed = true;
    let a = report(&t).unwrap();
    assert!(a.valid);
    assert_eq!(
        a.seams[0].lengths_m.unwrap(),
        t.compile().unwrap().seams[0].lengths
    );
    t.seams[0].notches = vec![[0.2, 0.8]];
    let a = report(&t).unwrap();
    assert!(!a.valid);
    assert!(a.seams[0].intervals.iter().all(|i| i.requires_easing));
}

#[test]
fn cli_project_mode_reads_rest_template_without_loading_avatar() {
    use marvelous_cloth::{fitting::FittingProject, garment::presets::GarmentKind};
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("Garment.clothcraft");
    let mut p = FittingProject::basic(
        GarmentKind::Tshirt,
        0,
        dir.path().join("missing-avatar.obj"),
    );
    p.template = GarmentTemplate::two_panel_demo();
    let invoke = || {
        std::process::Command::new(env!("CARGO_BIN_EXE_cloth-template"))
            .args(["audit-sewing", "--project", file.to_str().unwrap()])
            .output()
            .unwrap()
    };
    std::fs::write(&file, serde_json::to_vec(&p).unwrap()).unwrap();
    let output = invoke();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["valid"], true);
    assert_eq!(value["seams"][0]["seam_id"], "centre-seam");
    p.version = 999;
    std::fs::write(&file, serde_json::to_vec(&p).unwrap()).unwrap();
    let output = invoke();
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
}
