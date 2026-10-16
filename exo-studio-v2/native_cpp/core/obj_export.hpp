#pragma once

#include "garment_document.hpp"
#include <string>

namespace garment {

// Read-only Wavefront OBJ of separated flat 2D pattern meshes, in centimeter
// units. This is a CAD rest mesh, NEVER simulated drape or avatar fit.
std::string exportFlatPatternObj(const Document& document,int segmentsPerCurve=8,int resolution=1);

} // namespace garment
