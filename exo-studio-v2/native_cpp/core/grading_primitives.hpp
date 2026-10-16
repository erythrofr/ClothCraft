#pragma once
#include "garment_document.hpp"
#include <string>

namespace garment {
// JS-compatible public grading primitives. Kept separate from factory-validated
// gradeProject: unknown size labels fall back to the first JS size index.
Json defaultGradingSizes();
int sizeOffsetJs(const Json& grading,const std::string& size);
Json gradePointForPieceJs(const Json& piece,const Json& grading,const std::string& size,const Json& point);
Json gradePieceJs(const Json& piece,const Json& grading,const std::string& size);
}
