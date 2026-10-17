#pragma once
#include <nlohmann/json.hpp>
#include <string>
namespace garment::textile_procedurals {
using Json=nlohmann::json;
Json describeTextileSurface(const Json& fabric=Json::object());
double textileRelief(const std::string& family,double u,double v);
// Browser texture objects are represented by RGBA byte arrays and texture metadata.
Json makeProceduralTextileMaps(const Json& fabric=Json::object(),int resolution=256);
}
