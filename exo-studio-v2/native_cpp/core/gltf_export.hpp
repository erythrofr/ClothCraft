#pragma once

#include "garment_document.hpp"
#include <string>

namespace garment {

// glTF 2.0 JSON with embedded binary geometry. Coordinates are metres,
// Y-up and panel-rest-only. Does not establish sewn fit, simulation or CCD.
std::string exportFlatPatternGltf(const Document& document,
                                  int segmentsPerCurve = 8,
                                  int resolution = 0);

} // namespace garment
