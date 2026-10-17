#pragma once

#include "garment_document.hpp"

namespace garment {
// Pixel-only native approximation of a textile normal/roughness pair.
// The browser-only canvas data:image import/export remains in JavaScript.
// imageData is {width,height,data:[rgba byte channels...]}; maps are RGBA arrays.
Json estimateFabricPbrPixels(const Json& imageData,const Json& options=Json::object());
}
