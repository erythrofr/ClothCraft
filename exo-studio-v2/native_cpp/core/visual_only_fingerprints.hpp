#pragma once
#include <nlohmann/json.hpp>
#include <string>
namespace garment::visual_only_fingerprints {
using Json=nlohmann::ordered_json;
std::string physicsInputFingerprint(const Json& project);
std::string opticalFabricFingerprint(const Json& project);
}
