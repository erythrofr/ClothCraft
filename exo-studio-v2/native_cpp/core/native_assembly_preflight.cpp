#include "native_assembly_preflight.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>
namespace garment {
namespace {
bool finite3(const Json& v){if(!v.is_array()||v.size()!=3)return false;for(const auto& n:v)if(!n.is_number()||!std::isfinite(n.get<double>()))return false;return true;}
double distance(const Json& a,const Json& b){return std::hypot(a[0].get<double>()-b[0].get<double>(),a[1].get<double>()-b[1].get<double>(),a[2].get<double>()-b[2].get<double>());}
double rounded(double n){return std::floor(n*100+0.5)/100;}
std::string str(const Json& a,const char* name,const std::string& fallback=""){return a.is_object()&&a.contains(name)&&a[name].is_string()?a[name].get<std::string>():fallback;}
int index(const Json& a){return a.is_number_integer()?a.get<int>():-1;}
const Json* particle(const Json& particles,int i){return i>=0&&i<int(particles.size())?&particles[i]:nullptr;}
struct Group {std::string id;int count=0;double total=0,max=0;std::set<std::string> pieceIds;};
}
Json inspectNativeAssemblyPose(const Json& payload,const Json& options){
 if(!payload.is_object()||!payload.contains("particles")||payload["particles"].is_null()||!payload.contains("pieces")||payload["pieces"].is_null()||!payload.contains("constraints")||payload["constraints"].is_null())throw std::invalid_argument("Native assembly payload is incomplete");
 const Json &particles=payload.at("particles");if(!particles.is_array()||!payload["pieces"].is_array()||!payload["constraints"].is_array())throw std::invalid_argument("Native assembly payload is incomplete");
 for(const auto& p:particles)if(!p.is_object()||!p.contains("position")||!finite3(p["position"]))throw std::out_of_range("Invalid initial particle "+(p.is_object()&&p.contains("id")?(p["id"].is_string()?p["id"].get<std::string>():p["id"].dump()):"undefined"));
 double maxGap=0,totalGap=0;int seamSamples=0;std::map<std::string,Group> groups;std::vector<std::string> order;
 auto add=[&](const std::string& key,double gap,const Json* a,const Json* b){
  if(!groups.count(key)){groups[key].id=key;order.push_back(key);}
  auto& g=groups[key];g.count++;g.total+=gap;g.max=std::max(g.max,gap);
  for(auto* p:{a,b})if(p&&p->is_object()&&p->contains("pieceId")&&(*p)["pieceId"].is_string())g.pieceIds.insert((*p)["pieceId"].get<std::string>());
  maxGap=std::max(maxGap,gap);totalGap+=gap;seamSamples++;
 };
 for(const auto& c:payload["constraints"]){if(str(c,"type")!="seam")continue;const Json *a=particle(particles,c.contains("a")?index(c["a"]):-1),*b=particle(particles,c.contains("b")?index(c["b"]):-1);
  if(!a||!b)throw std::out_of_range("Native sewing constraint references unknown particle");
  std::string key=str(c,"seamId");add(key.empty()?"unnamed-seam":key,distance((*a)["position"],(*b)["position"])*1000,a,b);
 }
 if(payload.contains("virtualSeams")&&payload["virtualSeams"].is_array())for(const auto& seam:payload["virtualSeams"]){
  auto weighted=[&](const char* ids,const char* weights){
   Json point=Json::array({0.,0.,0.});const auto& inds=seam.at(ids);const auto& ws=seam.at(weights);
   for(size_t i=0;i<inds.size();++i){auto* p=particle(particles,index(inds[i]));if(!p||!finite3((*p)["position"]))throw std::out_of_range("Invalid virtual sewing particle position");
    for(int axis=0;axis<3;++axis)point[axis]=point[axis].get<double>()+(*p)["position"][axis].get<double>()*ws.at(i).get<double>();
   }return point;
  };
  Json a=weighted("sourceIndices","sourceWeights"),b=weighted("targetIndices","targetWeights");
  auto& si=seam.at("sourceIndices");auto& ti=seam.at("targetIndices");
  std::string key=str(seam,"seamId");add(key.empty()?"unnamed-free-seam":key,distance(a,b)*1000,si.empty()?nullptr:particle(particles,index(si[0])),ti.empty()?nullptr:particle(particles,index(ti[0])));
 }
 Json sewn=Json::array();
 for(const auto& key:order){auto& g=groups[key];Json ids=Json::array();for(const auto& id:g.pieceIds)ids.push_back(id);
  sewn.push_back({{"seamId",key},{"samples",g.count},{"maximumGapMm",rounded(g.max)},{"averageGapMm",rounded(g.total/g.count)},{"pieceIds",ids}});
 }
 std::stable_sort(sewn.begin(),sewn.end(),[](const Json& a,const Json& b){return a["maximumGapMm"].get<double>()>b["maximumGapMm"].get<double>();});
 if(sewn.size()>10)sewn.erase(sewn.begin()+10,sewn.end());
 double highStrain=0;int edgeSamples=0;Json worst=nullptr;std::set<std::pair<int,int>> seen;
 for(const auto& piece:payload["pieces"]){
  auto inds=piece.value("particleIndices",Json::array()),vertices=piece.value("flatVerticesM",Json::array());
  for(const auto& face:piece.value("faces",Json::array()))for(int n=0;n<3;++n){
   int ia=index(face.at(n)),ib=index(face.at((n+1)%3));
   const Json* va=ia>=0&&ia<int(vertices.size())?&vertices[ia]:nullptr,*vb=ib>=0&&ib<int(vertices.size())?&vertices[ib]:nullptr;
   int pa=ia>=0&&ia<int(inds.size())?index(inds[ia]):-1,pb=ib>=0&&ib<int(inds.size())?index(inds[ib]):-1;
   if(pa<0||pb<0||!va||!vb||!finite3(*va)||!finite3(*vb))throw std::out_of_range("Invalid native mesh edge");
   auto key=std::minmax(pa,pb);if(!seen.insert(key).second)continue;
   double rest=distance(*va,*vb);if(rest<=1e-8)continue;
   const Json* a=particle(particles,pa),*b=particle(particles,pb);if(!a||!b)throw std::out_of_range("Invalid native mesh particle index");
   double world=distance((*a)["position"],(*b)["position"]),strain=std::abs(world-rest)/rest*100;edgeSamples++;
   if(strain>highStrain){highStrain=strain;worst={{"pieceId",piece.value("id",Json(nullptr))},{"particleA",a->value("id",Json(nullptr))},{"particleB",b->value("id",Json(nullptr))},{"restLengthMm",rounded(rest*1000)},{"startLengthMm",rounded(world*1000)}};}
  }
 }
 double thresholdGap=options.value("maximumInitialSeamGapMm",30.),thresholdStrain=options.value("maximumInitialEdgeStrainPercent",20.);
 Json reasons=Json::array();if(maxGap>thresholdGap)reasons.push_back("sewing-boundaries-too-far-apart");if(highStrain>thresholdStrain)reasons.push_back("initial-mesh-distorted-relative-to-flat-pattern");
 return Json{{"status",reasons.empty()?"GEOMETRIC_PRECHECK_PASS":"STAGING_REQUIRES_REPAIR"},{"simulationFitApproved",false},{"reasons",reasons},{"pairCount",seamSamples},{"totalRestEdges",edgeSamples},{"initialSeamGapMaximumMm",rounded(maxGap)},{"initialSeamGapAverageMm",seamSamples?rounded(totalGap/seamSamples):0.},{"initialMeshPeakEdgeStrainPercent",rounded(highStrain)},{"worstEdge",worst},{"worstSewingGroups",sewn},{"thresholds",{{"maximumInitialSeamGapMm",thresholdGap},{"maximumInitialEdgeStrainPercent",thresholdStrain}}}};
}
}
