#include "native_service_client.hpp"
#include <curl/curl.h>
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace garment::native_service_client {
namespace {
Json field(const Json& o,const char* key,const Json& fallback=nullptr){return o.is_object()&&o.contains(key)&&!o[key].is_null()?o[key]:fallback;}
std::string url(const Json& options){
 auto requested=field(options,"baseUrl",DEFAULT_NATIVE_SERVICE_URL);
 if(!requested.is_string())throw std::invalid_argument("Native service URL must be a string");
 std::string out=requested.get<std::string>();while(!out.empty()&&out.back()=='/')out.pop_back();
 if(out.empty())out=DEFAULT_NATIVE_SERVICE_URL;
 const bool local=out.rfind("http://127.0.0.1:",0)==0||out=="http://127.0.0.1"||out.rfind("http://localhost:",0)==0||out=="http://localhost"||out.rfind("http://[::1]:",0)==0;
 if(!local&&field(options,"allowRemote")!=true)throw std::invalid_argument("Remote native solver URLs require explicit allowRemote=true");
 if(out.find('?')!=std::string::npos||out.find('#')!=std::string::npos||out.find('@')!=std::string::npos)throw std::invalid_argument("Native service URL cannot contain query, fragment, or credentials");
 if(out.rfind("http://",0)!=0&&out.rfind("https://",0)!=0)throw std::invalid_argument("Native service requires HTTP(S)");
 return out;
}
size_t writer(char* data,size_t sz,size_t n,void* context){static_cast<std::string*>(context)->append(data,sz*n);return sz*n;}
Json call(const char* route,const Json& options,const Json* request,const char* failure){
 std::string endpoint=url(options)+route,content;
 CURL* curl=curl_easy_init();if(!curl)throw std::runtime_error("Unable to initialize native HTTP transport");
 struct curl_slist* headers=nullptr;
 std::string body=request?request->dump():"";
 curl_easy_setopt(curl,CURLOPT_URL,endpoint.c_str());curl_easy_setopt(curl,CURLOPT_WRITEFUNCTION,writer);
 curl_easy_setopt(curl,CURLOPT_WRITEDATA,&content);curl_easy_setopt(curl,CURLOPT_CONNECTTIMEOUT_MS,1500L);
 curl_easy_setopt(curl,CURLOPT_TIMEOUT_MS,options.value("timeoutMs",10000L));
 curl_easy_setopt(curl,CURLOPT_FOLLOWLOCATION,0L);curl_easy_setopt(curl,CURLOPT_NOSIGNAL,1L);
 if(request){headers=curl_slist_append(headers,"Content-Type: application/json");curl_easy_setopt(curl,CURLOPT_HTTPHEADER,headers);curl_easy_setopt(curl,CURLOPT_POST,1L);curl_easy_setopt(curl,CURLOPT_POSTFIELDS,body.c_str());curl_easy_setopt(curl,CURLOPT_POSTFIELDSIZE,(long)body.size());}
 const auto status=curl_easy_perform(curl);long code=0;curl_easy_getinfo(curl,CURLINFO_RESPONSE_CODE,&code);
 curl_slist_free_all(headers);curl_easy_cleanup(curl);
 if(status!=CURLE_OK)throw std::runtime_error(std::string("Native transport failed: ")+curl_easy_strerror(status));
 Json result;try{result=Json::parse(content);}catch(...){throw std::runtime_error("Native service returned invalid JSON");}
 if(code<200||code>=300||field(result,"ok")!=true){auto error=field(result,"error");throw std::runtime_error(error.is_string()&&!error.get<std::string>().empty()?error.get<std::string>():std::string(failure)+" ("+std::to_string(code)+")");}
 return result;
}
Json wrapped(const Json& response){auto result=field(response,"result",Json::object());if(result==false||result==0||result=="")result=Json::object();
 auto runtime=field(result,"runtimeMs",0);double elapsed=0;if(runtime.is_number())elapsed=runtime.get<double>();else if(runtime.is_string()){try{elapsed=std::stod(runtime.get<std::string>());}catch(...){elapsed=NAN;}}
 return {{"result",result},{"elapsedMs",std::isfinite(elapsed)?Json(elapsed):Json(nullptr)},{"payload",field(result,"request",Json::object())}};
}
}
Json getNativeBackendHealth(const Json& options){return call("/health",options,nullptr,"Native backend unavailable");}
Json getNativeServiceHealth(const Json& options){return getNativeBackendHealth(options);}
Json runNativeBackend(const Json& project,const Json& options){Json request={{"project",project},{"frames",field(options,"frames",90)},{"quality",field(options,"quality","quality")}};
 // JS runNativeBackend always uses its global base URL, not options.baseUrl.
 Json transport=options;transport.erase("baseUrl");return field(call("/simulate",transport,&request,"Native simulation failed"),"result");}
Json solveWithNativeService(const Json& project,const Json& options){Json request={{"project",project},{"frames",field(options,"frames",60)},{"quality",field(options,"quality","quality")},{"experimentalSewFirst",field(options,"experimentalSewFirst",false)}};
 for(const char* optional:{"clothModel","bendingModel"})if(options.contains(optional))request[optional]=options.at(optional);
 return wrapped(call("/simulate",options,&request,"Native simulation failed"));}
Json stepNativePayload(const Json& payload,const Json& options){Json request={{"payload",payload},{"frames",field(options,"frames",8)}};
 return wrapped(call("/step",options,&request,"Native step failed"));}
}
