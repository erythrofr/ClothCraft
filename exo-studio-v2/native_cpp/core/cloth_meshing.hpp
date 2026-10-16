#pragma once

#include "garment_document.hpp"

namespace garment {
// Physics-only simplification of a COPY of a closed source pattern contour.
// Preserves source point metadata and sewing relationships; never edits source.
Json simplifiedClothBoundary(const Json& source,double toleranceCm=.08);
double measureClothBoundaryDeviation(const Json& source,const Json& simplified);
}
