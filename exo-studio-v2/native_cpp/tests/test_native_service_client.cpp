#include "../core/native_service_client.hpp"
#include <iostream>
int main(){using namespace garment::native_service_client;std::string line;
 while(std::getline(std::cin,line)){if(line.empty())continue;
  try{auto r=garment::Json::parse(line);auto operation=r.at("operation").get<std::string>();auto options=r.value("options",garment::Json::object());garment::Json result;
   if(operation=="health")result=getNativeBackendHealth(options);
   else if(operation=="serviceHealth")result=getNativeServiceHealth(options);
   else if(operation=="run")result=runNativeBackend(r.at("value"),options);
   else if(operation=="solve")result=solveWithNativeService(r.at("value"),options);
   else if(operation=="step")result=stepNativePayload(r.at("value"),options);
   else throw std::invalid_argument("Unknown operation");
   std::cout<<garment::Json{{"ok",true},{"value",result}}.dump()<<std::endl;
  }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<std::endl;}
 }
}
