#include "seam_assembly_parity_bridge.hpp"
#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>

int main(){
  using garment::Json;
  namespace seam=garment::seam_assembly_parity_bridge;
  const Json payload={
    {"avatar",{{"heightCm",180}}},
    {"particles",Json::array({
      {{"id",0},{"pieceId","front"},{"position",Json::array({0.,0.,2.})},
       {"previous",Json::array({0.,0.,2.})},{"invMass",1}},
      {{"id",1},{"pieceId","back"},{"position",Json::array({.01,0.,2.})},
       {"previous",Json::array({.01,0.,2.})},{"invMass",1}}
    })},
    {"pieces",Json::array()},
    {"constraints",Json::array({{{"type","seam"},{"a",0},{"b",1},{"seamId","sewn-edge"}}})},
    {"virtualSeams",Json::array()}
  };
  const auto before=payload;
  const auto report=seam::assembleNativeSeams(payload,{{"iterations",2}});
  assert(report.contains("particles"));
  assert(report.contains("initialAssembly"));
  assert(report.at("assemblyExperiment").at("collisionCertified")==false);
  assert(payload==before);
  const auto contact=seam::assembleNativeSeams(payload,
    {{"iterations",2},{"contactConstrained",true}});
  assert(contact.at("assemblyExperiment").at("contactConstrained")==true);
  assert(contact.at("assemblyExperiment").at("collisionCertified")==false);
  const auto joint=seam::assembleNativeSeams(payload,
    {{"iterations",2},{"jointConstraintMode",true}});
  assert(joint.at("assemblyExperiment").at("jointConstraintMode")==true);
  assert(joint.at("assemblyExperiment").at("safeToAutoApply")==false);
  assert(payload==before);
  std::cout<<"native seam assembly parity bridge conventional, contact-constrained and joint research-mode smoke passed; no fit certification\n";
}
