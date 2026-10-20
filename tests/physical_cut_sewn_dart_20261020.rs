//! Physical cut-and-sewn dart prototype: an actual V intake in a native
//! 2D contour, two solver-coupled garment seam legs and native undo.
//! This does not claim to simulate an uncut folded tuck.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{meshing::MeshingSettings,presets::{self,GarmentKind}},
};

fn rectangle()->marvelous_cloth::garment::GarmentTemplate{
    authoring::apply(&presets::basic(GarmentKind::Tshirt,0),Command::Polygon{
        points:vec![DVec2::ZERO,DVec2::new(0.3,0.),DVec2::new(0.3,0.2),DVec2::new(0.,0.2)],
        tangents:vec![],meshing:MeshingSettings::default(),
        fabric:"woven-reference".into(),replace:true,
    }).unwrap().template
}
fn dart(panel:&str,edge:&str,left:f64,right:f64,apex:DVec2)->Command{
    Command::DartCutSew{panel:panel.into(),edge:edge.into(),left_t:left,right_t:right,apex}
}

#[test]
fn real_dart_adds_two_solver_seam_legs_and_reduces_rest_area(){
    let source=rectangle();
    let panel=source.panels[0].id.clone();
    let edge=source.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    let source_area: f64=0.3*0.2;
    let original=serde_json::to_vec(&source).unwrap();
    let edit=authoring::apply(&source,dart(&panel,&edge,0.35,0.45,DVec2::new(0.12,0.08))).unwrap();
    let polygon=edit.template.panels[0].polygon.as_ref().unwrap();
    assert_eq!(polygon.points.len(),7);
    assert_eq!(polygon.edges.len(),7);
    assert_eq!(edit.template.seams.len(),1);
    let seam=&edit.template.seams[0];
    assert!(seam.id.starts_with("dart_"));
    assert_eq!(seam.a.panel,panel);
    assert_eq!(seam.b.panel,panel);
    assert!(seam.reverse_b);
    assert_eq!(edit.garment.seams.len(),1,"the physical solver must receive the dart leg joining constraint");
    assert!(!edit.garment.seams[0].samples.is_empty());
    let positions=&edit.garment.initial_state.x;
    let max_gap=edit.garment.seams[0].max_gap(positions);
    let rms_gap=edit.garment.seams[0].rms_gap(positions);
    assert!(max_gap>0.01,"the authored intake is genuinely open in initial 3D");
    assert!(rms_gap>0. && rms_gap<=max_gap+1e-10,
        "length-weighted RMS must be bounded by physical seam maximum");
    assert_ne!(edit.garment.mesh.uv,source.compile().unwrap().mesh.uv,
        "physical rest coordinates must rebuild, though triangulation may use the same vertex count");
    let mut twice_area=0.;
    for i in 0..polygon.points.len(){twice_area+=polygon.points[i].perp_dot(polygon.points[(i+1)%polygon.points.len()]);}
    let area=twice_area/2.;
    assert!(area<source_area);
    assert!((source_area-area-0.0012).abs()<1e-9,"0.03 m intake × 0.08 m dart depth / 2 removed");
    let stored=serde_json::to_vec(&edit.template).unwrap();
    let loaded:marvelous_cloth::garment::GarmentTemplate=serde_json::from_slice(&stored).unwrap();
    assert_eq!(loaded.seams.len(),1);
    assert!(loaded.compile().is_ok());
    let mut history=History::default();history.record(source);
    let undone=history.restore(&edit.template,false).unwrap();
    assert_eq!(serde_json::to_vec(&undone.template).unwrap(),original);
}

#[test]
fn invalid_dart_is_rejected_atomically(){
    let source=rectangle();
    let old=serde_json::to_vec(&source).unwrap();
    let panel=&source.panels[0].id;
    let edge=&source.panels[0].polygon.as_ref().unwrap().edges[0];
    for (a,b,tip) in [
        (0.35,0.35,DVec2::new(0.105,0.08)),
        (0.35,0.45,DVec2::new(0.12,0.0)),
        (0.35,0.45,DVec2::new(0.15,0.08)),
        (0.005,0.09,DVec2::new(0.01425,0.08)),
        (f64::NAN,0.45,DVec2::new(0.12,0.08)),
    ] {
        assert!(authoring::apply(&source,dart(panel,edge,a,b,tip)).is_err());
        assert_eq!(serde_json::to_vec(&source).unwrap(),old);
    }
}

#[test]
fn inherited_allowances_generate_physical_dart_cutline_proof_or_fail_closed(){
    let source=rectangle();
    let panel=source.panels[0].id.clone();
    let polygon=source.panels[0].polygon.as_ref().unwrap();
    let edge=polygon.edges[0].clone();
    let mut annotated=source.clone();
    for name in &polygon.edges {
        annotated=authoring::apply(&annotated,Command::SeamAllowance{
            panel:panel.clone(),edge:name.clone(),width_m:0.01,
        }).unwrap().template;
    }
    let edit=authoring::apply(&annotated,dart(&panel,&edge,0.35,0.45,DVec2::new(0.12,0.08))).unwrap();
    let dart_poly=edit.template.panels[0].polygon.as_ref().unwrap();
    assert_eq!(dart_poly.seam_allowances.len(),dart_poly.edges.len());
    assert!(dart_poly.edges.iter().all(|edge| dart_poly.seam_allowances[edge]==0.01));
    let actual=marvelous_cloth::garment::cutline::production_cutline(dart_poly);
    assert!(actual.is_ok(),"all allowances assigned; cutline failure should be diagnosed: {actual:?}");
}

#[test]
fn sewn_tshirt_boundary_rejects_dart_without_mutating_original_garment(){
    let garment=presets::basic(GarmentKind::Tshirt,0);
    let before=serde_json::to_vec(&garment).unwrap();
    assert!(garment.seams.iter().any(|s|s.a.edge.as_deref()==Some("side-right")));
    let rejected=authoring::apply(&garment,dart("front","side-right",0.3,0.4,DVec2::new(0.1,0.2)));
    assert!(rejected.is_err(),"do not allow a dart to silently destroy an existing seam");
    assert_eq!(serde_json::to_vec(&garment).unwrap(),before);
}
