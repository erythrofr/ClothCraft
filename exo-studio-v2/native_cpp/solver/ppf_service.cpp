#include "ppf_service.hpp"
#include "ppf_bridge.hpp"
#include <curl/curl.h>
#include <memory>
#include <stdexcept>
#include <cctype>
namespace garment {
namespace {
struct Reply {std::string text; bool oversized=false;};
size_t receive(char* data,size_t size,size_t count,void* opaque) {
  auto& reply=*static_cast<Reply*>(opaque);
  // curl supplies size==1; guard multiplication regardless.
  if (size && count>16*1024*1024/size) {reply.oversized=true;return 0;}
  const auto bytes=size*count;
  if(bytes>16*1024*1024-reply.text.size()) {reply.oversized=true;return 0;}
  try {reply.text.append(data,bytes);} catch(...) {return 0;}
  return bytes;
}
struct CurlRuntime {
  CurlRuntime(){if(curl_global_init(CURL_GLOBAL_DEFAULT)!=CURLE_OK) throw std::runtime_error("curl initialization failed");}
  ~CurlRuntime(){curl_global_cleanup();}
};
}
PpfService::Json PpfService::request(const std::string& path,const Json* body) {
  static CurlRuntime runtime;
  std::unique_ptr<CURL,decltype(&curl_easy_cleanup)> handle(curl_easy_init(),curl_easy_cleanup);
  if(!handle) throw std::runtime_error("PPF HTTP client unavailable");
  const std::string url=std::string(PpfBridge::kServiceUrl)+path;
  Reply reply;
  curl_easy_setopt(handle.get(),CURLOPT_URL,url.c_str());
  curl_easy_setopt(handle.get(),CURLOPT_PROXY,"");
  curl_easy_setopt(handle.get(),CURLOPT_FOLLOWLOCATION,0L);
  curl_easy_setopt(handle.get(),CURLOPT_NOSIGNAL,1L);
  curl_easy_setopt(handle.get(),CURLOPT_CONNECTTIMEOUT_MS,2000L);
  curl_easy_setopt(handle.get(),CURLOPT_TIMEOUT_MS,15000L);
  curl_easy_setopt(handle.get(),CURLOPT_WRITEFUNCTION,receive);
  curl_easy_setopt(handle.get(),CURLOPT_WRITEDATA,&reply);
  std::string encoded;
  std::unique_ptr<curl_slist,decltype(&curl_slist_free_all)> headers(nullptr,curl_slist_free_all);
  if(body) {
    encoded=body->dump();
    headers.reset(curl_slist_append(nullptr,"Content-Type: application/json"));
    if(!headers) throw std::runtime_error("PPF request headers unavailable");
    curl_easy_setopt(handle.get(),CURLOPT_HTTPHEADER,headers.get());
    curl_easy_setopt(handle.get(),CURLOPT_POSTFIELDS,encoded.c_str());
    curl_easy_setopt(handle.get(),CURLOPT_POSTFIELDSIZE_LARGE,static_cast<curl_off_t>(encoded.size()));
  }
  const auto status=curl_easy_perform(handle.get());
  if(status!=CURLE_OK) throw std::runtime_error(reply.oversized ? "PPF response exceeds 16 MiB" :
    std::string(body ? "PPF submission transport failed; outcome unknown, inspect jobs before retry: " : "PPF service unavailable: ")+curl_easy_strerror(status));
  long code=0;curl_easy_getinfo(handle.get(),CURLINFO_RESPONSE_CODE,&code);
  if(code<200 || code>=300) throw std::runtime_error("PPF HTTP status "+std::to_string(code));
  auto result=Json::parse(reply.text);
  if(!result.is_object()) throw std::runtime_error("PPF response must be a JSON object");
  return result;
}
PpfService::Json PpfService::health(){return request("/health");}
PpfService::Json PpfService::submit(const Json& project,int frames) {
  const auto envelope=PpfBridge::makeJobEnvelope(project,frames);
  const auto state=health();
  if(state.value("backendId","")!="ppf-metal-final" || state.value("ok",false)!=true ||
     state.value("ready",false)!=true || state.value("busy",true)!=false)
    throw std::runtime_error("PPF backend not ready or busy; no job submitted");
  // Never automatically retry a POST: a lost reply may still have created it.
  return request("/jobs",&envelope);
}
void PpfService::validateId(const std::string& id) {
  if(id.empty() || id.size()>128) throw std::invalid_argument("Invalid PPF job ID");
  for(unsigned char c:id) if(!std::isalnum(c) && c!='-' && c!='_') throw std::invalid_argument("Invalid PPF job ID");
}
PpfService::Json PpfService::jobs(){return request("/jobs");}
PpfService::Json PpfService::job(const std::string& id) {
  validateId(id);
  return request("/jobs/"+id);
}
PpfService::Json PpfService::validatedPreview(const std::string& id) {
  validateId(id);
  // The service refuses incomplete or physically rejected trajectories.
  return request("/jobs/"+id+"/preview?validatedOnly=true");
}
}
