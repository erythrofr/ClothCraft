#include "clo_menus.hpp"
#include "workspace_command_index.hpp"
#include <cassert>
#include <iostream>

int main(int argc,char** argv){
  const auto& menus=garment::clo_menus::CLO_MENUS;
  assert(menus.is_array());
  assert(menus.size()==14);
  if(argc>1 && std::string(argv[1])=="--json") {
    std::cout<<menus.dump()<<'\n';
    return 0;
  }
  const auto commands=garment::workspace_command_index::indexWorkspaceCommands(menus);
  assert(commands.size()==72);
  const auto sew=garment::workspace_command_index::searchWorkspaceCommands(commands,"sew",10);
  assert(sew.is_array()&&!sew.empty());
  std::cout<<"native CLO menu commands and search smoke passed\n";
}
