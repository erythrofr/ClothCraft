#pragma once
#include "garment_document.hpp"

namespace garment {
// Mirrors src/core/autoFitPlacement.js. Unit: metres. This is a bounded
// rigid staging correction; not cloth simulation or a contact solver.
Json constrainAutoFitPlacement(const Json& arrangement = Json::object(),
                               const Json& options = Json::object());
// Applies the safe translation to a JSON simulation piece's particles and
// updates each particle's previous position, preserving velocity continuity.
Json applyAutoFitPlacement(Json& simPiece, const Json& arrangement = Json::object(),
                           const Json& options = Json::object());
} // namespace garment
