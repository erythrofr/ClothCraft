#include "avatar_surface_correction.hpp"
#include "avatar_physics.hpp"
#include <algorithm>
#include <cmath>
#include <set>
#include <string>
namespace garment::avatar_surface_correction {
using namespace avatar_physics;
static double n(const Json& j,const char* k,double d=0){return j.is_object()&&j.contains(k)&&j[k].is_number()?j[k].get<double>():d;}
static double clamp(double x,double a,double b){return std::max(a,std::min(b,x));}
struct V {double x=0,y=0,z=0;};
static V read(const Json& p){return {n(p,"x"),n(p,"y"),n(p,"z")};}
static Json write(V v){return Json{{"x",v.x},{"y",v.y},{"z",v.z}};}
static V add(V a,V b){return {a.x+b.x,a.y+b.y,a.z+b.z};}
static V sub(V a,V b){return {a.x-b.x,a.y-b.y,a.z-b.z};}
static V mul(V a,double s){return {a.x*s,a.y*s,a.z*s};}
static double dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}
static double mag(V a){return std::sqrt(dot(a,a));}
// Surface sampling uses the same sequential Vector3 additions as THREE.
// Keep this local to correction; the general avatar physics adapter is shared.
static Json surfaceMeasure(const Json& sim,const Json& avatar,double epsilon){
 Json result={{"facesChecked",0},{"samplesChecked",0},{"penetratingSamples",0},{"penetratingFaces",0},{"maximumIntrusionMm",0.0},{"byPiece",Json::object()}};
 const double weights[4][3]={{1./3,1./3,1./3},{.5,.5,0},{0,.5,.5},{.5,0,.5}};
 for(const auto& piece:sim.at("pieces")){
  Json metrics={{"facesChecked",0},{"penetratingFaces",0},{"penetratingSamples",0},{"maximumIntrusionMm",0.0}};
  const auto& particles=piece.at("particles");
  for(const auto& face:piece.value("faces",Json::array())){
   if(!face.is_array()||face.size()!=3)continue;
   int ids[3]={face[0].get<int>(),face[1].get<int>(),face[2].get<int>()};
   if(ids[0]<0||ids[1]<0||ids[2]<0||ids[0]>=int(particles.size())||ids[1]>=int(particles.size())||ids[2]>=int(particles.size()))continue;
   const Json &a=particles[ids[0]],&b=particles[ids[1]],&c=particles[ids[2]];
   metrics["facesChecked"]=metrics["facesChecked"].get<int>()+1;result["facesChecked"]=result["facesChecked"].get<int>()+1;
   bool penetrating=false;
   for(const auto& w:weights){
    V point{};const Json* corners[3]={&a,&b,&c};
    for(int i=0;i<3;i++)point=add(point,mul(read(corners[i]->at("position")),w[i]));
    Json position=write(point);
    Json hint={{"position",position},{"wrapMode",a.value("wrapMode",std::string())},{"patternV",(n(a,"patternV")+n(b,"patternV")+n(c,"patternV"))/3},{"seamIds",a.value("seamIds",Json::array())}};
    double clearance=avatarClearance(position,avatar,hint);
    result["samplesChecked"]=result["samplesChecked"].get<int>()+1;
    if(clearance<-epsilon){double mm=-clearance*1000;penetrating=true;
     for(auto* m:{&metrics,&result}){(*m)["penetratingSamples"]=(*m)["penetratingSamples"].get<int>()+1;(*m)["maximumIntrusionMm"]=std::max((*m)["maximumIntrusionMm"].get<double>(),mm);}}
   }
   if(penetrating){metrics["penetratingFaces"]=metrics["penetratingFaces"].get<int>()+1;result["penetratingFaces"]=result["penetratingFaces"].get<int>()+1;}
  }
  result["byPiece"][piece.at("id").get<std::string>()]=metrics;
 }
 result["maximumIntrusionMm"]=std::round(result["maximumIntrusionMm"].get<double>()*1000)/1000;
 return result;
}
static void ellipse(Json& p,V c,V r,double margin,bool preserveY=false,bool limited=false,double maxLateral=.018){
 V pos=read(p["position"]),d=sub(pos,c);r=add(r,{margin,margin,margin});
 double q=0, sx=r.x,sz=r.z;
 if(preserveY||limited){double ny=d.y/std::max(1e-6,r.y);if(std::abs(ny)>=1)return;double section=std::sqrt(std::max(1e-6,1-ny*ny));sx*=section;sz*=section;q=d.x*d.x/(sx*sx)+d.z*d.z/(sz*sz);}
 else q=d.x*d.x/(r.x*r.x)+d.y*d.y/(r.y*r.y)+d.z*d.z/(r.z*r.z);
 if(q>=1)return;
 if(!preserveY&&!limited){if(q<=1e-6)return;pos=add(c,mul(d,1/std::sqrt(q)));}
 else {double side=n(p,"collisionSideZ",0);if(!side)side=d.z<0?-1:1;
  if(q<=1e-6||std::abs(n(p,"patternU",1))<.78){pos.z=c.z+side*sz*(limited?std::sqrt(std::max(0.,1-d.x*d.x/(sx*sx))):1);}
  else {double scale=1/std::sqrt(std::max(q,1e-6));pos.x=c.x+d.x*scale;pos.z=c.z+d.z*scale;}
  if(limited){V movement=sub(pos,read(p["position"]));double factor=std::min(1.,std::max(.001,maxLateral)/std::max(mag(movement),1e-6));pos=add(read(p["position"]),mul(movement,factor));}}
 p["position"]=write(pos);
}
static void vertical(Json& p,double rx,double rz,double margin){
 V pos=read(p["position"]);rx+=margin;rz+=margin;double q=pos.x*pos.x/(rx*rx)+pos.z*pos.z/(rz*rz);if(q>=1)return;
 std::string wrap=p.value("wrapMode",std::string());bool torso=wrap=="front"||wrap=="back";double side=n(p,"collisionSideZ",0);if(!side)side=n(p["previous"],"z")<0?-1:1;
 if(q<=1e-6||(torso&&(std::abs(n(p,"patternU",1))<.78||pos.y/std::max(.001,n(p,"avatarHeightScale",1))<1.54))){pos.z=side*rz;}
 else{double s=1/std::sqrt(q);pos.x*=s;pos.z*=s;}p["position"]=write(pos);
}
static void capsule(Json& p,const Json& pose,double margin){
 V c=read(pose["center"]),axis=read(pose["axis"]);double half=pose["halfLength"],radius=pose["radius"].get<double>()+margin;
 V start=sub(c,mul(axis,half)),seg=mul(axis,2*half),pos=read(p["position"]);double t=clamp(dot(sub(pos,start),seg)/std::max(1e-6,dot(seg,seg)),0,1),deltaLen;V closest=add(start,mul(seg,t)),delta=sub(pos,closest);deltaLen=mag(delta);
 if(deltaLen>=radius)return;
 if(deltaLen<=1e-6)delta={0,0,n(p,"collisionSideZ",1)};
 else delta=mul(delta,1/deltaLen);
 p["position"]=write(add(closest,mul(delta,radius)));
}
static bool cap(const Json& p,const Json& upper){
 std::string wrap=p.value("wrapMode",std::string());double pv=n(p,"patternV",1);
 if(wrap=="front"||wrap=="back"){bool seam=false;if(p.contains("seamIds")&&p["seamIds"].is_array())for(const auto& id:p["seamIds"])if(id.is_string()){auto s=id.get<std::string>();std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return std::tolower(c);});if(s.find("shoulder")!=std::string::npos)seam=true;}return seam||pv>=.86;}
 if(wrap=="left-arm"||wrap=="right-arm")return pv>=.72;
 return n(p["position"],"y")>=upper["shoulderCenterY"].get<double>()-upper["shoulderCapRadiusY"].get<double>()*.45;
}
static void collide(Json& p,const Json& avatar,double margin){
 Json u=getAvatarUpperBodyDimensions(avatar);double h=u["heightScale"],y=n(p["position"],"y");std::string wrap=p.value("wrapMode",std::string());
 bool leg=wrap.rfind("left-leg-",0)==0||wrap.rfind("right-leg-",0)==0;
 if(y>=.56*h&&y<=1.49*h&&(!leg||y>=clamp(n(avatar,"legTorsoCollisionStartY",.76),.56,.80)*h)){auto r=getAvatarTorsoRadii(avatar,y);vertical(p,r["x"],r["z"],margin);}
 V shoulder{0,u["shoulderCenterY"],0},sr{u["shoulderCapRadiusX"],u["shoulderCapRadiusY"],u["shoulderCapRadiusZ"]};
 std::string mode=avatar.value("shoulderContactMode",std::string());bool bodice=wrap=="front"||wrap=="back";
 bool limited=(mode=="limited-lateral"||(mode=="adaptive-limited-lateral"&&n(avatar,"heightCm",180)>=175&&n(avatar,"heightCm",180)<=190))&&bodice;
 if(limited)ellipse(p,shoulder,sr,margin,false,true,n(avatar,"shoulderMaxLateralCorrectionM",.018));
 else if(mode=="lateral"&&bodice&&n(p,"patternV",1)>=n(avatar,"shoulderLateralPatternV",0))ellipse(p,shoulder,sr,margin,true);
 else if(cap(p,u))ellipse(p,shoulder,sr,margin);
 else if(bodice)ellipse(p,shoulder,sr,margin,true);
 y=n(p["position"],"y");
 bool near=bodice&&y>u["shoulderCenterY"].get<double>()-u["shoulderCapRadiusY"].get<double>()*1.15&&std::abs(n(p["position"],"x"))<u["shoulderHalfWidth"].get<double>()+.025;
 if(!near){capsule(p,getAvatarArmPose(avatar,-1),margin);capsule(p,getAvatarArmPose(avatar,1),margin);}
 if(!bodice||std::abs(n(p["position"],"x"))<u["neckRadius"].get<double>()*.86||n(p["position"],"y")>1.735*h)ellipse(p,{0,u["neckCenterY"],0},{u["neckRadius"],u["neckRadiusY"],u["neckRadius"]},margin);
 if(!bodice||n(p["position"],"y")>1.755*h)ellipse(p,{0,1.88*h,0},{.15,.19*h,.15},margin);
 if(wrap.rfind("left-leg",0)==0)ellipse(p,{-.105,.24*h,0},{.09,.48*h,.10},margin);
 else if(wrap.rfind("right-leg",0)==0)ellipse(p,{.105,.24*h,0},{.09,.48*h,.10},margin);
 else{ellipse(p,{-.105,.24*h,0},{.09,.48*h,.10},margin);ellipse(p,{.105,.24*h,0},{.09,.48*h,.10},margin);}
 if(n(p["position"],"y")<.01)p["position"]["y"]=.01;
}
Json correctAvatarSurfaceIntrusion(Json& simulation,const Json& project,const Json& options){
 double maxCorrection=clamp(n(options,"maxCorrectionM",.003),0,.008),epsilon=clamp(n(options,"epsilonM",.0005),0,.005);
 Json before=surfaceMeasure(simulation,project.at("avatar"),epsilon);
 Json result={{"before",before},{"after",before},{"correctedFaces",0},{"correctedVertices",0},{"accepted",false}};
 if(before["penetratingFaces"]==0||maxCorrection==0||(project.contains("simulation")&&project["simulation"].is_object()&&project["simulation"].value("collisions",true)==false))return result;
 Json baseline=simulation;std::set<std::pair<size_t,size_t>> affected;
 for(size_t pi=0;pi<simulation["pieces"].size();++pi){auto& piece=simulation["pieces"][pi];auto& particles=piece["particles"];double margin=n(project.value("simulation",Json::object()),"collisionMargin",.012)+n(piece.value("fabric",Json::object()),"thickness",.002);
 for(const auto& face:piece.value("faces",Json::array())){
  std::vector<size_t> indices;V centroid{};bool valid=true;for(const auto& raw:face){int index=raw.get<int>();if(index<0||index>=int(particles.size())){valid=false;break;}indices.push_back(size_t(index));centroid=add(centroid,read(particles[index]["position"]));}
  if(!valid||indices.size()!=3)continue;centroid=mul(centroid,1./3);std::vector<size_t> movable;for(size_t idx:indices)if(n(particles[idx],"invMass")>0)movable.push_back(idx);if(movable.empty())continue;
  auto& first=particles[indices[0]];Json proxy={{"position",write(centroid)},{"previous",write(centroid)},{"invMass",1},{"wrapMode",first.value("wrapMode",std::string())},{"patternU",(n(particles[indices[0]],"patternU")+n(particles[indices[1]],"patternU")+n(particles[indices[2]],"patternU"))/3},{"patternV",(n(particles[indices[0]],"patternV")+n(particles[indices[1]],"patternV")+n(particles[indices[2]],"patternV"))/3},{"collisionSideZ",n(first,"collisionSideZ",0)}};
  if(avatarClearance(proxy["position"],project["avatar"],proxy)>=-epsilon)continue;
  collide(proxy,project["avatar"],margin);V displacement=sub(read(proxy["position"]),centroid);double length=mag(displacement);if(!std::isfinite(length)||length*length<1e-12)continue;
  displacement=mul(displacement,std::min(1.,maxCorrection/length)/movable.size());
  for(auto idx:movable){particles[idx]["position"]=write(add(read(particles[idx]["position"]),displacement));affected.insert({pi,idx});}
  result["correctedFaces"]=result["correctedFaces"].get<int>()+1;
 }}
 result["correctedVertices"]=affected.size();result["after"]=surfaceMeasure(simulation,project["avatar"],epsilon);
 bool accepted=result["after"]["penetratingFaces"].get<int>()<before["penetratingFaces"].get<int>()&&result["after"]["maximumIntrusionMm"].get<double>()<=before["maximumIntrusionMm"].get<double>()+.5;
 result["accepted"]=accepted;
 if(!accepted){simulation=baseline;result["after"]=before;}
 else for(auto [pi,idx]:affected)simulation["pieces"][pi]["particles"][idx]["previous"]=simulation["pieces"][pi]["particles"][idx]["position"];
 return result;
}
}
