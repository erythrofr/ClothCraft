#include "zozo_reference_dress.hpp"
#include <cassert>
#include <iostream>
#include <vector>

int main(int argc,char** argv) {
  const auto dir=argc>1 ? argv[1] : "public/references/zozo-dress";
  try {
    auto source=garment::loadZozoDressReference(dir);
    assert(source.manifest().at("accepted")==false);
    assert(source.manifest().at("fullPhysicalFitVerified")==false);
    assert(source.meshes().at("clothPanels").size()==14);
    std::vector<std::size_t> coordinates={0,1,2,31,103,28467,15656*3,28467*3-3,
        28467*3-2,28467*3-1};
    garment::Json samples=garment::Json::array();
    for(int frame:{0,1,87,90,174,240})
      samples.push_back({{"frame",frame},
        {"sampleBits",source.frameFloat32Bits(frame,coordinates)}});
    if(argc>2 && std::string(argv[2])=="--json") {
      std::cout<<garment::Json{{"manifest",source.manifest()},
        {"meshes",source.meshes()},{"sampleCoordinates",coordinates},
        {"frames",samples},{"accepted",false},
        {"fullPhysicalFitVerified",false}}.dump()<<'\n';
      return 0;
    }
    assert(samples.size()==6);
    bool rejected=false;
    try { source.frameVertices(241); }
    catch(const std::out_of_range&){rejected=true;}
    assert(rejected);
    std::cout<<"Original ZOZO dress native reference read-only smoke passed\n";
    return 0;
  }catch(const std::exception& e){
    std::cerr<<e.what()<<'\n';return 1;
  }
}
