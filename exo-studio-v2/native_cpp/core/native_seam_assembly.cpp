#include "native_seam_assembly.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>
#include <vector>
namespace garment::native_seam_assembly {
namespace {
Json get(const Json& j,const char* k){return j.is_object()&&j.contains(k)?j[k]:Json();}
Json array(const Json& j){return j.is_array()?j:Json::array();}
double number(const Json& j,double fallback=0){if(j.is_number())return j.get<double>();return fallback;}
double option(const Json& j,const char* k,double fallback){Json v=get(j,k);return v.is_null()?fallback:number(v,fallback);}
bool flag(const Json& j,const char* k){return get(j,k)==true;}
int idx(const Json& j){return j.get<int>();}
double dist(const std::vector<double>& p,int a,int b){int x=a*3,y=b*3;return std::hypot(p[x]-p[y],p[x+1]-p[y+1],p[x+2]-p[y+2]);}
double rounding(double n){return std::round(n*100)/100;}
struct Edge{int a,b;double length;};
std::vector<Edge> edges(const Json& payload){
 std::set<std::pair<int,int>> seen;std::vector<Edge> result;
 for(const auto& piece:payload.at("pieces")){
  const auto& ids=piece.at("particleIndices");const auto& flats=piece.at("flatVerticesM");
  for(const auto& face:piece.at("faces"))for(int i=0;i<3;i++){
   int localA=idx(face[i]),localB=idx(face[(i+1)%3]),a=idx(ids[localA]),b=idx(ids[localB]);
   if(!seen.insert(std::minmax(a,b)).second)continue;
   double length=std::hypot(number(flats[localA][0])-number(flats[localB][0]),number(flats[localA][1])-number(flats[localB][1]));
   if(length>1e-7)result.push_back({a,b,length});
  }
 }
 return result;
}
std::vector<double> positionsOf(const Json& payload){std::vector<double> p;for(const auto& particle:payload.at("particles"))for(auto v:particle.at("position"))p.push_back(number(v));return p;}
void projectDistance(std::vector<double>& p,const std::vector<double>& mass,int a,int b,double rest,double stiffness,double maxMove){
 double wa=mass[a],wb=mass[b],total=wa+wb;if(total<=0)return;int x=a*3,y=b*3;
 double dx=p[y]-p[x],dy=p[y+1]-p[x+1],dz=p[y+2]-p[x+2],d=std::hypot(dx,dy,dz);
 if(!(d>1e-10))return;double correction=std::clamp((d-rest)*stiffness,-maxMove/std::max(wa/total,wb/total),maxMove/std::max(wa/total,wb/total))/d;
 for(int k=0;k<3;k++){double delta=(k==0?dx:k==1?dy:dz)*correction;p[x+k]+=delta*wa/total;p[y+k]-=delta*wb/total;}
}
struct Group{std::string id;int count=0;double sum=0,max=0;std::set<std::string> pieces;};
Json pose(const Json& payload){
 auto p=positionsOf(payload);std::vector<Group> groups;std::map<std::string,size_t> lookup;
 double maxGap=0,totalGap=0;int seamCount=0;
 auto gap=[&](const std::string& id,double value,const std::string& a,const std::string& b){
  if(!lookup.count(id)){lookup[id]=groups.size();groups.push_back({id,0,0,0,{}});}
  auto& g=groups[lookup[id]];g.count++;g.sum+=value;g.max=std::max(g.max,value);g.pieces.insert(a);g.pieces.insert(b);
  maxGap=std::max(maxGap,value);totalGap+=value;seamCount++;
 };
 const auto& particles=payload.at("particles");
 for(const auto& seam:payload.at("constraints"))if(get(seam,"type")=="seam"){
  int a=idx(seam.at("a")),b=idx(seam.at("b"));if(a<0||b<0||a>=static_cast<int>(particles.size())||b>=static_cast<int>(particles.size()))throw std::runtime_error("Native sewing constraint references unknown particle");
  std::string id=get(seam,"seamId").is_string()?seam["seamId"].get<std::string>():"unnamed-seam";
  gap(id,dist(p,a,b)*1000,particles[a].value("pieceId",std::string()),particles[b].value("pieceId",std::string()));
 }
 for(const auto& seam:array(get(payload,"virtualSeams"))){
  auto weighted=[&](const char* ik,const char* wk){std::array<double,3> v{0,0,0};const auto& ids=seam.at(ik);const auto& weights=seam.at(wk);for(size_t i=0;i<ids.size();i++)for(int axis=0;axis<3;axis++)v[axis]+=p[idx(ids[i])*3+axis]*number(weights[i]);return v;};
  auto a=weighted("sourceIndices","sourceWeights"),b=weighted("targetIndices","targetWeights");double d=std::hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])*1000;
  int ai=idx(seam["sourceIndices"][0]),bi=idx(seam["targetIndices"][0]);std::string id=seam.value("seamId",std::string("unnamed-free-seam"));
  gap(id,d,particles[ai].value("pieceId",std::string()),particles[bi].value("pieceId",std::string()));
 }
 Json sorted=Json::array();for(const auto& g:groups){Json ids=Json::array();for(auto& s:g.pieces)ids.push_back(s);sorted.push_back({{"seamId",g.id},{"samples",g.count},{"maximumGapMm",rounding(g.max)},{"averageGapMm",rounding(g.sum/g.count)},{"pieceIds",ids}});}
 std::stable_sort(sorted.begin(),sorted.end(),[](const Json& a,const Json& b){return a["maximumGapMm"].get<double>()>b["maximumGapMm"].get<double>();});
 while(sorted.size()>10)sorted.erase(sorted.end()-1);
 double maxStrain=0;Json worst=nullptr;int edgeCount=0;std::set<std::pair<int,int>> seen;
 for(const auto& piece:payload.at("pieces")){
  auto& ids=piece.at("particleIndices");auto& flats=piece.at("flatVerticesM");
  for(const auto& face:piece.at("faces"))for(int i=0;i<3;i++){
   int a=idx(face[i]),b=idx(face[(i+1)%3]),ia=idx(ids[a]),ib=idx(ids[b]);
   if(!seen.insert(std::minmax(ia,ib)).second)continue;
   double rest=std::hypot(number(flats[a][0])-number(flats[b][0]),number(flats[a][1])-number(flats[b][1]),number(flats[a][2])-number(flats[b][2]));
   if(rest<=1e-8)continue;
   double world=dist(p,ia,ib),strain=std::abs(world-rest)/rest*100;edgeCount++;
   if(strain>maxStrain){maxStrain=strain;worst={{"pieceId",get(piece,"id")},{"particleA",get(particles[ia],"id")},{"particleB",get(particles[ib],"id")},{"restLengthMm",rounding(rest*1000)},{"startLengthMm",rounding(world*1000)}};}
  }
 }
 Json reasons=Json::array();if(maxGap>30)reasons.push_back("sewing-boundaries-too-far-apart");if(maxStrain>20)reasons.push_back("initial-mesh-distorted-relative-to-flat-pattern");
 return {{"status",reasons.empty()?"GEOMETRIC_PRECHECK_PASS":"STAGING_REQUIRES_REPAIR"},{"simulationFitApproved",false},{"reasons",reasons},{"pairCount",seamCount},{"totalRestEdges",edgeCount},{"initialSeamGapMaximumMm",rounding(maxGap)},{"initialSeamGapAverageMm",seamCount?rounding(totalGap/seamCount):0},{"initialMeshPeakEdgeStrainPercent",rounding(maxStrain)},{"worstEdge",worst},{"worstSewingGroups",sorted},{"thresholds",{{"maximumInitialSeamGapMm",30},{"maximumInitialEdgeStrainPercent",20}}}};
}
}
Json inspectStagedAvatarContact(const Json& payload,const Clearance& clearance){
 if(!clearance)throw std::runtime_error("inspectStagedAvatarContact requires an avatarClearance callback");
 int checked=0,penetrating=0;double maxIntrusion=0;const auto& particles=payload.at("particles");
 for(const auto& piece:payload.at("pieces")){
  const auto& flat=piece.at("flatVerticesM");const auto& ids=piece.at("particleIndices");
  double lo=INFINITY,hi=-INFINITY;for(const auto& v:flat){lo=std::min(lo,number(v[1]));hi=std::max(hi,number(v[1]));}double span=std::max(1e-7,hi-lo);
  std::map<int,Json> hints;
  auto check=[&](const Json& position,const Json& hint){double v=clearance(position,get(payload,"avatar"),hint);checked++;if(v<-.0005){penetrating++;maxIntrusion=std::max(maxIntrusion,-v*1000);}};
  for(size_t i=0;i<ids.size();i++){int id=idx(ids[i]);const auto& p=particles[id];Json hint={{"patternV",(number(flat[i][1])-lo)/span}};for(auto key:{"wrapMode","seamIds","collisionSideZ"})if(p.contains(key))hint[key]=p[key];hints[id]=hint;check(p.at("position"),hint);}
  for(const auto& face:piece.at("faces")){int a=idx(ids[idx(face[0])]),b=idx(ids[idx(face[1])]),c=idx(ids[idx(face[2])]);Json xyz=Json::array();for(int k=0;k<3;k++)xyz.push_back((number(particles[a]["position"][k])+number(particles[b]["position"][k])+number(particles[c]["position"][k]))/3);Json hint=hints[a];hint["patternV"]=(number(hints[a]["patternV"])+number(hints[b]["patternV"])+number(hints[c]["patternV"]))/3;check(xyz,hint);}
 }
 return {{"checked",checked},{"penetrating",penetrating},{"maximumIntrusionMm",rounding(maxIntrusion)},{"sampledAvatarClearanceOnly",true},{"sweptCollisionCertified",false}};
}
Json assembleNativeSeams(const Json& payload,const Json& options,const Clearance& clearance){
 if(flag(options,"contactConstrained")||flag(options,"jointConstraintMode"))throw std::runtime_error("Contact-constrained and joint modes require a supplied full avatar solver adapter");
 Json result=payload;const auto& particles=payload.at("particles");int n=particles.size();
 auto positions=positionsOf(payload),initial=positions;std::vector<double> mass;for(const auto& p:particles)mass.push_back(std::max(0.,number(get(p,"invMass"))));
 auto rest=edges(payload);std::vector<Edge> seams;for(const auto& c:payload.at("constraints"))if(get(c,"type")=="seam")seams.push_back({idx(c["a"]),idx(c["b"]),0});
 auto virtualSeams=array(get(payload,"virtualSeams"));
 int iterations=std::max(0,std::min(1000,static_cast<int>(std::floor(option(options,"iterations",90)))));
 double ss=option(options,"seamStiffness",.3),rs=option(options,"restStiffness",.7),ps=option(options,"positionStiffness",.002),maxMove=option(options,"maxMoveM",.012);
 int passes=std::max(0,static_cast<int>(std::ceil(option(options,"seamPasses",2))));
 for(int iteration=0;iteration<iterations;iteration++){
  bool reverse=iteration%2;
  for(int pass=0;pass<passes;pass++){
   for(size_t i=0;i<seams.size();i++){auto e=seams[reverse?seams.size()-1-i:i];projectDistance(positions,mass,e.a,e.b,0,ss,maxMove);}
   for(size_t j=0;j<virtualSeams.size();j++){
    auto seam=virtualSeams[reverse?virtualSeams.size()-1-j:j];
    std::array<double,3> a{0,0,0},b{0,0,0};std::map<int,double> gradients;
    for(auto side=0;side<2;side++){auto& inds=seam[side?"targetIndices":"sourceIndices"];auto& weights=seam[side?"targetWeights":"sourceWeights"];
     for(size_t i=0;i<inds.size();i++){int id=idx(inds[i]);double w=number(weights[i]);for(int k=0;k<3;k++)(side?b:a)[k]+=positions[id*3+k]*w;gradients[id]+=(side?-1:1)*w;}
    }
    double dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=std::hypot(dx,dy,dz);if(length<=1e-10)continue;
    double denom=0;for(auto [id,w]:gradients)denom+=mass[id]*w*w;if(denom<=1e-10)continue;
    double scalar=(length-option(seam,"rest",.008))/length*ss/denom;
    for(auto [id,g]:gradients){if(mass[id]<=0)continue;double raw=scalar*mass[id]*g,scale=std::min(1.,maxMove/std::max(1e-10,std::abs(raw)*length));positions[id*3]+=dx*raw*scale;positions[id*3+1]+=dy*raw*scale;positions[id*3+2]+=dz*raw*scale;}
   }
  }
  for(size_t i=0;i<rest.size();i++){auto e=rest[reverse?rest.size()-1-i:i];projectDistance(positions,mass,e.a,e.b,e.length,rs,maxMove);}
  if(ps>0)for(size_t i=0;i<positions.size();i++)if(mass[i/3]>0)positions[i]+=(initial[i]-positions[i])*ps;
 }
 for(int i=0;i<n;i++){Json p=Json::array();for(int k=0;k<3;k++){double value=positions[i*3+k];if(!std::isfinite(value))throw std::runtime_error("Seam assembly made invalid particle "+std::to_string(i));p.push_back(value);}result["particles"][i]["position"]=p;result["particles"][i]["previous"]=p;}
 Json before=pose(payload),after=pose(result),collision=inspectStagedAvatarContact(result,clearance);
 result["assemblyExperiment"]={{"algorithm","seam-aware-rest-edge-relaxation-v1"},{"iterations",iterations},{"input",before},{"output",after},{"collision",collision},{"contactConstrained",false},{"jointConstraintMode",false},{"seamGapImproved",number(after["initialSeamGapMaximumMm"])<number(before["initialSeamGapMaximumMm"])},{"restStrainImproved",number(after["initialMeshPeakEdgeStrainPercent"])<number(before["initialMeshPeakEdgeStrainPercent"])},{"collisionCertified",false},{"safeToAutoApply",false},{"enabledForProduction",false}};
 result["initialAssembly"]=after;return result;
}
}
