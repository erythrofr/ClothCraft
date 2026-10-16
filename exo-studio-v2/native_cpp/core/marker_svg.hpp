#pragma once
#include "garment_document.hpp"
#include <string>

namespace garment {
// Marker and project are existing JSON payloads. Coordinates and the SVG
// physical width/height are centimetres. project may be null.
std::string markerToSvg(const Json& marker, const std::string& size = "BASE",
                        const std::string& fabricName = "",
                        const Json& project = nullptr);
}
