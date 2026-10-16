#pragma once

#include "garment_document.hpp"

namespace garment {

// A read-only, intentionally lossy *interchange candidate*, not a successful
// Rust solver fit. Strict ClothCraft v2 field names; independent Rust validation
// is required before using the output for simulation.
Json exportClothCraftTemplate(const Document& document);

}  // namespace garment
