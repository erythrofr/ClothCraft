#pragma once
#include "garment_document.hpp"
namespace garment {
// Typed JSON snapshots: project pieces contain pre-meshed particles, triangles,
// and sampled seam constraints. Live JS THREE objects cannot be consumed here.
Json buildSimulation(const Json& project,const Json& snapshot);
// Partial PBD adapter. Throws for unsupported collision, wind, virtual seams.
Json stepSimulation(const Json& simulation,const Json& project,double dt=1.0/60.0);
}
