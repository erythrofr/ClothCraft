#include "../core/cloth_collision_step.hpp"
#include <iostream>
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
   try{auto request=garment::Json::parse(line);auto result=garment::stepAuthoredClothCollision(request.at("project"),request.value("dt",1./60.));
    std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<'\n';}
   catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}
  return 0;
 }
 std::cout<<"cloth collision step runner requires --json-lines\n";
}
