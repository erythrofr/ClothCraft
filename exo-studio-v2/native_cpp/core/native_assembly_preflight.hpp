#pragma once
#include <nlohmann/json.hpp>
namespace garment {
using Json=nlohmann::json;
Json inspectNativeAssemblyPose(const Json& payload,const Json& options=Json::object());
}
