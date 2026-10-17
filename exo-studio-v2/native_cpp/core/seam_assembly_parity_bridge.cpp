#include "seam_assembly_parity_bridge.hpp"
#include "native_seam_assembly.hpp"
#include "avatar_physics.hpp"
#include "seam_assembly_advanced.hpp"
#include <stdexcept>
namespace garment::seam_assembly_parity_bridge {
namespace {
double clearance(const Json& position,const Json& avatar,const Json& hint){
 Json p={{"x",position.at(0)},{"y",position.at(1)},{"z",position.at(2)}};
 return avatar_physics::avatarClearance(p,avatar,hint);
}
}
Json inspectStagedAvatarContact(const Json& payload){return native_seam_assembly::inspectStagedAvatarContact(payload,clearance);}
Json assembleNativeSeams(const Json& payload,const Json& options){
 if(options.value("contactConstrained",false)||options.value("jointConstraintMode",false))
  return seam_assembly_advanced::assembleNativeSeams(payload,options);
 return native_seam_assembly::assembleNativeSeams(payload,options,clearance);
}
}
