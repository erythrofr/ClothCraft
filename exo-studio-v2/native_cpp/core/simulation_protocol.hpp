#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment {
inline constexpr const char* SIMULATION_PROTOCOL="garment-studio.simulation";
inline constexpr int SIMULATION_PROTOCOL_VERSION=1;
Json buildSimulationRequest(const Json& project,const Json& options=Json::object());
Json validateSimulationRequest(const Json& request);
std::string serializeSimulationRequest(const Json& request);
Json backendResultSummary(const Json& result=Json::object());
}
