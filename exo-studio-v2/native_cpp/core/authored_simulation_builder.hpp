#pragma once
#include "garment_document.hpp"
namespace garment::authored_simulation_builder {
// Authored, unsimulated, JSON-safe approximation of JS buildSimulation.
// All references use global simIndex; native THREE, Map and cycles are absent.
Json build(const Json& project,const Json& options=Json::object());
}
