#include "avatar_physics.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <vector>
namespace garment::avatar_physics {
static double clamp(double v,double lo,double hi){return std::max(lo,std::min(hi,v));}
static double num(const Json& o,const char* k,double def){if(!o.is_object()||!o.contains(k)||o[k].is_null())return def; if(o[k].is_number())return o[k].get<double>(); if(o[k].is_boolean())return o[k].get<bool>()?1:0;if(o[k].is_string()){try{return std::stod(o[k].get<std::string>());}catch(...){return std::numeric_limits<double>::quiet_NaN();}}return def;}
static double v(const Json& p,const char* k){return num(p,k,0);}
static Json vec(double x,double y,double z){return Json{{"x",x},{"y",y},{"z",z}};}
static double dist(double x,double y,double z){return std::sqrt(x*x+y*y+z*z);}
double getAvatarHeightScale(const Json& a){return clamp(num(a,"heightCm",180)/180,0.78,1.22);}
Json getAvatarUpperBodyDimensions(const Json& a){
 double h=getAvatarHeightScale(a), chest=clamp(num(a,"chestCm",96)/96,.72,1.42);
 double sw=clamp(num(a,"shoulderWidthCm",46),34,62),neck=clamp(num(a,"neckCm",38),28,58),bi=clamp(num(a,"bicepCm",32),20,60),len=clamp(num(a,"armLengthCm",72*h),42,86);
 double half=sw*.005,rad=.065*bi/32;
 return Json{{"heightScale",h},{"chestScale",chest},{"shoulderWidthCm",sw},{"shoulderHalfWidth",half},{"shoulderCapRadiusX",half+.01},{"shoulderCapRadiusY",.15*h},{"shoulderCapRadiusZ",.135*chest},{"shoulderCenterY",1.57*h},{"shoulderJointY",1.54*h},{"neckCm",neck},{"neckRadius",.075*neck/38},{"neckRadiusY",.14*h},{"neckCenterY",1.72*h},{"bicepCm",bi},{"armRadius",rad},{"armLengthCm",len},{"armHalfLength",len*.005}};
}
Json getAvatarArmPose(const Json& a,double side){
 auto u=getAvatarUpperBodyDimensions(a);double s=side<0?-1:1,ang=clamp(num(a,"armAngleDeg",6),0,80)*std::acos(-1)/180,rot=s*ang;
 double ax=-std::sin(rot),ay=std::cos(rot),half=u["armHalfLength"].get<double>(),rad=u["armRadius"].get<double>();
 Json joint=vec(s*(u["shoulderHalfWidth"].get<double>()+rad*.26),u["shoulderJointY"],0);
 return Json{{"side",s},{"angle",ang},{"rotationZ",rot},{"axis",vec(ax,ay,0)},{"center",vec(v(joint,"x")-ax*half,v(joint,"y")-ay*half,0)},{"halfLength",half},{"radius",rad},{"shoulderJoint",joint}};
}
Json getAvatarTorsoRadii(const Json& a,double y){
 double h=getAvatarHeightScale(a),ch=clamp(num(a,"chestCm",96)/96,.72,1.42),wa=clamp(num(a,"waistCm",78)/78,.68,1.5),hip=clamp(num(a,"hipCm",94)/94,.72,1.42); y/=h;
 if(y>=1.45){double bulge=std::max(0.,1-std::abs(y-1.57)/.18);return Json{{"x",(.19+.05*bulge)*ch},{"z",(.13+.012*bulge)*ch}};}
 if(y>=1.08){double t=clamp((y-1.08)/.5,0,1);return Json{{"x",.155*wa*(1-t)+.19*ch*t},{"z",.105*wa*(1-t)+.13*ch*t}};}
 double t=clamp((y-.60)/.48,0,1);return Json{{"x",.20*hip*(1-t)+.155*wa*t},{"z",.14*hip*(1-t)+.105*wa*t}};
}
Json boundaryIndicesForEdge(const Json& piece,int edgeIndex){
 Json out=Json::array();if(!piece.contains("edgePaths")||!piece["edgePaths"].is_array()||edgeIndex<0||edgeIndex>=int(piece["edgePaths"].size()))return out;
 const auto& path=piece["edgePaths"][edgeIndex];if(!path.is_array()||path.empty())return out;
 std::vector<std::pair<double,int>> hits;int index=0;
 for(const auto& p:piece.at("flatVertices")){double along=0;
 for(size_t i=1;i<path.size();++i){auto a=path[i-1],b=path[i];double dx=v(b,"x")-v(a,"x"),dy=v(b,"y")-v(a,"y"),ls=dx*dx+dy*dy,seg=std::sqrt(ls);
 if(ls>=1e-6){double t=((v(p,"x")-v(a,"x"))*dx+(v(p,"y")-v(a,"y"))*dy)/ls;
 double tc=clamp(t,0,1);if(t>=-.003&&t<=1.003&&std::hypot(v(p,"x")-v(a,"x")-tc*dx,v(p,"y")-v(a,"y")-tc*dy)<=.003){hits.emplace_back(along+tc*seg,index);break;}}
 along+=seg;}++index;}
 std::stable_sort(hits.begin(),hits.end(),[](auto& a,auto& b){return a.first<b.first;});for(auto& hit:hits)out.push_back(hit.second);return out;
}
static double ellipsoid(const Json& p,double cx,double cy,double cz,double rx,double ry,double rz){double q=dist((v(p,"x")-cx)/rx,(v(p,"y")-cy)/ry,(v(p,"z")-cz)/rz);return(q-1)*std::min({rx,ry,rz});}
static double capsule(const Json& p,const Json& pose){auto center=pose["center"],axis=pose["axis"];double half=pose["halfLength"],sx=v(center,"x")-v(axis,"x")*half,sy=v(center,"y")-v(axis,"y")*half,sz=v(center,"z")-v(axis,"z")*half,dx=v(axis,"x")*2*half,dy=v(axis,"y")*2*half,dz=v(axis,"z")*2*half,t=clamp(((v(p,"x")-sx)*dx+(v(p,"y")-sy)*dy+(v(p,"z")-sz)*dz)/std::max(1e-6,dx*dx+dy*dy+dz*dz),0,1);return dist(v(p,"x")-sx-t*dx,v(p,"y")-sy-t*dy,v(p,"z")-sz-t*dz)-pose["radius"].get<double>();}
double avatarClearance(const Json& p,const Json& a,const Json& particle){
 auto u=getAvatarUpperBodyDimensions(a);double h=u["heightScale"],y=v(p,"y"),x=v(p,"x");std::vector<double> clear;
 if(y>=.56*h&&y<=1.49*h){auto r=getAvatarTorsoRadii(a,y);double rx=r["x"],rz=r["z"];clear.push_back((std::hypot(x/rx,v(p,"z")/rz)-1)*std::min(rx,rz));}
 std::string wrap=particle.is_object()?particle.value("wrapMode",std::string()):"";double pv=num(particle,"patternV",1);bool cap=false;
 if(wrap=="front"||wrap=="back"){bool seam=false;if(particle.contains("seamIds")&&particle["seamIds"].is_array())for(const auto& id:particle["seamIds"])if(id.is_string()){auto s=id.get<std::string>();std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return std::tolower(c);});if(s.find("shoulder")!=std::string::npos)seam=true;}cap=seam||pv>=.86;}
 else if(wrap=="left-arm"||wrap=="right-arm")cap=pv>=.72;
 else cap=num(particle,"y",y)>=u["shoulderCenterY"].get<double>()-u["shoulderCapRadiusY"].get<double>()*.45;
 if(cap)clear.push_back(ellipsoid(p,0,u["shoulderCenterY"],0,u["shoulderCapRadiusX"],u["shoulderCapRadiusY"],u["shoulderCapRadiusZ"]));
 bool bodice=(wrap=="front"||wrap=="back")&&y>u["shoulderCenterY"].get<double>()-u["shoulderCapRadiusY"].get<double>()*1.15&&std::abs(x)<u["shoulderHalfWidth"].get<double>()+.025;
 if(!bodice&&y>=.76*h&&y<=1.57*h){clear.push_back(capsule(p,getAvatarArmPose(a,-1)));clear.push_back(capsule(p,getAvatarArmPose(a,1)));}
 clear.push_back(ellipsoid(p,0,u["neckCenterY"],0,u["neckRadius"],u["neckRadiusY"],u["neckRadius"]));
 clear.push_back(ellipsoid(p,0,1.88*h,0,.15,.19*h,.15));
 clear.push_back(ellipsoid(p,-.105,.24*h,0,.09,.48*h,.10));
 clear.push_back(ellipsoid(p,.105,.24*h,0,.09,.48*h,.10));
 return *std::min_element(clear.begin(),clear.end());
}
Json measureAvatarSurfaceIntrusion(const Json& sim,const Json& avatar,const Json& options){
 double eps=std::max(0.,num(options,"epsilonM",.0005));Json result={{"facesChecked",0},{"samplesChecked",0},{"penetratingSamples",0},{"penetratingFaces",0},{"maximumIntrusionMm",0.0},{"byPiece",Json::object()}};
 const double weights[4][3]={{1./3,1./3,1./3},{.5,.5,0},{0,.5,.5},{.5,0,.5}};
 for(const auto& piece:sim.at("pieces")){Json metrics={{"facesChecked",0},{"penetratingFaces",0},{"penetratingSamples",0},{"maximumIntrusionMm",0.0}};const auto& particles=piece.at("particles");
 for(const auto& face:piece.value("faces",Json::array())){int ia=face[0],ib=face[1],ic=face[2];if(ia<0||ib<0||ic<0||ia>=int(particles.size())||ib>=int(particles.size())||ic>=int(particles.size()))continue;
 auto a=particles[ia],b=particles[ib],c=particles[ic];metrics["facesChecked"]=metrics["facesChecked"].get<int>()+1;result["facesChecked"]=result["facesChecked"].get<int>()+1;bool penetrated=false;
 for(auto& w:weights){auto pa=a["position"],pb=b["position"],pc=c["position"];Json point=vec(v(pa,"x")*w[0]+v(pb,"x")*w[1]+v(pc,"x")*w[2],v(pa,"y")*w[0]+v(pb,"y")*w[1]+v(pc,"y")*w[2],v(pa,"z")*w[0]+v(pb,"z")*w[1]+v(pc,"z")*w[2]);
 Json proxy={{"position",point},{"wrapMode",a.value("wrapMode",std::string())},{"patternV",(num(a,"patternV",0)+num(b,"patternV",0)+num(c,"patternV",0))/3},{"seamIds",a.value("seamIds",Json::array())}};
 double clearance=avatarClearance(point,avatar,proxy);result["samplesChecked"]=result["samplesChecked"].get<int>()+1;
 if(clearance< -eps){double mm=-clearance*1000;penetrated=true;for(auto* m:{&metrics,&result}){(*m)["penetratingSamples"]=(*m)["penetratingSamples"].get<int>()+1;(*m)["maximumIntrusionMm"]=std::max((*m)["maximumIntrusionMm"].get<double>(),mm);}}}
 if(penetrated){metrics["penetratingFaces"]=metrics["penetratingFaces"].get<int>()+1;result["penetratingFaces"]=result["penetratingFaces"].get<int>()+1;}}
 result["byPiece"][piece.at("id").get<std::string>()]=metrics;}
 result["maximumIntrusionMm"]=std::round(result["maximumIntrusionMm"].get<double>()*1000)/1000;return result;
}
}
