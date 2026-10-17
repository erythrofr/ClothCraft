#include "graded_geometry_parity_bridge.hpp"
#include "grading.hpp"
#include <iostream>
int main(){try{garment::Json in;std::cin>>in;garment::Json out=garment::Json::array();for(const auto& c:in.at("cases")){auto original=c.at("project");auto size=c.at("size").get<std::string>();out.push_back({{"bridge",garment::graded_geometry_parity_bridge::grade(original,size)},{"native",garment::gradeProject(garment::Document(original),size)}});}std::cout<<out.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
