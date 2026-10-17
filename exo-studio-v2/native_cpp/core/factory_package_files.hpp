#pragma once
#include <nlohmann/json.hpp>
#include <string>
#include <map>
namespace garment::factory_package_files {
using Json=nlohmann::ordered_json;
struct Result {
  std::map<std::string,std::string> files;
  Json missing;
  bool factoryCertified=false;
  bool exactContentParity=false;
};
// Externally generated UTF-8/binary bytes are injected as a JSON object of
// {path: string} values. PDF bytes should be supplied through a byte-safe
// integration; JSON strings here are valid only for UTF-8 text exports.
Result buildFactoryPackageFiles(const Json& project,const std::map<std::string,std::string>& generated={});
}
