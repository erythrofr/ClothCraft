#pragma once
#include "garment_document.hpp"
namespace garment {
extern const Json NATIVE_QUALITY_PROFILES;
Json resolveNativeQuality(const Json& options=Json::object());
// Requires project plus already meshed simulation snapshot: pieces as keyed object,
// particles, constraints, seams and anchors with explicit native/global indices.
// This adapter cannot generate THREE.js particles or run JS buildSimulation.
Json buildNativeSimulationPayload(const Json& project,const Json& simulation,const Json& options=Json::object());
Json nativePayloadSummary(const Json& payload);
}
