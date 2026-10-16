#include "native_backend_session.hpp"
#include <cassert>
#include <iostream>
using garment::Json;
int main(int argc,char** argv){
 if(argc>1&&std::string(argv[1])=="--json-lines"){
  std::string line;while(std::getline(std::cin,line))try{
   auto q=Json::parse(line),project=q.value("project",Json::object()),simulation=q.at("simulation"),payload=q.at("payload");
   auto session=garment::createNativeBackendSession(project,simulation,payload);
   auto baseline=session;
   Json adopted=nullptr,error=nullptr;
   try{adopted=garment::adoptNativeBackendResult(session,q.at("result"),q.value("elapsedMs",0.));}
   catch(const std::exception& e){error=e.what();}
   Json browser=garment::createBrowserBackendSession(project,q.at("browserSimulation"),q.value("request",Json::object()),q.value("protocolVersion",1));
   Json pieces=Json::object();for(auto it=q.at("browserSimulation").at("pieces").begin();it!=q.at("browserSimulation").at("pieces").end();++it)pieces[it.key()]=garment::browserBackendPieceState(browser,it.key());
   Json syncError=nullptr;try{garment::rejectSynchronousNativeStep();}catch(const std::exception& e){syncError=e.what();}
   std::cout<<Json{{"ok",true},{"session",session},{"adopted",adopted},{"error",error},{"sourceUnchanged",session==baseline},{"nativeStats",garment::nativeBackendStats(adopted.is_null()?session:adopted)},{"browserStats",garment::browserBackendStats(browser)},{"browserPieces",pieces},{"incremented",garment::incrementBrowserBackendFrame(browser)},{"disposed",garment::disposeNativeBackendSession(session)},{"browserDisposed",garment::disposeBrowserBackendSession(browser)},{"syncError",syncError}}.dump()<<'\n';
  }catch(const std::exception& e){std::cout<<Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
  return 0;
 }
 Json p={{"particles",Json::array({Json{{"position",Json::array({0,0,0})},{"previous",Json::array({0,0,0})}}})}};
 auto session=garment::createNativeBackendSession(Json::object(),p,p);
 const auto old=session;
 try{garment::adoptNativeBackendResult(session,Json{{"state",Json{{"particles",Json::array()}}}});assert(false);}catch(const std::runtime_error&){}
 assert(session==old);
 std::cout<<"native backend session tests passed\n";
}
