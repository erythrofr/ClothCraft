#include "fabric_pbr_pixels.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv) {
 if(argc>1 && std::string(argv[1])=="--json-lines") {
  std::string line;
  while(std::getline(std::cin,line)) {
   try {
    const Json q=Json::parse(line);
    const auto v=garment::estimateFabricPbrPixels(q.at("imageData"),q.value("options",Json::object()));
    std::cout<<Json{{"ok",true},{"result",v}}.dump()<<'\n';
   } catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  }
  return 0;
 }
 Json pixels={{"width",2},{"height",2},{"data",Json::array({
   128,128,128,255,128,128,128,255,128,128,128,255,128,128,128,255})}};
 auto maps=garment::estimateFabricPbrPixels(pixels);
 assert(maps["normal"].size()==16 && maps["roughness"].size()==16);
 assert(maps["normal"][0]==128 && maps["normal"][1]==128);
 assert(maps["normal"][2]==255 && maps["roughness"][0]==198);
 std::cout<<"native fabric PBR pixels test passed\n";
}
