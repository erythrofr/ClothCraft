#pragma once

#include <string>
#include "garment_document.hpp"

namespace garment {

// Return an independently graded document; neither the input nor its revision
// changes. Matches the existing Garment Studio size-run geometry contract.
// This is development grading, not a factory-validated graded nest.
Json gradeProject(const Document& document, const std::string& size);
Json gradeSizeRun(const Document& document);

} // namespace garment
