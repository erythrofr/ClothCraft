#pragma once
#include "garment_document.hpp"

namespace garment {
// Pure mesh-face selection transition. Does not edit the garment document
// or alter solver particle positions.
Json mergeMeshFaceSelection(const Json& previous,const Json& pieceId,
                            const Json& faceIndex,const Json& face,bool additive=false);
}
