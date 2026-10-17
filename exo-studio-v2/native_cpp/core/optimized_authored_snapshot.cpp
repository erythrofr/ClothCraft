#include "optimized_authored_snapshot.hpp"
#include "assembled_cloth_snapshot.hpp"
#include "quality_triangulation.hpp"
#include "native_simulation_payload_builder.hpp"
#include "simulation_quality.hpp"
#include "native_assembly_preflight.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <map>
#include <set>
#include <vector>
namespace garment {
namespace {
double n(const Json& j,const char* k,double d){return j.is_object()&&j.contains(k)&&j[k].is_number()?j[k].get<double>():d;}
double clamp(double x,double lo,double hi){return std::clamp(x,lo,hi);}
using Edge=std::pair<size_t,size_t>;
Edge key(size_t a,size_t b){return std::minmax(a,b);}
Json springs(const Json& project,const Json& piece,const Json& source,const Json& fabric,const std::pair<double,double>& factor){
 Json out=Json::array();
 double base=clamp(n(project.value("simulation",Json::object()),"stiffness",.9),.55,.995);
 const bool strengthened=source.value("strengthened",false);
 double structural=std::min(.997,base*(strengthened?1.06:1.)*factor.first);
 double bend=clamp((.10+n(fabric,"bend",.65)*.65)*(strengthened?1.22:1.)*factor.second,.08,.92);
 double angle=n(source,"grainAngleDeg",0)*3.14159265358979323846/180;
 double wx=std::sin(angle),wy=std::cos(angle),vx=std::cos(angle),vy=-std::sin(angle);
 auto& verts=piece.at("flatVertices");
 auto distance=[&](size_t a,size_t b){double dx=n(verts[b],"x",0)-n(verts[a],"x",0),dy=n(verts[b],"y",0)-n(verts[a],"y",0);return std::hypot(dx,dy);};
 std::set<Edge> seen;
 std::map<Edge,std::vector<size_t>> opposite;
 std::vector<Edge> order;
 for(const auto& f:piece.at("faces")){
  size_t a=f[0].get<size_t>(),b=f[1].get<size_t>(),c=f[2].get<size_t>();
  for(auto e:std::array<std::array<size_t,3>,3>{{{{a,b,c}},{{b,c,a}},{{c,a,b}}}}){auto k=key(e[0],e[1]);if(!opposite.count(k))order.push_back(k);opposite[k].push_back(e[2]);}
  for(auto e:std::array<Edge,3>{{{a,b},{b,c},{c,a}}}){
   if(!seen.insert(key(e.first,e.second)).second)continue;
   double dx=n(verts[e.second],"x",0)-n(verts[e.first],"x",0),dy=n(verts[e.second],"y",0)-n(verts[e.first],"y",0);
   double length=std::hypot(dx,dy);if(length==0)length=1;
   double warp=std::abs(dx/length*wx+dy/length*wy),weft=std::abs(dx/length*vx+dy/length*vy);
   double stretch=warp*warp*std::max(0.,n(fabric,"stretchWarp",.05))+weft*weft*std::max(0.,n(fabric,"stretchWeft",.05));
   double shrink=warp*warp*n(fabric,"shrinkWarp",0)+weft*weft*n(fabric,"shrinkWeft",0);
   out.push_back({{"type","structural"},{"pieceId",piece.at("id")},{"aIndex",e.first},{"bIndex",e.second},{"rest",distance(e.first,e.second)*.01*clamp(1-shrink,.65,1.35)},{"stiffness",clamp(structural*(1-stretch*.55),.42,.997)},{"warpWeight",warp},{"weftWeight",weft}});
  }
 }
 for(const auto& k:order){const auto& v=opposite.at(k);if(v.size()!=2||v[0]==v[1])continue;out.push_back({{"type","bend"},{"pieceId",piece.at("id")},{"aIndex",v[0]},{"bIndex",v[1]},{"rest",distance(v[0],v[1])*.01},{"stiffness",bend}});}
 return out;
}
}
Json buildOptimizedAuthoredSnapshot(const Json& project){
 Json state=buildAssembledClothSnapshot(project);
 std::map<std::string,Json> authored;for(const auto& p:project.at("pieces"))authored[p.at("id").get<std::string>()]=p;
 const auto fabrics=project.value("fabrics",Json::object());
 std::map<std::string,std::pair<double,double>> fused;
 for(const auto& p:project.at("pieces")){if(p.value("active3d",true)==false||!p.contains("fusedToPieceId")||!p["fusedToPieceId"].is_string()||p["fusedToPieceId"].get<std::string>().empty())continue;
 auto fid=p.value("fabricId",std::string());auto fabric=fabrics.contains(fid)?fabrics.at(fid):Json::object();
 double stretch=(n(fabric,"stretchWarp",.04)+n(fabric,"stretchWeft",.04))*.5,b=n(fabric,"bend",.7);
 double s=1+clamp((.08-stretch)*.6+(b-.5)*.05,.025,.10),bend=1+clamp((b-.5)*.35+n(fabric,"gsm",50)/1000*.2,.08,.28);
 auto& factor=fused[p["fusedToPieceId"].get<std::string>()];if(factor.first==0)factor={1,1};
 factor.first=std::min(1.15,factor.first*s);factor.second=std::min(1.4,factor.second*bend);
 }
 Json rebuilt=Json::array(),faces=Json::array();
 for(auto& piece:state["pieces"]){
  auto optimized=optimizeTriangleQuality({{"vertices",piece.at("flatVertices")},{"faces",piece.at("faces")}});
  piece["faces"]=optimized.at("faces");
  const auto id=piece.at("id").get<std::string>();const auto& source=authored.at(id);auto fid=source.value("fabricId",std::string("main"));
  const auto fabric=fabrics.contains(fid)?fabrics.at(fid):(fabrics.contains("main")?fabrics.at("main"):Json::object());
  auto physical=springs(project,piece,source,fabric,fused.count(id)?fused.at(id):std::make_pair(1.,1.));
  for(auto& c:physical){c["aSimIndex"]=piece.at("particleOffset").get<size_t>()+c.at("aIndex").get<size_t>();c["bSimIndex"]=piece.at("particleOffset").get<size_t>()+c.at("bIndex").get<size_t>();rebuilt.push_back(c);}
  // Preserve edge treatments derived from boundary indices; their topology is unchanged.
  for(const auto& c:state.at("clothConstraints"))if(c.at("pieceId")==id&&c.at("type")!="structural"&&c.at("type")!="bend")rebuilt.push_back(c);
  auto offset=piece.at("particleOffset").get<size_t>();
  for(const auto& f:piece.at("faces"))faces.push_back(Json::array({offset+f[0].get<size_t>(),offset+f[1].get<size_t>(),offset+f[2].get<size_t>()}));
 }
 state["clothConstraints"]=rebuilt;state["faces"]=faces;
 state["optimizedTopology"]=true;state["fullPayloadParity"]=false;
 state["parityScope"]="optimized authored geometry and constraints; live THREE objects, collision fit, full payload mapping not certified";
 return state;
}
Json buildOptimizedNativeXpbdPayload(const Json& project,const Json& options){
 if(options.value("experimentalSewFirst",false)||project.value("simulation",Json::object()).value("experimentalNativeSewFirst",false))throw std::runtime_error("sew-first optimization unsupported");
 Json snapshot=buildOptimizedAuthoredSnapshot(project);
 // Reuse the verified non-optimized runtime fields while regenerating every
 // topology-dependent payload section from optimized authored springs.
 Json baseOptions=options;baseOptions.erase("experimentalOptimizeMesh");
 Json projectBase=project;
 if(projectBase.contains("simulation")&&projectBase["simulation"].is_object())projectBase["simulation"].erase("experimentalNativeMeshOptimization");
 Json payload=buildAuthoredNativeSimulationPayload(projectBase,baseOptions);
 for(size_t i=0;i<snapshot.at("pieces").size();++i){
  const auto& p=snapshot.at("pieces")[i];auto& dest=payload["pieces"][i];
  dest["faces"]=p.at("faces");
  dest["meshQuality"]=inspectClothMesh(p.at("flatVertices"),p.at("faces"));
 }
 Json constraints=Json::array();
 auto spring=[](double stiffness){double normalized=clamp(stiffness,.001,.9999);return 12000+488000*std::pow(normalized,4);};
 for(const auto& c:snapshot.at("clothConstraints")){
  double stiffness=n(c,"stiffness",.9),normalized=clamp(stiffness,.001,.9999);
  constraints.push_back({{"type",c.at("type")},{"a",c.at("aSimIndex")},{"b",c.at("bSimIndex")},{"rest",c.at("rest")},{"stiffness",spring(stiffness)},{"sourceStiffness",normalized},{"seamId",c.value("seamId",Json())}});
 }
 // Fused and sewn constraints in the base builder follow every cloth spring.
 const size_t baseClothCount=buildAssembledClothSnapshot(projectBase).at("clothConstraints").size();
 for(size_t i=baseClothCount;i<payload["constraints"].size();++i)constraints.push_back(payload["constraints"][i]);
 payload["constraints"]=constraints;
 Json exclusion=Json::array();std::set<std::pair<size_t,size_t>> included;
 auto include=[&](size_t a,size_t b){auto pair=std::minmax(a,b);if(included.emplace(pair.first,pair.second).second)exclusion.push_back(Json::array({pair.first,pair.second}));};
 for(const auto& c:constraints)if(c.at("type")!="seam")include(c.at("a").get<size_t>(),c.at("b").get<size_t>());
 for(const auto& seam:snapshot.at("seamConstraints")){
  if(seam.at("type")=="seam-virtual")continue;
  include(seam.at("aSimIndex").get<size_t>(),seam.at("bSimIndex").get<size_t>());
 }
 for(const auto& virtualSeam:payload.at("virtualSeams"))for(const auto& a:virtualSeam.at("sourceIndices"))for(const auto& b:virtualSeam.at("targetIndices"))if(a!=b)include(a.get<size_t>(),b.get<size_t>());
 const auto settings=project.value("simulation",Json::object());
 double gap=std::max(.004,n(payload.at("settings"),"maxThickness",.002)*2+n(settings,"selfCollisionMargin",.002));
 double threshold=std::max(.014,gap*1.8);
 for(const auto& piece:payload.at("pieces")){
  const auto& flat=piece.at("flatVerticesM");const auto& ids=piece.at("particleIndices");
  for(size_t i=0;i<flat.size();++i)for(size_t j=i+1;j<flat.size();++j){
   double dx=flat[i][0].get<double>()-flat[j][0].get<double>(),dy=flat[i][1].get<double>()-flat[j][1].get<double>();
   if(std::hypot(dx,dy)<=threshold)include(ids[i].get<size_t>(),ids[j].get<size_t>());
  }
 }
 payload["collisionExclusions"]=exclusion;
 payload["initialAssembly"]=inspectNativeAssemblyPose(payload);
 payload["fullPayloadParity"]=false;
 payload["parityUnsupported"]=Json::array({"optimized payload requires complete parity certification","meshQuality.worst numerical tie order and maximumAspect rounding","optimized virtual-seam barycentric anchors and resulting exclusion ordering","advanced runtime attachments and internal geometry","experimentalSewFirst"});
 return payload;
}
}
