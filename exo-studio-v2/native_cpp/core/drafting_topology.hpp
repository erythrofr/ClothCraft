#pragma once
#include "garment_document.hpp"
namespace garment {
Json inspectDraftTopology(const Json& piece, const Json& options=Json::object());
bool isDraftEditValid(const Json& piece, const Json& edit=Json::object(), const Json& options=Json::object());
}
