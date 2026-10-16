#include "workspace_profiles.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <stdexcept>
#include <string>
#include <unordered_set>
namespace garment::workspace_profiles {
const char* const WORKSPACE_PROFILE_KEY="garment-studio-workspace-profile-v1";
const char* const WORKSPACE_VIEW_KEY="garment-studio-workspace-windows-v1";
const Json VIEWPORT_LAYOUTS={{"split","3D + 2D"},{"stack","3D over 2D"},{"3d","3D only"},{"2d","2D only"}};
const Json WORKSPACE_PROFILES={
 {"drafting",{{"name","2D Pattern + 3D"},{"section","Pattern"},{"tab","Scene"},{"tool","point"},{"viewportTool","transform"},{"libraryWidth",196},{"inspectorWidth",432},{"objectBrowserHeight",306},{"objectBrowserVisible",true},{"topTabsVisible",true},{"libraryVisible",true},{"inspectorVisible",true},{"viewportLayout","split"},{"viewportSplit",44}}},
 {"sewing",{{"name","Sewing + Fit"},{"section","Sewing"},{"tab","Scene"},{"tool","sew"},{"viewportTool","orbit"},{"libraryWidth",174},{"inspectorWidth",434},{"objectBrowserHeight",280},{"objectBrowserVisible",true},{"topTabsVisible",true},{"libraryVisible",false},{"inspectorVisible",true},{"viewportLayout","split"},{"viewportSplit",55}}},
 {"materials",{{"name","Materials + Rendering"},{"section","Fabric"},{"tab","Fabric"},{"tool","select"},{"viewportTool","orbit"},{"libraryWidth",232},{"inspectorWidth",460},{"objectBrowserHeight",355},{"objectBrowserVisible",true},{"topTabsVisible",true},{"libraryVisible",true},{"inspectorVisible",true},{"viewportLayout","split"},{"viewportSplit",64}}},
 {"render",{{"name","Render Studio"},{"section","Render"},{"tab","Scene"},{"tool","select"},{"viewportTool","orbit"},{"libraryWidth",174},{"inspectorWidth",375},{"objectBrowserHeight",245},{"objectBrowserVisible",false},{"topTabsVisible",true},{"libraryVisible",false},{"inspectorVisible",true},{"viewportLayout","3d"},{"viewportSplit",65}}}
};
namespace {
const Json& field(const Json& o,const char* k){static const Json null;if(!o.contains(k))return null;return o[k];}
double toNumber(const Json& v){
 if(v.is_number())return v.get<double>();
 if(v.is_boolean())return v.get<bool>()?1.:0.;
 if(v.is_null())return 0.;
 if(v.is_string()){
  const std::string s=v.get<std::string>();if(s.find_first_not_of(" \t\n\r")==std::string::npos)return 0.;
  char* end=nullptr;double x=std::strtod(s.c_str(),&end);
  if(end==s.c_str())return NAN;
  while(*end==' '||*end=='\t'||*end=='\r'||*end=='\n')++end;
  return *end?NAN:x;
 }
 if(v.is_array()){if(v.empty())return 0.;if(v.size()==1)return toNumber(v[0]);}
 return NAN;
}
Json sized(const Json& v,double low,double high,double fallback){
 if(v.is_null()||(v.is_string()&&v.get<std::string>().empty()))return fallback;
 double number=toNumber(v);
 if(!std::isfinite(number))return fallback;
 number=std::max(low,std::min(high,number));
 return number;
}
std::string picked(const Json& v,const std::unordered_set<std::string>& allowed,const char* fallback){
 if(v.is_string()){auto s=v.get<std::string>();if(allowed.count(s))return s;}return fallback;
}
}
Json normalizeWorkspaceProfile(const Json& value){
 if(!value.is_object())throw std::invalid_argument("Invalid workspace profile");
 const static std::unordered_set<std::string> sections={"Pattern","Sewing","Fabric","Avatar","Fit","Production","Render"};
 const static std::unordered_set<std::string> tabs={"Scene","Fabric","Graphic","Button","Buttonhole","Topstitch","Puckering","Trim","Grading","POM"};
 const static std::unordered_set<std::string> tools={"select","point","split","curve","internal","pin","notch","sew","fastener","measure"};
 const static std::unordered_set<std::string> viewportTools={"transform","orbit","move","rotate","hand"};
 const static std::unordered_set<std::string> layouts={"split","stack","3d","2d"};
 std::string name="Custom workspace";
 if(field(value,"name").is_string()){name=field(value,"name").get<std::string>();if(name.size()>80)name.resize(80);}
 auto visible=[&](const char* key){return field(value,key)!=Json(false);};
 return Json{{"name",name},{"section",picked(field(value,"section"),sections,"Pattern")},
 {"tab",picked(field(value,"tab"),tabs,"Scene")},{"tool",picked(field(value,"tool"),tools,"select")},
 {"viewportTool",picked(field(value,"viewportTool"),viewportTools,"transform")},
 {"libraryWidth",sized(field(value,"libraryWidth"),160,350,232)},
 {"inspectorWidth",sized(field(value,"inspectorWidth"),295,540,392)},
 {"objectBrowserHeight",sized(field(value,"objectBrowserHeight"),230,650,390)},
 {"objectBrowserVisible",visible("objectBrowserVisible")},{"topTabsVisible",visible("topTabsVisible")},
 {"libraryVisible",visible("libraryVisible")},{"inspectorVisible",visible("inspectorVisible")},
 {"viewportLayout",picked(field(value,"viewportLayout"),layouts,"split")},
 {"viewportSplit",sized(field(value,"viewportSplit"),20,80,50)}};
}
}
