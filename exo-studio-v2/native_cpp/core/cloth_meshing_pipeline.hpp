#pragma once
#include "garment_document.hpp"
namespace garment {
// Authored pattern -> standalone native mesh and initial metre-space placement.
// Copies THREE.ShapeUtils/Earcut's simple-contour traversal and midpoint ordering
// for tee/pants; no holes, advanced Earcut recovery, adaptive cutlines, or seam
// constraint generation. Other garment wraps still require separate validation.
Json buildClothMeshingPipeline(const Json& project);
}
