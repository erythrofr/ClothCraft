#include "optimized_authored_snapshot.hpp"
#include <iostream>
int main(){try{garment::Json input;std::cin>>input;garment::Json out=garment::Json::array();for(const auto& p:input.at("projects")){try{out.push_back({{"ok",true},{"snapshot",garment::buildOptimizedAuthoredSnapshot(p)},{"payload",garment::buildOptimizedNativeXpbdPayload(p)}});}catch(const std::exception& e){out.push_back({{"ok",false},{"error",e.what()}});}}std::cout<<out.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
