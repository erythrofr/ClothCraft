#include "factory_package_files.hpp"
#include <iostream>
#include <iomanip>
#include <sstream>
using namespace garment::factory_package_files;
int main(){try{Json input;std::cin>>input;Json out=Json::array();for(const auto& test:input.at("cases")){std::map<std::string,std::string> generated;if(test.contains("generated"))for(auto it=test["generated"].begin();it!=test["generated"].end();++it)generated[it.key()]=it.value().get<std::string>();const Json before=test.at("project");auto result=buildFactoryPackageFiles(test.at("project"),generated);if(test.at("project")!=before)throw std::runtime_error("Native factory generator mutated source project");Json encoded=Json::object();for(const auto& pair:result.files){std::ostringstream hex;for(unsigned char c:pair.second)hex<<std::hex<<std::setw(2)<<std::setfill('0')<<int(c);encoded[pair.first]=hex.str();}out.push_back({{"files",encoded},{"missing",result.missing},{"factoryCertified",result.factoryCertified},{"exactContentParity",result.exactContentParity}});}std::cout<<out.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
