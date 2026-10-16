#pragma once
#include "garment_document.hpp"

namespace garment {
// Conservative interior-diagonal flips. Boundary vertices and their metadata
// remain unchanged; this is mesh conditioning, not solver fit certification.
Json optimizeTriangleQuality(const Json& mesh,const Json& options=Json::object());
}
