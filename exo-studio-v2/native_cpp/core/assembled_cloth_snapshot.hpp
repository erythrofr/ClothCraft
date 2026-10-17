#pragma once
#include "garment_document.hpp"
namespace garment {
// Authored geometry, physical sewing/stretch/bend constraints and fit anchors
// for the initial state. Default tee/pants geometry and ordered constraints
// match JS fixtures; this is not yet an executable collision-aware PBD solver.
Json buildAssembledClothSnapshot(const Json& project);
}
