#pragma once
#include "garment_document.hpp"
namespace garment {
// JSON adapter: avatar.meshes array of {name,parentName,geometryName,visible,
// vertices:[[x,y,z]],faces:[[a,b,c]]}. Vertices are posed WORLD metres.
// No live THREE objects, skeleton animation, or BVH acceleration.
Json selectAvatarBodyMeshes(const Json& avatar,const std::string& model="");
Json createAvatarMeshCollider(const Json& avatar,const Json& options=Json::object());
Json sampleMeshContact(const Json& collider,const Json& point,const Json& options=Json::object());
Json correctMeshAvatarContacts(Json& simulation,const Json& collider,const Json& options=Json::object());
}
