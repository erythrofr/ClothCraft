#include "drafting_constructions.hpp"
#include <cmath>
#include <cstdlib>
#include <limits>
#include <stdexcept>

namespace garment {
namespace {
constexpr double epsilon=1e-10;
double jsNumber(const Json& value) {
  if (value.is_null()) return 0;
  if (value.is_boolean()) return value.get<bool>()?1:0;
  if (value.is_number()) return value.get<double>();
  if (value.is_string()) {
    const auto s=value.get<std::string>();
    if (s.find_first_not_of(" \t\r\n")==std::string::npos) return 0;
    char* end=nullptr;
    const double v=std::strtod(s.c_str(),&end);
    if (end!=s.c_str() && end && *end=='\0') return v;
  }
  return std::numeric_limits<double>::quiet_NaN();
}
double coordinate(const Json& value,const std::string& label) {
  const double n=jsNumber(value);
  if (value.is_null() || (value.is_string() && value.get<std::string>().empty()) ||
      !std::isfinite(n) || std::abs(n)>100000)
    throw std::runtime_error(label+" must be a finite length in centimeters");
  return n;
}
Point2 point(const Json& value) {
  return {jsNumber(value.at("x")),jsNumber(value.at("y"))};
}
Json get(const Json& o,const char* key,const Json& fallback) {
  return o.is_object() && o.contains(key)?o.at(key):fallback;
}
}

Point2 constructionReferencePoint(const Json& piece,const Json& oneBasedIndex) {
  const auto count=piece.is_object() && piece.contains("points") && piece.at("points").is_array()
    ?piece.at("points").size():0;
  const double n=jsNumber(oneBasedIndex);
  if (!std::isfinite(n) || std::floor(n)!=n || n<1 || n>static_cast<double>(count))
    throw std::runtime_error("Reference index must be a pattern point between 1 and "+std::to_string(count));
  const auto& p=piece.at("points").at(static_cast<std::size_t>(n-1));
  return {coordinate(p.at("x"),"Reference X"),coordinate(p.at("y"),"Reference Y")};
}
Point2 lineIntersection(Point2 a,Point2 b,Point2 c,Point2 d) {
  const Point2 u{b.x-a.x,b.y-a.y},v{d.x-c.x,d.y-c.y};
  const double cross=u.x*v.y-u.y*v.x;
  if (std::abs(cross)<epsilon) throw std::runtime_error("Construction lines are parallel or coincident");
  const double t=((c.x-a.x)*v.y-(c.y-a.y)*v.x)/cross;
  return {a.x+t*u.x,a.y+t*u.y};
}
Point2 projectOntoLine(Point2 p,Point2 a,Point2 b) {
  const Point2 u{b.x-a.x,b.y-a.y};
  const double norm=u.x*u.x+u.y*u.y;
  if (norm<epsilon*epsilon) throw std::runtime_error("Construction reference line has zero length");
  const double t=((p.x-a.x)*u.x+(p.y-a.y)*u.y)/norm;
  return {a.x+t*u.x,a.y+t*u.y};
}
Point2 pointAlongLine(Point2 a,Point2 b,const Json& distanceCm,bool perpendicular) {
  const Point2 delta{b.x-a.x,b.y-a.y};
  const double norm=std::hypot(delta.x,delta.y);
  if (norm<epsilon) throw std::runtime_error("Construction reference line has zero length");
  const double distance=coordinate(distanceCm,"Construction offset");
  const Point2 unit=perpendicular?Point2{-delta.y/norm,delta.x/norm}:Point2{delta.x/norm,delta.y/norm};
  return {a.x+unit.x*distance,a.y+unit.y*distance};
}
Point2 mirrorPointAcrossLine(Point2 p,Point2 a,Point2 b) {
  const auto foot=projectOntoLine(p,a,b);
  return {foot.x*2-p.x,foot.y*2-p.y};
}
Json draftConstructionModes() {
  return {{"line","Point at measured distance along A → B"},
          {"normal","Perpendicular at measured distance from A"},
          {"foot","Project selected point onto line A–B"},
          {"mirror","Mirror selected point across line A–B"},
          {"intersection","Intersection of infinite lines A–B and C–D"}};
}
Json preciseConstructionEdit(const Json& piece,const Json& pointIndex,const Json& options) {
  const Json construction=get(options,"construction","line");
  if (!construction.is_string() || !draftConstructionModes().contains(construction.get<std::string>()))
    throw std::runtime_error("Unsupported construction operation");
  const double i=jsNumber(pointIndex);
  const auto count=piece.is_object() && piece.contains("points") && piece.at("points").is_array()
    ?piece.at("points").size():0;
  if (!pointIndex.is_number_integer() && !pointIndex.is_number_unsigned() && !pointIndex.is_number_float())
    throw std::runtime_error("Invalid pattern point");
  if (!std::isfinite(i) || std::floor(i)!=i || i<0 || i>=static_cast<double>(count))
    throw std::runtime_error("Invalid pattern point");
  const auto a=constructionReferencePoint(piece,get(options,"a",1));
  const auto b=constructionReferencePoint(piece,get(options,"b",2));
  const std::size_t index=static_cast<std::size_t>(i);
  const auto& prior=piece.at("points").at(index);
  Point2 result;
  const auto mode=construction.get<std::string>();
  if (mode=="line" || mode=="normal") result=pointAlongLine(a,b,get(options,"distanceCm",0),mode=="normal");
  else if (mode=="foot") result=projectOntoLine(point(prior),a,b);
  else if (mode=="mirror") result=mirrorPointAcrossLine(point(prior),a,b);
  else result=lineIntersection(a,b,constructionReferencePoint(piece,get(options,"c",3)),
                                 constructionReferencePoint(piece,get(options,"d",4)));
  // Local equivalent of precisePointEdit's absolute mode: validation order and metadata preservation.
  if (count<3) throw std::runtime_error("A closed pattern must contain at least three points");
  if (get(piece,"locked",false)==true) throw std::runtime_error("Unlock the pattern before editing");
  coordinate(result.x,"X"); coordinate(result.y,"Y");
  const auto previous=point(piece.at("points").at((index+count-1)%count));
  const auto following=point(piece.at("points").at((index+1)%count));
  if (std::hypot(result.x-previous.x,result.y-previous.y)<0.001 ||
      std::hypot(result.x-following.x,result.y-following.y)<0.001)
    throw std::runtime_error("Adjacent pattern points must be at least 0.001 cm apart");
  Json output=prior;
  output["x"]=result.x;
  output["y"]=result.y;
  return output;
}
}
