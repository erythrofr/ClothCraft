#include "fabric_pbr_image_generator.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;
  while(std::getline(std::cin,line)){
   try{
    const auto q=Json::parse(line);
    const auto result=garment::generateFabricPbrFromImagePixels(q.at("imageData"),q.value("options",Json::object()));
    std::cout<<Json{{"ok",true},{"result",result}}.dump()<<'\n';
   }catch(const std::exception& e){
    std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';
   }
  }
  return 0;
 }
 Json img={{"width",2},{"height",2},{"data",Json::array({0,0,0,255,255,255,255,255,128,128,128,255,45,67,89,255})}};
 const auto result=garment::generateFabricPbrFromImagePixels(img);
 assert(result.at("width")==2&&result.at("height")==2);
 assert(result.at("normalSrc").get<std::string>().find("data:image/png;base64,")==0);
 std::cout<<"native fabric PBR image adapter test passed\n";
}
