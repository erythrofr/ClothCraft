#pragma once
#include "garment_document.hpp"
namespace garment {
// Adapter input is decoded canvas ImageData: {width,height,data:[RGBA bytes]}.
// Optional sourceWidth/sourceHeight validate JS canvas sizing. A browser's
// image decode/drawImage must happen before calling this function.
Json generateFabricPbrFromImagePixels(const Json& imageData,const Json& options=Json::object());
}
