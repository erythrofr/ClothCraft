#include "native_assembly_preflight.hpp"
#include <cassert>
#include <iostream>
int main(){
 if(std::cin.peek()==EOF) {
  const nlohmann::json payload={{"particles",nlohmann::json::array({
    {{"id",0},{"pieceId","front"},{"position",nlohmann::json::array({0,0,0})}},
    {{"id",1},{"pieceId","back"},{"position",nlohmann::json::array({.02,0,0})}}
  })},{"pieces",nlohmann::json::array()},{"constraints",nlohmann::json::array({
    {{"type","seam"},{"a",0},{"b",1},{"seamId","a"}}})}};
  const auto report=garment::inspectNativeAssemblyPose(payload);
  assert(report.at("pairCount")==1);
  assert(report.at("initialSeamGapMaximumMm")==20.);
  assert(report.at("simulationFitApproved")==false);
  std::cout<<"native assembly preflight unit test passed\n";
  return 0;
 }
 nlohmann::json input;std::cin>>input;for(const auto& c:input.at("cases")){try{auto r=garment::inspectNativeAssemblyPose(c.at("payload"),c.value("options",nlohmann::json::object()));std::cout<<nlohmann::json{{"ok",true},{"result",r}}.dump()<<'\n';}catch(const std::exception& e){std::cout<<nlohmann::json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}
}
