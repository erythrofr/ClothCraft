#include "visual_only_fingerprints.hpp"
#include <iostream>
using namespace garment::visual_only_fingerprints;
int main(){try{Json cases;std::cin>>cases;Json out=Json::array();for(const auto& q:cases){Json result={{"physics",physicsInputFingerprint(q)},{"optical",opticalFabricFingerprint(q)}};out.push_back(result);}std::cout<<out.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
