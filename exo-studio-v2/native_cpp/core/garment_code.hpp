#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment {
Json projectToGarmentCode(const Json& project);
// Optional injected timestamp/IDs make JS Date.now/uniqueId fixtures deterministic.
Json garmentCodeToProject(const Json& spec,const Json& baseProject=Json::object(),const std::string& updatedAt="",const std::string& generatedIdPrefix="");
Json garmentCodeRoundTripSummary(const Json& project);
}
