#include "../core/avatar_contact_pass.hpp"
#include <iostream>
int main(){
 try{
  garment::Json q;std::cin>>q;std::string mode=q.value("mode",std::string("params"));garment::Json result;
  if(mode=="params")result=garment::avatarContactParameters(q.at("project"),q.at("piece"));
  else if(mode=="candidates")result=garment::avatarContactCandidates(q.at("simulation"),q.at("project"),q.value("options",garment::Json::object()));
  else if(mode=="callback"){
   auto sim=q.at("simulation");garment::Json calls=garment::Json::array();
   int count=garment::projectAvatarContacts(sim,q.at("project"),[&](garment::Json& particle,const garment::Json& avatar,double margin,double friction){
    calls.push_back({{"particle",particle},{"avatar",avatar},{"margin",margin},{"friction",friction}});
    particle["projected"]=true;
   },q.value("options",garment::Json::object()));
   result={{"processed",count},{"calls",calls},{"simulation",sim}};
  }else throw std::runtime_error("unsupported mode");
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<'\n';
 }catch(const std::exception& error){std::cout<<garment::Json{{"ok",false},{"error",error.what()}}.dump()<<'\n';}
}
