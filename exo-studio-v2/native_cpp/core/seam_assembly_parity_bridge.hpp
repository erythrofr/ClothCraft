#pragma once
#include "garment_document.hpp"
namespace garment::seam_assembly_parity_bridge {
Json inspectStagedAvatarContact(const Json& payload);
Json assembleNativeSeams(const Json& payload,const Json& options=Json::object());
}
