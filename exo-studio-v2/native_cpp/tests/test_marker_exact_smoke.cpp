#include "marker_exact.hpp"
#include <cassert>
#include <iostream>

int main() {
  using Json=nlohmann::json;
  const Json project={{"id","empty-marker"},{"pieces",Json::array()}};
  const auto copy=project;
  const auto marker=garment::marker_exact::buildMarker(project,150.,1.5);
  assert(marker.is_object());
  assert(project==copy);
  std::cout<<"native exact marker empty-project smoke passed\n";
}
