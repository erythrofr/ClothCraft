#pragma once

#include "garment_document.hpp"
#include <string>

namespace garment {

// Open DXF R12 manufacturing interchange.  Includes pattern stitch outlines,
// sampled allowance contours, notches, grainlines, buttonholes and construction
// marks.  Does NOT claim ASTM/AAMA or production plotter certification.
std::string exportConstructionDxf(const Document& document, const std::string& size);

}  // namespace garment
