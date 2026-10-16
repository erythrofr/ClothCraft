#include "simulation_protocol.hpp"
#include <cmath>
#include <chrono>
#include <set>
#include <sstream>
namespace garment {
namespace {
Json get(const Json& a,const char* key){return a.is_object()&&a.contains(key)?a[key]:Json();}
bool truthy(const Json& j){return !j.is_null()&&j!=false&&j!=0&&j!="";}
Json fallback(const Json& j,const Json& other){return truthy(j)?j:other;}
double number(const Json& j,double otherwise=0){if(j.is_null())return 0;if(j.is_boolean())return j.get<bool>()?1:0;if(j.is_number())return j.get<double>();if(j.is_string()){try{auto s=j.get<std::string>();if(s.empty())return 0;size_t n=0;double x=std::stod(s,&n);return n==s.size()?x:NAN;}catch(...){return NAN;}}return otherwise;}
double finite(const Json& j,double otherwise=0){if(j.is_null())return otherwise;double v=number(j);return std::isfinite(v)?v:otherwise;}
double finiteField(const Json& obj,const char* key,double otherwise=0){return obj.is_object()&&obj.contains(key)?(std::isfinite(number(obj[key]))?number(obj[key]):otherwise):otherwise;}
double rounded(double x){return std::floor(x+0.5);}
Json array(const Json& a){return a.is_array()?a:Json::array();}
Json object(const Json& a){return a.is_object()?a:Json::object();}
std::string display(const Json& j){if(j.is_null())return "undefined";if(j.is_string())return j.get<std::string>();return j.dump();}
Json normalizedFabric(const std::string& id,const Json& f){
 return Json{{"id",id},{"name",fallback(get(f,"name"),id)},{"densityGsm",finite(get(f,"gsm"),180)},{"thicknessM",std::max(.0001,finite(get(f,"thickness"),.002))},
 {"stretchWarp",std::max(0.,finite(get(f,"stretchWarp"),.08))},{"stretchWeft",std::max(0.,finite(get(f,"stretchWeft"),.12))},
 {"shrinkWarp",std::max(0.,finite(get(f,"shrinkWarp")))},{"shrinkWeft",std::max(0.,finite(get(f,"shrinkWeft")))},
 {"bend",std::max(0.,finiteField(f,"bend",.65))},{"damping",std::max(0.,finiteField(f,"damping",.985))},{"friction",std::max(0.,finiteField(f,"friction",.35))}};
}
Json normalizedPiece(const Json& p){
 Json points=array(get(p,"points")),curves=object(get(p,"curves"));Json pointsCm=Json::array(),boundary=Json::array();
 for(const auto& point:points)pointsCm.push_back(Json::array({finite(get(point,"x")),finite(get(point,"y"))}));
 for(size_t i=0;i<points.size();i++){
  Json a=points[i],b=points[(i+1)%points.size()],curve=get(curves,std::to_string(i).c_str());
  if(!truthy(curve)){boundary.push_back(Json::array({finite(get(a,"x")),finite(get(a,"y"))}));continue;}
  for(int s=0;s<12;s++){double t=double(s)/12,u=1-t;double x=u*u*number(get(a,"x"))+2*u*t*number(get(curve,"cx"))+t*t*number(get(b,"x")),y=u*u*number(get(a,"y"))+2*u*t*number(get(curve,"cy"))+t*t*number(get(b,"y"));boundary.push_back(Json::array({std::isfinite(x)?x:0,std::isfinite(y)?y:0}));}
 }
 return Json{{"id",get(p,"id")},{"name",fallback(get(p,"name"),get(p,"id"))},{"fabricId",fallback(get(p,"fabricId"),"main")},
 {"layerIndex",rounded(finite(get(p,"layerIndex")))},{"cutQuantity",std::max(1.,rounded(finite(get(p,"cutQuantity"),1)))},
 {"simulationResolution",std::max(0.,std::min(3.,rounded(finite(get(p,"simulationResolution"),1))))},
 {"strengthened",truthy(get(p,"strengthened"))},{"locked",truthy(get(p,"locked"))},{"arrangement3d",fallback(get(p,"arrangement3d"),Json::object())},
 {"pattern",{{"pointsCm",pointsCm},{"boundaryCm",boundary},{"curves",curves},{"internalLines",fallback(get(p,"internalLines"),Json::array())},{"grainAngleDeg",finite(get(p,"grainAngleDeg"))}}},
 {"attachments",{{"pins",fallback(get(p,"pins"),Json::array())},{"surface",fallback(get(p,"surfaceAttachments"),Json::array())},{"fusedToPieceId",fallback(get(p,"fusedToPieceId"),Json(nullptr))},{"fuseStiffness",finite(get(p,"fuseStiffness"),.985)},{"fuseGapM",finite(get(p,"fuseGapM"),.001)}}}};
}
Json normalizedSeam(const Json& s){
 auto nullable=[&](const char* k,double def){Json v=get(s,k);return v.is_null()?Json(nullptr):Json(finite(v,def));};
 return Json{{"id",get(s,"id")},{"name",fallback(get(s,"name"),get(s,"id"))},{"type",fallback(get(s,"type"),"normal")},{"a",fallback(get(s,"a"),Json::object())},{"b",fallback(get(s,"b"),Json::object())},{"reverseB",truthy(get(s,"reverseB"))},{"ratio",finite(get(s,"ratio"),1)},{"easeSide",fallback(get(s,"easeSide"),Json(nullptr))},{"gatherSide",fallback(get(s,"gatherSide"),Json(nullptr))},{"elasticRatio",nullable("elasticRatio",1)},{"openFraction",nullable("openFraction",0)},{"junctionScale",nullable("junctionScale",1)}};
}
}
Json buildSimulationRequest(const Json& project,const Json& options){
 Json fabrics=Json::object(),parts=Json::array(),seams=Json::array();
 Json sources=object(get(project,"fabrics"));for(auto it=sources.begin();it!=sources.end();++it)fabrics[it.key()]=normalizedFabric(it.key(),it.value());
 for(const auto& p:array(get(project,"pieces")))parts.push_back(normalizedPiece(p));
 for(const auto& s:array(get(project,"seams")))seams.push_back(normalizedSeam(s));
 Json id=fallback(get(options,"requestId"),Json(nullptr));
 if(id.is_null()){auto now=std::chrono::system_clock::now().time_since_epoch();id="sim-"+std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(now).count());}
 return Json{{"protocol",SIMULATION_PROTOCOL},{"version",SIMULATION_PROTOCOL_VERSION},{"requestId",id},
 {"project",{{"id",fallback(get(project,"id"),Json(nullptr))},{"name",fallback(get(project,"name"),"Untitled Garment")},{"revision",finite(get(project,"revision"),1)},{"units","cm"}}},
 {"avatar",fallback(get(project,"avatar"),Json::object())},{"fabrics",fabrics},{"pieces",parts},{"seams",seams},
 {"fasteners",fallback(get(project,"fasteners"),Json::array())},{"settings",fallback(get(project,"simulation"),Json::object())},
 {"requestedOutputs",fallback(get(options,"requestedOutputs"),Json::array({"positions","normals","strain","contact"}))}};
}
Json validateSimulationRequest(const Json& request){
 Json errors=Json::array();
 if(get(request,"protocol")!=SIMULATION_PROTOCOL)errors.push_back(std::string("protocol must be ")+SIMULATION_PROTOCOL);
 if(number(get(request,"version"))!=SIMULATION_PROTOCOL_VERSION)errors.push_back("version must be 1");
 Json pieces=get(request,"pieces");if(!pieces.is_array()||pieces.empty())errors.push_back("pieces must contain at least one pattern piece");
 std::set<std::string> ids;
 for(const auto& piece:array(pieces)){
  Json id=get(piece,"id");if(!truthy(id))errors.push_back("every piece requires an id");
  std::string key=id.dump();if(ids.count(key))errors.push_back("duplicate piece id: "+display(id));ids.insert(key);
  Json shape=get(get(piece,"pattern"),"pointsCm");if(!shape.is_array()||shape.size()<3)errors.push_back(display(fallback(id,"piece"))+" requires at least 3 pattern points");
 }
 for(const auto& seam:array(get(request,"seams"))){
  Json id=fallback(get(seam,"id"),"seam"),a=get(get(seam,"a"),"pieceId"),b=get(get(seam,"b"),"pieceId");
  if(!ids.count(a.dump()))errors.push_back(display(id)+" references missing piece "+display(a));
  if(!ids.count(b.dump()))errors.push_back(display(id)+" references missing piece "+display(b));
 }
 return Json{{"ok",errors.empty()},{"errors",errors}};
}
std::string serializeSimulationRequest(const Json& request){
 Json valid=validateSimulationRequest(request);if(!valid["ok"].get<bool>()){std::string message="Invalid simulation request: ";for(size_t i=0;i<valid["errors"].size();i++){if(i)message+="; ";message+=valid["errors"][i].get<std::string>();}throw std::runtime_error(message);}
 return request.dump(2);
}
Json backendResultSummary(const Json& result){
 Json pieces=get(result,"pieces");size_t count=pieces.is_array()?pieces.size():0;
 return Json{{"backendId",fallback(get(result,"backendId"),"unknown")},{"protocolVersion",number(fallback(get(result,"protocolVersion"),SIMULATION_PROTOCOL_VERSION))},
 {"pieceCount",count},{"frame",number(fallback(get(result,"frame"),0))},{"stats",fallback(get(result,"stats"),Json::object())}};
}
}
