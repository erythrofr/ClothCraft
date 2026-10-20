use glam::{DVec2, DVec3};
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, Side},
    },
};

fn rectangle(width: f64) -> Command {
    // Deliberately clockwise, translated input: drawing direction is arbitrary.
    Command::Polygon {
        tangents: vec![],
        points: vec![
            DVec2::new(2., 3.),
            DVec2::new(2., 3.3),
            DVec2::new(2. + width, 3.3),
            DVec2::new(2. + width, 3.),
        ],
        meshing: MeshingSettings {
            target_edge_m: 0.05,
            ..Default::default()
        },
        fabric: "woven-reference".into(),
        replace: true,
    }
}
fn fixture() -> GarmentTemplate {
    authoring::apply(&presets::basic(GarmentKind::Tshirt, 0), rectangle(0.4))
        .unwrap()
        .template
}
fn edge(panel: &str, edge: &str) -> BoundaryRef {
    BoundaryRef {
        reversed: false,
        panel: panel.into(),
        side: Side::Top,
        edge: Some(edge.into()),
        range: [0., 1.],
    }
}

#[test]
fn drawing_roundtrip_preserves_material_shape_and_names() {
    let t = fixture();
    let g = t.compile().unwrap();
    let area: f64 = g.mesh.triangles.iter().map(|t| t.area).sum();
    assert!((area - 0.12).abs() < 1e-10);
    assert_eq!(t.panels[0].polygon.as_ref().unwrap().edges.len(), 4);
    let read: GarmentTemplate = serde_json::from_str(&serde_json::to_string(&t).unwrap()).unwrap();
    assert_eq!(read.compile().unwrap().mesh.uv, g.mesh.uv);
}

#[test]
fn invalid_edit_is_atomic_and_does_not_enter_history() {
    let t = fixture();
    let before = serde_json::to_vec(&t).unwrap();
    let Command::Polygon {
        meshing, fabric, ..
    } = rectangle(0.4)
    else {
        unreachable!()
    };
    let invalid = Command::Polygon {
        tangents: vec![],
        points: vec![DVec2::ZERO, DVec2::ONE, DVec2::Y, DVec2::X],
        meshing,
        fabric,
        replace: true,
    };
    assert!(authoring::apply(&t, invalid).is_err());
    assert_eq!(before, serde_json::to_vec(&t).unwrap());
    assert!(
        authoring::apply(
            &t,
            Command::RemovePanel {
                panel: t.panels[0].id.clone()
            }
        )
        .is_err()
    );
}

#[test]
fn rigid_gizmo_preserves_pivot_rest_mass_and_triangle_lengths() {
    let t = fixture();
    let old = t.compile().unwrap();
    let p = &t.panels[0];
    let pivot = DVec3::new(0.2, -0.15, 0.);
    let placement = authoring::rotate_about(&p.placement, pivot, DVec3::Y, 1.1);
    assert!(
        placement
            .transform(pivot)
            .distance(p.placement.transform(pivot))
            < 1e-12
    );
    let edit = authoring::apply(
        &t,
        Command::Place {
            panel: p.id.clone(),
            placement,
        },
    )
    .unwrap();
    assert_eq!(old.mesh.uv, edit.garment.mesh.uv);
    assert_eq!(old.mesh.masses, edit.garment.mesh.masses);
    for tri in &old.mesh.triangles {
        let [a, b, c] = tri.vertices;
        for (a, b) in [(a, b), (b, c), (c, a)] {
            let length = old.initial_state.x[a].distance(old.initial_state.x[b]);
            assert!(
                (length
                    - edit.garment.initial_state.x[a].distance(edit.garment.initial_state.x[b]))
                .abs()
                    < 1e-12
            );
        }
    }
}

#[test]
fn seams_survive_remaillage_and_panel_deletion_removes_references() {
    let t = fixture();
    let mut t = authoring::apply(
        &t,
        Command::Duplicate {
            panel: t.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template;
    t.panels[1]
        .polygon
        .as_mut()
        .unwrap()
        .meshing
        .as_mut()
        .unwrap()
        .target_edge_m = 0.03;
    let a = t.panels[0].id.clone();
    let b = t.panels[1].id.clone();
    let edit = authoring::apply(
        &t,
        Command::Sew {
            a: edge(&a, "edge_1"),
            b: edge(&b, "edge_1"),
            reverse: true,
            ease: false,
        },
    )
    .unwrap();
    assert!(!edit.garment.seams.is_empty());
    assert!(
        authoring::apply(
            &edit.template,
            Command::Sew {
                a: edge(&a, "edge_1"),
                b: edge(&b, "edge_2"),
                reverse: true,
                ease: true
            }
        )
        .is_err()
    );
    let after = authoring::apply(&edit.template, Command::RemovePanel { panel: a }).unwrap();
    assert!(after.template.seams.is_empty());
    assert_eq!(after.template.panels.len(), 1);
}

#[test]
fn unequal_seam_lengths_require_explicit_ease() {
    let t = fixture();
    let t = authoring::apply(
        &t,
        Command::Duplicate {
            panel: t.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template;
    let seam = |ease| Command::Sew {
        a: edge(&t.panels[0].id, "edge_1"),
        b: edge(&t.panels[1].id, "edge_2"),
        reverse: false,
        ease,
    };
    assert!(authoring::apply(&t, seam(false)).is_err());
    assert!(authoring::apply(&t, seam(true)).is_ok());
}

#[test]
fn free_sewing_creates_partial_ranges_and_rejects_overlaps_atomically() {
    let fixture = fixture();
    let base = authoring::apply(
        &fixture,
        Command::Duplicate { panel: fixture.panels[0].id.clone() },
    )
    .unwrap().template;
    let a = base.panels[0].id.clone();
    let b = base.panels[1].id.clone();
    let trimmed = |panel: &str, interval: [f64;2]| {
        let mut ref_edge = edge(panel, "edge_1");
        ref_edge.range = interval;
        ref_edge
    };
    let command = |first, second| Command::Sew {
        a:trimmed(&a, first),
        b:trimmed(&b, second),
        reverse:false,
        ease:false,
    };
    let first = authoring::apply(&base, command([0.15,0.45],[0.15,0.45])).unwrap();
    assert_eq!(first.template.seams.len(), base.seams.len()+1);
    assert_eq!(first.template.seams.last().unwrap().a.range, [0.15,0.45]);
    let second = authoring::apply(&first.template, command([0.60,0.90],[0.60,0.90])).unwrap();
    assert_eq!(second.template.seams.len(), base.seams.len()+2);
    let old=serde_json::to_vec(&second.template).unwrap();
    assert!(authoring::apply(&second.template, command([0.30,0.70],[0.30,0.70])).is_err());
    assert_eq!(old,serde_json::to_vec(&second.template).unwrap());
    assert!(authoring::apply(&second.template, command([0.95,0.95],[0.95,1.0])).is_err());
}

#[test]
fn undo_redo_restores_compilable_document_and_branch_clears_redo() {
    let mut history = History::default();
    let a = fixture();
    let b = authoring::apply(
        &a,
        Command::Duplicate {
            panel: a.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template;
    history.record(a.clone());
    let undo = history.restore(&b, false).unwrap();
    assert_eq!(
        serde_json::to_vec(&undo.template).unwrap(),
        serde_json::to_vec(&a).unwrap()
    );
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(
        serde_json::to_vec(&redo.template).unwrap(),
        serde_json::to_vec(&b).unwrap()
    );
    history.restore(&redo.template, false).unwrap();
    history.record(a);
    assert!(!history.can_redo());
}

/// A four-corner rectangle contour with an exact starting size in metres.
fn contour(width: f64, height: f64) -> GarmentTemplate {
    let base = fixture();
    let panel = base.panels[0].id.clone();
    let mut polygon = base.panels[0].polygon.clone().unwrap();
    polygon.points = vec![
        DVec2::ZERO,
        DVec2::new(width, 0.),
        DVec2::new(width, height),
        DVec2::new(0., height),
    ];
    authoring::apply(&base, Command::Shape { panel, polygon })
        .unwrap()
        .template
}

/// A legacy v1 rectangular template without a contour.
fn rectangular_template() -> GarmentTemplate {
    let mut template = fixture();
    for panel in &mut template.panels {
        panel.polygon = None;
    }
    template.version = 1;
    template
}

fn distinct_sorted(values: impl Iterator<Item = f64>) -> Vec<f64> {
    let mut values: Vec<f64> = values.collect();
    values.sort_by(f64::total_cmp);
    values.dedup();
    values
}

#[test]
fn numeric_dimensions_keep_the_exact_millimetre_size_through_save_load() {
    // The start rectangle is 310 x 470 mm: scaling it proportionally would give
    // 0.4000000000000001 m, so every exact comparison below rejects approximation.
    let start = contour(0.31, 0.47);
    assert_eq!(start.panels[0].pattern.width, 0.31);
    assert_eq!(start.panels[0].pattern.height, 0.47);
    let edit = authoring::apply(
        &start,
        Command::Dimensions {
            panel: start.panels[0].id.clone(),
            width: 400. / 1000.,
            height: 600. / 1000.,
        },
    )
    .unwrap();
    let panel = &edit.template.panels[0];
    assert_eq!(panel.pattern.width, 0.4);
    assert_eq!(panel.pattern.height, 0.6);
    let polygon = panel.polygon.as_ref().unwrap();
    assert_eq!(
        distinct_sorted(polygon.points.iter().map(|p| p.x)),
        vec![0., 0.4]
    );
    assert_eq!(
        distinct_sorted(polygon.points.iter().map(|p| p.y)),
        vec![0., 0.6]
    );
    // Save/load is JSON with exact floating-point round trips.
    let json = serde_json::to_string(&edit.template).unwrap();
    assert!(json.contains("\"width\":0.4"), "{json}");
    assert!(json.contains("\"height\":0.6"), "{json}");
    let read: GarmentTemplate = serde_json::from_str(&json).unwrap();
    assert_eq!(
        serde_json::to_vec(&read).unwrap(),
        serde_json::to_vec(&edit.template).unwrap()
    );
    assert_eq!(read.panels[0].pattern.width, 0.4);
    assert_eq!(read.panels[0].pattern.height, 0.6);
    assert_eq!(read.compile().unwrap().mesh.uv, edit.garment.mesh.uv);
    // The product path is a file: save/load must not round the size either.
    let path =
        std::env::temp_dir().join(format!("clothcraft-dimensions-{}.json", std::process::id()));
    edit.template.save(&path).unwrap();
    let loaded = GarmentTemplate::load(&path).unwrap();
    std::fs::remove_file(&path).unwrap();
    assert_eq!(loaded.panels[0].pattern.width, 0.4);
    assert_eq!(loaded.panels[0].pattern.height, 0.6);
    assert_eq!(
        distinct_sorted(
            loaded.panels[0]
                .polygon
                .as_ref()
                .unwrap()
                .points
                .iter()
                .map(|p| p.x)
        ),
        vec![0., 0.4]
    );
    assert!(edit.reset_simulation);
}

#[test]
fn numeric_dimensions_resize_a_legacy_rectangle_exactly() {
    let start = rectangular_template();
    assert!(start.panels[0].polygon.is_none());
    let edit = authoring::apply(
        &start,
        Command::Dimensions {
            panel: start.panels[0].id.clone(),
            width: 400. / 1000.,
            height: 600. / 1000.,
        },
    )
    .unwrap();
    assert_eq!(edit.template.panels[0].pattern.width, 0.4);
    assert_eq!(edit.template.panels[0].pattern.height, 0.6);
    assert!(edit.reset_simulation);
    let json = serde_json::to_string(&edit.template).unwrap();
    assert!(json.contains("\"width\":0.4"), "{json}");
    assert!(json.contains("\"height\":0.6"), "{json}");
    let read: GarmentTemplate = serde_json::from_str(&json).unwrap();
    assert_eq!(read.panels[0].pattern.width, 0.4);
    assert_eq!(read.panels[0].pattern.height, 0.6);
}

#[test]
fn invalid_numeric_dimensions_leave_the_document_untouched() {
    let start = contour(0.31, 0.47);
    let id = start.panels[0].id.clone();
    let before = serde_json::to_vec(&start).unwrap();
    for (width, height) in [
        (0.0, 0.6),
        (-0.4, 0.6),
        (f64::NAN, 0.6),
        (f64::INFINITY, 0.6),
        (0.4, 0.0),
        (0.4, f64::NEG_INFINITY),
    ] {
        assert!(
            authoring::apply(
                &start,
                Command::Dimensions {
                    panel: id.clone(),
                    width,
                    height,
                },
            )
            .is_err(),
            "{width} x {height}"
        );
    }
    // A general quadrilateral is rejected instead of being resized approximately.
    let mut polygon = start.panels[0].polygon.clone().unwrap();
    polygon.points[2] = DVec2::new(0.25, 0.4);
    let skewed = authoring::apply(
        &start,
        Command::Shape {
            panel: id.clone(),
            polygon,
        },
    )
    .unwrap()
    .template;
    assert!(
        authoring::apply(
            &skewed,
            Command::Dimensions {
                panel: id.clone(),
                width: 0.4,
                height: 0.6,
            },
        )
        .is_err()
    );
    // A curved outline cannot carry an exact rectangular size either.
    let mut polygon = start.panels[0].polygon.clone().unwrap();
    polygon.curves.insert(
        "edge_1".into(),
        [DVec2::new(0.1, 0.05), DVec2::new(0.2, 0.05)],
    );
    let curved = authoring::apply(
        &start,
        Command::Shape {
            panel: id.clone(),
            polygon,
        },
    )
    .unwrap()
    .template;
    assert!(
        authoring::apply(
            &curved,
            Command::Dimensions {
                panel: id,
                width: 0.4,
                height: 0.6,
            },
        )
        .is_err()
    );
    assert_eq!(before, serde_json::to_vec(&start).unwrap());
}

#[test]
fn one_numeric_dimension_edit_is_one_undo_entry() {
    let start = contour(0.31, 0.47);
    let before = serde_json::to_vec(&start).unwrap();
    let edit = authoring::apply(
        &start,
        Command::Dimensions {
            panel: start.panels[0].id.clone(),
            width: 400. / 1000.,
            height: 600. / 1000.,
        },
    )
    .unwrap();
    let mut history = History::default();
    history.record(start.clone());
    assert!(history.can_undo());
    // One edit recorded: a single restore returns the exact previous document and
    // leaves nothing else to undo.
    let undo = history.restore(&edit.template, false).unwrap();
    assert_eq!(serde_json::to_vec(&undo.template).unwrap(), before);
    assert!(!history.can_undo());
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(redo.template.panels[0].pattern.width, 0.4);
    assert_eq!(redo.template.panels[0].pattern.height, 0.6);
}

#[test]
fn numeric_anchor_moves_are_exact_and_atomic() {
    let start = contour(0.31, 0.47);
    let id = start.panels[0].id.clone();
    let before = start.panels[0].clone();
    // Moving the lower-right corner to exactly 400 x 0 mm needs no re-basing.
    let edit = authoring::apply(
        &start,
        Command::Anchor {
            panel: id.clone(),
            anchor: 1,
            position: DVec2::new(400. / 1000., 0.),
        },
    )
    .unwrap();
    let panel = &edit.template.panels[0];
    assert_eq!(
        panel.polygon.as_ref().unwrap().points[1],
        DVec2::new(400. / 1000., 0.)
    );
    assert_eq!(panel.pattern.width, 0.4);
    assert_eq!(panel.pattern.height, 0.47);
    assert!(edit.reset_simulation);
    // Untouched points keep their board and world position.
    for k in [0, 2, 3] {
        let old = before.polygon.as_ref().unwrap().points[k];
        let new = panel.polygon.as_ref().unwrap().points[k];
        let board_old =
            before.layout_2d.unwrap() + authoring::rotate_2d(old, before.layout_rotation_degrees);
        let board_new =
            panel.layout_2d.unwrap() + authoring::rotate_2d(new, panel.layout_rotation_degrees);
        assert!(board_new.distance(board_old) < 1e-12);
        let world_old = before.placement.transform(DVec3::new(old.x, -old.y, 0.));
        let world_new = panel.placement.transform(DVec3::new(new.x, -new.y, 0.));
        assert!(world_new.distance(world_old) < 1e-12);
    }
    // A re-basing move still lands the requested point at the requested position.
    let target = DVec2::new(-0.05, 0.5);
    let edit = authoring::apply(
        &start,
        Command::Anchor {
            panel: id.clone(),
            anchor: 3,
            position: target,
        },
    )
    .unwrap();
    let panel = &edit.template.panels[0];
    let uv = panel.polygon.as_ref().unwrap().points[3];
    let actual = panel.placement.transform(DVec3::new(uv.x, -uv.y, 0.));
    let expected = before
        .placement
        .transform(DVec3::new(target.x, -target.y, 0.));
    assert!(actual.distance(expected) < 1e-12);
    // Invalid, out-of-range and contour-less targets are rejected atomically.
    let bytes = serde_json::to_vec(&start).unwrap();
    assert!(
        authoring::apply(
            &start,
            Command::Anchor {
                panel: id.clone(),
                anchor: 4,
                position: DVec2::ZERO,
            },
        )
        .is_err()
    );
    assert!(
        authoring::apply(
            &start,
            Command::Anchor {
                panel: id.clone(),
                anchor: 0,
                position: DVec2::new(f64::NAN, 0.),
            },
        )
        .is_err()
    );
    let legacy = rectangular_template();
    assert!(
        authoring::apply(
            &legacy,
            Command::Anchor {
                panel: legacy.panels[0].id.clone(),
                anchor: 0,
                position: DVec2::ZERO,
            },
        )
        .is_err()
    );
    assert_eq!(bytes, serde_json::to_vec(&start).unwrap());
}
