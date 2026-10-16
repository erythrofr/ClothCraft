#pragma once
#include "garment_document.hpp"
namespace garment {
Json unfoldDraftPiece(const Json& piece, int foldEdgeIndex);
// JSON-facing overload rejects fractional, string and missing indices exactly as the editor does.
Json unfoldDraftPiece(const Json& piece, const Json& foldEdgeIndex);
}
