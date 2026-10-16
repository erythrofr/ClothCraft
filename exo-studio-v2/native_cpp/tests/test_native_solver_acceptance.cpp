#include "native_solver_acceptance.hpp"
#include <cassert>
#include <iostream>
int main(){
 if(std::cin.peek()==EOF) {
  const auto unverified=garment::assessNativeSolverResult();
  assert(unverified.at("factoryApproved")==false);
  assert(unverified.at("status")=="UNVERIFIED");
  const auto failed=garment::assessNativeSolverResult({{"stats",{{"finite",false}}}});
  assert(failed.at("status")=="FAILED");
  assert(failed.at("factoryApproved")==false);
  std::cout<<"native solver acceptance unit test passed\n";
  return 0;
 }
 try{garment::Json input;std::cin>>input;garment::Json out=garment::Json::array();for(const auto& value:input["results"])out.push_back(garment::assessNativeSolverResult(value));std::cout<<out.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
