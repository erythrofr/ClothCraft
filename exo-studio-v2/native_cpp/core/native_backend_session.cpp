#include "native_backend_session.hpp"
#include "native_solver_acceptance.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace garment {
namespace {
Json get(const Json& j,const char* field,Json fallback=nullptr){return j.is_object()&&j.contains(field)?j.at(field):fallback;}
double num(const Json& x,double fallback=0){if(x.is_number())return x.get<double>();if(x.is_null())return 0;if(x.is_boolean())return x.get<bool>()?1:0;if(x.is_string())try{return std::stod(x.get<std::string>());}catch(...){}return fallback;}
Json particles(const Json& j){return get(j,"particles",Json::array());}
void validate(const Json& state,size_t count){
 if(!state.is_array()||state.size()!=count)throw std::runtime_error("Native state particle count mismatch: expected "+std::to_string(count)+", got "+std::to_string(state.is_array()?state.size():0));
 for(size_t i=0;i<count;++i)for(const char* key:{"position","previous"}){
  auto v=get(state[i],key);
  if(!v.is_array()||v.size()!=3||!std::all_of(v.begin(),v.end(),[](const Json& x){return x.is_number()&&std::isfinite(x.get<double>());}))
   throw std::runtime_error("Native state "+std::string(key)+"["+std::to_string(i)+"] must contain three finite coordinates");
 }
}
}
Json createNativeBackendSession(const Json& project,const Json& simulation,const Json& payload){
 const auto refs=particles(simulation),native=particles(payload);
 if(refs.size()!=native.size())throw std::runtime_error("Native topology mismatch: browser "+std::to_string(refs.size())+", payload "+std::to_string(native.size()));
 const auto settings=get(project,"simulation",Json::object());
 return Json{{"backendId","native-xpbd"},{"project",project},{"simulation",simulation},{"payload",payload},{"initialAssembly",get(payload,"initialAssembly")},{"particleRefs",refs},{"frame",0},{"pending",nullptr},{"failedUntil",0},{"lastError",nullptr},{"lastResult",nullptr},{"lastElapsedMs",0},{"serviceUrl",get(settings,"nativeServiceUrl","http://127.0.0.1:5191")},{"disposed",false},{"abortController",Json{{"aborted",false}}}};
}
Json createBrowserBackendSession(const Json& project,const Json& simulation,const Json& request,const Json& protocolVersion){return Json{{"backendId","browser-pbd"},{"protocolVersion",protocolVersion},{"project",project},{"request",request},{"simulation",simulation},{"frame",0}};}
Json adoptNativeBackendResult(const Json& session,const Json& result,double elapsedMs){
 if(get(session,"disposed",false)==true)return session;
 if(get(get(result,"stats"),"finite") == false)throw std::runtime_error("Native XPBD result is nonfinite; garment pose was not applied");
 const auto state=get(get(result,"state"),"particles");
 const auto payload=get(session,"payload"),refs=get(session,"particleRefs");
 const auto pp=particles(payload),rp=refs;
 validate(state,pp.size());validate(state,rp.size());
 Json next=session;
 for(size_t i=0;i<state.size();++i){
  next["payload"]["particles"][i]["position"]=state[i]["position"];
  next["payload"]["particles"][i]["previous"]=state[i]["previous"];
  next["particleRefs"][i]["position"]=state[i]["position"];
  next["particleRefs"][i]["previous"]=state[i]["previous"];
  next["particleRefs"][i]["contactDepth"]=std::max(0.,num(get(state[i],"contactDepth",0)));
 }
 // Optional ordered piece topology supplied by the host snapshot adapter.
 if(next["simulation"].is_object()&&next["simulation"].contains("pieceOrder")&&next["simulation"].contains("pieces")){
  const auto order=next["simulation"]["pieceOrder"];
  auto& pieces=next["simulation"]["pieces"];
  if(order.is_array()&&pieces.is_object()){
   size_t offset=0;
   for(const auto& idValue:order){
    if(!idValue.is_string()||!pieces.contains(idValue.get<std::string>()))throw std::invalid_argument("Invalid native simulation piece order");
    auto& piece=pieces[idValue.get<std::string>()];
    if(!piece.contains("particles")||!piece["particles"].is_array()||offset+piece["particles"].size()>state.size())throw std::invalid_argument("Invalid native simulation piece particles");
    for(auto& p:piece["particles"]){p["position"]=state[offset]["position"];p["previous"]=state[offset]["previous"];p["contactDepth"]=std::max(0.,num(get(state[offset],"contactDepth",0)));++offset;}
   }
   if(offset!=state.size())throw std::invalid_argument("Native simulation pieces do not cover all particles");
  }
 }
 next["frame"]=num(get(session,"frame"))+num(get(result,"frames"));
 next["simulation"]["elapsed"]=num(next["frame"])/60.;
 next["lastResult"]=result;
 next["lastElapsedMs"]=elapsedMs!=0?elapsedMs:num(get(result,"runtimeMs"));
 next["lastError"]=nullptr;
 return next;
}
Json nativeBackendStats(const Json& s){const auto result=get(s,"lastResult");return Json{{"frame",get(s,"frame",0)},{"elapsedMs",get(s,"lastElapsedMs",0)},{"serviceError",get(get(s,"lastError"),"message")},{"native",get(result,"stats")},{"initialAssembly",get(s,"initialAssembly")},{"fitAssessment",result.is_null()?Json(nullptr):assessNativeSolverResult(result)}};}
Json browserBackendStats(const Json& s){const auto sim=get(s,"simulation");return Json{{"frame",get(s,"frame",0)},{"pieces",get(sim,"pieces",Json::object()).size()},{"constraints",get(sim,"constraints",Json::array()).size()},{"seamConstraints",get(sim,"seamConstraints",Json::array()).size()},{"anchors",get(sim,"anchorConstraints",Json::array()).size()},{"fuseConstraints",get(sim,"fuseConstraints",Json::array()).size()},{"strain",get(sim,"strain",Json::object())}};}
Json browserBackendPieceState(const Json& session,const std::string& id){
 const auto pieces=get(get(session,"simulation"),"pieces",Json::object());
 if(!pieces.is_object()||!pieces.contains(id))return nullptr;
 const auto piece=pieces.at(id);Json vertices=Json::array(),contact=Json::array();
 for(const auto& p:particles(piece)){vertices.push_back(p.at("position"));contact.push_back(num(get(p,"contactDepth")));}
 return Json{{"id",id},{"vertices",vertices},{"faces",get(piece,"faces",Json::array())},{"contact",contact}};
}
Json incrementBrowserBackendFrame(const Json& s){Json next=s;next["frame"]=num(get(s,"frame"))+1;return next;}
Json disposeNativeBackendSession(const Json& s){Json next=s;if(get(s,"disposed",false)==true)return s;next["disposed"]=true;next["abortController"]["aborted"]=true;next["pending"]=nullptr;return next;}
Json disposeBrowserBackendSession(const Json& s){return s;}
void rejectSynchronousNativeStep(){throw std::runtime_error("Native XPBD requires asynchronous stepAsync(); a synchronous step would silently skip cloth physics");}
Json nativeBackendHttpRequest(const Json& s,int frames){if(frames<0)throw std::invalid_argument("Invalid frames");return Json{{"baseUrl",get(s,"serviceUrl")},{"frames",frames},{"payload",get(s,"payload")},{"method","POST"},{"transport","external-localhost"}};}
}
