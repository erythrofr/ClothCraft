//! EXO adapter: one persistent upstream document, authoring history and VBD/OGC solver.
use marvelous_cloth::{authoring::{self,Command,History}, fitting::{FittingProject,FittingScene,PrintGraphic,ImportedHardware}, garment::{presets::GarmentKind, shapes::{Primitive,MirrorAxis,BooleanOp}, meshing::MeshingSettings}, vbd::{Grab,VbdSolver,VbdSettings}};
use serde::{de::DeserializeOwned};
use serde_json::{Value,json};
use glam::{DVec2,DVec3,DQuat,EulerRot};
use std::{io::{self,BufRead,Write},path::PathBuf,sync::Arc};
fn field<T:DeserializeOwned>(v:&Value,k:&str)->Result<T,String>{serde_json::from_value(v.get(k).cloned().ok_or(format!("Missing {k}"))?).map_err(|e|e.to_string())}
fn command(v:&Value)->Result<Command,String>{
 let op=v["kind"].as_str().ok_or("Missing command kind")?;
 macro_rules! f {($k:literal)=>{field(v,$k)?}}
 Ok(match op {
 "Primitive"=>Command::Primitive{kind:match v["shape"].as_str(){Some("ellipse")=>Primitive::Ellipse,Some("sector")=>Primitive::Sector,_=>Primitive::Rectangle},size:f!("size"),sweep_degrees:v["sweep_degrees"].as_f64().unwrap_or(180.),origin:f!("origin"),meshing:MeshingSettings::default(),fabric:f!("fabric"),replace:false},
 "Polygon"=>Command::Polygon{points:f!("points"),tangents:field(v,"tangents").unwrap_or_default(),meshing:MeshingSettings::default(),fabric:f!("fabric"),replace:false},
 "Anchor"=>Command::Anchor{panel:f!("panel"),anchor:f!("anchor"),position:f!("position")},
 "MovePoints"=>Command::MovePoints{panel:f!("panel"),points:f!("points"),delta:f!("delta")},
 "Nudge"=>Command::Nudge{panel:f!("panel"),points:f!("points"),delta_mm:f!("delta_mm")},
 "SetMeasurement"=>Command::SetMeasurement{panel:f!("panel"),measurement:f!("measurement")},
 "RemoveMeasurement"=>Command::RemoveMeasurement{panel:f!("panel"),id:f!("id")},
 "Dimensions"=>Command::Dimensions{panel:f!("panel"),width:f!("width"),height:f!("height")},
 "Shape"=>Command::Shape{panel:f!("panel"),polygon:f!("polygon")},
 "SplitBoundary"=>Command::SplitBoundary{panel:f!("panel"),edge:f!("edge"),at_m:f!("at_m")},
 "DartCutSew"=>Command::DartCutSew{panel:f!("panel"),edge:f!("edge"),left_t:f!("left_t"),right_t:f!("right_t"),apex:f!("apex")},
 "RemovePoint"=>Command::RemovePoint{panel:f!("panel"),point:f!("point")},
 "CurvePoint"=>Command::CurvePoint{panel:f!("panel"),anchor:f!("anchor"),curved:f!("curved")},
 "TargetLength"=>Command::TargetLength{panel:f!("panel"),edge:f!("edge"),target_m:f!("target_m")},
 "Notch"=>Command::Notch{panel:f!("panel"),edge:f!("edge"),t:f!("t"),depth_m:f!("depth_m")},
 "NotchPair"=>Command::NotchPair{panel:f!("panel"),edge:f!("edge"),center_t:f!("center_t"),spacing_m:f!("spacing_m"),depth_m:f!("depth_m")},
 "RemoveNotch"=>Command::RemoveNotch{panel:f!("panel"),edge:f!("edge"),t:f!("t")},
 "SeamAllowance"=>Command::SeamAllowance{panel:f!("panel"),edge:f!("edge"),width_m:f!("width_m")},
 "BoardTransform"=>Command::BoardTransform{panel:f!("panel"),origin:f!("origin"),rotation_degrees:f!("rotation_degrees")},
 "Place"=>Command::Place{panel:f!("panel"),placement:f!("placement")},
 "Duplicate"=>Command::Duplicate{panel:f!("panel")},
 "RemovePanel"=>Command::RemovePanel{panel:f!("panel")},
 "Sew"=>Command::Sew{a:f!("a"),b:f!("b"),reverse:f!("reverse"),ease:f!("ease")},
 "RemoveSeam"=>Command::RemoveSeam{seam:f!("seam")},
 "Fabric"=>Command::Fabric{panel:f!("panel"),name:f!("name"),properties:f!("properties"),all_panels:f!("all_panels")},
 "Mirror"=>Command::Mirror{panel:f!("panel"),axis:if v["axis"]=="y"{MirrorAxis::Y}else{MirrorAxis::X},copy_side:field(v,"copy_side").unwrap_or(None)},
 "Boolean"=>Command::Boolean{a:f!("a"),b:f!("b"),op:match v["operation"].as_str(){Some("difference")=>BooleanOp::Difference,Some("intersection")=>BooleanOp::Intersection,_=>BooleanOp::Union},keep_tool:f!("keep_tool")},
 "InternalLine"=>Command::InternalLine{panel:f!("panel"),points:f!("points"),tangents:field(v,"tangents").unwrap_or_default()},
 "RemoveLine"=>Command::RemoveLine{panel:f!("panel"),line:f!("line")},
 "Ruffle"=>Command::Ruffle{panel:f!("panel"),line:f!("line"),width:f!("width"),ratio:f!("ratio")},
 "Annotation"=>Command::Annotation{panel:f!("panel"),id:field(v,"id").unwrap_or(None),text:f!("text"),position:f!("position")},
 "RemoveAnnotation"=>Command::RemoveAnnotation{panel:f!("panel"),id:f!("id")},
 _=>return Err(format!("Unsupported authoring command {op}")),
 })
}
#[cfg(test)]
mod native_adapter_nudge_tests {
 use super::*;
 #[test]
 fn numeric_nudge_preserves_explicit_material_millimetres(){
  let value=json!({"kind":"Nudge","panel":"front","points":[0,2],"delta_mm":[1.5,-2.25]});
  match command(&value).expect("Native Nudge authoring must be exposed"){
   Command::Nudge{panel,points,delta_mm}=>{
    assert_eq!(panel,"front");
    assert_eq!(points,vec![0,2]);
    assert_eq!(delta_mm,DVec2::new(1.5,-2.25));
   },
   _=>panic!("Native millimetre Nudge was decoded as another operation"),
  }
 }
 #[test]
 fn nudge_rejects_missing_metric_delta_or_missing_selection(){
  assert!(command(&json!({"kind":"Nudge","panel":"front","points":[0]})).is_err());
  assert!(command(&json!({"kind":"Nudge","panel":"front","delta_mm":[1.0,2.0]})).is_err());
 }
}
/// Apply a measured two-axis grade to a simple material-space pattern.
/// Named edges and point indices stay stable for sewing and undo.
fn graded_polygon(source:&marvelous_cloth::garment::polygon::PolygonPattern, width_delta_mm:f64, height_delta_mm:f64)->Result<marvelous_cloth::garment::polygon::PolygonPattern,String>{
 if ![width_delta_mm,height_delta_mm].iter().all(|v|v.is_finite() && v.abs()<=500.) {return Err("Grade increments must be finite and within ±500 mm".into())}
 if !source.holes.is_empty() || !source.lines.is_empty() {return Err("Grading currently requires no holes or internal lines; use a pattern-specific grading rule to preserve those references".into())}
 if source.points.len()<3 {return Err("Grading requires a polygon with at least three points".into())}
 // True dimension bounds include curve lobes outside their end vertices.
 // Use the same 0.25 mm conservative flattened boundary as native sewing
 // and material metrics; grading by polygon corners alone misses the lobes.
 let mut min=DVec2::splat(f64::INFINITY);
 let mut max=DVec2::splat(f64::NEG_INFINITY);
 for edge_index in 0..source.edges.len(){
  for p in source.edge_points(edge_index)? {
   min=min.min(p);
   max=max.max(p);
  }
 }
 let size=max-min;
 if !min.is_finite() || !max.is_finite() || size.min_element()<=1e-6 {return Err("Cannot grade a degenerate pattern".into())}
 let new_size=size+DVec2::new(width_delta_mm,height_delta_mm)/1000.;
 if new_size.min_element()<0.001 || new_size.max_element()>10. {return Err("Graded dimensions must be between 1 mm and 10 m".into())}
 let scale=new_size/size;
 let center=(min+max)*0.5;
 let mut result=source.clone();
 for point in &mut result.points {*point=center+(*point-center)*scale;}
 // Scale the actual native cubic controls and independent free curve anchors,
 // not a display polyline. This preserves analytic sewing edges and their
 // identity under grading, with the same affine mapping on every dependent
 // curve control. Notch depth and allowance width remain physical millimetres.
 for controls in result.curves.values_mut(){
  for point in controls.iter_mut(){*point=center+(*point-center)*scale;}
 }
 for free_points in result.free_curve_points.values_mut(){
  for point in free_points {
   point.position=center+(point.position-center)*scale;
   // These are material derivatives, not absolute anchor positions.
   // Non-uniform grade scaling must also transform *both* independently
   // adjustable handles; otherwise the Bézier profile changes on reload.
   for derivative in [&mut point.derivative,&mut point.derivative_in,&mut point.derivative_out] {
    if let Some(value)=derivative.as_mut(){*value *=scale;}
   }
  }
 }
 for annotation in &mut result.annotations {
  annotation.position=center+(annotation.position-center)*scale;
 }
 // Grade edge-length specifications by the actual graded physical arclength,
 // not by one Cartesian axis; this also works for anisotropically curved edges.
 // Keep the named target reference and its proportional design ease instead
 // of silently deleting an authored manufacturing constraint.
 let graded_targets=result.target_lengths.clone();
 for (edge,target) in graded_targets {
  if !target.is_finite()||target<=0. {
   return Err(format!("Cannot grade invalid target length on boundary {edge}"));
  }
  let index=source.edges.iter().position(|name|name==&edge)
   .ok_or(format!("Cannot grade a target referring to unknown boundary {edge}"))?;
  let physical_length=|p:&marvelous_cloth::garment::polygon::PolygonPattern|->Result<f64,String>{
   let points=p.edge_points(index)?;
   Ok(points.windows(2).map(|pair|pair[0].distance(pair[1])).sum::<f64>())
  };
  let old_len=physical_length(source)?;
  let next_len=physical_length(&result)?;
  if old_len<=1e-9 || !old_len.is_finite() || !next_len.is_finite() {
   return Err(format!("Cannot grade degenerate target boundary {edge}"));
  }
  result.target_lengths.insert(edge,target*(next_len/old_len));
 }
 Ok(result)
}
/// Drafting marks only: three parallel guides strictly inside a rectangular contour.
fn pleat_guide_points(source:&marvelous_cloth::garment::polygon::PolygonPattern,orientation:&str,spacing_mm:f64,inset_mm:f64)->Result<Vec<[DVec2;2]>,String>{
 if !spacing_mm.is_finite() || !(5.0..=100.0).contains(&spacing_mm) || !inset_mm.is_finite() || !(5.0..=50.0).contains(&inset_mm) {return Err("Pleat spacing must be 5–100 mm and inset 5–50 mm".into())}
 if !source.curves.is_empty() || !source.holes.is_empty() || source.points.len()!=4 {return Err("Pleat guides require a straight axis-aligned rectangular polygon without holes".into())}
 let min=source.points.iter().copied().fold(DVec2::splat(f64::INFINITY),|a,b|a.min(b));
 let max=source.points.iter().copied().fold(DVec2::splat(f64::NEG_INFINITY),|a,b|a.max(b));
 if !min.is_finite() || !max.is_finite() {return Err("Invalid rectangle points".into())}
 let tol=1e-8;
 let mut corners=std::collections::HashSet::new();
 for p in &source.points {
  let x=if (p.x-min.x).abs()<tol {0} else if (p.x-max.x).abs()<tol {1} else {return Err("Contour is not an axis-aligned rectangle".into())};
  let y=if (p.y-min.y).abs()<tol {0} else if (p.y-max.y).abs()<tol {1} else {return Err("Contour is not an axis-aligned rectangle".into())};
  if !corners.insert((x,y)) {return Err("Rectangle contains duplicate corners".into())}
 }
 if corners.len()!=4 {return Err("Rectangle requires four distinct corners".into())}
 let spacing=spacing_mm/1000.;let inset=inset_mm/1000.;
 let vertical=match orientation {"vertical"=>true,"horizontal"=>false,_=>return Err("Pleat orientation must be vertical or horizontal".into())};
 let across=if vertical {max.x-min.x}else{max.y-min.y};
 let along=if vertical {max.y-min.y}else{max.x-min.x};
 if across<=2.*(inset+spacing) || along<=2.*inset {return Err("All three fold guides must fit strictly inside the rectangle".into())}
 let center=if vertical {(min.x+max.x)*0.5}else{(min.y+max.y)*0.5};
 Ok([-1.,0.,1.].into_iter().map(|i|{
  let v=center+i*spacing;
  if vertical {[DVec2::new(v,min.y+inset),DVec2::new(v,max.y-inset)]}else{[DVec2::new(min.x+inset,v),DVec2::new(max.x-inset,v)]}
 }).collect())
}
/// Read-only, Rust-authoritative rest-space pattern diagnostics. These are
/// stitchline dimensions, NOT offset factory cutlines or approved grade rules.
/// All figures are derived from the same material-space curves used by the
/// native sewing mesh; display code never recomputes them from SVG pixels.
fn pattern_factory_audit(template:&marvelous_cloth::garment::template::GarmentTemplate,revision:u64)->Result<Value,String>{
 let mut panels=Vec::new();
 let mut warnings=Vec::<String>::new();
 let mut lengths=std::collections::BTreeMap::<(String,String),f64>::new();
 let mut polygon_count=0usize;
 for panel in &template.panels {
  let Some(polygon)=panel.polygon.as_ref() else {
   warnings.push(format!("{} has no editable polygon contour",panel.name));
   panels.push(json!({"panelId":panel.id,"name":panel.name,"editable":false}));
   continue;
  };
  polygon_count+=1;
  let mut outline=Vec::<DVec2>::new();
  let mut edges=Vec::new();
  for (i,edge) in polygon.edges.iter().enumerate(){
   let points=polygon.edge_points(i)?;
   if points.len()<2 || points.iter().any(|point|!point.is_finite()){
    return Err(format!("Invalid sampled geometry on {} / {}",panel.id,edge))
   }
   let length:f64=points.windows(2).map(|w|w[0].distance(w[1])).sum();
   if !length.is_finite()||length<=1e-8 {return Err(format!("Collapsed boundary {} / {}",panel.id,edge));}
   lengths.insert((panel.id.clone(),edge.clone()),length);
   outline.extend_from_slice(&points[..points.len()-1]);
   let marks=polygon.notches.get(edge).map_or(0,Vec::len);
   if let Some(notches)=polygon.notches.get(edge){
    for notch in notches {polygon.notch_segment(edge,notch)?;}
   }
   let allowance=polygon.seam_allowances.get(edge).copied();
   let target=polygon.target_length(edge);
   if let Some(spec)=target {
    let delta_mm=(length-spec).abs()*1000.;
    if delta_mm>0.5 {warnings.push(format!("{} / {} target length differs from rest boundary by {:.2} mm",panel.name,edge,delta_mm));}
   }
   edges.push(json!({"edgeId":edge,"lengthMm":length*1000.,"curve":polygon.curves.contains_key(edge)||polygon.free_curve_points.contains_key(edge),"notchCount":marks,"allowanceMm":allowance.map(|value|value*1000.),"targetMm":target.map(|value|value*1000.)}));
  }
  if outline.len()<3{return Err(format!("Pattern {} has too few contour points",panel.id));}
  let mut signed_area=0f64;
  for i in 0..outline.len(){signed_area+=outline[i].perp_dot(outline[(i+1)%outline.len()])*0.5;}
  if !signed_area.is_finite()||signed_area<=1e-8{return Err(format!("Pattern {} has invalid contour area",panel.id));}
  let min=outline.iter().copied().fold(DVec2::splat(f64::INFINITY),|a,b|a.min(b));
  let max=outline.iter().copied().fold(DVec2::splat(f64::NEG_INFINITY),|a,b|a.max(b));
  let without_allowance=polygon.edges.iter().filter(|edge|!polygon.seam_allowances.contains_key(*edge)).count();
  let mut pom_rows=Vec::new();
  for pom in &polygon.measurements {
   let length=polygon.measurement_length(pom)?;
   let [a,b]=polygon.measurement_points(pom)?;
   pom_rows.push(json!({"id":pom.id,"label":pom.label,"lengthMm":length*1000.,
     "first":{"edge":pom.a.edge,"t":pom.a.t,"positionMm":[a.x*1000.,a.y*1000.]},
     "second":{"edge":pom.b.edge,"t":pom.b.t,"positionMm":[b.x*1000.,b.y*1000.]}}));
  }
  if without_allowance>0 {warnings.push(format!("{} has {} boundary edge(s) without authored seam allowance",panel.name,without_allowance));}
  warnings.extend(polygon.target_diagnostics().into_iter().map(|v|format!("{}: {}",panel.name,v)));
  panels.push(json!({"panelId":panel.id,"name":panel.name,"editable":true,"widthMm":(max.x-min.x)*1000.,"heightMm":(max.y-min.y)*1000.,"areaMm2":signed_area*1e6,"edgeCount":polygon.edges.len(),"curveCount":polygon.curves.len(),"freeCurvePointCount":polygon.free_curve_points.values().map(Vec::len).sum::<usize>(),"notchCount":polygon.notches.values().map(Vec::len).sum::<usize>(),"allowanceEdgeCount":polygon.seam_allowances.len(),"missingAllowanceEdges":without_allowance,"pomCount":pom_rows.len(),"measurements":pom_rows,"edges":edges}));
 }
 let mut seams=Vec::new();
 for seam in &template.seams{
  let resolve=|link:&marvelous_cloth::garment::seam::BoundaryRef|->Option<f64>{
   lengths.get(&(link.panel.clone(),link.edge.clone()?))
     .map(|length|length*(link.range[1]-link.range[0]))
  };
  let a=resolve(&seam.a);let b=resolve(&seam.b);
  let mismatch=match (a,b){(Some(a),Some(b))=>Some((a-b).abs()*1000.),_=>None};
  if let Some(mm)=mismatch {
   if mm>1.0&&!seam.allow_ease {warnings.push(format!("Sewing pair {} has {:.2} mm rest length mismatch without ease",seam.id,mm));}
  }
  seams.push(json!({"seamId":seam.id,"firstLengthMm":a.map(|v|v*1000.),"secondLengthMm":b.map(|v|v*1000.),"mismatchMm":mismatch,"allowEase":seam.allow_ease,"correspondences":seam.notches.len()}));
 }
 // Source pattern geometry is measurable, but this native path does not yet
 // produce verified joined allowance cutlines, industrial grades or AAMA/ASTM.
 // Never turn an internal source-mesh check into a manufacturer-ready badge.
 let blockers=vec![
  "No independently validated complete cutline offsets/corner joins",
  "No native industrial multi-size curve-aware grading release",
  "No independently verified AAMA/ASTM CAD or physical cutting approval",
 ];
 Ok(json!({"format":"exo-native-pattern-audit.v1","revision":revision,"units":"mm","panelCount":template.panels.len(),"editablePanelCount":polygon_count,"panels":panels,"seams":seams,"warnings":warnings,"releaseBlockers":blockers,"sourceGeometryMeasured":true,"manufacturerReady":false}))
}
/// ASCII DXF R2000 engineering handoff with explicit millimetre header.
/// CUT_EXO is a single closed polyline and NOTCH_EXO comprises separate
/// projected notch mark lines. Not AAMA/ASTM graded interchange or cutter QA.
fn dxf_safe_label(s:&str)->String {
 s.chars().filter(|c| !c.is_control() && *c!='\\' ).take(120).collect()
}
fn xml_safe_label(s:&str)->String {
 s.chars().filter(|c|!c.is_control()).take(120).collect::<String>()
  .replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;")
  .replace('"',"&quot;").replace('\'',"&apos;")
}
fn native_cutline_dxf(line:&marvelous_cloth::garment::cutline::ProductionCutline,
 polygon:&marvelous_cloth::garment::polygon::PolygonPattern,name:&str)->Result<String,String>{
 let mut out=String::from("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n9\n$MEASUREMENT\n70\n1\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n");
 out.push_str("999\nEXO QA CUTLINE PROOF - verify metric scale, not factory approved\n0\nLWPOLYLINE\n8\nCUT_EXO\n");
 out.push_str(&format!("90\n{}\n70\n1\n",line.points.len()));
 for p in &line.points {
  out.push_str(&format!("10\n{:.6}\n20\n{:.6}\n",p.x*1000.,p.y*1000.));
 }
 for n in &line.notches {
  out.push_str(&format!("0\nLINE\n8\nNOTCH_EXO\n10\n{:.6}\n20\n{:.6}\n11\n{:.6}\n21\n{:.6}\n",n.cut_start.x*1000.,n.cut_start.y*1000.,n.inner_end.x*1000.,n.inner_end.y*1000.));
 }
 // Sew contour is independent from the offset cutline, with a distinct layer.
 // Use LINE entities, not a second closed LWPOLYLINE: pattern importers must
 // never mistake a sew contour for a second garment piece.
 for i in 0..polygon.edges.len(){
  for pair in polygon.edge_points(i)?.windows(2){
   out.push_str(&format!("0\nLINE\n8\nSTITCH_EXO\n10\n{:.6}\n20\n{:.6}\n11\n{:.6}\n21\n{:.6}\n",pair[0].x*1000.,pair[0].y*1000.,pair[1].x*1000.,pair[1].y*1000.));
  }
 }
 let cx=line.points.iter().map(|p|p.x).sum::<f64>()/line.points.len() as f64*1000.;
 let cy=line.points.iter().map(|p|p.y).sum::<f64>()/line.points.len() as f64*1000.;
 out.push_str(&format!("0\nTEXT\n8\nLABEL_EXO\n10\n{cx:.6}\n20\n{cy:.6}\n40\n5\n1\n{}\n",dxf_safe_label(name)));
 for pom in &polygon.measurements {
  let [a,b]=polygon.measurement_points(pom)?;
  let label=format!("{} {:.2} mm",pom.label,a.distance(b)*1000.);
  out.push_str(&format!("0\nLINE\n8\nPOM_EXO\n10\n{:.6}\n20\n{:.6}\n11\n{:.6}\n21\n{:.6}\n",a.x*1000.,a.y*1000.,b.x*1000.,b.y*1000.));
  out.push_str(&format!("0\nTEXT\n8\nPOM_LABEL_EXO\n10\n{:.6}\n20\n{:.6}\n40\n3\n1\n{}\n",(a.x+b.x)*500.,(a.y+b.y)*500.,dxf_safe_label(&label)));
 }
 out.push_str("0\nENDSEC\n0\nEOF\n");
 Ok(out)
}
/// Strictly read-only material-metric cutting geometry produced by the Rust
/// cutline kernel. Unsupported panel topology is returned as a blocked row,
/// never downgraded to the un-offset stitch contour or silently omitted.
fn native_production_cutlines(template:&marvelous_cloth::garment::template::GarmentTemplate,revision:u64,filter:Option<&str>)->Result<Value,String>{
 use marvelous_cloth::garment::cutline::production_cutline;
 if let Some(id)=filter{
  if !template.panels.iter().any(|p|p.id==id){return Err("Selected production cutline panel not found".into())}
 }
 let mut records=Vec::new();
 let mut good=0usize; let mut blocked=0usize;
 for panel in template.panels.iter().filter(|p|filter.is_none_or(|id|p.id==id)) {
  let polygon=match panel.polygon.as_ref(){
   Some(v)=>v,
   None=>{records.push(json!({"panelId":panel.id,"name":panel.name,"ok":false,"error":"No editable polygon for this panel"}));blocked+=1;continue}
  };
  match production_cutline(polygon){
   Ok(result)=>{
    if result.points.len()<3||result.points.len()>8192{return Err("Cutline exceeded the export point budget".into())}
    let metric:Vec<[f64;2]>=result.points.iter().map(|p|[p.x*1000.,p.y*1000.]).collect();
    let min=result.points.iter().copied().fold(DVec2::splat(f64::INFINITY),|a,b|a.min(b));
    let max=result.points.iter().copied().fold(DVec2::splat(f64::NEG_INFINITY),|a,b|a.max(b));
    let margin=10.;
    let origin=DVec2::new(min.x*1000.-margin,min.y*1000.-margin);
    let size=(max-min)*1000.+DVec2::splat(margin*2.);
    if !size.is_finite()||size.min_element()<=0.||size.max_element()>20_000. {return Err("Unsafe cutline print bounds".into())}
    // Physical mm lengths are written by Rust. Consumers must still disable
    // application/print-dialog scaling and measure a physical test page.
    let points=result.points.iter()
      .map(|p|format!("{:.6},{:.6}",p.x*1000.,p.y*1000.))
      .collect::<Vec<_>>().join(" ");
    let notch_marks=result.notches.iter().map(|n|{
      format!(r##"<path d="M {:.6} {:.6} L {:.6} {:.6}" fill="none" stroke="#c0392b" stroke-width="0.2"/>"##,
        n.cut_start.x*1000.,n.cut_start.y*1000.,n.inner_end.x*1000.,n.inner_end.y*1000.)
    }).collect::<Vec<_>>().join("");
    let stitch_paths=polygon.edges.iter().enumerate().map(|(i,_)|{
     polygon.edge_points(i).map(|points|format!(r##"<polyline data-pattern-role="stitch" points="{}" fill="none" stroke="#24718a" stroke-width="0.2"/>"##,
      points.iter().map(|p|format!("{:.6},{:.6}",p.x*1000.,p.y*1000.)).collect::<Vec<_>>().join(" ")))
    }).collect::<Result<Vec<_>,_>>()?.join("");
    let mut pom_rows=Vec::new();
    let mut pom_svg=String::new();
    for pom in &polygon.measurements{
     let [a,b]=polygon.measurement_points(pom)?;
     let length_mm=a.distance(b)*1000.;
     pom_rows.push(json!({"id":pom.id,"label":pom.label,"startMm":[a.x*1000.,a.y*1000.],"endMm":[b.x*1000.,b.y*1000.],"lengthMm":length_mm}));
     pom_svg.push_str(&format!(r##"<line data-pattern-role="pom" x1="{:.6}" y1="{:.6}" x2="{:.6}" y2="{:.6}" stroke="#7252a0" stroke-width="0.2"/><text x="{:.6}" y="{:.6}" font-size="3" fill="#7252a0">{} {:.2} mm</text>"##,
      a.x*1000.,a.y*1000.,b.x*1000.,b.y*1000.,(a.x+b.x)*500.,(a.y+b.y)*500.,xml_safe_label(&pom.label),length_mm));
    }
    let label_x=(min.x+max.x)*500.;
    let label_y=(min.y+max.y)*500.;
    let svg=format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="{:.6}mm" height="{:.6}mm" viewBox="{:.6} {:.6} {:.6} {:.6}"><title>EXO engineering cutline and notch marking proof, NOT factory approved</title><path d="M {} Z" fill="none" stroke="black" stroke-width="0.2"/>{}{}<text data-pattern-role="piece-label" x="{:.6}" y="{:.6}" font-size="5">{}</text>{}</svg>"#,
      size.x,size.y,origin.x,origin.y,size.x,size.y,
      points.replace(' '," L ").replace(','," "),notch_marks,stitch_paths,label_x,label_y,xml_safe_label(&panel.name),pom_svg);
    let notches_mm:Vec<Value>=result.notches.iter().map(|n|json!({"edgeId":n.edge_id,"t":n.t,"depthMm":n.depth_m*1000.,"cutStartMm":[n.cut_start.x*1000.,n.cut_start.y*1000.],"innerEndMm":[n.inner_end.x*1000.,n.inner_end.y*1000.]})).collect();
    good+=1;
    let dxf=native_cutline_dxf(&result,polygon,&panel.name)?;
    records.push(json!({"panelId":panel.id,"name":panel.name,"ok":true,"units":"mm","pointsMm":metric,"pointCount":metric.len(),"edges":result.edges,"notchMarksMm":notches_mm,"notchMarkCount":result.notches.len(),"pomMarksMm":pom_rows,"stitchLayer":"STITCH_EXO","pointCountStitch":polygon.edges.len(),"perimeterMm":result.perimeter_m*1000.,"areaMm2":result.area_m2*1_000_000.,"svg":svg,"dxf":dxf,"factoryApproved":false}));
   }
   Err(reason)=>{blocked+=1;records.push(json!({"panelId":panel.id,"name":panel.name,"ok":false,"error":reason}));}
  }
 }
 Ok(json!({"format":"exo-native-cutline-proof.v1","revision":revision,"units":"mm","generatedCount":good,"blockedCount":blocked,"panels":records,"factoryApproved":false,"printCalibrationRequired":true,"note":"Rust ASCII DXF and SVG are engineering proofs, not graded AAMA/ASTM interchange. External CAD layer import, notch cutter configuration and physical-scale validation are release gates."}))
}
#[cfg(test)]
mod grade_tests {
 use super::*;
 use marvelous_cloth::garment::polygon::PolygonPattern;
 #[test]
 fn persistent_pom_grades_with_stable_named_material_stations(){
  use marvelous_cloth::garment::polygon::{MeasurementAnchor,PatternMeasurement};
  let mut source:PolygonPattern=serde_json::from_value(json!({
   "points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],
   "edges":["top","right","bottom","left"],"subdivisions":2
  })).unwrap();
  source.measurements.push(PatternMeasurement{
   id:"across-body".into(),label:"Body width".into(),
   a:MeasurementAnchor{edge:"left".into(),t:0.5},
   b:MeasurementAnchor{edge:"right".into(),t:0.5},
  });
  let original=source.measurement_length(&source.measurements[0]).unwrap();
  assert!((original-0.2).abs()<1e-9);
  let graded=graded_polygon(&source,20.,10.).unwrap();
  assert_eq!(graded.measurements,source.measurements);
  assert!((graded.measurement_length(&graded.measurements[0]).unwrap()-0.22).abs()<1e-9);
  let restored:PolygonPattern=serde_json::from_str(&serde_json::to_string(&graded).unwrap()).unwrap();
  assert_eq!(restored.measurements,graded.measurements);
 }
 #[test]
 fn grade_preserves_named_edges_and_exact_metric_delta() {
  let mut p:PolygonPattern=serde_json::from_value(json!({"points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],"edges":["top","right","bottom","left"],"subdivisions":2})).unwrap();
  p.target_lengths.insert("top".into(),0.2);
  let q=graded_polygon(&p,20.,-10.).unwrap();
  assert_eq!(p.edges,q.edges);
  assert!((q.points[1].x-q.points[0].x-0.22).abs()<1e-12);
  assert!((q.points[2].y-q.points[1].y-0.09).abs()<1e-12);
  assert!((q.target_lengths["top"]-0.22).abs()<1e-10,
    "An authored target must be scaled and preserved, never silently cleared");
  assert_eq!(p.target_lengths.get("top"),Some(&0.2));
  let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&q).unwrap()).unwrap();
  assert_eq!(reopened.points,q.points);
 }
 #[test]
 fn grade_rejects_collapse_and_nonfinite_delta_without_mutation() {
  let p:PolygonPattern=serde_json::from_value(json!({"points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],"edges":["a","b","c","d"],"subdivisions":2})).unwrap();
  assert!(graded_polygon(&p,0.,-100.).is_err());
  assert!(graded_polygon(&p,f64::NAN,10.).is_err());
  assert_eq!(p.points[1].x,0.2);
 }
 #[test]
 fn affine_grade_preserves_actual_cubic_controls_and_notch_allowance_mm(){
  use marvelous_cloth::garment::polygon::{EdgeNotch,FreeCurvePoint,PatternAnnotation};
  let mut p:PolygonPattern=serde_json::from_value(json!({"points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],"edges":["top","right","bottom","left"],"subdivisions":2})).unwrap();
  p.curves.insert("top".into(),[DVec2::new(0.05,-0.025),DVec2::new(0.15,-0.025)]);
  p.free_curve_points.insert("top".into(),vec![FreeCurvePoint{id:"f1".into(),t:0.5,position:DVec2::new(0.1,-0.028),mirror_group:None,derivative:None, derivative_in:None, derivative_out:None,}]);
  p.notches.insert("top".into(),vec![EdgeNotch{t:0.25,depth_m:0.004}]);
  p.seam_allowances.insert("top".into(),0.01);
  p.annotations.push(PatternAnnotation{id:"note".into(),text:"QA".into(),position:DVec2::new(0.1,0.05)});
  let mut min=DVec2::splat(f64::INFINITY);
  let mut max=DVec2::splat(f64::NEG_INFINITY);
  for i in 0..p.edges.len(){for point in p.edge_points(i).unwrap(){
   min=min.min(point);max=max.max(point);
  }}
  let scale=((max-min)+DVec2::new(0.02,0.01))/(max-min);
  let center=(min+max)*0.5;
  let affine=|point:DVec2|center+(point-center)*scale;
  let q=graded_polygon(&p,20.,10.).unwrap();
  assert_eq!(q.edges,p.edges);
  assert_eq!(q.notches,p.notches);
  assert_eq!(q.seam_allowances,p.seam_allowances);
  assert_eq!(q.free_curve_points["top"][0].id,"f1");
  assert_eq!(q.free_curve_points["top"][0].t,0.5);
  assert!((q.curves["top"][0]-affine(p.curves["top"][0])).length()<1e-12);
  assert!((q.free_curve_points["top"][0].position-affine(p.free_curve_points["top"][0].position)).length()<1e-12);
  assert!((q.annotations[0].position-affine(p.annotations[0].position)).length()<1e-12);
  let path=q.edge_points(0).expect("Sample native graded free Bézier");
  assert!(path.len()>3);
  assert!(path.iter().all(|v|v.is_finite()));
  assert_eq!(serde_json::from_str::<PolygonPattern>(&serde_json::to_string(&q).unwrap()).unwrap().curves,q.curves);
 }
 #[test]
 fn graded_independent_bezier_handles_preserve_affine_geometry_and_specs(){
  use marvelous_cloth::garment::polygon::{EdgeNotch,FreeCurvePoint};
  let mut original:PolygonPattern=serde_json::from_value(json!({
   "points":[[0.,0.],[0.2,0.],[0.2,0.16],[0.,0.16]],
   "edges":["top","right","bottom","left"],"subdivisions":2
  })).unwrap();
  original.curves.insert("top".into(),[DVec2::new(0.045,-0.05),DVec2::new(0.15,-0.05)]);
  original.free_curve_points.insert("top".into(),vec![FreeCurvePoint{
   id:"shoulder_knot".into(),t:0.4,position:DVec2::new(0.08,-0.033),
   derivative:Some(DVec2::new(0.2,0.02)),
   derivative_in:Some(DVec2::new(0.13,-0.045)),
   derivative_out:Some(DVec2::new(0.15,0.075)),mirror_group:None
  }]);
  original.notches.insert("top".into(),vec![EdgeNotch{t:0.24,depth_m:0.006}]);
  original.seam_allowances.insert("top".into(),0.012);
  let original_len=|p:&PolygonPattern|p.edge_points(0).unwrap().windows(2)
    .map(|seg|seg[0].distance(seg[1])).sum::<f64>();
  let old_len=original_len(&original);
  original.target_lengths.insert("top".into(),old_len*1.02);
  let mut min=DVec2::splat(f64::INFINITY);
  let mut max=DVec2::splat(f64::NEG_INFINITY);
  for i in 0..original.edges.len(){
   for point in original.edge_points(i).unwrap(){min=min.min(point);max=max.max(point)}
  }
  assert!(min.y < -0.02,"The test must have a lobe outside its vertices");
  let old_size=max-min;
  let scale=(old_size+DVec2::new(0.025,0.017))/old_size;
  let center=(min+max)*0.5;
  let graded=graded_polygon(&original,25.,17.).unwrap();
  let expected=|point:DVec2|center+(point-center)*scale;
  let new_len=original_len(&graded);
  let knot=&graded.free_curve_points["top"][0];
  let old=&original.free_curve_points["top"][0];
  for (got,wanted) in [
   (knot.position,expected(old.position)),
   (knot.derivative.unwrap(),old.derivative.unwrap()*scale),
   (knot.derivative_in.unwrap(),old.derivative_in.unwrap()*scale),
   (knot.derivative_out.unwrap(),old.derivative_out.unwrap()*scale),
  ]{assert!((got-wanted).length()<1e-11,"Scaled independent tangent or position changed");}
  for (before,after) in original.edge_points(0).unwrap().iter().zip(graded.edge_points(0).unwrap()){
   assert!((after-expected(*before)).length()<0.0007,
    "Full Bézier shape must undergo the same material-space affine transform");
  }
  assert_eq!(graded.notches,original.notches);
  assert_eq!(graded.seam_allowances,original.seam_allowances);
  assert!((graded.target_lengths["top"]/new_len-1.02).abs()<1e-10);
  let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&graded).unwrap()).unwrap();
  assert_eq!(reopened.target_lengths,graded.target_lengths);
  assert_eq!(reopened.free_curve_points["top"][0].derivative_in,knot.derivative_in);
  assert_eq!(reopened.free_curve_points["top"][0].derivative_out,knot.derivative_out);
 }
 #[test]
 fn invalid_or_orphaned_grade_target_fails_closed_without_losing_references(){
  let mut pattern:marvelous_cloth::garment::polygon::PolygonPattern=serde_json::from_value(json!({
   "points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],
   "edges":["top","right","bottom","left"],"subdivisions":2
  })).unwrap();
  pattern.target_lengths.insert("top".into(),f64::NAN);
  assert!(graded_polygon(&pattern,15.,10.).is_err());
  assert!(pattern.target_lengths["top"].is_nan());
  pattern.target_lengths.remove("top");
  pattern.target_lengths.insert("missing_edge".into(),0.2);
  assert!(graded_polygon(&pattern,15.,10.).is_err());
  assert_eq!(pattern.target_lengths["missing_edge"],0.2);
 }
}
#[cfg(test)]
mod pleat_tests {
 use super::*;
 use marvelous_cloth::garment::polygon::PolygonPattern;
 fn rectangle()->PolygonPattern {serde_json::from_value(json!({"points":[[0.,0.],[0.3,0.],[0.3,0.2],[0.,0.2]],"edges":["top","right","bottom","left"],"subdivisions":2})).unwrap()}
 #[test]
 fn three_parallel_guides_fit_inside_and_survive_serialization() {
  let p=rectangle();
  for orientation in ["vertical","horizontal"] {
   let guides=pleat_guide_points(&p,orientation,20.,10.).unwrap();
   assert_eq!(guides.len(),3);
   for endpoints in guides {
    for point in endpoints {assert!(point.x>0. && point.x<0.3 && point.y>0. && point.y<0.2);}
    if orientation=="vertical" {assert_eq!(endpoints[0].x,endpoints[1].x)}else{assert_eq!(endpoints[0].y,endpoints[1].y)}
   }
  }
  let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
  assert_eq!(reopened.edges,p.edges);
 }
 #[test]
 fn rejects_invalid_spacing_orientation_and_non_rectangle() {
  let p=rectangle();
  assert!(pleat_guide_points(&p,"vertical",f64::NAN,10.).is_err());
  assert!(pleat_guide_points(&p,"diagonal",20.,10.).is_err());
  assert!(pleat_guide_points(&p,"vertical",101.,10.).is_err());
  let mut narrow=p.clone();for point in &mut narrow.points {point.x*=0.2;}
  assert!(pleat_guide_points(&narrow,"vertical",20.,20.).is_err());
  let mut skew=p.clone();skew.points[1].x+=0.01;
  assert!(pleat_guide_points(&skew,"vertical",20.,10.).is_err());
 }
}
struct Session {project:FittingProject,scene:FittingScene,solver:Option<VbdSolver>,grab:Option<Grab>,live_grab:bool,history:History,hardware_undo:Vec<Vec<ImportedHardware>>,hardware_redo:Vec<Vec<ImportedHardware>>,revision:u64,metrics:Value, #[cfg(feature="desktop")] gpu:Option<marvelous_cloth::gpu_vbd::GpuVbd>}
impl Session {
 fn new(project:FittingProject)->Result<Self,String>{
 let scene=project.compile()?;
 #[cfg(feature="desktop")]
 let gpu=if std::env::args().any(|a|a=="--gpu") {
  use eframe::wgpu;
  let instance=wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
  let adapter=pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions{power_preference:wgpu::PowerPreference::HighPerformance,..Default::default()})).map_err(|e|e.to_string())?;
  if adapter.get_info().device_type==wgpu::DeviceType::Cpu{return Err("Hardware GPU unavailable".into())}
  let (device,queue)=pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor{label:Some("EXO ClothCraft Metal workspace"),..Default::default()})).map_err(|e|e.to_string())?;
  Some(marvelous_cloth::gpu_vbd::GpuVbd::new(device,queue))
 }else{None};
 #[cfg(not(feature="desktop"))]
 if std::env::args().any(|a|a=="--gpu"){return Err("Build with desktop for GPU simulation".into())}
 Ok(Self{project,scene,solver:None,grab:None,live_grab:false,history:History::default(),hardware_undo:Vec::new(),hardware_redo:Vec::new(),revision:0,metrics:Value::Null,#[cfg(feature="desktop")]gpu})
 }
 // Same barycentric spring as upstream atelier.rs::pick_and_drag (150 N/m).
 // Control updates never teleport particles or change material rest geometry.
 fn set_live_grab(&mut self,value:&Value)->Result<(),String>{
  if value.is_null(){self.grab=None;self.live_grab=false;return Ok(())}
  let vertices=field::<[usize;3]>(value,"vertices")?;
  let weights=field::<[f64;3]>(value,"weights")?;
  let target=field::<[f64;3]>(value,"target")?;
  if !weights.iter().all(|w|w.is_finite()&&*w>=-1e-6&&*w<=1.000001)
   || (weights.iter().sum::<f64>()-1.).abs()>1e-5
   || !target.iter().all(|n|n.is_finite()&&n.abs()<20.)
   || !self.scene.garment.mesh.triangles.iter().any(|t|t.vertices==vertices){return Err("Invalid surface grab".into())}
  self.grab=Some(Grab{vertices,weights,target:DVec3::from_array(target),stiffness:150.});
  self.live_grab=true;Ok(())
 }
 fn apply_edit(&mut self,edit:authoring::Edit){
  self.grab=None;self.live_grab=false;
  if edit.reset_simulation {
   self.scene.state=edit.state_after(&self.scene.garment,&self.scene.state);
   self.scene.garment=Arc::new(edit.garment);self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;
  }
  self.project.template=edit.template;self.revision+=1;
 }
 fn snapshot(&self,avatar:bool,graphics:bool)->Value {
  let g=&self.scene.garment;
  let panels:Vec<_>=g.panels.iter().enumerate().map(|(i,p)|json!({"id":p.id,"vertices":[p.vertices.start,p.vertices.end],"triangles":[p.triangles.start,p.triangles.end],"boundaries":p.boundaries,"layout":authoring::layout(&self.project.template,i)})).collect();
  let seams:Vec<_>=g.seams.iter().map(|s|{
   let max_gap_m=s.max_gap(&self.scene.state.x);
   let rms_gap_m=s.rms_gap(&self.scene.state.x);
   json!({"id":s.id,"guides":s.guides,"gap_m":max_gap_m,
     "rms_gap_m":rms_gap_m,"lengths_m":s.lengths,
     "kind":if s.id.starts_with("dart_"){"cut_sewn_dart"}else{"sewing"},
     // This tolerance is a measurement gate, NOT proof of good 3D fit,
     // collision-free closure or a production-complete folded dart.
     "within_provisional_2mm":max_gap_m<=0.002})
  }).collect();
  let dart_fit:Vec<_>=g.seams.iter().filter(|s|s.id.starts_with("dart_")).map(|s|{
   let max=s.max_gap(&self.scene.state.x);
   json!({"seamId":s.id,"maxGapMm":max*1000.,"rmsGapMm":s.rms_gap(&self.scene.state.x)*1000.,
     "lengthsMm":s.lengths.map(|n|n*1000.),"withinProvisional2mm":max<=0.002})
  }).collect();
  let graphic_panel_metrics:serde_json::Map<String,Value>=g.panels.iter().filter_map(|p|{
   let points=g.mesh.uv.get(p.vertices.clone())?;
   if points.is_empty(){return None}
   let (mut min_x,mut min_y,mut max_x,mut max_y)=(f64::INFINITY,f64::INFINITY,f64::NEG_INFINITY,f64::NEG_INFINITY);
   for q in points {min_x=min_x.min(q.x);min_y=min_y.min(q.y);max_x=max_x.max(q.x);max_y=max_y.max(q.y);}
   if ![min_x,min_y,max_x,max_y].iter().all(|n|n.is_finite()){return None}
   Some((p.id.clone(),json!({"minX":min_x,"minY":min_y,"maxX":max_x,"maxY":max_y,"width":max_x-min_x,"height":max_y-min_y})))
  }).collect();
  let mut out=json!({"revision":self.revision,"template":self.project.template,"positions":self.scene.state.x,"uv":g.mesh.uv,"triangles":g.mesh.triangles.iter().map(|t|t.vertices).collect::<Vec<_>>(),"panels":panels,"graphicPanelMetrics":graphic_panel_metrics,"seams":seams,"dartFit":dart_fit,"time":self.scene.state.time,"metrics":self.metrics,"canUndo":self.history.can_undo(),"canRedo":self.history.can_redo(),"avatar":if avatar {json!({"positions":self.scene.collider.surface.vertices,"triangles":self.scene.collider.surface.triangles})}else{Value::Null},"grabActive":self.grab.is_some(),"grabStiffness":self.grab.as_ref().map(|g|g.stiffness),"backend":if std::env::args().any(|a|a=="--gpu"){"ClothCraft GPU VBD + CPU OGC"}else{"ClothCraft CPU VBD + OGC"},"fitCertified":false});
  if graphics {out["printGraphics"]=json!(self.project.print_graphics);}
  out["importedHardware"]=json!(self.project.imported_hardware);
  out["canUndoHardware"]=json!(!self.hardware_undo.is_empty());
  out["canRedoHardware"]=json!(!self.hardware_redo.is_empty());
  out
 }
 fn request(&mut self,v:&Value)->Result<Value,String>{
  let op=v["op"].as_str().unwrap_or("snapshot");
  if !["snapshot","save"].contains(&op) && v["revision"].as_u64()!=Some(self.revision){return Err("Stale document revision; reload current snapshot".into())}
  match op {
   "production-handoff"=>{
     // All four artifacts are evaluated against one immutable session revision.
     let revision=self.revision;
     let full=self.snapshot(false,false);
     let snapshot=json!({"revision":revision,"template":full["template"],
       "positions":full["positions"],"uv":full["uv"],"triangles":full["triangles"],
       "panels":full["panels"],"seams":full["seams"]});
     let audit=pattern_factory_audit(&self.project.template,revision)?;
     let mut cutlines=native_production_cutlines(&self.project.template,revision,None)?;
     if let Some(panels)=cutlines["panels"].as_array_mut(){for panel in panels {
       if let Some(row)=panel.as_object_mut(){row.remove("svg");row.remove("dxf");}
     }}
     let mut blockers:Vec<String>=Vec::new();
     if let Some(items)=audit["releaseBlockers"].as_array(){for item in items {if let Some(s)=item.as_str(){blockers.push(s.to_owned());}}}
     if cutlines["blockedCount"].as_u64().unwrap_or(0)>0 {blockers.push("One or more native cutlines failed generation".into());}
     blockers.push("3D fit and physical factory proof have not been certified".into());
     // Mesh identifiers and complete snapshot geometry travel together; proofs
     // remain explicitly unapproved even if every cutline is generated.
     return Ok(json!({"format":"exo-native-production-handoff.v1","revision":revision,
       "snapshot":snapshot,"patternAudit":audit,"cutlineProof":cutlines,
       "releaseBlockers":blockers,"manufacturerReady":false,"atomic":true}));
   },
   "pattern-audit"=>return pattern_factory_audit(&self.project.template,self.revision),
   "production-cutlines"=>return native_production_cutlines(&self.project.template,self.revision,v["panel"].as_str()),
   "pleat-guides"=>{
     let panel=field::<String>(v,"panel")?;
     let orientation=field::<String>(v,"orientation")?;
     let spacing=field::<f64>(v,"spacing_mm")?;
     let inset=field::<f64>(v,"inset_mm")?;
     let selected=self.project.template.panels.iter().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=selected.polygon.as_ref().ok_or("Pleat guides require an editable polygon")?;
     let guides=pleat_guide_points(polygon,&orientation,spacing,inset)?;
     let mut template=self.project.template.clone();
     let mut final_edit=None;
     for points in guides {
       let edit=authoring::apply(&template,Command::InternalLine{panel:panel.clone(),points:points.to_vec(),tangents:vec![DVec2::ZERO;2]})?;
       template=edit.template.clone();final_edit=Some(edit);
     }
     let edit=final_edit.ok_or("No pleat guides generated")?;
     let lines=&template.panels.iter().find(|p|p.id==panel).ok_or("Panel missing after pleat edit")?.polygon.as_ref().ok_or("Polygon missing after pleat edit")?.lines;
     let ids:std::collections::HashSet<_>=lines.iter().map(|l|l.id.as_str()).collect();
     if ids.len()!=lines.len() {return Err("Duplicate internal guide identifiers".into())}
     self.history.record(self.project.template.clone());self.apply_edit(edit);
   },
   "grade-pattern"=>{
     let panel=field::<String>(v,"panel")?;
     let width=field::<f64>(v,"width_delta_mm")?;
     let height=field::<f64>(v,"height_delta_mm")?;
     let source=self.project.template.panels.iter().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=source.polygon.as_ref().ok_or("Grade requires an editable polygon pattern")?;
     if width!=0. || height!=0. {
       let polygon=graded_polygon(polygon,width,height)?;
       let edit=authoring::apply(&self.project.template,Command::Shape{panel,polygon})?;
       self.history.record(self.project.template.clone());self.apply_edit(edit);
     }
   },
   "graphics-set"=>{
     let records:Vec<PrintGraphic>=field(v,"printGraphics").or_else(|_|field(v,"graphics"))?;
     self.project.validate_print_graphics(&records)?;
     self.project.print_graphics=records;
     self.revision+=1;
   },
   "hardware-set"=>{
     let placements:Vec<ImportedHardware>=field(v,"importedHardware")?;
     self.project.validate_imported_hardware(&placements)?;
     if placements!=self.project.imported_hardware {
       self.hardware_undo.push(self.project.imported_hardware.clone());
       if self.hardware_undo.len()>32 {self.hardware_undo.remove(0);}
       self.hardware_redo.clear();
       self.project.imported_hardware=placements;
       self.revision+=1;
     }
   },
   "hardware-undo"=>{
     let previous=self.hardware_undo.pop().ok_or("No imported hardware edit to undo")?;
     self.hardware_redo.push(std::mem::replace(&mut self.project.imported_hardware,previous));
     self.revision+=1;
   },
   "hardware-redo"=>{
     let next=self.hardware_redo.pop().ok_or("No imported hardware edit to redo")?;
     self.hardware_undo.push(std::mem::replace(&mut self.project.imported_hardware,next));
     self.revision+=1;
   },
   // CLO information field backed by the real upstream template. IDs remain
   // stable for sewing, history and selection; renaming never remeshes cloth.
   "set-property"=>{
     let target=field::<String>(v,"target")?;
     let id=field::<String>(v,"id")?;
     let key=field::<String>(v,"field")?;
     let value=field::<String>(v,"value")?;
     if key!="name" {return Err("Only native name is supported; itemNo is workspace metadata".into())}
     if value.trim().is_empty() || value.chars().count()>120 || value.chars().any(|c|c.is_control()) {
       return Err("Name must contain 1–120 printable characters".into())
     }
     let mut template=self.project.template.clone();
     let previous=match target.as_str(){
       "panel"=>{let item=template.panels.iter_mut().find(|p|p.id==id).ok_or("Panel not found")?;std::mem::replace(&mut item.name,value.clone())},
       "fabric"=>{let item=template.fabrics.iter_mut().find(|f|f.id==id).ok_or("Fabric not found")?;std::mem::replace(&mut item.name,value.clone())},
       _=>return Err("Property target must be panel or fabric".into())
     };
     if previous!=value {
       self.history.record(self.project.template.clone());
       self.project.template=template;self.revision+=1;
     }
   },
   // Annotate a selected contour's target dimension without invoking
   // authoring::TargetLength, which actually reshapes the contour and can
   // invalidate existing sewn lengths. This is explicitly a non-physical
   // drafting specification: mesh, seam constraints and solver stay untouched.
   "line-spec"=>{
     let panel=field::<String>(v,"panel")?;
     let edge=field::<String>(v,"edge")?;
     let length=field::<f64>(v,"target_m")?;
     if !length.is_finite() || !(0.0001..=10.0).contains(&length){return Err("Invalid target line length".into())}
     let mut template=self.project.template.clone();
     let p=template.panels.iter_mut().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=p.polygon.as_mut().ok_or("Panel has no editable named edges")?;
     if !polygon.edges.iter().any(|id|id==&edge){return Err("Named boundary not found".into())}
     if polygon.target_lengths.get(&edge).copied()!=Some(length) {
       polygon.target_lengths.insert(edge,length);
       self.history.record(self.project.template.clone());
       self.project.template=template;self.revision+=1;
     }
   },
   // Transactional, solver-backed edit of an existing sewing relationship.
   // Unlike simply drawing seam guides, this changes the compiled native
   // correspondence/orientation, easing and coupling coefficient. A failed
   // compile changes neither the document nor its undo history.
   "edit-seam"=>{
     let id=field::<String>(v,"seam")?;
     let reverse=field::<bool>(v,"reverse")?;
     let ease=field::<bool>(v,"ease")?;
     let stiffness=field::<f64>(v,"stiffness")?;
     if !stiffness.is_finite() || !(1_000.0..=1_000_000.0).contains(&stiffness) {
       return Err("Seam stiffness must be 1,000–1,000,000 N/m²".into())
     }
     let mut template=self.project.template.clone();
     let seam=template.seams.iter_mut().find(|s|s.id==id).ok_or("Sewing relationship not found")?;
     if seam.reverse_b!=reverse || seam.allow_ease!=ease || (seam.stiffness-stiffness).abs()>1e-9 {
       seam.reverse_b=reverse;seam.allow_ease=ease;seam.stiffness=stiffness;
       let garment=template.compile()?;
       self.history.record(self.project.template.clone());
       self.apply_edit(authoring::Edit{
         template,garment,selected:None,reset_simulation:true,new_point:None
       });
     }
   },
   // Trace a complete straight-edged 2D contour as a NEW, independent native
   // pattern. Reject shapes we cannot reproduce exactly (curves and holes).
   // Rust Polygon validates topology and compiles before history is recorded.
   "trace-contour"=>{
     let source=field::<String>(v,"panel")?;
     let original=self.project.template.panels.iter().find(|p|p.id==source).ok_or("Trace source panel not found")?;
     let polygon=original.polygon.as_ref().ok_or("Trace requires an editable polygon contour")?;
     if !polygon.curves.is_empty() || !polygon.holes.is_empty() {
       return Err("Trace currently supports straight outer contours without holes; edit curves or holes before tracing".into())
     }
     let edit=authoring::apply(&self.project.template,Command::Polygon{
       points:polygon.points.clone(),tangents:Vec::new(),
       meshing:polygon.meshing.clone().unwrap_or_default(),fabric:original.fabric.clone(),replace:false
     })?;
     self.history.record(self.project.template.clone());self.apply_edit(edit);
   },
   "edit-batch"=>{
    let commands=v["commands"].as_array().ok_or("Missing commands")?;
    if commands.is_empty()||commands.len()>256{return Err("Batch requires 1 to 256 commands".into())}
    let mut template=self.project.template.clone();let mut final_edit=None;
    for item in commands {if item["kind"]!="BoardTransform"{return Err("Only BoardTransform is supported in a layout batch".into())}let edit=authoring::apply(&template,command(item)?)?;template=edit.template.clone();final_edit=Some(edit);}
    // No document or history mutation until every edit has validated.
    self.history.record(self.project.template.clone());self.apply_edit(final_edit.unwrap());
   },
   "edit"=>{let edit=authoring::apply(&self.project.template,command(&v["command"])?)?;self.history.record(self.project.template.clone());self.apply_edit(edit);},
   "undo"|"redo"=>{let edit=self.history.restore(&self.project.template,op=="redo")?;self.apply_edit(edit);},
   "reset"=>{self.scene.state=self.scene.garment.initial_state.clone();self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;self.revision+=1;},
   // CLO-style *post-simulation* rigid reposition of one draped garment panel.
   // Unlike authored Place, this preserves its draped fold geometry and the
   // EXACT coordinates of every other sewn panel while moving the chosen one.
   // Seam constraints stay connected and are resolved on subsequent steps.
   "pose-panel"=>{
     let id=field::<String>(v,"panel")?;
     let delta=field::<[f64;3]>(v,"translation_delta")?;
     let rotate=field::<[f64;3]>(v,"rotation_delta_degrees")?;
     if !delta.iter().all(|n|n.is_finite())||!rotate.iter().all(|n|n.is_finite())
       || DVec3::from_array(delta).length()>1.75 || rotate.iter().any(|n|n.abs()>360.)
       {return Err("Invalid or excessive rigid drape motion".into())}
     let range=self.scene.garment.panels.iter().find(|p|p.id==id).ok_or("Panel not found")?.vertices.clone();
     if range.is_empty(){return Err("Panel has no physics vertices".into())}
     let origin=self.scene.state.x[range.clone()].iter().copied().sum::<DVec3>()/(range.len() as f64);
     let rot=DQuat::from_euler(EulerRot::XYZ,rotate[0].to_radians(),rotate[1].to_radians(),rotate[2].to_radians());
     let move_by=DVec3::from_array(delta);
     for i in range {
       let p=self.scene.state.x[i];
       self.scene.state.x[i]=origin + rot*(p-origin) + move_by;
       self.scene.state.v[i]=DVec3::ZERO;
     }
     self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;self.revision+=1;
   },
   // Experimental CLO-style direct grab of simulated cloth. Modify only the
   // specified panel's current positions; keep all OTHER simulated panels
   // numerically untouched. The next physics step rebuilds its contact cache.
   // Never claim the resulting stretched geometry is penetration-free.
   "pull-panel"=>{
    let panel=field::<String>(v,"panel")?;
    let vertex=field::<usize>(v,"vertex")?;
    let target=field::<[f64;3]>(v,"target")?;
    let radius=v["radius_m"].as_f64().unwrap_or(0.16);
    if !target.iter().all(|n|n.is_finite()&&n.abs()<20.0)||!radius.is_finite()||!(0.015..=0.5).contains(&radius){return Err("Invalid grab target or brush radius".into())}
    let range=self.scene.garment.panels.iter().find(|p|p.id==panel).ok_or("Panel not found")?.vertices.clone();
    if !range.contains(&vertex){return Err("Grab vertex must belong to the selected panel".into())}
    let anchor=self.scene.state.x[vertex];
    let desired=DVec3::from_array(target);
    let delta=desired-anchor;
    if delta.length()>2.0{return Err("Grab displacement exceeds safe 2 m limit".into())}
    if self.scene.garment.mesh.pins[vertex].is_some(){return Err("Cannot grab a fixed cloth pin".into())}
    let original=self.scene.state.x[range.clone()].to_vec();
    let mut count=0;
    for (local,index) in range.enumerate(){
      let distance=original[local].distance(anchor);
      // Compact C2 brush: motion ends exactly at the requested radius.
      // This avoids dragging remote vertices on the same panel on every move.
      if distance>=radius || self.scene.garment.mesh.pins[index].is_some(){continue}
      let t=distance/radius;
      let weight=1.0-10.0*t.powi(3)+15.0*t.powi(4)-6.0*t.powi(5);
      self.scene.state.x[index]+=delta*weight;
      self.scene.state.v[index]*=1.0-weight;
      count+=1;
    }
    if count==0{return Err("No cloth vertices in grab radius".into())}
    // Hold the picked vertex through one native VBD solve so membrane,
    // bending, seams and OGC contacts react to the pull. Release after that
    // step to avoid leaving an invisible permanent pin in the simulation.
    self.live_grab=false;self.grab=Some(Grab{vertices:[vertex;3],weights:[1.0,0.0,0.0],target:desired,stiffness:1.0e4});
    self.solver=None;self.metrics=Value::Null;self.revision+=1;
   },
   "grab"=>{self.set_live_grab(&v["grab"])?;},
   "step"=>{
    if let Some(value)=v.get("grab"){self.set_live_grab(value)?;}
    let count=v["steps"].as_u64().unwrap_or(1);if !(1..=4).contains(&count){return Err("Step batch must be 1–4".into())}
    if self.solver.is_none(){self.solver=Some(VbdSolver::new(self.scene.garment.clone(),Some(&self.scene.collider.surface),&self.scene.state)?)}
    let settings=VbdSettings{dt:1.0/60.0,iterations:16,..Default::default()};
    for _ in 0..count {
 // A failed contact solve must never persist partially written cloth
 // particles. Recover the last valid state and recreate solver caches for
 // the next user action (Move/Reset/SIM), rather than saving a broken drape.
 let before_step=self.scene.state.clone();
 #[cfg(feature="desktop")]
 let outcome=if let Some(gpu)=&self.gpu{gpu.step(self.solver.as_mut().unwrap(),&mut self.scene.state,&settings,self.grab.as_ref())}else{self.solver.as_mut().unwrap().step(&mut self.scene.state,&settings,self.grab.as_ref())};
 #[cfg(not(feature="desktop"))]
 let outcome=self.solver.as_mut().unwrap().step(&mut self.scene.state,&settings,self.grab.as_ref());
 let metric=match outcome {
  Ok(metric)=>metric,
  Err(error)=>{
   self.scene.state=before_step;
   self.solver=None;
   self.grab=None;
   self.live_grab=false;
   self.metrics=Value::Null;
   return Err(error.into());
  }
 };
 if !self.live_grab {self.grab=None;}
 self.metrics=serde_json::to_value(metric).map_err(|e|e.to_string())?;self.revision+=1;
 }
   },
   "save"=>{let mut p=self.project.clone();p.state=Some(self.scene.state.clone());let file=PathBuf::from(std::env::args().nth(2).ok_or("save path missing")?);if let Some(dir)=file.parent(){std::fs::create_dir_all(dir).map_err(|e|e.to_string())?;}p.save(&file)?;let saved:Value=serde_json::from_str(&std::fs::read_to_string(file).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;return Ok(json!({"project":saved,"revision":self.revision}))},
   "snapshot"=>{},_=>return Err("Unknown session operation".into())
  }
  Ok(self.snapshot(v["avatar"].as_bool().unwrap_or(false),v["graphics"].as_bool().unwrap_or(false)))
 }
}
fn main(){
 // Keep desktop release detection independent of loaded garment files and
 // Metal initialization: the app's Node bridge uses this preflight so a
 // mistakenly bundled CPU-only binary cannot blank the 2D/3D workspace.
 if std::env::args().any(|arg|arg=="--exo-capabilities"){
  println!("{}",json!({"ok":true,"desktopFeature":cfg!(feature="desktop"),"gpuSimulation":cfg!(feature="desktop")}));
  return;
 }
 rayon::ThreadPoolBuilder::new().num_threads(2).build_global().unwrap();
 let avatar=PathBuf::from(std::env::args().nth(1).expect("avatar path required"));
 let mut session:Option<Session>=None;
 for line in io::stdin().lock().lines(){
  let line=match line{Ok(s)=>s,Err(_)=>break};
  let result=(||->Result<Value,String>{
   let v:Value=serde_json::from_str(&line).map_err(|e|e.to_string())?;
   if v["op"]=="open" {
    let mut p=if let Some(value)=v.get("project"){serde_json::from_value::<FittingProject>(value.clone()).map_err(|e|e.to_string())?}else{
     FittingProject::basic(if v["preset"]=="dress"{GarmentKind::Dress}else{GarmentKind::Tshirt},2,avatar.clone())
    };
    // All imports use the exact bundled upstream mannequin, never caller-controlled files.
    p.avatar_path=avatar.clone();
    if let Some(t)=v.get("template"){p.template=serde_json::from_value(t.clone()).map_err(|e|e.to_string())?;p.state=None;p.mesh_signature=None;}
    p.validate_print_graphics(&p.print_graphics)?;
    p.validate_imported_hardware(&p.imported_hardware)?;
    let next=Session::new(p)?;let out=next.snapshot(true,true);session=Some(next);return Ok(out)
   }
   session.as_mut().ok_or("Open a garment first")?.request(&v)
  })();
  let response=match result{Ok(data)=>json!({"ok":true,"data":data}),Err(error)=>json!({"ok":false,"error":error,"data":session.as_ref().map(|s|s.snapshot(false,false))})};
  println!("{}",response);let _=io::stdout().flush();
 }
}
