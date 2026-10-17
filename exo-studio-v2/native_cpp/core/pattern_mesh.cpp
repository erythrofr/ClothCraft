#include "pattern_mesh.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <map>
#include <stdexcept>

namespace garment {
namespace {
constexpr double eps=1e-9;
double number(const Json& j) {
  if (!j.is_number()) throw std::invalid_argument("pattern coordinate is not numeric");
  const double v=j.get<double>();
  if (!std::isfinite(v) || std::abs(v)>100000) throw std::invalid_argument("pattern coordinate outside finite cm range");
  return v;
}
Point2 point(const Json& j) {return {number(j.at("x")),number(j.at("y"))};}
double cross(Point2 a,Point2 b,Point2 c) {
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
bool onSegment(Point2 p,Point2 a,Point2 b) {
  return std::abs(cross(a,b,p))<=eps && p.x>=std::min(a.x,b.x)-eps && p.x<=std::max(a.x,b.x)+eps && p.y>=std::min(a.y,b.y)-eps && p.y<=std::max(a.y,b.y)+eps;
}
bool intersects(Point2 a,Point2 b,Point2 c,Point2 d) {
  auto x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  if (((x>eps && y< -eps) || (x< -eps && y>eps)) &&
      ((z>eps && w< -eps) || (z< -eps && w>eps))) return true;
  return onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
bool inside(Point2 p,Point2 a,Point2 b,Point2 c,double orientation) {
  return orientation*cross(a,b,p)>=-eps && orientation*cross(b,c,p)>=-eps && orientation*cross(c,a,p)>=-eps;
}
std::string seamFor(const Json& seams,const std::string& id,std::size_t edge) {
  if (!seams.is_array()) throw std::invalid_argument("seams must be array");
  std::string result;
  for (const auto& seam:seams) {
    if (!seam.is_object()) continue;
    for (const char* side:{"a","b"}) {
      if (!seam.contains(side)||!seam.at(side).is_object()) continue;
      const auto& end=seam.at(side);
      if (end.value("pieceId",std::string{})==id && end.contains("edgeIndex") && end.at("edgeIndex").is_number_integer() && end.at("edgeIndex").get<int>()==static_cast<int>(edge)) {
        const auto name=seam.value("id",std::string{});
        if (result.empty()) result=name;
        else if (!name.empty() && result.find(name)==std::string::npos) result+=","+name;
      }
    }
  }
  return result;
}
} // namespace

PatternMesh buildPatternMesh(const Json& piece,const Json& seams,int segmentsPerCurve,int resolution) {
  if (segmentsPerCurve<2||segmentsPerCurve>128||resolution<0||resolution>3) throw std::invalid_argument("invalid pattern mesh sampling settings");
  if (!piece.is_object()||!piece.contains("points")||!piece.at("points").is_array()) throw std::invalid_argument("missing pattern points");
  const auto& source=piece.at("points");
  // Ear clipping and intersection checks are quadratic; refuse pathological
  // CAD inputs rather than allocating unbounded refined meshes on GUI thread.
  if (source.size()<3||source.size()>4096) throw std::invalid_argument("pattern requires 3..4096 points");
  const std::string id=piece.value("id",std::string{});
  PatternMesh out;out.pieceId=id;
  std::vector<Point2> poly;
  for (std::size_t e=0;e<source.size();++e) {
    Point2 a=point(source[e]),b=point(source[(e+1)%source.size()]);
    PatternMeshEdge mapped;mapped.sourceEdge=e;mapped.seamId=seamFor(seams,id,e);
    mapped.boundaryIndices.push_back(poly.size());
    const std::string key=std::to_string(e);
    bool curved=piece.contains("curves")&&piece.at("curves").is_object()&&piece.at("curves").contains(key)&&!piece.at("curves").at(key).is_null();
    Point2 control{};
    if (curved) control=point(Json{{"x",piece.at("curves").at(key).at("cx")},{"y",piece.at("curves").at(key).at("cy")}});
    int steps=curved?segmentsPerCurve:1;
    if (poly.size()+static_cast<std::size_t>(steps)>4096)
      throw std::invalid_argument("pattern mesh exceeds 4096 sampled boundary vertices");
    for (int j=0;j<steps;++j) {
      double t=double(j)/steps,s=1-t;
      Point2 p=curved?Point2{s*s*a.x+2*s*t*control.x+t*t*b.x,s*s*a.y+2*s*t*control.y+t*t*b.y}:a;
      if (!poly.empty() && std::hypot(p.x-poly.back().x,p.y-poly.back().y)<eps) throw std::invalid_argument("degenerate sampled edge");
      poly.push_back(p);
      if (j) mapped.boundaryIndices.push_back(poly.size()-1);
    }
    mapped.boundaryIndices.push_back(poly.size()); // wrapped after final edge
    out.edges.push_back(std::move(mapped));
  }
  if (std::hypot(poly.front().x-poly.back().x,poly.front().y-poly.back().y)<eps) throw std::invalid_argument("duplicate polygon closure");
  for (auto& edge:out.edges) for (auto& index:edge.boundaryIndices) index%=poly.size();
  double area=0;
  for (std::size_t i=0;i<poly.size();++i) area+=poly[i].x*poly[(i+1)%poly.size()].y-poly[(i+1)%poly.size()].x*poly[i].y;
  if (std::abs(area)<eps) throw std::invalid_argument("zero-area pattern polygon");
  for (std::size_t i=0;i<poly.size();++i) for (std::size_t j=i+1;j<poly.size();++j) {
    if (j==i+1||(i==0&&j==poly.size()-1)) continue;
    if (intersects(poly[i],poly[(i+1)%poly.size()],poly[j],poly[(j+1)%poly.size()])) throw std::invalid_argument("self-intersecting pattern outline");
  }
  const double orientation=area>0?1:-1;
  std::vector<std::size_t> ring(poly.size());for (std::size_t i=0;i<ring.size();++i)ring[i]=i;
  while (ring.size()>3) {
    bool clipped=false;
    for (std::size_t k=0;k<ring.size();++k) {
      auto a=ring[(k+ring.size()-1)%ring.size()],b=ring[k],c=ring[(k+1)%ring.size()];
      if (orientation*cross(poly[a],poly[b],poly[c])<=eps) continue;
      bool blocked=false;
      for (auto q:ring) if (q!=a&&q!=b&&q!=c&&inside(poly[q],poly[a],poly[b],poly[c],orientation)) {blocked=true;break;}
      if (blocked) continue;
      out.triangles.push_back({a,b,c});ring.erase(ring.begin()+k);clipped=true;break;
    }
    if (!clipped) throw std::invalid_argument("pattern triangulation failed");
  }
  if (orientation*cross(poly[ring[0]],poly[ring[1]],poly[ring[2]])<=eps) throw std::invalid_argument("degenerate final triangle");
  out.triangles.push_back({ring[0],ring[1],ring[2]});
  Point2 grain{0,1};
  if (piece.contains("grainline")&&!piece.at("grainline").is_null()) {
    const auto& g=piece.at("grainline");
    if (g.is_object()) {
      if (g.contains("dx")&&g.contains("dy")) grain={number(g.at("dx")),number(g.at("dy"))};
      else if (g.contains("angle")) {double a=number(g.at("angle"))*3.14159265358979323846/180.;grain={std::sin(a),std::cos(a)};}
      else if (g.contains("start")&&g.contains("end")) {auto a=point(g.at("start")),b=point(g.at("end"));grain={b.x-a.x,b.y-a.y};}
    }
  } else if (piece.contains("grainAngleDeg") && !piece.at("grainAngleDeg").is_null()) {
    const double angle=number(piece.at("grainAngleDeg"))*3.14159265358979323846/180.;
    grain={std::sin(angle),std::cos(angle)};
  }
  double len=std::hypot(grain.x,grain.y);
  if (len<eps) throw std::invalid_argument("zero grainline direction");
  grain.x/=len;grain.y/=len;out.grainDirection=grain;
  double minU=std::numeric_limits<double>::max(),minV=minU,maxU=-minU,maxV=-minU;
  auto uv=[&](Point2 p){return Point2{p.x*grain.y-p.y*grain.x,p.x*grain.x+p.y*grain.y};};
  for (auto p:poly) {auto t=uv(p);minU=std::min(minU,t.x);maxU=std::max(maxU,t.x);minV=std::min(minV,t.y);maxV=std::max(maxV,t.y);}
  for (auto p:poly) {auto t=uv(p);out.vertices.push_back({p,{(t.x-minU)/std::max(eps,maxU-minU),(t.y-minV)/std::max(eps,maxV-minV)}});}
  for (int level=0;level<resolution;++level) {
    std::map<std::pair<std::size_t,std::size_t>,std::size_t> cache;
    auto midpoint=[&](std::size_t a,std::size_t b) {
      const auto key=std::minmax(a,b); auto it=cache.find(key);if(it!=cache.end())return it->second;
      auto p=out.vertices[a],q=out.vertices[b];std::size_t n=out.vertices.size();
      out.vertices.push_back({{(p.positionCm.x+q.positionCm.x)/2,(p.positionCm.y+q.positionCm.y)/2},{(p.uv.x+q.uv.x)/2,(p.uv.y+q.uv.y)/2}});
      cache.emplace(key,n);return n;
    };
    std::vector<std::array<std::size_t,3>> next;next.reserve(out.triangles.size()*4);
    for (auto t:out.triangles) {auto ab=midpoint(t[0],t[1]),bc=midpoint(t[1],t[2]),ca=midpoint(t[2],t[0]);next.push_back({t[0],ab,ca});next.push_back({ab,t[1],bc});next.push_back({ca,bc,t[2]});next.push_back({ab,bc,ca});}
    out.triangles=std::move(next);
    for (auto& edge:out.edges) {
      std::vector<std::size_t> expanded;for(std::size_t i=0;i+1<edge.boundaryIndices.size();++i) {auto a=edge.boundaryIndices[i],b=edge.boundaryIndices[i+1];expanded.push_back(a);expanded.push_back(midpoint(a,b));}expanded.push_back(edge.boundaryIndices.back());edge.boundaryIndices=std::move(expanded);
    }
  }
  return out;
}

std::vector<PatternMesh> buildProjectPatternMeshes(const Json& project,int segmentsPerCurve,int resolution) {
  if (!project.is_object()||!project.contains("pieces")||!project.at("pieces").is_array()) throw std::invalid_argument("project pieces must be array");
  const Json seams=project.value("seams",Json::array());
  std::vector<PatternMesh> result;
  for (const auto& piece:project.at("pieces")) if (piece.value("active3d",true)) result.push_back(buildPatternMesh(piece,seams,segmentsPerCurve,resolution));
  return result;
}
} // namespace garment
