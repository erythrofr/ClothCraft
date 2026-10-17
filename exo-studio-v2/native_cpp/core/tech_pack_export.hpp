#pragma once

#include "garment_document.hpp"

namespace garment {

// Structured native handoff data, not a sign-off for manufacturing or fit.
// Mirrors the current JavaScript buildTechPack contract without touching the
// original project or invoking either cloth simulator.
Json buildTechPack(const Document& document);

} // namespace garment
