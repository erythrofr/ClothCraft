#include "auto_fit_placement.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <stdexcept>
#include <string>

namespace garment {
namespace {
double jsNumber(const Json& value) {
  if(value.is_number()) return value.get<double>();
  if(value.is_null()) return 0.;
  if(value.is_boolean()) return value.get<bool>()?1.:0.;
  if(value.is_string()) {
    const auto s=value.get<std::string>();
    const auto first=s.find_first_not_of(" \t\r\n");
    if(first==std::string::npos) return 0.;
    char* end=nullptr;
    const double v=std::strtod(s.c_str(),&end);
    if(end==s.c_str()) return std::numeric_limits<double>::quiet_NaN();
    for(;*end;++end) if(*end!=' '&&*end!='\t'&&*end!='\r'&&*end!='\n')
      return std::numeric_limits<double>::quiet_NaN();
    return v;
  }
  return std::numeric_limits<double>::quiet_NaN();
}
double numericMember(const Json& source,const char* name,double fallback) {
  if(!source.is_object()||!source.contains(name)) return fallback;
  const double n=jsNumber(source.at(name));
  return std::isfinite(n)?n:fallback;
}
double finiteNumberOption(const Json& source,const char* name,double fallback) {
  if(!source.is_object()||!source.contains(name)||!source.at(name).is_number()) return fallback;
  const double n=source.at(name).get<double>();
  return std::isfinite(n)?n:fallback;
}
double magnitude(const Json& xyz) {
  return std::hypot(xyz.at("x").get<double>(),xyz.at("y").get<double>(),xyz.at("z").get<double>());
}
} // namespace

Json constrainAutoFitPlacement(const Json& arrangement,const Json& options) {
  Json requested=Json::object(),applied=Json::object();
  const double maxMagnitude=std::max(0.,finiteNumberOption(options,"maxMagnitude",0.027));
  for (const auto& axis: {"x","y","z"}) {
    const std::string a(axis);
    const std::string upper=a=="x"?"X":a=="y"?"Y":"Z";
    const std::string key="userPlacementDelta"+upper;
    const double defaultLimit=a=="x"?0.024:0.016;
    const double limit=std::max(0.,finiteNumberOption(options,("max"+upper).c_str(),defaultLimit));
    const double value=std::clamp(numericMember(arrangement,key.c_str(),0.),-2.,2.);
    requested[a]=value;
    applied[a]=std::clamp(value,-limit,limit);
  }
  double appliedMagnitude=magnitude(applied);
  if(appliedMagnitude>maxMagnitude && appliedMagnitude>1e-12) {
    const double scale=maxMagnitude/appliedMagnitude;
    for (const auto& axis: {"x","y","z"}) applied[axis]=applied.at(axis).get<double>()*scale;
    appliedMagnitude=magnitude(applied);
  }
  Json diff=Json::object();
  for(const auto& axis:{"x","y","z"}) diff[axis]=requested.at(axis).get<double>()-applied.at(axis).get<double>();
  return {{"requested",requested},{"applied",applied},
          {"requestedMagnitudeM",magnitude(requested)},
          {"appliedMagnitudeM",appliedMagnitude},
          {"correctedMagnitudeM",magnitude(diff)}};
}

Json applyAutoFitPlacement(Json& simPiece,const Json& arrangement,const Json& options) {
  Json result=constrainAutoFitPlacement(arrangement,options);
  if(!simPiece.is_object()||!simPiece.contains("particles")||!simPiece.at("particles").is_array()||
     simPiece.at("particles").empty()||result.at("appliedMagnitudeM").get<double>()<=1e-12)
    return result;
  // Validate the entire new state first, then commit all particle translations
  // together, so a malformed position never partially modifies the simulation.
  Json translated=simPiece.at("particles");
  const auto& applied=result.at("applied");
  for (auto& particle:translated) {
    if (!particle.is_object()||!particle.contains("position")||!particle.at("position").is_object())
      throw std::invalid_argument("invalid particle position");
    auto& position=particle["position"];
    for(const auto& axis:{"x","y","z"}) {
      if(!position.contains(axis)||!position.at(axis).is_number()||!std::isfinite(position.at(axis).get<double>()))
        throw std::invalid_argument("invalid particle coordinate");
      position[axis]=position.at(axis).get<double>()+applied.at(axis).get<double>();
    }
    particle["previous"]=position;
  }
  simPiece["particles"]=std::move(translated);
  return result;
}
} // namespace garment
