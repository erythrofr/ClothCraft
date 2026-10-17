#include "sewing_construction.hpp"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <map>
#include <sstream>
#include <string>
#include <vector>
namespace garment {
namespace {
Json get(const Json& o,const std::string& key){return o.is_object()&&o.contains(key)?o[key]:Json();}
Json arr(const Json& o,const std::string& key){Json v=get(o,key);return v.is_array()?v:Json::array();}
std::string str(const Json& j){if(j.is_null())return "undefined";if(j.is_string())return j.get<std::string>();return j.dump();}
std::string truthyStr(const Json& j,const std::string& fallback){if(j.is_null()||j==false||j==0||j=="")return fallback;return str(j);}
double number(const Json& j,double fallback=0){if(j.is_null())return fallback;if(j.is_boolean())return j.get<bool>()?1:0;if(j.is_number())return j.get<double>();if(j.is_string()){try{auto v=j.get<std::string>();if(v.empty())return 0;size_t n;double x=std::stod(v,&n);return n==v.size()?x:NAN;}catch(...){return NAN;}}return NAN;}
Json pieceFor(const Json& project,const Json& id){for(const auto& p:arr(project,"pieces"))if(get(p,"id")==id)return p;return nullptr;}
std::string identity(const Json& endpoint){return str(get(endpoint,"pieceId"))+":"+str(get(endpoint,"edgeIndex"));}
double arcLength(const Json& a,const Json& c,const Json& b){
 double x=a.at("x").get<double>(),y=a.at("y").get<double>(),cx=c.at("cx").get<double>(),cy=c.at("cy").get<double>(),bx=b.at("x").get<double>(),by=b.at("y").get<double>();
 auto speed=[&](double t){return std::hypot(2*((1-t)*(cx-x)+t*(bx-cx)),2*((1-t)*(cy-y)+t*(by-cy)));};
 auto sim=[&](double u,double v,double fu,double fm,double fv){return (v-u)*(fu+4*fm+fv)/6;};
 auto recur=[&](auto&& self,double u,double v,double fu,double fm,double fv,double whole,double tol,int depth)->double{
  double mid=(u+v)/2,fl=speed((u+mid)/2),fr=speed((mid+v)/2),left=sim(u,mid,fu,fl,fm),right=sim(mid,v,fm,fr,fv);
  if(depth>=20||std::abs(left+right-whole)<=tol*15)return left+right+(left+right-whole)/15;
  return self(self,u,mid,fu,fl,fm,left,tol/2,depth+1)+self(self,mid,v,fm,fr,fv,right,tol/2,depth+1);
 };
 double f0=speed(0),f1=speed(1),fm=speed(.5);
 return recur(recur,0,1,f0,fm,f1,sim(0,1,f0,fm,f1),1e-7,0);
}
double edgeLength(const Json& p,int edge){
 Json pts=arr(p,"points");if(edge<0||pts.empty()||edge>=static_cast<int>(pts.size()))return 0;
 const auto& a=pts[edge];const auto& b=pts[(edge+1)%pts.size()];
 Json curve=get(get(p,"curves"),std::to_string(edge));
 if(curve.is_object())return arcLength(a,curve,b);
 return std::hypot(b.at("x").get<double>()-a.at("x").get<double>(),b.at("y").get<double>()-a.at("y").get<double>());
}
double rangeLength(const Json& p,const Json& e){Json interval=seamEndpointInterval(e);if(interval.is_null())return 0;return edgeLength(p,static_cast<int>(number(get(e,"edgeIndex"))))*(interval["end"].get<double>()-interval["start"].get<double>());}
Json lengthReport(const Json& project,const Json& seam){
 Json a=get(seam,"a"),b=get(seam,"b");double la=rangeLength(pieceFor(project,get(a,"pieceId")),a),lb=rangeLength(pieceFor(project,get(b,"pieceId")),b);
 double diff=std::abs(la-lb),mean=(la+lb)/2,pct=mean>0?diff/mean*100:0;
 return Json{{"lengthA",la},{"lengthB",lb},{"difference",diff},{"mismatchPercent",pct},{"status",pct<=2?"good":pct<=6?"warning":"error"}};
}
bool validIndex(const Json& j,size_t n){return j.is_number_integer()&&j.get<long long>()>=0&&static_cast<unsigned long long>(j.get<long long>())<n;}
std::string fixed1(double x){std::ostringstream os;os<<std::fixed<<std::setprecision(1)<<x;return os.str();}
}
Json seamEndpointInterval(const Json& endpoint){
 Json a=get(endpoint,"startT"),b=get(endpoint,"endT");double start=a.is_null()?0:number(a),end=b.is_null()?1:number(b);
 if(!std::isfinite(start)||!std::isfinite(end)||start<0||end>1||start>=end)return nullptr;
 return Json{{"start",start},{"end",end}};
}
bool seamEndpointOverlap(const Json& a,const Json& b,double epsilon){
 if(identity(a)!=identity(b))return false;Json ar=seamEndpointInterval(a),br=seamEndpointInterval(b);
 return !ar.is_null()&&!br.is_null()&&std::min(ar["end"].get<double>(),br["end"].get<double>())-std::max(ar["start"].get<double>(),br["start"].get<double>())>epsilon;
}
Json validateNewSeam(const Json& project,const Json& proposed,const Json& options){
 Json messages=Json::array();Json endpoints=Json::array({get(proposed,"a"),get(proposed,"b")});
 for(int i=0;i<2;i++){
  std::string side=i==0?"A":"B";Json e=endpoints[i],piece=pieceFor(project,get(e,"pieceId"));
  if(piece.is_null()){messages.push_back("Side "+side+" references a missing pattern");continue;}
  Json index=get(e,"edgeIndex");if(!validIndex(index,arr(piece,"points").size())){messages.push_back("Side "+side+" references an invalid cutline edge");continue;}
  Json range=seamEndpointInterval(e);if(range.is_null()){messages.push_back("Side "+side+" has an invalid sewing range");continue;}
  if(rangeLength(piece,e)<.01)messages.push_back("Side "+side+" is shorter than 0.1 mm; expand the selection");
 }
 if(!endpoints[0].is_null()&&!endpoints[1].is_null()&&identity(endpoints[0])==identity(endpoints[1]))messages.push_back("A seam must connect two distinct cutline edges");
 if(messages.empty()&&get(options,"allowOverlappingLayers")!=true){
  for(const auto& prior:arr(project,"seams")){
   Json exclusion=get(options,"excludeSeamId");if(!exclusion.is_null()&&exclusion!=false&&get(prior,"id")==exclusion)continue;
   bool overlap=false;for(const auto& e:endpoints)if(seamEndpointOverlap(e,get(prior,"a"))||seamEndpointOverlap(e,get(prior,"b")))overlap=true;
   if(overlap){messages.push_back("Selected cutline interval is already sewn by "+truthyStr(get(prior,"name"),truthyStr(get(prior,"id"),"undefined")));break;}
  }
 }
 Json lengths=messages.empty()?lengthReport(project,proposed):Json(nullptr);Json warning=nullptr;
 if(!lengths.is_null()&&lengths["mismatchPercent"].get<double>()>6)warning="The selected edges differ by "+fixed1(lengths["mismatchPercent"].get<double>())+"%; review easing or gathering.";
 return Json{{"ok",messages.empty()},{"messages",messages},{"lengths",lengths},{"warning",warning}};
}
Json auditSewingConstruction(const Json& project,const Json& options){
 Json issues=Json::array();Json categories={{"invalidEndpoints",0},{"inactive3d",0},{"overlappingRanges",0},{"lengthMismatch",0}};
 int maxExamples=12;Json maximum=get(options,"maxExamples");if(maximum.is_number())maxExamples=static_cast<int>(number(maximum));
 auto add=[&](const std::string& kind,const Json& id,const std::string& detail){categories[kind]=categories[kind].get<int>()+1;if(static_cast<int>(issues.size())<maxExamples)issues.push_back(Json{{"kind",kind},{"seamId",id},{"detail",detail}});};
 struct Interval{double start,end;Json id;};std::map<std::string,std::vector<Interval>> intervals;
 int links=0;Json seams=arr(project,"seams");
 for(const auto& seam:seams){
  bool invalid=false;Json id=get(seam,"id");
  for(const auto& ep:{get(seam,"a"),get(seam,"b")}){
   Json p=pieceFor(project,get(ep,"pieceId")),index=get(ep,"edgeIndex"),range=seamEndpointInterval(ep);
   if(p.is_null()||!validIndex(index,arr(p,"points").size())||range.is_null()){
    Json pieceId=get(ep,"pieceId");add("invalidEndpoints",id,truthyStr(pieceId,"?")+":"+ (index.is_null()?"?":str(index)));invalid=true;continue;
   }
   intervals[identity(ep)].push_back({range["start"].get<double>(),range["end"].get<double>(),id});
   if(get(p,"active3d")==false)add("inactive3d",id,"The source pattern "+truthyStr(get(p,"name"),truthyStr(get(p,"id"),"undefined"))+" is excluded from simulation");
  }
  if(invalid)continue;links++;
  Json report=lengthReport(project,seam);if(report["mismatchPercent"].get<double>()>6)add("lengthMismatch",id,fixed1(report["mismatchPercent"].get<double>())+"% edge length mismatch");
 }
 for(auto& [key,ranges]:intervals){
  std::stable_sort(ranges.begin(),ranges.end(),[](const auto& a,const auto& b){return a.start<b.start;});
  for(size_t i=0;i<ranges.size();i++)for(size_t j=i+1;j<ranges.size()&&ranges[j].start<ranges[i].end;j++)
   if(ranges[i].id!=ranges[j].id&&std::min(ranges[i].end,ranges[j].end)-ranges[j].start>1e-5)add("overlappingRanges",ranges[j].id,"Conflict on "+key+" with "+str(ranges[i].id));
 }
 return Json{{"sourceSeams",seams.size()},{"validSewingLinks",links},{"issues",issues},{"categories",categories},{"usableForLiveAssembly",categories["invalidEndpoints"]==0&&categories["inactive3d"]==0&&categories["overlappingRanges"]==0},{"certifiedPhysicalFit",false}};
}
}
