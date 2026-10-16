#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment {
extern const Json SEAMLY_AVATAR_FIELDS;
Json parseSeamlyMeasurements(const std::string& xml,const std::string& filename="");
Json applySeamlyMeasurements(const Json& project,const Json& library,bool applyToAvatar=false);
Json parseSeamlyConstructionReference(const std::string& xml,const std::string& filename="");
}
