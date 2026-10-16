#include "ppf_service_client.hpp"
#include <curl/curl.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <stdexcept>
#include <thread>
namespace garment::ppf_service_client {
namespace {
Json field(const Json& o,const char* key,Json fallback=nullptr){return o.is_object()&&o.contains(key)&&!o[key].is_null()?o[key]:fallback;}
double number(const Json& o,const char* key,double fallback){auto x=field(o,key,fallback);return x.is_number()?x.get<double>():fallback;}
std::string base(const Json& o){auto x=field(o,"baseUrl",DEFAULT_PPF_SERVICE_URL);if(!x.is_string())throw std::invalid_argument("PPF URL must be a string");auto s=x.get<std::string>();while(s.size()>1&&s.back()=='/')s.pop_back();
 if(s.find('@')!=std::string::npos||s.find('?')!=std::string::npos||s.find('#')!=std::string::npos)throw std::invalid_argument("PPF URL cannot contain credentials or query");
 const bool local=s.rfind("http://127.0.0.1:",0)==0||s=="http://127.0.0.1"||s.rfind("http://localhost:",0)==0||s=="http://localhost"||s.rfind("http://[::1]:",0)==0;
 if(!local&&field(o,"allowRemote")!=true)throw std::invalid_argument("Remote PPF service requires allowRemote=true");
 if(s.rfind("http://",0)!=0&&s.rfind("https://",0)!=0)throw std::invalid_argument("PPF service requires HTTP(S)");return s;
}
size_t write(char* s,size_t a,size_t b,void* data){static_cast<std::string*>(data)->append(s,a*b);return a*b;}
std::string encode(const std::string& value){CURL* c=curl_easy_init();if(!c)throw std::runtime_error("curl init failed");auto e=curl_easy_escape(c,value.data(),(int)value.size());if(!e){curl_easy_cleanup(c);throw std::runtime_error("percent encode failed");}std::string result=e;curl_free(e);curl_easy_cleanup(c);return result;}
std::string query(const std::string& x){auto out=encode(x);std::string::size_type pos=0;while((pos=out.find("%20",pos))!=std::string::npos){out.replace(pos,3,"+");pos++;}return out;}
Json request(const std::string& path,const Json& options,const Json* payload,const char* failed){auto endpoint=base(options)+path;auto c=curl_easy_init();if(!c)throw std::runtime_error("curl init failed");std::string data,body=payload?payload->dump():"";curl_slist* headers=nullptr;
 curl_easy_setopt(c,CURLOPT_URL,endpoint.c_str());curl_easy_setopt(c,CURLOPT_WRITEFUNCTION,write);curl_easy_setopt(c,CURLOPT_WRITEDATA,&data);curl_easy_setopt(c,CURLOPT_TIMEOUT_MS,(long)number(options,"requestTimeoutMs",10000));curl_easy_setopt(c,CURLOPT_CONNECTTIMEOUT_MS,1500L);curl_easy_setopt(c,CURLOPT_FOLLOWLOCATION,0L);curl_easy_setopt(c,CURLOPT_NOSIGNAL,1L);
 if(payload){headers=curl_slist_append(headers,"Content-Type: application/json");curl_easy_setopt(c,CURLOPT_HTTPHEADER,headers);curl_easy_setopt(c,CURLOPT_POST,1L);curl_easy_setopt(c,CURLOPT_POSTFIELDS,body.c_str());curl_easy_setopt(c,CURLOPT_POSTFIELDSIZE,(long)body.size());}
 auto rc=curl_easy_perform(c);long status=0;curl_easy_getinfo(c,CURLINFO_RESPONSE_CODE,&status);curl_slist_free_all(headers);curl_easy_cleanup(c);
 if(rc!=CURLE_OK)throw std::runtime_error(std::string("PPF transport failed: ")+curl_easy_strerror(rc));Json result;
 try{result=Json::parse(data);}catch(...){throw std::runtime_error("PPF service returned invalid JSON");}
 if(status<200||status>=300||field(result,"ok")!=true){auto err=field(result,"error");throw std::runtime_error(err.is_string()&&!err.get<std::string>().empty()?err.get<std::string>():std::string(failed)+" ("+std::to_string(status)+")");}return result;
}
}
Json getPpfServiceHealth(const Json& options){return request("/health",options,nullptr,"PPF service unavailable");}
Json submitPpfFinalSolve(const Json& project,const Json& options){Json payload={{"project",project},{"options",{{"frames",field(options,"frames",10)},{"minTorsoDepth",field(options,"minTorsoDepth",.16)},{"minArmOffset",field(options,"minArmOffset",.51)},{"allowExplodedExperimental",field(options,"allowExplodedExperimental",false)}}}};return field(request("/jobs",options,&payload,"PPF job submission failed"),"job");}
Json getPpfJob(const std::string& id,const Json& options){return field(request("/jobs/"+encode(id),options,nullptr,"PPF job query failed"),"job");}
Json getPpfJobPreview(const std::string& id,const Json& options){std::string path="/jobs/"+encode(id)+"/preview",queryString;auto add=[&](const std::string& key,const std::string& value){queryString+=(queryString.empty()?"?":"&")+key+"="+query(value);};
 for(auto key:{"frame","stage"}){auto v=field(options,key);if(v.is_string())add(key,v.get<std::string>());else if(v.is_number())add(key,v.dump());else if(v.is_boolean())add(key,v.get<bool>()?"true":"false");}
 if(field(options,"validatedOnly")==true)add("validatedOnly","true");return field(request(path+queryString,options,nullptr,"PPF preview unavailable"),"preview");}
Json waitForPpfJob(const std::string& id,const Json& options,ProgressCallback progress){auto timeout=(long)number(options,"timeoutMs",600000),poll=(long)number(options,"pollMs",1000);if(timeout<0||poll<0)throw std::invalid_argument("Invalid polling interval");auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(timeout);
 while(std::chrono::steady_clock::now()<deadline){auto job=getPpfJob(id,options);if(progress)progress(job);auto status=field(job,"status");if(status=="done")return job;if(status=="error"){auto error=field(job,"error");throw std::runtime_error(error.is_string()&&!error.get<std::string>().empty()?error.get<std::string>():"PPF final solve failed");}std::this_thread::sleep_for(std::chrono::milliseconds(poll));}
 throw std::runtime_error("PPF final solve timed out after "+std::to_string(timeout)+" ms");}
}
