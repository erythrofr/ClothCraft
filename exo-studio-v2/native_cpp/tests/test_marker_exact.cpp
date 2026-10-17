#include "marker_exact.hpp"
#include <iostream>
using namespace garment::marker_exact;
int main(){try{Json input;std::cin>>input;Json results=Json::array();for(const auto& c:input.at("cases")){try{results.push_back({{"ok",true},{"result",buildMarker(c.at("project"),c.value("width",150.0),c.value("gap",1.5),c.value("options",Json::object()))}});}catch(const std::exception& e){results.push_back({{"ok",false},{"error",e.what()}});}}std::cout<<results.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
