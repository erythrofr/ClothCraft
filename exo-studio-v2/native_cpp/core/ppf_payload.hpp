#pragma once
#include "garment_document.hpp"
namespace garment {
Json ppfSolverFabricPreset(const Json& fabric=Json::object());
Json ppfTemporaryShoulderSupports(const Json& pieces=Json::array(),bool enabled=true,double frames=60);
// A precompiled native XPBD payload is required: C++ does not instantiate JS Three.js objects.
Json buildPpfPayload(const Json& project,const Json& native,const Json& options=Json::object());
Json buildDressedPpfPayload(const Json& project,const Json& native,const Json& result,const Json& options=Json::object());
Json buildExplodedPpfPayload(const Json& project,const Json& native,const Json& options=Json::object());
Json validatePpfPayload(const Json& payload);
Json ppfPayloadSummary(const Json& payload);
}
