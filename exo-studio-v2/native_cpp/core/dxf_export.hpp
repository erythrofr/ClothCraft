#pragma once

#include <string>
#include "garment_document.hpp"

namespace garment {

// Deterministic read-only native DXF R12 cutting-outline export. This is a
// deliberately scoped first native manufacturing path, not yet a replacement
// for full JS seam allowance, notch, dart and AAMA/DXF workflows.
std::string exportCuttingDxf(const Document& document, int samplesPerCurve = 24,
                             bool withSeamAllowances = false);

}  // namespace garment
