#include "ppf_payload.hpp"
#include <algorithm>
#include <cmath>
#include <cctype>
#include <map>
#include <set>
#include <stdexcept>
namespace garment {
namespace {
Json obj(const Json& j,const char* key){return j.is_object()&&j.contains(key)&&j[key].is_object()?j[key]:Json::object();}
Json arr(const Json& j,const char* key){return j.is_object()&&j.contains(key)&&j[key].is_array()?j[key]:Json::array();}
Json val(const Json& j,const char* key,Json fallback=nullptr){return j.is_object()&&j.contains(key)&&!j[key].is_null()?j[key]:fallback;}
double num(const Json& j,double fallback=0){try{if(j.is_number())return j.get<double>();if(j.is_string())return std::stod(j.get<std::string>());if(j.is_boolean())return j.get<bool>()?1:0;}catch(...){}return fallback;}
double field(const Json& j,const char* key,double fallback){return num(val(j,key),fallback);}
std::string str(const Json& j,const char* key,std::string fallback=""){auto v=val(j,key);return v.is_string()?v.get<std::string>():fallback;}
bool integer(const Json& j){return j.is_number()&&std::isfinite(num(j))&&std::floor(num(j))==num(j);}
bool finiteVec(const Json& v){if(!v.is_array()||v.size()!=3)return false;for(auto& x:v)if(!x.is_number()||!std::isfinite(num(x)))return false;return true;}
double clamp(double n,double lo,double hi){return std::max(lo,std::min(hi,n));}
Json fabricMaterial(const Json& fabric,const Json& project){
  Json over=obj(fabric,"ppf"),sim=obj(project,"simulation"),d=ppfSolverFabricPreset(fabric),m=Json::object();
  auto use=[&](const char* key,Json value){if(value.is_number()&&std::isfinite(num(value)))m[key]=value;};
  use("shellDensity",std::max(.001,field(over,"shellDensity",field(fabric,"gsm",180)/1000)));
  use("friction",clamp(field(over,"friction",field(fabric,"friction",.35)),0,4));
  use("shrinkX",clamp(field(over,"shrinkX",1-clamp(field(fabric,"shrinkWarp",0),0,.45)),.2,2));
  use("shrinkY",clamp(field(over,"shrinkY",1-clamp(field(fabric,"shrinkWeft",0),0,.45)),.2,2));
  for(auto [key,def]:std::initializer_list<std::pair<const char*,Json>>{{"contactGap",val(sim,"ppfContactGap",.001)},{"contactOffset",val(sim,"ppfContactOffset",0)},{"shellYoungModulus",d["shellYoungModulus"]},{"shellPoissonRatio",nullptr},{"bend",d["bend"]},{"stitchStiffness",val(sim,"ppfStitchStiffness")},{"strainLimitPercent",val(sim,"ppfStrainLimitPercent",5)}}){
    use(key,val(over,key,def));
  }
  return m;
}
Json uniqueEdges(const Json& constraints){
  Json edges=Json::array();std::set<std::pair<long,long>> seen;
  for(auto& c:constraints){auto type=str(c,"type");if(type!="seam"&&type!="surface-stitch"&&type!="fastener")continue;
    auto a=val(c,"a"),b=val(c,"b");if(!integer(a)||!integer(b)||a==b)continue;
    long x=(long)num(a),y=(long)num(b);if(!seen.insert(std::minmax(x,y)).second)continue;
    edges.push_back({{"a",a},{"b",b},{"type",type},{"seamId",val(c,"seamId")}});
  }return edges;
}
Json scene(const Json& project,const Json& options,double defaultFrames,bool staging){
 auto sim=obj(project,"simulation"),avatar=obj(project,"avatar");
 std::string representation=str(sim,"ppfAvatarRepresentation",str(avatar,"model")=="clo-thomas"?"pinned-shell":"static");
 if(representation!="pinned-shell"&&representation!="static")throw std::runtime_error("Invalid PPF avatar representation");
 Json s={{"gravity",Json::array({0,0,-std::abs(field(sim,"gravity",9.81))})},{"avatarRepresentation",representation},
 {"avatarContactGap",clamp(field(sim,"ppfAvatarContactGap",.001),.0001,.01)},
 {"avatarContactOffset",clamp(field(sim,"ppfAvatarContactOffset",0),0,.005)},
 {"frameCount",std::max(10.,field(options,"frameCount",field(sim,"ppfFrameCount",defaultFrames)))},
 {"frameRate",std::max(1.,field(options,"frameRate",60))},{"stepSize",field(options,"stepSize",field(sim,"ppfStepSize",.004))},
 {"contactNnz",field(sim,"ppfContactNnz",4000000)},{"lineSearchMaxT",field(sim,"ppfLineSearchMaxT",1.25)}};
 (void)staging;return s;
}
Json fabrics(const Json& project){Json result=Json::object();auto f=obj(project,"fabrics");for(auto it=f.begin();it!=f.end();++it)result[it.key()]={{"id",it.key()},{"name",str(it.value(),"name",it.key())},{"material",fabricMaterial(it.value(),project)}};return result;}
Json projectInfo(const Json& project){return Json{{"id",val(project,"id")},{"name",str(project,"name","Untitled Garment")},{"revision",field(project,"revision",1)}};}
Json avatarInfo(const Json& project){auto avatar=obj(project,"avatar");return Json{{"mode",str(avatar,"model")=="clo-thomas"?"local-thomas-body-mesh":"garment-studio-proxy"},{"measurements",avatar},{"objectPrefix","PPF_Avatar_"}};}
Json sourceInfo(const Json& native){return Json{{"nativePayloadVersion",val(native,"version")},{"particles",arr(native,"particles").size()},{"constraints",arr(native,"constraints").size()},{"anchors",arr(native,"anchors").size()}};}
Json verticesOf(const Json& native){Json vertices=Json::array();for(auto& p:arr(native,"particles"))vertices.push_back(val(p,"position",Json::array()));return vertices;}
Json geometry(const Json& native,Json vertices,const Json* results=nullptr){
 Json faces=Json::array(),ids=Json::array(),ranges=Json::array();std::map<std::string,Json> byId;
 if(results)for(auto& p:*results)byId[str(p,"id")]=p;
 for(auto& piece:arr(native,"pieces")){
  std::string id=str(piece,"id");Json active=piece,indices=arr(piece,"particleIndices");
  if(results){auto it=byId.find(id);if(it==byId.end())throw std::runtime_error("Native result is missing piece "+id);
    active=it->second;Json verts=arr(active,"vertices");if(verts.size()!=indices.size())throw std::runtime_error("Native result vertex count mismatch for "+id+": "+std::to_string(verts.size())+" != "+std::to_string(indices.size()));
    for(size_t i=0;i<indices.size();++i){auto k=indices[i];if(!integer(k)||!finiteVec(verts[i]))throw std::runtime_error("Invalid dressed vertex "+id+":"+std::to_string(i));auto index=(size_t)num(k);if(index>=vertices.size())throw std::runtime_error("Invalid dressed vertex "+id+":"+std::to_string(i));vertices[index]=verts[i];}
  }
  size_t start=faces.size();Json pieceFaces=results?arr(active,"faces"):arr(piece,"faces");if(results&&!active.contains("faces"))pieceFaces=arr(piece,"faces");
  for(auto& f:pieceFaces){if(!f.is_array())continue;Json global=Json::array();for(auto& local:f){if(integer(local)&&(size_t)num(local)<indices.size())global.push_back(indices[(size_t)num(local)]);else global.push_back(nullptr);}
    if(global.size()==3&&integer(global[0])&&integer(global[1])&&integer(global[2])){faces.push_back(global);ids.push_back(id);}
  }
  ranges.push_back({{"id",id},{"name",val(piece,"name")},{"fabricId",val(piece,"fabricId")},{"faceStart",start},{"faceCount",faces.size()-start},{"particleIndices",indices}});
 }
 return Json{{"vertices",vertices},{"faces",faces},{"facePieceIds",ids},{"pieces",ranges},{"stitchEdges",uniqueEdges(arr(native,"constraints"))}};
}
void translate(Json& verts,const Json& indices,double dx,double dy,double dz){for(auto& v:indices)if(integer(v)&&(size_t)num(v)<verts.size()){auto& p=verts[(size_t)num(v)];if(finiteVec(p)){p[0]=num(p[0])+dx;p[1]=num(p[1])+dy;p[2]=num(p[2])+dz;}}}
Json stage(const Json& project,const Json& native,Json& verts,const Json& options){
 Json staging={{"strategy","exploded-sewing-v1"},{"pieces",Json::object()}};
 if(val(options,"staging") == false){staging["strategy"]="document-arrangement";return staging;}
 std::map<std::string,Json> projects;for(auto& p:arr(project,"pieces"))projects[str(p,"id")]=p;
 for(auto& piece:arr(native,"pieces")){auto id=str(piece,"id");Json p=projects.count(id)?projects[id]:Json::object();
 auto wrap=str(obj(p,"arrangement3d"),"wrap"),role=str(p,"generatedRole");double dx=0,dy=0,dz=0;bool matched=true;
 if(wrap=="left-arm"||wrap=="left-wrist")dx=-.15;
 else if(wrap=="right-arm"||wrap=="right-wrist")dx=.15;
 else if(role=="kangaroo-pocket")dz=.12;
 else if(role=="rib-waistband"||wrap=="waist-band")dy=-.10;
 else if(role=="zip-front-left")dx=-.04;
 else if(role=="zip-front-right")dx=.04;
 else if(role=="hood-left"||role=="hood-right"||wrap=="hood-left"||wrap=="hood-right"){
   double side=(role=="hood-left"||wrap=="hood-left")?-1:1;auto flat=arr(piece,"flatVerticesM"),indices=arr(piece,"particleIndices");
   if(flat.empty()||flat.size()!=indices.size())continue;
   double minX=1e30,maxX=-1e30;for(auto& v:flat){double x=num(v[0]);minX=std::min(minX,x);maxX=std::max(maxX,x);}double width=std::max(.001,maxX-minX);
   for(size_t i=0;i<flat.size();++i)if(integer(indices[i])&&(size_t)num(indices[i])<verts.size()){double x=num(flat[i][0])-minX;verts[(size_t)num(indices[i])]=Json::array({side<0?-width+x:width-x,1.60+num(flat[i][1]),-.30});}
   staging["pieces"][id]={{"mode","flat-vertical"},{"side",side},{"width",width},{"baseY",1.60},{"backZ",-.30}};continue;
 }else matched=false;
 if(matched){translate(verts,arr(piece,"particleIndices"),dx,dy,dz);staging["pieces"][id]={{"mode","translate"},{"dx",dx},{"dy",dy},{"dz",dz}};}
 }
 return staging;
}
Json explodedVertex(const Json& projectPiece,const Json& flat,size_t index,const Json& options){
 double x=flat.is_array()&&flat.size()>0?num(flat[0]):0,y=flat.is_array()&&flat.size()>1?num(flat[1]):0;
 double base=field(options,"baseY",1),depth=field(options,"torsoDepth",.36),arm=field(options,"armOffset",.72);
 auto wrap=str(obj(projectPiece,"arrangement3d"),"wrap");double shift=field(obj(projectPiece,"arrangement3d"),"x",0);
 if(wrap=="front")return Json::array({x+shift,base+y,depth});
 if(wrap=="back")return Json::array({x+shift,base+y,-depth});
 if(wrap=="left-arm")return Json::array({-arm,base+y,-x});
 if(wrap=="right-arm")return Json::array({arm,base+y,x});
 if(wrap=="left-leg-front")return Json::array({-.22,.30+y,.30+x});
 if(wrap=="left-leg-back")return Json::array({-.22,.30+y,-.30-x});
 if(wrap=="right-leg-front")return Json::array({.22,.30+y,.30+x});
 if(wrap=="right-leg-back")return Json::array({.22,.30+y,-.30-x});
 if(wrap=="lower-front")return Json::array({x+shift,.35+y,.32});
 if(wrap=="lower-back")return Json::array({x+shift,.35+y,-.32});
 if(str(projectPiece,"generatedRole").rfind("hood",0)==0||wrap=="hood"){double side=index%2==0?-1:1;return Json::array({x+side*.26,1.55+y,side*.38});}
 return Json::array({x+(double(index%3)-1)*.75,base+y+double(index/3)*.8,.72});
}
}
Json ppfSolverFabricPreset(const Json& fabric){
 auto text=str(fabric,"id")+" "+str(fabric,"name");std::transform(text.begin(),text.end(),text.begin(),[](unsigned char c){return std::tolower(c);});
 if(text.find("silk")!=std::string::npos)return {{"shellYoungModulus",500},{"bend",1.42},{"friction",.25},{"preset","Silk"}};
 if(text.find("denim")!=std::string::npos||text.find("jean")!=std::string::npos)return {{"shellYoungModulus",10000},{"bend",10},{"friction",.5},{"preset","Denim"}};
 if(text.find("wool")!=std::string::npos||text.find("fleece")!=std::string::npos||text.find("terry")!=std::string::npos)return {{"shellYoungModulus",2000},{"bend",3.67},{"friction",.4},{"preset","Wool"}};
 return {{"shellYoungModulus",5500},{"bend",4.3},{"friction",.35},{"preset","Cotton"}};
}
Json ppfTemporaryShoulderSupports(const Json& pieces,bool enabled,double frames){
 if(!enabled)return nullptr;Json indices=Json::array();
 for(auto name:{"front","back"})for(auto& piece:pieces){if(str(piece,"id")!=name)continue;
  auto flat=arr(piece,"flatVerticesM"),particles=arr(piece,"particleIndices");if(flat.empty())continue;
  double maxY=-1e30;for(auto& v:flat)if(v.is_array()&&v.size()>1)maxY=std::max(maxY,num(v[1]));
  for(int side:{-1,1}){double score=1e30;Json winner=nullptr;
   for(size_t i=0;i<flat.size();++i){auto& v=flat[i];if(!v.is_array()||v.size()<2)continue;double x=num(v[0]),y=num(v[1]);
    if((x>0?1:x<0?-1:0)!=side||y<maxY-.16)continue;
    double d=std::abs(std::abs(x)-.21)+std::abs(y-(maxY-.025))*.65;
    if(d<score){score=d;winner=i<particles.size()?particles[i]:Json(nullptr);}
   }if(integer(winner))indices.push_back(winner);
  }
 }
 std::set<long> distinct;for(auto& k:indices)distinct.insert((long)num(k));if(indices.size()!=4||distinct.size()!=4)return nullptr;
 return Json{{"indices",indices},{"mode","soft-pull"},{"strength",1.5},{"releaseAfterFrames",std::max(2.,std::min(12.,std::floor(frames*.2+.5)))}};
}
Json buildPpfPayload(const Json& project,const Json& native,const Json& options){
 auto verts=verticesOf(native),staging=stage(project,native,verts,options),shell=geometry(native,verts);shell["objectName"]=str(options,"objectName","PPF_Garment");
 auto s=scene(project,options,90,true);s["staging"]=staging;
 return Json{{"protocol","garment-studio.ppf-shell"},{"version",1},{"project",projectInfo(project)},{"scene",s},{"shell",shell},{"fabrics",fabrics(project)},{"avatar",avatarInfo(project)},{"source",sourceInfo(native)}};
}
Json buildDressedPpfPayload(const Json& project,const Json& native,const Json& result,const Json& options){
 if(str(native,"protocol")!="garment-studio.native-xpbd")throw std::runtime_error("Dressed PPF payload requires a Garment Studio native XPBD payload");
 if(!val(result,"pieces").is_array())throw std::runtime_error("Dressed PPF payload requires a native simulation result with pieces");
 auto shell=geometry(native,verticesOf(native),&result["pieces"]);shell["objectName"]=str(options,"objectName","PPF_Garment");shell["dressed"]=true;shell["welded"]=false;
 auto info=projectInfo(project);info["sourceBackend"]=str(result,"backendId","native-pbd-xpbd");info["sourceFrames"]=field(result,"frames",0);
 auto source=sourceInfo(native);source["nativeBackendId"]=val(result,"backendId");source["nativeFrames"]=field(result,"frames",0);
 return Json{{"protocol","garment-studio.ppf-shell"},{"version",2},{"project",info},{"scene",scene(project,options,90,false)},{"shell",shell},{"fabrics",fabrics(project)},{"avatar",avatarInfo(project)},{"source",source}};
}
Json buildExplodedPpfPayload(const Json& project,const Json& native,const Json& options){
 Json verts=verticesOf(native);std::map<std::string,Json> byId;for(auto& p:arr(project,"pieces"))byId[str(p,"id")]=p;
 auto pieces=arr(native,"pieces");for(size_t index=0;index<pieces.size();++index){auto& p=pieces[index];Json flat=arr(p,"flatVerticesM"),indices=arr(p,"particleIndices");for(size_t i=0;i<indices.size();++i)
  if(integer(indices[i])&&(size_t)num(indices[i])<verts.size())verts[(size_t)num(indices[i])]=explodedVertex(byId[str(p,"id")],i<flat.size()?flat[i]:Json(nullptr),index,options);
 }
 auto shell=geometry(native,verts);shell["objectName"]=str(options,"objectName","PPF_Garment");shell["dressed"]=false;shell["welded"]=false;shell["arrangement"]="exploded";
 auto s=scene(project,options,120,false);shell["temporaryShoulderSupports"]=ppfTemporaryShoulderSupports(pieces,val(obj(project,"simulation"),"ppfShoulderSupports")==true,num(s["frameCount"]));
 auto info=projectInfo(project);info["sourceBackend"]="exploded-pattern-arrangement";info["sourceFrames"]=0;
 return Json{{"protocol","garment-studio.ppf-shell"},{"version",3},{"project",info},{"scene",s},{"shell",shell},{"fabrics",fabrics(project)},{"avatar",avatarInfo(project)},{"source",sourceInfo(native)}};
}
Json validatePpfPayload(const Json& payload){
 Json errors=Json::array(),shell=obj(payload,"shell"),verts=arr(shell,"vertices"),faces=arr(shell,"faces");
 if(str(payload,"protocol")!="garment-studio.ppf-shell")errors.push_back("invalid PPF payload protocol");
 if(verts.size()<3)errors.push_back("PPF shell needs vertices");
 if(faces.empty())errors.push_back("PPF shell needs triangle faces");
 for(size_t i=0;i<verts.size();++i)if(!finiteVec(verts[i]))errors.push_back("PPF vertex "+std::to_string(i)+" must contain three finite coordinates in metres");
 std::set<std::pair<long,long>> faceEdges;
 for(size_t i=0;i<faces.size();++i){auto& f=faces[i];bool valid=f.is_array()&&f.size()==3;if(valid){std::set<long> distinct;for(auto& k:f){if(!integer(k)||num(k)<0||num(k)>=verts.size())valid=false;else distinct.insert((long)num(k));}if(distinct.size()!=3)valid=false;}
  if(!valid){errors.push_back("invalid PPF face "+std::to_string(i)+": "+f.dump());continue;}
  int a=(int)num(f[0]),b=(int)num(f[1]),c=(int)num(f[2]);faceEdges.insert(std::minmax(a,b));faceEdges.insert(std::minmax(b,c));faceEdges.insert(std::minmax(c,a));
  if(finiteVec(verts[a])&&finiteVec(verts[b])&&finiteVec(verts[c])){
   double u[3],v[3];for(int axis=0;axis<3;++axis){u[axis]=num(verts[b][axis])-num(verts[a][axis]);v[axis]=num(verts[c][axis])-num(verts[a][axis]);}
   double cx=u[1]*v[2]-u[2]*v[1],cy=u[2]*v[0]-u[0]*v[2],cz=u[0]*v[1]-u[1]*v[0];
   if(std::hypot(cx,cy,cz)<1e-12)errors.push_back("degenerate PPF triangle "+std::to_string(i));
  }
 }
 std::set<std::pair<long,long>> seen;
 auto edges=arr(shell,"stitchEdges");for(size_t i=0;i<edges.size();++i){auto& e=edges[i];auto a=val(e,"a"),b=val(e,"b"),seam=val(e,"seamId");
  if(!integer(a)||!integer(b)||num(a)<0||num(b)<0||num(a)>=verts.size()||num(b)>=verts.size()||a==b||!seam.is_string()||seam.get<std::string>().empty()){errors.push_back("invalid PPF stitch edge "+std::to_string(i)+": "+e.dump());continue;}
  std::pair<long,long> key={std::min((long)num(a),(long)num(b)),std::max((long)num(a),(long)num(b))};if(seen.count(key))errors.push_back("duplicate PPF stitch pair "+std::to_string(i)+" ("+std::to_string(key.first)+":"+std::to_string(key.second)+")");
  if(faceEdges.count(key))errors.push_back("PPF stitch pair "+std::to_string(i)+" lies on a fabric triangle edge, not a loose seam");seen.insert(key);
 }
 if(str(obj(payload,"avatar"),"mode")=="local-thomas-body-mesh"){auto repr=str(obj(payload,"scene"),"avatarRepresentation");if(repr!="pinned-shell"&&repr!="static")errors.push_back("Thomas PPF payload must explicitly choose pinned-shell or static avatar collision; silent static fallback is unsafe for fit comparisons");}
 return Json{{"ok",errors.empty()},{"errors",errors}};
}
Json ppfPayloadSummary(const Json& payload){auto shell=obj(payload,"shell");return Json{{"pieces",arr(shell,"pieces").size()},{"vertices",arr(shell,"vertices").size()},{"faces",arr(shell,"faces").size()},{"stitchEdges",arr(shell,"stitchEdges").size()},{"fabrics",obj(payload,"fabrics").size()}};}
}
