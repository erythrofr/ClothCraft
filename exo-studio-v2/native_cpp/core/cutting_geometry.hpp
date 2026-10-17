#pragma once

#include <vector>
#include "garment_document.hpp"

namespace garment {

// Manufacturing cut-outline geometry in drafting centimetres. Curves are
// sampled and offset outward by their own per-edge seam allowance. This is a
// faithful port of JS seamAllowanceBoundary, not an industrial contour kernel.
std::vector<Point2> sampleCutBoundary(const Json& piece, int segmentsPerCurve = 8);

} // namespace garment
