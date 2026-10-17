#include "cloth_simulation.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <stdexcept>
#include <string>
namespace garment {
namespace {
Json get(const Json& x,const char* name,Json d=nullptr){return x.is_object()&&x.contains(name)&&!x[name].is_null()?x[name]:d;}
double number(const Json& x,double fallback=0){return x.is_number()?x.get<double>():fallback;}
double at(const Json& x,const char* k,double d){return number(get(x,k),d);}
std::string name(const Json& x,const char* k){auto y=get(x,k);return y.is_string()?y.get<std::string>():"";}
bool flag(const Json& x,const char* k,bool fallback){auto y=get(x,k);return y.is_boolean()?y.get<bool>():fallback;}
Json array(const Json& x,const char* k){auto y=get(x,k);return y.is_array()?y:Json::array();}
Json object(const Json& x,const char* k){auto y=get(x,k);return y.is_object()?y:Json::object();}
bool vec(const Json& p){return p.is_array()&&p.size()==3&&p[0].is_number()&&p[1].is_number()&&p[2].is_number();}
double distance(const Json& a,const Json& b){double sum=0;for(int i=0;i<3;++i){double diff=number(a[i])-number(b[i]);sum+=diff*diff;}return std::sqrt(sum);}
size_t index(const Json& v,size_t size){if(!v.is_number_integer()||v.get<long long>()<0||(size_t)v.get<long long>()>=size)throw std::runtime_error("invalid global particle index");return (size_t)v.get<long long>();}
}
Json buildSimulation(const Json& project,const Json& snapshot){
 if(!snapshot.is_object()||!get(snapshot,"particles").is_array()||!get(snapshot,"constraints").is_array())throw std::runtime_error("buildSimulation requires a premeshed typed JSON snapshot with particles and constraints");
 Json out=snapshot;Json particles=out["particles"];for(auto& p:particles){if(!vec(get(p,"position")))throw std::runtime_error("premeshed particle position must be a metre-space vec3");if(!vec(get(p,"previous")))p["previous"]=p["position"];if(!p.contains("invMass"))p["invMass"]=1;}
 out["particles"]=particles;if(!out.contains("anchors"))out["anchors"]=Json::array();
 if(!out.contains("elapsed"))out["elapsed"]=0;
 if(!out.contains("maxThickness")){double t=.001;auto fabrics=object(project,"fabrics");for(auto it=fabrics.begin();it!=fabrics.end();++it)t=std::max(t,at(it.value(),"thickness",.002));out["maxThickness"]=t;}
 out["adapter"]={{"source","premeshed-js-simulation"},{"fullParity",false},{"unported",Json::array({"pattern triangulation","curve edge sampling","native sewing compilation","live THREE objects","self collision","avatar contact","wind","virtual seams","surface attachments","fit quality metrics"})}};
 return out;
}
Json stepSimulation(const Json& simulation,const Json& project,double dt){
 if(!std::isfinite(dt)||dt<0)throw std::runtime_error("Invalid simulation dt");
 if(dt==0)return simulation;
 Json settings=object(project,"simulation");
 if(flag(settings,"selfCollision",true)||flag(settings,"collisions",true))throw std::runtime_error("C++ cloth step does not yet support self/avatar collisions; disable both explicitly");
 if(flag(object(settings,"wind"),"enabled",false)&&at(object(settings,"wind"),"speed",0)>.01)throw std::runtime_error("C++ cloth step does not yet support wind");
 if(flag(settings,"continuousSurfaceContact",false))throw std::runtime_error("C++ cloth step does not yet support continuous surface contact");
 Json state=simulation,particles=array(state,"particles"),constraints=array(state,"constraints"),anchors=array(state,"anchors");
 for(auto& c:constraints){auto type=name(c,"type");if(type=="seam-virtual"||(type=="surface-stitch"&&get(c,"targetParticles").is_array()))throw std::runtime_error("C++ cloth step does not yet support virtual seams or surface attachment projection");}
 double thickness=at(state,"maxThickness",.002),gravity=at(settings,"gravity",9.81);
 if(!std::isfinite(thickness)||thickness<0)throw std::runtime_error("Invalid maximum cloth thickness");
 if(!std::isfinite(gravity)||gravity<0)throw std::runtime_error("Invalid simulation gravity");
 double safeDt=std::min(dt,1./30.);
 int substeps=(int)std::clamp(std::floor(at(settings,"substeps",1)+.5),1.,4.);
 double subDt=safeDt/substeps,gravityStep=gravity*subDt*subDt;
 int iterations=(int)std::max(2.,std::ceil(std::clamp(at(settings,"iterations",7),2.,14.)/substeps));
 auto pieces=array(state,"pieces");
 std::map<size_t,double> damping;
 for(auto& piece:pieces){auto fabric=object(piece,"fabric");for(auto& id:array(piece,"particleIndices"))damping[index(id,particles.size())]=at(fabric,"damping",.985);}
 for(auto& p:particles){if(!vec(get(p,"position"))||!vec(get(p,"previous")))throw std::runtime_error("particle coordinates must be metre-space vec3");p["contactDepth"]=0;}
 for(int sub=0;sub<substeps;++sub){
  for(size_t i=0;i<particles.size();++i){auto& p=particles[i];if(at(p,"invMass",1)<=0)continue;double damp=std::pow(damping.count(i)?damping[i]:at(p,"damping",.985),1./substeps);
   auto pos=p["position"],previous=p["previous"];for(int axis=0;axis<3;++axis)p["position"][axis]=number(pos[axis])+(number(pos[axis])-number(previous[axis]))*damp;
   p["position"][1]=number(p["position"][1])-gravityStep;p["previous"]=pos;
  }
  for(int iter=0;iter<iterations;++iter){
   for(size_t order=0;order<constraints.size();++order){auto& c=constraints[(iter+sub)%2==0?order:constraints.size()-1-order];
    auto ia=index(get(c,"a"),particles.size()),ib=index(get(c,"b"),particles.size());
    auto& a=particles[ia];auto& b=particles[ib];double wa=at(a,"invMass",1),wb=at(b,"invMass",1),total=wa+wb;
    if(total<=1e-6)continue;double len=distance(a["position"],b["position"]);if(len<=1e-6)continue;
    double correction=(len-at(c,"rest",0))/len*at(c,"stiffness",1);
    for(int axis=0;axis<3;++axis){double delta=(number(b["position"][axis])-number(a["position"][axis]))*correction;
     if(name(c,"type")=="fuse"){if(wa>0)a["position"][axis]=number(a["position"][axis])+delta;}
     else{if(wa>0)a["position"][axis]=number(a["position"][axis])+delta*wa/total;if(wb>0)b["position"][axis]=number(b["position"][axis])-delta*wb/total;}
    }
   }
   for(auto& anchor:anchors){auto i=index(get(anchor,"particle"),particles.size());auto& p=particles[i];if(at(p,"invMass",1)<=0)continue;
    auto target=get(anchor,"target");if(!vec(target))throw std::runtime_error("anchor target must be vec3");
    std::string axes=name(anchor,"axes");double stiffness=at(anchor,"stiffness",1);
    for(int axis=0;axis<3;++axis){if((axes=="x"&&axis!=0)||(axes=="y"&&axis!=1)||(axes=="xz"&&axis==1))continue;
      p["position"][axis]=number(p["position"][axis])+(number(target[axis])-number(p["position"][axis]))*stiffness;p["previous"][axis]=p["position"][axis];}
   }
  }
 }
 state["particles"]=particles;state["elapsed"]=at(state,"elapsed",0)+safeDt;
 return state;
}
}
