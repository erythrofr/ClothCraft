//! Independent geometric offset construction, using sampled material contours.
//! Original implementation; no third-party geometry code incorporated.
use super::polygon::PolygonPattern;
use glam::DVec2;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CutlineEdge { pub name: String, pub allowance_m: f64, pub start: usize, pub end: usize }
/// Separate marking layer. Experimental geometry, not manufacturer certified.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CutlineNotch { pub edge_id: String, pub t: f64, pub depth_m: f64, pub cut_start: DVec2, pub inner_end: DVec2 }
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProductionCutline { pub points: Vec<DVec2>, pub edges: Vec<CutlineEdge>, pub notches: Vec<CutlineNotch>, pub perimeter_m: f64, pub area_m2: f64 }

fn cross(a: DVec2,b:DVec2)->f64 { a.perp_dot(b) }
fn intersect(a:DVec2,b:DVec2,c:DVec2,d:DVec2)->bool {
    let ab=b-a; let cd=d-c;
    let x=cross(ab,cd);
    if x.abs()<1e-12 { return cross(c-a,ab).abs()<1e-12 && (c-a).dot(ab)>=-1e-12 && (c-a).dot(ab)<=ab.length_squared()+1e-12; }
    let t=cross(c-a,cd)/x; let u=cross(c-a,ab)/x;
    t>=-1e-10 && t<=1.+1e-10 && u>=-1e-10 && u<=1.+1e-10
}
fn check_loop(p:&[DVec2])->Result<f64,String> {
    if p.len()<3 || p.iter().any(|v| !v.is_finite()) {return Err("Cutline requires at least three finite vertices".into())}
    let n=p.len(); let mut area=0.;
    for i in 0..n { let j=(i+1)%n; if p[i].distance(p[j])<1e-9 {return Err(format!("Collapsed contour segment {i}"))} area+=cross(p[i],p[j]); }
    if area<=1e-12 {return Err("Contour must have positive CCW area".into())}
    for i in 0..n { for j in (i+1)..n {if j==i+1 || (i==0 && j==n-1) {continue} if intersect(p[i],p[(i+1)%n],p[j],p[(j+1)%n]) {return Err(format!("Self-intersection between segments {i} and {j}"))} } }
    Ok(area/2.)
}
/// Returns a closed CCW contour (closure implicit). Widths are in metres.
/// Joins use bounded miters. Acute corners, holes, topology collisions and
/// missing allowances fail closed pending a topology-aware offset kernel.
pub fn production_cutline(p:&PolygonPattern)->Result<ProductionCutline,String> {
    if !p.holes.is_empty() || !p.lines.is_empty() {return Err("Holes and internal lines require topology-aware production processing".into())}
    let n=p.points.len(); if n<3 || p.edges.len()!=n {return Err("Invalid panel topology".into())}
    let mut names=BTreeSet::new(); let mut path=Vec::new(); let mut widths=Vec::new(); let mut ownership=Vec::new();
    for i in 0..n {
        let name=&p.edges[i]; if name.is_empty() || !names.insert(name.clone()) {return Err("Missing or duplicate stable edge name".into())}
        let w=*p.seam_allowances.get(name).ok_or_else(||format!("Missing seam allowance: {name}"))?;
        if !w.is_finite() || !(0.0..=0.5).contains(&w) {return Err(format!("Allowance outside 0..500 mm: {name}"))}
        let samples=p.edge_points(i)?;
        if samples.len()<2 {return Err(format!("Empty sampled edge: {name}"))}
        for v in samples.iter().take(samples.len()-1) {path.push(*v);widths.push(w);ownership.push(i);}
    }
    if p.seam_allowances.keys().any(|k| !names.contains(k)) {return Err("Allowance refers to unknown edge".into())}
    let source_area=check_loop(&path)?;
    let m=path.len(); let mut out=Vec::with_capacity(m);
    for i in 0..m {
        let prev=(i+m-1)%m; let next=(i+1)%m;
        let d0=(path[i]-path[prev]).normalize(); let d1=(path[next]-path[i]).normalize();
        let n0=DVec2::new(d0.y,-d0.x);let n1=DVec2::new(d1.y,-d1.x);
        let a=path[i]+n0*widths[prev];let b=path[i]+n1*widths[i];
        let denom=cross(d0,d1);
        let q=if denom.abs()<1e-10 {
            if d0.dot(d1)<0.999999 {return Err(format!("Reentrant cusp at sample {i}"))}
            if (widths[prev]-widths[i]).abs()>1e-9 {return Err(format!("Unequal allowance at collinear join {i} requires bevel"))}
            a
        } else {a+d0*(cross(b-a,d1)/denom)};
        if !q.is_finite() || q.distance(path[i])>10.*widths[prev].max(widths[i]).max(1e-6) {return Err(format!("Miter limit exceeded at sample {i}"))}
        out.push(q);
    }
    let area=check_loop(&out)?;
    if area+1e-10<source_area {return Err("Offset reduced panel area; unsafe corner topology".into())}
    let perimeter=out.iter().enumerate().map(|(i,v)|v.distance(out[(i+1)%m])).sum();
    let mut edges=Vec::new();
    for i in 0..n {let start=ownership.iter().position(|&v|v==i).ok_or("Empty named edge")?;let end=ownership.iter().rposition(|&v|v==i).unwrap()+1;edges.push(CutlineEdge{name:p.edges[i].clone(),allowance_m:p.seam_allowances[&p.edges[i]],start,end:end%m});}
    let mut notches=Vec::new();
    for (name, marks) in &p.notches {
        let edge_index=p.edges.iter().position(|id|id==name).ok_or_else(||format!("Notch references missing edge: {name}"))?;
        let width=p.seam_allowances[name];
        let sampled=p.edge_points(edge_index)?;
        let total:f64=sampled.windows(2).map(|pair|pair[0].distance(pair[1])).sum();
        if !total.is_finite() || total<1e-9 {return Err(format!("Invalid notch edge length: {name}"))}
        for mark in marks {
            if !mark.t.is_finite() || !(0.0..1.0).contains(&mark.t) || mark.t==0. || !mark.depth_m.is_finite() || mark.depth_m<=0. || mark.depth_m>width+1e-10 {return Err(format!("Invalid notch station or depth exceeds allowance: {name}"))}
            let station=total*mark.t;
            let mut consumed=0.;let mut found=None;
            for pair in sampled.windows(2) {
                let v=pair[1]-pair[0];let length=v.length();
                if length<=1e-10 {return Err(format!("Degenerate notch source segment: {name}"))}
                if consumed+length>=station { let origin=pair[0]+v*((station-consumed)/length);let normal=DVec2::new(v.y,-v.x)/length;found=Some((origin,normal));break }
                consumed+=length;
            }
            let (origin,normal)=found.ok_or_else(||format!("Notch station missing: {name}"))?;
            let mut hits=Vec::new();
            for j in 0..out.len() {
                let a=out[j];let d=out[(j+1)%out.len()]-a;let denom=cross(normal,d);
                if denom.abs()<1e-12 {continue}
                let ray=cross(a-origin,d)/denom;let segment=cross(a-origin,normal)/denom;
                if ray>1e-9 && segment>=-1e-9 && segment<=1.+1e-9 && ray.is_finite() { hits.push((ray,j,origin+normal*ray)); }
            }
            hits.sort_by(|a,b|a.0.total_cmp(&b.0));
            if hits.len()!=1 || ownership[hits[0].1]!=edge_index || (hits[0].0-width).abs()>0.001 {return Err(format!("Ambiguous or incorrect cut-boundary notch projection: {name}"))}
            let cut_start=hits[0].2;let inner_end=cut_start-normal*mark.depth_m;
            if !cut_start.is_finite() || !inner_end.is_finite() {return Err(format!("Nonfinite notch marking: {name}"))}
            if notches.iter().any(|previous: &CutlineNotch|previous.cut_start.distance(cut_start)<1e-5) {return Err("Conflicting notch markings".into())}
            notches.push(CutlineNotch{edge_id:name.clone(),t:mark.t,depth_m:mark.depth_m,cut_start,inner_end});
        }
    }
    Ok(ProductionCutline{points:out,edges,notches,perimeter_m:perimeter,area_m2:area})
}
