#include "mesh_avatar_contact.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){std::string line;while(std::getline(std::cin,line)){try{
  auto q=Json::parse(line);std::string op=q.at("op");Json out;
  if(op=="select")out=garment::selectAvatarBodyMeshes(q.at("avatar"),q.value("model",std::string()));
  else if(op=="create")out=garment::createAvatarMeshCollider(q.at("avatar"),q.value("options",Json::object()));
  else if(op=="sample")out=garment::sampleMeshContact(q.at("collider"),q.at("point"),q.value("options",Json::object()));
  else if(op=="correct"){auto sim=q.at("simulation");auto stats=garment::correctMeshAvatarContacts(sim,q.at("collider"),q.value("options",Json::object()));out={{"stats",stats},{"simulation",sim}};}
  else throw std::invalid_argument("unknown op");
  std::cout<<Json{{"ok",true},{"result",out}}.dump()<<'\n';
 }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}return 0;}
 Json avatar={{"meshes",Json::array({{{"name","Body"},{"vertices",Json::array({Json::array({0,0,0}),Json::array({1,0,0}),Json::array({0,1,0})})},{"faces",Json::array({Json::array({0,1,2})})}}})}};
 auto collider=garment::createAvatarMeshCollider(avatar);
 assert(collider["triangleCount"]==1);
 auto contact=garment::sampleMeshContact(collider,Json::array({.2,.2,.001}));
 assert(contact["distance"].get<double>()<.002);
 assert(garment::selectAvatarBodyMeshes(avatar,"clo-thomas")["meshes"].size()==1);
 std::cout<<"native mesh avatar contact unit tests passed\n";
}
