#include "cloth_solver_step_extended.hpp"
#include <cassert>
#include <iostream>
#include <string>
int main(){
 try {
  std::string line;
  if(!std::getline(std::cin,line)||line.empty()){
   // CTest has no stdin; run a representative physical gravity smoke rather
   // than incorrectly failing to parse nonexistent JSON input.
   const garment::Json project={{"simulation",{{"selfCollision",false},{"collisions",false},
       {"wind",{{"enabled",false}}},{"gravity",9.81}}}};
   const garment::Json snapshot={
     {"particles",garment::Json::array({{{"position",garment::Json::array({0.,1.,0.})},
       {"previous",garment::Json::array({0.,1.,0.})},{"invMass",1.}}})},
     {"pieces",garment::Json::array()},{"constraints",garment::Json::array()},
     {"anchors",garment::Json::array()},{"maxThickness",.002},{"elapsed",0.}
   };
   const auto out=garment::cloth_solver_step_extended::step(snapshot,project);
   assert(out.at("particles")[0].at("position")[1].get<double>()<1.);
   assert(out.at("elapsed").get<double>()>0.);
   assert(snapshot.at("particles")[0].at("position")[1]==1.);
   std::cout<<"native cloth solver-step gravity smoke passed; no collision certification\n";
   return 0;
  }
  const garment::Json input=garment::Json::parse(line);
  garment::Json output=garment::Json::array();
  for(const auto& c:input.at("cases")){
   try{
    const auto result=garment::cloth_solver_step_extended::step(
      c.at("snapshot"),c.at("project"),c.value("dt",1.0/60.0),c.value("frames",1));
    output.push_back({{"ok",true},{"result",result}});
   }catch(const std::exception& e){
    output.push_back({{"ok",false},{"error",e.what()}});
   }
  }
  std::cout<<output.dump()<<'\n';
  return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
