#include "factory_package_files.hpp"
#include <cassert>
#include <iostream>
#include <string>

int main(){
  using garment::factory_package_files::Json;
  const Json project={{"id","native-factory-smoke"},{"name","Minimal"},
    {"revision",1},{"units","cm"},{"pieces",Json::array()},
    {"seams",Json::array()},{"fabrics",Json::object()},
    {"grading",{{"sizes",Json::array({"M"})},{"baseSize","M"}}}};
  const auto before=project;
  const auto report=garment::factory_package_files::buildFactoryPackageFiles(project);
  assert(project==before);
  assert(!report.factoryCertified && !report.exactContentParity);
  assert(report.files.count("README.txt"));
  assert(report.files.count("manifest.json"));
  assert(report.files.count("factory-spec.html"));
  assert(report.files.count("materials-bom.csv"));
  assert(report.files.count("size-run.json"));
  std::cout<<"independent full native factory artifact generator smoke passed (uncertified)\n";
}
