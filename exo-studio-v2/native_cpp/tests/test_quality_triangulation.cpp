#include "../core/quality_triangulation.hpp"
#include <cassert>
#include <iostream>
int main() {
  if (std::cin.peek() == EOF) {
    const garment::Json mesh={{"vertices",garment::Json::array({
      garment::Json::array({0,0}),garment::Json::array({2,0}),
      garment::Json::array({2,1}),garment::Json::array({0,1})})},
      {"faces",garment::Json::array({garment::Json::array({0,1,2}),
                                     garment::Json::array({0,2,3})})}};
    const auto result=garment::optimizeTriangleQuality(mesh);
    assert(result["vertices"]==mesh["vertices"]);
    assert(result["faces"].is_array() && result["faces"].size()==2);
    assert(result["flips"].is_number_integer());
    std::cout<<"native quality triangulation tests passed\n";
    return 0;
  }
  try {
    garment::Json input;
    std::cin >> input;
    const auto result=garment::optimizeTriangleQuality(input.at("mesh"),input.value("options",garment::Json::object()));
    std::cout << garment::Json{{"ok",true},{"result",result}}.dump() << '\n';
  } catch(const std::exception& error) {
    std::cout << garment::Json{{"ok",false},{"error",error.what()}}.dump() << '\n';
  }
}
