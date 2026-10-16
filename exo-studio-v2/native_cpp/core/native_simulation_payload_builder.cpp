#include "native_simulation_payload_builder.hpp"
#include "assembled_cloth_snapshot.hpp"
#include "native_payload.hpp"
#include "simulation_quality.hpp"
#include "native_assembly_preflight.hpp"
#include "avatar_physics.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <vector>
namespace garment {
namespace {
Json val(const Json& j,const char* k,Json fallback=nullptr){return j.is_object()&&j.contains(k)&&!j[k].is_null()?j[k]:fallback;}
double num(const Json& j,const char* k,double d){auto x=val(j,k);return x.is_number()?x.get<double>():d;}
double clamp(double v,double a,double b){return std::max(a,std::min(b,v));}
Json obj(const Json& j,const char* k){auto x=val(j,k);return x.is_object()?x:Json::object();}
Json arr(const Json& j,const char* k){auto x=val(j,k);return x.is_array()?x:Json::array();}
std::string str(const Json& j,const char* k,std::string d=""){auto x=val(j,k);return x.is_string()?x.get<std::string>():d;}
double spring(double stiffness){return 12000+488000*std::pow(clamp(stiffness,.001,.9999),4);}

}
Json buildAuthoredNativeSimulationPayload(const Json& project,const Json& options){
 const auto configOptions=obj(project,"simulation");
 if(val(options,"experimentalOptimizeMesh")==true||val(configOptions,"experimentalNativeMeshOptimization")==true)
  throw std::runtime_error("experimentalOptimizeMesh requires optimized topology and constraint rebuild; native parity unsupported");
 if(val(options,"experimentalSewFirst")==true||val(configOptions,"experimentalNativeSewFirst")==true)
  throw std::runtime_error("experimentalSewFirst requires complete assembly mutation and contact validation; native parity unsupported");
 const Json snapshot=buildAssembledClothSnapshot(project),quality=resolveNativeQuality(options),config=obj(project,"simulation"),fabrics=obj(project,"fabrics");
 std::map<std::string,Json> authored;
 for(const auto& p:arr(project,"pieces"))authored[str(p,"id")]=p;
 Json pieces=Json::array(),particles=Json::array(),constraints=Json::array(),virtualSeams=Json::array(),anchors=Json::array();
 double maxThickness=.001;
 for(auto it=fabrics.begin();it!=fabrics.end();++it)maxThickness=std::max(maxThickness,num(it.value(),"thickness",.002));
 for(const auto& m:snapshot.at("pieces")){
  const auto id=str(m,"id");const auto source=authored.at(id);const auto fabricId=str(source,"fabricId","main");
  Json fabric=obj(fabrics,fabricId.c_str());if(fabric.empty())fabric=obj(fabrics,"main");
  const double bend=num(fabric,"bend",.65),grain=num(source,"grainAngleDeg",0);
  const auto arrangement=obj(source,"arrangement3d");const auto wrap=str(arrangement,"wrap");
  const size_t offset=m.at("particleOffset").get<size_t>();
  Json ids=Json::array(),flatM=Json::array();
  double minX=1e30,maxX=-1e30;
  for(const auto& point:m.at("flatVertices")){double x=num(point,"x",0);minX=std::min(minX,x);maxX=std::max(maxX,x);flatM.push_back(Json::array({x*.01,num(point,"y",0)*.01,0}));}
  const double center=(minX+maxX)*.5,half=std::max(1.,(maxX-minX)*.5);
  std::vector<std::set<std::string>> seamIds(m.at("particleCount").get<size_t>());
  // Set membership used for the boundary flag; seam insertion order must match JS.
  std::vector<std::vector<std::string>> orderedIds(seamIds.size());
  for(const auto& seam:arr(project,"seams"))for(const char* side:{"a","b"}){
   auto end=obj(seam,side);if(str(end,"pieceId")!=id)continue;
   int edge=(int)num(end,"edgeIndex",-1);
   if(edge<0||edge>=(int)m.at("boundaryIndices").size())continue;
   for(const auto& index:m.at("boundaryIndices")[edge]){
    auto k=index.get<size_t>();if(k>=orderedIds.size())continue;
    auto seamId=str(seam,"id");if(seamIds[k].insert(seamId).second)orderedIds[k].push_back(seamId);
   }
  }
  for(size_t i=0;i<m.at("particleCount").get<size_t>();i++){
   const auto& pos=m.at("positions")[i],p=m.at("flatVertices")[i];
   double patternU=clamp((num(p,"x",0)-center)/half,-1,1);
   const bool split=(wrap=="front"||wrap=="back")&&((arr(source,"fitShoulderSides").size()==1)||str(source,"generatedRole").rfind("zip-front",0)==0);
   // Match JS buildSimulation's fitShoulderSides / zip-front torso transform.
   // The authored particle position is in world metres, and the radii follow
   // the same local avatar profile used by body clearance and staging.
   if(split){
    const double y=clamp(pos.at(1).get<double>(),.60,1.58);
    const auto torso=avatar_physics::getAvatarTorsoRadii(obj(project,"avatar"),y);
    const double radius=std::max(.12,torso.at("x").get<double>());
    patternU=clamp(pos.at(0).get<double>()/radius,-1,1);
   }
   double sideZ=num(arrangement,"z",0),construction=0;
   for(const auto& sid:orderedIds[i])if(sid.find("sleeve-")!=std::string::npos&&sid.find("-back-lower")!=std::string::npos)construction=-1;
   bool frontArmhole=false,backArmhole=false;
   for(const auto& sid:orderedIds[i]){
    if(sid.find("sleeve-l-front")!=std::string::npos||sid.find("sleeve-r-front")!=std::string::npos)frontArmhole=true;
    if(sid.find("sleeve-l-back")!=std::string::npos||sid.find("sleeve-r-back")!=std::string::npos)backArmhole=true;
   }
   if(frontArmhole!=backArmhole&&std::abs(pos[2].get<double>())<=.014)sideZ=frontArmhole?1:-1;
   ids.push_back(offset+i);
   particles.push_back({{"id",id+":"+std::to_string(i)},{"pieceId",id},{"position",pos},{"previous",pos},
    {"invMass",source.value("frozen3d",false)?0:1},{"wrapMode",wrap},{"patternU",patternU},
    {"collisionSideZ",sideZ<0?-1:1},{"constructionSideZ",construction},
    {"seamBoundary",!orderedIds[i].empty()},{"seamIds",orderedIds[i]},
    {"thickness",num(fabric,"thickness",.002)},{"friction",num(fabric,"friction",.3)},
    {"layerIndex",clamp(std::round(num(source,"layerIndex",0)),0,8)}});
  }
  pieces.push_back({{"id",id},{"meshQuality",inspectClothMesh(m.at("flatVertices"),m.at("faces"))},{"name",str(source,"name",id)},{"wrapMode",wrap},
   {"fabricId",fabricId},{"grainAngleDeg",grain},
   {"fabric",{{"stretchWarp",num(fabric,"stretchWarp",.05)},{"stretchWeft",num(fabric,"stretchWeft",.05)},
     {"bend",bend},{"shear",num(fabric,"shear",.45+bend*.45)}}},
   {"particleIndices",ids},{"flatVerticesM",flatM},{"faces",m.at("faces")}});
 }
 auto append=[&](const Json& c,const std::string& type,size_t a,size_t b){
  double stiffness=clamp(num(c,"stiffness",.9),.001,.9999);
  constraints.push_back({{"type",type},{"a",a},{"b",b},{"rest",c.at("rest")},
   {"stiffness",spring(stiffness)},{"sourceStiffness",stiffness},{"seamId",val(c,"seamId")}});
 };
 for(const auto& c:snapshot.at("clothConstraints"))append(c,str(c,"type"),c.at("aSimIndex").get<size_t>(),c.at("bSimIndex").get<size_t>());
 // Fused layer springs are appended after per-piece cloth constraints and
 // before authored sewing, matching physics.js constraint insertion order.
 for(const auto& m:snapshot.at("pieces")){
  const auto id=str(m,"id");const auto source=authored.at(id);const auto target=str(source,"fusedToPieceId");
  if(target.empty()||target==id)continue;
  auto found=std::find_if(snapshot.at("pieces").begin(),snapshot.at("pieces").end(),[&](const Json& piece){return str(piece,"id")==target;});
  if(found==snapshot.at("pieces").end())continue;
  const auto& flat=found->at("flatVertices");
  const size_t sourceOffset=m.at("particleOffset").get<size_t>(),targetOffset=found->at("particleOffset").get<size_t>();
  const double stiffness=clamp(num(source,"fuseStiffness",.985),.75,.998),rest=clamp(num(source,"fuseGapM",.001),.0004,.004);
  for(size_t i=0;i<m.at("flatVertices").size();++i){
   const auto& point=m.at("flatVertices")[i];size_t nearest=0;double best=1e300;
   for(size_t k=0;k<flat.size();++k){double dx=num(flat[k],"x",0)-num(point,"x",0),dy=num(flat[k],"y",0)-num(point,"y",0),d=dx*dx+dy*dy;if(d<best){best=d;nearest=k;}}
   const size_t a=sourceOffset+i,b=targetOffset+nearest;
   for(const char* key:{"seamBoundary","seamIds","constructionSideZ","collisionSideZ","patternU"})particles[a][key]=particles[b][key];
   append(Json{{"rest",rest},{"stiffness",stiffness}},"fuse",a,b);
  }
 }
 for(const auto& c:snapshot.at("seamConstraints")){
  if(str(c,"type")=="seam-virtual"){
   const auto offsets=[&](const char* piece)->size_t{for(const auto& m:snapshot.at("pieces"))if(m.at("id")==c.at(piece))return m.at("particleOffset").get<size_t>();throw std::invalid_argument("virtual seam references missing piece");};
   auto indices=[&](const char* field,size_t base){Json result=Json::array();for(const auto& ix:c.at(field))result.push_back(ix.get<size_t>()+base);return result;};
   virtualSeams.push_back({{"seamId",c.at("seamId")},{"sourceIndices",indices("sourceIndices",offsets("aPieceId"))},
    {"sourceWeights",c.at("sourceWeights")},{"targetIndices",indices("targetIndices",offsets("bPieceId"))},
    {"targetWeights",c.at("targetWeights")},{"rest",c.at("rest")},{"stiffness",c.at("stiffness")},{"progress",c.at("progress")}});
  }else append(c,str(c,"type"),c.at("aSimIndex").get<size_t>(),c.at("bSimIndex").get<size_t>());
 }
 for(const auto& a:snapshot.at("anchorConstraints"))anchors.push_back({{"particle",a.at("simIndex")},
  {"target",a.at("target")},{"stiffness",clamp(num(a,"stiffness",.2),0,1)},
  {"axes",val(a,"axes")},{"type",str(a,"type","anchor")}});
 const bool strain=quality.at("clothModel")=="strain-triangle";
 Json settings={{"gravity",num(config,"gravity",9.81)},{"damping",num(options,"damping",.994)},
  {"iterations",std::max(4.,num(config,"iterations",7))},{"substeps",clamp(num(config,"substeps",2),1,4)},
  {"dt",num(options,"dt",1./60)},{"collisions",val(config,"collisions")!=false},
  {"collisionMargin",num(config,"collisionMargin",.012)},{"selfCollision",val(config,"selfCollision")!=false},
  {"selfCollisionMargin",num(config,"selfCollisionMargin",.002)},{"maxThickness",maxThickness},
  {"structuralStiffness",num(config,"stiffness",.92)},{"lowerBodySeamRecovery",num(options,"lowerBodySeamRecovery",.9)},
  {"lowerBodyJunctionRecovery",num(options,"lowerBodyJunctionRecovery",.9)},
  {"quality",quality.at("quality")},{"clothModel",quality.at("clothModel")},{"bendingModel",quality.at("bendingModel")},
  {"strainMeshMaxAspect",strain?num(options,"strainMeshMaxAspect",num(config,"nativeStrainMeshMaxAspect",25)):1e12},
  {"strainMeshMinAltitudeM",strain?num(options,"strainMeshMinAltitudeM",num(config,"nativeStrainMeshMinAltitudeM",.002)):0},
  {"strainProjectionCapM",0},{"captureFitTrajectory",quality.at("quality")=="quality"}};
 Json exclusions=Json::array();std::set<std::pair<size_t,size_t>> excluded;
 auto include=[&](size_t a,size_t b){const auto k=std::minmax(a,b);if(excluded.emplace(k.first,k.second).second)exclusions.push_back(Json::array({k.first,k.second}));};
 for(const auto& c:constraints)if(c.at("type")!="seam")include(c.at("a").get<size_t>(),c.at("b").get<size_t>());
 size_t nextVirtual=0;
 for(const auto& c:snapshot.at("seamConstraints")){
  if(c.at("type")=="seam-virtual"){
   const auto& seam=virtualSeams.at(nextVirtual++);
   for(const auto& a:seam.at("sourceIndices"))for(const auto& b:seam.at("targetIndices")){
    size_t ia=a.get<size_t>(),ib=b.get<size_t>();if(ia!=ib)include(ia,ib);
   }
  }else include(c.at("aSimIndex").get<size_t>(),c.at("bSimIndex").get<size_t>());
 }
 double selfGap=std::max(.004,maxThickness*2+num(config,"selfCollisionMargin",.002));
 double restNeighbor=std::max(.014,selfGap*1.8);
 for(const auto& piece:pieces){const auto& flat=piece.at("flatVerticesM");const auto& ids=piece.at("particleIndices");
  for(size_t i=0;i<flat.size();i++)for(size_t j=i+1;j<flat.size();j++){
   double dist=std::hypot(flat[i][0].get<double>()-flat[j][0].get<double>(),flat[i][1].get<double>()-flat[j][1].get<double>());
   if(dist<=restNeighbor)include(ids[i].get<size_t>(),ids[j].get<size_t>());
  }
 }
 Json fusedPairs=Json::array();std::set<std::string> seenFused;
 for(const auto& source:arr(project,"pieces")){
  const auto follower=str(source,"id"),target=str(source,"fusedToPieceId");
  if(target.empty()||follower==target||!authored.count(target))continue;
  if(source.value("active3d",true)==false||authored.at(target).value("active3d",true)==false)continue;
  const std::string key=std::min(follower,target)+"|"+std::max(follower,target);
  if(seenFused.insert(key).second)fusedPairs.push_back(key);
 }
 Json payload={{"protocol","garment-studio.native-xpbd"},{"version",1},
  {"project",{{"id",val(project,"id")},{"name",val(project,"name")},{"templateId",str(project,"templateId","custom")}}},
  {"avatar",val(project,"avatar")},{"settings",settings},{"particles",particles},{"pieces",pieces},
  {"constraints",constraints},{"virtualSeams",virtualSeams},{"anchors",anchors},
  {"collisionExclusions",exclusions},{"fusedPiecePairs",fusedPairs},
  {"fullPayloadParity",false},
  {"parityUnsupported",Json::array({"experimentalOptimizeMesh","experimentalSewFirst","advanced runtime attachments and internal geometry","tee meshQuality.worst ranking tie-order"})}};
 payload["initialAssembly"]=inspectNativeAssemblyPose(payload);
 return payload;
}
}
