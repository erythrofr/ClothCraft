#pragma once
#include "garment_document.hpp"
#include <functional>
namespace garment::native_seam_assembly {
using Clearance=std::function<double(const Json&,const Json&,const Json&)>;
// A caller supplies avatarClearance for exact contact diagnostics or constrained solving.
Json inspectStagedAvatarContact(const Json& payload,const Clearance& clearance);
Json assembleNativeSeams(const Json& payload,const Json& options=Json::object(),const Clearance& clearance={});
}
