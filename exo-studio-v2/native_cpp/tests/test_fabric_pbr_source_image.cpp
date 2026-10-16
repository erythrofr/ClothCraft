#include "fabric_pbr_source_image.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;
  while(std::getline(std::cin,line))try{
   auto input=Json::parse(line);
   auto pixels=garment::decodeFabricImageSourcePixels(input.at("source").get<std::string>(),input.value("options",Json::object()));
   auto result=garment::generateFabricPbrFromImageSource(input.at("source").get<std::string>(),input.value("options",Json::object()));
   std::cout<<Json{{"ok",true},{"pixels",pixels},{"result",result}}.dump()<<'\n';
  }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  return 0;
 }
 bool rejected=false;
 try{garment::generateFabricPbrFromImageSource("file:///invalid.png");}catch(const std::invalid_argument&){rejected=true;}
 assert(rejected);
 std::cout<<"native fabric PBR source adapter test passed\n";
}
