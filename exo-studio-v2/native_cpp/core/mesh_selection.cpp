#include "mesh_selection.hpp"
#include <algorithm>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
Json mergeMeshFaceSelection(const Json& previous,const Json& pieceId,
                             const Json& faceIndex,const Json& face,bool additive) {
  if(!pieceId.is_string()||pieceId.get<std::string>().empty()||
     !faceIndex.is_number_integer()||faceIndex.get<long long>()<0||!face.is_object())
    return nullptr;
  const long long selected=faceIndex.get<long long>();
  if(!face.contains("a")||!face.contains("b")||!face.contains("c"))return nullptr;
  const bool same=previous.is_object()&&previous.value("pieceId",Json())==pieceId;
  std::vector<long long> indices;
  if(additive&&same&&previous.contains("triangleIndices")&&previous["triangleIndices"].is_array()) {
    for(const auto& item:previous["triangleIndices"])
      if(item.is_number_integer()) indices.push_back(item.get<long long>());
  }
  const auto found=std::find(indices.begin(),indices.end(),selected);
  const bool existing=found!=indices.end();
  if(existing) {
    if(additive)indices.erase(found);
  } else indices.push_back(selected);
  if(indices.empty())return nullptr;

  Json faceVertices=Json::array();
  if(additive&&same&&previous.contains("faceVertices")&&previous["faceVertices"].is_array())
    faceVertices=previous["faceVertices"];
  for(std::size_t i=0;i<faceVertices.size();++i) {
    if(faceVertices[i].is_object()&&faceVertices[i].value("faceIndex",Json())==faceIndex) {
      faceVertices.erase(faceVertices.begin()+static_cast<std::ptrdiff_t>(i));
      break;
    }
  }
  if(!existing)faceVertices.push_back({{"faceIndex",faceIndex},
    {"vertices",Json::array({face.at("a"),face.at("b"),face.at("c")})}});
  std::sort(indices.begin(),indices.end());
  std::set<long long> vertices;
  for(const auto& item:faceVertices) {
    if(!item.is_object()||!item.contains("vertices")||!item.at("vertices").is_array())continue;
    for(const auto& vertex:item.at("vertices"))
      if(vertex.is_number_integer())vertices.insert(vertex.get<long long>());
  }
  return {{"pieceId",pieceId},{"triangleIndices",indices},{"faceVertices",faceVertices},
          {"vertices",std::vector<long long>(vertices.begin(),vertices.end())}};
}
}
