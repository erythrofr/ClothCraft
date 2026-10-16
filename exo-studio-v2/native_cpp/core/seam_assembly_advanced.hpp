#pragma once
#include "garment_document.hpp"

namespace garment::seam_assembly_advanced {
// Experimental JSON/particle snapshot implementation of the JS
// contactConstrained and jointConstraintMode preassembly algorithms.
// An avatar-surface sampling test only: never continuous triangle CCD.
Json assembleNativeSeams(const Json& payload,const Json& options);
}
