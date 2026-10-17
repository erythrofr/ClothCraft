#include "ppf_service_client.hpp"
#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>

int main() {
  namespace client=garment::ppf_service_client;
  assert(std::string(client::DEFAULT_PPF_SERVICE_URL)=="http://127.0.0.1:5192");
  bool rejected=false;
  try{
    client::getPpfServiceHealth({{"baseUrl","https://example.org"}});
  }catch(const std::invalid_argument& e){
    rejected=std::string(e.what()).find("allowRemote")!=std::string::npos;
  }
  assert(rejected && "Unapproved remote PPF endpoints must be rejected");
  std::cout<<"native Rust PPF localhost transport guard passed\n";
}
