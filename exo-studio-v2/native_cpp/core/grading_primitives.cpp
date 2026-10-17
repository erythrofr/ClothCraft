#include "grading_primitives.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <stdexcept>

namespace garment {
namespace {
double jsNumber(const Json& n,double fallback=std::numeric_limits<double>::quiet_NaN()) {
  if(n.is_number())return n.get<double>();
  if(n.is_boolean())return n.get<bool>()?1.:0.;
  if(n.is_null())return 0.;
  if(n.is_string()){
    const std::string v=n.get<std::string>();
    if(v.find_first_not_of(" \t\r\n")==std::string::npos)return 0.;
    char* end=nullptr;double value=std::strtod(v.c_str(),&end);
    if(end==v.c_str())return fallback;
    for(;*end;++end)if(*end!=' '&&*end!='\t'&&*end!='\r'&&*end!='\n')return fallback;
    return value;
  }
  return fallback;
}
double nullishNumber(const Json& object,const char* key,double fallback) {
  if(!object.is_object()||!object.contains(key)||object.at(key).is_null())return fallback;
  return jsNumber(object.at(key));
}
double coord(const Json& p,const char* axis) {
  if(!p.is_object()||!p.contains(axis))return std::numeric_limits<double>::quiet_NaN();
  return jsNumber(p.at(axis));
}
std::string baseSize(const Json& grading){
  if(!grading.is_object()||!grading.contains("baseSize")||!grading.at("baseSize").is_string()||
     grading.at("baseSize").get<std::string>().empty())return "M";
  return grading.at("baseSize").get<std::string>();
}
Json sizes(const Json& grading) {
  if(grading.is_object()&&grading.contains("sizes")&&grading.at("sizes").is_array()&&
     !grading.at("sizes").empty())return grading.at("sizes");
  return defaultGradingSizes();
}
int index(const Json& arr,const std::string& label) {
  for(std::size_t i=0;i<arr.size();++i)
    if(arr[i].is_string()&&arr[i].get<std::string>()==label)return static_cast<int>(i);
  return 0;
}
}

Json defaultGradingSizes() { return Json::array({"XS","S","M","L","XL","XXL"}); }

int sizeOffsetJs(const Json& grading,const std::string& size) {
  const auto arr=sizes(grading);
  return index(arr,size)-index(arr,baseSize(grading));
}

Json gradePointForPieceJs(const Json& piece,const Json& grading,const std::string& size,const Json& point) {
  const int offset=sizeOffsetJs(grading,size);
  if(!offset)return point;
  if(!piece.is_object()||!piece.contains("points")||!piece.at("points").is_array()||piece.at("points").empty())
    throw std::invalid_argument("cannot grade piece with no points");
  double minX=std::numeric_limits<double>::infinity(),maxX=-minX;
  double minY=minX,maxY=-minX;
  for(const auto& p:piece.at("points")){
    const auto x=coord(p,"x"),y=coord(p,"y");
    if(!std::isfinite(x)||!std::isfinite(y))throw std::invalid_argument("non-finite grading point");
    minX=std::min(minX,x);maxX=std::max(maxX,x);
    minY=std::min(minY,y);maxY=std::max(maxY,y);
  }
  const auto x=coord(point,"x"),y=coord(point,"y");
  const double width=nullishNumber(grading,"widthPerSizeCm",3.);
  const double length=nullishNumber(grading,"lengthPerSizeCm",1.2);
  const double centerX=(minX+maxX)*.5;
  const double height=std::max(1.,maxY-minY);
  const double normalizedY=(y-minY)/height;
  const double side=(x>centerX?1.:(x<centerX?-1.:0.));
  double nextX=x+side*(width*offset*.5)*(.55+.45*(1-normalizedY));
  double nextY=y-length*offset*(1-normalizedY);
  const Json rule=point.is_object()?point.value("gradeRule",Json()):Json();
  if(rule.is_object()&&rule.value("enabled",false)){
    const double dx=rule.contains("dxPerSize")?jsNumber(rule.at("dxPerSize")):
      std::numeric_limits<double>::quiet_NaN();
    const double dy=rule.contains("dyPerSize")?jsNumber(rule.at("dyPerSize")):
      std::numeric_limits<double>::quiet_NaN();
    if(std::isfinite(dx))nextX=x+dx*offset;
    if(std::isfinite(dy))nextY=y+dy*offset;
  }
  if(!std::isfinite(nextX)||!std::isfinite(nextY))
    throw std::invalid_argument("non-finite graded point");
  return {{"x",nextX},{"y",nextY}};
}

Json gradePieceJs(const Json& piece,const Json& grading,const std::string& size) {
  if(!piece.is_object()||!piece.contains("points")||!piece.at("points").is_array())
    throw std::invalid_argument("gradePiece requires a pattern piece with points");
  const int offset=sizeOffsetJs(grading,size);
  Json result=piece;
  Json points=Json::array();
  for(const auto& p:piece.at("points"))points.push_back(gradePointForPieceJs(piece,grading,size,p));
  result["points"]=std::move(points);
  if(piece.contains("curves")&&piece.at("curves").is_object()) {
    Json curves=Json::object();
    for(auto it=piece.at("curves").begin();it!=piece.at("curves").end();++it) {
      if(!offset)curves[it.key()]=it.value();
      else{
        const Json ctrl={{"x",it.value().at("cx")},{"y",it.value().at("cy")}};
        auto p=gradePointForPieceJs(piece,grading,size,ctrl);
        curves[it.key()]={{"cx",p.at("x")},{"cy",p.at("y")}};
      }
    }
    result["curves"]=std::move(curves);
  } else result.erase("curves");
  Json internalLines=Json::array();
  if(piece.contains("internalLines")&&piece.at("internalLines").is_array())
    for(const auto& source:piece.at("internalLines")){
      Json line=source;
      for(const auto& key:{"a","b"})
        if(line.contains(key)&&line.at(key).is_object())
          line[key]=gradePointForPieceJs(piece,grading,size,line.at(key));
      internalLines.push_back(std::move(line));
    }
  result["internalLines"]=std::move(internalLines);
  if(offset)result["gradeSize"]=size;
  return result;
}
}
