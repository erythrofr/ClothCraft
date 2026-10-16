#pragma once

#include "garment_document.hpp"
#include <array>
#include <string>
#include <vector>

namespace garment {

// Stitchline mesh in pattern centimeters. No avatar fitting or physics implied.
struct PatternMeshVertex {
  Point2 positionCm;
  Point2 uv; // normalized axes along/across the grainline
};
struct PatternMeshEdge {
  std::size_t sourceEdge = 0;
  std::string seamId;
  std::vector<std::size_t> boundaryIndices; // includes both edge endpoints
};
struct PatternMesh {
  std::string pieceId;
  std::vector<PatternMeshVertex> vertices;
  std::vector<std::array<std::size_t,3>> triangles;
  std::vector<PatternMeshEdge> edges;
  Point2 grainDirection{0,1};
};

// Resolution 0..3 matches JS midpoint subdivision. Curve sampling uses
// samplePieceBoundary's segments-per-curve convention (minimum 2).
PatternMesh buildPatternMesh(const Json& piece, const Json& seams = Json::array(),
                             int segmentsPerCurve = 2, int resolution = 1);
std::vector<PatternMesh> buildProjectPatternMeshes(const Json& project,
                                                   int segmentsPerCurve = 2,
                                                   int resolution = 1);
} // namespace garment
