#include "pattern_mesh.hpp"
#include <cassert>
#include <cmath>
#include <functional>
#include <iostream>

using garment::Json;
static bool rejects(const std::function<void()>& f) {try {f();}catch(const std::exception&){return true;}return false;}
static double area(const garment::PatternMesh& m) {
  double a=0;for(auto t:m.triangles){auto p=m.vertices[t[0]].positionCm,q=m.vertices[t[1]].positionCm,r=m.vertices[t[2]].positionCm;a+=std::abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))/2;}return a;
}
int main() {
  Json concave={{"id","front"},{"points",Json::array({{{"x",0},{"y",0}},{{"x",10},{"y",0}},{{"x",10},{"y",10}},{{"x",5},{"y",5}},{{"x",0},{"y",10}}})},{"grainline",{{"dx",1},{"dy",0}}}};
  Json seams=Json::array({{{"id","shoulder"},{"a",{{"pieceId","front"},{"edgeIndex",1}}},{"b",{{"pieceId","back"},{"edgeIndex",0}}}}});
  auto base=garment::buildPatternMesh(concave,seams,2,0);
  assert(base.vertices.size()==5 && base.triangles.size()==3 && std::abs(area(base)-75)<1e-8);
  assert(base.edges[1].seamId=="shoulder" && base.grainDirection.x==1);
  auto refined=garment::buildPatternMesh(concave,seams,2,2);
  assert(refined.triangles.size()==48 && std::abs(area(refined)-75)<1e-8);
  assert(refined.edges[1].boundaryIndices.size()==5);
  for(auto t:refined.triangles)for(auto i:t)assert(i<refined.vertices.size());
  Json curved=concave;curved["curves"]={{"0",{{"cx",5},{"cy",-4}}}};
  auto curve=garment::buildPatternMesh(curved,seams,8,0);
  assert(curve.vertices.size()==12 && curve.edges[0].boundaryIndices.size()==9);
  assert(std::abs(curve.vertices[4].positionCm.y+2)<1e-8);
  assert(area(curve)>area(base));
  Json angled=concave;
  angled.erase("grainline");
  angled["grainAngleDeg"]=30;
  const auto angledMesh=garment::buildPatternMesh(angled,seams,2,0);
  assert(std::abs(angledMesh.grainDirection.x-0.5)<1e-10);
  assert(std::abs(angledMesh.grainDirection.y-std::sqrt(3.)/2)<1e-10);
  Json oversized=curved;
  for (std::size_t i=0;i<oversized["points"].size();++i)
    oversized["curves"][std::to_string(i)]={{"cx",3},{"cy",4}};
  assert(rejects([&]{garment::buildPatternMesh(oversized,seams,1000,0);}));
  Json reversed=concave;std::reverse(reversed["points"].begin(),reversed["points"].end());
  assert(std::abs(area(garment::buildPatternMesh(reversed))-75)<1e-8);
  Json broken=concave;broken["points"][2]={{"x",0},{"y",10}};broken["points"][4]={{"x",10},{"y",10}};
  assert(rejects([&]{garment::buildPatternMesh(broken);}));
  broken=concave;broken["points"][0]["x"]=1e100;
  assert(rejects([&]{garment::buildPatternMesh(broken);}));
  Json project={{"pieces",Json::array({concave,curved})},{"seams",seams}};
  assert(garment::buildProjectPatternMeshes(project,4,0).size()==2);
  std::cout<<"native pattern mesh tests passed\n";
}
