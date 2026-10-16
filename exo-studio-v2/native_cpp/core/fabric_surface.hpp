#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment {
Json normalizeFabricOptics(const Json& fabric=Json::object());
double textileAlbedoMultiplier(const std::string& family,double u,double v,double variation=.25);
Json classifyFabricPbrFilename(const std::string& filename);
}
