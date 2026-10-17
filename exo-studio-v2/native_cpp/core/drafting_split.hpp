#pragma once

#include "garment_document.hpp"
#include <string>

namespace garment {

// Numerical 2D drafting splits measured in centimeters.
Json draftingSplitModes();
Json draftingSplitFractions(const Json& piece, int edgeIndex, const Json& options=Json::object());
double splitParameterAtArcFraction(const Json& piece, int edgeIndex, double fraction);
}
