#pragma once
#include <nlohmann/json.hpp>
namespace garment::geometry_buffer_adapter {
using Json=nlohmann::json;
Json createGeometry(const Json& piece);
Json syncGeometry(const Json& piece,const Json& geometry,const Json& project=Json());
Json updateGeometryFabricUV(const Json& piece,const Json& geometry,const Json& fabric=Json::object());
Json syncAnalysisColors(const Json& piece,const Json& geometry,const std::string& mode="surface");
}
