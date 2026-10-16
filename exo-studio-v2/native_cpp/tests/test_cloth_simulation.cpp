#include "../core/cloth_simulation.hpp"
#include <iostream>
#include <string>
using namespace garment;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
   try{auto c=Json::parse(line);auto project=c.value("project",Json::object());Json result;
    if(c.value("op",std::string())=="build")result=buildSimulation(project,c.value("snapshot",Json::object()));
    else if(c.value("op",std::string())=="step")result=stepSimulation(c.value("snapshot",Json::object()),project,c.value("dt",1./60.));
    else throw std::runtime_error("unknown operation");
    std::cout<<Json{{"ok",true},{"result",result}}.dump()<<'\n';
   }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  }return 0;
 }
 Json project={{"simulation",{{"collisions",false},{"selfCollision",false}}}};
 Json snapshot={{"particles",Json::array({Json{{"position",Json::array({0,1,0})},{"previous",Json::array({0,1,0})},{"invMass",1}}})},{"constraints",Json::array()}};
 auto built=buildSimulation(project,snapshot);auto step=stepSimulation(built,project);
 if(step["particles"][0]["position"][1].get<double>()>=1)return 1;
 std::cout<<"Cloth partial simulation smoke passed\n";
}
