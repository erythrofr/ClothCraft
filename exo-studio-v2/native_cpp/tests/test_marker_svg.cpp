#include "../core/marker_svg.hpp"
#include <cassert>
#include <functional>
#include <iostream>
#include <limits>
using garment::Json;
using garment::markerToSvg;
int main(int argc,char** argv) {
  if(argc>1 && std::string(argv[1])=="--json") {
    const auto input=Json::parse(std::cin);
    std::cout<<markerToSvg(input.at("marker"),input.value("size",std::string("BASE")),input.value("fabricName",std::string("")),input.value("project",Json(nullptr)))<<"\n";
    return 0;
  }
  const Json marker={{"width",150},{"length",20},{"fabricId","cotton&silk"},
    {"unusedPieces",0},{"placements",Json::array({{{"pieceId","p"},{"instance",0},
      {"name","A<&\"'B"},{"x",2},{"y",3},{"rotationDeg",0},
      {"outline",Json::array({{{"x",2},{"y",3}},{{"x",12},{"y",3}},
      {{"x",12},{"y",23}},{{"x",2},{"y",23}}})}}})}};
  const Json project={{"pieces",Json::array({{{"id","p"},{"grainAngleDeg",0},
    {"points",Json::array({{{"x",0},{"y",0}},{{"x",10},{"y",0}},
    {{"x",10},{"y",20}},{{"x",0},{"y",20}}})}}})}};
  const auto svg=markerToSvg(marker,"M<&", "",project);
  assert(svg.find("width=\"150cm\" height=\"20cm\"")!=std::string::npos);
  assert(svg.find("Marker cotton&amp;silk M&lt;&amp;")!=std::string::npos);
  assert(svg.find("A&lt;&amp;&quot;&apos;B M&lt;&amp; #1")!=std::string::npos);
  assert(svg.find("<g id=\"grain-lines\"")!=std::string::npos);
  assert(svg.find("<line x1=\"7\" y1=\"7.4\" x2=\"7\" y2=\"18.6\"/>")!=std::string::npos);
  auto invalid=marker;
  invalid["placements"][0]["outline"][1]["x"]=std::numeric_limits<double>::infinity();
  bool rejected=false;
  try { markerToSvg(invalid); } catch (const std::exception&) { rejected=true; }
  assert(rejected);
  if (argc>1 && std::string(argv[1])=="--stdout") std::cout<<svg<<"\n";
  else std::cout<<"PASS native marker SVG: cm scale, XML escaping, grainlines, finite geometry\n";
}
