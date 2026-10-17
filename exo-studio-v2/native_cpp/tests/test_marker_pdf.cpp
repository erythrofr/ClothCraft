#include "marker_pdf.hpp"
#include <cassert>
#include <iostream>
#include <iterator>
#include <stdexcept>

int main(int argc,char** argv) {
  if (argc>1 && std::string(argv[1])=="--json") {
    garment::Json arg;std::cin>>arg;
    std::cout<<garment::markerToPdf(arg.at("marker"),arg.value("size",std::string("BASE")),
      arg.value("pageLengthCm",400.),arg.value("project",garment::Json(nullptr)));
    return 0;
  }
  garment::Json marker={{"width",100},{"length",450},{"placements",garment::Json::array({
    {{"name","Front"},{"instance",0},{"x",0},{"y",0},{"height",15},
      {"outline",garment::Json::array({{{"x",0},{"y",0}},{{"x",10},{"y",0}},{{"x",10},{"y",15}},{{"x",0},{"y",15}}})}}})}};
  auto pdf=garment::markerToPdf(marker);
  assert(pdf.substr(0,8)=="%PDF-1.4");
  assert(pdf.find("/Count 2")!=std::string::npos);
  assert(pdf.find("stream\n")!=std::string::npos);
  assert(pdf.find("startxref\n")!=std::string::npos);
  bool bad=false;try {garment::markerToPdf({{"width",0},{"length",1}});} catch (const std::exception&) {bad=true;}
  assert(bad);
  std::cout<<"marker PDF unit checks passed\n";
}
