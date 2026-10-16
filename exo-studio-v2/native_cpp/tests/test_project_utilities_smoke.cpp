#include "project_utilities.hpp"
#include <cassert>
#include <iostream>

int main() {
  namespace p=garment::project_utilities;
  const auto authored=p::Json::parse(R"({"id":"example","pieces":[{"id":"front","points":[]}],"revision":1})");
  auto copy=p::cloneProject(authored);
  assert(copy==authored);
  copy["revision"]=42;
  assert(authored.at("revision")==1);
  assert(p::getPiece(authored,"front").at("id")=="front");
  assert(p::touchProject(authored,"2026-10-15T20:00:00Z").at("updatedAt")=="2026-10-15T20:00:00Z");
  assert(p::uniqueId("piece",123456789,0.75).find("piece")==0);
  assert(p::makeRectanglePiece(0,123456789,0.75).contains("points"));
  std::cout<<"native project utility adapter test passed\n";
}
