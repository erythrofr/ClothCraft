#include "native_payload.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char**argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){
   try{const auto input=Json::parse(line);const auto op=input.at("op").get<std::string>();Json result;
    if(op=="profiles")result=garment::NATIVE_QUALITY_PROFILES;
    else if(op=="quality")result=garment::resolveNativeQuality(input.value("options",Json::object()));
    else if(op=="summary")result=garment::nativePayloadSummary(input.at("payload"));
    else if(op=="build")result=garment::buildNativeSimulationPayload(input.at("project"),input.at("simulation"),input.value("options",Json::object()));
    else throw std::invalid_argument("unsupported op");
    std::cout<<Json{{"ok",true},{"result",result}}.dump()<<'\n';
   }catch(const std::exception& ex){std::cout<<Json{{"ok",false},{"error",ex.what()}}.dump()<<'\n';}
  }return 0;
 }
 assert(garment::NATIVE_QUALITY_PROFILES.size()==3);
 assert(garment::resolveNativeQuality()["quality"]=="draft");
 assert(garment::resolveNativeQuality({{"quality","quality"}})["clothModel"]=="strain-triangle");
 bool blocked=false;try{garment::resolveNativeQuality({{"clothModel","strain-triangle"},{"bendingModel","distance"}});}catch(...){blocked=true;}
 assert(blocked);
 assert(garment::nativePayloadSummary(Json::object())["initialAssembly"]=="NOT_MEASURED");
 std::cout<<"native payload unit tests passed\n";
}
