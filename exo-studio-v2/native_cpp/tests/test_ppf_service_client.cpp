#include "../core/ppf_service_client.hpp"
#include <iostream>
int main(){std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;try{
 auto r=garment::Json::parse(line),options=r.value("options",garment::Json::object());std::string op=r.at("operation");garment::Json value;int progress=0;
 using namespace garment::ppf_service_client;
 if(op=="health")value=getPpfServiceHealth(options);
 else if(op=="submit")value=submitPpfFinalSolve(r.at("value"),options);
 else if(op=="job")value=getPpfJob(r.at("id"),options);
 else if(op=="preview")value=getPpfJobPreview(r.at("id"),options);
 else if(op=="wait")value=waitForPpfJob(r.at("id"),options,[&](const garment::Json&){progress++;});
 else throw std::invalid_argument("Unknown operation");
 std::cout<<garment::Json{{"ok",true},{"value",value},{"progress",progress}}.dump()<<std::endl;
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<std::endl;}}
}
