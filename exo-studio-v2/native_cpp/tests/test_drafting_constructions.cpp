#include "drafting_constructions.hpp"
#include <cmath>
#include <iostream>
#include <stdexcept>

using garment::Json;
using garment::Point2;
static Json asJson(Point2 p) {return {{"x",p.x},{"y",p.y}};}
static Json dispatch(const Json& input) {
  const std::string op=input.at("op").get<std::string>();
  if (op=="modes") return garment::draftConstructionModes();
  if (op=="reference") return asJson(garment::constructionReferencePoint(input.at("piece"),input.at("index")));
  if (op=="edit") return garment::preciseConstructionEdit(input.at("piece"),input.at("index"),input.value("options",Json::object()));
  auto pt=[&](const char* key){auto& v=input.at(key);return Point2{v.at("x").get<double>(),v.at("y").get<double>()};};
  if (op=="intersection") return asJson(garment::lineIntersection(pt("a"),pt("b"),pt("c"),pt("d")));
  if (op=="projection") return asJson(garment::projectOntoLine(pt("p"),pt("a"),pt("b")));
  if (op=="along") return asJson(garment::pointAlongLine(pt("a"),pt("b"),input.at("distance"),input.value("perpendicular",false)));
  if (op=="mirror") return asJson(garment::mirrorPointAcrossLine(pt("p"),pt("a"),pt("b")));
  throw std::runtime_error("Unknown operation");
}
int main(int argc,char** argv) {
  if (argc>1 && std::string(argv[1])=="--jsonl") {
    std::string line;
    while(std::getline(std::cin,line)) {
      try {std::cout<<Json{{"ok",true},{"value",dispatch(Json::parse(line))}}.dump()<<'\n';}
      catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
    }
    return 0;
  }
  try {
    const auto p=garment::lineIntersection({0,0},{2,2},{0,2},{2,0});
    if (std::abs(p.x-1)>1e-12 || std::abs(p.y-1)>1e-12) throw std::runtime_error("intersection mismatch");
    const Json piece={{"points",Json::array({{{"x",0},{"y",0}},{{"x",4},{"y",0}},{{"x",4},{"y",4},{"tag","saved"}},{{"x",0},{"y",4}}})}};
    const auto updated=garment::preciseConstructionEdit(piece,2,{{"construction","normal"},{"distanceCm",2}});
    if (updated.at("tag")!="saved" || updated.at("x")!=0 || updated.at("y")!=2) throw std::runtime_error("metadata or geometry mismatch");
    std::cout<<"native drafting construction tests passed\n";
  } catch(const std::exception& e) {std::cerr<<e.what()<<'\n';return 1;}
}
