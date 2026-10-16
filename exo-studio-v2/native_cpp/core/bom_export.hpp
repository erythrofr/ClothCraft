#pragma once

#include "garment_document.hpp"
#include <string>

namespace garment {

// Export the public Garment Studio BOM XML schema (not proprietary CLO XML).
// Read-only, with costing calculated from native graded marker layouts.
std::string exportBomXml(const Document& document);

} // namespace garment
