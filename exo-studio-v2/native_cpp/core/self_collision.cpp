#include "self_collision.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <map>
#include <set>
#include <string>
#include <vector>
namespace garment {
namespace {
constexpr double eps=1e-6;
struct Vec {double x=0,y=0,z=0;
 Vec operator+(Vec b)const{return {x+b.x,y+b.y,z+b.z};}
 Vec operator-(Vec b)const{return {x-b.x,y-b.y,z-b.z};}
 Vec operator*(double s)const{return {x*s,y*s,z*s};}
 double sq()const{return x*x+y*y+z*z;}
 Vec normalized()const {double n=std::sqrt(sq());return n?(*this)*(1/n):Vec{};}
 double dot(Vec b)const{return x*b.x+y*b.y+z*b.z;}
};
double num(const Json& j,const char* k,double fallback=0){if(!j.is_object()||!j.contains(k)||j[k].is_null())return fallback;return j[k].is_number()?j[k].get<double>():fallback;}
std::string str(const Json& j,const char* k){return j.is_object()&&j.contains(k)&&j[k].is_string()?j[k].get<std::string>():"";}
Vec pos(const Json& p){const auto& v=p.at("position");return {num(v,"x"),num(v,"y"),num(v,"z")};}
void put(Json& p,Vec v){p["position"]["x"]=v.x;p["position"]["y"]=v.y;p["position"]["z"]=v.z;}
Vec outward(const Json& p){
 const auto m=str(p,"wrapMode");double cx=0;
 if(m=="left-arm")cx=-.285;else if(m=="right-arm")cx=.285;
 else if(m.rfind("left-leg",0)==0)cx=-.105;else if(m.rfind("right-leg",0)==0)cx=.105;
 Vec d{pos(p).x-cx,0,pos(p).z};
 if(d.sq()<=eps)return {0,0,num(p,"collisionSideZ",1)};
 return d.normalized();
}
std::set<std::string> strings(const Json& sim,const char* k){std::set<std::string> out;if(sim.contains(k)&&sim[k].is_array())for(const auto& e:sim[k])if(e.is_string())out.insert(e.get<std::string>());return out;}
}
void resolveSelfCollisions(Json& sim,double minimumDistance){
 if(minimumDistance<=eps)return;
 auto& pieces=sim.at("pieces");
 std::vector<Json*> particles;
 std::map<std::array<long long,3>,std::vector<Json*>> grid;
 const auto cell=[&](const Json& p){Vec v=pos(p);return std::array<long long,3>{static_cast<long long>(std::floor(v.x/minimumDistance)),static_cast<long long>(std::floor(v.y/minimumDistance)),static_cast<long long>(std::floor(v.z/minimumDistance))};};
 for(auto it=pieces.begin();it!=pieces.end();++it)for(auto& p:it.value().at("particles")){particles.push_back(&p);grid[cell(p)].push_back(&p);}
 const auto fused=strings(sim,"fusedPiecePairs"),excluded=strings(sim,"collisionExclusions");
 std::map<long long,Vec> corrections;
 for(Json* p:particles){
  if(num(*p,"invMass")<=0)continue;
  auto c=cell(*p);
  for(int dx=-1;dx<=1;++dx)for(int dy=-1;dy<=1;++dy)for(int dz=-1;dz<=1;++dz){
   auto found=grid.find({c[0]+dx,c[1]+dy,c[2]+dz});if(found==grid.end())continue;
   for(Json* q:found->second){
    const auto a=static_cast<long long>(num(*p,"simIndex")),b=static_cast<long long>(num(*q,"simIndex"));
    if(b<=a)continue;
    const auto pa=str(*p,"pieceId"),pb=str(*q,"pieceId");
    if(pa!=pb&&fused.count(std::min(pa,pb)+"|"+std::max(pa,pb)))continue;
    if(excluded.count(std::to_string(a)+":"+std::to_string(b)))continue;
    Vec delta=pos(*q)-pos(*p);
    const double ds=delta.sq();
    if(ds>=minimumDistance*minimumDistance)continue;
    const double distance=std::sqrt(std::max(ds,eps));
    const double la=num(*p,"layerIndex"),lb=num(*q,"layerIndex");
    if(la!=lb){
     const Json& high=la>lb?*p:*q;
     Vec preferred=outward(high)*(lb>la?1:-1);
     if(ds<=eps)delta=preferred;
     else {delta=delta*(1/distance);if(delta.dot(preferred)<.65)delta=(delta*.18+preferred*.82).normalized();}
    }else if(ds<=eps)delta={1,0,0};
    else delta=delta*(1/distance);
    const double penetration=minimumDistance-distance;
    double wa=num(*p,"invMass"),wb=num(*q,"invMass");
    if(wa+wb<=eps)continue;
    if(la!=lb&&wa>0&&wb>0){wa=la>lb?.9:.1;wb=la>lb?.1:.9;}
    const double total=wa+wb;
    if(wa>0)corrections[a]=corrections[a]+delta*(-penetration*wa/total);
    if(wb>0)corrections[b]=corrections[b]+delta*(penetration*wb/total);
   }
  }
 }
 for(Json* p:particles){const auto idx=static_cast<long long>(num(*p,"simIndex"));auto it=corrections.find(idx);if(it!=corrections.end()&&num(*p,"invMass")>0)put(*p,pos(*p)+it->second);}
}
}
