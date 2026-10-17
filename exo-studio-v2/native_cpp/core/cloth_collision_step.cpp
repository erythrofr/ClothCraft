#include "cloth_collision_step.hpp"
#include "assembled_cloth_snapshot.hpp"
#include "avatar_physics.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <map>
#include <vector>
#include <stdexcept>
namespace garment {
namespace {
double get(const Json& j,const char* k,double fallback){return j.is_object()&&j.contains(k)&&j[k].is_number()?j[k].get<double>():fallback;}
std::array<double,3> point(const Json& a){return {a[0].get<double>(),a[1].get<double>(),a[2].get<double>()};}
Json json(const std::array<double,3>& p){return Json::array({p[0],p[1],p[2]});}
double length(const std::array<double,3>& a){return std::hypot(a[0],a[1],a[2]);}
}
Json stepAuthoredClothCollision(const Json& project,double dt){
 if(!std::isfinite(dt)||dt<=0||dt>1./30.)throw std::invalid_argument("step requires finite 0 < dt <= 1/30");
 const auto snap=buildAssembledClothSnapshot(project),settings=project.value("simulation",Json::object());
 const auto avatar=project.value("avatar",Json::object());
 struct P{std::array<double,3> p,previous;double invMass=1;std::string wrap;double damping=.985;};
 std::vector<P> particles;particles.reserve(snap["particles"].size());
 std::map<std::string,Json> authored;
 for(const auto& piece:project.at("pieces"))authored[piece.at("id").get<std::string>()]=piece;
 for(const auto& src:snap.at("particles")){
  const auto& piece=authored.at(src.at("pieceId").get<std::string>());
  auto pos=point(src.at("position"));
  auto arrangement=piece.value("arrangement3d",Json::object());
  const auto fabrics=project.value("fabrics",Json::object());const auto fabricId=piece.value("fabricId",std::string("main"));
  const Json fabric=fabrics.contains(fabricId)?fabrics.at(fabricId):Json::object();
  particles.push_back({pos,pos,piece.value("frozen3d",false)?0.:1.,arrangement.value("wrap",std::string()),get(fabric,"damping",.985)});
 }
 struct C{size_t a,b;double rest,stiff;};std::vector<C> constraints;
 auto add=[&](const Json& c){if(c.value("type",std::string())=="seam-virtual")return;
  constraints.push_back({c.at("aSimIndex").get<size_t>(),c.at("bSimIndex").get<size_t>(),get(c,"rest",0),get(c,"stiffness",.9)});};
 for(const auto& c:snap.at("clothConstraints"))add(c);
 // buildSimulation interleaves each piece's structural/trim constraints and
 // only then appends seam constraints. This approximation omits virtual seams.
 for(const auto& c:snap.at("seamConstraints"))add(c);
 int substeps=std::clamp((int)std::round(get(settings,"substeps",2)),1,4);
 int iterations=std::max(2,(int)std::ceil(std::clamp(get(settings,"iterations",7),2.,14.)/substeps));
 const double subdt=dt/substeps,gravity=get(settings,"gravity",9.81),g=gravity*subdt*subdt;
 auto clearance=[&](const P& p){Json pos={{"x",p.p[0]},{"y",p.p[1]},{"z",p.p[2]}};return avatar_physics::avatarClearance(pos,avatar,Json{{"wrapMode",p.wrap}});};
 double minClearance=1e9,minYChange=1e9,maxYChange=-1e9;size_t projected=0;
 const bool collisions=settings.value("collisions",true);
 for(int sub=0;sub<substeps;sub++){
  for(auto& p:particles){if(p.invMass<=0)continue;
   for(int axis=0;axis<3;axis++){const double before=p.p[axis],velocity=(p.p[axis]-p.previous[axis])*std::pow(p.damping,1./substeps);p.previous[axis]=before;p.p[axis]+=velocity;}
   p.p[1]-=g;
  }
  for(int iteration=0;iteration<iterations;iteration++){
   auto satisfy=[&](const C& c){auto& a=particles.at(c.a);auto& b=particles.at(c.b);double total=a.invMass+b.invMass;if(total<=0)return;
    std::array<double,3> d{};for(int k=0;k<3;k++)d[k]=b.p[k]-a.p[k];double l=length(d);if(l<=1e-12)return;
    double factor=(l-c.rest)/l*c.stiff;for(int k=0;k<3;k++){a.p[k]+=d[k]*factor*a.invMass/total;b.p[k]-=d[k]*factor*b.invMass/total;}};
   if((iteration+sub)%2==0){for(auto& c:constraints)satisfy(c);}else{for(auto i=constraints.rbegin();i!=constraints.rend();++i)satisfy(*i);}
   for(const auto& c:snap.at("anchorConstraints")){
    auto& p=particles.at(c.at("simIndex").get<size_t>());if(p.invMass<=0)continue;
    auto target=point(c.at("target"));double strength=get(c,"stiffness",.2);std::string axes=c.value("axes",std::string());
    for(int k=0;k<3;k++)if(axes.empty()||(axes=="y"&&k==1)||(axes=="x"&&k==0)||(axes=="xz"&&k!=1))p.previous[k]=p.p[k]+(target[k]-p.p[k])*strength,p.p[k]=p.previous[k];
   }
   if(collisions)for(auto& p:particles){if(p.invMass<=0)continue;
    // The analytic clearance probe is not the JS contact surface. Avoid
    // projecting every vertex a full second margin away from the body.
    const double margin=.0005;
    for(int pass=0;pass<8;pass++){
     const double before=clearance(p);if(before>=margin-1e-5)break;
     std::array<double,3> gradient{};constexpr double epsilon=2e-4;
     for(int k=0;k<3;k++){p.p[k]+=epsilon;double plus=clearance(p);p.p[k]-=2*epsilon;double minus=clearance(p);p.p[k]+=epsilon;gradient[k]=(plus-minus)/(2*epsilon);}
     double norm=length(gradient);if(norm<=1e-10)break;
     double distance=std::clamp((margin-before)/norm,0.,.08);for(int k=0;k<3;k++)p.p[k]+=gradient[k]*distance/(norm);projected++;
    }
   }
  }
 }
 Json output=Json::array();for(size_t i=0;i<particles.size();i++){
  const auto& p=particles[i];const auto start=point(snap["particles"][i]["position"]);
  minYChange=std::min(minYChange,p.p[1]-start[1]);maxYChange=std::max(maxYChange,p.p[1]-start[1]);minClearance=std::min(minClearance,clearance(p));
  for(double v:p.p)if(!std::isfinite(v))throw std::runtime_error("nonfinite simulation state");
  output.push_back({{"position",json(p.p)},{"previous",json(p.previous)},{"invMass",p.invMass}});
 }
 return {{"particles",output},{"particleCount",output.size()},{"minYChange",minYChange},{"maxYChange",maxYChange},
  {"minimumAvatarClearance",minClearance},{"contactProjections",projected},{"collisionsEnabled",collisions},
  {"fullStepParity",false},{"unported",Json::array({"exact JS collideAvatar ellipsoid and friction response","full self-collision graph","wind and airflow","virtual sewing constraints","seam/contact/fuse stabilizers","triangle CCD and optional face contact","strain telemetry and analysis refresh"})}};
}
}
