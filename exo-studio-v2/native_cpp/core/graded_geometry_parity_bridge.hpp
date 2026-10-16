#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment::graded_geometry_parity_bridge {
Json grade(const Json& project,const std::string& size);
}
