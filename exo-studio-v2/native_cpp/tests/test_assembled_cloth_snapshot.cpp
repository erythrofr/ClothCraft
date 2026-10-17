#include "../core/assembled_cloth_snapshot.hpp"
#include <iostream>
using namespace garment;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
   try{auto project=Json::parse(line);std::cout<<Json{{"ok",true},{"result",buildAssembledClothSnapshot(project)}}.dump()<<'\n';}
   catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}
  return 0;
 }
 Json p={{"pieces",Json::array()},{"seams",Json::array()}};
 auto output=buildAssembledClothSnapshot(p);
 if(output.at("particleCount")!=0||output.at("fullSolverParity")!=false)return 1;
 std::cout<<"assembled cloth snapshot smoke passed\n";
}
