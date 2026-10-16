#pragma once
#include <nlohmann/json.hpp>
namespace garment::workspace_profiles {
using Json=nlohmann::json;
extern const char* const WORKSPACE_PROFILE_KEY;
extern const char* const WORKSPACE_VIEW_KEY;
extern const Json VIEWPORT_LAYOUTS;
extern const Json WORKSPACE_PROFILES;
Json normalizeWorkspaceProfile(const Json& value);
}
