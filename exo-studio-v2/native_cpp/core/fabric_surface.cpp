#include "fabric_surface.hpp"
#include <algorithm>
#include <cmath>
#include <cctype>
#include <regex>
#include <sstream>
#include <vector>
namespace garment {
namespace {
double jsNumber(const Json& j) {
 if(j.is_null())return 0;
 if(j.is_boolean())return j.get<bool>()?1:0;
 if(j.is_number())return j.get<double>();
 if(j.is_string()){auto s=j.get<std::string>();if(s.find_first_not_of(" \t\n\r")==std::string::npos)return 0;
  try{std::size_t n;double x=std::stod(s,&n);return s.find_first_not_of(" \t\n\r",n)==std::string::npos?x:NAN;}catch(...){return NAN;}}
 return NAN;
}
double bounded(const Json& f,const char* key,double lo,double hi,double fallback){
 if(!f.is_object()||!f.contains(key))return fallback;
 const double n=jsNumber(f.at(key));return std::isfinite(n)?std::max(lo,std::min(hi,n)):fallback;
}
bool has(const std::vector<std::string>& tokens,const std::vector<std::string>& values){
 for(const auto& t:tokens)if(std::find(values.begin(),values.end(),t)!=values.end())return true;
 return false;
}
}
Json normalizeFabricOptics(const Json& f){
 const double pi=std::acos(-1.);
 return {{"opacity",bounded(f,"opacity",.05,1,1)},
 {"displacementMm",bounded(f,"displacementMm",0,2,0)},
 {"roughness",bounded(f,"roughness",.04,1,.82)},
 {"metalness",bounded(f,"metalness",0,1,0)},
 {"sheen",bounded(f,"sheen",0,1,.22)},
 {"sheenRoughness",bounded(f,"sheenRoughness",.04,1,.84)},
 {"normalStrength",bounded(f,"normalStrength",0,4,1)},
 {"anisotropy",bounded(f,"fiberAnisotropy",0,1,.16)},
 {"anisotropyRotation",bounded(f,"fiberAngleDeg",-180,180,0)*pi/180},
 {"clearcoat",bounded(f,"clearcoat",0,1,0)},
 {"clearcoatRoughness",bounded(f,"clearcoatRoughness",.04,1,.45)},
 {"colorVariation",bounded(f,"colorVariation",0,1,.25)},
 {"weaveScaleCm",bounded(f,"weaveScaleCm",.3,10,3)}};
}
double textileAlbedoMultiplier(const std::string& family,double u,double v,double variation){
 const double pi=std::acos(-1.);
 const double amount=std::max(0.,std::min(1.,std::isnan(variation)?0:variation));
 const double waves=family=="twill"?.5*std::cos(2*pi*(28*u+10*v))
 :family=="rib-knit"?.65*std::cos(2*pi*15*u)
 :(family=="leather"||family=="suede")?.25*std::cos(2*pi*(7*u+13*v))
 :.3*std::cos(2*pi*28*u)+.3*std::cos(2*pi*31*v);
 return std::max(.82,std::min(1.,1-amount*(.07+.04*waves)));
}
Json classifyFabricPbrFilename(const std::string& filename){
 std::string base=filename;
 std::transform(base.begin(),base.end(),base.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});
 base=std::regex_replace(base,std::regex(R"(\.(png|jpe?g|webp)$)"),"");
 if(std::regex_search(base,std::regex(R"(([_-]nor[_-]?dx|[_-]normal[_-]?dx|[_-]directx|[_-]arm|[_-]rough[_-]?ao))")))return nullptr;
 const auto cleaned=std::regex_replace(base,std::regex("[^a-z0-9]+")," ");
 std::istringstream stream(cleaned);std::vector<std::string> tokens;std::string token;
 while(stream>>token)tokens.push_back(token);
 if(has(tokens,{"normal","normalgl","nrm","nor"}))return "normal";
 if(has(tokens,{"rough","roughness","rgh"}))return "roughness";
 if(has(tokens,{"metal","metallic","metalness","mtl"}))return "metalness";
 if(has(tokens,{"alpha","opacity","transparency","translucency"}))return "opacity";
 if(has(tokens,{"height","displacement","disp","hgt"}))return "displacement";
 if(has(tokens,{"diff","diffuse","albedo","basecolor","basecolour","color","colour","col"}))return "color";
 return nullptr;
}
}
