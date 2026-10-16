#include "cloth_meshing.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <set>
#include <stdexcept>
#include <vector>

namespace garment {
namespace {
struct P {double x,y;};
P point(const Json& j) {
  if(!j.is_object()||!j.contains("x")||!j.contains("y")||
     !j.at("x").is_number()||!j.at("y").is_number())
    throw std::invalid_argument("Invalid cloth boundary point");
  const P p{j.at("x").get<double>(),j.at("y").get<double>()};
  if(!std::isfinite(p.x)||!std::isfinite(p.y))
    throw std::invalid_argument("Non-finite cloth boundary point");
  return p;
}
double segmentError(P p,P a,P b) {
  const double dx=b.x-a.x,dy=b.y-a.y, length=dx*dx+dy*dy;
  const double t=length>1e-15?std::clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/length,0.,1.):0.;
  const double rx=p.x-(a.x+dx*t),ry=p.y-(a.y+dy*t);
  return rx*rx+ry*ry;
}
double area(const std::vector<P>& points) {
  double sum=0;
  for(std::size_t i=0;i<points.size();++i){
    const auto a=points[i],b=points[(i+1)%points.size()];
    sum+=a.x*b.y-b.x*a.y;
  }
  return std::abs(sum)*.5;
}
void reduce(const std::vector<P>& points,std::size_t lo,std::size_t hi,
            double tolerance,std::set<std::size_t>& selected,int depth=0) {
  if(hi-lo<=1)return;
  if(depth>64)throw std::invalid_argument("Cloth contour exceeds supported refinement depth");
  double maxError=-1;
  std::size_t split=0;
  for(std::size_t i=lo+1;i<hi;++i) {
    const double error=segmentError(points[i],points[lo],points[hi]);
    if(error>maxError){maxError=error;split=i;}
  }
  if(maxError<=tolerance)return;
  selected.insert(split);
  reduce(points,lo,split,tolerance,selected,depth+1);
  reduce(points,split,hi,tolerance,selected,depth+1);
}
std::vector<P> toPoints(const Json& source) {
  if(!source.is_array())throw std::invalid_argument("Cloth boundary must be an array");
  std::vector<P> result;
  result.reserve(source.size());
  for(const auto& p:source)result.push_back(point(p));
  return result;
}
}

Json simplifiedClothBoundary(const Json& source,double toleranceCm) {
  if(!source.is_array())throw std::invalid_argument("Cloth boundary must be an array");
  if(source.size()<32||!std::isfinite(toleranceCm)||toleranceCm<=0)return source;
  if(source.size()>100000)throw std::invalid_argument("Cloth boundary too dense");
  const auto points=toPoints(source);
  const auto n=points.size();
  std::size_t first=0;
  for(std::size_t i=1;i<n;++i)
    if(points[i].x<points[first].x ||
       (points[i].x==points[first].x&&points[i].y<points[first].y))first=i;
  std::size_t second=first;
  double farthest=-1;
  for(std::size_t i=0;i<n;++i) {
    const double d=(points[i].x-points[first].x)*(points[i].x-points[first].x)+
      (points[i].y-points[first].y)*(points[i].y-points[first].y);
    if(d>farthest){farthest=d;second=i;}
  }
  const std::size_t split=(second+n-first)%n;
  if(split==0)return source;
  std::vector<P> rotated;
  rotated.reserve(n+1);
  for(std::size_t i=0;i<=n;++i)rotated.push_back(points[(first+i)%n]);
  std::set<std::size_t> selected={0,split,n};
  reduce(rotated,0,split,toleranceCm*toleranceCm,selected);
  reduce(rotated,split,n,toleranceCm*toleranceCm,selected);
  Json simplified=Json::array();
  std::vector<P> result;
  for(auto i:selected)if(i!=n){
    simplified.push_back(source[(first+i)%n]);
    result.push_back(rotated[i]);
  }
  if(simplified.size()<3)return source;
  const double before=area(points),after=area(result);
  if(before>1e-6&&std::abs(before-after)/before>.005)return source;
  return simplified;
}

double measureClothBoundaryDeviation(const Json& source,const Json& simplified) {
  const auto points=toPoints(source),target=toPoints(simplified);
  double peak=0;
  for(auto p:points) {
    double best=std::numeric_limits<double>::infinity();
    for(std::size_t i=0;i<target.size();++i)
      best=std::min(best,segmentError(p,target[i],target[(i+1)%target.size()]));
    peak=std::max(peak,std::sqrt(best));
  }
  return peak;
}
}
