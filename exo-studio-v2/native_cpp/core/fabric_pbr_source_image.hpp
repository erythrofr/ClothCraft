#pragma once
#include "garment_document.hpp"
#include <string>

namespace garment {
// Decodes a PNG/JPEG data URL with macOS ImageIO and resamples to canvas-like RGBA.
// Returns normalSrc, roughnessSrc, width, height and method.
Json generateFabricPbrFromImageSource(const std::string& source,
                                     const Json& options=Json::object());
Json decodeFabricImageSourcePixels(const std::string& source,
                                  const Json& options=Json::object());
}
