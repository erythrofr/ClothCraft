#include "auto_fit_placement.hpp"
#include <cassert>
#include <cmath>
#include <iostream>
#include <stdexcept>

using garment::Json;
static bool close(double a,double b,double tol=1e-10) {return std::abs(a-b)<=tol;}
int main() {
  Json request={{"userPlacementDeltaX",0.1},{"userPlacementDeltaY",-0.05},
                {"userPlacementDeltaZ",0.03}};
  Json constrained=garment::constrainAutoFitPlacement(request);
  assert(close(constrained["requested"]["x"],.1));
  assert(constrained["applied"]["x"].get<double>()<=.024);
  assert(constrained["appliedMagnitudeM"].get<double>()<=.027+1e-12);
  const Json custom={{"maxX",.001},{"maxY",0.},{"maxZ",0.},{"maxMagnitude",.005}};
  Json zeroed=garment::constrainAutoFitPlacement(request,custom);
  assert(close(zeroed["applied"]["x"],.001));
  assert(close(zeroed["applied"]["y"],0));
  assert(close(zeroed["applied"]["z"],0));
  Json invalid={{"userPlacementDeltaX","bad"},{"userPlacementDeltaY",nullptr}};
  Json safe=garment::constrainAutoFitPlacement(invalid);
  assert(close(safe["requestedMagnitudeM"],0.));
  Json original={{"particles",Json::array({
    {{"position",{{"x",0.},{"y",0.},{"z",0.}}},{"previous",{{"x",-1.},{"y",0.},{"z",0.}}}},
    {{"position",{{"x",.25},{"y",.4},{"z",-.75}}},{"previous",{{"x",.0},{"y",0.},{"z",0.}}}}
  })}};
  const double gap=std::sqrt(.25*.25+.4*.4+.75*.75);
  Json shifted=original;
  Json applied=garment::applyAutoFitPlacement(shifted,request);
  assert(close(applied["appliedMagnitudeM"],constrained["appliedMagnitudeM"]));
  const auto a=shifted["particles"][0]["position"],b=shifted["particles"][1]["position"];
  assert(close(std::hypot((b["x"].get<double>()-a["x"].get<double>()),
                          (b["y"].get<double>()-a["y"].get<double>()),
                          (b["z"].get<double>()-a["z"].get<double>())),gap));
  for (const auto& particle:shifted["particles"]) assert(particle["position"]==particle["previous"]);
  assert(original["particles"][0]["position"]!=shifted["particles"][0]["position"]);
  Json corrupted=original;
  corrupted["particles"][1]["position"]["z"]="invalid";
  const Json before=corrupted;
  bool threw=false;
  try { garment::applyAutoFitPlacement(corrupted,request); } catch (const std::invalid_argument&) {threw=true;}
  assert(threw && corrupted==before);
  std::cout<<"native bounded auto-fit staging passed\n";
}
