#pragma once
#include "garment_document.hpp"
#include <string>

namespace garment {
double assertDraftCoordinate(const Json& value, const std::string& label = "coordinate");
Json pointFromPolar(const Json& anchor, const Json& lengthCm, const Json& angleDeg);
Json polarFromPoints(const Json& anchor, const Json& point);
Json precisePointEdit(const Json& piece, int pointIndex, const Json& options);
Json curveChordCoordinates(const Json& a, const Json& control, const Json& b);
Json preciseCurveEdit(const Json& piece, int edgeIndex, const Json& options);
Json quadraticAt(const Json& a, const Json& control, const Json& b, double t);
Json quadraticDerivative(const Json& a, const Json& control, const Json& b, double t);
double quadraticArcLength(const Json& a, const Json& control, const Json& b, double start = 0, double end = 1, double tolerance = 1e-7);
Json quadraticAtLengthFraction(const Json& a, const Json& control, const Json& b, const Json& fraction);
Json draftingPrecisionOperation(const std::string& operation, const Json& arguments);
}
