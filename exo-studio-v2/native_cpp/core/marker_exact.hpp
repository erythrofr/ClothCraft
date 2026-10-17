#pragma once
#include <nlohmann/json.hpp>
namespace garment::marker_exact {
using Json=nlohmann::json;
Json buildMarker(const Json& project,double fabricWidth=150,double gap=1.5,const Json& options=Json::object());
}
