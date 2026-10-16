#include "../core/cloth_meshing_pipeline.hpp"
#include <iostream>
using namespace garment;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;
   try{auto source=Json::parse(line);std::cout<<Json{{"ok",true},{"result",buildClothMeshingPipeline(source)}}.dump()<<'\n';}
   catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  }return 0;
 }
 Json project={{"pieces",Json::array({Json{{"id","rect"},{"points",Json::array({Json{{"x",0},{"y",0}},Json{{"x",10},{"y",0}},Json{{"x",10},{"y",10}},Json{{"x",0},{"y",10}}})}}})}};
 auto result=buildClothMeshingPipeline(project);
 if(result["pieces"][0]["flatVertices"].size()!=9)return 1;
 std::cout<<"cloth meshing pipeline smoke passed\n";
}
