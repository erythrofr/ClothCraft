#pragma once
#include "garment_document.hpp"
namespace garment {
// Consumes the ordered output of buildClothMeshingPipeline. Endpoints are
// local particle indices within their authored pieces; no JS object pointers.
// Supports ordinary/zipper seams, arc-length virtual stitches and default
// tee/pants fit anchors. Other attachments, fasteners, fusing, advanced edge
// treatments and non-default garment anchors remain to be implemented.
Json buildClothSeamConstraints(const Json& project,const Json& mesh);
}
