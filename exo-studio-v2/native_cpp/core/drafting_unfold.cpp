#include "drafting_unfold.hpp"
#include "drafting_topology.hpp"
#include <cmath>
#include <stdexcept>
#include <string>
#include <regex>
namespace garment {
namespace {
struct P{double x,y;};
Json get(const Json& o,const std::string& k){return o.is_object()&&o.contains(k)?o[k]:Json();}
bool containsIndex(const Json& o,int i){
 return (o.is_object()&&o.contains(std::to_string(i)))||
   (o.is_array()&&i>=0&&i<static_cast<int>(o.size()));
}
Json at(const Json& o,int i){
 if(o.is_array())return i>=0&&i<static_cast<int>(o.size())?o[i]:Json();
 return get(o,std::to_string(i));
}
P point(const Json& j){return {j.at("x").get<double>(),j.at("y").get<double>()};}
Json jsonPoint(P p){return Json{{"x",p.x},{"y",p.y}};}
bool near(P a,P b){return std::hypot(a.x-b.x,a.y-b.y)<.001;}
P mirror(P p,P a,P b){double dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=((p.x-a.x)*dx+(p.y-a.y)*dy)/den;return {2*(a.x+t*dx)-p.x,2*(a.y+t*dy)-p.y};}
std::string jsString(const Json& j,const std::string& fallback){if(j.is_null()||j==false||j==0||j=="")return fallback;if(j.is_string())return j.get<std::string>();return j.dump();}
double number(const Json& j,double fallback=0){if(j.is_null())return fallback;if(j.is_number())return j.get<double>();if(j.is_boolean())return j.get<bool>()?1:0;if(j.is_string()){try{return std::stod(j.get<std::string>());}catch(...){}}return fallback;}
bool jsTruthy(const Json& value){
 if(value.is_null()||value.is_discarded())return false;
 if(value.is_boolean())return value.get<bool>();
 if(value.is_number())return value.get<double>()!=0&&std::isfinite(value.get<double>());
 if(value.is_string())return !value.get<std::string>().empty();
 return true;
}
}
Json unfoldDraftPiece(const Json& piece,const Json& foldEdgeIndex){
 if(!foldEdgeIndex.is_number())throw std::runtime_error("Select a valid straight fold edge of a closed half-pattern");
 const double index=foldEdgeIndex.get<double>();
 if(!std::isfinite(index)||std::floor(index)!=index||index<0||index>2147483647)
  throw std::runtime_error("Select a valid straight fold edge of a closed half-pattern");
 return unfoldDraftPiece(piece,static_cast<int>(index));
}
Json unfoldDraftPiece(const Json& piece,int foldEdgeIndex){
 Json points=get(piece,"points");int n=points.is_array()?static_cast<int>(points.size()):0;
 if(n<3||foldEdgeIndex<0||foldEdgeIndex>=n)throw std::runtime_error("Select a valid straight fold edge of a closed half-pattern");
 if(jsTruthy(get(piece,"locked")))throw std::runtime_error("Unlock this pattern before unfolding");
 Json curves=get(piece,"curves");
 if(jsTruthy(at(curves,foldEdgeIndex)))throw std::runtime_error("Unfold requires a straight fold edge");
 P a=point(points[foldEdgeIndex]),b=point(points[(foldEdgeIndex+1)%n]);
 if(near(a,b))throw std::runtime_error("Fold edge must have a nonzero length");
 double dx=b.x-a.x,dy=b.y-a.y,norm=std::hypot(dx,dy),ux=dx/norm,uy=dy/norm;
 auto reflect=[&](const Json& vertex){
  Json copy=vertex;P next=mirror(point(vertex),a,b);copy["x"]=next.x;copy["y"]=next.y;
  Json grade=get(vertex,"gradeRule");
  if(grade.is_object()&&jsTruthy(get(grade,"enabled"))){
   double vx=number(get(grade,"dxPerSize")),vy=number(get(grade,"dyPerSize"));double proj=2*(ux*vx+uy*vy);
   copy["gradeRule"]["dxPerSize"]=proj*ux-vx;copy["gradeRule"]["dyPerSize"]=proj*uy-vy;
  }
  if(!get(copy,"id").is_null()&&get(copy,"id")!=false&&get(copy,"id")!="")copy["id"]=jsString(copy["id"],"")+"-unfold";
  return copy;
 };
 std::vector<int> walk;for(int i=0;i<n;i++)walk.push_back((foldEdgeIndex+1+i)%n);
 Json newPoints=Json::array();for(int index:walk)newPoints.push_back(points[index]);
 for(int i=n-2;i>=1;i--)newPoints.push_back(reflect(points[walk[i]]));
 int count=static_cast<int>(newPoints.size());
 Json edgeMap=Json::object(),mirroredMap=Json::object(),newCurves=Json::object(),newAllowances=Json::object();
 Json allowances=get(piece,"edgeSeamAllowances");
 for(int k=0;k<n-1;k++){
  int oldEdge=walk[k],reflectedEdge=count-1-k;std::string source=std::to_string(oldEdge),dest=std::to_string(k),mirrored=std::to_string(reflectedEdge);
  edgeMap[source]=k;mirroredMap[source]=reflectedEdge;
  Json curve=at(curves,oldEdge);
  if(jsTruthy(curve)){
   newCurves[dest]=curve;P p=mirror({number(get(curve,"cx")),number(get(curve,"cy"))},a,b);newCurves[mirrored]=jsonPoint(p);newCurves[mirrored]["cx"]=p.x;newCurves[mirrored]["cy"]=p.y;newCurves[mirrored].erase("x");newCurves[mirrored].erase("y");
  }
  if(containsIndex(allowances,oldEdge)){
   Json allowance=at(allowances,oldEdge);newAllowances[dest]=allowance;newAllowances[mirrored]=allowance;
  }
 }
 Json notches=get(piece,"notches");if(!notches.is_array())notches=Json::array();
 for(const auto& notch:notches)if(get(notch,"edgeIndex")==foldEdgeIndex)throw std::runtime_error("Remove notches from the fold edge before unfolding");
 Json newNotches=Json::array();
 for(const auto& notch:notches){
  Json index=get(notch,"edgeIndex");
  if(!index.is_number()&&!index.is_string())continue;
  std::string key=index.is_string()?index.get<std::string>():index.dump();
  if(index.is_number()&&std::floor(index.get<double>())==index.get<double>()&&
     index.get<double>()>=0&&index.get<double>()<double(n))key=std::to_string(static_cast<int>(index.get<double>()));
  if(!edgeMap.contains(key))continue;
  Json original=notch;original["edgeIndex"]=edgeMap[key];newNotches.push_back(original);
  Json reflected=notch;reflected["id"]=jsString(get(notch,"id"),"notch")+"-unfold";reflected["edgeIndex"]=mirroredMap[key];
  reflected["t"]=1-number(get(notch,"t"),.5);reflected["matchGroupId"]=nullptr;reflected["matchedSeamId"]=nullptr;newNotches.push_back(reflected);
 }
 Json lines=get(piece,"internalLines");if(!lines.is_array())lines=Json::array();Json newInternal=lines;
 for(const auto& line:lines){
  P left=mirror(point(line.at("a")),a,b),right=mirror(point(line.at("b")),a,b);
  if(near(left,point(line.at("a")))&&near(right,point(line.at("b"))))continue;
  Json added=line;added["id"]=jsString(get(line,"id"),"internal")+"-unfold";added["name"]=jsString(get(line,"name"),"Internal")+" mirror";added["a"]=jsonPoint(left);added["b"]=jsonPoint(right);newInternal.push_back(added);
 }
 Json expanded=piece;expanded["points"]=newPoints;expanded["curves"]=newCurves;expanded["edgeSeamAllowances"]=newAllowances;
 expanded["notches"]=newNotches;expanded["internalLines"]=newInternal;
 std::string name=jsString(get(piece,"name"),"Pattern");name=std::regex_replace(name,std::regex(R"(\s*\(half\)$)",std::regex::icase),"");
 expanded["name"]=name+" · Unfolded";
 Json options={{"curveSamples",24}};Json topology=inspectDraftTopology(expanded,options);
 if(!topology["valid"].get<bool>())throw std::runtime_error("Unfold would overlap/cross the pattern: "+topology["errors"][0].get<std::string>());
 Json before=inspectDraftTopology(piece,options);
 if(!before["valid"].get<bool>())throw std::runtime_error("The original half-pattern must have a valid closed cutline");
 double oldArea=before["areaCm2"].get<double>(),newArea=topology["areaCm2"].get<double>();
 if(std::abs(newArea-oldArea*2)>std::max(.025,oldArea*.005))throw std::runtime_error("Unfolded area must equal twice the original half-pattern area");
 return Json{{"piece",expanded},{"edgeMap",edgeMap},{"mirroredEdgeMap",mirroredMap},{"foldEdgeIndex",foldEdgeIndex},{"areaCm2",newArea}};
}
}
