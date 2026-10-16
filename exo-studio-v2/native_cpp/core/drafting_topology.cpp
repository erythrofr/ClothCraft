#include "drafting_topology.hpp"
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>
namespace garment {
namespace {
constexpr double eps=1e-7;
struct P { double x,y; };
struct S { int edge; P a,b; };
P point(const Json& j) {return {j.at("x").get<double>(),j.at("y").get<double>()};}
P subtract(P a,P b){return {a.x-b.x,a.y-b.y};}
double cross(P a,P b){return a.x*b.y-a.y*b.x;}
bool near(P a,P b,double t=1e-5){return std::hypot(a.x-b.x,a.y-b.y)<=t;}
bool finite(const Json& p){return p.is_object() && p.contains("x") && p.contains("y") && p["x"].is_number() && p["y"].is_number() && std::isfinite(p["x"].get<double>()) && std::isfinite(p["y"].get<double>());}
Json get(const Json& o,const std::string& k){return o.is_object()&&o.contains(k)?o[k]:Json();}
Json indexed(const Json& collection,int index){
 if(collection.is_array())return index>=0&&index<static_cast<int>(collection.size())?collection[index]:Json();
 return get(collection,std::to_string(index));
}
bool integralIndex(const Json& j, std::size_t count, int& index){
 if(!j.is_number())return false;
 double value=j.get<double>();
 if(!std::isfinite(value)||std::floor(value)!=value||value<0||value>=double(count))return false;
 index=static_cast<int>(value);return true;
}
bool jsTruthy(const Json& value){
 if(value.is_null()||value.is_discarded())return false;
 if(value.is_boolean())return value.get<bool>();
 if(value.is_number())return value.get<double>()!=0&&std::isfinite(value.get<double>());
 if(value.is_string())return !value.get<std::string>().empty();
 return true;
}
bool bounds(P a,P b,P c,P d){
return std::min(a.x,b.x)<=std::max(c.x,d.x)+eps && std::max(a.x,b.x)>=std::min(c.x,d.x)-eps && std::min(a.y,b.y)<=std::max(c.y,d.y)+eps && std::max(a.y,b.y)>=std::min(c.y,d.y)-eps;
}
Json collision(P a,P b,P c,P d){
 P r=subtract(b,a),s=subtract(d,c),ca=subtract(c,a);double det=cross(r,s);
 if(std::abs(det)>=eps){double t=cross(ca,s)/det,u=cross(ca,r)/det;if(t>=-eps&&t<=1+eps&&u>=-eps&&u<=1+eps)return Json{{"kind","point"},{"point",{{"x",a.x+t*r.x},{"y",a.y+t*r.y}}}};return nullptr;}
 if(std::abs(cross(ca,r))>=eps)return nullptr;
 double rr=r.x*r.x+r.y*r.y;
 if(rr<=eps*eps)return near(a,c)?Json{{"kind","point"},{"point",{{"x",a.x},{"y",a.y}}}}:Json(nullptr);
 double start=(ca.x*r.x+ca.y*r.y)/rr;P da=subtract(d,a);double end=(da.x*r.x+da.y*r.y)/rr;
 double low=std::max(0.,std::min(start,end)),high=std::min(1.,std::max(start,end));
 if(high<low-eps)return nullptr;
 if(high-low>eps)return Json{{"kind","overlap"}};
 return Json{{"kind","point"},{"point",{{"x",a.x+low*r.x},{"y",a.y+low*r.y}}}};
}
Json invalid(const Json& errors){return Json{{"valid",false},{"errors",errors},{"areaCm2",0},{"intersections",Json::array()}};}
}
Json inspectDraftTopology(const Json& piece,const Json& options){
 Json errors=Json::array();Json vertices=get(piece,"points");
 if(!vertices.is_array()||vertices.size()<3)return invalid(Json::array({"A closed pattern needs at least three points"}));
 for(const auto& p:vertices)if(!finite(p)||std::abs(p["x"].get<double>())>100000||std::abs(p["y"].get<double>())>100000)return invalid(Json::array({"Pattern point contains an invalid or out-of-range coordinate"}));
 int n=static_cast<int>(vertices.size());
 for(int i=0;i<n;i++){P a=point(vertices[i]),b=point(vertices[(i+1)%n]);if(std::hypot(b.x-a.x,b.y-a.y)<.001)errors.push_back("Adjacent pattern points "+std::to_string(i+1)+" and "+std::to_string((i+1)%n+1)+" are coincident");}
 std::vector<S> pieces;std::vector<P> boundary;Json curves=get(piece,"curves");
 double requested=16;if(options.is_object()&&options.contains("curveSamples")&&options["curveSamples"].is_number())requested=options["curveSamples"].get<double>();
 int sampling=std::max(4,std::min(64,std::isfinite(requested)?static_cast<int>(std::floor(requested+.5)):4));
 for(int edge=0;edge<n;edge++){
  Json curve=indexed(curves,edge);P a=point(vertices[edge]),b=point(vertices[(edge+1)%n]);bool curved=jsTruthy(curve);
  if(curved && (!curve.is_object()||!finite(Json{{"x",get(curve,"cx")},{"y",get(curve,"cy")}})||std::abs(curve["cx"].get<double>())>100000||std::abs(curve["cy"].get<double>())>100000)){errors.push_back("Curve control "+std::to_string(edge+1)+" is invalid");continue;}
  int count=curved?sampling:1;
  for(int segment=0;segment<count;segment++){
    double t=double(segment)/count,u=1-t;P first=curved?P{u*u*a.x+2*u*t*curve["cx"].get<double>()+t*t*b.x,u*u*a.y+2*u*t*curve["cy"].get<double>()+t*t*b.y}:a;
    double tn=double(segment+1)/count,un=1-tn;P second=curved?P{un*un*a.x+2*un*tn*curve["cx"].get<double>()+tn*tn*b.x,un*un*a.y+2*un*tn*curve["cy"].get<double>()+tn*tn*b.y}:b;
    boundary.push_back(first);pieces.push_back({edge,first,second});
  }
 }
 if(!errors.empty())return invalid(errors);
 double area=0;for(size_t i=0;i<boundary.size();i++){P a=boundary[i],b=boundary[(i+1)%boundary.size()];area+=cross(a,b);}area*=.5;
 if(std::abs(area)<1e-5)errors.push_back("Pattern has near-zero enclosed area");
 Json intersections=Json::array();
 for(size_t i=0;i<pieces.size()&&intersections.size()<16;i++)for(size_t j=i+1;j<pieces.size()&&intersections.size()<16;j++){
  const auto& p=pieces[i];const auto& q=pieces[j];if(p.edge==q.edge||!bounds(p.a,p.b,q.a,q.b))continue;
  Json hit=collision(p.a,p.b,q.a,q.b);if(hit.is_null())continue;
  bool next=(p.edge+1)%n==q.edge,previous=(q.edge+1)%n==p.edge;
  if(hit["kind"]=="point"&&(next||previous)&&near(point(hit["point"]),point(vertices[next?q.edge:p.edge])))continue;
  Json intersection={{"edgeA",p.edge},{"edgeB",q.edge},{"kind",hit["kind"]}};if(hit.contains("point"))intersection["point"]=hit["point"];intersections.push_back(intersection);
 }
 if(!intersections.empty())errors.push_back("Pattern contour crosses or overlaps itself");
 return Json{{"valid",errors.empty()},{"errors",errors},{"intersections",intersections},{"areaCm2",std::abs(area)},{"winding",area>=0?"counterclockwise":"clockwise"}};
}
bool isDraftEditValid(const Json& piece,const Json& edit,const Json& options){
 if(!piece.is_object()||!piece.contains("points")||!piece["points"].is_array())return false;
 Json updated=piece;Json index=get(edit,"pointIndex");int i=0;
 if(index.is_number()&&std::isfinite(index.get<double>())&&std::floor(index.get<double>())==index.get<double>()){
  if(!integralIndex(index,piece["points"].size(),i))return false;
  Json p=get(edit,"point");if(!finite(p))return false;updated["points"][i]["x"]=p["x"];updated["points"][i]["y"]=p["y"];
 }
 index=get(edit,"edgeIndex");
 if(index.is_number()&&std::isfinite(index.get<double>())&&std::floor(index.get<double>())==index.get<double>()){
  if(!integralIndex(index,piece["points"].size(),i))return false;
  if(!updated.contains("curves")||!updated["curves"].is_object()){
   Json spread=Json::object();
   if(updated.contains("curves")&&updated["curves"].is_array()){
    for(std::size_t k=0;k<updated["curves"].size();k++)spread[std::to_string(k)]=updated["curves"][k];
   }
   updated["curves"]=std::move(spread);
  }
  if(!edit.is_object()||!edit.contains("curve"))return false;
  Json curve=edit["curve"];std::string key=std::to_string(i);
  if(curve.is_null())updated["curves"].erase(key);
  else if(curve.is_object()&&finite(Json{{"x",get(curve,"cx")},{"y",get(curve,"cy")}}))updated["curves"][key]={{"cx",curve["cx"]},{"cy",curve["cy"]}};
  else return false;
 }
 return inspectDraftTopology(updated,options)["valid"].get<bool>();
}
}
