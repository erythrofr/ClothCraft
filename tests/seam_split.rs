use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        seam::{BoundaryRef, Side},
        shapes::Primitive,
    },
};

fn rectangle(replace: bool, origin: DVec2) -> Command {
    Command::Primitive {
        kind: Primitive::Rectangle,
        size: DVec2::new(0.4, 0.5),
        sweep_degrees: 180.,
        origin,
        meshing: MeshingSettings {
            target_edge_m: 0.09,
            ..Default::default()
        },
        fabric: "woven-demo".into(),
        replace,
    }
}

fn edge_ref(panel: &str) -> BoundaryRef {
    BoundaryRef {
        panel: panel.into(),
        edge: Some("edge_1".into()),
        side: Side::Top,
        range: [0., 1.],
        reversed: false,
    }
}

fn sew(t: &GarmentTemplate, a: &str, b: &str) -> GarmentTemplate {
    authoring::apply(
        t,
        Command::Sew {
            a: edge_ref(a),
            b: edge_ref(b),
            reverse: false,
            ease: false,
        },
    )
    .unwrap()
    .template
}

fn split(t: &GarmentTemplate, panel: &str) -> GarmentTemplate {
    authoring::apply(
        t,
        Command::SplitBoundary {
            panel: panel.into(),
            edge: "edge_1".into(),
            at_m: 0.1,
        },
    )
    .unwrap()
    .template
}

fn points(t: &GarmentTemplate, panel: &str) -> usize {
    t.panels
        .iter()
        .find(|p| p.id == panel)
        .and_then(|p| p.polygon.as_ref())
        .unwrap()
        .points
        .len()
}

#[test]
fn splitting_a_sewn_edge_turns_one_seam_into_two() {
    let t = authoring::apply(
        &GarmentTemplate::two_panel_demo(),
        rectangle(true, DVec2::ZERO),
    )
    .unwrap()
    .template;
    let t = authoring::apply(&t, rectangle(false, DVec2::new(0.6, 0.)))
        .unwrap()
        .template;
    let (a, b) = (t.panels[0].id.clone(), t.panels[1].id.clone());
    let sewn = sew(&t, &a, &b);
    let before = sewn.seams.len();
    let (a_points, b_points) = (points(&sewn, &a), points(&sewn, &b));
    let edited = split(&sewn, &a);
    assert_eq!(edited.seams.len(), before + 1);
    assert_eq!(points(&edited, &a), a_points + 1);
    assert_eq!(points(&edited, &b), b_points + 1);
    edited.compile().unwrap();
}

#[test]
fn splitting_a_sewn_edge_on_a_mirrored_piece_splits_both_seams() {
    let t = authoring::apply(
        &GarmentTemplate::two_panel_demo(),
        rectangle(true, DVec2::ZERO),
    )
    .unwrap()
    .template;
    let id = t.panels[0].id.clone();
    let t = authoring::apply(
        &t,
        Command::LinkedMirror {
            panel: id,
            axis: marvelous_cloth::garment::shapes::MirrorAxis::X,
        },
    )
    .unwrap()
    .template;
    let t = authoring::apply(&t, rectangle(false, DVec2::new(0.6, 0.)))
        .unwrap()
        .template;
    let t = authoring::apply(&t, rectangle(false, DVec2::new(1.2, 0.)))
        .unwrap()
        .template;
    let (p, mirror, q, q2) = (
        t.panels[0].id.clone(),
        t.panels[1].id.clone(),
        t.panels[2].id.clone(),
        t.panels[3].id.clone(),
    );
    let sewn = sew(&sew(&t, &p, &q), &mirror, &q2);
    let before = sewn.seams.len();
    let counts = [&p, &mirror, &q, &q2].map(|id| points(&sewn, id));
    let edited = split(&sewn, &p);
    // Each sewn pair becomes two: the mirror's seam splits at the mirrored point.
    assert_eq!(edited.seams.len(), before + 2);
    for (id, count) in [&p, &mirror, &q, &q2].into_iter().zip(counts) {
        assert_eq!(points(&edited, id), count + 1, "{id}");
    }
    edited.compile().unwrap();
}
