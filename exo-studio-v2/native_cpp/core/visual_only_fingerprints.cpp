#include "visual_only_fingerprints.hpp"
#include <array>
namespace garment::visual_only_fingerprints {
static const std::array<const char*,17> optical={"name","surfaceFamily","texture","color","opacity","displacementMm","roughness","metalness","sheen","sheenRoughness","normalStrength","fiberAnisotropy","fiberAngleDeg","clearcoat","clearcoatRoughness","colorVariation","weaveScaleCm"};
static Json fabrics(const Json& p){if(!p.is_object()||!p.contains("fabrics")||!p["fabrics"].is_object())return Json::object();return p["fabrics"];}
std::string physicsInputFingerprint(const Json& project){if(!project.is_object()&&!project.is_array())return "{}";Json next=project;if(!next.is_object())return next.dump();next.erase("revision");next.erase("updatedAt");next.erase("render");Json physical=Json::object();
 Json ff=fabrics(project);for(auto it=ff.begin();it!=ff.end();++it){Json f=it.value();if(!f.is_object())f=Json::object();for(const auto* key:optical)f.erase(key);physical[it.key()]=f;}next["fabrics"]=physical;return next.dump();}
std::string opticalFabricFingerprint(const Json& project){Json result=Json::array();Json ff=fabrics(project);for(auto it=ff.begin();it!=ff.end();++it){Json f=Json::object();for(const auto* key:optical){if(it.value().is_object()&&it.value().contains(key))f[key]=it.value()[key];else f[key]=nullptr;}result.push_back(Json::array({it.key(),f}));}return result.dump();}
}
