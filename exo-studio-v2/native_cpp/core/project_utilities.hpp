#pragma once
#include <nlohmann/json.hpp>
#include <cstdint>
#include <string>
namespace garment::project_utilities {
using Json=nlohmann::ordered_json;
Json cloneProject(const Json& project);
Json touchProject(const Json& project,const std::string& isoTimestamp);
Json getPiece(const Json& project,const std::string& id);
std::string uniqueId(const std::string& prefix,std::int64_t epochMilliseconds,double randomUnit);
Json makeRectanglePiece(double index,std::int64_t epochMilliseconds,double randomUnit);
}
