#include "textile_procedurals.hpp"
#include <cassert>
#include <cmath>
#include <iostream>

int main() {
  namespace t = garment::textile_procedurals;
  const auto fabric=t::describeTextileSurface({{"name","Washed denim"}});
  assert(fabric.at("family")=="twill");
  assert(std::isfinite(t::textileRelief("jersey-knit",.4,.6)));
  const auto maps=t::makeProceduralTextileMaps({{"name","Washed denim"}},4);
  assert(maps.at("resolution")==4);
  assert(maps.at("colorPixels").size()==64);
  assert(maps.at("normalPixels").size()==64);
  assert(maps.at("roughnessPixels").size()==64);
  assert(maps.at("heights").size()==16);
  std::cout<<"native textile procedural pixels smoke test passed\n";
}
