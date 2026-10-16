#pragma once
#include "garment_document.hpp"
namespace garment::staging_geometry {
Json stagedPanelPositions(const Json& simPiece,const Json& avatar=Json::object());
// JSON BufferGeometry adapter: {attributes:{position:{array:[x,y,z,...],count:N}}}.
// Returns {success,geometry}; updates position floats and update flags.
Json setStagedGeometry(const Json& geometry,const Json& positions,const Json& fittedPositions=nullptr,double fitBlend=0);
}
