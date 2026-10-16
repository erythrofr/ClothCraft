#include "workspace_profiles.hpp"
#include <cassert>
#include <iostream>
int main(){
 using namespace garment::workspace_profiles;
 if(std::cin.peek()==EOF) {
  assert(WORKSPACE_PROFILES.size()==4);
  assert(VIEWPORT_LAYOUTS.size()==4);
  assert(normalizeWorkspaceProfile(Json::object()).at("viewportLayout")=="split");
  assert(normalizeWorkspaceProfile(Json{{"section","Sewing"}}).at("section")=="Sewing");
  std::cout<<"native workspace profile test passed\n";
  return 0;
 }
 try{
  Json input;std::cin>>input;
  Json results=Json::array();
  for(const auto& value:input.at("cases")){
   try{results.push_back({{"ok",true},{"result",normalizeWorkspaceProfile(value)}});}
   catch(const std::exception& error){results.push_back({{"ok",false},{"error",error.what()}});}
  }
  std::cout<<Json{{"constants",{{"WORKSPACE_PROFILE_KEY",WORKSPACE_PROFILE_KEY},{"WORKSPACE_VIEW_KEY",WORKSPACE_VIEW_KEY},{"VIEWPORT_LAYOUTS",VIEWPORT_LAYOUTS},{"WORKSPACE_PROFILES",WORKSPACE_PROFILES}}},{"results",results}}.dump()<<'\n';
 }catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}
}
