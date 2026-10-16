#include "trims.hpp"
#include <cassert>
#include <cmath>
#include <iostream>
#include <string>

using garment::Json;
static Json run(const Json& input) {
  const auto op=input.at("op").get<std::string>();
  const auto piece=input.value("piece",Json::object());
  const auto options=input.value("options",Json::object());
  if(op=="offsetEdgePath") return garment::offsetEdgePath(piece,options.value("edgeIndex",0),
    options.value("offsetCm",0.),options.value("segments",28));
  if(op=="topstitchPaths") return garment::topstitchPaths(piece,options);
  if(op=="zipperPaths") return garment::zipperPaths(piece,options);
  if(op=="pieceCenter") return garment::pieceCenter(piece);
  if(op=="trimSummary") return garment::trimSummary(input.value("project",Json::object()));
  throw std::invalid_argument("unsupported trim operation");
}
int main(int argc,char** argv) {
  if(argc>1 && std::string(argv[1])=="--json-lines") {
    std::string line;
    while(std::getline(std::cin,line)) {
      try { std::cout<<run(Json::parse(line)).dump()<<'\n'; }
      catch(const std::exception& e) {std::cerr<<e.what()<<'\n';return 1;}
    }
    return 0;
  }
  Json piece={{"points",Json::array({{{"x",0},{"y",0}},{{"x",10},{"y",0}},
    {{"x",10},{"y",10}},{{"x",0},{"y",10}}})},
    {"curves",{{"1",{{"cx",14},{"cy",5}}}}}};
  auto straight=garment::offsetEdgePath(piece,0,2);
  assert(straight.size()==2 && std::abs(straight[0]["y"].get<double>()-2)<1e-10);
  auto curved=garment::offsetEdgePath(piece,1,.7,32);
  assert(curved.size()==33);
  assert(garment::topstitchPaths(piece,{{"edgeIndex",1},{"rows",3}}).size()==3);
  assert(garment::zipperPaths(piece,{{"edgeIndex",0}}).size()==2);
  assert(garment::pieceCenter(piece)["x"]==5);
  auto counts=garment::trimSummary({{"pieces",Json::array({{{"topstitches",Json::array({{{"rows",2}}})},
    {"zippers",Json::array({Json::object()})},{"buttons",Json::array({Json::object()})}}})}});
  assert(counts["topstitchRows"]==2 && counts["zippers"]==1 && counts["buttons"]==1);
  std::cout<<"native trims tests passed\n";
}
