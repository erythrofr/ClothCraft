#include "drafting_snapping.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <string>

namespace garment {
namespace {
constexpr double pi = 3.141592653589793238462643383279502884;

bool finitePoint(const Json& p) {
  return p.is_object() && p.contains("x") && p.at("x").is_number() &&
         p.contains("y") && p.at("y").is_number() &&
         std::isfinite(p.at("x").get<double>()) &&
         std::isfinite(p.at("y").get<double>());
}
bool finiteCurveControl(const Json& curve) {
  return curve.is_object() && curve.contains("cx") && curve.at("cx").is_number() &&
         curve.contains("cy") && curve.at("cy").is_number() &&
         std::isfinite(curve.at("cx").get<double>()) &&
         std::isfinite(curve.at("cy").get<double>());
}
Point2 xy(const Json& j) { return {j.at("x").get<double>(), j.at("y").get<double>()}; }
Json jsonPoint(Point2 p) { return {{"x",p.x},{"y",p.y}}; }
double squared(Point2 a, Point2 b) {
  return (a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y);
}
Point2 interpolate(Point2 a, Point2 control, Point2 b, double t) {
  const double u=1-t;
  return {u*u*a.x+2*u*t*control.x+t*t*b.x,
          u*u*a.y+2*u*t*control.y+t*t*b.y};
}
Point2 global(Point2 local, Point2 layout) {
  return {layout.x + local.x, layout.y - local.y};
}
Point2 projected(Point2 p, Point2 a, Point2 b) {
  const double dx=b.x-a.x,dy=b.y-a.y, norm=dx*dx+dy*dy;
  const double t=norm<1e-12?0:std::clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/norm,0.,1.);
  return {a.x+t*dx,a.y+t*dy};
}
bool integerIndex(const Json& obj, const char* key, std::size_t& out) {
  if (!obj.is_object() || !obj.contains(key) || !obj.at(key).is_number()) return false;
  const double d=obj.at(key).get<double>();
  if (!std::isfinite(d)||d<0||d>static_cast<double>(std::numeric_limits<std::size_t>::max())||std::floor(d)!=d) return false;
  out=static_cast<std::size_t>(d);
  return true;
}
} // namespace

Json snapDraftGrid(const Json& point,double spacingCm,const Json& origin) {
  if (!finitePoint(point)||!finitePoint(origin)||!std::isfinite(spacingCm)||spacingCm<=0)
    throw std::invalid_argument("Invalid 2D drafting grid");
  const auto p=xy(point), o=xy(origin);
  // JS Math.round(-0.5) is -0, whereas C++ round(-0.5) is -1.
  return jsonPoint({o.x+std::floor((p.x-o.x)/spacingCm+0.5)*spacingCm,
                    o.y+std::floor((p.y-o.y)/spacingCm+0.5)*spacingCm});
}

Json nearestOnDraftSegment(const Json& point,const Json& a,const Json& b) {
  if (!finitePoint(point)||!finitePoint(a)||!finitePoint(b))
    throw std::invalid_argument("Invalid drafting segment");
  const auto p=xy(point), first=xy(a), last=xy(b);
  const double dx=last.x-first.x,dy=last.y-first.y,norm=dx*dx+dy*dy;
  const double t=norm<1e-12?0:std::clamp(((p.x-first.x)*dx+(p.y-first.y)*dy)/norm,0.,1.);
  return {{"x",first.x+t*dx},{"y",first.y+t*dy},{"t",t}};
}

Json snapDraftPattern(const Json& point,const Json& pieces,const Json& options) {
  const double tolerance = options.is_object()?options.value("toleranceCm",1.0):1.0;
  if (!finitePoint(point)||!std::isfinite(tolerance)||tolerance<=0)
    throw std::invalid_argument("Invalid drafting snap point or tolerance");
  if (!pieces.is_array()) return nullptr;
  const bool allowEdges=options.is_object()?options.value("allowEdges",true):true;
  int samples=options.is_object()?options.value("samplesPerCurve",16):16;
  // Bound user-controlled sampling to prevent an unbounded allocation/loop.
  if (samples<2||samples>1024) throw std::invalid_argument("Invalid drafting curve sampling");
  const std::string excludedPiece=options.is_object()&&options.contains("excludedPieceId")&&options.at("excludedPieceId").is_string()
    ? options.at("excludedPieceId").get<std::string>():std::string();
  const Json excludedPoint=options.is_object()?options.value("excludedPoint",Json(nullptr)):Json(nullptr);
  const std::string excludedPointPiece=excludedPoint.is_object()?excludedPoint.value("pieceId",std::string()):std::string();
  std::size_t excludedPointIndex=0;
  const bool hasExcludedIndex=integerIndex(excludedPoint,"pointIndex",excludedPointIndex);
  const auto target=xy(point);
  Json vertex=nullptr,edge=nullptr;
  double vertexSq=tolerance*tolerance,edgeSq=tolerance*tolerance;
  const auto consider=[&](Point2 candidate,bool isVertex,const std::string& id,std::size_t index) {
    if (!std::isfinite(candidate.x)||!std::isfinite(candidate.y)) return;
    const auto distanceSq=squared(target,candidate);
    auto& best=isVertex?vertex:edge;
    auto& threshold=isVertex?vertexSq:edgeSq;
    if (distanceSq>threshold) return;
    threshold=distanceSq;
    best={{"x",candidate.x},{"y",candidate.y},{"distanceCm",std::sqrt(distanceSq)},
          {"kind",isVertex?"vertex":"edge"},{"pieceId",id}};
    best[isVertex?"pointIndex":"edgeIndex"]=index;
  };
  for (const auto& piece:pieces) {
    if (!piece.is_object()||!piece.contains("id")||!piece.at("id").is_string()||
        !piece.contains("points")||!piece.at("points").is_array()||
        !piece.contains("layout2d")||!finitePoint(piece.at("layout2d"))) continue;
    const auto id=piece.at("id").get<std::string>();
    if (!excludedPiece.empty()&&id==excludedPiece) continue;
    const auto& points=piece.at("points");
    const std::size_t n=points.size();
    if (!n) continue;
    const Point2 layout=xy(piece.at("layout2d"));
    const bool selfExcluded=hasExcludedIndex&&excludedPointPiece==id;
    for (std::size_t index=0;index<n;++index) {
      if (selfExcluded&&(index==excludedPointIndex||index==(excludedPointIndex+1)%n||
                         index==(excludedPointIndex+n-1)%n)) continue;
      if (finitePoint(points[index])) consider(global(xy(points[index]),layout),true,id,index);
    }
    if (!allowEdges||n<2) continue;
    const Json curves=piece.value("curves",Json::object());
    for (std::size_t i=0;i<n;++i) {
      if (selfExcluded&&(i==excludedPointIndex||(i+1)%n==excludedPointIndex)) continue;
      if (!finitePoint(points[i])||!finitePoint(points[(i+1)%n])) continue;
      const Point2 a=xy(points[i]),b=xy(points[(i+1)%n]);
      const std::string key=std::to_string(i);
      const bool curved=curves.is_object()&&curves.contains(key)&&finiteCurveControl(curves.at(key));
      const Point2 control=curved?Point2{curves.at(key).at("cx").get<double>(),curves.at(key).at("cy").get<double>()}:Point2{};
      const int count=curved?samples:1;
      Point2 prior=global(a,layout);
      for(int j=1;j<=count;++j) {
        Point2 current=global(curved?interpolate(a,control,b,double(j)/count):b,layout);
        consider(projected(target,prior,current),false,id,i);
        prior=current;
      }
    }
  }
  if (!vertex.is_null()&&(vertexSq<=tolerance*tolerance*0.36||edge.is_null())) return vertex;
  return edge;
}

Json constrainDraftAxis(const Json& start,const Json& destination,double incrementDegrees) {
  if (!finitePoint(start)||!finitePoint(destination)||!std::isfinite(incrementDegrees)||
      incrementDegrees<=0||std::fmod(360.,incrementDegrees)!=0)
    throw std::invalid_argument("Invalid drafting guideline");
  const Point2 a=xy(start),b=xy(destination);
  const double dx=b.x-a.x,dy=b.y-a.y;
  if (std::hypot(dx,dy)<1e-10) return destination;
  const double increment=incrementDegrees*pi/180.;
  const double angle=std::floor(std::atan2(dy,dx)/increment+0.5)*increment;
  const double travel=dx*std::cos(angle)+dy*std::sin(angle);
  return jsonPoint({a.x+travel*std::cos(angle),a.y+travel*std::sin(angle)});
}
} // namespace garment
