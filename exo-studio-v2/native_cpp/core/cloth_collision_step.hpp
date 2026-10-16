#pragma once
#include "garment_document.hpp"
namespace garment {
// Conservative JSON snapshot PBD step. Collision response is an analytic
// clearance gradient approximation; NOT a port of full collideAvatar.
Json stepAuthoredClothCollision(const Json& project,double dt=1./60.);
}
