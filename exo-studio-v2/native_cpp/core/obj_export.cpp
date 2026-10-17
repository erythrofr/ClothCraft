#include "obj_export.hpp"
#include "pattern_mesh.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>

namespace garment {
namespace {
std::string token(std::string s) {
  if (s.empty()) s="unnamed";
  if (s.size()>96) s.resize(96);
  for(char& c:s) if (!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||
                       (c>='0'&&c<='9')||c=='-'||c=='_')) c='_';
  return s;
}
}

std::string exportFlatPatternObj(const Document& document,int segmentsPerCurve,int resolution) {
  if (segmentsPerCurve<2||segmentsPerCurve>64||resolution<0||resolution>3)
    throw std::invalid_argument("OBJ mesh sampling out of supported range");
  const Json& source=document.data();
  if(!document.validate().ok()) throw std::invalid_argument("invalid garment document for OBJ");
  const auto meshes=buildProjectPatternMeshes(source,segmentsPerCurve,resolution);
  if(meshes.size()>512) throw std::invalid_argument("OBJ export exceeds piece count budget");
  std::ostringstream out;
  out<<std::setprecision(15);
  out<<"# Garment Studio native C++ flat pattern export\n";
  out<<"# units: centimeters; axes: XY pattern plane; Z=0\n";
  out<<"# rest geometry ONLY; no avatar fit, sewing closure or physics accepted\n";
  out<<"s off\n";
  std::size_t offset=0;
  double shift=0;
  for (std::size_t i=0;i<meshes.size();++i) {
    const auto& mesh=meshes[i];
    if(mesh.vertices.empty()||mesh.triangles.empty())
      throw std::invalid_argument("OBJ cannot export an empty pattern mesh");
    double minX=mesh.vertices.front().positionCm.x,maxX=minX;
    for(const auto& vert:mesh.vertices) {
      minX=std::min(minX,vert.positionCm.x);
      maxX=std::max(maxX,vert.positionCm.x);
    }
    auto sourcePiece=std::find_if(source.at("pieces").begin(),source.at("pieces").end(),
      [&](const Json& candidate){return candidate.at("id").get<std::string>()==mesh.pieceId;});
    if(sourcePiece==source.at("pieces").end()) throw std::invalid_argument("missing source pattern");
    out<<"o "<<token(mesh.pieceId)<<"\n";
    out<<"g "<<token(mesh.pieceId)<<"\n";
    out<<"usemtl "<<token(sourcePiece->value("fabricId",std::string("main")))<<"\n";
    out<<"# grain direction xy "<<mesh.grainDirection.x<<" "<<mesh.grainDirection.y<<"\n";
    for(const auto& vert:mesh.vertices) {
      const double x=vert.positionCm.x-minX+shift;
      const double y=vert.positionCm.y;
      if(!std::isfinite(x)||!std::isfinite(y)) throw std::invalid_argument("non-finite OBJ vertex");
      out<<"v "<<x<<" "<<y<<" 0\n";
    }
    for(const auto& vert:mesh.vertices) out<<"vt "<<vert.uv.x<<" "<<vert.uv.y<<"\n";
    for(const auto& tri:mesh.triangles) {
      out<<"f";
      for(auto id:tri) {
        if(id>=mesh.vertices.size()) throw std::invalid_argument("invalid OBJ triangle index");
        const auto global=offset+id+1;
        out<<" "<<global<<"/"<<global;
      }
      out<<"\n";
    }
    for(const auto& edge:mesh.edges)
      if(!edge.seamId.empty()) out<<"# seam "<<token(edge.seamId)<<" edge="<<edge.sourceEdge<<"\n";
    offset+=mesh.vertices.size();
    shift+=(maxX-minX)+10.;
  }
  return out.str();
}

} // namespace garment
