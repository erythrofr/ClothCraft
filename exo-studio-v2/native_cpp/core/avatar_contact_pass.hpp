#pragma once
#include "garment_document.hpp"
#include <functional>
namespace garment {
Json avatarContactParameters(const Json& project,const Json& piece);
// Emits ordered contact calls. The projector receives the particle by mutable
// reference, the project avatar, margin and friction; returns JS-equivalent count.
using AvatarContactProjector=std::function<void(Json&,const Json&,double,double)>;
int projectAvatarContacts(Json& simulation,const Json& project,const AvatarContactProjector& projector,const Json& options=Json::object());
Json avatarContactCandidates(const Json& simulation,const Json& project,const Json& options=Json::object());
}
