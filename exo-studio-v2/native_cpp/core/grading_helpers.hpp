#pragma once
#include <nlohmann/json.hpp>
#include <string>
namespace garment::grading_helpers {
using Json=nlohmann::json;
extern const Json DEFAULT_SIZES;
int sizeOffset(const Json& grading,const std::string& size);
Json gradePointForPiece(const Json& piece,const Json& grading,const std::string& size,const Json& point);
Json gradePiece(const Json& piece,const Json& grading,const std::string& size);
}
