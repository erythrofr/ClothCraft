#include "seamly_import.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){
   try{auto input=Json::parse(line);const std::string op=input.at("op").get<std::string>();Json output;
    if(op=="fields")output=garment::SEAMLY_AVATAR_FIELDS;
    else if(op=="measure")output=garment::parseSeamlyMeasurements(input.at("xml").get<std::string>(),input.value("filename",std::string()));
    else if(op=="construction")output=garment::parseSeamlyConstructionReference(input.at("xml").get<std::string>(),input.value("filename",std::string()));
    else if(op=="apply")output=garment::applySeamlyMeasurements(input.at("project"),input.at("library"),input.value("applyToAvatar",false));
    else throw std::invalid_argument("unknown operation");
    std::cout<<Json{{"ok",true},{"result",output}}.dump()<<'\n';
   }catch(const std::exception& ex){std::cout<<Json{{"ok",false},{"error",ex.what()}}.dump()<<'\n';}
  }return 0;
 }
 const auto measurements=garment::parseSeamlyMeasurements("<smis><unit>mm</unit><body-measurements><m name='height' value='1750'/></body-measurements></smis>");
 assert(measurements["measurements"]["height"]["baseCm"]==175);
 assert(garment::applySeamlyMeasurements(Json::object(),measurements,true)["avatar"]["heightCm"]==175);
 const auto construction=garment::parseSeamlyConstructionReference("<pattern><version>1</version><unit>cm</unit><draftBlock name='A'><calculation><point id='1' type='single' name='P'/></calculation></draftBlock></pattern>");
 assert(construction["toolCount"]==1);
 std::cout<<"native Seamly import tests passed\n";
}
