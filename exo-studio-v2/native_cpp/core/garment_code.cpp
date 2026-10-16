#include "garment_code.hpp"
#include <algorithm>
#include <cmath>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <map>
#include <set>
#include <sstream>
#include <vector>
namespace garment {
namespace {
Json get(const Json& o,const std::string& key){return o.is_object()&&o.contains(key)?o[key]:Json();}
bool truth(const Json& v){return !v.is_null()&&v!=false&&v!=0&&v!="";}
Json fallback(const Json& j,const Json& alt){return truth(j)?j:alt;}
double number(const Json& v){if(v.is_null())return 0;if(v.is_number())return v.get<double>();if(v.is_boolean())return v.get<bool>()?1:0;if(v.is_string()){try{auto s=v.get<std::string>();if(s.empty())return 0;size_t count=0;double n=std::stod(s,&count);return count==s.size()?n:NAN;}catch(...){}}return NAN;}
std::string str(const Json& j){return j.is_string()?j.get<std::string>():j.dump();}
Json obj(const Json& j){return j.is_object()?j:Json::object();}
Json arr(const Json& j){return j.is_array()?j:Json::array();}
Json vec(const Json& v,int i){return v.is_array()&&i>=0&&static_cast<size_t>(i)<v.size()?v[i]:Json();}
std::string trim(std::string s){auto x=s.find_first_not_of(" \t\r\n");if(x==std::string::npos)return "";auto y=s.find_last_not_of(" \t\r\n");return s.substr(x,y-x+1);}
Json point(const Json& v){return Json{{"x",number(vec(v,0))},{"y",number(vec(v,1))}};}
Json control(const Json& a,const Json& b,const Json& c){
 double dx=number(get(b,"x"))-number(get(a,"x")),dy=number(get(b,"y"))-number(get(a,"y")),len=dx*dx+dy*dy;if(!len)len=1;
 double px=number(get(c,"cx"))-number(get(a,"x")),py=number(get(c,"cy"))-number(get(a,"y"));
 return Json::array({(px*dx+py*dy)/len,(dx*py-dy*px)/len});
}
Json absControl(const Json& a,const Json& b,const Json& rel){double dx=number(get(b,"x"))-number(get(a,"x")),dy=number(get(b,"y"))-number(get(a,"y")),r0=number(vec(rel,0)),r1=number(vec(rel,1));return Json{{"cx",number(get(a,"x"))+r0*dx-r1*dy},{"cy",number(get(a,"y"))+r0*dy+r1*dx}};}
struct Ordered {Json points=Json::array(),curves=Json::object();std::map<int,int> edgeMap;};
Ordered ordered(const Json& panel){
 Ordered out;Json vertices=arr(get(panel,"vertices")),edges=arr(get(panel,"edges"));if(vertices.empty())return out;
 for(const auto& vertex:vertices)if(!vertex.is_array())throw std::invalid_argument("Invalid GarmentCode panel vertex");
 if(edges.empty()){for(const auto& v:vertices)out.points.push_back(point(v));return out;}
 std::set<int> remaining;for(size_t i=0;i<edges.size();i++)remaining.insert(i);
 int current=static_cast<int>(number(vec(get(edges[0],"endpoints"),0))),start=current;
 while(!remaining.empty()){
  int selected=-1;bool reverse=false;
  for(int i:remaining){Json ends=arr(get(edges[i],"endpoints"));if(number(vec(ends,0))==current){selected=i;break;}if(number(vec(ends,1))==current){selected=i;reverse=true;break;}}
  if(selected<0)break;
  Json edge=edges[selected],ends=arr(get(edge,"endpoints"));int next=static_cast<int>(number(vec(ends,reverse?0:1)));
  Json vertex=current>=0&&static_cast<size_t>(current)<vertices.size()?vertices[current]:Json::array({0,0});
  Json a=point(vertex);out.points.push_back(a);int newIndex=out.points.size()-1;out.edgeMap[selected]=newIndex;
  Json curvature=get(edge,"curvature"),params=arr(get(curvature,"params"));
  if(get(curvature,"type")=="quadratic"&&!params.empty()&&truth(params[0])){
   Json end=next>=0&&static_cast<size_t>(next)<vertices.size()?vertices[next]:Json::array({0,0});Json rel=params[0];
   if(reverse)rel=Json::array({1-number(vec(rel,0)),-number(vec(rel,1))});
   out.curves[std::to_string(newIndex)]=absControl(a,point(end),rel);
  }
  remaining.erase(selected);current=next;if(current==start&&remaining.empty())break;
 }
 if(out.points.size()<3){out.points=Json::array();for(const auto& v:vertices)out.points.push_back(point(v));out.curves=Json::object();out.edgeMap.clear();for(size_t i=0;i<edges.size();i++)out.edgeMap[i]=i;}
 return out;
}
std::string timestamp(){auto now=std::chrono::system_clock::now();auto ms=std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch())%1000;std::time_t t=std::chrono::system_clock::to_time_t(now);std::tm utc{};gmtime_r(&t,&utc);std::ostringstream o;o<<std::put_time(&utc,"%Y-%m-%dT%H:%M:%S")<<'.'<<std::setfill('0')<<std::setw(3)<<ms.count()<<'Z';return o.str();}
}
Json projectToGarmentCode(const Json& project){
 Json preserved=get(get(project,"interchange"),"garmentCode"),pieces=arr(get(project,"pieces"));Json panels=Json::object(),stitches=Json::array(),seams=Json::array(),extensions=Json::object(),order=Json::array();
 std::set<std::string> used;std::map<std::string,std::string> panelById;
 for(const auto& piece:pieces){
  Json points=arr(get(piece,"points"));if(points.empty())continue;
  std::string base=trim(str(fallback(get(piece,"name"),fallback(get(piece,"id"),"Panel"))));if(base.empty())base="Panel";std::string name=base;int counter=2;while(used.count(name))name=base+" "+std::to_string(counter++);used.insert(name);
  panelById[get(piece,"id").dump()]=name;order.push_back(name);
  Json translation=Json::array(),arrangement=get(piece,"arrangement3d");for(auto key:{"x","y","z"})translation.push_back(number(fallback(get(arrangement,key),0))*100);
  Json vertices=Json::array(),edges=Json::array(),curves=get(piece,"curves");
  for(size_t i=0;i<points.size();i++){
   const auto& a=points[i];const auto& b=points[(i+1)%points.size()];
   vertices.push_back(Json::array({number(get(a,"x")),number(get(a,"y"))}));
   Json edge={{"endpoints",Json::array({i,(i+1)%points.size()})}};Json curve=get(curves,std::to_string(i));if(truth(curve))edge["curvature"]={{"type","quadratic"},{"params",Json::array({control(a,b,curve)})}};edges.push_back(edge);
  }
  Json panel={{"translation",translation},{"rotation",fallback(get(get(piece,"garmentCode"),"rotation"),Json::array({0,0,0}))},{"vertices",vertices},{"edges",edges}};
  Json label=fallback(get(get(piece,"garmentCode"),"label"),get(piece,"generatedRole"));if(!label.is_null())panel["label"]=label;
  panels[name]=panel;Json meta=piece;for(auto k:{"points","curves","name","id"})meta.erase(k);
  extensions[name]={{"id",get(piece,"id")},{"meta",meta}};
 }
 for(const auto& seam:arr(get(project,"seams"))){
  Json a=get(seam,"a"),b=get(seam,"b");auto ia=panelById.find(get(a,"pieceId").dump()),ib=panelById.find(get(b,"pieceId").dump());if(ia==panelById.end()||ib==panelById.end())continue;
  stitches.push_back(Json::array({Json{{"panel",ia->second},{"edge",number(get(a,"edgeIndex"))}},Json{{"panel",ib->second},{"edge",number(get(b,"edgeIndex"))}}}));seams.push_back(seam);
 }
 Json props=obj(get(preserved,"properties"));props["curvature_coords"]="relative";props["normalize_panel_translation"]=false;props["normalized_edge_loops"]=true;
 Json meter=get(props,"units_in_meter");props["units_in_meter"]=meter.is_null()?100:number(meter);
 Json meta=Json::object();for(auto k:{"id","name","version","revision"})if(get(project,k).is_null()){}else meta[k]=get(project,k);
 meta["units"]=fallback(get(project,"units"),"cm");
 for(auto k:{"avatar","fabrics","simulation","grading","markerSettings"})meta[k]=fallback(get(project,k),Json::object());
 for(auto k:{"fasteners","customMeasurements"})meta[k]=fallback(get(project,k),Json::array());
 return Json{{"pattern",{{"panels",panels},{"stitches",stitches},{"panel_order",order}}},
 {"parameters",fallback(get(preserved,"parameters"),Json::object())},{"parameter_order",fallback(get(preserved,"parameterOrder"),fallback(get(preserved,"parameter_order"),Json::array()))},{"properties",props},
 {"garment_studio",{{"format","garment-studio-extension"},{"version",1},{"project",meta},{"pieces",extensions},{"seams",seams}}}};
}
Json garmentCodeToProject(const Json& spec,const Json& baseProject,const std::string& updatedAt,const std::string& idPrefix){
 Json extension=get(spec,"garment_studio"),meta=get(extension,"project"),project=obj(baseProject);
 Json m=obj(meta);for(auto it=m.begin();it!=m.end();++it)project[it.key()]=it.value();
 int generated=0;auto newid=[&](const char* type){return idPrefix.empty()?std::string(type)+"-generated-"+std::to_string(++generated):idPrefix+"-"+type+"-"+std::to_string(++generated);};
 project["id"]=fallback(get(meta,"id"),fallback(get(baseProject,"id"),newid("project")));
 project["name"]=fallback(get(meta,"name"),fallback(get(baseProject,"name"),"Imported GarmentCode Pattern"));
 project["version"]=std::max(1.,number(fallback(get(meta,"version"),1)));project["revision"]=number(fallback(get(meta,"revision"),1));
 project["updatedAt"]=updatedAt.empty()?timestamp():updatedAt;project["units"]="cm";project["pieces"]=Json::array();project["seams"]=Json::array();
 for(auto k:{"fasteners","customMeasurements"})project[k]=fallback(get(meta,k),fallback(get(baseProject,k),Json::array()));
 for(auto k:{"avatar","fabrics","simulation","grading","markerSettings"})project[k]=fallback(get(meta,k),fallback(get(baseProject,k),Json::object()));
 Json exchange=obj(get(baseProject,"interchange"));exchange["garmentCode"]={{"source",truth(extension)?"garment-studio":"external"},{"parameters",fallback(get(spec,"parameters"),Json::object())},{"parameterOrder",fallback(get(spec,"parameter_order"),Json::array())},{"properties",fallback(get(spec,"properties"),Json::object())},{"panelOrder",fallback(get(get(spec,"pattern"),"panel_order"),Json::array())}};project["interchange"]=exchange;
 std::map<std::string,Json> ids;std::map<std::string,std::map<int,int>> edgeMaps;
 Json panels=obj(get(get(spec,"pattern"),"panels"));int panelIndex=0;
 std::vector<std::string> panelNames;
 for(const auto& name:arr(get(get(spec,"pattern"),"panel_order")))if(name.is_string()&&panels.contains(name.get<std::string>())&&std::find(panelNames.begin(),panelNames.end(),name.get<std::string>())==panelNames.end())panelNames.push_back(name.get<std::string>());
 for(auto it=panels.begin();it!=panels.end();++it)if(std::find(panelNames.begin(),panelNames.end(),it.key())==panelNames.end())panelNames.push_back(it.key());
 for(const auto& name:panelNames){
  Json panel=panels[name],ext=get(get(extension,"pieces"),name),pmeta=obj(get(ext,"meta")),tr=arr(get(panel,"translation"));
  Ordered result=ordered(panel);Json id=fallback(get(ext,"id"),newid("piece"));ids[name]=id;edgeMaps[name]=result.edgeMap;
  Json layout=fallback(get(pmeta,"layout2d"),Json{{"x",60+(panelIndex%3)*95},{"y",110+(panelIndex/3)*105}});
  Json arrangement=fallback(get(pmeta,"arrangement3d"),Json{{"x",number(vec(tr,0))/100},{"y",number(vec(tr,1))/100},{"z",number(vec(tr,2))/100},{"flip",false},{"wrap",nullptr}});
  Json gc=obj(get(pmeta,"garmentCode"));Json label=get(panel,"label");if(label.is_null())label=get(gc,"label");gc["label"]=label;gc["rotation"]=fallback(get(panel,"rotation"),fallback(get(gc,"rotation"),Json::array({0,0,0})));
  Json piece={{"id",id},{"name",name},{"points",result.points},{"curves",result.curves},{"layout2d",layout},{"arrangement3d",arrangement},{"seamAllowance",get(pmeta,"seamAllowance").is_null()?1:number(get(pmeta,"seamAllowance"))},{"fabricId",fallback(get(pmeta,"fabricId"),"main")},{"locked",truth(get(pmeta,"locked"))},{"garmentCode",gc}};
  for(auto mi=pmeta.begin();mi!=pmeta.end();++mi)piece[mi.key()]=mi.value();project["pieces"].push_back(piece);panelIndex++;
 }
 Json stitches=arr(get(get(spec,"pattern"),"stitches")),prior=get(extension,"seams");
 if(prior.is_array()&&prior.size()==stitches.size())project["seams"]=prior;
 else for(size_t i=0;i<stitches.size();i++){
  Json stitch=stitches[i],a=vec(stitch,0),b=vec(stitch,1);if(!truth(a)||!truth(b))continue;
  std::string an=str(get(a,"panel")),bn=str(get(b,"panel"));if(!ids.count(an)||!ids.count(bn))continue;
  int ae=(int)number(get(a,"edge")),be=(int)number(get(b,"edge"));if(edgeMaps[an].count(ae))ae=edgeMaps[an][ae];if(edgeMaps[bn].count(be))be=edgeMaps[bn][be];
  project["seams"].push_back(Json{{"id",newid("seam")},{"name","Imported seam "+std::to_string(i+1)},{"type","normal"},{"a",{{"pieceId",ids[an]},{"edgeIndex",ae}}},{"b",{{"pieceId",ids[bn]},{"edgeIndex",be}}}});
 }
 return project;
}
Json garmentCodeRoundTripSummary(const Json& project){Json spec=projectToGarmentCode(project),reimported=garmentCodeToProject(spec,project);return Json{{"panels",spec["pattern"]["panels"].size()},{"stitches",spec["pattern"]["stitches"].size()},{"originalPieces",arr(get(project,"pieces")).size()},{"importedPieces",reimported["pieces"].size()},{"originalSeams",arr(get(project,"seams")).size()},{"importedSeams",reimported["seams"].size()}};}
}
