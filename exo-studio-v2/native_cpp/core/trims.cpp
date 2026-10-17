#include "trims.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <stdexcept>

namespace garment {
namespace {
const Json& prop(const Json& o, const char* k) {
  static const Json missing;
  return o.is_object() && o.contains(k) ? o.at(k) : missing;
}
double number(const Json& v, double fallback=0) {
  if(v.is_null()) return fallback;
  if(v.is_number()) return v.get<double>();
  if(v.is_boolean()) return v.get<bool>()?1:0;
  if(v.is_string()) {
    const auto s=v.get<std::string>();
    if(s.empty()) return 0;
    char* end=nullptr;
    double value=std::strtod(s.c_str(),&end);
    return end!=s.c_str() && *end=='\0'?value:std::nan("");
  }
  return std::nan("");
}
bool truthy(const Json& v) {
  if(v.is_null() || v==false) return false;
  if(v.is_number()) return number(v)!=0 && !std::isnan(number(v));
  if(v.is_string()) return !v.get<std::string>().empty();
  return true;
}
double fieldNumber(const Json& object,const char* key,double fallback,bool useOr=false) {
  const auto& v=prop(object,key);
  return v.is_null() || (useOr && !truthy(v)) ? fallback:number(v);
}
const Json& arrayField(const Json& object,const char* key) {
  static const Json empty=Json::array();
  const auto& field=prop(object,key);
  return field.is_array()?field:empty;
}
Json sampleEdge(const Json& piece,int edgeIndex,int segments) {
  const auto& points=arrayField(piece,"points");
  if(edgeIndex<0 || static_cast<std::size_t>(edgeIndex)>=points.size() || points.empty()) return Json::array();
  const auto& a=points[edgeIndex], &b=points[(static_cast<std::size_t>(edgeIndex)+1)%points.size()];
  const auto& curves=prop(piece,"curves");
  const std::string key=std::to_string(edgeIndex);
  if(!curves.is_object() || !curves.contains(key) || curves.at(key).is_null())
    return Json::array({a,b}); // JS spreads the original endpoint metadata.
  const auto& curve=curves.at(key);
  const int count=std::max(2,segments);
  Json samples=Json::array();
  for(int step=0;step<=count;++step) {
    const double t=static_cast<double>(step)/count,u=1-t;
    samples.push_back({{"x",u*u*number(prop(a,"x"))+2*u*t*number(prop(curve,"cx"))+t*t*number(prop(b,"x"))},
                       {"y",u*u*number(prop(a,"y"))+2*u*t*number(prop(curve,"cy"))+t*t*number(prop(b,"y"))}});
  }
  return samples;
}
}
Json offsetEdgePath(const Json& piece,int edgeIndex,double offsetCm,int segments) {
  const Json path=sampleEdge(piece,edgeIndex,std::max(8,segments));
  if(path.size()<2) return path;
  Json result=Json::array();
  for(std::size_t i=0;i<path.size();++i) {
    const auto& p=path[i], &previous=path[i==0?0:i-1], &next=path[std::min(i+1,path.size()-1)];
    const double dx=number(prop(next,"x"))-number(prop(previous,"x"));
    const double dy=number(prop(next,"y"))-number(prop(previous,"y"));
    const double length=std::hypot(dx,dy);
    const double denom=length==0?1:length;
    result.push_back({{"x",number(prop(p,"x"))-dy/denom*offsetCm},
                      {"y",number(prop(p,"y"))+dx/denom*offsetCm}});
  }
  return result;
}
Json topstitchPaths(const Json& piece,const Json& topstitch) {
  const double raw=fieldNumber(topstitch,"rows",1,true);
  const double rows=std::max(1.,std::min(3.,raw));
  const double start=fieldNumber(topstitch,"offsetCm",.7);
  const double gap=fieldNumber(topstitch,"rowGapCm",.45);
  const int edge=static_cast<int>(fieldNumber(topstitch,"edgeIndex",0));
  Json result=Json::array();
  // Array.from({length: fractional}) truncates its length in JavaScript.
  for(int i=0;i<static_cast<int>(rows);++i) result.push_back(offsetEdgePath(piece,edge,start+i*gap,32));
  return result;
}
Json zipperPaths(const Json& piece,const Json& zipper) {
  const double offset=fieldNumber(zipper,"offsetCm",0);
  const double half=fieldNumber(zipper,"widthCm",1.2)*.5;
  const int edge=static_cast<int>(fieldNumber(zipper,"edgeIndex",0));
  return Json::array({offsetEdgePath(piece,edge,offset-half,32),offsetEdgePath(piece,edge,offset+half,32)});
}
Json pieceCenter(const Json& piece) {
  const auto& points=arrayField(piece,"points");
  if(points.empty()) return {{"x",0},{"y",0}};
  double x=0,y=0;
  for(const auto& p:points) {x+=number(prop(p,"x"));y+=number(prop(p,"y"));}
  return {{"x",x/points.size()},{"y",y/points.size()}};
}
Json trimSummary(const Json& project) {
  double rows=0;
  std::size_t zippers=0,buttons=0,buttonholes=0;
  for(const auto& piece:arrayField(project,"pieces")) {
    for(const auto& stitch:arrayField(piece,"topstitches"))
      rows+=std::max(1.,fieldNumber(stitch,"rows",1,true));
    zippers+=arrayField(piece,"zippers").size();
    buttons+=arrayField(piece,"buttons").size();
    buttonholes+=arrayField(piece,"buttonholes").size();
  }
  return {{"topstitchRows",rows},{"zippers",zippers},{"buttons",buttons},{"buttonholes",buttonholes}};
}
} // namespace garment
