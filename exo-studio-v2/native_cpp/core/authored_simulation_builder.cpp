#include "authored_simulation_builder.hpp"
#include "assembled_cloth_snapshot.hpp"
#include <stdexcept>
#include <algorithm>
namespace garment::authored_simulation_builder {
Json build(const Json& project,const Json& options){
 if(!project.is_object()||!project.contains("pieces")||!project["pieces"].is_array())throw std::invalid_argument("project.pieces required");
 if(!options.is_object())throw std::invalid_argument("options must be object");
 if(options.value("optimizeMesh",false))throw std::runtime_error("optimizeMesh quality edge flips have not been verified in authored native builder");
 Json native=garment::buildAssembledClothSnapshot(project);
 Json out={{"pieces",native.at("pieces")},{"particles",native.at("particles")},{"clothConstraints",native.at("clothConstraints")},{"seamConstraints",native.at("seamConstraints")},{"anchorConstraints",native.at("anchorConstraints")},{"seamEndpoints",native.at("seamEndpoints")},{"unsupportedSeams",native.at("unsupportedSeams")},{"manualPinsUnsupported",native.at("manualPinsUnsupported")}};
 const auto& fabrics=project.value("fabrics",Json::object());
 double thickness=.001;for(auto it=fabrics.begin();it!=fabrics.end();++it)if(it.value().is_object())thickness=std::max(thickness,it.value().value("thickness",.002));
 out["maxThickness"]=thickness;out["elapsed"]=0.;out["particleCount"]=native.at("particleCount");out["faceCount"]=native.at("faceCount");
 for(auto& p:out["pieces"]){const std::string id=p.at("id");auto found=std::find_if(project["pieces"].begin(),project["pieces"].end(),[&](const Json& a){return a.value("id",std::string())==id;});if(found==project["pieces"].end())throw std::runtime_error("native piece absent from authored project");p["sourcePiece"]=*found;const auto fid=found->value("fabricId",std::string("main"));p["fabric"]=fabrics.contains(fid)?fabrics[fid]:(fabrics.contains("main")?fabrics["main"]:Json::object());p["layerIndex"]=std::clamp(found->value("layerIndex",0),0,8);}
 for(auto& p:out["particles"]){const size_t simIndex=p.at("simIndex");const auto pos=p.at("position");p["previous"]=pos;p["contactDepth"]=0.;p["strain"]=0.;p["pressureIndex"]=0.;p["easeCm"]=0.;auto piece=std::find_if(out["pieces"].begin(),out["pieces"].end(),[&](const Json& a){return a.value("id",std::string())==p.value("pieceId",std::string());});if(piece==out["pieces"].end())throw std::runtime_error("orphan native particle");const auto& source=piece->at("sourcePiece");p["invMass"]=source.value("frozen3d",false)?0:1;const auto& fabric=piece->at("fabric");p["thickness"]=fabric.value("thickness",.002);p["friction"]=fabric.value("friction",.3);p["damping"]=fabric.value("damping",.985);p["fabricId"]=source.value("fabricId",std::string("main"));p["layerIndex"]=piece->at("layerIndex");p["simIndex"]=simIndex;}
 out["constraints"]=Json::array();for(const char* field:{"clothConstraints","seamConstraints"})for(const auto& c:out[field])out["constraints"].push_back(c);
 out["adapter"]={{"source","native-authored-assembled-snapshot"},{"fullNamedExportParity",false},{"unported",Json::array({"live THREE.Vector2/Vector3 and Map identities","cyclic particle references","optimizeMesh true","meshQuality statistics","per-particle seam boundary, wrap, collision side and strain analysis","manual authored pins","complete internal line fold/dart/pleat and fused-layer variant proof","complete constraint insertion order and runtime initial analysis"})}};
 return out;
}
}
