#include "../core/simulation_protocol.hpp"
#include <iostream>
int main(){
 try{
  garment::Json input;std::cin>>input;
  std::string op=input.value("op",std::string("build"));garment::Json result;
  if(op=="build")result=garment::buildSimulationRequest(input.at("project"),input.value("options",garment::Json::object()));
  else if(op=="validate")result=garment::validateSimulationRequest(input.value("request",garment::Json()));
  else if(op=="serialize")result=garment::serializeSimulationRequest(input.at("request"));
  else if(op=="summary")result=garment::backendResultSummary(input.value("result",garment::Json::object()));
  else throw std::runtime_error("unknown operation");
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<std::endl;
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<std::endl;}
}
