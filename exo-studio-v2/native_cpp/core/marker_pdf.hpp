#pragma once
#include "garment_document.hpp"
#include <string>

namespace garment {
// Returns binary-safe PDF 1.4 bytes. Vector marker for visual plotting only;
// no factory cutter verification or certification is implied.
std::string markerToPdf(const Json& marker, const std::string& size = "BASE",
                        double pageLengthCm = 400, const Json& project = nullptr);
}
