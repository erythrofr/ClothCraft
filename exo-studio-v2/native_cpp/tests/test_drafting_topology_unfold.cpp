#include "../core/drafting_topology.hpp"
#include "../core/drafting_unfold.hpp"
#include <iostream>
int main(){
 try{
  garment::Json input;std::cin>>input;
  auto mode=input.value("mode",std::string("topology"));
  garment::Json result;
  if(mode=="topology")result=garment::inspectDraftTopology(input.value("piece",garment::Json()),input.value("options",garment::Json::object()));
  else if(mode=="edit")result=garment::isDraftEditValid(input.value("piece",garment::Json()),input.value("edit",garment::Json::object()),input.value("options",garment::Json::object()));
  else if(mode=="unfold")result=garment::unfoldDraftPiece(input.value("piece",garment::Json()),input.value("foldEdgeIndex",garment::Json()));
  else throw std::runtime_error("Unknown mode");
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<std::endl;
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<std::endl;}
}
