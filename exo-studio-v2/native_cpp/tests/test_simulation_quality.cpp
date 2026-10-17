#include "simulation_quality.hpp"
#include <cassert>
#include <iostream>
#include <string>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;
  while(std::getline(std::cin,line)){
   try{
    Json q=Json::parse(line),out;
    std::string op=q.at("op").get<std::string>();
    if(op=="fit")out=garment::assessSimulationFit(q.value("quality",Json::object()),q.value("options",Json::object()));
    else if(op=="mesh")out=garment::inspectClothMesh(q.value("vertices",Json::array()),q.value("faces",Json::array()),q.value("options",Json::object()));
    else if(op=="timestep")out=garment::resolveSolverTimestep(q.value("settings",Json::object()),q.value("dt",1./60.),q.value("maxThickness",.002));
    else throw std::invalid_argument("unknown operation");
    std::cout<<Json{{"ok",true},{"result",out}}.dump()<<'\n';
   }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  }
  return 0;
 }
 auto fit=garment::assessSimulationFit();
 assert(fit["status"]=="UNVERIFIED"&&fit["factoryApproved"]==false);
 auto fail=garment::assessSimulationFit({{"structural",{{"maxStrainPercent",16}}}});
 assert(fail["status"]=="FAILED");
 auto mesh=garment::inspectClothMesh(Json::array({Json::array({0,0}),Json::array({1,0}),Json::array({0,1})}),Json::array({Json::array({0,1,2})}));
 assert(mesh["qualityApproved"]==true);
 auto empty=garment::inspectClothMesh();
 assert(empty["minimumAreaCm2"].is_null());
 assert(garment::resolveSolverTimestep(Json::object(),0).is_null());
 assert(garment::resolveSolverTimestep()["iterations"]==7);
 std::cout<<"native simulation quality unit tests passed\n";
}
