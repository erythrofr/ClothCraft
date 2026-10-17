#include "mesh_avatar_contact.hpp"
#include <algorithm>
#include <cmath>
#include <regex>
#include <stdexcept>
#include <vector>
namespace garment {
namespace {
struct V{double x,y,z;V operator+(V b)const{return{x+b.x,y+b.y,z+b.z};}V operator-(V b)const{return{x-b.x,y-b.y,z-b.z};}V operator*(double s)const{return{x*s,y*s,z*s};}double dot(V b)const{return x*b.x+y*b.y+z*b.z;}V cross(V b)const{return{y*b.z-z*b.y,z*b.x-x*b.z,x*b.y-y*b.x};}double norm()const{return std::sqrt(dot(*this));}};
V vector(const Json& p){if(p.is_array()&&p.size()==3)return{p[0].get<double>(),p[1].get<double>(),p[2].get<double>()};return{p.at("x").get<double>(),p.at("y").get<double>(),p.at("z").get<double>()};}
Json json(V v){return Json::array({v.x,v.y,v.z});}
const Json& property(const Json& o,const char* k){static const Json empty;if(o.is_object()&&o.contains(k))return o.at(k);return empty;}
double number(const Json& o,const char* k,double fallback){auto& v=property(o,k);return v.is_number()?v.get<double>():fallback;}
std::string name(const Json& o,const char* k){auto& v=property(o,k);return v.is_string()?v.get<std::string>():"";}
const Json& array(const Json& o,const char* k){static const Json empty=Json::array();auto& v=property(o,k);return v.is_array()?v:empty;}
V closest(V p,V a,V b,V c){V ab=b-a,ac=c-a,ap=p-a;double d1=ab.dot(ap),d2=ac.dot(ap);if(d1<=0&&d2<=0)return a;V bp=p-b;double d3=ab.dot(bp),d4=ac.dot(bp);if(d3>=0&&d4<=d3)return b;double vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return a+ab*(d1/(d1-d3));V cp=p-c;double d5=ab.dot(cp),d6=ac.dot(cp);if(d6>=0&&d5<=d6)return c;double vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return a+ac*(d2/(d2-d6));double va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return b+(c-b)*((d4-d3)/((d4-d3)+(d5-d6)));double denom=va+vb+vc;if(std::abs(denom)<1e-20)return a;return a+ab*(vb/denom)+ac*(vc/denom);}
double rayHit(V p,V dir,V a,V b,V c){V e1=b-a,e2=c-a,h=dir.cross(e2);double det=e1.dot(h);if(std::abs(det)<1e-12)return -1;double inv=1/det;V s=p-a;double u=s.dot(h)*inv;if(u<0||u>1)return -1;V q=s.cross(e1);double v=dir.dot(q)*inv;if(v<0||u+v>1)return -1;double t=e2.dot(q)*inv;return t>=1e-5?t:-1;}
std::vector<std::array<V,3>> triangles(const Json& collider){std::vector<std::array<V,3>> result;for(const auto& t:array(collider,"triangles"))if(t.is_array()&&t.size()==3)result.push_back({vector(t[0]),vector(t[1]),vector(t[2])});return result;}
}
Json selectAvatarBodyMeshes(const Json& avatar,const std::string& model){
 Json meshes=Json::array(),names=Json::array();const std::regex body(R"((^|[_\s.\-])body([_\s.\-]|$))",std::regex::icase);
 for(const auto& mesh:array(avatar,"meshes")){
  if(model=="clo-thomas"&&!std::regex_search(name(mesh,"name"),body)&&!std::regex_search(name(mesh,"parentName"),body)&&!std::regex_search(name(mesh,"geometryName"),body))continue;
  meshes.push_back(mesh);names.push_back(name(mesh,"name"));
 }
 return {{"meshes",meshes},{"names",names},{"mode",model=="clo-thomas"?(meshes.empty()?"no-body":"body-only"):"all-meshes"}};
}
Json createAvatarMeshCollider(const Json& avatar,const Json& options){
 double limit=number(options,"maxTriangles",250000);Json tri=Json::array();int skipped=0;V lo{INFINITY,INFINITY,INFINITY},hi{-INFINITY,-INFINITY,-INFINITY};
 for(const auto& mesh:array(avatar,"meshes")){
  if(property(mesh,"visible")==false)continue;
  const auto& verts=array(mesh,"vertices");if(verts.empty())continue;
  Json faces=array(mesh,"faces");if(faces.empty()){for(std::size_t i=0;i+2<verts.size();i+=3)faces.push_back({i,i+1,i+2});}
  if(tri.size()+faces.size()>limit){++skipped;continue;}
  for(const auto& face:faces){if(!face.is_array()||face.size()!=3)throw std::invalid_argument("Invalid avatar triangle");Json t=Json::array();for(const auto& idx:face){auto n=idx.get<std::size_t>();if(n>=verts.size())throw std::out_of_range("Avatar triangle vertex index");V v=vector(verts[n]);t.push_back(json(v));lo={std::min(lo.x,v.x),std::min(lo.y,v.y),std::min(lo.z,v.z)};hi={std::max(hi.x,v.x),std::max(hi.y,v.y),std::max(hi.z,v.z)};}tri.push_back(t);}
 }
 if(tri.empty())return nullptr;
 return {{"triangles",tri},{"bounds",{{"min",json(lo)},{"max",json(hi)}}},{"triangleCount",tri.size()},{"trianglesCount",tri.size()},{"skippedMeshes",skipped}};
}
Json sampleMeshContact(const Json& collider,const Json& point,const Json& options){
 if(!collider.is_object())return nullptr;
 auto tris=triangles(collider);V p=vector(point),nearest{};double best=INFINITY;
 for(const auto& t:tris){V q=closest(p,t[0],t[1],t[2]);double d=(q-p).norm();if(d<best){best=d;nearest=q;}}
 if(tris.empty())return nullptr;
 double clearance=std::max(0.,number(options,"clearance",.003));bool inside=false;
 if(best<std::max(.06,clearance*4)){
  V dir{.71831,.29412,.63037};dir=dir*(1/dir.norm());V origin=p;int crossings=0;
  for(int i=0;i<32;++i){double hit=INFINITY;for(const auto& t:tris){double distance=rayHit(origin,dir,t[0],t[1],t[2]);if(distance>=0)hit=std::min(hit,distance);}if(!std::isfinite(hit))break;++crossings;origin=origin+dir*(hit+.0001);}
  inside=crossings>0&&crossings<32&&crossings%2==1;
 }
 V delta=p-nearest;V direction=best>1e-8?delta*((inside?-1.:1.)/best):V{};
 return {{"inside",inside},{"distance",best},{"intrusion",inside?best+clearance:clearance-best},{"nearest",json(nearest)},{"direction",json(direction)}};
}
Json correctMeshAvatarContacts(Json& simulation,const Json& collider,const Json& options){
 double limit=std::max(0.,std::min(.006,number(options,"maxCorrectionM",.002))),clearance=std::max(0.,number(options,"clearance",.002));
 int checked=0,nearby=0,moved=0;double largest=0;
 if(!collider.is_object())throw std::invalid_argument("Collider required");
 V lo=vector(collider.at("bounds").at("min")),hi=vector(collider.at("bounds").at("max"));
 if(!simulation.is_object()||!simulation.contains("pieces"))return {{"checked",0},{"nearby",0},{"moved",0},{"maximumIntrusionMm",0},{"collisionCertified",false}};
 for(auto& [id,piece]:simulation["pieces"].items())for(auto& particle:piece["particles"]){
  if(number(particle,"invMass",1)<=0)continue;V p=vector(particle.at("position"));
  if(p.x<lo.x-.05||p.x>hi.x+.05||p.y<lo.y-.05||p.y>hi.y+.05||p.z<lo.z-.05||p.z>hi.z+.05)continue;
  ++checked;Json contact=sampleMeshContact(collider,json(p),{{"clearance",clearance},{"maxDistance",.035}});if(contact.is_null())continue;
  double d=contact.at("distance").get<double>();if(d<.025)++nearby;double intrusion=contact.at("intrusion").get<double>();
  if(intrusion<=0||d>.035||limit==0)continue;
  largest=std::max(largest,intrusion*1000);p=p+vector(contact.at("direction"))*std::min(limit,intrusion);
  particle["position"]={{"x",p.x},{"y",p.y},{"z",p.z}};particle["previous"]=particle["position"];++moved;
 }
 return {{"checked",checked},{"nearby",nearby},{"moved",moved},{"maximumIntrusionMm",std::floor(largest*100+.5)/100},{"collisionCertified",false}};
}
}
