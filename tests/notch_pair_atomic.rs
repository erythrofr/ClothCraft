//! Paired cutline notches are one metric, history-safe manufacturing edit.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{meshing::MeshingSettings, presets::{self, GarmentKind}},
};

fn fixture() -> marvelous_cloth::garment::GarmentTemplate {
    authoring::apply(
        &presets::basic(GarmentKind::Tshirt, 0),
        Command::Polygon {
            points: vec![
                DVec2::ZERO, DVec2::new(0.2, 0.),
                DVec2::new(0.2, 0.1), DVec2::new(0., 0.1),
            ],
            tangents: vec![],
            meshing: MeshingSettings::default(),
            fabric: "woven-reference".into(), replace: true,
        },
    ).unwrap().template
}

#[test]
fn double_notch_is_one_atomic_metric_history_step() {
    let mut garment=fixture();
    let panel=garment.panels[0].id.clone();
    let edge=garment.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    let before=serde_json::to_vec(&garment).unwrap();
    let transaction=Command::NotchPair {
        panel:panel.clone(),edge:edge.clone(),center_t:0.5,spacing_m:0.006,depth_m:0.004,
    };
    let edit=authoring::apply(&garment, transaction).unwrap();
    let marks=&edit.template.panels[0].polygon.as_ref().unwrap().notches[&edge];
    assert_eq!(marks.len(),2);
    assert!((marks[0].t-0.485).abs()<1e-9);
    assert!((marks[1].t-0.515).abs()<1e-9);
    assert!(((marks[1].t-marks[0].t)*0.2-0.006).abs()<1e-10);
    assert_eq!(marks[0].depth_m,0.004);
    assert_eq!(marks[1].depth_m,0.004);
    let mut history=History::default();
    history.record(garment.clone());
    let undone=history.restore(&edit.template,false).unwrap();
    assert_eq!(serde_json::to_vec(&undone.template).unwrap(),before);
    assert!(!history.can_undo(),"one undo must clear both marks");
    let redone=history.restore(&undone.template,true).unwrap();
    assert_eq!(serde_json::to_vec(&redone.template).unwrap(),
               serde_json::to_vec(&edit.template).unwrap());
    garment=redone.template;
    let saved=serde_json::to_vec(&garment).unwrap();
    let reloaded:marvelous_cloth::garment::GarmentTemplate=serde_json::from_slice(&saved).unwrap();
    assert_eq!(reloaded.panels[0].polygon.as_ref().unwrap().notches[&edge],*marks);
}

#[test]
fn malformed_double_notch_fails_without_any_partial_mark() {
    let garment=fixture();
    let original=serde_json::to_vec(&garment).unwrap();
    let panel=garment.panels[0].id.clone();
    let edge=garment.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    for (t,spacing,depth) in [
        (0.001,0.006,0.004),(0.999,0.006,0.004),(0.5,0.,0.004),
        (0.5,0.21,0.004),(0.5,0.006,0.),(f64::NAN,0.006,0.004),
    ] {
        assert!(authoring::apply(&garment,Command::NotchPair {
            panel:panel.clone(),edge:edge.clone(),
            center_t:t,spacing_m:spacing,depth_m:depth,
        }).is_err(),"invalid notch {t:?} {spacing:?} {depth:?}");
        assert_eq!(serde_json::to_vec(&garment).unwrap(),original);
    }
}
