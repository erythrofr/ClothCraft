#pragma once
#include "garment_document.hpp"
namespace garment {
Json assessSimulationFit(const Json& quality=Json::object(),const Json& options=Json::object());
Json inspectClothMesh(const Json& vertices=Json::array(),const Json& faces=Json::array(),const Json& options=Json::object());
Json resolveSolverTimestep(const Json& settings=Json::object(),double dt=1./60.,double maxThickness=.002);
}
