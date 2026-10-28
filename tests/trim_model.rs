use glam::DVec2;
use marvelous_cloth::garment::trims::{Trim, TrimKind};

fn trim(kind: TrimKind) -> Trim {
    Trim {
        id: "trim_1".into(),
        panel_id: "front".into(),
        kind,
    }
}

#[test]
fn all_trim_types_roundtrip_and_reject_invalid_geometry() {
    let a = DVec2::ZERO;
    let b = DVec2::new(0.1, 0.2);
    let valid = [
        TrimKind::Button {
            center_m: a,
            diameter_m: 0.018,
        },
        TrimKind::Buttonhole {
            start_m: a,
            end_m: b,
            width_m: 0.004,
        },
        TrimKind::Zipper {
            path_m: vec![a, b],
            width_m: 0.012,
        },
        TrimKind::Topstitch {
            path_m: vec![a, b],
            rows: 2,
            spacing_m: 0.004,
        },
    ];
    for kind in valid {
        let original = trim(kind);
        original.validate().unwrap();
        let encoded = serde_json::to_vec(&original).unwrap();
        let decoded: Trim = serde_json::from_slice(&encoded).unwrap();
        assert_eq!(decoded, original);
        decoded.validate().unwrap();
    }
    let invalid = [
        TrimKind::Button {
            center_m: DVec2::splat(f64::NAN),
            diameter_m: 0.018,
        },
        TrimKind::Button {
            center_m: a,
            diameter_m: 0.,
        },
        TrimKind::Buttonhole {
            start_m: a,
            end_m: a,
            width_m: 0.004,
        },
        TrimKind::Zipper {
            path_m: vec![a],
            width_m: 0.012,
        },
        TrimKind::Topstitch {
            path_m: vec![a, b],
            rows: 9,
            spacing_m: 0.004,
        },
        TrimKind::Zipper {
            path_m: vec![a; 1025],
            width_m: 0.012,
        },
    ];
    for kind in invalid {
        assert!(trim(kind).validate().is_err());
    }
    let mut bad_id = trim(TrimKind::Button {
        center_m: a,
        diameter_m: 0.018,
    });
    bad_id.panel_id = "../front".into();
    assert!(bad_id.validate().is_err());
}

#[test]
fn document_roundtrip_validates_references_and_keeps_physics() {
    use marvelous_cloth::{authoring, garment::GarmentTemplate};
    let source = GarmentTemplate::two_panel_demo();
    let legacy = serde_json::to_value(&source).unwrap();
    assert!(legacy.get("trims").is_none());
    let mut edited = source.clone();
    edited.trims.push(Trim {
        panel_id: source.panels[0].id.clone(),
        ..trim(TrimKind::Button {
            center_m: DVec2::ZERO,
            diameter_m: 0.018,
        })
    });
    edited.compile().unwrap();
    assert!(authoring::same_physics(&source, &edited));
    assert!(authoring::only_appearance_changed(&source, &edited));
    let loaded: GarmentTemplate =
        serde_json::from_slice(&serde_json::to_vec(&edited).unwrap()).unwrap();
    assert_eq!(loaded.trims, edited.trims);
    let mut missing = edited.clone();
    missing.trims[0].panel_id = "missing".into();
    assert!(missing.compile().is_err());
    let mut duplicate = edited.clone();
    duplicate.trims.push(duplicate.trims[0].clone());
    assert!(duplicate.compile().is_err());
    let old: GarmentTemplate = serde_json::from_value(legacy).unwrap();
    assert!(old.trims.is_empty());
}

#[test]
fn trim_transactions_copy_and_delete_keep_identity_and_physics() {
    use marvelous_cloth::{
        authoring::{self, Command, clipboard::PatternClipboard},
        garment::GarmentTemplate,
    };
    let original = GarmentTemplate::two_panel_demo();
    let mut item = trim(TrimKind::Button {
        center_m: DVec2::new(0.1, 0.1),
        diameter_m: 0.018,
    });
    item.panel_id = original.panels[0].id.clone();
    let added = authoring::apply(&original, Command::SetTrim { trim: item.clone() }).unwrap();
    assert!(!added.reset_simulation);
    assert!(authoring::only_appearance_changed(
        &original,
        &added.template
    ));
    assert!(authoring::apply(&added.template, Command::SetTrim { trim: item.clone() }).is_err());
    let duplicated = authoring::apply(
        &added.template,
        Command::Duplicate {
            panel: item.panel_id.clone(),
        },
    )
    .unwrap();
    assert_eq!(duplicated.template.trims.len(), 2);
    assert_ne!(
        duplicated.template.trims[0].id,
        duplicated.template.trims[1].id
    );
    assert_eq!(
        duplicated.template.trims[1].panel_id,
        duplicated.selected.unwrap()
    );
    let clip =
        PatternClipboard::capture(&added.template, std::slice::from_ref(&item.panel_id)).unwrap();
    let clip = PatternClipboard::from_text(&clip.to_text().unwrap()).unwrap();
    let pasted = authoring::apply(
        &added.template,
        Command::Paste {
            clipboard: clip,
            center: DVec2::ZERO,
        },
    )
    .unwrap();
    assert_eq!(pasted.template.trims.len(), 2);
    assert_ne!(pasted.template.trims[0].id, pasted.template.trims[1].id);
    assert_eq!(pasted.template.trims[1].panel_id, pasted.selected.unwrap());
    let deleted = authoring::apply(
        &added.template,
        Command::RemovePanel {
            panel: item.panel_id.clone(),
        },
    )
    .unwrap();
    assert!(deleted.template.trims.is_empty());
    let removed = authoring::apply(&added.template, Command::RemoveTrim { id: item.id }).unwrap();
    assert!(!removed.reset_simulation);
    assert!(removed.template.trims.is_empty());
}

#[test]
fn trim_topology_edits_fail_closed_and_remesh_keeps_attachment() {
    use marvelous_cloth::{
        authoring::{self, Command},
        garment::{
            GarmentTemplate,
            shapes::{MirrorAxis, Primitive, primitive},
        },
    };
    let mut source = GarmentTemplate::two_panel_demo();
    source.version = 2;
    source.panels[0].polygon = Some(
        primitive(
            Primitive::Rectangle,
            DVec2::splat(0.4),
            90.,
            Default::default(),
        )
        .unwrap(),
    );
    source.panels[0].pattern.height = 0.4;
    source.panels[0].pins.clear();
    source.seams.clear();
    let panel = source.panels[0].id.clone();
    let item = Trim {
        panel_id: panel.clone(),
        ..trim(TrimKind::Button {
            center_m: DVec2::new(0.1, 0.1),
            diameter_m: 0.018,
        })
    };
    let source = authoring::apply(&source, Command::SetTrim { trim: item.clone() })
        .unwrap()
        .template;
    let before = serde_json::to_vec(&source).unwrap();
    assert!(
        authoring::apply(
            &source,
            Command::LinkedMirror {
                panel: panel.clone(),
                axis: MirrorAxis::X,
            }
        )
        .is_err()
    );
    assert!(
        authoring::apply(
            &source,
            Command::Dimensions {
                panel: panel.clone(),
                width: 0.5,
                height: 0.5
            }
        )
        .is_err()
    );
    assert_eq!(serde_json::to_vec(&source).unwrap(), before);
    let mut shape = source.panels[0].polygon.clone().unwrap();
    shape.meshing.as_mut().unwrap().target_edge_m = 0.04;
    let remeshed = authoring::apply(
        &source,
        Command::Shape {
            panel,
            polygon: shape,
        },
    )
    .unwrap();
    assert_eq!(remeshed.template.trims, vec![item]);
    assert!(remeshed.reset_simulation);
}

#[test]
fn standalone_mirror_reflects_all_trims_and_preserves_history() {
    use marvelous_cloth::{
        authoring::{self, Command, History},
        fitting::FittingProject,
        garment::{
            GarmentTemplate,
            presets::GarmentKind,
            shapes::{MirrorAxis, Primitive, primitive},
        },
    };
    let mut source = GarmentTemplate::two_panel_demo();
    source.version = 2;
    source.panels[0].pattern.height = 0.4;
    source.panels[0].pins.clear();
    source.panels[0].polygon = Some(
        primitive(
            Primitive::Rectangle,
            DVec2::splat(0.4),
            90.,
            Default::default(),
        )
        .unwrap(),
    );
    source.seams.clear();
    let panel = source.panels[0].id.clone();
    let kinds = [
        TrimKind::Button {
            center_m: DVec2::new(0.1, 0.15),
            diameter_m: 0.01,
        },
        TrimKind::Buttonhole {
            start_m: DVec2::new(0.08, 0.1),
            end_m: DVec2::new(0.12, 0.15),
            width_m: 0.01,
        },
        TrimKind::Zipper {
            path_m: vec![DVec2::new(0.1, 0.1), DVec2::new(0.2, 0.2)],
            width_m: 0.01,
        },
        TrimKind::Topstitch {
            path_m: vec![DVec2::new(0.12, 0.08), DVec2::new(0.22, 0.18)],
            rows: 2,
            spacing_m: 0.004,
        },
    ];
    for (i, kind) in kinds.into_iter().enumerate() {
        source.trims.push(Trim {
            id: format!("trim_{i}"),
            panel_id: panel.clone(),
            kind,
        });
    }
    let other = Trim {
        id: "other".into(),
        panel_id: source.panels[1].id.clone(),
        kind: TrimKind::Button {
            center_m: DVec2::new(0.2, 0.2),
            diameter_m: 0.01,
        },
    };
    source.trims.push(other.clone());
    source.compile().unwrap();
    let directory = tempfile::tempdir().unwrap();
    let avatar = directory.path().join("avatar.obj");
    std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
    for axis in [MirrorAxis::X, MirrorAxis::Y] {
        for copy_side in [None, Some(1), Some(-1)] {
            let edit = authoring::apply(
                &source,
                Command::Mirror {
                    panel: panel.clone(),
                    axis,
                    copy_side,
                },
            )
            .unwrap();
            assert!(edit.reset_simulation);
            let target = edit.selected.as_ref().unwrap();
            let mirrored: Vec<_> = edit
                .template
                .trims
                .iter()
                .filter(|t| &t.panel_id == target)
                .collect();
            assert_eq!(mirrored.len(), 4);
            let reflect = |p: DVec2| match axis {
                MirrorAxis::X => DVec2::new(0.4 - p.x, p.y),
                MirrorAxis::Y => DVec2::new(p.x, 0.4 - p.y),
            };
            let point = match mirrored[0].kind {
                TrimKind::Button {
                    center_m,
                    diameter_m,
                } => {
                    assert_eq!(diameter_m, 0.01);
                    center_m
                }
                _ => panic!("wrong kind"),
            };
            assert_eq!(point, reflect(DVec2::new(0.1, 0.15)));
            match &mirrored[1].kind {
                TrimKind::Buttonhole {
                    start_m,
                    end_m,
                    width_m,
                } => {
                    assert_eq!(*start_m, reflect(DVec2::new(0.08, 0.1)));
                    assert_eq!(*end_m, reflect(DVec2::new(0.12, 0.15)));
                    assert_eq!(*width_m, 0.01);
                }
                _ => panic!("wrong kind"),
            }
            match &mirrored[2].kind {
                TrimKind::Zipper { path_m, width_m } => {
                    assert_eq!(path_m[0], reflect(DVec2::new(0.1, 0.1)));
                    assert_eq!(path_m[1], reflect(DVec2::new(0.2, 0.2)));
                    assert_eq!(*width_m, 0.01);
                }
                _ => panic!("wrong kind"),
            }
            match &mirrored[3].kind {
                TrimKind::Topstitch {
                    path_m,
                    rows,
                    spacing_m,
                } => {
                    assert_eq!(path_m[0], reflect(DVec2::new(0.12, 0.08)));
                    assert_eq!(path_m[1], reflect(DVec2::new(0.22, 0.18)));
                    assert_eq!((*rows, *spacing_m), (2, 0.004));
                }
                _ => panic!("wrong kind"),
            }
            assert!(edit.template.trims.contains(&other));
            if copy_side.is_some() {
                assert_ne!(target, &panel);
                assert!(
                    source
                        .trims
                        .iter()
                        .all(|item| edit.template.trims.contains(item))
                );
                assert!(
                    mirrored
                        .iter()
                        .all(|item| !source.trims.iter().any(|old| old.id == item.id))
                );
            } else {
                assert_eq!(target, &panel);
                assert_eq!(
                    mirrored.iter().map(|item| &item.id).collect::<Vec<_>>(),
                    source.trims[..4]
                        .iter()
                        .map(|item| &item.id)
                        .collect::<Vec<_>>()
                );
            }
            let encoded = serde_json::to_string(&edit.template).unwrap();
            let loaded: GarmentTemplate = serde_json::from_str(&encoded).unwrap();
            assert_eq!(loaded.trims, edit.template.trims);
            let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar.clone());
            project.template = edit.template.clone();
            project.state = None;
            let file = directory.path().join("mirrored.clothcraft");
            project.save(&file).unwrap();
            let reopened = FittingProject::load(&file).unwrap();
            assert_eq!(reopened.template.trims, edit.template.trims);
            reopened.compile().unwrap();
            let mut history = History::default();
            history.record(source.clone());
            let undone = history.restore(&edit.template, false).unwrap();
            assert_eq!(undone.template.trims, source.trims);
            let redone = history.restore(&undone.template, true).unwrap();
            assert_eq!(redone.template.trims, edit.template.trims);
        }
    }
}

#[test]
fn trim_history_and_project_save_preserve_drape() {
    use marvelous_cloth::{
        authoring::{self, Command, History},
        fitting::FittingProject,
        garment::presets::GarmentKind,
    };
    let dir = tempfile::tempdir().unwrap();
    let avatar = dir.path().join("avatar.obj");
    std::fs::write(&avatar, "v 10 0 -10\nv 11 0 -10\nv 10 1 -10\nf 1 2 3\n").unwrap();
    let file = dir.path().join("trim.clothcraft");
    let mut project = FittingProject::basic(GarmentKind::Tshirt, 0, avatar);
    let mut state = project.template.compile().unwrap().initial_state;
    state.time = 3.;
    state.v.fill(glam::DVec3::new(0.1, 0.2, 0.3));
    project.state = Some(state.clone());
    let mut item = trim(TrimKind::Button {
        center_m: DVec2::new(0.1, 0.1),
        diameter_m: 0.018,
    });
    item.panel_id = project.template.panels[0].id.clone();
    let mut history = History::default();
    for phase in 0..3 {
        let command = match phase {
            0 => Command::SetTrim { trim: item.clone() },
            1 => {
                item.kind = TrimKind::Button {
                    center_m: DVec2::new(0.15, 0.1),
                    diameter_m: 0.018,
                };
                Command::SetTrim { trim: item.clone() }
            }
            _ => Command::RemoveTrim {
                id: item.id.clone(),
            },
        };
        let edit = authoring::apply(&project.template, command).unwrap();
        assert!(!edit.reset_simulation);
        history.record(project.template.clone());
        project.template = edit.template;
        project.save(&file).unwrap();
        project = FittingProject::load(&file).unwrap();
        let scene = project.compile().unwrap();
        assert_eq!(scene.state.x, state.x);
        assert_eq!(scene.state.v, state.v);
        assert_eq!(scene.state.time, state.time);
        assert_eq!(
            project.template.trims,
            if phase == 2 {
                vec![]
            } else {
                vec![item.clone()]
            }
        );
    }
    for redo in [false, false, false, true, true, true] {
        let edit = history.restore(&project.template, redo).unwrap();
        assert!(!edit.reset_simulation);
        project.template = edit.template;
    }
    assert!(project.template.trims.is_empty());
}
