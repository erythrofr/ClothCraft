use glam::{DVec2, DVec3};
use marvelous_cloth::{
    authoring::{self, Command, History, clipboard::PatternClipboard},
    garment::{
        GarmentTemplate,
        domain::{Hole, InternalLine},
        presets::{self, GarmentKind},
    },
};
use std::collections::BTreeSet;

#[test]
fn unheld_selection_pastes_without_losing_unrelated_pin_or_freeze() {
    use marvelous_cloth::authoring::{prepare_freeze_edit, prepare_pin_edit};
    for freeze in [false, true] {
        let mut template = GarmentTemplate::two_panel_demo();
        template.seams.clear();
        for panel in &mut template.panels {
            panel.pins.clear();
            panel.pattern.nx = 2;
            panel.pattern.ny = 2;
        }
        let garment = template.compile().unwrap();
        let held_id = garment.panels[0].id.clone();
        let free_id = garment.panels[1].id.clone();
        let uv = garment.mesh.uv[garment.panels[0].vertices.start + 4];
        let (held, mut state) = if freeze {
            prepare_freeze_edit(&template, &garment, &garment.initial_state, &held_id, true)
                .unwrap()
        } else {
            prepare_pin_edit(
                &template,
                &garment,
                &garment.initial_state,
                &held_id,
                &[uv],
                true,
            )
            .unwrap()
        };
        state.time = 4.25;
        for i in held.garment.panels[1].vertices.clone() {
            state.x[i] += DVec3::new(0.01, -0.02, 0.03);
            state.v[i] = DVec3::new(0.1, -0.05, 0.02);
        }
        let before = serde_json::to_value(&held.template).unwrap();
        let clip =
            PatternClipboard::capture(&held.template, std::slice::from_ref(&free_id)).unwrap();
        let serialized = clip.to_text().unwrap();
        let clip = PatternClipboard::from_text(&serialized).unwrap();
        let value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert!(
            value["template"]["pin_targets"]
                .as_array()
                .is_none_or(Vec::is_empty)
        );
        assert!(
            value["template"]["frozen_panels"]
                .as_array()
                .is_none_or(Vec::is_empty)
        );
        let edit = authoring::apply(
            &held.template,
            Command::Paste {
                clipboard: clip,
                center: DVec2::new(2., 1.),
            },
        )
        .unwrap();
        let next = edit.state_after(&held.garment, &state);
        assert_eq!(next.time, state.time);
        assert_eq!(&next.x[..state.x.len()], &state.x);
        assert_eq!(&next.v[..state.v.len()], &state.v);
        assert_eq!(
            &edit.garment.mesh.uv[..held.garment.mesh.uv.len()],
            &held.garment.mesh.uv
        );
        assert_eq!(edit.template.pin_targets, held.template.pin_targets);
        assert_eq!(edit.template.frozen_panels, held.template.frozen_panels);
        let mut history = History::default();
        history.record(held.template.clone());
        let undo = history.restore(&edit.template, false).unwrap();
        assert_eq!(serde_json::to_value(undo.template).unwrap(), before);
        assert_eq!(serde_json::to_value(&held.template).unwrap(), before);

        for ids in [
            vec![held_id.clone()],
            vec![held_id.clone(), free_id.clone()],
        ] {
            let clip = PatternClipboard::capture(&held.template, &ids).unwrap();
            let clip = PatternClipboard::from_text(&clip.to_text().unwrap()).unwrap();
            let error = authoring::apply(
                &held.template,
                Command::Paste {
                    clipboard: clip,
                    center: DVec2::ZERO,
                },
            )
            .err()
            .expect("selected authored holds must not be dropped");
            assert!(error.contains("Release authored pins"), "{error}");
            assert_eq!(serde_json::to_value(&held.template).unwrap(), before);
        }
    }
}

#[test]
fn external_clipboard_rejects_holds_for_missing_panels() {
    let source = GarmentTemplate::two_panel_demo();
    let clip = PatternClipboard::capture(&source, &[source.panels[0].id.clone()]).unwrap();
    let mut value: serde_json::Value = serde_json::from_str(&clip.to_text().unwrap()).unwrap();
    value["template"]["pin_targets"] =
        serde_json::json!([{ "panel": "missing", "uv": [0., 0.], "world": [0., 0., 0.] }]);
    assert!(PatternClipboard::from_text(&value.to_string()).is_err());
    value["template"]["pin_targets"] = serde_json::json!([]);
    value["template"]["frozen_panels"] = serde_json::json!([{ "panel": source.panels[0].id, "topology": "fake", "targets": [{ "panel": "missing", "uv": [0., 0.], "world": [0., 0., 0.] }] }]);
    assert!(PatternClipboard::from_text(&value.to_string()).is_err());
}

#[test]
fn copying_a_sewn_group_preserves_material_and_existing_drape() {
    let source = GarmentTemplate::two_panel_demo();
    let ids: Vec<_> = source.panels.iter().map(|p| p.id.clone()).collect();
    let clip = PatternClipboard::capture(&source, &ids).unwrap();
    let clip = PatternClipboard::from_text(&clip.to_text().unwrap()).unwrap();
    assert_eq!(clip.seam_count(), source.seams.len());
    let garment = source.compile().unwrap();
    let mut state = garment.initial_state.clone();
    state.time = 4.;
    for (p, v) in state.x.iter_mut().zip(&mut state.v) {
        *p += DVec3::new(0.01, -0.02, 0.03);
        *v = DVec3::new(0.02, 0., 0.);
    }
    let edit = authoring::apply(
        &source,
        Command::Paste {
            clipboard: clip,
            center: DVec2::new(2., 1.),
        },
    )
    .unwrap();
    let next = edit.state_after(&garment, &state);
    assert_eq!(next.time, state.time);
    assert_eq!(&next.x[..state.x.len()], &state.x);
    assert_eq!(&next.v[..state.v.len()], &state.v);
    assert_eq!(edit.template.panels.len(), source.panels.len() * 2);
    assert_eq!(edit.template.seams.len(), source.seams.len() * 2);
    assert_eq!(edit.template.fabrics.len(), source.fabrics.len());
    let copied: BTreeSet<_> = edit.template.panels[2..]
        .iter()
        .map(|p| p.id.as_str())
        .collect();
    for seam in &edit.template.seams[source.seams.len()..] {
        assert!(copied.contains(seam.a.panel.as_str()));
        assert!(copied.contains(seam.b.panel.as_str()));
    }
    let mass_old: f64 = garment.mesh.masses.iter().sum();
    let mass_new: f64 = edit.garment.mesh.masses.iter().sum();
    assert!((mass_new - mass_old * 2.).abs() < 1e-10);
    let mut history = History::default();
    history.record(source.clone());
    let undo = history.restore(&edit.template, false).unwrap();
    assert_eq!(
        serde_json::to_value(undo.template).unwrap(),
        serde_json::to_value(&source).unwrap()
    );
    let redo = history.restore(&source, true).unwrap();
    assert_eq!(
        serde_json::to_value(redo.template).unwrap(),
        serde_json::to_value(&edit.template).unwrap()
    );
}

#[test]
fn partial_copy_omits_external_seams_and_repeated_paste_has_unique_ids() {
    let mut source = GarmentTemplate::two_panel_demo();
    let clip = PatternClipboard::capture(&source, &[source.panels[0].id.clone()]).unwrap();
    assert_eq!(clip.seam_count(), 0);
    for _ in 0..3 {
        source = authoring::apply(
            &source,
            Command::Paste {
                clipboard: clip.clone(),
                center: DVec2::ZERO,
            },
        )
        .unwrap()
        .template;
    }
    assert_eq!(source.panels.len(), 5);
    assert_eq!(
        source
            .panels
            .iter()
            .map(|p| &p.id)
            .collect::<BTreeSet<_>>()
            .len(),
        5
    );
}

#[test]
fn cross_document_paste_does_not_overwrite_conflicting_fabric() {
    let source = GarmentTemplate::two_panel_demo();
    let clip = PatternClipboard::capture(&source, &[source.panels[0].id.clone()]).unwrap();
    let mut target = source.clone();
    target.fabrics[0].properties.density *= 2.;
    let before = target.fabrics[0].properties.clone();
    let edit = authoring::apply(
        &target,
        Command::Paste {
            clipboard: clip,
            center: DVec2::ZERO,
        },
    )
    .unwrap();
    assert_eq!(edit.template.fabrics[0].properties, before);
    let copy = edit.template.panels.last().unwrap();
    assert_ne!(copy.fabric, target.panels[0].fabric);
    let f = edit
        .template
        .fabrics
        .iter()
        .find(|f| f.id == copy.fabric)
        .unwrap();
    assert_eq!(f.properties, source.fabrics[0].properties);
}

#[test]
fn clipboard_round_trip_preserves_domain_and_target_metadata() {
    let mut source = presets::basic(GarmentKind::Tshirt, 0);
    let p = &mut source.panels[0];
    p.layout_rotation_degrees = 37.;
    let poly = p.polygon.as_mut().unwrap();
    // Capture/encoding preserves arbitrary domain fields; compilation validates
    // the actual geometry transaction separately, rather than normalizing it.
    poly.holes.push(Hole {
        edges: vec!["cutout_a".into(), "cutout_b".into(), "cutout_c".into()],
        points: vec![
            DVec2::splat(0.05),
            DVec2::new(0.08, 0.05),
            DVec2::splat(0.08),
        ],
    });
    poly.lines.push(InternalLine {
        id: "gather".into(),
        points: vec![DVec2::new(0.1, 0.2), DVec2::new(0.2, 0.2)],
        tangents: vec![DVec2::new(0.02, 0.01); 2],
    });
    poly.target_lengths.insert(poly.edges[0].clone(), 0.23);
    let id = p.id.clone();
    let clip = PatternClipboard::capture(&source, &[id]).unwrap();
    let text = clip.to_text().unwrap();
    let decoded: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(
        decoded["template"]["panels"][0]["polygon"],
        serde_json::to_value(source.panels[0].polygon.as_ref().unwrap()).unwrap()
    );
    assert_eq!(
        PatternClipboard::from_text(&text)
            .unwrap()
            .to_text()
            .unwrap(),
        text
    );
}

#[test]
fn invalid_clipboards_and_group_moves_are_transactional() {
    let source = GarmentTemplate::two_panel_demo();
    let clip = PatternClipboard::capture(&source, &[source.panels[0].id.clone()]).unwrap();
    let before = serde_json::to_vec(&source).unwrap();
    assert!(PatternClipboard::from_text("hello").is_err());
    let mut payload: serde_json::Value = serde_json::from_str(&clip.to_text().unwrap()).unwrap();
    payload["version"] = 99.into();
    assert!(PatternClipboard::from_text(&payload.to_string()).is_err());
    assert!(
        authoring::apply(
            &source,
            Command::Paste {
                clipboard: clip,
                center: DVec2::splat(f64::NAN)
            }
        )
        .is_err()
    );
    assert!(
        authoring::apply(
            &source,
            Command::LayoutGroup {
                panels: vec!["missing".into()],
                delta: DVec2::ONE
            }
        )
        .is_err()
    );
    assert_eq!(serde_json::to_vec(&source).unwrap(), before);
}

#[test]
fn group_layout_moves_once_and_preserves_all_physical_data() {
    let mut source = GarmentTemplate::two_panel_demo();
    source.panels[0].layout_rotation_degrees = 27.;
    let origins: Vec<_> = (0..source.panels.len())
        .map(|i| authoring::layout(&source, i))
        .collect();
    let ids = vec![
        source.panels[0].id.clone(),
        source.panels[0].id.clone(),
        source.panels[1].id.clone(),
    ];
    let delta = DVec2::new(0.3, -0.2);
    let edit = authoring::apply(&source, Command::LayoutGroup { panels: ids, delta }).unwrap();
    assert!(!edit.reset_simulation);
    assert!(authoring::same_physics(&source, &edit.template));
    for (i, origin) in origins.iter().enumerate() {
        assert_eq!(authoring::layout(&edit.template, i), *origin + delta);
    }
}
