#include "cutting_geometry.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {

double finiteNumber(const Json& value, const char* label) {
  if (!value.is_number()) throw std::invalid_argument(std::string(label)+" must be numeric");
  const double n=value.get<double>();
  if (!std::isfinite(n) || std::abs(n)>100000)
    throw std::invalid_argument(std::string(label)+" must be a finite cm value");
  return n;
}

Point2 readPoint(const Json& p) {return {finiteNumber(p.at("x"),"x"),finiteNumber(p.at("y"),"y")};}

double edgeAllowance(const Json& piece,std::size_t edge) {
  double base=0;
  if (piece.contains("seamAllowance") && !piece.at("seamAllowance").is_null())
    base=finiteNumber(piece.at("seamAllowance"),"seamAllowance");
  if (piece.contains("edgeSeamAllowances") && piece.at("edgeSeamAllowances").is_object()) {
    const auto& overrides=piece.at("edgeSeamAllowances");
    auto it=overrides.find(std::to_string(edge));
    if (it!=overrides.end() && !it->is_null()) base=finiteNumber(it.value(),"edgeSeamAllowance");
  }
  return std::max(0.,base);
}

Point2 normalized(double dx,double dy) {
  const double len=std::hypot(dx,dy);
  if (len<1e-12) throw std::invalid_argument("degenerate cut-outline segment");
  return {dx/len,dy/len};
}

} // namespace

std::vector<Point2> sampleCutBoundary(const Json& piece,int segmentsPerCurve) {
  if (segmentsPerCurve<2 || segmentsPerCurve>256)
    throw std::invalid_argument("cutting segments must be between 2 and 256");
  const auto& points=piece.at("points");
  if (!points.is_array() || points.size()<3 || points.size()>100000)
    throw std::invalid_argument("cut boundary requires 3..100000 pattern points");
  std::vector<Point2> sampled;
  std::vector<double> allowances;
  for (std::size_t edge=0;edge<points.size();++edge) {
    const auto a=readPoint(points[edge]),b=readPoint(points[(edge+1)%points.size()]);
    const std::string key=std::to_string(edge);
    const auto allowance=edgeAllowance(piece,edge);
    const bool curved=piece.contains("curves") && piece.at("curves").is_object() &&
      piece.at("curves").contains(key) && !piece.at("curves").at(key).is_null();
    if (!curved) {
      sampled.push_back(a);
      allowances.push_back(allowance);
    } else {
      const auto& curve=piece.at("curves").at(key);
      const double cx=finiteNumber(curve.at("cx"),"cx"),cy=finiteNumber(curve.at("cy"),"cy");
      for (int j=0;j<segmentsPerCurve;++j) {
        const double t=static_cast<double>(j)/segmentsPerCurve, s=1-t;
        sampled.push_back({s*s*a.x+2*s*t*cx+t*t*b.x,
                           s*s*a.y+2*s*t*cy+t*t*b.y});
        allowances.push_back(allowance);
      }
    }
  }
  if (sampled.size()<3) throw std::invalid_argument("cut outline has too few samples");
  if (std::all_of(allowances.begin(),allowances.end(),[](double amount){return amount<=0;}))
    return sampled;
  double signedArea=0;
  for (std::size_t i=0;i<sampled.size();++i) {
    auto a=sampled[i],b=sampled[(i+1)%sampled.size()];
    signedArea+=a.x*b.y-b.x*a.y;
  }
  const bool ccw=signedArea>0;
  std::vector<Point2> outline;
  outline.reserve(sampled.size());
  for (std::size_t i=0;i<sampled.size();++i) {
    const std::size_t prev=(i+sampled.size()-1)%sampled.size();
    const auto a=sampled[prev],b=sampled[i],c=sampled[(i+1)%sampled.size()];
    const auto incoming=normalized(b.x-a.x,b.y-a.y);
    const auto outgoing=normalized(c.x-b.x,c.y-b.y);
    const auto normalIn=ccw?Point2{incoming.y,-incoming.x}:Point2{-incoming.y,incoming.x};
    const auto normalOut=ccw?Point2{outgoing.y,-outgoing.x}:Point2{-outgoing.y,outgoing.x};
    const double prevAllowance=allowances[prev],currentAllowance=allowances[i];
    const Point2 aOffset{b.x+normalIn.x*prevAllowance,b.y+normalIn.y*prevAllowance};
    const Point2 bOffset{b.x+normalOut.x*currentAllowance,b.y+normalOut.y*currentAllowance};
    Point2 intersection;
    const double den=incoming.x*outgoing.y-incoming.y*outgoing.x;
    if (std::abs(den)<1e-7) {
      intersection={b.x+(normalIn.x*prevAllowance+normalOut.x*currentAllowance)*.5,
                    b.y+(normalIn.y*prevAllowance+normalOut.y*currentAllowance)*.5};
    } else {
      const double dx=bOffset.x-aOffset.x,dy=bOffset.y-aOffset.y;
      const double t=(dx*outgoing.y-dy*outgoing.x)/den;
      intersection={aOffset.x+incoming.x*t,aOffset.y+incoming.y*t};
    }
    const double length=std::hypot(intersection.x-b.x,intersection.y-b.y);
    const double limit=std::max({prevAllowance,currentAllowance,.001})*3.5;
    if (length>limit)
      intersection={b.x+(intersection.x-b.x)/length*limit,
                    b.y+(intersection.y-b.y)/length*limit};
    if (!std::isfinite(intersection.x) || !std::isfinite(intersection.y))
      throw std::invalid_argument("invalid seam allowance offset point");
    outline.push_back(intersection);
  }
  return outline;
}

} // namespace garment
