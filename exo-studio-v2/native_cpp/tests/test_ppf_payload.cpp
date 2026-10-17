#include "../core/ppf_payload.hpp"
#include <iostream>
#include <string>
using namespace garment;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
   try{
    auto c=Json::parse(line);auto op=c.value("op",std::string());auto project=c.value("project",Json::object()),native=c.value("native",Json::object()),options=c.value("options",Json::object());Json result;
    if(op=="preset")result=ppfSolverFabricPreset(c.value("fabric",Json::object()));
    else if(op=="supports")result=ppfTemporaryShoulderSupports(c.value("pieces",Json::array()),c.value("enabled",true),c.value("frames",60.));
    else if(op=="build")result=buildPpfPayload(project,native,options);
    else if(op=="dressed")result=buildDressedPpfPayload(project,native,c.value("result",Json::object()),options);
    else if(op=="exploded")result=buildExplodedPpfPayload(project,native,options);
    else if(op=="validate")result=validatePpfPayload(c.value("payload",Json::object()));
    else if(op=="summary")result=ppfPayloadSummary(c.value("payload",Json::object()));
    else throw std::runtime_error("unknown operation");
    std::cout<<Json{{"ok",true},{"result",result}}.dump()<<'\n';
   }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  }return 0;
 }
 Json p={{"shell",{{"vertices",Json::array({Json::array({0,0,0}),Json::array({1,0,0}),Json::array({0,1,0})})},{"faces",Json::array({Json::array({0,1,2})})}}},{"protocol","garment-studio.ppf-shell"}};
 if(!validatePpfPayload(p)["ok"].get<bool>())return 1;
 if(ppfSolverFabricPreset({{"id","washed-denim"}})["preset"]!="Denim")return 2;
 if(ppfPayloadSummary(p)["vertices"]!=3)return 3;
 std::cout<<"PPF payload C++ smoke passed\n";
}
