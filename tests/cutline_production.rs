use glam::DVec2;
use marvelous_cloth::garment::{cutline::production_cutline, polygon::{PolygonPattern,EdgeNotch}};

fn panel() -> PolygonPattern {
    PolygonPattern { points:vec![DVec2::ZERO,DVec2::new(1.,0.),DVec2::ONE,DVec2::new(0.,1.)],edges:vec!["a".into(),"b".into(),"c".into(),"d".into()],subdivisions:0,meshing:None,curves:Default::default(),free_curve_points:Default::default(),vertex_ids:Default::default(),vertex_mirror_groups:Default::default(),holes:vec![],lines:vec![],target_lengths:Default::default(),notches:Default::default(),seam_allowances:[("a".into(),0.01),("b".into(),0.01),("c".into(),0.01),("d".into(),0.01)].into(),annotations:vec![],measurements:vec![] }
}
#[test] fn rectangle_ten_mm() {let c=production_cutline(&panel()).unwrap();assert_eq!(c.points.len(),4);assert!((c.area_m2-1.0404).abs()<1e-8);assert!((c.perimeter_m-4.08).abs()<1e-8);}
#[test] fn unequal_allowances() {let mut p=panel();p.seam_allowances.insert("a".into(),0.02);let c=production_cutline(&p).unwrap();assert!((c.area_m2-1.0506).abs()<1e-8);}
#[test] fn missing_allowance_fails() {let mut p=panel();p.seam_allowances.remove("b");assert!(production_cutline(&p).unwrap_err().contains("Missing"));}
#[test] fn crossing_fails() {let mut p=panel();p.points.swap(1,2);assert!(production_cutline(&p).is_err());}
#[test] fn nonfinite_fails() {let mut p=panel();p.points[0].x=f64::NAN;assert!(production_cutline(&p).is_err());}
#[test] fn concave_panel() {let mut p=panel();p.points=vec![DVec2::ZERO,DVec2::new(1.,0.),DVec2::new(1.,1.),DVec2::new(0.5,0.5),DVec2::new(0.,1.)];p.edges.push("e".into());p.seam_allowances.insert("e".into(),0.01);assert!(production_cutline(&p).is_ok());}
#[test] fn straight_quarter_station_notch() {let mut p=panel();p.notches.insert("a".into(),vec![EdgeNotch{t:0.25,depth_m:0.005}]);let c=production_cutline(&p).unwrap();assert_eq!(c.notches.len(),1);let n=&c.notches[0];assert_eq!(n.edge_id,"a");assert!((n.cut_start.x-0.25).abs()<1e-9);assert!((n.cut_start.y+0.01).abs()<1e-9);assert!((n.inner_end.y+0.005).abs()<1e-9);assert_eq!(c.points.len(),4);}
#[test] fn notch_too_deep_is_rejected() {let mut p=panel();p.notches.insert("a".into(),vec![EdgeNotch{t:0.25,depth_m:0.011}]);assert!(production_cutline(&p).unwrap_err().contains("exceeds allowance"));}
#[test] fn multiple_notches_preserve_stations() {let mut p=panel();p.notches.insert("a".into(),vec![EdgeNotch{t:0.25,depth_m:0.004},EdgeNotch{t:0.75,depth_m:0.006}]);let c=production_cutline(&p).unwrap();assert_eq!(c.notches.len(),2);assert!((c.notches[1].cut_start.x-0.75).abs()<1e-9);assert!(serde_json::to_value(&c).unwrap().get("notches").unwrap().is_array());}
#[test] fn duplicate_notch_station_rejected() {let mut p=panel();p.notches.insert("a".into(),vec![EdgeNotch{t:0.25,depth_m:0.004},EdgeNotch{t:0.25,depth_m:0.006}]);assert!(production_cutline(&p).is_err());}
#[test] fn mild_curved_edge_notch() {let mut p=panel();p.curves.insert("a".into(),[DVec2::new(0.33,-0.002),DVec2::new(0.67,-0.002)]);p.notches.insert("a".into(),vec![EdgeNotch{t:0.5,depth_m:0.004}]);let c=production_cutline(&p).unwrap();assert_eq!(c.notches[0].edge_id,"a");assert!((c.notches[0].cut_start.x-0.5).abs()<0.002);}
