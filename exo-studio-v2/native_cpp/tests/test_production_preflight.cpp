#include "production_preflight.hpp"
#include <cassert>
#include <iostream>
#include <string>

using garment::Json;
using garment::inspectProduction;
static Json sample() {
  return {{"pieces",Json::array({{{"id","front"},{"points",Json::array({
    {{"x",0},{"y",0}},{{"x",10},{"y",0}},{{"x",10},{"y",10}},{{"x",0},{"y",10}}})}}})},
    {"fabrics",{{"main",{{"name","Cotton"}}}}}};
}
static bool has(const Json& result,const std::string& code) {
  for (const auto& issue:result["issues"]) if (issue["code"]==code) return true;
  return false;
}
int main(int argc,char** argv) {
  if (argc>1 && std::string(argv[1])=="--json") {
    Json request; std::cin>>request;
    std::cout<<inspectProduction(request.at("project"),request.value("allSizes",true)).dump()<<'\n';
    return 0;
  }
  auto project=sample();
  assert(inspectProduction(project)["status"]=="STRUCTURAL_CHECK_PASS");
  project["pieces"][0]["cutQuantity"]=0;
  assert(has(inspectProduction(project),"CUT_QUANTITY"));
  project=sample(); project["pieces"][0]["points"][2]={{"x",0},{"y",10}};
  assert(has(inspectProduction(project),"ZERO_LENGTH_EDGE"));
  project=sample(); project["pieces"][0]["points"]=Json::array({
    {{"x",0},{"y",0}},{{"x",10},{"y",10}},{{"x",0},{"y",10}},{{"x",10},{"y",0}}});
  assert(has(inspectProduction(project),"SELF_INTERSECTION"));
  project=sample(); project["seams"]=Json::array({{{"id","bad"},{"a",{{"pieceId","front"},{"edgeIndex",0}}},
    {"b",{{"pieceId","missing"},{"edgeIndex",0}}}}});
  assert(has(inspectProduction(project),"BROKEN_SEAM"));
  project=sample(); project["grading"]={{"sizes",Json::array({"S","S"})}};
  assert(has(inspectProduction(project),"DUPLICATE_SIZE"));
  std::cout<<"production preflight static checks passed\n";
}
