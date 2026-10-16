#include "mesh_selection.hpp"
#include <cassert>
#include <iostream>

using garment::Json;
int main() {
  const Json front="front",back="back";
  const Json face={{"a",0},{"b",1},{"c",2}};
  const Json second={{"a",1},{"b",2},{"c",4}};
  const auto a=garment::mergeMeshFaceSelection(nullptr,front,3,face);
  assert(a["triangleIndices"]==Json::array({3}));
  const auto b=garment::mergeMeshFaceSelection(a,front,7,second,true);
  assert(b["vertices"]==Json::array({0,1,2,4}));
  const auto c=garment::mergeMeshFaceSelection(b,front,3,face,true);
  assert(c["triangleIndices"]==Json::array({7}));
  assert(garment::mergeMeshFaceSelection(c,front,7,second,true).is_null());
  assert(garment::mergeMeshFaceSelection(b,back,2,face,true)["triangleIndices"]==Json::array({2}));
  assert(garment::mergeMeshFaceSelection(b,front,-1,face).is_null());
  std::cout<<"native mesh-face selection passed\n";
}
