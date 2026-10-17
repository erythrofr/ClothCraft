#include "fabric_surface.hpp"
#include <cassert>
#include <cmath>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;
  while(std::getline(std::cin,line)){
   try{
    Json input=Json::parse(line),output;
    const auto op=input.at("op").get<std::string>();
    if(op=="optics")output=garment::normalizeFabricOptics(input.value("fabric",Json::object()));
    else if(op=="albedo")output=garment::textileAlbedoMultiplier(input.value("family",std::string()),input.value("u",0.),input.value("v",0.),input.value("variation",.25));
    else if(op=="filename")output=garment::classifyFabricPbrFilename(input.value("filename",std::string()));
    else throw std::invalid_argument("invalid operation");
    std::cout<<output.dump()<<'\n';
   }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
  }return 0;
 }
 auto defaults=garment::normalizeFabricOptics();
 assert(defaults["roughness"]==.82&&defaults["opacity"]==1&&defaults["weaveScaleCm"]==3);
 assert(garment::classifyFabricPbrFilename("cotton_normalGL.png")=="normal");
 assert(garment::classifyFabricPbrFilename("cotton_normal_dx.png").is_null());
 assert(garment::classifyFabricPbrFilename("cotton_ARM.jpg").is_null());
 assert(std::abs(garment::textileAlbedoMultiplier("twill",0,0,.25)-.9775)<1e-10);
 std::cout<<"native fabric surface unit tests passed\n";
}
