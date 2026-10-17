#include "../core/native_seam_assembly.hpp"
#include <cassert>
#include <iostream>
int main(){
 if(std::cin.peek()==EOF) {
  const garment::Json payload={{"avatar",{{"heightCm",180}}},
    {"particles",garment::Json::array({
      {{"id",0},{"pieceId","front"},{"position",garment::Json::array({0.,0.,2.})},{"previous",garment::Json::array({0.,0.,2.})},{"invMass",1}},
      {{"id",1},{"pieceId","back"},{"position",garment::Json::array({.01,0.,2.})},{"previous",garment::Json::array({.01,0.,2.})},{"invMass",1}}
    })},{"pieces",garment::Json::array()},
    {"constraints",garment::Json::array({{{"type","seam"},{"a",0},{"b",1},{"seamId","edge"}}})},
    {"virtualSeams",garment::Json::array()}};
  const auto before=payload;
  auto clearance=[](const garment::Json& pos,const garment::Json&,const garment::Json&) {
    return pos.at(2).get<double>()+1.;
  };
  auto report=garment::native_seam_assembly::assembleNativeSeams(payload,{{"iterations",2}},clearance);
  assert(report.is_object());
  assert(payload==before);
  std::cout<<"native seam assembly test passed\n";
  return 0;
 }
 try{
  garment::Json q;std::cin>>q;
  auto clearance=[](const garment::Json& pos,const garment::Json&,const garment::Json&){return pos.at(2).get<double>()+1.;};
  garment::Json result=q.value("mode",std::string("assemble"))=="inspect"
   ?garment::native_seam_assembly::inspectStagedAvatarContact(q.at("payload"),clearance)
   :garment::native_seam_assembly::assembleNativeSeams(q.at("payload"),q.value("options",garment::Json::object()),clearance);
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<'\n';
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
}
