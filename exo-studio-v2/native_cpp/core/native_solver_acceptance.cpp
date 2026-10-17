#include "native_solver_acceptance.hpp"
#include "simulation_quality.hpp"
#include <cmath>
#include <limits>
#include <string>
namespace garment {
namespace {
double number(const Json& v){
 if(v.is_null())return 0;
 if(v.is_number())return v.get<double>();
 if(v.is_boolean())return v.get<bool>()?1:0;
 if(v.is_string()){try{auto s=v.get<std::string>();if(s.find_first_not_of(" \t\r\n")==std::string::npos)return 0;std::size_t i=0;double n=std::stod(s,&i);return i==s.size()?n:NAN;}catch(...){return NAN;}}
 if(v.is_array()){if(v.empty())return 0;if(v.size()==1)return number(v[0]);}
 return NAN;
}
const Json& get(const Json& o,const char* key){static const Json missing;return o.is_object()&&o.contains(key)?o[key]:missing;}
double optional(const Json& o,const char* key,double scale,double whenMissing){
 const Json& v=get(o,key);return v.is_null()?whenMissing:number(v)*scale;
}
}
Json assessNativeSolverResult(const Json& result){
 const Json& stats=get(result,"stats"),&trajectory=get(result,"fitTrajectory");
 double rawStrain=optional(stats,"fullMeshEdgeStrainMax",100,NAN),trajectoryStrain=optional(trajectory,"peakFullMeshEdgeStrainPercent",1,0.);
 double rawSeam=optional(stats,"seamMaxDistance",1000,NAN),trajectorySeam=optional(trajectory,"peakSewnGapMm",1,0.);
 double strain=std::isnan(rawStrain)||std::isnan(trajectoryStrain)?NAN:std::max(rawStrain,trajectoryStrain);
 double seam=std::isnan(rawSeam)||std::isnan(trajectorySeam)?NAN:std::max(rawSeam,trajectorySeam);
 // JSON cannot represent NaN. A null here must encode the missing telemetry,
 // but assessSimulationFit treats null as zero; explicitly restore unknown flags.
 Json assessment=assessSimulationFit({{"structural",{{"maxStrainPercent",std::isfinite(strain)?Json(strain):Json(nullptr)}}},
  {"sewing",{{"maxGapMm",std::isfinite(seam)?Json(seam):Json(nullptr)}}},
  {"collision",{{"triangleCcdVerified",false},{"allFrameIntersectionFree",nullptr}}}});
 auto& unknown=assessment["unknown"];
 if(!std::isfinite(strain))unknown.insert(unknown.begin(),"structural-strain-not-measured");
 if(!std::isfinite(seam)){auto it=unknown.begin();if(!std::isfinite(strain))++it;unknown.insert(it,"seam-gap-not-measured");}
 if(!unknown.empty()&&assessment["failures"].empty())assessment["status"]="UNVERIFIED";
 if(get(stats,"finite")==Json(false)||get(trajectory,"allFramesFinite")==Json(false)){
  assessment["status"]="FAILED";
  bool found=false;for(const auto& failure:assessment["failures"])if(failure=="native-solver-nonfinite")found=true;
  if(!found)assessment["failures"].push_back("native-solver-nonfinite");
 }
 return assessment;
}
}
