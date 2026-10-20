//! Live native Shape authoring contract for independent cutline curve points.
//! No user project or fixture is changed; tests use in-memory garments.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        polygon::FreeCurvePoint,
        presets::{self, GarmentKind},
        GarmentTemplate,
    },
};

fn add_shape(source:&GarmentTemplate, panel_id:&str, y_delta:f64)->GarmentTemplate {
    let panel=source.panels.iter().find(|p|p.id==panel_id).unwrap();
    let mut polygon=panel.polygon.as_ref().unwrap().clone();
    let index=polygon.edges.iter().position(|e|e=="hem").unwrap();
    let a=polygon.points[index];
    let b=polygon.points[(index+1)%polygon.points.len()];
    let position=a.lerp(b,0.5)+DVec2::new(0.,y_delta);
    polygon.free_curve_points.insert("hem".into(),vec![
        FreeCurvePoint{id:"free_1".into(),t:0.5,position,mirror_group:None,derivative:None, derivative_in:None, derivative_out:None,}
    ]);
    authoring::apply(source,Command::Shape{panel:panel_id.into(),polygon})
        .expect("valid free control must compile").template
}

#[test]
fn add_move_undo_redo_roundtrip_preserves_sides_and_seam_graph() {
    let source=presets::basic(GarmentKind::Tshirt,0);
    let panel=source.panels[0].id.clone();
    let baseline=source.panels[0].polygon.as_ref().unwrap();
    let original_edges=baseline.edges.clone();
    let original_seams=serde_json::to_value(&source.seams).unwrap();
    let original_length=authoring::edge_length(baseline,"hem").unwrap();
    let inserted=add_shape(&source,&panel,0.);
    assert!((authoring::edge_length(inserted.panels[0].polygon.as_ref().unwrap(),"hem").unwrap()-original_length).abs()<1e-9);
    let bent=add_shape(&inserted,&panel,0.018);
    assert!(authoring::edge_length(bent.panels[0].polygon.as_ref().unwrap(),"hem").unwrap()>original_length+0.0001);
    assert_eq!(bent.panels[0].polygon.as_ref().unwrap().edges,original_edges);
    assert_eq!(serde_json::to_value(&bent.seams).unwrap(),original_seams);
    let reopened:GarmentTemplate=serde_json::from_slice(&serde_json::to_vec(&bent).unwrap()).unwrap();
    assert!(reopened.compile().is_ok());
    let mut history=History::default();
    history.record(inserted.clone());
    let undone=history.restore(&bent,false).unwrap().template;
    assert_eq!(serde_json::to_value(&undone).unwrap(),serde_json::to_value(&inserted).unwrap());
    let redone=history.restore(&undone,true).unwrap().template;
    assert_eq!(serde_json::to_value(&redone).unwrap(),serde_json::to_value(&bent).unwrap());
    history.record(source.clone());
    let without_point=history.restore(&inserted,false).unwrap().template;
    assert_eq!(serde_json::to_value(&without_point).unwrap(),serde_json::to_value(&source).unwrap());
}

#[test]
fn splitting_a_free_curve_edge_preserves_geometry_and_undo() {
    let source=presets::basic(GarmentKind::Tshirt,0);
    let panel=source.panels[0].id.clone();
    let decorated=add_shape(&source,&panel,0.014);
    let before=serde_json::to_vec(&decorated).unwrap();
    let edge=decorated.panels[0].polygon.as_ref().unwrap();
    let length=authoring::edge_length(edge,"hem").unwrap();
    let result=authoring::apply(&decorated,Command::SplitBoundary{
        panel,edge:"hem".into(),at_m:length*0.38
    }).expect("independent curve point should migrate").template;
    let polygon=result.panels[0].polygon.as_ref().unwrap();
    assert_eq!(polygon.edges.len(),decorated.panels[0].polygon.as_ref().unwrap().edges.len()+1);
    assert_eq!(polygon.free_curve_points.values().map(Vec::len).sum::<usize>(),1);
    let restored:GarmentTemplate=serde_json::from_slice(&serde_json::to_vec(&result).unwrap()).unwrap();
    restored.compile().expect("migrated curve point remains manufacturable");
    assert_eq!(serde_json::to_vec(&decorated).unwrap(),before);
    assert!(decorated.compile().is_ok());
}

#[test]
fn split_keeps_both_asymmetric_handles_and_exact_hermite_geometry() {
    let source = presets::basic(GarmentKind::Tshirt, 0);
    let panel = source.panels[0].id.clone();
    let mut poly = source.panels[0].polygon.as_ref().unwrap().clone();
    let edge = "hem";
    let index = poly.edges.iter().position(|name| name == edge).unwrap();
    let a = poly.points[index];
    let b = poly.points[(index + 1) % poly.points.len()];
    let direction = b - a;
    poly.free_curve_points.insert(edge.into(), vec![FreeCurvePoint {
        id: "sharp-control".into(), t: 0.58, position: a.lerp(b, 0.58) + DVec2::new(0., 0.007),
        derivative: None,
        derivative_in: Some(direction + DVec2::new(0., 0.045)),
        derivative_out: Some(direction + DVec2::new(0., -0.035)),
        mirror_group: None,
    }]);
    let shaped = authoring::apply(&source, Command::Shape {
        panel: panel.clone(), polygon: poly,
    }).unwrap().template;
    let before = shaped.panels[0].polygon.as_ref().unwrap();
    let initial_spans = before.edge_cubic_spans(index).unwrap();
    let original_length = authoring::edge_length(before, edge).unwrap();
    let updated = authoring::apply(&shaped, Command::SplitBoundary {
        panel, edge: edge.into(), at_m: original_length * 0.31,
    }).expect("split before sharp knot must preserve both tangent sides").template;
    let after = updated.panels[0].polygon.as_ref().unwrap();
    let remaining: Vec<_> = after.free_curve_points.values().flatten()
        .filter(|k| k.id == "sharp-control").collect();
    assert_eq!(remaining.len(), 1);
    let knot = remaining[0];
    let tangent_in = knot.derivative_in.unwrap();
    let tangent_out = knot.derivative_out.unwrap();
    assert!((tangent_in - tangent_out).length() > 0.01,
        "a corner must keep two distinct tangent handles after reparameterization");
    let original = &before.free_curve_points[edge][0];
    let scaled = 1. - (original.t - knot.t) / (1. - knot.t);
    assert!((tangent_in - original.derivative_in.unwrap() * scaled).length() < 1e-8);
    assert!((tangent_out - original.derivative_out.unwrap() * scaled).length() < 1e-8);
    assert_eq!(initial_spans.len(), 2);
    updated.compile().unwrap();
    let persisted: GarmentTemplate = serde_json::from_slice(&serde_json::to_vec(&updated).unwrap()).unwrap();
    assert_eq!(serde_json::to_vec(&persisted).unwrap(), serde_json::to_vec(&updated).unwrap());
}
