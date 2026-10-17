#include "native_payload.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <map>
#include <set>
namespace garment {
const Json NATIVE_QUALITY_PROFILES={
 {"draft",{{"id","draft"},{"label","Draft · Distance XPBD"},{"clothModel","distance"},{"bendingModel","distance"}}},
 {"balanced",{{"id","balanced"},{"label","Balanced · Isometric bend"},{"clothModel","distance"},{"bendingModel","isometric-xpbd"}}},
 {"quality",{{"id","quality"},{"label","Quality · Grain strain + isometric"},{"clothModel","strain-triangle"},{"bendingModel","isometric-xpbd"}}}
};
namespace {
const Json& get(const Json& x,const char* k){static const Json nil;return x.is_object()&&x.contains(k)?x.at(k):nil;}
bool yes(const Json& x){return !x.is_null()&&x!=false&&x!=0&&x!="";}
std::string string(const Json& x,const std::string& fallback=""){return x.is_string()?x.get<std::string>():fallback;}
double number(const Json& x,double fallback){if(x.is_null())return fallback;if(x.is_number())return x.get<double>();if(x.is_boolean())return x.get<bool>()?1:0;if(x.is_string()){try{std::size_t end;auto value=std::stod(x.get<std::string>(),&end);if(end==x.get<std::string>().size())return value;}catch(...){}}return NAN;}
double value(const Json& o,const char* k,double fallback){return number(get(o,k),fallback);}
Json safe(const Json& x,const char* k,const Json& fallback){const auto& y=get(x,k);return y.is_null()?fallback:y;}
Json arr(const Json& x,const char* k){const auto& y=get(x,k);return y.is_array()?y:Json::array();}
Json vector3(const Json& p,double scale=1){if(p.is_array()&&p.size()==3)return Json::array({number(p[0],NAN)*scale,number(p[1],NAN)*scale,number(p[2],NAN)*scale});return Json::array({value(p,"x",NAN)*scale,value(p,"y",NAN)*scale,value(p,"z",NAN)*scale});}
}
Json resolveNativeQuality(const Json& options){
 std::string inferred=string(get(options,"quality"));
 const auto cloth=string(get(options,"clothModel")),bend=string(get(options,"bendingModel"));
 if(inferred.empty()&&(!cloth.empty()||!bend.empty())){
  if(cloth=="strain-triangle"&&bend=="isometric-xpbd")inferred="quality";
  else if((cloth.empty()||cloth=="distance")&&bend=="isometric-xpbd")inferred="balanced";
  else inferred="draft";
 }
 const auto& profile=NATIVE_QUALITY_PROFILES.contains(inferred)?NATIVE_QUALITY_PROFILES.at(inferred):NATIVE_QUALITY_PROFILES.at("draft");
 const std::string cm=cloth.empty()?profile.at("clothModel").get<std::string>():cloth;
 const std::string bm=bend.empty()?profile.at("bendingModel").get<std::string>():bend;
 if(cm=="strain-triangle"&&bm!="isometric-xpbd"&&get(options,"allowUnsafeCombination")!=true)
  throw std::invalid_argument("Native strain-triangle cloth requires isometric-xpbd bending. The strain-only combination is intentionally blocked because hooded garments diverge in regression tests.");
 return {{"quality",inferred.empty()?profile.at("id"):Json(inferred)},{"clothModel",cm},{"bendingModel",bm}};
}
Json nativePayloadSummary(const Json& payload){
 const auto& setting=get(payload,"settings");
 const auto& initial=get(payload,"initialAssembly");
 const auto& experiment=get(payload,"assemblyExperiment");
 Json research=nullptr;
 if(experiment.is_object()){
  const auto& input=get(experiment,"input");const auto& output=get(experiment,"output");const auto& collision=get(experiment,"collision");
  research={{"originalMaximumSeamGapMm",get(input,"initialSeamGapMaximumMm")},{"assembledMaximumSeamGapMm",get(output,"initialSeamGapMaximumMm")},
   {"originalPeakEdgeStrainPercent",get(input,"initialMeshPeakEdgeStrainPercent")},{"assembledPeakEdgeStrainPercent",get(output,"initialMeshPeakEdgeStrainPercent")},
   {"sampledPenetratingPoints",get(collision,"penetrating")},{"sampledMaximumIntrusionMm",get(collision,"maximumIntrusionMm")},{"safeToAutoApply",false}};
 }
 const auto& groups=get(initial,"worstSewingGroups");Json worst=nullptr;
 if(groups.is_array()&&!groups.empty())worst=get(groups[0],"seamId");
 return {{"project",safe(get(payload,"project"),"name","Untitled")},
 {"pieces",arr(payload,"pieces").size()},{"particles",arr(payload,"particles").size()},
 {"constraints",arr(payload,"constraints").size()},{"virtualSeams",arr(payload,"virtualSeams").size()},{"anchors",arr(payload,"anchors").size()},
 {"clothModel",safe(setting,"clothModel","distance")},{"bendingModel",safe(setting,"bendingModel","distance")},
 {"quality",safe(setting,"quality","draft")},{"initialAssembly",safe(initial,"status","NOT_MEASURED")},
 {"initialSeamGapMaximumMm",get(initial,"initialSeamGapMaximumMm")},
 {"initialSeamGapAverageMm",get(initial,"initialSeamGapAverageMm")},
 {"initialMeshPeakEdgeStrainPercent",get(initial,"initialMeshPeakEdgeStrainPercent")},
 {"worstInitialSeam",worst},{"sewFirstResearch",research}};
}
Json buildNativeSimulationPayload(const Json& project,const Json& simulation,const Json& options){
 if(!simulation.is_object()||!get(simulation,"pieces").is_object())
  throw std::invalid_argument("Native payload adapter requires an explicit meshed simulation with pieces keyed by ID");
 const Json quality=resolveNativeQuality(options),config=safe(project,"simulation",Json::object());
 const auto& entries=simulation.at("pieces");
 Json particles=Json::array(),pieces=Json::array(),constraints=Json::array(),virtualSeams=arr(simulation,"virtualSeams"),anchors=arr(simulation,"anchors");
 std::map<std::string,std::size_t> indices;
 for(auto it=entries.begin();it!=entries.end();++it){
  const auto& piece=it.value();const auto& info=get(piece,"piece"),fabric=get(piece,"fabric");
  Json ids=Json::array();
  for(const auto& p:arr(piece,"particles")){
   const auto& simIndex=get(p,"simIndex");
   if(!simIndex.is_number_integer())throw std::invalid_argument("Simulation particle requires integer simIndex");
   const auto idx=particles.size();
   indices[std::to_string(simIndex.get<long long>())]=idx;ids.push_back(idx);
   particles.push_back({{"id",get(p,"id")},{"pieceId",it.key()},{"position",vector3(get(p,"position"))},
    {"previous",vector3(get(p,"previous"))},{"invMass",value(p,"invMass",1)},
    {"wrapMode",safe(p,"wrapMode","")},{"patternU",get(p,"patternU")},
    {"collisionSideZ",value(p,"collisionSideZ",0)},{"constructionSideZ",value(p,"constructionSideZ",0)},
    {"seamBoundary",yes(get(p,"seamBoundary"))},{"seamIds",arr(p,"seamIds")},
    {"thickness",value(fabric,"thickness",.002)},{"friction",value(fabric,"friction",.3)},
    {"layerIndex",value(piece,"layerIndex",0)}});
  }
  Json flat=Json::array();
  for(const auto& v:arr(piece,"flatVertices"))flat.push_back({value(v,"x",NAN)*.01,value(v,"y",NAN)*.01,0});
  const double bend=value(fabric,"bend",.65);
  pieces.push_back({{"id",it.key()},{"meshQuality",get(piece,"meshQuality")},{"name",safe(info,"name",it.key())},
   {"wrapMode",safe(get(info,"arrangement3d"),"wrap","")},{"fabricId",safe(info,"fabricId","main")},
   {"grainAngleDeg",value(info,"grainAngleDeg",0)},
   {"fabric",{{"stretchWarp",value(fabric,"stretchWarp",.05)},{"stretchWeft",value(fabric,"stretchWeft",.05)},
    {"bend",bend},{"shear",value(fabric,"shear",.45+bend*.45)}}},
   {"particleIndices",ids},{"flatVerticesM",flat},{"faces",arr(piece,"faces")}});
 }
 const std::set<std::string> accepted={"structural","bend","seam","surface-stitch","fastener","edge-treatment","topstitch","zipper-tape","fuse","fold","dart","pleat"};
 for(const auto& c:arr(simulation,"constraints")){
  const auto type=string(get(c,"type"));if(!accepted.count(type))continue;
  auto a=get(c,"aSimIndex"),b=get(c,"bSimIndex");
  if(!a.is_number_integer()||!b.is_number_integer())continue;
  auto ai=indices.find(std::to_string(a.get<long long>())),bi=indices.find(std::to_string(b.get<long long>()));
  if(ai==indices.end()||bi==indices.end())continue;
  const double rest=value(c,"rest",NAN);if(!std::isfinite(rest))continue;
  const double stiff=std::max(.001,std::min(.9999,value(c,"stiffness",.9)));
  constraints.push_back({{"type",type},{"a",ai->second},{"b",bi->second},{"rest",rest},
   {"stiffness",12000+488000*std::pow(stiff,4)},{"sourceStiffness",stiff},{"seamId",get(c,"seamId")}});
 }
 auto nativeIndices=[&](const Json& list){Json output=Json::array();for(const auto& i:list){const auto k=std::to_string(i.get<long long>());auto pos=indices.find(k);if(pos==indices.end())throw std::invalid_argument("Virtual sewing references an unmapped simulation particle");output.push_back(pos->second);}return output;};
 for(auto& seam:virtualSeams){
  seam["sourceIndices"]=nativeIndices(arr(seam,"sourceIndices"));
  seam["targetIndices"]=nativeIndices(arr(seam,"targetIndices"));
 }
 const auto cSettings=config.is_object()?config:Json::object();
 const bool strain=quality.at("clothModel")=="strain-triangle";
 Json settings={{"gravity",value(cSettings,"gravity",9.81)},{"damping",value(options,"damping",.994)},
 {"iterations",std::max(4.,value(cSettings,"iterations",7))},{"substeps",std::max(1.,std::min(4.,value(cSettings,"substeps",2)))},
 {"dt",value(options,"dt",1./60)},{"collisions",get(cSettings,"collisions")!=false},{"collisionMargin",value(cSettings,"collisionMargin",.012)},
 {"selfCollision",get(cSettings,"selfCollision")!=false},{"selfCollisionMargin",value(cSettings,"selfCollisionMargin",.002)},
 {"maxThickness",value(simulation,"maxThickness",.002)},{"structuralStiffness",value(cSettings,"stiffness",.92)},
 {"lowerBodySeamRecovery",value(options,"lowerBodySeamRecovery",.9)},{"lowerBodyJunctionRecovery",value(options,"lowerBodyJunctionRecovery",.9)},
 {"quality",quality.at("quality")},{"clothModel",quality.at("clothModel")},{"bendingModel",quality.at("bendingModel")},
 {"strainMeshMaxAspect",strain?value(options,"strainMeshMaxAspect",value(cSettings,"nativeStrainMeshMaxAspect",25)):1e12},
 {"strainMeshMinAltitudeM",strain?value(options,"strainMeshMinAltitudeM",value(cSettings,"nativeStrainMeshMinAltitudeM",.002)):0},
 {"strainProjectionCapM",0},{"captureFitTrajectory",quality.at("quality")=="quality"}};
 Json exclusions=Json::array();
 for(const auto& pair:arr(simulation,"collisionExclusions")){
  if(!pair.is_string())continue;const auto s=pair.get<std::string>();const auto pivot=s.find(':');
  if(pivot==std::string::npos)continue;
  auto a=indices.find(s.substr(0,pivot)),b=indices.find(s.substr(pivot+1));
  if(a!=indices.end()&&b!=indices.end())exclusions.push_back({a->second,b->second});
 }
 Json payload={{"protocol","garment-studio.native-xpbd"},{"version",1},
 {"project",{{"id",get(project,"id")},{"name",get(project,"name")},{"templateId",safe(project,"templateId","custom")}}},
 {"avatar",get(project,"avatar")},{"settings",settings},{"particles",particles},{"pieces",pieces},
 {"constraints",constraints},{"virtualSeams",virtualSeams},{"anchors",anchors},
 {"collisionExclusions",exclusions},{"fusedPiecePairs",arr(simulation,"fusedPiecePairs")}};
 if(get(simulation,"initialAssembly").is_object())payload["initialAssembly"]=simulation.at("initialAssembly");
 else throw std::invalid_argument("Native payload adapter requires initialAssembly preflight report; native preflight not yet integrated");
 return payload;
}
}
