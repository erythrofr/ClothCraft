#pragma once

#include "garment_document.hpp"

namespace garment {

// CLO-style 2D drafting helpers in centimeters. Pattern layout coordinates
// use screen-space Y down; each piece's local vertices use Y up.
Json snapDraftGrid(const Json& point, double spacingCm = 1.0,
                   const Json& origin = Json{{"x", 0.0}, {"y", 0.0}});
Json nearestOnDraftSegment(const Json& point, const Json& a, const Json& b);
// Returns null when no vertex or edge is within tolerance. Options mirror
// src/core/draftingSnapping.js and support self-vertex/edge exclusions.
Json snapDraftPattern(const Json& point, const Json& pieces,
                      const Json& options = Json::object());
Json constrainDraftAxis(const Json& start, const Json& destination,
                        double incrementDegrees = 45.0);

} // namespace garment
