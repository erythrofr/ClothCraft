#pragma once
#include "garment_document.hpp"
namespace garment::project_geometry {
double polygonArea(const Json& points);
Json sampleEdge(const Json& piece,int edgeIndex,int segments=8);
Json samplePieceBoundary(const Json& piece,int segments=8);
double getEdgeSeamAllowance(const Json& piece,int edgeIndex);
Json seamAllowanceBoundary(const Json& piece,int segments=8);
double pieceArea(const Json& piece);
double projectArea(const Json& project);
double edgeLength(const Json& piece,int edgeIndex);
double edgeRangeLength(const Json& piece,int edgeIndex,double startT=0,double endT=1);
Json edgePointAt(const Json& piece,int edgeIndex,double fraction=.5,int segments=32);
Json facingGeometryForEdge(const Json& piece,int edgeIndex,double widthCm=5);
double closestEdgeFraction(const Json& piece,int edgeIndex,const Json& point,int segments=40);
Json seamLengthReport(const Json& project,const Json& seam);
Json seamWalkReport(const Json& project,const Json& seam,int sampleCount=25);
}
