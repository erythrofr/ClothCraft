#pragma once

#include "garment_document.hpp"

namespace garment {

// Development marker: bounded rectangle-packing heuristic, same geometric
// contract as src/core/marker.js. This is not a certified factory nest.
// Returns an object keyed by fabric ID, each with placed/unplaced cut pieces.
Json buildFabricMarkers(const Document& document);

// Generate the markers for every configured size without modifying the source.
Json buildMarkerSizeRun(const Document& document);

} // namespace garment
