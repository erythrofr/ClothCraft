use glam::DVec3;
use marvelous_cloth::{
    authoring::History,
    garment::{
        GarmentTemplate,
        dxf_import::{Options, read_ascii},
        meshing::MeshingSettings,
    },
    pattern_import::{self, Source},
};

fn template() -> GarmentTemplate {
    serde_json::from_str(include_str!("../examples/templates/two-panel.json")).unwrap()
}
fn rectangle(x: f64, y: f64, w: f64, h: f64) -> String {
    format!(
        "0\nLWPOLYLINE\n8\nCUT front\n90\n4\n70\n1\n10\n{x}\n20\n{y}\n10\n{x}\n20\n{}\n10\n{}\n20\n{}\n10\n{}\n20\n{y}\n",
        y + h,
        x + w,
        y + h,
        x + w
    )
}
fn document(entities: &str) -> String {
    format!(
        "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n{entities}0\nENDSEC\n0\nEOF\n"
    )
}
fn prepare(
    t: &GarmentTemplate,
    entities: &str,
    selected: &[usize],
) -> Result<marvelous_cloth::authoring::Edit, String> {
    let d = read_ascii(&document(entities), Options::default()).unwrap();
    pattern_import::prepare(
        t,
        &d,
        selected,
        &t.fabrics[0].id,
        MeshingSettings::default(),
        DVec3::new(2., 1.5, 0.5),
    )
}

#[test]
fn append_preserves_existing_panels_seams_and_drape_and_adds_expected_area() {
    let t = template();
    let before = serde_json::to_value(&t).unwrap();
    let old = t.compile().unwrap();
    let mut state = old.initial_state.clone();
    for p in &mut state.x {
        *p += DVec3::new(0.05, -0.1, 0.02);
    }
    state.v.fill(DVec3::new(0.01, 0.02, 0.03));
    state.time = 3.;
    let e = prepare(&t, &rectangle(700., 300., 100., 200.), &[0]).unwrap();
    assert_eq!(serde_json::to_value(&t).unwrap(), before);
    assert_eq!(e.template.panels.len(), t.panels.len() + 1);
    assert_eq!(
        serde_json::to_value(&e.template.panels[..t.panels.len()]).unwrap(),
        before["panels"]
    );
    assert_eq!(
        serde_json::to_value(&e.template.seams).unwrap(),
        before["seams"]
    );
    assert_eq!(
        serde_json::to_value(&e.template.fabrics).unwrap(),
        before["fabrics"]
    );
    let area =
        e.garment.mesh.rest_area.iter().sum::<f64>() - old.mesh.rest_area.iter().sum::<f64>();
    assert!((area - 0.02).abs() < 1e-10);
    let next = e.state_after(&old, &state);
    assert_eq!(&next.x[..state.x.len()], state.x);
    assert_eq!(&next.v[..state.v.len()], state.v);
    assert_eq!(next.time, 3.);
    assert!(next.x[state.x.len()..].iter().all(|p| p.x >= 2.));
}

#[test]
fn one_history_entry_round_trips_and_repeated_import_allocates_distinct_ids() {
    let t = template();
    let entities = rectangle(0., 0., 100., 200.);
    let e = prepare(&t, &entities, &[0]).unwrap();
    let saved = serde_json::to_string(&e.template).unwrap();
    let reopened: GarmentTemplate = serde_json::from_str(&saved).unwrap();
    reopened.compile().unwrap();
    let twice = prepare(&reopened, &entities, &[0]).unwrap();
    assert_ne!(twice.selected, e.selected);
    let mut history = History::default();
    history.record(t.clone());
    let undo = history.restore(&reopened, false).unwrap();
    assert_eq!(
        serde_json::to_value(&undo.template).unwrap(),
        serde_json::to_value(&t).unwrap()
    );
    let redo = history.restore(&undo.template, true).unwrap();
    assert_eq!(
        serde_json::to_value(&redo.template).unwrap(),
        serde_json::to_value(&reopened).unwrap()
    );
}

#[test]
fn invalid_ambiguous_and_stale_selections_leave_source_unchanged() {
    let t = template();
    let saved = serde_json::to_string(&t).unwrap();
    let outer = rectangle(0., 0., 100., 200.);
    for (entities, selected) in [
        (outer.clone(), vec![]),
        (outer.clone(), vec![1]),
        (outer.clone(), vec![0, 0]),
        (outer.replace("70\n1", "70\n0"), vec![0]),
        (
            format!("{outer}{}", rectangle(20., 20., 50., 50.)),
            vec![0, 1],
        ),
        (
            format!("{outer}{}", rectangle(90., 90., 100., 200.)),
            vec![0, 1],
        ),
        (
            format!("{outer}{}", rectangle(100., 0., 100., 200.)),
            vec![0, 1],
        ),
        (rectangle(0., 0., 0., 100.), vec![0]),
    ] {
        assert!(prepare(&t, &entities, &selected).is_err());
        assert_eq!(serde_json::to_string(&t).unwrap(), saved);
    }
    let disjoint = format!("{outer}{}", rectangle(150., 0., 100., 200.));
    assert!(prepare(&t, &disjoint, &[0, 1]).is_ok());
}

#[test]
fn source_requires_explicit_units_and_rejects_invalid_text() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("pattern.dxf");
    std::fs::write(
        &p,
        document(&rectangle(0., 0., 100., 200.)).replace("70\n4\n0\nENDSEC", "70\n0\n0\nENDSEC"),
    )
    .unwrap();
    let source = Source::load(&p).unwrap();
    assert!(source.inspect(Options::default()).is_err());
    let drawing = source
        .inspect(Options {
            metres_per_unit: Some(0.001),
            ..Default::default()
        })
        .unwrap();
    assert!(drawing.scale_overridden);
    std::fs::write(&p, [0xff, 0xfe]).unwrap();
    assert!(Source::load(&p).is_err());
}
