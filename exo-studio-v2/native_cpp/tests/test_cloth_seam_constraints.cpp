#include "../core/cloth_seam_constraints.hpp"
#include <iostream>
using namespace garment;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;try{
   auto c=Json::parse(line),r=buildClothSeamConstraints(c.at("project"),c.at("mesh"));
   std::cout<<Json{{"ok",true},{"result",r}}.dump()<<'\n';
  }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}return 0;
 }
 Json p={{"seams",Json::array()}},m={{"pieces",Json::array()}};
 auto r=buildClothSeamConstraints(p,m);if(!r["seamConstraints"].empty())return 1;
 std::cout<<"cloth seam adapter smoke passed\n";
}
