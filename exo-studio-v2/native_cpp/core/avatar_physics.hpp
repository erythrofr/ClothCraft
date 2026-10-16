#pragma once
#include <nlohmann/json.hpp>
namespace garment::avatar_physics {
using Json=nlohmann::json;
double getAvatarHeightScale(const Json& avatar);
Json getAvatarUpperBodyDimensions(const Json& avatar);
Json getAvatarArmPose(const Json& avatar,double side=1);
Json getAvatarTorsoRadii(const Json& avatar,double y);
Json boundaryIndicesForEdge(const Json& piece,int edgeIndex);
double avatarClearance(const Json& position,const Json& avatar,const Json& particle=nullptr);
Json measureAvatarSurfaceIntrusion(const Json& simulation,const Json& avatar,const Json& options=Json::object());
}
