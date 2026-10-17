#include "assembled_cloth_snapshot.hpp"
#include "cloth_meshing_pipeline.hpp"
#include "cloth_seam_constraints.hpp"
#include <map>
#include <set>
#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <stdexcept>
namespace garment {
namespace {
double number(const Json& j,const char* key,double fallback){return j.is_object()&&j.contains(key)&&j[key].is_number()?j[key].get<double>():fallback;}
Json object(const Json& j,const char* key){return j.is_object()&&j.contains(key)&&j[key].is_object()?j[key]:Json::object();}
double clamp(double v,double a,double b){return std::clamp(v,a,b);}
Json clothEdges(const Json& project,const Json& mesh){
 Json output=Json::array();const Json simulation=object(project,"simulation"),fabrics=object(project,"fabrics");
 const Json defaultFabric=object(fabrics,"main");
 const double base=clamp(number(simulation,"stiffness",.9)==0?.9:number(simulation,"stiffness",.9),.55,.995);
 std::map<std::string,Json> authored;
 for(const auto& p:project.at("pieces"))authored[p.at("id").get<std::string>()]=p;
 std::map<std::string,std::pair<double,double>> fusion;
 for(const auto& p:project.at("pieces")){
  if(p.value("active3d",true)==false||!p.contains("fusedToPieceId")||!p["fusedToPieceId"].is_string()||p["fusedToPieceId"].get<std::string>().empty())continue;
  auto fabric=fabrics.contains(p.value("fabricId",std::string()))?object(fabrics,p.value("fabricId",std::string()).c_str()):Json::object();
  double stretch=(number(fabric,"stretchWarp",.04)+number(fabric,"stretchWeft",.04))*.5,bend=number(fabric,"bend",.7);
  double structural=1+clamp((.08-stretch)*.6+(bend-.5)*.05,.025,.10),bending=1+clamp((bend-.5)*.35+number(fabric,"gsm",50)/1000*.2,.08,.28);
  auto& pair=fusion[p["fusedToPieceId"].get<std::string>()];if(pair.first==0)pair={1,1};
  pair.first=std::min(1.15,pair.first*structural);pair.second=std::min(1.4,pair.second*bending);
 }
 for(const auto& piece:mesh.at("pieces")){
  const auto id=piece.at("id").get<std::string>();const Json source=authored.at(id);
  auto fabric=defaultFabric;const auto fid=source.value("fabricId",std::string("main"));if(fabrics.contains(fid)&&fabrics[fid].is_object())fabric=fabrics[fid];
  const bool strengthening=source.value("strengthened",false);
  const auto factor=fusion.count(id)?fusion.at(id):std::make_pair(1.,1.);
  const double structural=std::min(.997,base*(strengthening?1.06:1.)*factor.first);
  const double bend=clamp((.10+number(fabric,"bend",.65)*.65)*(strengthening?1.22:1.)*factor.second,.08,.92);
  const double angle=number(source,"grainAngleDeg",0)*3.14159265358979323846/180;
  const double warpX=std::sin(angle),warpY=std::cos(angle),weftX=std::cos(angle),weftY=-std::sin(angle);
  const auto& points=piece.at("flatVertices");
  std::set<std::pair<size_t,size_t>> seen;
  std::map<std::pair<size_t,size_t>,std::vector<size_t>> opposites;
  std::vector<std::pair<size_t,size_t>> insertionOrder;
  auto key=[](size_t a,size_t b){return std::make_pair(std::min(a,b),std::max(a,b));};
  auto distance=[&](size_t a,size_t b){return std::hypot(number(points[a],"x",0)-number(points[b],"x",0),number(points[a],"y",0)-number(points[b],"y",0));};
  for(const auto& face:piece.at("faces")){
   size_t a=face[0].get<size_t>(),b=face[1].get<size_t>(),c=face[2].get<size_t>();
   for(auto reg:std::array<std::array<size_t,3>,3>{{{{a,b,c}},{{b,c,a}},{{c,a,b}}}}){auto k=key(reg[0],reg[1]);if(!opposites.count(k))insertionOrder.push_back(k);opposites[k].push_back(reg[2]);}
   for(auto edge:std::array<std::array<size_t,2>,3>{{{{a,b}},{{b,c}},{{c,a}}}}){
    size_t l=edge[0],r=edge[1];if(!seen.insert(key(l,r)).second)continue;
    double dx=number(points[r],"x",0)-number(points[l],"x",0),dy=number(points[r],"y",0)-number(points[l],"y",0);
    double length=std::hypot(dx,dy);if(length==0)length=1;
    double warp=std::abs(dx/length*warpX+dy/length*warpY),weft=std::abs(dx/length*weftX+dy/length*weftY);
    double stretch=warp*warp*std::max(0.,number(fabric,"stretchWarp",.05))+weft*weft*std::max(0.,number(fabric,"stretchWeft",.05));
    double shrink=warp*warp*number(fabric,"shrinkWarp",0)+weft*weft*number(fabric,"shrinkWeft",0);
    output.push_back({{"type","structural"},{"pieceId",id},{"aIndex",l},{"bIndex",r},
      {"rest",distance(l,r)*.01*clamp(1-shrink,.65,1.35)},
      {"stiffness",clamp(structural*(1-stretch*.55),.42,.997)},{"warpWeight",warp},{"weftWeight",weft}});
   }
  }
  for(const auto& k:insertionOrder){const auto& opposite=opposites.at(k);if(opposite.size()!=2||opposite[0]==opposite[1])continue;
   output.push_back({{"type","bend"},{"pieceId",id},{"aIndex",opposite[0]},{"bIndex",opposite[1]},
     {"rest",distance(opposite[0],opposite[1])*.01},{"stiffness",bend}});
  }
  const auto& boundaries=piece.at("boundaryIndices");
  auto indicesFor=[&](const Json& entry)->Json{
   int idx=(int)number(entry,"edgeIndex",-1);
   return idx>=0&&idx<(int)boundaries.size()?boundaries[idx]:Json::array();
  };
  auto reinforce=[&](const Json& edge,double stiffness,const std::string& type,const std::string& idValue,double ratio=1.){
   auto indices=indicesFor(edge);
   for(size_t i=1;i<indices.size();i++){
    size_t a=indices[i-1].get<size_t>(),b=indices[i].get<size_t>();if(a==b)continue;
    double rest=distance(a,b)*.01;if(rest<=1e-8)continue;
    Json c={{"type",type},{"pieceId",id},{"aIndex",a},{"bIndex",b},
      {"rest",rest*ratio},{"stiffness",stiffness}};
    if(type=="edge-treatment"){c["seamId"]=idValue;c["ratio"]=ratio;}
    else c["trimId"]=idValue;
    output.push_back(c);
   }
  };
  auto arrayField=[&](const char* field){return source.contains(field)&&source[field].is_array()?source[field]:Json::array();};
  for(const auto& stitch:arrayField("topstitches")){
   double rows=number(stitch,"rows",1);if(rows==0)rows=1;
   reinforce(stitch,clamp(.48+clamp(rows,1,3)*.08,.1,.995),"topstitch",stitch.value("id",std::string()));
  }
  for(const auto& zipper:arrayField("zippers"))reinforce(zipper,.91,"zipper-tape",zipper.value("id",std::string()));
  for(const auto& binding:arrayField("bindings")){
   reinforce(binding,clamp(number(binding,"stiffness",.72),.4,.96),"edge-treatment",
     binding.value("id",std::string()),clamp(number(binding,"ratio",.96),.6,1.1));
  }
 }
 return output;
}
}
Json buildAssembledClothSnapshot(const Json& project){
 const Json mesh=buildClothMeshingPipeline(project);
 const Json seam=buildClothSeamConstraints(project,mesh);
 Json pieces=Json::array(),particles=Json::array(),faces=Json::array(),flat=Json::array();
 std::map<std::string,size_t> offsets;
 for(const auto& piece:mesh.at("pieces")){
  const std::string id=piece.at("id").get<std::string>();
  if(!offsets.emplace(id,particles.size()).second)throw std::invalid_argument("duplicate active piece id: "+id);
  const size_t offset=particles.size();
  for(size_t i=0;i<piece.at("positions").size();++i){
   particles.push_back({{"id",id+":"+std::to_string(i)},{"pieceId",id},{"localIndex",i},{"simIndex",offset+i},{"position",piece.at("positions")[i]}});
   flat.push_back({{"pieceId",id},{"localIndex",i},{"point",piece.at("flatVertices")[i]}});
  }
  for(const auto& f:piece.at("faces"))faces.push_back(Json::array({offset+f[0].get<size_t>(),offset+f[1].get<size_t>(),offset+f[2].get<size_t>()}));
  pieces.push_back({{"id",id},{"particleOffset",offset},{"particleCount",piece.at("positions").size()},{"faces",piece.at("faces")},{"flatVertices",piece.at("flatVertices")},{"positions",piece.at("positions")},{"boundaryIndices",piece.at("boundaryIndices")}});
 }
 Json seams=seam.at("seamConstraints"),anchors=seam.at("anchorConstraints"),cloth=clothEdges(project,mesh);
 for(auto& c:cloth)c["aSimIndex"]=offsets.at(c.at("pieceId").get<std::string>())+c.at("aIndex").get<size_t>(),c["bSimIndex"]=offsets.at(c.at("pieceId").get<std::string>())+c.at("bIndex").get<size_t>();
 for(auto& c:seams){
  const auto a=offsets.find(c.at("aPieceId").get<std::string>()),b=offsets.find(c.at("bPieceId").get<std::string>());
  if(a==offsets.end()||b==offsets.end())throw std::runtime_error("seam references inactive piece");
  c["aSimIndex"]=a->second+c.at("aIndex").get<size_t>();c["bSimIndex"]=b->second+c.at("bIndex").get<size_t>();
 }
 for(auto& a:anchors){
  const auto it=offsets.find(a.at("pieceId").get<std::string>());
  if(it==offsets.end())throw std::runtime_error("anchor references inactive piece");
  a["simIndex"]=it->second+a.at("particleIndex").get<size_t>();
 }
 Json unsupported=seam.value("unported",Json::array());
 unsupported.push_back("solver particle attributes and material mass");
 unsupported.push_back("collision exclusions, attachments and runtime state");
 bool manualPins=false;
 for(const auto& p:project.at("pieces"))if(p.contains("pins")&&p["pins"].is_array()&&!p["pins"].empty())manualPins=true;
 if(manualPins)unsupported.push_back("authored manual pins present: targets not compiled");
 return {{"pieces",pieces},{"particles",particles},{"faces",faces},{"flatVertices",flat},
  {"clothConstraints",cloth},{"seamConstraints",seams},{"anchorConstraints",anchors},{"seamEndpoints",seam.at("seamEndpoints")},
  {"unsupportedSeams",seam.at("unsupportedSeams")},{"manualPinsUnsupported",manualPins},
  {"particleCount",particles.size()},{"faceCount",faces.size()},
  {"simulationSettings",project.value("simulation",Json::object())},
  {"unported",unsupported},{"fullSolverParity",false}};
}
}
