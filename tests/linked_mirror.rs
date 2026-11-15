use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History, clipboard::PatternClipboard},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        shapes::{self, MirrorAxis, Primitive},
    },
};

fn fixture() -> GarmentTemplate {
    let t = authoring::apply(
        &GarmentTemplate::two_panel_demo(),
        Command::Primitive {
            kind: Primitive::Rectangle,
            size: DVec2::new(0.4, 0.5),
            sweep_degrees: 180.,
            origin: DVec2::ZERO,
            meshing: MeshingSettings {
                target_edge_m: 0.09,
                ..Default::default()
            },
            fabric: "woven-demo".into(),
            replace: true,
        },
    )
    .unwrap()
    .template;
    let id = t.panels[0].id.clone();
    authoring::apply(
        &t,
        Command::LinkedMirror {
            panel: id,
            axis: MirrorAxis::X,
        },
    )
    .unwrap()
    .template
}
fn verify(t: &GarmentTemplate) {
    let a = &t.panels[0];
    let b = &t.panels[1];
    let mut expected = a.polygon.clone().unwrap();
    shapes::mirror(
        &mut expected,
        MirrorAxis::X,
        DVec2::new(a.pattern.width, a.pattern.height),
    );
    let actual = b.polygon.as_ref().unwrap();
    assert_eq!(expected.edges, actual.edges);
    assert_eq!(expected.points.len(), actual.points.len());
    for (a, b) in expected.points.iter().zip(&actual.points) {
        assert!(a.distance(*b) < 1e-12);
    }
    assert_eq!(
        serde_json::to_value(&expected.lines).unwrap(),
        serde_json::to_value(&actual.lines).unwrap()
    );
    t.compile().unwrap();
}
#[test]
fn edits_either_partner_atomically_and_undo_restores_both() {
    let mut t = fixture();
    let poses: Vec<_> = t
        .panels
        .iter()
        .map(|p| serde_json::to_value(&p.placement).unwrap())
        .collect();
    for i in 0..2 {
        let old = t.clone();
        let mut history = History::default();
        history.record(old.clone());
        let edit = authoring::apply(
            &t,
            Command::MovePoints {
                panel: t.panels[i].id.clone(),
                points: vec![1],
                delta: DVec2::new(0.01, 0.01),
            },
        )
        .unwrap();
        assert!(edit.reset_simulation);
        t = edit.template;
        verify(&t);
        assert_eq!(
            poses,
            t.panels
                .iter()
                .map(|p| serde_json::to_value(&p.placement).unwrap())
                .collect::<Vec<_>>()
        );
        let undone = history.restore(&t, false).unwrap();
        assert_eq!(
            serde_json::to_value(undone.template).unwrap(),
            serde_json::to_value(old).unwrap()
        );
    }
}
#[test]
fn internal_curves_roundtrip_clipboard_and_unlink() {
    let t = fixture();
    let id = t.panels[0].id.clone();
    let t = authoring::apply(
        &t,
        Command::InternalLine {
            panel: id.clone(),
            points: vec![DVec2::new(0.1, 0.2), DVec2::new(0.3, 0.2)],
            tangents: vec![DVec2::new(0.03, 0.02); 2],
        },
    )
    .unwrap()
    .template;
    verify(&t);
    let restored: GarmentTemplate =
        serde_json::from_str(&serde_json::to_string(&t).unwrap()).unwrap();
    verify(&restored);
    let clip = PatternClipboard::capture(
        &t,
        &t.panels.iter().map(|p| p.id.clone()).collect::<Vec<_>>(),
    )
    .unwrap();
    let pasted = authoring::apply(
        &t,
        Command::Paste {
            clipboard: clip,
            center: DVec2::splat(2.),
        },
    )
    .unwrap()
    .template;
    assert_eq!(pasted.mirror_links.len(), 2);
    let clip = PatternClipboard::capture(&t, std::slice::from_ref(&id)).unwrap();
    let pasted = authoring::apply(
        &t,
        Command::Paste {
            clipboard: clip,
            center: DVec2::splat(2.),
        },
    )
    .unwrap()
    .template;
    assert_eq!(pasted.mirror_links.len(), 1);
    let unlinked = authoring::apply(&t, Command::UnlinkMirror { panel: id.clone() }).unwrap();
    assert!(!unlinked.reset_simulation);
    let edited = authoring::apply(
        &unlinked.template,
        Command::MovePoints {
            panel: id,
            points: vec![1],
            delta: DVec2::new(0.02, 0.),
        },
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(&t.panels[1]).unwrap(),
        serde_json::to_value(&edited.template.panels[1]).unwrap()
    );
}
#[test]
fn topology_edits_are_rejected_until_unlinked_and_delete_cleans_relation() {
    let t = fixture();
    let id = t.panels[0].id.clone();
    let before = serde_json::to_string(&t).unwrap();
    assert!(
        authoring::apply(
            &t,
            Command::RemovePoint {
                panel: id.clone(),
                point: 1
            }
        )
        .is_err()
    );
    assert!(
        authoring::apply(
            &t,
            Command::LinkedMirror {
                panel: id.clone(),
                axis: MirrorAxis::Y
            }
        )
        .is_err()
    );
    assert_eq!(before, serde_json::to_string(&t).unwrap());
    let deleted = authoring::apply(&t, Command::RemovePanel { panel: id }).unwrap();
    assert!(deleted.template.mirror_links.is_empty());
    let mut invalid = t.clone();
    invalid.mirror_links[0].b = invalid.mirror_links[0].a.clone();
    assert!(invalid.compile().is_err());
}

#[test]
fn split_boundary_on_either_linked_piece_mirrors_to_the_partner() {
    let t = fixture();
    let base = t.panels[1].polygon.as_ref().unwrap().points.len();
    let split = |t: &GarmentTemplate, i: usize, at_m: f64| {
        authoring::apply(
            t,
            Command::SplitBoundary {
                panel: t.panels[i].id.clone(),
                edge: "edge_1".into(),
                at_m,
            },
        )
        .unwrap()
        .template
    };
    let one = split(&t, 0, 0.1);
    verify(&one);
    for panel in &one.panels {
        assert_eq!(panel.polygon.as_ref().unwrap().points.len(), base + 1);
    }
    // The first split leaves a 0.1 m "edge_1" on both pieces, so cut it shorter.
    let two = split(&one, 1, 0.03);
    verify(&two);
    for panel in &two.panels {
        assert_eq!(panel.polygon.as_ref().unwrap().points.len(), base + 2);
    }
}

#[test]
fn sewing_ranges_keep_their_direction_during_linked_edits() {
    use marvelous_cloth::garment::seam::{BoundaryRef, Side};
    let t = fixture();
    let edge = |panel: &str| BoundaryRef {
        panel: panel.into(),
        edge: Some("edge_1".into()),
        side: Side::Top,
        range: [0.2, 0.8],
        reversed: false,
    };
    let t = authoring::apply(
        &t,
        Command::Sew {
            a: edge(&t.panels[0].id),
            b: edge(&t.panels[1].id),
            reverse: true,
            ease: true,
        },
    )
    .unwrap()
    .template;
    let seams = serde_json::to_value(&t.seams).unwrap();
    let edit = authoring::apply(
        &t,
        Command::MovePoints {
            panel: t.panels[1].id.clone(),
            points: vec![1],
            delta: DVec2::new(0.01, 0.01),
        },
    )
    .unwrap();
    verify(&edit.template);
    assert_eq!(seams, serde_json::to_value(&edit.template.seams).unwrap());
    let old = edit.garment.initial_state.clone();
    let unlinked = authoring::apply(
        &edit.template,
        Command::UnlinkMirror {
            panel: t.panels[0].id.clone(),
        },
    )
    .unwrap();
    let state = unlinked.state_after(&edit.garment, &old);
    assert_eq!(state.x, old.x);
    assert_eq!(state.v, old.v);
}
