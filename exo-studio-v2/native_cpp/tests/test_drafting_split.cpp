#include "drafting_split.hpp"
#include <cassert>
#include <cmath>
#include <functional>
#include <iostream>

using garment::Json;
static bool rejects(const std::function<void()>& f){try{f();}catch(const std::exception&){return true;}return false;}
int main(){
  Json piece={{"id","front"},{"points",Json::array({
    {{"x",0},{"y",0}},{{"x",20},{"y",0}},{{"x",20},{"y",12}},{{"x",0},{"y",12}}})},
    {"curves",Json::object()}};
  auto uniform=garment::draftingSplitFractions(piece,0,{{"method","uniform"},{"count",4}});
  assert(uniform==Json::array({.25,.5,.75}));
  assert(garment::draftingSplitFractions(piece,0,{{"method","length"},{"lengthCm",5}})==Json::array({.25}));
  assert(garment::draftingSplitFractions(piece,0,{{"method","ratio"},{"ratioPercent",30}})==Json::array({.3}));
  assert(std::abs(garment::splitParameterAtArcFraction(piece,0,.3)-.3)<1e-12);
  assert(rejects([&]{garment::draftingSplitFractions(piece,0,{{"method","uniform"},{"count",13}});}));
  assert(rejects([&]{garment::draftingSplitFractions(piece,0,{{"method","length"},{"lengthCm",25}});}));
  assert(rejects([&]{garment::draftingSplitFractions(piece,0,{{"method","ratio"},{"ratioPercent",0}});}));
  piece["curves"]={{"0",{{"cx",18},{"cy",20}}}};
  const auto t=garment::splitParameterAtArcFraction(piece,0,.25);
  assert(t>0&&t<1&&std::abs(t-.25)>1e-4);
  assert(garment::draftingSplitModes().size()==3);
  std::cout<<"native drafting split passed\n";
}
