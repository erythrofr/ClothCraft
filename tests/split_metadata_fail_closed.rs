//! Regression: boundary splits must reject invalid saved cutline specifications.
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{polygon::EdgeNotch, presets::{self, GarmentKind}},
};

#[test]
fn corrupt_boundary_manufacturing_metadata_is_rejected_atomically() {
    let source = presets::basic(GarmentKind::Tshirt, 0);
    let panel = source.panels[0].id.clone();
    let edge = "hem";
    let at_m = authoring::edge_length(source.panels[0].polygon.as_ref().unwrap(), edge)
        .unwrap() * 0.4;

    for case in 0..5 {
        let mut malformed = source.clone();
        let polygon = malformed.panels[0].polygon.as_mut().unwrap();
        match case {
            0 => { polygon.seam_allowances.insert(edge.into(), -0.01); }
            1 => { polygon.target_lengths.insert(edge.into(), -0.02); }
            2 => { polygon.notches.insert(edge.into(), vec![EdgeNotch { t: -0.3, depth_m: 0.003 }]); }
            3 => { polygon.notches.insert(edge.into(), vec![EdgeNotch { t: 0.2, depth_m: -0.003 }]); }
            _ => { polygon.notches.insert(edge.into(), vec![EdgeNotch { t: 1.2, depth_m: 0.003 }]); }
        }
        let before = serde_json::to_vec(&malformed).unwrap();
        assert!(authoring::apply(&malformed, Command::SplitBoundary {
            panel: panel.clone(), edge: edge.into(), at_m,
        }).is_err(), "case {case} must reject invalid saved metadata");
        assert_eq!(serde_json::to_vec(&malformed).unwrap(), before);
    }
}
