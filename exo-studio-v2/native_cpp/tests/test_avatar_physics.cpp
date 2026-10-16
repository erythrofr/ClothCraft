#include "avatar_physics.hpp"
#include <cassert>
#include <iostream>
using namespace garment::avatar_physics;
int main(){
 if(std::cin.peek()==EOF) {
  assert(getAvatarHeightScale(Json::object())>0);
  assert(getAvatarUpperBodyDimensions(Json::object()).is_object());
  assert(getAvatarTorsoRadii(Json::object(),1.).is_object());
  std::cout<<"native avatar physics test passed\n";
  return 0;
 }
 Json in;std::cin>>in;Json results=Json::array();for(auto& q:in["cases"]){try{auto op=q.at("op").get<std::string>();Json value;if(op=="height")value=getAvatarHeightScale(q.value("avatar",Json::object()));else if(op=="upper")value=getAvatarUpperBodyDimensions(q.value("avatar",Json::object()));else if(op=="arm")value=getAvatarArmPose(q.value("avatar",Json::object()),q.value("side",1.));else if(op=="torso")value=getAvatarTorsoRadii(q.value("avatar",Json::object()),q.value("y",1.));else if(op=="boundary")value=boundaryIndicesForEdge(q.at("piece"),q.value("edgeIndex",0));else if(op=="clearance")value=avatarClearance(q.at("position"),q.value("avatar",Json::object()),q.value("particle",Json(nullptr)));else if(op=="measure")value=measureAvatarSurfaceIntrusion(q.at("simulation"),q.value("avatar",Json::object()),q.value("options",Json::object()));else throw std::runtime_error("unsupported");results.push_back({{"ok",true},{"result",value}});}catch(const std::exception& e){results.push_back({{"ok",false},{"error",e.what()}});}}std::cout<<results.dump()<<"\n";
}
