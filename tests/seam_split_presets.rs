//! Diagnostic: split every named boundary of the shipped presets at its middle and
//! report what happens, so failures can be seen rather than guessed at.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, edge_length},
    garment::{
        GarmentTemplate,
        presets::{self, GarmentKind},
    },
};

fn split_report(kind: GarmentKind) -> Vec<String> {
    let t = presets::basic(kind, 0);
    let mut lines = Vec::new();
    for panel in ["front", "back"] {
        let polygon = t
            .panels
            .iter()
            .find(|p| p.id == panel)
            .and_then(|p| p.polygon.clone())
            .unwrap();
        for edge in polygon.edges.clone() {
            let length = edge_length(&polygon, &edge).unwrap();
            let result = authoring::apply(
                &t,
                Command::SplitBoundary {
                    panel: panel.into(),
                    edge: edge.clone(),
                    at_m: length * 0.5,
                },
            );
            let outcome = match result {
                Err(error) => format!("REFUSED: {error}"),
                Ok(edit) => match edit.template.compile() {
                    Ok(_) => format!("ok, seams {}", edit.template.seams.len()),
                    Err(error) => format!("COMPILE FAILS: {error}"),
                },
            };
            lines.push(format!("{:?} {panel}/{edge}: {outcome}", kind));
        }
    }
    lines
}

#[test]
fn report_splits_on_presets() {
    for kind in [GarmentKind::Tshirt, GarmentKind::Dress] {
        for line in split_report(kind) {
            eprintln!("{line}");
        }
    }
}

#[test]
fn untouched_presets_compile() {
    for kind in [GarmentKind::Tshirt, GarmentKind::Dress] {
        let t: GarmentTemplate = presets::basic(kind, 0);
        t.compile().unwrap();
        let _ = DVec2::ZERO;
    }
}
