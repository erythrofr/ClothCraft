#include "live_drape_transfer.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;
  while(std::getline(std::cin,line)){
   try {
    Json input=Json::parse(line),sim=input.value("simulation",Json::object()),out;
    const std::string op=input.at("op").get<std::string>();
    if(op=="capture")out=garment::captureDrape(sim);
    else if(op=="transfer"){Json stats=garment::transferDrape(input.value("snapshot",Json()),sim,input.value("maxOffsetM",.035),input.value("validation",Json::object()));out={{"stats",stats},{"simulation",sim}};}
    else if(op=="seams")out=garment::measureSeamGap(sim);
    else if(op=="capturePositions")out=garment::captureParticlePositions(sim);
    else if(op=="restore"){garment::restoreParticlePositions(input.value("snapshot",Json::object()),sim);out=sim;}
    else throw std::invalid_argument("unknown op");
    std::cout<<Json{{"ok",true},{"result",out}}.dump()<<'\n';
   }catch(const std::exception& ex){std::cout<<Json{{"ok",false},{"error",ex.what()}}.dump()<<'\n';}
  }return 0;
 }
 Json original={{"pieces",{{"front",{{"flatVertices",Json::array({{{"x",0},{"y",0}},{{"x",1},{"y",0}},{{"x",0},{"y",1}}})},
 {"faces",Json::array({Json::array({0,1,2})})},
 {"particles",Json::array({{{"position",{{"x",0},{"y",0},{"z",0}}}},
 {{"position",{{"x",1},{"y",0},{"z",0}}}},
 {{"position",{{"x",0},{"y",1},{"z",0}}}}})}}}}}};
 const auto captured=garment::captureDrape(original);
 assert(captured["front"]["vertices"].size()==3);
 auto backup=garment::captureParticlePositions(original);
 original["pieces"]["front"]["particles"][0]["position"]["x"]=9;
 garment::restoreParticlePositions(backup,original);
 assert(original["pieces"]["front"]["particles"][0]["position"]["x"]==0);
 assert(garment::measureSeamGap(original)["pairs"]==0);
 std::cout<<"native live drape transfer unit tests passed\n";
}
