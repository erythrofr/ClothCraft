#pragma once

#include <string>
#include "garment_document.hpp"

namespace garment {

// Estimated fabric consumption per garment size based on native marker layout.
// Missing prices/unfinished markers remain null, never a fabricated zero.
Json buildFabricCostRun(const Document& document);
std::string fabricCostRunToCsv(const Json& report);

} // namespace garment
