#include "avatar_surface_correction.hpp"
#include <cassert>
#include <iostream>
int main(){
 if(std::cin.peek()==EOF) {
  nlohmann::json simulation={{"pieces",nlohmann::json::array()}};
  const nlohmann::json original=simulation;
  auto result=garment::avatar_surface_correction::correctAvatarSurfaceIntrusion(
    simulation,{{"avatar",nlohmann::json::object()},{"simulation",{{"collisions",false}}}});
  assert(result.is_object());
  assert(simulation==original);
  std::cout<<"native avatar surface correction adapter test passed\n";
  return 0;
 }
 try{nlohmann::json request;std::cin>>request;for(const auto& q:request["cases"]){auto sim=q.at("simulation");auto result=garment::avatar_surface_correction::correctAvatarSurfaceIntrusion(sim,q.at("project"),q.value("options",nlohmann::json::object()));std::cout<<nlohmann::json{{"result",result},{"simulation",sim}}.dump()<<'\n';}}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
