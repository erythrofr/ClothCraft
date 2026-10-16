#include "self_collision.hpp"
#include <cassert>
#include <cmath>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){
   try{auto j=Json::parse(line);garment::resolveSelfCollisions(j["simulation"],j.value("minimumDistance",.02));std::cout<<j["simulation"].dump()<<'\n';}
   catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
  }return 0;
 }
 Json j={{"pieces",{{"a",{{"particles",Json::array({
 {{"simIndex",0},{"pieceId","a"},{"invMass",1},{"position",{{"x",0},{"y",0},{"z",0}}}},
 {{"simIndex",1},{"pieceId","a"},{"invMass",1},{"position",{{"x",.005},{"y",0},{"z",0}}}}
 })}}}}}};
 garment::resolveSelfCollisions(j,.02);
 assert(j["pieces"]["a"]["particles"][0]["position"]["x"].get<double>()<0);
 assert(j["pieces"]["a"]["particles"][1]["position"]["x"].get<double>()>.005);
 std::cout<<"native self collision unit tests passed\n";
}
