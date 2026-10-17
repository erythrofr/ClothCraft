#pragma once
#include "garment_document.hpp"
namespace garment {
// JSON adapter: pieces is an object keyed by ID; particles hold position{x,y,z},
// simIndex, invMass, pieceId, layerIndex, wrapMode and collisionSideZ.
// fusedPiecePairs and collisionExclusions are arrays of string keys (JS Set).
void resolveSelfCollisions(Json& simulation,double minimumDistance);
}
