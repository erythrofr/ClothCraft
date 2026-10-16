#pragma once
#include "garment_document.hpp"
#include <string>
#include <vector>

namespace garment {
struct FactoryZipEntry { std::string path; std::string bytes; };
// Deterministic ZIP32, method 0 (stored), no compression or external library.
std::string buildStoredZip(const std::vector<FactoryZipEntry>& entries);
// Read-only production bundle. Includes source-derived DXF, SVG, BOM,
// estimated fabric cost CSV and structural preflight; no private assets.
std::string buildNativeFactoryZip(const Document& document);
}
