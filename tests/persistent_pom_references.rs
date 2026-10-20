//! Persistent Point-of-Measure references use named material boundaries.
//! These tests exercise native authoring transactions, storage and topology edits.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        meshing::MeshingSettings,
        polygon::{MeasurementAnchor, PatternMeasurement, PolygonPattern},
        presets::{self, GarmentKind},
        GarmentTemplate,
    },
};

fn fixture() -> GarmentTemplate {
    authoring::apply(
        &presets::basic(GarmentKind::Tshirt, 0),
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
    .template
}

fn measurement(a_edge: &str, a_t: f64, b_edge: &str, b_t: f64) -> PatternMeasurement {
    PatternMeasurement {
        id: "chest-width".into(),
        label: "Chest width".into(),
        a: MeasurementAnchor {
            edge: a_edge.into(),
            t: a_t,
        },
        b: MeasurementAnchor {
            edge: b_edge.into(),
            t: b_t,
        },
    }
}

fn set(template: &GarmentTemplate, measurement: PatternMeasurement) -> GarmentTemplate {
    authoring::apply(
        template,
        Command::SetMeasurement {
            panel: template.panels[0].id.clone(),
            measurement,
        },
    )
    .unwrap()
    .template
}

fn polygon(template: &GarmentTemplate) -> &PolygonPattern {
    template.panels[0].polygon.as_ref().unwrap()
}

fn assert_close(actual: f64, expected: f64, context: &str) {
    assert!(
        (actual - expected).abs() < 1e-6,
        "{context}: expected {expected:.9} m, found {actual:.9} m"
    );
}

#[test]
fn point_of_measure_is_numeric_and_persists_through_compile_and_save_reopen() {
    let start = fixture();
    // Opposing vertical boundaries: each halfway station is 400 mm apart.
    let m = measurement("edge_4", 0.5, "edge_2", 0.5);
    let edit = authoring::apply(
        &start,
        Command::SetMeasurement {
            panel: start.panels[0].id.clone(),
            measurement: m.clone(),
        },
    )
    .unwrap();
    assert!(!edit.reset_simulation, "a measuring guide must not reset the drape");
    assert_eq!(polygon(&edit.template).measurements, vec![m.clone()]);
    let ends = polygon(&edit.template).measurement_points(&m).unwrap();
    assert_close(ends[0].y, ends[1].y, "opposing edge stations");
    assert_close(
        polygon(&edit.template).measurement_length(&m).unwrap(),
        0.4,
        "width",
    );
    assert_eq!(edit.garment.mesh.uv, start.compile().unwrap().mesh.uv);

    let serialized = serde_json::to_string(&edit.template).unwrap();
    let reopened: GarmentTemplate = serde_json::from_str(&serialized).unwrap();
    assert_eq!(polygon(&reopened).measurements, vec![m.clone()]);
    reopened.compile().unwrap();
    assert_close(
        polygon(&reopened).measurement_length(&m).unwrap(),
        0.4,
        "reopened width",
    );

    let path = std::env::temp_dir().join(format!(
        "clothcraft-pom-references-{}-{:?}.json",
        std::process::id(),
        std::thread::current().id()
    ));
    edit.template.save(&path).unwrap();
    let disk = GarmentTemplate::load(&path).unwrap();
    std::fs::remove_file(&path).unwrap();
    assert_eq!(polygon(&disk).measurements, vec![m]);
    disk.compile().unwrap();
}

#[test]
fn invalid_measurement_references_and_stations_reject_atomically() {
    let initial = fixture();
    let snapshot = serde_json::to_vec(&initial).unwrap();
    for candidate in [
        measurement("deleted-edge", 0.5, "edge_2", 0.5),
        measurement("edge_4", 0.5, "deleted-edge", 0.5),
        measurement("edge_4", -0.01, "edge_2", 0.5),
        measurement("edge_4", 0.5, "edge_2", 1.01),
        measurement("edge_4", f64::NAN, "edge_2", 0.5),
        measurement("edge_4", 0.5, "edge_2", f64::INFINITY),
    ] {
        assert!(
            authoring::apply(
                &initial,
                Command::SetMeasurement {
                    panel: initial.panels[0].id.clone(),
                    measurement: candidate,
                },
            )
            .is_err(),
            "invalid anchor must be rejected"
        );
        assert_eq!(serde_json::to_vec(&initial).unwrap(), snapshot);
    }
    let valid = set(&initial, measurement("edge_4", 0.5, "edge_2", 0.5));
    assert!(authoring::apply(
        &valid,
        Command::SetMeasurement {
            panel: valid.panels[0].id.clone(),
            measurement: measurement("edge_1", 0.25, "edge_3", 0.25),
        }
    ).is_ok(), "editing an existing ID replaces its anchors");
    assert_eq!(polygon(&valid).measurements.len(), 1);
}

#[test]
fn set_remove_undo_redo_are_single_reversible_transactions() {
    let initial = fixture();
    let changed = set(&initial, measurement("edge_4", 0.5, "edge_2", 0.5));
    let mut history = History::default();
    history.record(initial.clone());
    let undone = history.restore(&changed, false).unwrap();
    assert_eq!(serde_json::to_vec(&undone.template).unwrap(), serde_json::to_vec(&initial).unwrap());
    let redone = history.restore(&undone.template, true).unwrap();
    assert_eq!(polygon(&redone.template).measurements.len(), 1);
    let removed = authoring::apply(
        &changed,
        Command::RemoveMeasurement {
            panel: changed.panels[0].id.clone(),
            id: "chest-width".into(),
        },
    )
    .unwrap();
    assert!(polygon(&removed.template).measurements.is_empty());
    assert!(!removed.reset_simulation);
    assert!(authoring::apply(
        &removed.template,
        Command::RemoveMeasurement {
            panel: changed.panels[0].id.clone(),
            id: "chest-width".into(),
        },
    ).is_err(), "unknown measurement IDs must fail closed");
}

#[test]
fn splitting_a_referenced_edge_preserves_measurement_id_and_physical_points() {
    let initial = set(&fixture(), measurement("edge_1", 0.75, "edge_3", 0.25));
    let m = &polygon(&initial).measurements[0];
    let old_ends = polygon(&initial).measurement_points(m).unwrap();
    let old_distance = polygon(&initial).measurement_length(m).unwrap();
    let old_layout = initial.panels[0].layout_2d.unwrap_or_default();
    let split = authoring::apply(
        &initial,
        Command::SplitBoundary {
            panel: initial.panels[0].id.clone(),
            edge: "edge_1".into(),
            at_m: 0.2,
        },
    )
    .unwrap()
    .template;
    let migrated = &polygon(&split).measurements[0];
    assert_eq!(migrated.id, "chest-width");
    assert_eq!(migrated.label, "Chest width");
    assert_ne!(migrated.a.edge, "edge_1", "75% station must migrate to the second child edge");
    assert_eq!(migrated.b.edge, "edge_3");
    let new_ends = polygon(&split).measurement_points(migrated).unwrap();
    let new_layout = split.panels[0].layout_2d.unwrap_or_default();
    let visual_shift = new_layout - old_layout;
    for (a, b) in old_ends.into_iter().zip(new_ends) {
        assert!((a - (b + visual_shift)).length() < 0.00055,
            "material station moved after contour split");
    }
    assert_close(polygon(&split).measurement_length(migrated).unwrap(), old_distance, "split length");
    split.compile().unwrap();
}

#[test]
fn curved_edge_split_preserves_pom_material_arclength_and_label(){
    let mut source=fixture();
    let pattern=source.panels[0].polygon.as_mut().unwrap();
    // A real bowed rest cutline: sampled arclength exceeds the chord and
    // must not be confused with either x position or Bézier parameter t.
    pattern.curves.insert("edge_1".into(),[
        DVec2::new(0.12,0.04),DVec2::new(0.29,0.045),
    ]);
    source.compile().unwrap();
    let first_length={
        let path=polygon(&source).edge_points(0).unwrap();
        path.windows(2).map(|span|span[0].distance(span[1])).sum::<f64>()
    };
    assert!(first_length>0.4);
    let original=set(&source,measurement("edge_1",0.83,"edge_3",0.2));
    let pom=&polygon(&original).measurements[0];
    let position=polygon(&original).measurement_points(pom).unwrap();
    let length=polygon(&original).measurement_length(pom).unwrap();
    let origin=original.panels[0].layout_2d.unwrap_or_default();
    let changed=authoring::apply(&original,Command::SplitBoundary{
        panel:original.panels[0].id.clone(),
        edge:"edge_1".into(),at_m:first_length*0.38,
    }).unwrap().template;
    let moved=&polygon(&changed).measurements[0];
    assert_eq!(moved.id,pom.id);
    assert_eq!(moved.label,pom.label);
    assert_ne!(moved.a.edge,pom.a.edge);
    let new_position=polygon(&changed).measurement_points(moved).unwrap();
    let delta=changed.panels[0].layout_2d.unwrap_or_default()-origin;
    for (old,new) in position.into_iter().zip(new_position) {
        assert!((old-new-delta).length()<0.0007,
            "POM station drifted beyond sampled-curve tolerance after split");
    }
    assert!((polygon(&changed).measurement_length(moved).unwrap()-length).abs()<0.0007);
    let reopened:GarmentTemplate=serde_json::from_str(&serde_json::to_string(&changed).unwrap()).unwrap();
    assert_eq!(polygon(&reopened).measurements,polygon(&changed).measurements);
}

#[test]
fn mirror_and_grade_edit_preserve_measurement_identifiers() {
    let original = set(&fixture(), measurement("edge_4", 0.5, "edge_2", 0.5));
    let mirrored = authoring::apply(
        &original,
        Command::Mirror {
            panel: original.panels[0].id.clone(),
            axis: marvelous_cloth::garment::shapes::MirrorAxis::X,
            copy_side: None,
        },
    ).unwrap().template;
    let after = &polygon(&mirrored).measurements;
    assert_eq!(after.len(), 1);
    assert_eq!(after[0].id, "chest-width");
    assert_close(polygon(&mirrored).measurement_length(&after[0]).unwrap(), 0.4, "mirror width");

    // Exact numeric resizing acts as a size edit and must retain the POM ID.
    let sized = authoring::apply(
        &original,
        Command::Dimensions {
            panel: original.panels[0].id.clone(),
            width: 0.44,
            height: 0.33,
        },
    ).unwrap().template;
    let after = &polygon(&sized).measurements;
    assert_eq!(after[0].id, "chest-width");
    assert_close(polygon(&sized).measurement_length(&after[0]).unwrap(), 0.44, "graded width");
    sized.compile().unwrap();
}

#[test]
fn topology_edit_cannot_leave_a_dangling_measurement_edge() {
    let original = set(&fixture(), measurement("edge_1", 0.5, "edge_3", 0.5));
    let original_bytes = serde_json::to_vec(&original).unwrap();
    let edit = authoring::apply(
        &original,
        Command::RemovePoint {
            panel: original.panels[0].id.clone(),
            point: 1,
        },
    );
    match edit {
        Ok(edit) => {
            let poly = polygon(&edit.template);
            assert!(poly.measurements.iter().all(|m| {
                poly.edges.contains(&m.a.edge) && poly.edges.contains(&m.b.edge)
                    && poly.measurement_points(m).is_ok()
            }), "removing an edge may migrate or remove measurements, never leave dangling anchors");
            edit.template.compile().unwrap();
        }
        Err(_) => assert_eq!(serde_json::to_vec(&original).unwrap(), original_bytes),
    }
}

#[test]
fn asymmetric_pom_stations_reverse_direction_when_mirroring_the_cutline() {
    let source=set(&fixture(),measurement("edge_1",0.23,"edge_2",0.78));
    let before=polygon(&source).measurements[0].clone();
    let before_length=polygon(&source).measurement_length(&before).unwrap();
    let reflected=authoring::apply(&source,Command::Mirror{
        panel:source.panels[0].id.clone(),
        axis:marvelous_cloth::garment::shapes::MirrorAxis::X,
        copy_side:None,
    }).unwrap().template;
    let poly=polygon(&reflected);
    let pom=&poly.measurements[0];
    assert_eq!(pom.id,before.id);
    assert_eq!(pom.a.edge,before.a.edge);
    assert_eq!(pom.b.edge,before.b.edge);
    assert_close(pom.a.t,1.-before.a.t,"first station must reverse");
    assert_close(pom.b.t,1.-before.b.t,"second station must reverse");
    assert!((poly.measurement_length(pom).unwrap()-before_length).abs()<0.00055,
        "mirroring may not silently move an asymmetrically anchored POM");
    reflected.compile().unwrap();
}
