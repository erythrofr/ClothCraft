#pragma once
#include <nlohmann/json.hpp>
namespace garment::avatar_surface_correction {
using Json=nlohmann::json;
// Mutates JSON simulation.pieces[].particles[].position / previous in-place.
Json correctAvatarSurfaceIntrusion(Json& simulation,const Json& project,const Json& options=Json::object());
}
