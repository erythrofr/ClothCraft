#include "simulation_quality.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>
namespace garment {
namespace {
const Json& field(const Json& j,const char* key) {static const Json nil;return j.is_object()&&j.contains(key)?j.at(key):nil;}
double numeric(const Json& v,double missing=std::numeric_limits<double>::quiet_NaN()) {
 if(v.is_null())return missing;
 if(v.is_boolean())return v.get<bool>()?1:0;
 if(v.is_number())return v.get<double>();
 if(v.is_string()) {try {const auto s=v.get<std::string>();if(s.empty())return 0;std::size_t n=0;double x=std::stod(s,&n);return n==s.size()?x:std::numeric_limits<double>::quiet_NaN();}catch(...){return std::numeric_limits<double>::quiet_NaN();}}
 return std::numeric_limits<double>::quiet_NaN();
}
double jsNumber(const Json& v) {return v.is_null()?0:numeric(v);}
double defaultNum(const Json& o,const char* key,double fallback,bool orDefault=false) {
 const auto& v=field(o,key);
 if(v.is_null())return fallback;
 const double x=numeric(v);
 return orDefault&&(x==0||std::isnan(x))?fallback:x;
}
Json finiteOrNull(double x){return std::isfinite(x)?Json(x):Json(nullptr);}
double jsRound(double x,int places) {if(!std::isfinite(x))return x;const double f=std::pow(10.,places);return std::floor(x*f+0.5)/f;}
double coord(const Json& vertex,int axis) {
 if(vertex.is_array())return axis<static_cast<int>(vertex.size())?numeric(vertex[axis]):std::numeric_limits<double>::quiet_NaN();
 return numeric(field(vertex,axis==0?"x":"y"));
}
}
Json assessSimulationFit(const Json& quality,const Json& options) {
 const double strainLimit=defaultNum(options,"maximumStructuralStrainPercent",15);
 const double seamLimit=defaultNum(options,"maximumSeamGapMm",5);
 const double penetrationLimit=defaultNum(options,"maximumPenetrationMm",.5);
 Json failures=Json::array(),unknown=Json::array();
 const auto& structural=field(quality,"structural");
 const auto& sewing=field(quality,"sewing");
 const double strain=structural.is_object()&&structural.contains("maxStrainPercent")?jsNumber(structural.at("maxStrainPercent")):NAN;
 const double seam=sewing.is_object()&&sewing.contains("maxGapMm")?jsNumber(sewing.at("maxGapMm")):NAN;
 const Json& collision=field(quality,"collision");
 if(!std::isfinite(strain))unknown.push_back("structural-strain-not-measured");
 else if(strain>strainLimit)failures.push_back("excessive-structural-strain");
 if(!std::isfinite(seam))unknown.push_back("seam-gap-not-measured");
 else if(seam>seamLimit)failures.push_back("open-sewing-seams");
 if(field(collision,"triangleCcdVerified")!=Json(true)||field(collision,"allFrameIntersectionFree")!=Json(true))
   unknown.push_back("triangle-ccd-and-entire-trajectory-not-certified");
 const Json& intrusion=field(collision,"maximumIntrusionMm");
 if(intrusion.is_null()||!std::isfinite(jsNumber(intrusion)))unknown.push_back("avatar-intrusion-not-measured");
 else if(jsNumber(intrusion)>penetrationLimit)failures.push_back("avatar-surface-penetration");
 return {{"status",!failures.empty()?"FAILED":!unknown.empty()?"UNVERIFIED":"MEASURED_PASS"},
 {"factoryApproved",false},{"failures",failures},{"unknown",unknown},
 {"limits",{{"maximumStructuralStrainPercent",finiteOrNull(strainLimit)},{"maximumSeamGapMm",finiteOrNull(seamLimit)},{"maximumPenetrationMm",finiteOrNull(penetrationLimit)}}}};
}
Json inspectClothMesh(const Json& vertices,const Json& faces,const Json& options) {
 const double aspectLimit=defaultNum(options,"aspectLimit",25), minAllowed=defaultNum(options,"minimumAltitudeCm",.2);
 const double worstCount=defaultNum(options,"worstCount",8);
 double maximumAspect=0,minimumAltitude=INFINITY,minimumArea=INFINITY;
 int degenerate=0,slender=0;
 struct Bad{std::size_t index;Json triangle;double aspect,altitude,longest,area;};
 std::vector<Bad> worst;
 for(std::size_t i=0;i<faces.size();++i) {
  const auto& tri=faces[i];
  if(!tri.is_array()||tri.size()!=3)throw std::range_error("Invalid cloth face "+std::to_string(i));
  double xy[3][2]{};
  for(int j=0;j<3;++j){
   const auto& index=tri[j];
   if(!index.is_number_integer()&&!index.is_number_unsigned())throw std::range_error("Invalid cloth face "+std::to_string(i));
   const auto v=index.get<long long>();
   if(v<0||static_cast<std::size_t>(v)>=vertices.size())throw std::range_error("Invalid cloth face "+std::to_string(i));
   xy[j][0]=coord(vertices[v],0);xy[j][1]=coord(vertices[v],1);
   if(!std::isfinite(xy[j][0])||!std::isfinite(xy[j][1]))throw std::range_error("Non-finite rest coordinates in face "+std::to_string(i));
  }
  const double ax=xy[0][0],ay=xy[0][1],bx=xy[1][0],by=xy[1][1],cx=xy[2][0],cy=xy[2][1];
  const double twice=std::abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax)),area=twice*.5;
  const double longest=std::max({std::hypot(bx-ax,by-ay),std::hypot(cx-bx,cy-by),std::hypot(ax-cx,ay-cy)});
  const double altitude=longest?twice/longest:0,aspect=altitude?longest/altitude:INFINITY;
  maximumAspect=std::max(maximumAspect,aspect);minimumAltitude=std::min(minimumAltitude,altitude);minimumArea=std::min(minimumArea,area);
  if(area<1e-7||longest<1e-7)++degenerate;
  if(aspect>aspectLimit||altitude<minAllowed){++slender;worst.push_back({i,tri,aspect,altitude,longest,area});}
 }
 std::sort(worst.begin(),worst.end(),[](const Bad& a,const Bad& b){return a.aspect>b.aspect||(a.aspect==b.aspect&&a.index<b.index);});
 Json bad=Json::array();
 for(std::size_t i=0;i<worst.size()&&static_cast<double>(i)<worstCount;++i){
  const auto& b=worst[i];
  bad.push_back({{"index",b.index},{"triangle",b.triangle},{"aspect",finiteOrNull(jsRound(b.aspect,3))},
   {"shortestAltitudeCm",finiteOrNull(jsRound(b.altitude,4))},{"longestEdgeCm",finiteOrNull(jsRound(b.longest,4))},
   {"areaCm2",finiteOrNull(jsRound(b.area,5))}});
 }
 return {{"faces",faces.size()},{"vertices",vertices.size()},{"maximumAspect",finiteOrNull(jsRound(maximumAspect,3))},
 {"minimumAltitudeCm",finiteOrNull(jsRound(minimumAltitude,4))},{"minimumAreaCm2",finiteOrNull(jsRound(minimumArea,5))},
 {"degenerateFaces",degenerate},{"slenderFaces",slender},{"qualityApproved",degenerate==0&&slender==0&&!faces.empty()},
 {"thresholds",{{"aspectLimit",finiteOrNull(aspectLimit)},{"minimumAltitudeCm",finiteOrNull(minAllowed)}}},{"worst",bad}};
}
Json resolveSolverTimestep(const Json& settings,double dt,double maxThickness) {
 if(!std::isfinite(dt)||dt<0)throw std::range_error("Invalid simulation dt");
 if(dt==0)return nullptr;
 if(!std::isfinite(maxThickness)||maxThickness<0)throw std::range_error("Invalid maximum cloth thickness");
 const double safeDt=std::min(dt,1./30.),gravity=defaultNum(settings,"gravity",9.81);
 if(!std::isfinite(gravity)||gravity<0)throw std::range_error("Invalid simulation gravity");
 const double substeps=std::max(1.,std::min(4.,std::floor(defaultNum(settings,"substeps",1,true)+.5)));
 const double subDt=safeDt/substeps,gravityStep=gravity*subDt*subDt;
 const double requested=std::max(2.,std::min(14.,defaultNum(settings,"iterations",7,true)));
 const double iterations=std::max(2.,std::ceil(requested/substeps));
 const double margin=defaultNum(settings,"selfCollisionMargin",.002);
 if(!std::isfinite(margin)||margin<0)throw std::range_error("Invalid self-collision margin");
 return {{"safeDt",safeDt},{"gravity",gravity},{"substeps",finiteOrNull(substeps)},{"subDt",subDt},
 {"gravityStep",gravityStep},{"requestedIterations",finiteOrNull(requested)},{"iterations",finiteOrNull(iterations)},
 {"selfCollisionDistance",std::max(.004,maxThickness*2+margin)}};
}
}
