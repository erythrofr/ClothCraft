#include "avatar_contact_kernel.hpp"
#include <iostream>
#include <cassert>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line))try{auto request=Json::parse(line);
   auto out=garment::collideAvatarParticle(request.at("particle"),request.at("avatar"),request.value("margin",.012),request.value("friction",.3));
   std::cout<<Json{{"ok",true},{"particle",out}}.dump()<<'\n';
  }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  return 0;
 }
 Json p={{"position",{0.,1.2,0.}},{"previous",{0.,1.2,0.}},{"invMass",1}};
 auto result=garment::collideAvatarParticle(p,Json::object(),.012,.3);
 assert(result["position"].is_array());std::cout<<"avatar contact kernel smoke passed\n";
}
