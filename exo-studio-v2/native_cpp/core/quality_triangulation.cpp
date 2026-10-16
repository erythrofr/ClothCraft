#include "quality_triangulation.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <map>
#include <set>
#include <stdexcept>
#include <tuple>
#include <vector>

namespace garment {
namespace {
struct Point{double x=0,y=0;};
using Face=std::array<int,3>;
Point point(const Json& v){
  if(v.is_array()&&v.size()>=2&&v[0].is_number()&&v[1].is_number())
    return {v[0].get<double>(),v[1].get<double>()};
  if(v.is_object()&&v.contains("x")&&v.contains("y")&&v["x"].is_number()&&v["y"].is_number())
    return {v["x"].get<double>(),v["y"].get<double>()};
  throw std::invalid_argument("Invalid cloth mesh vertex");
}
double cross(Point a,Point b,Point c){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
double triangleQuality(const std::vector<Point>& v,Face face){
  const auto a=v.at(face[0]),b=v.at(face[1]),c=v.at(face[2]);
  const double twiceArea=std::abs(cross(a,b,c));
  const double longest=std::max({std::hypot(a.x-b.x,a.y-b.y),
    std::hypot(b.x-c.x,b.y-c.y),std::hypot(c.x-a.x,c.y-a.y)});
  return twiceArea>1e-11 ? longest*longest/twiceArea : std::numeric_limits<double>::infinity();
}
Face orientLike(const std::vector<Point>& v,Face original,Face proposed){
  const auto sign=[](double s){return (s>0)-(s<0);};
  if(sign(cross(v.at(original[0]),v.at(original[1]),v.at(original[2])))==
     sign(cross(v.at(proposed[0]),v.at(proposed[1]),v.at(proposed[2]))))return proposed;
  return {proposed[0],proposed[2],proposed[1]};
}
struct EdgeOccurrence{std::size_t index;int a,b,opposite;};
struct EdgeGroup{std::vector<EdgeOccurrence> occurrences;};
}
Json optimizeTriangleQuality(const Json& mesh,const Json& options){
  if(!mesh.is_object()||!mesh.contains("vertices")||!mesh.at("vertices").is_array()||
     !mesh.contains("faces")||!mesh.at("faces").is_array())
    throw std::invalid_argument("Mesh must contain vertices and faces arrays");
  const auto& sourceVertices=mesh.at("vertices");
  std::vector<Point> vertices;
  vertices.reserve(sourceVertices.size());
  for(const auto& v:sourceVertices)vertices.push_back(point(v));
  std::vector<Face> faces;
  faces.reserve(mesh.at("faces").size());
  for(const auto& tri:mesh.at("faces")){
    if(!tri.is_array()||tri.size()!=3)throw std::invalid_argument("Invalid triangle");
    Face f;
    for(int i=0;i<3;++i){
      if(!tri[i].is_number_integer())throw std::invalid_argument("Invalid triangle index");
      const auto n=tri[i].get<long long>();
      if(n<0||n>=static_cast<long long>(vertices.size()))
        throw std::invalid_argument("Triangle index out of bounds");
      f[i]=static_cast<int>(n);
    }
    faces.push_back(f);
  }
  const double passValue=options.value("passes",8.);
  const double improvement=options.value("minImprovement",.01);
  if(!std::isfinite(passValue)||!std::isfinite(improvement)||passValue<0||passValue>128)
    throw std::invalid_argument("Invalid triangulation quality settings");
  int totalFlips=0;
  for(int pass=0;pass<static_cast<int>(std::ceil(passValue));++pass){
    std::map<std::pair<int,int>,std::size_t> lookup;
    std::vector<EdgeGroup> groups;
    for(std::size_t f=0;f<faces.size();++f){
      for(int i=0;i<3;++i){
        const auto a=faces[f][i],b=faces[f][(i+1)%3],opposite=faces[f][(i+2)%3];
        const auto k=std::minmax(a,b);
        auto it=lookup.find(k);
        if(it==lookup.end()){
          const auto index=groups.size();
          lookup.emplace(k,index);
          groups.push_back({});
          it=lookup.find(k);
        }
        groups[it->second].occurrences.push_back({f,a,b,opposite});
      }
    }
    int changed=0;
    std::set<std::size_t> usedFaces;
    for(const auto& group:groups){
      if(group.occurrences.size()!=2)continue;
      const auto left=group.occurrences[0],right=group.occurrences[1];
      if(usedFaces.count(left.index)||usedFaces.count(right.index))continue;
      const int a=left.a,b=left.b,c=left.opposite,d=right.opposite;
      if(std::set<int>{a,b,c,d}.size()!=4)continue;
      const auto pa=vertices[a],pb=vertices[b],pc=vertices[c],pd=vertices[d];
      const double s1=cross(pa,pb,pc),s2=cross(pa,pb,pd);
      const double t1=cross(pc,pd,pa),t2=cross(pc,pd,pb);
      if(s1*s2>=-1e-10||t1*t2>=-1e-10)continue;
      const auto nextA=orientLike(vertices,faces[left.index],{c,d,a});
      const auto nextB=orientLike(vertices,faces[right.index],{d,c,b});
      const double originalWorst=std::max(triangleQuality(vertices,faces[left.index]),
                                           triangleQuality(vertices,faces[right.index]));
      const double nextWorst=std::max(triangleQuality(vertices,nextA),triangleQuality(vertices,nextB));
      if(!(nextWorst<originalWorst*(1-improvement)))continue;
      faces[left.index]=nextA;
      faces[right.index]=nextB;
      usedFaces.insert(left.index);
      usedFaces.insert(right.index);
      changed++;
    }
    totalFlips+=changed;
    if(!changed)break;
  }
  Json out=Json::array();
  for(const auto& face:faces)out.push_back(Json::array({face[0],face[1],face[2]}));
  return {{"vertices",sourceVertices},{"faces",out},{"flips",totalFlips}};
}
}
