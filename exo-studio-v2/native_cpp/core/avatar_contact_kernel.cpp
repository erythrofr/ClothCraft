#include "avatar_contact_kernel.hpp"
#include <algorithm>
#include <cmath>
#include <regex>
namespace garment {
namespace {
constexpr double E=1e-6;
double cl(double x,double a,double b){return std::max(a,std::min(b,x));}
double n(const Json& j,const char* k,double d=0){return j.is_object()&&j.contains(k)&&j[k].is_number()?j[k].get<double>():d;}
std::string str(const Json& j,const char* k){return j.is_object()&&j.contains(k)&&j[k].is_string()?j[k].get<std::string>():"";}
double coord(const Json& j,int i){return j.at(i).get<double>();}
struct V {double x,y,z;};
V read(const Json& a){return {coord(a,0),coord(a,1),coord(a,2)};}
Json toJson(V a){return Json::array({a.x,a.y,a.z});}
V add(V a,V b){return {a.x+b.x,a.y+b.y,a.z+b.z};}
V sub(V a,V b){return {a.x-b.x,a.y-b.y,a.z-b.z};}
V mul(V a,double t){return {a.x*t,a.y*t,a.z*t};}
double dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}
double len(V a){return std::sqrt(dot(a,a));}
bool anySeam(const Json& p,const char* pattern){if(!p.contains("seamIds")||!p["seamIds"].is_array())return false;std::regex re(pattern,std::regex_constants::icase);for(const auto& id:p["seamIds"])if(id.is_string()&&std::regex_search(id.get<std::string>(),re))return true;return false;}
struct Kernel{
 Json& p; V pos,prev;double depth,fr;double side;std::string mode;
 Kernel(Json& v,double friction):p(v),pos(read(v.at("position"))),prev(read(v.at("previous"))),depth(n(v,"contactDepth")),fr(friction),side(n(v,"collisionSideZ")),mode(str(v,"wrapMode")){}
 void contact(double d){depth=std::max(depth,d);}
 void damping(double f){prev=add(prev,mul(sub(pos,prev),cl(f,0,1)));}
 void lateral(){double d=std::min(.2,fr*.12);prev.x+=(pos.x-prev.x)*d;prev.z+=(pos.z-prev.z)*d;}
 void ellipse(double cx,double cz,double minY,double maxY,double rx,double rz,double m,double height){
 if(n(p,"invMass",1)<=0||pos.y<minY||pos.y>maxY)return;
 double dx=pos.x-cx,dz=pos.z-cz;rx+=m;rz+=m;double q=dx*dx/(rx*rx)+dz*dz/(rz*rz);
 if(q>=1)return;
 contact((1-std::sqrt(std::max(q,0.)))*std::min(rx,rz));
 double pattern=std::abs(n(p,"patternU",1));bool torso=mode=="front"||mode=="back";
 bool sideSeam=anySeam(p,"side-[lr]|side seam|seam-side");
 bool lowerTorso=torso&&pos.y/std::max(.001,n(p,"avatarHeightScale",1))<1.54&&!sideSeam;
 bool leg=(mode=="left-leg-front"||mode=="left-leg-back"||mode=="right-leg-front"||mode=="right-leg-back");
 bool inner=leg&&anySeam(p,"inseam|rise")&&pos.y>.54*n(p,"avatarHeightScale",1);
 bool lower=(mode=="lower-front"||mode=="lower-back"||leg);
 bool prefer=(torso&&(pattern<.78||lowerTorso))||(lower&&(!p.value("seamBoundary",false)||inner)&&pattern<.92);
 if(q<=E||prefer){double zSide=side!=0?side:(prev.z>cz?1:prev.z<cz?-1:1);pos.z=cz+zSide*rz;}
 else{double s=1/std::sqrt(q);pos.x=cx+dx*s;pos.z=cz+dz*s;}
 lateral();
 }
 void ellipsoid(V center,V radius,double margin,bool preserve=false,bool limited=false,double maxLateral=.018){
 if(n(p,"invMass",1)<=0)return;
 V r=add(radius,{margin,margin,margin});
 V d=sub(pos,center);
 if(preserve||limited){
 double ny=d.y/std::max(E,r.y);if(std::abs(ny)>=1)return;
 double cs=std::sqrt(std::max(E,1-ny*ny)),sx=r.x*cs,sz=r.z*cs;
 double q=d.x*d.x/(sx*sx)+d.z*d.z/(sz*sz);if(q>=1)return;
 if(limited){
 double zSide=side!=0?side:(d.z>0?1:d.z<0?-1:1),tx,tz;
 if(q<=E||std::abs(n(p,"patternU",1))<.78){tx=pos.x;tz=center.z+zSide*sz*std::sqrt(std::max(0.,1-d.x*d.x/(sx*sx)));}
 else{double s=1/std::sqrt(std::max(q,E));tx=center.x+d.x*s;tz=center.z+d.z*s;}
 double mx=tx-pos.x,mz=tz-pos.z,dist=std::hypot(mx,mz),amount=std::min(1.,std::max(.001,maxLateral)/std::max(dist,E));
 contact(dist);pos.x+=mx*amount;pos.z+=mz*amount;lateral();
 }else{
 contact((1-std::sqrt(std::max(q,0.)))*std::min(sx,sz));
 if(q<=E||std::abs(n(p,"patternU",1))<.78){double zSide=side!=0?side:(prev.z>center.z?1:prev.z<center.z?-1:1);pos.z=center.z+zSide*sz;}
 else{double s=1/std::sqrt(std::max(q,E));pos.x=center.x+d.x*s;pos.z=center.z+d.z*s;}
 lateral();
 }
 return;
 }
 double q=d.x*d.x/(r.x*r.x)+d.y*d.y/(r.y*r.y)+d.z*d.z/(r.z*r.z);
 if(q>=1||q<=E)return;
 double norm=std::sqrt(q);contact((1-norm)*std::min({r.x,r.y,r.z}));pos=add(center,mul(d,1/norm));damping(cl(fr*.08,0,.16));
 }
 void capsule(V center,V axis,double half,double radius,double m){
 if(n(p,"invMass",1)<=0)return;
 V start=sub(center,mul(axis,half)),end=add(center,mul(axis,half)),segment=sub(end,start);
 double t=cl(dot(sub(pos,start),segment)/std::max(E,dot(segment,segment)),0,1);
 V closest=add(start,mul(segment,t)),delta=sub(pos,closest);double distance=len(delta),r=radius+m;
 if(distance>=r)return;contact(r-distance);
 if(distance<=E)delta={0,0,side!=0?side:1};else delta=mul(delta,1/distance);
 pos=add(closest,mul(delta,r));damping(cl(fr*.1,0,.18));
 }
 void done(){p["position"]=toJson(pos);p["previous"]=toJson(prev);p["contactDepth"]=depth;}
};
}
Json collideAvatarParticle(Json particle,const Json& avatar,double margin,double friction){
 Kernel k(particle,friction);auto& pos=k.pos;double h=cl(n(avatar,"heightCm",180)/180,.78,1.22);
 double chest=cl(n(avatar,"chestCm",96)/96,.72,1.42),waist=cl(n(avatar,"waistCm",78)/78,.68,1.5),hip=cl(n(avatar,"hipCm",94)/94,.72,1.42);
 double shoulderHalf=cl(n(avatar,"shoulderWidthCm",46),34,62)*.005,scx=shoulderHalf+.01,scy=.15*h,scz=.135*chest,shoulderY=1.57*h;
 double neck=cl(n(avatar,"neckCm",38),28,58)/38*.075,neckY=1.72*h,armRadius=.065*cl(n(avatar,"bicepCm",32),20,60)/32,half=cl(n(avatar,"armLengthCm",72*h),42,86)*.005;
 bool torso=k.mode=="front"||k.mode=="back",leg=k.mode.rfind("left-leg-",0)==0||k.mode.rfind("right-leg-",0)==0;
 double start=cl(n(avatar,"legTorsoCollisionStartY",.76),.56,.8)*h;
 if(pos.y>=.56*h&&pos.y<=1.49*h&&(!leg||pos.y>=start)){
  double y=pos.y/h,rx,rz;
  if(y>=1.45){double bulge=std::max(0.,1-std::abs(y-1.57)/.18);rx=(.19+.05*bulge)*chest;rz=(.13+.012*bulge)*chest;}
  else if(y>=1.08){double t=cl((y-1.08)/.5,0,1);rx=.155*waist+(.19*chest-.155*waist)*t;rz=.105*waist+(.13*chest-.105*waist)*t;}
  else{double t=cl((y-.60)/.48,0,1);rx=.20*hip+(.155*waist-.20*hip)*t;rz=.14*hip+(.105*waist-.14*hip)*t;}
  k.ellipse(0,0,.56*h,1.49*h,rx,rz,margin,h);
 }
 auto shoulderMode=str(avatar,"shoulderContactMode");
 bool adaptive=shoulderMode=="adaptive-limited-lateral"&&n(avatar,"heightCm",180)>=175&&n(avatar,"heightCm",180)<=190;
 V center{0,shoulderY,0},r{scx,scy,scz};
 bool shoulderSeam=anySeam(particle,"shoulder");
 bool cap=torso?(shoulderSeam||n(particle,"patternV",1)>=.86):((k.mode=="left-arm"||k.mode=="right-arm")?n(particle,"patternV",1)>=.72:pos.y>=shoulderY-scy*.45);
 if((shoulderMode=="limited-lateral"||adaptive)&&torso)k.ellipsoid(center,r,margin,false,true,n(avatar,"shoulderMaxLateralCorrectionM",.018));
 else if(shoulderMode=="lateral"&&torso&&n(particle,"patternV",1)>=n(avatar,"shoulderLateralPatternV"))k.ellipsoid(center,r,margin,true);
 else if(cap)k.ellipsoid(center,r,margin);
 else if(torso)k.ellipsoid(center,r,margin,true);
 bool bodice=torso&&pos.y>shoulderY-scy*1.15&&std::abs(pos.x)<shoulderHalf+.025;
 if(!bodice)for(int side:{-1,1}){
  double angle=cl(n(avatar,"armAngleDeg",6),0,80)*3.14159265358979323846/180,rotation=side*angle;
  V axis{-std::sin(rotation),std::cos(rotation),0},joint{side*(shoulderHalf+armRadius*.26),1.54*h,0};
  k.capsule(sub(joint,mul(axis,half)),axis,half,armRadius,margin);
 }
 if(!torso||std::abs(pos.x)<neck*.86||pos.y>1.735*h)k.ellipsoid({0,neckY,0},{neck,.14*h,neck},margin);
 if(!torso||pos.y>1.755*h)k.ellipsoid({0,1.88*h,0},{.15,.19*h,.15},margin);
 bool left=k.mode.rfind("left-leg",0)==0,right=k.mode.rfind("right-leg",0)==0;
 bool inner=(left||right)&&anySeam(particle,"inseam|rise")&&pos.y>.54*h;
 if(left&&!inner)k.ellipsoid({-.105,.24*h,0},{.09,.48*h,.10},margin);
 else if(right&&!inner)k.ellipsoid({.105,.24*h,0},{.09,.48*h,.10},margin);
 else if(!left&&!right){k.ellipsoid({-.105,.24*h,0},{.09,.48*h,.10},margin);k.ellipsoid({.105,.24*h,0},{.09,.48*h,.10},margin);}
 if(pos.y<.01)pos.y=.01;k.done();return particle;
}
}
