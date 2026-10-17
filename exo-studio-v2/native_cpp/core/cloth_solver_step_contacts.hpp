#pragma once
#include "garment_document.hpp"
namespace garment::cloth_solver_step_contacts {
// Diagnostic composition of existing kernels. fullStepParity remains false
// because the collision-disabled core cannot inject contacts each iteration.
Json step(const Json& snapshot,const Json& project,double dt=1./60.,int frames=1);
}
