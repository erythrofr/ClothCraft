#pragma once
#include "garment_document.hpp"
namespace garment::cloth_solver_step_extended {
// Pure JSON snapshot, in metres; does not accept live THREE objects.
// Collision features are rejected until physically equivalent projections exist.
Json step(const Json& snapshot,const Json& project,double dt=1.0/60.0,int frames=1);
}
