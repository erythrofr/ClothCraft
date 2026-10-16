#include "workspace_command_index.hpp"
#include <cassert>
#include <iostream>
int main(){
 using namespace garment::workspace_command_index;
 if(std::cin.peek()==EOF) {
  assert(EXTRA_WORKSPACE_COMMANDS.size()==9);
  Json menus=Json::array({{{"title","Pattern"},{"commands",Json::array({
    Json::array({"Select point","point.select"})})}}});
  const auto indexed=indexWorkspaceCommands(menus);
  assert(!indexed.empty());
  assert(!searchWorkspaceCommands(indexed,"point").empty());
  std::cout<<"native workspace command index test passed\n";
  return 0;
 }
 try{Json input;std::cin>>input;Json out=Json::array();for(const auto& q:input["cases"]){try{Json result;if(q["op"]=="extra")result=EXTRA_WORKSPACE_COMMANDS;else if(q["op"]=="index")result=indexWorkspaceCommands(q.value("menus",Json::array()));else if(q["op"]=="search")result=searchWorkspaceCommands(q.value("commands",Json::array()),q.value("query",Json("")),q.value("maxResults",30.));else throw std::invalid_argument("bad operation");out.push_back({{"ok",true},{"result",result}});}catch(const std::exception& e){out.push_back({{"ok",false},{"error",e.what()}});}}std::cout<<out.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
