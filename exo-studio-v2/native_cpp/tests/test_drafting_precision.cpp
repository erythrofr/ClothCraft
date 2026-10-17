#include "../core/drafting_precision.hpp"
#include <iostream>
#include <cmath>
#include <cassert>
using namespace garment;
int main(int argc,char** argv) {
  if (argc>1 && std::string(argv[1])=="--json") {
    std::string line;
    while (std::getline(std::cin,line)) {
      if (line.empty()) continue;
      Json request=Json::parse(line);
      Json response;
      try {response={{"ok",true},{"value",draftingPrecisionOperation(request.at("op").get<std::string>(),request.value("args",Json::object()))}};}
      catch(const std::exception& error) {response={{"ok",false},{"error",error.what()}};}
      std::cout<<response.dump()<<std::endl;
    }
    return 0;
  }
  Json a={{"x",0},{"y",0}},b={{"x",10},{"y",0}},c={{"x",5},{"y",10}};
  assert(std::abs(quadraticArcLength(a,c,b)-14.7894285754)<1e-6);
  assert(std::abs(quadraticArcLength(a,c,b,.2,.8)-quadraticArcLength(a,c,b,.8,.2))<1e-9);
  auto q=quadraticAtLengthFraction(a,c,b,.5);
  assert(std::abs(q["point"]["x"].get<double>()-5)<1e-6);
  Json piece={{"points",Json::array({Json{{"x",0},{"y",0},{"id","a"},{"grading",Json{{"dx",1}}}},Json{{"x",10},{"y",0}},Json{{"x",10},{"y",10}}})}};
  auto edit=precisePointEdit(piece,0,Json{{"x",1},{"y",2}});
  assert(edit["id"]=="a" && edit["grading"]["dx"]==1);
  assert(piece["points"][0]["x"]==0);
  bool rejected=false;
  try {precisePointEdit(piece,0,Json{{"x",10},{"y",10}});} catch(const std::exception&) {rejected=true;}
  assert(rejected);
  std::cout<<"PASS C++ precision geometry, adaptive arc length, metadata and adjacent-point rejection\n";
}
