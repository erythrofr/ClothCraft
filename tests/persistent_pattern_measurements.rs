//! Saved measurements are descriptive rest-space metadata with semantic anchors.
use glam::{DVec2, DVec3};
use marvelous_cloth::{
    authoring::{self, Command, History},
    fitting::FittingProject,
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        polygon::{MeasurementAnchor, PatternMeasurement},
        presets::{self, GarmentKind},
        shapes::{BooleanOp, MirrorAxis, Primitive},
    },
};
fn fixture() -> GarmentTemplate {
    authoring::apply(
        &presets::basic(GarmentKind::Tshirt, 0),
        Command::Primitive {
            kind: Primitive::Rectangle,
            size: DVec2::new(0.4, 0.3),
            origin: DVec2::ZERO,
            sweep_degrees: 180.,
            meshing: MeshingSettings {
                target_edge_m: 0.08,
                ..Default::default()
            },
            fabric: "woven-reference".into(),
            replace: true,
        },
    )
    .unwrap()
    .template
}
fn record() -> PatternMeasurement {
    PatternMeasurement {
        id: "width".into(),
        label: "Width".into(),
        a: MeasurementAnchor {
            edge: "edge_1".into(),
            t: 0.25,
        },
        b: MeasurementAnchor {
            edge: "edge_3".into(),
            t: 0.75,
        },
    }
}
fn set(t: &GarmentTemplate, measurement: PatternMeasurement) -> authoring::Edit {
    authoring::apply(
        t,
        Command::SetMeasurement {
            panel: t.panels[0].id.clone(),
            measurement,
        },
    )
    .unwrap()
}
fn positions(t: &GarmentTemplate) -> [DVec2; 2] {
    let panel = &t.panels[0];
    let p = panel.polygon.as_ref().unwrap();
    p.measurement_points(&p.measurements[0])
        .unwrap()
        .map(|uv| authoring::layout(t, 0) + authoring::rotate_2d(uv, panel.layout_rotation_degrees))
}
#[test]
fn saved_crud_history_and_legacy_json_preserve_physics() {
    let original = fixture();
    let legacy = serde_json::to_value(&original).unwrap();
    assert!(legacy["panels"][0]["polygon"].get("measurements").is_none());
    let mut history = History::default();
    history.record(original.clone());
    let added = set(&original, record());
    assert!(!added.reset_simulation);
    assert!(authoring::same_physics(&original, &added.template));
    assert!(authoring::only_appearance_changed(
        &original,
        &added.template
    ));
    assert!(
        authoring::apply(
            &added.template,
            Command::SetMeasurement {
                panel: added.template.panels[0].id.clone(),
                measurement: record(),
            }
        )
        .err()
        .unwrap()
        .contains("unchanged")
    );
    let before = original.compile().unwrap();
    assert_eq!(before.mesh.uv, added.garment.mesh.uv);
    assert_eq!(before.mesh.masses, added.garment.mesh.masses);
    let loaded: GarmentTemplate =
        serde_json::from_str(&serde_json::to_string(&added.template).unwrap()).unwrap();
    assert_eq!(
        loaded.panels[0].polygon.as_ref().unwrap().measurements[0],
        record()
    );
    let undo = history.restore(&loaded, false).unwrap();
    assert_eq!(serde_json::to_value(&undo.template).unwrap(), legacy);
    let redo = history.restore(&undo.template, true).unwrap();
    let mut renamed = record();
    renamed.label = "Finished width".into();
    renamed.a.t = 0.5;
    let changed = set(&redo.template, renamed.clone());
    assert_eq!(
        changed.template.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .measurements,
        vec![renamed]
    );
    let removed = authoring::apply(
        &changed.template,
        Command::RemoveMeasurement {
            panel: changed.template.panels[0].id.clone(),
            id: "width".into(),
        },
    )
    .unwrap();
    assert!(!removed.reset_simulation);
    assert_eq!(serde_json::to_value(&removed.template).unwrap(), legacy);
}
#[test]
fn save_reopen_retains_measurements_and_preexisting_drape_signature() {
    let dir = tempfile::tempdir().unwrap();
    let avatar = dir.path().join("avatar.obj");
    std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
    let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
    project.template = fixture();
    let mut state = project.compile().unwrap().state;
    for x in &mut state.x {
        *x += DVec3::new(0.02, 0.03, 0.04);
    }
    state.v.fill(DVec3::new(0.1, 0.2, 0.3));
    state.time = 2.;
    project.state = Some(state.clone());
    let path = dir.path().join("measured.json");
    project.save(&path).unwrap();
    let mut project = FittingProject::load(&path).unwrap();
    let old_signature = project.mesh_signature.clone();
    project.template = set(&project.template, record()).template;
    // The old saved signature must still accept the changed metadata.
    let scene = project.compile().unwrap();
    assert_eq!(scene.state.x, state.x);
    assert_eq!(scene.state.v, state.v);
    assert_eq!(scene.state.time, 2.);
    project.save(&path).unwrap();
    let reopened = FittingProject::load(&path).unwrap();
    assert_eq!(reopened.mesh_signature, old_signature);
    assert_eq!(
        reopened.template.panels[0]
            .polygon
            .as_ref()
            .unwrap()
            .measurements[0],
        record()
    );
    assert_eq!(reopened.compile().unwrap().state.x, state.x);
}
#[test]
fn straight_curved_and_exact_station_splits_preserve_attachment() {
    for curved in [false, true] {
        let mut t = fixture();
        if curved {
            t.panels[0].polygon.as_mut().unwrap().curves.insert(
                "edge_1".into(),
                [DVec2::new(0.05, -0.08), DVec2::new(0.3, -0.03)],
            );
        }
        let mut m = record();
        m.b = MeasurementAnchor {
            edge: "edge_1".into(),
            t: 0.8,
        };
        let t = set(&t, m).template;
        let before = positions(&t);
        let p = t.panels[0].polygon.as_ref().unwrap();
        let length = authoring::edge_length(p, "edge_1").unwrap();
        let split = authoring::apply(
            &t,
            Command::SplitBoundary {
                panel: t.panels[0].id.clone(),
                edge: "edge_1".into(),
                at_m: length * 0.5,
            },
        )
        .unwrap()
        .template;
        for (old, new) in before.into_iter().zip(positions(&split)) {
            assert!(old.distance(new) <= 0.0005, "drift {} m", old.distance(new));
        }
        let m = &split.panels[0].polygon.as_ref().unwrap().measurements[0];
        assert_ne!(m.a.edge, m.b.edge);
    }
    let t = fixture();
    let mut m = record();
    m.a.t = 0.5;
    let t = set(&t, m).template;
    let before = positions(&t);
    let split = authoring::apply(
        &t,
        Command::SplitBoundary {
            panel: t.panels[0].id.clone(),
            edge: "edge_1".into(),
            at_m: 0.2,
        },
    )
    .unwrap()
    .template;
    assert_eq!(
        split.panels[0].polygon.as_ref().unwrap().measurements[0]
            .a
            .t,
        0.
    );
    assert!(before[0].distance(positions(&split)[0]) < 1e-12);
}
#[test]
fn mirror_copy_and_linked_metadata_preserve_local_identities() {
    let t = set(&fixture(), record()).template;
    let before = positions(&t);
    let mirrored = authoring::apply(
        &t,
        Command::Mirror {
            panel: t.panels[0].id.clone(),
            axis: MirrorAxis::X,
            copy_side: None,
        },
    )
    .unwrap()
    .template;
    for (old, new) in before.into_iter().zip(positions(&mirrored)) {
        assert!(DVec2::new(0.4 - old.x, old.y).distance(new) < 1e-12);
    }
    let linked = authoring::apply(
        &t,
        Command::LinkedMirror {
            panel: t.panels[0].id.clone(),
            axis: MirrorAxis::X,
        },
    )
    .unwrap()
    .template;
    let partner = linked.panels[1]
        .polygon
        .as_ref()
        .unwrap()
        .measurements
        .clone();
    let mut changed = record();
    changed.label = "Independent label".into();
    let changed = set(&linked, changed).template;
    assert_eq!(
        changed.panels[1].polygon.as_ref().unwrap().measurements,
        partner
    );
    let moved = authoring::apply(
        &changed,
        Command::Dimensions {
            panel: changed.panels[0].id.clone(),
            width: 0.5,
            height: 0.3,
        },
    )
    .unwrap()
    .template;
    assert_eq!(
        moved.panels[1].polygon.as_ref().unwrap().measurements,
        partner
    );
    let copy = authoring::apply(
        &t,
        Command::Duplicate {
            panel: t.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template;
    assert_eq!(
        copy.panels[1].polygon.as_ref().unwrap().measurements[0],
        record()
    );
}
#[test]
fn dangling_invalid_and_destructive_edits_fail_atomically() {
    let t = set(&fixture(), record()).template;
    let before = serde_json::to_value(&t).unwrap();
    let mut invalid = record();
    invalid.a.edge = "missing".into();
    assert!(
        authoring::apply(
            &t,
            Command::SetMeasurement {
                panel: t.panels[0].id.clone(),
                measurement: invalid
            }
        )
        .is_err()
    );
    let mut shape = t.panels[0].polygon.clone().unwrap();
    shape.measurements.clear();
    assert!(
        authoring::apply(
            &t,
            Command::Shape {
                panel: t.panels[0].id.clone(),
                polygon: shape
            }
        )
        .is_err()
    );
    assert!(
        authoring::apply(
            &t,
            Command::RemovePoint {
                panel: t.panels[0].id.clone(),
                point: 0
            }
        )
        .is_err()
    );
    let mut loaded = t.clone();
    loaded.panels[0].polygon.as_mut().unwrap().measurements[0]
        .b
        .t = f64::NAN;
    assert!(loaded.compile().is_err());
    let two = authoring::apply(
        &t,
        Command::Duplicate {
            panel: t.panels[0].id.clone(),
        },
    )
    .unwrap()
    .template;
    assert!(
        authoring::apply(
            &two,
            Command::Boolean {
                a: two.panels[0].id.clone(),
                b: two.panels[1].id.clone(),
                op: BooleanOp::Union,
                keep_tool: false
            }
        )
        .is_err()
    );
    assert_eq!(serde_json::to_value(&t).unwrap(), before);
}

#[test]
fn internal_and_hole_stations_mirror_correctly_and_referenced_lines_cannot_disappear() {
    use marvelous_cloth::garment::domain::{Hole, InternalLine};
    let mut t = fixture();
    let p = t.panels[0].polygon.as_mut().unwrap();
    p.holes.push(Hole {
        points: vec![
            DVec2::new(0.15, 0.1),
            DVec2::new(0.15, 0.2),
            DVec2::new(0.25, 0.2),
            DVec2::new(0.25, 0.1),
        ],
        edges: vec![
            "hole_a".into(),
            "hole_b".into(),
            "hole_c".into(),
            "hole_d".into(),
        ],
    });
    p.lines.push(InternalLine {
        id: "guide".into(),
        points: vec![DVec2::new(0.03, 0.05), DVec2::new(0.12, 0.05)],
        tangents: vec![DVec2::ZERO; 2],
    });
    let m = PatternMeasurement {
        id: "stations".into(),
        label: "Stations".into(),
        a: MeasurementAnchor {
            edge: "guide".into(),
            t: 0.2,
        },
        b: MeasurementAnchor {
            edge: "hole_a".into(),
            t: 0.3,
        },
    };
    let t = set(&t, m).template;
    let before = positions(&t);
    let mirror = authoring::apply(
        &t,
        Command::Mirror {
            panel: t.panels[0].id.clone(),
            axis: MirrorAxis::X,
            copy_side: None,
        },
    )
    .unwrap()
    .template;
    for (old, new) in before.into_iter().zip(positions(&mirror)) {
        assert!(DVec2::new(0.4 - old.x, old.y).distance(new) < 1e-12);
    }
    let m = &mirror.panels[0].polygon.as_ref().unwrap().measurements[0];
    assert_eq!(m.a.t, 0.2);
    assert!((m.b.t - 0.7).abs() < 1e-12);
    assert!(
        authoring::apply(
            &t,
            Command::RemoveLine {
                panel: t.panels[0].id.clone(),
                line: "guide".into()
            }
        )
        .err()
        .unwrap()
        .contains("measurement")
    );
}

#[test]
fn measurement_metadata_coexists_with_trims_without_weakening_geometry_guard() {
    use marvelous_cloth::garment::trims::{Trim, TrimKind};
    let t = fixture();
    let t = authoring::apply(
        &t,
        Command::SetTrim {
            trim: Trim {
                id: "button".into(),
                panel_id: t.panels[0].id.clone(),
                kind: TrimKind::Button {
                    center_m: DVec2::new(0.1, 0.1),
                    diameter_m: 0.01,
                },
            },
        },
    )
    .unwrap()
    .template;
    let edit = set(&t, record());
    assert!(!edit.reset_simulation);
    assert_eq!(edit.template.trims, t.trims);
    assert!(
        authoring::apply(
            &edit.template,
            Command::Dimensions {
                panel: t.panels[0].id.clone(),
                width: 0.5,
                height: 0.3
            }
        )
        .is_err()
    );
}
