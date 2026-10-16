#include "drafting_split.hpp"
#include "drafting_precision.hpp"

#include <cmath>
#include <cstdlib>
#include <limits>
#include <stdexcept>

namespace garment {
namespace {
double jsNumber(const Json& value) {
  if(value.is_number()) return value.get<double>();
  if(value.is_null()) return 0.;
  if(value.is_boolean()) return value.get<bool>()?1.:0.;
  if(value.is_string()) {
    const auto s=value.get<std::string>();
    if(s.find_first_not_of(" \t\r\n")==std::string::npos) return 0.;
    char* end=nullptr;
    const double parsed=std::strtod(s.c_str(),&end);
    if(end==s.c_str()) return std::numeric_limits<double>::quiet_NaN();
    for(;*end;++end) if(*end!=' '&&*end!='\t'&&*end!='\r'&&*end!='\n')
      return std::numeric_limits<double>::quiet_NaN();
    return parsed;
  }
  return std::numeric_limits<double>::quiet_NaN();
}
Json option(const Json& options,const char* key,Json fallback=Json()) {
  return options.is_object()&&options.contains(key)?options.at(key):fallback;
}
const Json& validatedPoints(const Json& piece, int edge) {
  if(!piece.is_object()||!piece.contains("points")||!piece.at("points").is_array()||
     edge<0||static_cast<std::size_t>(edge)>=piece.at("points").size())
    throw std::invalid_argument("Select a valid pattern edge");
  return piece.at("points");
}
const Json* controlFor(const Json& piece,int index) {
  if(!piece.is_object()||!piece.contains("curves")||!piece.at("curves").is_object())return nullptr;
  auto it=piece.at("curves").find(std::to_string(index));
  return it==piece.at("curves").end()||it->is_null()?nullptr:&it.value();
}
double edgeLength(const Json& piece, int index) {
  const auto& pts=validatedPoints(piece,index);
  auto& a=pts.at(index);auto& b=pts.at((index+1)%pts.size());
  if(auto* c=controlFor(piece,index))
    return quadraticArcLength(a,Json{{"x",c->at("cx")},{"y",c->at("cy")}},b);
  return std::hypot(b.at("x").get<double>()-a.at("x").get<double>(),
                    b.at("y").get<double>()-a.at("y").get<double>());
}
}

Json draftingSplitModes() {
  return {{"uniform","Equal length divisions"},{"length","Distance from edge start"},
          {"ratio","Ratio from edge start"}};
}
Json draftingSplitFractions(const Json& piece,int edgeIndex,const Json& options) {
  validatedPoints(piece,edgeIndex);
  const double length=edgeLength(piece,edgeIndex);
  if(!std::isfinite(length)||length<.001)
    throw std::invalid_argument("Edge must have a positive measurable length");
  const Json method=option(options,"method","uniform");
  if(method=="uniform") {
    const double number=jsNumber(option(options,"count",2));
    if(!std::isfinite(number)||std::floor(number)!=number||number<2||number>12)
      throw std::invalid_argument("Use 2 to 12 equal-length segments");
    Json out=Json::array();
    for(int i=1;i<static_cast<int>(number);++i)out.push_back(i/number);
    return out;
  }
  double fraction=0;
  if(method=="length") {
    const auto requested=option(options,"lengthCm");
    const double value=jsNumber(requested);
    if(requested==""||!std::isfinite(value))
      throw std::invalid_argument("Enter a finite edge distance in centimeters");
    fraction=value/length;
  } else if(method=="ratio") {
    const auto requested=option(options,"ratioPercent");
    const double value=jsNumber(requested);
    if(requested==""||!std::isfinite(value))
      throw std::invalid_argument("Enter a finite edge percentage");
    fraction=value/100.;
  } else throw std::invalid_argument("Unknown split mode");
  if(fraction<.05||fraction>.95)
    throw std::invalid_argument("Split position must lie between 5% and 95% of the edge length");
  return Json::array({fraction});
}
double splitParameterAtArcFraction(const Json& piece,int edgeIndex,double fraction) {
  if(!piece.is_object()||!piece.contains("points")||!piece.at("points").is_array()||
     edgeIndex<0||static_cast<std::size_t>(edgeIndex)>=piece.at("points").size())
    throw std::invalid_argument("Invalid split edge");
  if(!std::isfinite(fraction)||fraction<.05-1e-9||fraction>.95+1e-9)
    throw std::invalid_argument("Split arc fraction must remain inside the edge");
  const Json* control=controlFor(piece,edgeIndex);
  if(!control) return fraction;
  const auto& points=piece.at("points");
  const Json c={{"x",control->at("cx")},{"y",control->at("cy")}};
  return quadraticAtLengthFraction(points.at(edgeIndex),c,
      points.at((edgeIndex+1)%points.size()),fraction).at("parameter").get<double>();
}
}
