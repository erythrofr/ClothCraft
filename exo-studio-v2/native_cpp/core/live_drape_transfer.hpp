#pragma once
#include "garment_document.hpp"
namespace garment {
// Adapter: simulation.pieces is an object keyed by piece ID (JS Map equivalent).
// Each piece has flatVertices, faces and particles with position/previous {x,y,z}.
// Seam constraints contain embedded {a:{position},b:{position}} snapshots.
// Mutation updates JSON particle position/previous in place; validator is a
// declarative "maxDistanceFromOriginalM" option, not a JS callback.
Json captureDrape(const Json& simulation);
Json transferDrape(const Json& snapshot,Json& simulation,double maxOffsetM=.035,
                   const Json& validation=Json::object());
Json measureSeamGap(const Json& simulation);
Json captureParticlePositions(const Json& simulation);
void restoreParticlePositions(const Json& snapshot,Json& simulation);
}
