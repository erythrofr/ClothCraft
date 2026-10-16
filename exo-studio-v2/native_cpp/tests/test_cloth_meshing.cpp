#include "cloth_meshing.hpp"
#include <cassert>
#include <cmath>
#include <iostream>
#include <vector>

using garment::Json;
int main(){
  Json source=Json::array();
  for(int i=0;i<128;++i){
    const int side=i/32, step=i%32;
    const double t=static_cast<double>(step)/32.;
    const double x=side==0 ? 20*t : side==1 ? 20 : side==2 ? 20*(1-t) : 0;
    const double y=side==0 ? 0 : side==1 ? 12*t : side==2 ? 12 : 12*(1-t);
    source.push_back({{"x",x},{"y",y},{"pointId",i}});
  }
  const Json before=source;
  const Json reduced=garment::simplifiedClothBoundary(source,.08);
  assert(reduced.is_array()&&reduced.size()==4);
  assert(garment::measureClothBoundaryDeviation(source,reduced)<.08+1e-8);
  assert(source==before);
  for(const auto& p:reduced)assert(p.contains("pointId"));
  assert(garment::simplifiedClothBoundary(source,0)==source);
  assert(garment::simplifiedClothBoundary(source,-1)==source);
  assert(garment::simplifiedClothBoundary(Json::array(),.08)==Json::array());
  std::cout<<"native cloth contour simplification passed\n";
}
