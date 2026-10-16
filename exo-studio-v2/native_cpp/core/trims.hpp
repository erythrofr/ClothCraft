#pragma once
#include "garment_document.hpp"

namespace garment {
Json offsetEdgePath(const Json& piece, int edgeIndex, double offsetCm=0, int segments=28);
Json topstitchPaths(const Json& piece, const Json& topstitch);
Json zipperPaths(const Json& piece, const Json& zipper);
Json pieceCenter(const Json& piece);
Json trimSummary(const Json& project);
}
