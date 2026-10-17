#pragma once

#include <string>
#include "garment_document.hpp"

namespace garment {

// Import geometry-only DXF R12 POLYLINE, LWPOLYLINE and closed LINE loops.
// Output is a collection of editable project-compatible patterns, not a
// reconstructed sewing graph or a claim of ASTM/AAMA garment interoperability.
Json importDxfPatterns(const std::string& text, double overrideScaleCm = 0);

} // namespace garment
