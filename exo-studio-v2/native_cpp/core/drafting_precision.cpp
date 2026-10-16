#include "drafting_precision.hpp"
#include <cmath>
#include <algorithm>
#include <functional>
#include <limits>

namespace garment {
namespace {
constexpr double epsilon = 1e-9;
constexpr double pi = 3.14159265358979323846;
Json field(const Json& object, const char* key) {
  return object.is_object() && object.contains(key) ? object.at(key) : Json();
}
double number(const Json& input) {
  if (input.is_number()) return input.get<double>();
  if (input.is_boolean()) return input.get<bool>() ? 1 : 0;
  if (input.is_null()) return 0;
  if (input.is_string()) {
    const auto s = input.get<std::string>();
    if (s.empty()) return 0;
    try { size_t used = 0; auto result = std::stod(s, &used); return used == s.size() ? result : std::numeric_limits<double>::quiet_NaN(); }
    catch (...) { return std::numeric_limits<double>::quiet_NaN(); }
  }
  return std::numeric_limits<double>::quiet_NaN();
}
double coordinate(const Json& p, const char* key) { return p.at(key).get<double>(); }
double distance(const Json& a, const Json& b) { return std::hypot(coordinate(a,"x")-coordinate(b,"x"), coordinate(a,"y")-coordinate(b,"y")); }
void validPiece(const Json& piece, int index, const std::string& label) {
  if (!piece.is_object() || !field(piece,"points").is_array() || piece["points"].size()<3)
    throw std::runtime_error("A closed pattern must contain at least three points");
  if (index<0 || static_cast<size_t>(index)>=piece["points"].size()) throw std::runtime_error("Invalid pattern " + label);
  if (field(piece,"locked")==true) throw std::runtime_error("Unlock the pattern before editing");
}
Json coordPoint(double x,double y) { return Json{{"x",x},{"y",y}}; }
void validateCurve(const Json& a, const Json& c, const Json& b, double start, double end) {
  for (const auto* p : {&a,&c,&b}) for (auto key:{"x","y"})
    if (!p->is_object() || !p->contains(key) || !(*p)[key].is_number() || !std::isfinite((*p)[key].get<double>()))
      throw std::runtime_error("Non-finite Bézier curve");
  if (!std::isfinite(start) || !std::isfinite(end)) throw std::runtime_error("Non-finite Bézier curve");
}
}
double assertDraftCoordinate(const Json& value, const std::string& label) {
  double n=number(value);
  if (value.is_null() || (value.is_string() && value.get<std::string>().empty()) || !std::isfinite(n) || std::abs(n)>100000)
    throw std::runtime_error(label+" must be a finite length in centimeters");
  return n;
}
Json pointFromPolar(const Json& anchor,const Json& lengthCm,const Json& angleDeg) {
  auto length=assertDraftCoordinate(lengthCm,"Length"), angle=assertDraftCoordinate(angleDeg,"Angle");
  if (length<0) throw std::runtime_error("Length must not be negative");
  auto rad=angle*pi/180;
  return coordPoint(assertDraftCoordinate(field(anchor,"x"),"Anchor X")+length*std::cos(rad),
    assertDraftCoordinate(field(anchor,"y"),"Anchor Y")+length*std::sin(rad));
}
Json polarFromPoints(const Json& anchor,const Json& point) {
  double dx=coordinate(point,"x")-coordinate(anchor,"x"),dy=coordinate(point,"y")-coordinate(anchor,"y");
  return Json{{"lengthCm",std::hypot(dx,dy)},{"angleDeg",std::atan2(dy,dx)*180/pi}};
}
Json precisePointEdit(const Json& piece,int index,const Json& o) {
  validPiece(piece,index,"point");
  const auto& points=piece["points"];
  const auto& anchor=points[(index+points.size()-1)%points.size()];
  auto next=field(o,"mode")=="polar" ? pointFromPolar(anchor,field(o,"lengthCm"),field(o,"angleDeg"))
    : coordPoint(assertDraftCoordinate(field(o,"x"),"X"),assertDraftCoordinate(field(o,"y"),"Y"));
  if (distance(next,anchor)<0.001 || distance(next,points[(index+1)%points.size()])<0.001)
    throw std::runtime_error("Adjacent pattern points must be at least 0.001 cm apart");
  Json result=points[index]; result["x"]=next["x"];result["y"]=next["y"];return result;
}
Json curveChordCoordinates(const Json& a,const Json& control,const Json& b) {
  double dx=coordinate(b,"x")-coordinate(a,"x"),dy=coordinate(b,"y")-coordinate(a,"y"),length=std::hypot(dx,dy);
  if (length<0.001) throw std::runtime_error("Curve endpoints must be at least 0.001 cm apart");
  double x=coordinate(control,"x")-(coordinate(a,"x")+coordinate(b,"x"))/2;
  double y=coordinate(control,"y")-(coordinate(a,"y")+coordinate(b,"y"))/2;
  return Json{{"alongCm",(x*dx+y*dy)/length},{"depthCm",(-x*dy+y*dx)/length}};
}
Json preciseCurveEdit(const Json& piece,int index,const Json& o) {
  validPiece(piece,index,"edge");
  auto mode=field(o,"mode"); if (mode.is_null()) mode="absolute";
  if (mode=="absolute") return Json{{"cx",assertDraftCoordinate(field(o,"cx"),"Handle X")},{"cy",assertDraftCoordinate(field(o,"cy"),"Handle Y")}};
  if (mode!="chord") throw std::runtime_error("Unknown curve coordinate system");
  double along=assertDraftCoordinate(field(o,"alongCm"),"Along chord"),depth=assertDraftCoordinate(field(o,"depthCm"),"Curve depth");
  const auto& a=piece["points"][index];const auto& b=piece["points"][(index+1)%piece["points"].size()];
  double dx=coordinate(b,"x")-coordinate(a,"x"),dy=coordinate(b,"y")-coordinate(a,"y"),len=std::hypot(dx,dy);
  if (len<0.001) throw std::runtime_error("Curve endpoints must be at least 0.001 cm apart");
  return Json{{"cx",assertDraftCoordinate((coordinate(a,"x")+coordinate(b,"x"))/2+(along*dx-depth*dy)/len,"Handle X")},
    {"cy",assertDraftCoordinate((coordinate(a,"y")+coordinate(b,"y"))/2+(along*dy+depth*dx)/len,"Handle Y")}};
}
Json quadraticAt(const Json& a,const Json& c,const Json& b,double t) {
  double u=1-t;return coordPoint(u*u*coordinate(a,"x")+2*u*t*coordinate(c,"x")+t*t*coordinate(b,"x"),
  u*u*coordinate(a,"y")+2*u*t*coordinate(c,"y")+t*t*coordinate(b,"y"));
}
Json quadraticDerivative(const Json& a,const Json& c,const Json& b,double t) {
  return coordPoint(2*((1-t)*(coordinate(c,"x")-coordinate(a,"x"))+t*(coordinate(b,"x")-coordinate(c,"x"))),
    2*((1-t)*(coordinate(c,"y")-coordinate(a,"y"))+t*(coordinate(b,"y")-coordinate(c,"y"))));
}
double quadraticArcLength(const Json& a,const Json& c,const Json& b,double start,double end,double tolerance) {
  validateCurve(a,c,b,start,end);
  double begin=std::clamp(start,0.,1.),finish=std::clamp(end,0.,1.);
  if (std::abs(finish-begin)<=epsilon) return 0;
  double lo=std::min(begin,finish),hi=std::max(begin,finish);
  auto speed=[&](double t){auto v=quadraticDerivative(a,c,b,t);return std::hypot(coordinate(v,"x"),coordinate(v,"y"));};
  auto simpson=[](double x,double y,double fx,double fm,double fy){return (y-x)*(fx+4*fm+fy)/6;};
  std::function<double(double,double,double,double,double,double,double,int)> recurse;
  recurse=[&](double x,double y,double fx,double fm,double fy,double integral,double error,int depth)->double {
    double center=(x+y)/2,lm=(x+center)/2,rm=(center+y)/2;
    double flm=speed(lm),frm=speed(rm),left=simpson(x,center,fx,flm,fm),right=simpson(center,y,fm,frm,fy);
    if(depth>=20 || std::abs(left+right-integral)<=error*15) return left+right+(left+right-integral)/15;
    return recurse(x,center,fx,flm,fm,left,error/2,depth+1)+recurse(center,y,fm,frm,fy,right,error/2,depth+1);
  };
  double fx=speed(lo),fy=speed(hi),fm=speed((lo+hi)/2);
  return recurse(lo,hi,fx,fm,fy,simpson(lo,hi,fx,fm,fy),std::max(1e-11,tolerance),0);
}
Json quadraticAtLengthFraction(const Json& a,const Json& c,const Json& b,const Json& fraction) {
  double f=number(fraction);if (!std::isfinite(f)) throw std::runtime_error("Invalid curve length fraction");
  f=std::clamp(f,0.,1.);double total=quadraticArcLength(a,c,b);
  if(total<epsilon) return Json{{"point",a},{"tangent",coordPoint(1,0)},{"fraction",f}};
  double target=f*total,low=0,high=1;
  for(int i=0;i<30;i++){double mid=(low+high)/2; if(quadraticArcLength(a,c,b,0,mid)<target)low=mid;else high=mid;}
  double t=f==0?0:f==1?1:(low+high)/2;auto point=quadraticAt(a,c,b,t),d=quadraticDerivative(a,c,b,t);
  double mag=std::hypot(coordinate(d,"x"),coordinate(d,"y"));
  Json tangent=mag>epsilon?coordPoint(coordinate(d,"x")/mag,coordinate(d,"y")/mag):
    coordPoint((coordinate(b,"x")-coordinate(a,"x"))/total,(coordinate(b,"y")-coordinate(a,"y"))/total);
  return Json{{"point",point},{"tangent",tangent},{"normal",coordPoint(-coordinate(tangent,"y"),coordinate(tangent,"x"))},{"fraction",f},{"parameter",t}};
}
Json draftingPrecisionOperation(const std::string& op,const Json& o) {
  auto a=field(o,"a"),c=field(o,"control"),b=field(o,"b");
  if(op=="assertDraftCoordinate")return assertDraftCoordinate(field(o,"value"),field(o,"label").is_string()?o["label"].get<std::string>():"coordinate");
  if(op=="pointFromPolar")return pointFromPolar(field(o,"anchor"),field(o,"lengthCm"),field(o,"angleDeg"));
  if(op=="polarFromPoints")return polarFromPoints(field(o,"anchor"),field(o,"point"));
  if(op=="precisePointEdit")return precisePointEdit(field(o,"piece"),o.at("index").get<int>(),o.at("options"));
  if(op=="curveChordCoordinates")return curveChordCoordinates(a,c,b);
  if(op=="preciseCurveEdit")return preciseCurveEdit(field(o,"piece"),o.at("index").get<int>(),o.at("options"));
  if(op=="quadraticAt")return quadraticAt(a,c,b,o.at("t").get<double>());
  if(op=="quadraticDerivative")return quadraticDerivative(a,c,b,o.at("t").get<double>());
  if(op=="quadraticArcLength")return quadraticArcLength(a,c,b,field(o,"start").is_number()?o["start"].get<double>():0,field(o,"end").is_number()?o["end"].get<double>():1,field(o,"tolerance").is_number()?o["tolerance"].get<double>():1e-7);
  if(op=="quadraticAtLengthFraction")return quadraticAtLengthFraction(a,c,b,field(o,"fraction"));
  throw std::runtime_error("Unknown precision operation");
}
}
