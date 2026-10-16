#include "live_drape_transfer.hpp"
#include <cmath>
#include <limits>
#include <string>
namespace garment {
namespace {
const Json& get(const Json& x,const char* key){static const Json nil;return x.is_object()&&x.contains(key)?x.at(key):nil;}
const Json& arr(const Json& x,const char* key){static const Json empty=Json::array();auto& v=get(x,key);return v.is_array()?v:empty;}
double num(const Json& x,const char* key){const auto& v=get(x,key);return v.is_number()?v.get<double>():std::numeric_limits<double>::quiet_NaN();}
double distance(const Json& a,const Json& b){return std::hypot(num(a,"x")-num(b,"x"),num(a,"y")-num(b,"y"),num(a,"z")-num(b,"z"));}
bool xyz(const Json& p){return p.is_object()&&p.contains("x")&&p.contains("y")&&p.contains("z");}
}
Json captureDrape(const Json& simulation){
 const auto& pieces=get(simulation,"pieces");if(!pieces.is_object())return nullptr;
 Json result=Json::object();
 for(auto it=pieces.begin();it!=pieces.end();++it){
  const auto& flat=arr(it.value(),"flatVertices");const auto& particles=arr(it.value(),"particles");
  if(flat.empty()||particles.empty())continue;
  Json vertices=Json::array();
  for(std::size_t i=0;i<flat.size();++i){
   if(i>=particles.size())throw std::out_of_range("flat vertex has no corresponding particle");
   Json vertex={{"x",get(flat[i],"x")},{"y",get(flat[i],"y")},{"position",get(particles[i],"position")}};
   vertices.push_back(std::move(vertex));
  }
  result[it.key()]={{"vertices",vertices},{"faces",arr(it.value(),"faces")}};
 }
 return result;
}
Json transferDrape(const Json& snapshot,Json& simulation,double maxOffsetM,const Json& validation){
 Json counts={{"transferred",0},{"skipped",0},{"interpolated",0},{"nearest",0}};
 auto& pieces=simulation["pieces"];
 if(!snapshot.is_object()||!pieces.is_object())return {{"transferred",0},{"skipped",0}};
 for(auto it=pieces.begin();it!=pieces.end();++it){
  Json& piece=it.value();
  const Json previous=snapshot.value(it.key(),Json::object());
  const Json& old=arr(previous,"vertices");
  const Json& faces=arr(previous,"faces");
  const Json& flat=arr(piece,"flatVertices");
  if(old.empty()||flat.empty()){counts["skipped"]=counts["skipped"].get<int>()+1;continue;}
  if(!piece.contains("particles")||!piece["particles"].is_array())continue;
  for(std::size_t i=0;i<flat.size();++i){
   const auto& point=flat[i];
   Json best;double bestD=INFINITY;
   for(const auto& face:faces){
    if(!face.is_array()||face.size()<3)continue;
    const auto valid=[&](int j){return face[j].is_number_integer()&&face[j].get<long long>()>=0&&static_cast<std::size_t>(face[j].get<long long>())<old.size();};
    if(!valid(0)||!valid(1)||!valid(2))continue;
    const auto& a=old[face[0].get<std::size_t>()],&b=old[face[1].get<std::size_t>()],&c=old[face[2].get<std::size_t>()];
    const double denom=(num(b,"y")-num(c,"y"))*(num(a,"x")-num(c,"x"))+(num(c,"x")-num(b,"x"))*(num(a,"y")-num(c,"y"));
    if(std::abs(denom)<1e-9)continue;
    const double u=((num(b,"y")-num(c,"y"))*(num(point,"x")-num(c,"x"))+(num(c,"x")-num(b,"x"))*(num(point,"y")-num(c,"y")))/denom;
    const double v=((num(c,"y")-num(a,"y"))*(num(point,"x")-num(c,"x"))+(num(a,"x")-num(c,"x"))*(num(point,"y")-num(c,"y")))/denom;
    const double w=1-u-v;
    if(std::min(u,std::min(v,w))<-1e-5)continue;
    const auto& ap=get(a,"position"),&bp=get(b,"position"),&cp=get(c,"position");
    best={{"position",{{"x",u*num(ap,"x")+v*num(bp,"x")+w*num(cp,"x")},
                      {"y",u*num(ap,"y")+v*num(bp,"y")+w*num(cp,"y")},
                      {"z",u*num(ap,"z")+v*num(bp,"z")+w*num(cp,"z")}}}};
    counts["interpolated"]=counts["interpolated"].get<int>()+1;break;
   }
   if(best.is_null()){
    for(const auto& candidate:old){
     const double dx=num(candidate,"x")-num(point,"x"),dy=num(candidate,"y")-num(point,"y");
     const double d=dx*dx+dy*dy;
     if(d<bestD){bestD=d;best=candidate;}
    }
    counts["nearest"]=counts["nearest"].get<int>()+1;
   }
   if(best.is_null()||i>=piece["particles"].size())continue;
   Json& particle=piece["particles"][i];
   Json& pos=particle["position"];
   const Json original=pos;
   const Json& target=get(best,"position");
   const double dx=num(target,"x")-num(pos,"x"),dy=num(target,"y")-num(pos,"y"),dz=num(target,"z")-num(pos,"z");
   const double length=std::hypot(dx,dy,dz);
   const double factor=length>maxOffsetM?maxOffsetM/length:1;
   pos["x"]=num(pos,"x")+dx*factor;pos["y"]=num(pos,"y")+dy*factor;pos["z"]=num(pos,"z")+dz*factor;
   const auto& cap=get(validation,"maxDistanceFromOriginalM");
   if(cap.is_number()&&distance(pos,original)>cap.get<double>()){
    pos=original;counts["skipped"]=counts["skipped"].get<int>()+1;continue;
   }
   particle["previous"]=pos;
   counts["transferred"]=counts["transferred"].get<int>()+1;
  }
 }
 return counts;
}
Json measureSeamGap(const Json& simulation){
 double max=0,sum=0;int count=0;
 for(const auto& seam:arr(simulation,"seamConstraints")){
  const auto& a=get(get(seam,"a"),"position"),&b=get(get(seam,"b"),"position");
  if(!xyz(a)||!xyz(b))continue;
  const double gap=distance(a,b)*1000;
  if(!std::isfinite(gap))continue;
  max=std::max(max,gap);sum+=gap;++count;
 }
 return {{"pairs",count},{"maxMm",max},{"meanMm",count?sum/count:0}};
}
Json captureParticlePositions(const Json& simulation){
 Json result=Json::object();const auto& pieces=get(simulation,"pieces");
 if(!pieces.is_object())return result;
 for(auto it=pieces.begin();it!=pieces.end();++it){
  Json points=Json::array();
  for(const auto& particle:arr(it.value(),"particles"))points.push_back(get(particle,"position"));
  result[it.key()]=std::move(points);
 }
 return result;
}
void restoreParticlePositions(const Json& snapshot,Json& simulation){
 if(!snapshot.is_object()||!simulation.is_object()||!simulation.contains("pieces")||!simulation["pieces"].is_object())return;
 for(auto it=snapshot.begin();it!=snapshot.end();++it){
  if(!simulation["pieces"].contains(it.key())||!it.value().is_array())continue;
  Json& particles=simulation["pieces"][it.key()]["particles"];
  if(!particles.is_array())continue;
  for(std::size_t i=0;i<particles.size()&&i<it.value().size();++i){
   const auto& previous=it.value()[i];if(previous.is_null())continue;
   particles[i]["position"]=previous;particles[i]["previous"]=previous;
  }
 }
}
}
