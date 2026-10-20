//! Disposable native authoring tests: material-space split and dependency remap.
//! No installed project, legacy garment or user document is modified.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        polygon::EdgeNotch,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, SeamSpec, Side},
    },
};

fn fixture(reverse_b: bool, on_b: bool, partial: bool) -> GarmentTemplate {
    let original = presets::basic(GarmentKind::Tshirt, 0);
    let first = authoring::apply(&original, Command::Polygon {
        points: vec![DVec2::ZERO, DVec2::new(0.4, 0.), DVec2::new(0.4, 0.3), DVec2::new(0., 0.3)],
        tangents: vec![],
        meshing: MeshingSettings { target_edge_m: 0.05, ..Default::default() },
        fabric: "woven-reference".into(),
        replace: true,
    }).unwrap().template;
    let mut t = authoring::apply(&first, Command::Duplicate {panel: first.panels[0].id.clone()}).unwrap().template;
    let one = t.panels[0].id.clone();
    let two = t.panels[1].id.clone();
    let range = if partial { [0.15, 0.85] } else { [0., 1.] };
    let endpoint = |panel| BoundaryRef { panel, side: Side::Top, edge: Some("edge_1".into()), range };
    t.seams.push(SeamSpec {
        id: "test-seam".into(), a: endpoint(one.clone()), b: endpoint(two.clone()),
        reverse_b, notches: vec![], stiffness: 50_000., allow_ease: false,
    });
    let decorated = if on_b {1} else {0};
    let poly = t.panels[decorated].polygon.as_mut().unwrap();
    poly.target_lengths.insert("edge_1".into(), 0.4);
    poly.seam_allowances.insert("edge_1".into(), 0.012);
    poly.notches.insert("edge_1".into(), vec![
        EdgeNotch {t:0.25,depth_m:0.003}, EdgeNotch {t:0.75,depth_m:0.003},
    ]);
    assert!(t.compile().is_ok(), "baseline decorated sewing fixture must compile");
    t
}

fn check_remap(reverse_b: bool, on_b: bool, partial: bool) {
    let original = fixture(reverse_b, on_b, partial);
    let source_bytes = serde_json::to_vec(&original).unwrap();
    let panel = original.panels[if on_b {1} else {0}].id.clone();
    let mut history = History::default();
    history.record(original.clone());
    let updated = authoring::apply(&original, Command::SplitBoundary {
        panel:panel.clone(),edge:"edge_1".into(),at_m:0.2,
    }).expect("split a sewn, notched and allowanced boundary").template;
    assert_eq!(updated.seams.len(), 2);
    assert_eq!(updated.seams[0].id, "test-seam");
    assert_ne!(updated.seams[1].id, "test-seam");
    let poly = updated.panels[if on_b {1} else {0}].polygon.as_ref().unwrap();
    assert_eq!(poly.edges.len(), 5);
    assert_eq!(poly.edges[0], "edge_1");
    assert_eq!(poly.edges[1], "edge_1_2");
    assert_eq!(poly.seam_allowances.get("edge_1"), Some(&0.012));
    assert_eq!(poly.seam_allowances.get("edge_1_2"), Some(&0.012));
    assert!((poly.target_lengths["edge_1"] - 0.2).abs() < 1e-10);
    assert!((poly.target_lengths["edge_1_2"] - 0.2).abs() < 1e-10);
    assert_eq!(poly.notches["edge_1"], vec![EdgeNotch {t:0.5,depth_m:0.003}]);
    assert_eq!(poly.notches["edge_1_2"], vec![EdgeNotch {t:0.5,depth_m:0.003}]);
    for seam in &updated.seams {
        assert!((seam.a.range[1] - seam.a.range[0]) > 0.);
        assert!((seam.b.range[1] - seam.b.range[0]) > 0.);
        assert_eq!(seam.reverse_b, reverse_b);
    }
    // The opposite panel must remain continuously covered by the same
    // physical interval, with neither gaps nor overlapping duplicate sewing.
    let mut opposite_ranges:Vec<[f64;2]>=updated.seams.iter().map(|s| {
        if on_b {s.a.range} else {s.b.range}
    }).collect();
    opposite_ranges.sort_by(|a,b|a[0].total_cmp(&b[0]));
    let expected=if partial { [0.15,0.85] } else { [0.,1.] };
    assert!((opposite_ranges[0][0]-expected[0]).abs()<1e-10);
    assert!((opposite_ranges[0][1]-opposite_ranges[1][0]).abs()<1e-10);
    assert!((opposite_ranges[1][1]-expected[1]).abs()<1e-10);
    updated.compile().expect("sewn and notched split compiles into garment");
    let reopened:GarmentTemplate = serde_json::from_slice(&serde_json::to_vec(&updated).unwrap()).unwrap();
    reopened.compile().unwrap();
    assert_eq!(serde_json::to_vec(&reopened).unwrap(), serde_json::to_vec(&updated).unwrap());
    let undone = history.restore(&updated, false).unwrap();
    assert_eq!(serde_json::to_vec(&undone.template).unwrap(), source_bytes);
    let redone = history.restore(&undone.template, true).unwrap();
    assert_eq!(serde_json::to_vec(&redone.template).unwrap(), serde_json::to_vec(&updated).unwrap());
}

#[test]
fn sewn_notched_allowanced_and_targeted_edges_remap_under_split() {
    for reverse_b in [false,true] {
        for on_b in [false,true] {
            for partial in [false,true] {
                check_remap(reverse_b,on_b,partial);
            }
        }
    }
}

#[test]
fn an_exact_notch_at_the_split_position_is_rejected_atomically() {
    let mut source = fixture(false,false,false);
    source.panels[0].polygon.as_mut().unwrap().notches.get_mut("edge_1").unwrap()[0].t = 0.5;
    let bytes = serde_json::to_vec(&source).unwrap();
    assert!(authoring::apply(&source,Command::SplitBoundary {
        panel:source.panels[0].id.clone(),edge:"edge_1".into(),at_m:0.2,
    }).is_err());
    assert_eq!(serde_json::to_vec(&source).unwrap(),bytes);
}

#[test]
fn seam_correspondence_notches_migrate_for_both_sides_and_directions() {
    for reverse_b in [false,true] {
        for on_b in [false,true] {
            let mut source = fixture(reverse_b,on_b,false);
            let panel=source.panels[if on_b {1} else {0}].id.clone();
            source.seams[0].notches=vec![[0.2,0.2],[0.8,0.8]];
            let before=serde_json::to_vec(&source).unwrap();
            source.compile().unwrap();
            let result=authoring::apply(&source,Command::SplitBoundary {
                panel,edge:"edge_1".into(),at_m:0.2,
            }).expect("valid monotone correspondence must migrate").template;
            assert_eq!(result.seams.len(),2);
            assert_eq!(result.seams[0].notches.len(),1);
            assert_eq!(result.seams[1].notches.len(),1);
            result.compile().unwrap();
            assert_eq!(serde_json::to_vec(&source).unwrap(),before);
        }
    }
}

#[test]
fn incompatible_correspondence_notches_fail_closed() {
    let mut source=fixture(false,false,false);
    source.seams[0].notches=vec![[0.3,0.7],[0.2,0.8]];
    let bytes=serde_json::to_vec(&source).unwrap();
    assert!(authoring::apply(&source,Command::SplitBoundary {
        panel:source.panels[0].id.clone(),edge:"edge_1".into(),at_m:0.2,
    }).is_err());
    assert_eq!(serde_json::to_vec(&source).unwrap(),bytes);
}

#[test]
fn eased_correspondence_interpolates_cut_and_preserves_notches() {
    for reverse_b in [false,true] {
        for on_b in [false,true] {
            for partial in [false,true] {
                let mut source=fixture(reverse_b,on_b,partial);
                source.seams[0].allow_ease=true;
                source.seams[0].notches=vec![[0.2,0.1],[0.7,0.8]];
                source.compile().unwrap();
                let panel=source.panels[if on_b {1} else {0}].id.clone();
                let updated=authoring::apply(&source,Command::SplitBoundary {
                    panel,edge:"edge_1".into(),at_m:0.2,
                }).expect("eased monotone split").template;
                assert_eq!(updated.seams.len(),2);
                assert!(updated.seams.iter().all(|s|s.allow_ease));
                assert_eq!(updated.seams.iter().map(|s|s.notches.len()).sum::<usize>(),2);
                updated.compile().unwrap();
            }
        }
    }
}

#[test]
fn repeated_splits_preserve_sewn_edge_identity_without_overlapping_ranges() {
    let source = fixture(true,false,false);
    let panel = source.panels[0].id.clone();
    let first = authoring::apply(&source, Command::SplitBoundary {
        panel:panel.clone(),edge:"edge_1".into(),at_m:0.16,
    }).unwrap().template;
    assert_eq!(first.seams.len(),2);
    let second = authoring::apply(&first, Command::SplitBoundary {
        panel,edge:"edge_1_2".into(),at_m:0.12,
    }).unwrap().template;
    assert_eq!(second.seams.len(),3);
    let poly=second.panels[0].polygon.as_ref().unwrap();
    assert_eq!(poly.edges.len(),6);
    assert_eq!(poly.edges.iter().collect::<std::collections::BTreeSet<_>>().len(),6);
    assert_eq!(second.seams.iter().map(|s| &s.id).collect::<std::collections::BTreeSet<_>>().len(),3);
    second.compile().unwrap();
}

#[test]
fn splitting_a_sewn_cubic_preserves_original_curve_and_reference_ranges() {
    let mut source=fixture(false,false,false);
    for p in &mut source.panels {
        p.polygon.as_mut().unwrap().curves.insert("edge_1".into(),[
            DVec2::new(0.08,0.05), DVec2::new(0.31,0.06),
        ]);
    }
    source.compile().expect("identical source cubics remain sewing compatible");
    let panel=source.panels[0].id.clone();
    let original=source.panels[0].polygon.as_ref().unwrap().clone();
    let original_marks:Vec<_>=original.notches["edge_1"].iter()
        .map(|n|original.notch_segment("edge_1",n).unwrap()[0]).collect();
    let edge_length=authoring::edge_length(&original,"edge_1").unwrap();
    let result=authoring::apply(&source,Command::SplitBoundary {
        panel,edge:"edge_1".into(),at_m:edge_length*0.4,
    }).expect("sewn cubic boundary split must preserve garment");
    assert_eq!(result.template.seams.len(),2);
    let split=result.template.panels[0].polygon.as_ref().unwrap();
    assert!(split.curves.contains_key("edge_1"));
    assert!(split.curves.contains_key("edge_1_2"));
    let combined=authoring::edge_length(split,"edge_1").unwrap()+
        authoring::edge_length(split,"edge_1_2").unwrap();
    assert!((combined-edge_length).abs()<0.0005);
    let remapped_marks:Vec<_>=["edge_1","edge_1_2"].into_iter()
        .flat_map(|edge|split.notches.get(edge).into_iter().flatten()
            .map(move |n|split.notch_segment(edge,n).unwrap()[0])).collect();
    assert_eq!(remapped_marks.len(),2);
    for (before,after) in original_marks.iter().zip(remapped_marks.iter()) {
        assert!(before.distance(*after)<0.0001,"curved notch moved by over 0.1 mm");
    }
    result.template.compile().unwrap();
}

#[test]
fn substantive_sleeve_sewing_mismatch_still_fails_without_ease() {
    let mut source=fixture(false,false,false);
    // 0.1% of a 400 mm sewn edge is 0.4 mm. The numerical sampling tolerance
    // for remeshed curves is only 0.01 mm and must not hide this discrepancy.
    source.seams[0].b.range=[0.,0.999];
    assert!(source.compile().is_err(),"true sewing mismatch must not be waived");
}

#[test]
fn deleting_a_point_adjoining_a_remapped_seam_fails_closed() {
    let source=fixture(false,false,false);
    let panel=source.panels[0].id.clone();
    let split=authoring::apply(&source,Command::SplitBoundary {
        panel:panel.clone(),edge:"edge_1".into(),at_m:0.2,
    }).unwrap().template;
    let snapshot=serde_json::to_vec(&split).unwrap();
    assert!(authoring::apply(&split,Command::RemovePoint {panel,point:1}).is_err());
    assert_eq!(serde_json::to_vec(&split).unwrap(),snapshot);
}
