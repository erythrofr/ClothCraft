#include "native_service_client.hpp"
#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>

int main() {
  namespace client=garment::native_service_client;
  assert(std::string(client::DEFAULT_NATIVE_SERVICE_URL)=="http://127.0.0.1:5191");
  bool rejected=false;
  try {
    client::getNativeBackendHealth({{"baseUrl","https://example.org"}});
  }catch(const std::invalid_argument& e){
    rejected=std::string(e.what()).find("allowRemote")!=std::string::npos;
  }
  assert(rejected && "Remote solver transport must be blocked without explicit permission");
  std::cout<<"native service endpoint defaults and remote guard passed\n";
}
