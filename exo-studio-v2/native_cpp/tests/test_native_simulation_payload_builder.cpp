#include "../core/native_simulation_payload_builder.hpp"
#include <iostream>
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
   try{auto input=garment::Json::parse(line),payload=garment::buildAuthoredNativeSimulationPayload(input.at("project"),input.value("options",garment::Json::object()));
    std::cout<<garment::Json{{"ok",true},{"result",payload}}.dump()<<'\n';}
   catch(const std::exception& ex){std::cout<<garment::Json{{"ok",false},{"error",ex.what()}}.dump()<<'\n';}}
  return 0;
 }
 std::cout<<"native authored payload builder: use --json-lines\n";
}
