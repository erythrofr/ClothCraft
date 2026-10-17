#include "cloth_solver_step_contacts.hpp"
#include "cloth_simulation.hpp"
#include "avatar_contact_kernel.hpp"
#include "self_collision.hpp"
#include <stdexcept>
#include <cmath>
#include <algorithm>
namespace garment::cloth_solver_step_contacts {
namespace {
double number(const Json& j,const char* k,double d=0){return j.is_object()&&j.contains(k)&&j[k].is_number()?j[k].get<double>():d;}
void selfContact(Json& state,double distance){
 Json sim=Json::object();sim["pieces"]=Json::object();
 sim["fusedPiecePairs"]=state.value("fusedPiecePairs",Json::array());
 sim["collisionExclusions"]=state.value("collisionExclusions",Json::array());
 for(const auto& piece:state.at("pieces")){auto& arr=sim["pieces"][piece.at("id").get<std::string>()]["particles"];arr=Json::array();
  for(const auto& id:piece.at("particleIndices")){auto idx=id.get<size_t>();Json p=state["particles"][idx];p["pieceId"]=piece["id"];p["simIndex"]=idx;
   const auto pos=p["position"];p["position"]={{"x",pos[0]},{"y",pos[1]},{"z",pos[2]}};arr.push_back(p);}
 }
 garment::resolveSelfCollisions(sim,distance);
 for(const auto& piece:state.at("pieces")){const auto& arr=sim["pieces"][piece.at("id").get<std::string>()]["particles"];
  for(size_t i=0;i<arr.size();++i){const auto idx=piece["particleIndices"][i].get<size_t>();const auto& pos=arr[i]["position"];state["particles"][idx]["position"]={pos["x"],pos["y"],pos["z"]};}}
}
void avatarContact(Json& state,const Json& project,const Json& settings,bool movableOnly=false){
 for(const auto& piece:state.at("pieces")){const auto fabric=piece.value("fabric",Json::object());
  const double friction=number(fabric,"friction",.3),thickness=number(fabric,"thickness",.002),layer=number(piece,"layerIndex",0);
  const double margin=number(settings,"collisionMargin",.012)+thickness+layer*std::max(.0025,thickness*1.15);
  for(const auto& id:piece.at("particleIndices")){const auto idx=id.get<size_t>();if(movableOnly&&number(state["particles"][idx],"invMass",1)<=0)continue;state["particles"][idx]=garment::collideAvatarParticle(state["particles"][idx],project.value("avatar",Json::object()),margin,friction);}
 }
}
double dist(const Json& a,const Json& b){double v=0;for(int axis=0;axis<3;++axis){double d=a[axis].get<double>()-b[axis].get<double>();v+=d*d;}return std::sqrt(v);}
void closure(Json& a,Json& b,const Json& constraint,double stiffness){
 const double wa=number(a,"invMass",1),wb=number(b,"invMass",1),total=wa+wb;if(total<=1e-6)return;
 const double distance=dist(a["position"],b["position"]);if(distance<=1e-6)return;
 const double factor=(distance-number(constraint,"rest"))/distance*stiffness;
 for(int axis=0;axis<3;++axis){double delta=(b["position"][axis].get<double>()-a["position"][axis].get<double>())*factor;
  if(wa>0)a["position"][axis]=a["position"][axis].get<double>()+delta*wa/total;
  if(wb>0)b["position"][axis]=b["position"][axis].get<double>()-delta*wb/total;}
}
void stabilize(Json& state,const Json& project,const Json& settings){
 auto& particles=state["particles"];
 for(const auto& index:state.value("seamIndices",Json::array())){
  const auto& c=state["constraints"][index.get<size_t>()];
  const auto type=c.value("type",std::string());if(type=="seam-virtual"||type=="surface-stitch")continue;
  auto& a=particles[c.at("a").get<size_t>()];auto& b=particles[c.at("b").get<size_t>()];
  if(dist(a["position"],b["position"])<=std::max(.025,number(c,"rest")*2.5))continue;
  const auto lower=[](const Json& p){const std::string m=p.value("wrapMode",std::string());return m=="lower-front"||m=="lower-back"||m=="left-leg-front"||m=="left-leg-back"||m=="right-leg-front"||m=="right-leg-back";};
  if(lower(a)||lower(b)){closure(a,b,c,std::max(number(c,"stiffness",1),.82));continue;}
  Json proxy={{"position",Json::array()},{"previous",Json::array()},{"invMass",1},{"wrapMode",""},{"patternU",1},{"contactDepth",0}};
  for(int axis=0;axis<3;++axis){proxy["position"].push_back((a["position"][axis].get<double>()+b["position"][axis].get<double>())*.5);proxy["previous"].push_back((a["previous"][axis].get<double>()+b["previous"][axis].get<double>())*.5);}
  const double z=proxy["position"][2].get<double>();proxy["collisionSideZ"]=z>0?1:z<0?-1:(number(a,"collisionSideZ")!=0?number(a,"collisionSideZ"):number(b,"collisionSideZ",1));
  double thickness=std::max(number(a,"thickness",.002),number(b,"thickness",.002));double layer=std::max(number(a,"layerIndex"),number(b,"layerIndex"));
  const double margin=number(settings,"collisionMargin",.012)+thickness+layer*std::max(.0025,thickness*1.15);
  const double friction=std::max(number(a,"friction",.3),number(b,"friction",.3));
  const auto moved=garment::collideAvatarParticle(proxy,project.value("avatar",Json::object()),margin,friction);
  double length=0,delta[3];for(int axis=0;axis<3;++axis){delta[axis]=moved["position"][axis].get<double>()-proxy["position"][axis].get<double>();length+=delta[axis]*delta[axis];}
  length=std::sqrt(length);const double scale=length>.04?.04/length:1;
  for(int axis=0;axis<3;++axis){if(number(a,"invMass",1)>0)a["position"][axis]=a["position"][axis].get<double>()+delta[axis]*scale;if(number(b,"invMass",1)>0)b["position"][axis]=b["position"][axis].get<double>()+delta[axis]*scale;}
  const double hs=std::clamp(number(project.value("avatar",Json::object()),"heightCm",180)/180.,.78,1.22);
  const auto shoulder=[&](const Json& p){auto m=p.value("wrapMode",std::string());return(m=="front"||m=="back"||m=="left-arm"||m=="right-arm")&&p["position"][1].get<double>()>(1.57-.17)*hs;};
  const bool upper=number(project.value("avatar",Json::object()),"heightCm",180)<195&&(shoulder(a)||shoulder(b));
  closure(a,b,c,upper?std::min(number(c,"stiffness",1),.35):.995);
 }
 for(auto& p:particles){double side=number(p,"constructionSideZ");if(side!=-1&&side!=1)continue;
  for(const char* key:{"position","previous"})if(p[key][2].get<double>()*side<0)p[key][2]=side*std::abs(p[key][2].get<double>());}
 for(const auto& id:state.value("fuseIndices",Json::array())){
  const auto& c=state["constraints"][id.get<size_t>()];auto& source=particles[c.at("a").get<size_t>()];auto& target=particles[c.at("b").get<size_t>()];if(number(source,"invMass",1)<=0)continue;
  double d=dist(source["position"],target["position"]);if(d<=.0015)continue;double f=d>.015?.92:.78;
  for(int axis=0;axis<3;++axis){double x=(target["position"][axis].get<double>()-source["position"][axis].get<double>())*f;source["position"][axis]=source["position"][axis].get<double>()+x;source["previous"][axis]=source["previous"][axis].get<double>()+x;}
 }
}
}
Json step(const Json& snapshot,const Json& project,double dt,int frames){
 if(frames<0||frames>120||!std::isfinite(dt)||dt<0)throw std::invalid_argument("Invalid step arguments");
 Json state=snapshot;
 Json settings=project.value("simulation",Json::object());
 if(!settings.is_object())throw std::invalid_argument("Invalid simulation settings");
 if(settings.value("continuousSurfaceContact",false)||settings.value("bodyTriangleContactAssist",false))throw std::runtime_error("unsupported surface contact corrections");
 if(settings.value("wind",Json::object()).value("enabled",false))throw std::runtime_error("unsupported wind");
 const bool avatar=settings.value("collisions",true),self=settings.value("selfCollision",true);
 for(int frame=0;frame<frames;++frame){
  if(dt==0)continue;
  auto& particles=state["particles"];const auto& constraints=state["constraints"];
  const double safeDt=std::min(dt,1./30.);
  const int substeps=(int)std::clamp(std::floor(number(settings,"substeps",1)+.5),1.,4.);
  const double subDt=safeDt/substeps,gravityStep=number(settings,"gravity",9.81)*subDt*subDt;
  const int iterations=(int)std::max(2.,std::ceil(std::clamp(number(settings,"iterations",7),2.,14.)/substeps));
  const double minDistance=state.value("maxThickness",.002)*2+number(settings,"selfCollisionMargin",.002);
  for(auto& p:particles)p["contactDepth"]=0;
  for(int sub=0;sub<substeps;++sub){
   for(const auto& piece:state.at("pieces")){double damping=std::pow(number(piece.value("fabric",Json::object()),"damping",.985),1./substeps);
    for(const auto& id:piece.at("particleIndices")){auto& p=particles[id.get<size_t>()];if(number(p,"invMass",1)<=0)continue;
     const auto pos=p["position"],prev=p["previous"];
     for(int axis=0;axis<3;++axis)p["position"][axis]=pos[axis].get<double>()+(pos[axis].get<double>()-prev[axis].get<double>())*damping;
     p["previous"]=pos;p["position"][1]=p["position"][1].get<double>()-gravityStep;
    }
   }
   for(int iter=0;iter<iterations;++iter){
    for(size_t j=0;j<constraints.size();++j){const auto& c=constraints[(iter+sub)%2==0?j:constraints.size()-1-j];
     size_t ia=c.at("a").get<size_t>(),ib=c.at("b").get<size_t>();auto& a=particles[ia];auto& b=particles[ib];
     double wa=number(a,"invMass",1),wb=number(b,"invMass",1),total=wa+wb;if(total<=1e-6)continue;
     const double length=dist(a["position"],b["position"]);if(length<=1e-6)continue;
     const double correction=(length-number(c,"rest"))/length*number(c,"stiffness",1);
     for(int axis=0;axis<3;++axis){const double d=(b["position"][axis].get<double>()-a["position"][axis].get<double>())*correction;
      if(c.value("type",std::string())=="fuse"){if(wa>0)a["position"][axis]=a["position"][axis].get<double>()+d;}
      else{if(wa>0)a["position"][axis]=a["position"][axis].get<double>()+d*wa/total;if(wb>0)b["position"][axis]=b["position"][axis].get<double>()-d*wb/total;}
     }
    }
    for(const auto& anchor:state.value("anchors",Json::array())){auto& p=particles[anchor.at("particle").get<size_t>()];if(number(p,"invMass",1)<=0)continue;
     const std::string axes=anchor.value("axes",std::string());double stiffness=number(anchor,"stiffness",1);
     for(int axis=0;axis<3;++axis){if((axes=="x"&&axis!=0)||(axes=="y"&&axis!=1)||(axes=="xz"&&axis==1))continue;
      p["position"][axis]=p["position"][axis].get<double>()+(anchor["target"][axis].get<double>()-p["position"][axis].get<double>())*stiffness;p["previous"][axis]=p["position"][axis];}
    }
    if(self)selfContact(state,minDistance);
    if(avatar){
     avatarContact(state,project,settings);
     if(state.value("traceStages",false)&&frame==0&&sub==0&&iter==0)state["stageTrace"].push_back(Json{{"stage","first-contact"},{"particles",particles}});
     if(settings.value("stabilizeSeamPairs",true))stabilize(state,project,settings);
     if(state.value("traceStages",false)&&frame==0&&sub==0&&iter==0)state["stageTrace"].push_back(Json{{"stage","stabilized"},{"particles",particles}});
     avatarContact(state,project,settings,true);
     if(state.value("traceStages",false)&&frame==0&&sub==0&&iter==0)state["stageTrace"].push_back(Json{{"stage","second-contact"},{"particles",particles}});
    }
   }
  }
  state["elapsed"]=number(state,"elapsed")+safeDt;
 }
 state["contactStepAdapter"]={{"fullStepParity",false},{"contactOrdering","per-substep per-constraint-iteration"},{"missing","post-contact seam and attachment stabilization"},{"triangleCcdVerified",false}};
 return state;
}
}
