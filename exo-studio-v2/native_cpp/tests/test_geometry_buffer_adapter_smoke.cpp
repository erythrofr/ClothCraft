#include "geometry_buffer_adapter.hpp"
#include <cassert>
#include <iostream>

int main() {
  using garment::geometry_buffer_adapter::createGeometry;
  using garment::geometry_buffer_adapter::syncGeometry;
  using garment::geometry_buffer_adapter::syncAnalysisColors;
  using garment::geometry_buffer_adapter::updateGeometryFabricUV;
  using Json=nlohmann::json;
  const Json piece={{"flatVertices",Json::array({
    {{"x",0},{"y",0}},{{"x",10},{"y",0}},{{"x",0},{"y",10}}})},
    {"particles",Json::array({
      {{"position",{{"x",0.},{"y",0.},{"z",0.}}}},
      {{"position",{{"x",.1},{"y",0.},{"z",0.}}}},
      {{"position",{{"x",0.},{"y",.1},{"z",0.}}}}})},
    {"faces",Json::array({Json::array({0,1,2})})}};
  const auto original=piece;
  const auto geometry=createGeometry(piece);
  assert(geometry.at("index").size()==3);
  assert(geometry.at("attributes").at("position").at("count")==3);
  assert(syncGeometry(piece,geometry).at("updated")==true);
  assert(syncAnalysisColors(piece,geometry,"strain").at("updated")==true);
  assert(updateGeometryFabricUV(piece,geometry).at("updated")==true);
  assert(original==piece);
  std::cout<<"native geometry buffer adapter smoke passed\n";
}
