#pragma once
#include "garment_document.hpp"
#include <string>

namespace garment {
Point2 constructionReferencePoint(const Json& piece, const Json& oneBasedIndex);
Point2 lineIntersection(Point2 a, Point2 b, Point2 c, Point2 d);
Point2 projectOntoLine(Point2 point, Point2 a, Point2 b);
Point2 pointAlongLine(Point2 a, Point2 b, const Json& distanceCm, bool perpendicular=false);
Point2 mirrorPointAcrossLine(Point2 point, Point2 a, Point2 b);
Json draftConstructionModes();
// Returns updated point metadata, leaving the source piece untouched.
Json preciseConstructionEdit(const Json& piece, const Json& pointIndex, const Json& options=Json::object());
}
