#include "../core/cloth_analysis.hpp"
#include <iostream>
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){std::string line;while(std::getline(std::cin,line)){if(line.empty())continue;try{auto j=garment::Json::parse(line);std::cout<<garment::Json{{"ok",true},{"result",garment::refreshClothAnalysis(j.at("simulation"),j.at("project"))}}.dump()<<'\n';}catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}}return 0;}
 garment::Json s={{"particles",garment::Json::array()},{"constraints",garment::Json::array()},{"seamConstraints",garment::Json::array()}};
 auto r=garment::refreshClothAnalysis(s,garment::Json::object());if(r["quality"]["sewing"]["pairs"]!=0)return 1;std::cout<<"cloth analysis smoke passed\n";
 auto pieces=garment::Json::array({{{"id","right-triangle"},{"flatVertices",garment::Json::array({{{"x",0},{"y",0}},{{"x",10},{"y",0}},{{"x",0},{"y",10}}})},{"faces",garment::Json::array({garment::Json::array({0,1,2})})}}});
 if(std::abs(garment::measureClothFlatFaces(pieces)[0]["areaCm2"].get<double>()-50)>1e-12)return 2;
}
