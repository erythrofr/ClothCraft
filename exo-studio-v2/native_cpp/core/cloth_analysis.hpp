#pragma once
#include "garment_document.hpp"
namespace garment {
// JSON snapshot of pieces[].particles (positions as {x,y,z}), constraints
// with global integer a/b indices, and seamConstraints. Returns copied snapshot
// with JS refreshSimulationAnalysis analysis fields populated.
Json refreshClothAnalysis(const Json& snapshot,const Json& project);
// JS API name adapter: accepts a serialized particle/constraint snapshot, not
// live THREE.Vector3 instances, Map entries or browser-side geometry objects.
inline Json refreshSimulationAnalysis(const Json& snapshot,const Json& project) {
  return refreshClothAnalysis(snapshot,project);
}
// Read-only planar 2D area telemetry (cm²), independent of avatar collider.
Json measureClothFlatFaces(const Json& pieces);
}
