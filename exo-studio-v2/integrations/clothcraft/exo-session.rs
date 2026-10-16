//! EXO adapter: one persistent upstream document, authoring history and VBD/OGC solver.
use marvelous_cloth::{authoring::{self,Command,History}, fitting::{FittingProject,FittingScene}, garment::{presets::GarmentKind, shapes::{Primitive,MirrorAxis,BooleanOp}, meshing::MeshingSettings}, vbd::{Grab,VbdSolver,VbdSettings}};
use serde::{de::DeserializeOwned};
use serde_json::{Value,json};
use glam::{DVec3,DQuat,EulerRot};
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
 "Dimensions"=>Command::Dimensions{panel:f!("panel"),width:f!("width"),height:f!("height")},
 "Shape"=>Command::Shape{panel:f!("panel"),polygon:f!("polygon")},
 "SplitBoundary"=>Command::SplitBoundary{panel:f!("panel"),edge:f!("edge"),at_m:f!("at_m")},
 "RemovePoint"=>Command::RemovePoint{panel:f!("panel"),point:f!("point")},
 "CurvePoint"=>Command::CurvePoint{panel:f!("panel"),anchor:f!("anchor"),curved:f!("curved")},
 "TargetLength"=>Command::TargetLength{panel:f!("panel"),edge:f!("edge"),target_m:f!("target_m")},
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
 _=>return Err(format!("Unsupported authoring command {op}")),
 })
}
struct Session {project:FittingProject,scene:FittingScene,solver:Option<VbdSolver>,grab:Option<Grab>,live_grab:bool,history:History,revision:u64,metrics:Value, #[cfg(feature="desktop")] gpu:Option<marvelous_cloth::gpu_vbd::GpuVbd>}
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
 Ok(Self{project,scene,solver:None,grab:None,live_grab:false,history:History::default(),revision:0,metrics:Value::Null,#[cfg(feature="desktop")]gpu})
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
 fn snapshot(&self,avatar:bool)->Value {
  let g=&self.scene.garment;
  let panels:Vec<_>=g.panels.iter().enumerate().map(|(i,p)|json!({"id":p.id,"vertices":[p.vertices.start,p.vertices.end],"triangles":[p.triangles.start,p.triangles.end],"boundaries":p.boundaries,"layout":authoring::layout(&self.project.template,i)})).collect();
  let seams:Vec<_>=g.seams.iter().map(|s|json!({"id":s.id,"guides":s.guides,"gap_m":s.max_gap(&self.scene.state.x)})).collect();
  json!({"revision":self.revision,"template":self.project.template,"positions":self.scene.state.x,"uv":g.mesh.uv,"triangles":g.mesh.triangles.iter().map(|t|t.vertices).collect::<Vec<_>>(),"panels":panels,"seams":seams,"time":self.scene.state.time,"metrics":self.metrics,"canUndo":self.history.can_undo(),"canRedo":self.history.can_redo(),"avatar":if avatar {json!({"positions":self.scene.collider.surface.vertices,"triangles":self.scene.collider.surface.triangles})}else{Value::Null},"grabActive":self.grab.is_some(),"grabStiffness":self.grab.as_ref().map(|g|g.stiffness),"backend":if std::env::args().any(|a|a=="--gpu"){"ClothCraft GPU VBD + CPU OGC"}else{"ClothCraft CPU VBD + OGC"},"fitCertified":false})
 }
 fn request(&mut self,v:&Value)->Result<Value,String>{
  let op=v["op"].as_str().unwrap_or("snapshot");
  if !["snapshot","save"].contains(&op) && v["revision"].as_u64()!=Some(self.revision){return Err("Stale document revision; reload current snapshot".into())}
  match op {
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
     match target.as_str(){
       "panel"=>self.project.template.panels.iter_mut().find(|p|p.id==id).ok_or("Panel not found")?.name=value,
       "fabric"=>self.project.template.fabrics.iter_mut().find(|f|f.id==id).ok_or("Fabric not found")?.name=value,
       _=>return Err("Property target must be panel or fabric".into())
     };
     self.revision+=1;
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
     let p=self.project.template.panels.iter_mut().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=p.polygon.as_mut().ok_or("Panel has no editable named edges")?;
     if !polygon.edges.iter().any(|id|id==&edge){return Err("Named boundary not found".into())}
     polygon.target_lengths.insert(edge,length);
     self.revision+=1;
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
  Ok(self.snapshot(v["avatar"].as_bool().unwrap_or(false)))
 }
}
fn main(){
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
    let next=Session::new(p)?;let out=next.snapshot(true);session=Some(next);return Ok(out)
   }
   session.as_mut().ok_or("Open a garment first")?.request(&v)
  })();
  let response=match result{Ok(data)=>json!({"ok":true,"data":data}),Err(error)=>json!({"ok":false,"error":error,"data":session.as_ref().map(|s|s.snapshot(false))})};
  println!("{}",response);let _=io::stdout().flush();
 }
}
