#pragma once

#include "garment_document.hpp"

namespace garment {
// Static manufacturing checks. Does not certify cutter files or physical fit.
// Includes per-size native grading and marker generation where geometry allows.
Json inspectProduction(const Json& project, bool allSizes = true);
}
