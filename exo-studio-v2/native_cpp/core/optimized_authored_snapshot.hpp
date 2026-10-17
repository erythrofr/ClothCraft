#pragma once
#include "garment_document.hpp"
namespace garment {
// JSON authored snapshot using native optimized faces and recomputed rest springs.
// Not a live THREE simulation or a fit/CCD certification.
Json buildOptimizedAuthoredSnapshot(const Json& project);
Json buildOptimizedNativeXpbdPayload(const Json& project,const Json& options=Json::object());
}
