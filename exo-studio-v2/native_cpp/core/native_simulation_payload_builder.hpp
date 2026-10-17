#pragma once
#include "garment_document.hpp"
namespace garment {
// Builds the directly representable native solver payload from authored cloth.
// See parityUnsupported for fields that still depend on JS runtime geometry.
Json buildAuthoredNativeSimulationPayload(const Json& project,const Json& options=Json::object());
}
