#include "../core/seam_assembly_parity_bridge.hpp"
#include <iostream>
int main(){std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
 try{auto input=garment::Json::parse(line);auto result=input.value("mode",std::string("assemble"))=="inspect"
  ?garment::seam_assembly_parity_bridge::inspectStagedAvatarContact(input.at("payload"))
  :garment::seam_assembly_parity_bridge::assembleNativeSeams(input.at("payload"),input.value("options",garment::Json::object()));
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<'\n';}
 catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}
}
