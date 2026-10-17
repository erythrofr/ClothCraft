#include "cloth_meshing_pipeline.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>
#include <array>
#include <map>
namespace garment {
namespace {
struct P {double x,y;};
double value(const Json& x,const char* k,double fallback=0);
Json object(const Json& x,const char* k);
double area(P a,P b,P c){return (b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y);}
bool triangle(P a,P b,P c,P p){return (c.x-p.x)*(a.y-p.y)>=(a.x-p.x)*(c.y-p.y)&&(a.x-p.x)*(b.y-p.y)>=(b.x-p.x)*(a.y-p.y)&&(b.x-p.x)*(c.y-p.y)>=(c.x-p.x)*(b.y-p.y);}
std::vector<std::array<size_t,3>> earcut(const std::vector<P>& poly){
 std::vector<std::array<size_t,3>> faces;
 const size_t n=poly.size();if(n<3)return faces;
 double winding=0;for(size_t i=0,j=n-1;i<n;j=i++)winding+=(poly[j].x-poly[i].x)*(poly[i].y+poly[j].y);
 std::vector<size_t> order;for(size_t i=0;i<n;i++)order.push_back(winding>0?i:n-1-i);
 // Earcut starts at the final linked node.
 size_t cursor=n-1,guard=0;
 while(order.size()>2 && guard++<n*n*4){
  size_t length=order.size(),a=order[(cursor+length-1)%length],b=order[cursor],c=order[(cursor+1)%length];
  bool ok=area(poly[a],poly[b],poly[c])<0;
  if(ok){double minX=std::min({poly[a].x,poly[b].x,poly[c].x}),maxX=std::max({poly[a].x,poly[b].x,poly[c].x});
    double minY=std::min({poly[a].y,poly[b].y,poly[c].y}),maxY=std::max({poly[a].y,poly[b].y,poly[c].y});
    for(size_t t=0;t<length&&ok;t++){size_t p=order[t];if(p==a||p==b||p==c)continue;auto x=poly[p];
      if(x.x>=minX&&x.x<=maxX&&x.y>=minY&&x.y<=maxY&&!(poly[a].x==x.x&&poly[a].y==x.y)&&triangle(poly[a],poly[b],poly[c],x) && area(poly[order[(t+length-1)%length]],x,poly[order[(t+1)%length]])>=0)ok=false;
    }
  }
  if(ok){faces.push_back({a,b,c});order.erase(order.begin()+cursor);if(order.size()>2)cursor=(cursor+1)%order.size();guard=0;}
  else cursor=(cursor+1)%length;
 }
 if(order.size()>2)throw std::runtime_error("Earcut needs local-intersection fallback for this contour");
 return faces;
}
struct Mesh {std::vector<P> points;std::vector<std::array<size_t,3>> faces;std::vector<std::vector<size_t>> edges;};
Mesh exactMesh(const Json& piece,int segments,int resolution){
 Mesh m;auto source=piece.at("points");auto curves=object(piece,"curves");
 for(size_t edge=0;edge<source.size();edge++){
  auto a=source[edge],b=source[(edge+1)%source.size()];std::string key=std::to_string(edge);
  bool curved=curves.contains(key)&&curves[key].is_object();auto curve=curved?curves[key]:Json::object();
  int count=curved?segments:1;
  for(int j=0;j<count;j++){double t=double(j)/count,u=1-t;
   P p=curved?P{u*u*value(a,"x")+2*u*t*value(curve,"cx")+t*t*value(b,"x"),u*u*value(a,"y")+2*u*t*value(curve,"cy")+t*t*value(b,"y")}:P{value(a,"x"),value(a,"y")};
   m.points.push_back(p);
  }
 }
 m.faces=earcut(m.points);
 for(int level=0;level<resolution;level++){
  std::map<std::pair<size_t,size_t>,size_t> cache;
  auto midpoint=[&](size_t a,size_t b){auto key=std::minmax(a,b);auto it=cache.find(key);if(it!=cache.end())return it->second;
   size_t idx=m.points.size();m.points.push_back({(m.points[a].x+m.points[b].x)*.5,(m.points[a].y+m.points[b].y)*.5});cache[key]=idx;return idx;};
  std::vector<std::array<size_t,3>> next;
  for(auto [a,b,c]:m.faces){size_t ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
   next.push_back({a,ab,ca});next.push_back({ab,b,bc});next.push_back({ca,bc,c});next.push_back({ab,bc,ca});}
  m.faces=std::move(next);
 }
 for(size_t edge=0;edge<source.size();edge++){auto key=std::to_string(edge);bool curved=curves.contains(key)&&curves[key].is_object();auto curve=curved?curves[key]:Json::object();
  auto a=source[edge],b=source[(edge+1)%source.size()];int count=curved?segments:1;
  std::vector<P> path;for(int j=0;j<=count;j++){double t=double(j)/count,u=1-t;path.push_back(curved?P{u*u*value(a,"x")+2*u*t*value(curve,"cx")+t*t*value(b,"x"),u*u*value(a,"y")+2*u*t*value(curve,"cy")+t*t*value(b,"y")}:P{value(a,"x")+(value(b,"x")-value(a,"x"))*t,value(a,"y")+(value(b,"y")-value(a,"y"))*t});}
  std::vector<std::pair<double,size_t>> hits;
  for(size_t idx=0;idx<m.points.size();idx++){double distanceAlong=0;auto p=m.points[idx];
   for(size_t j=0;j+1<path.size();j++){auto q=path[j],r=path[j+1];double dx=r.x-q.x,dy=r.y-q.y,ls=dx*dx+dy*dy,len=std::sqrt(ls);
    if(ls>=1e-6){double t=((p.x-q.x)*dx+(p.y-q.y)*dy)/ls,tc=std::clamp(t,0.,1.);
     if(t>=-.003&&t<=1.003&&std::hypot(p.x-q.x-tc*dx,p.y-q.y-tc*dy)<=.003){hits.push_back({distanceAlong+tc*len,idx});break;}}
    distanceAlong+=len;
   }
  }
  std::stable_sort(hits.begin(),hits.end(),[](auto a,auto b){return a.first<b.first;});
  std::vector<size_t> indices;for(auto& hit:hits)indices.push_back(hit.second);
  m.edges.push_back(indices);
 }
 return m;
}
double value(const Json& x,const char* k,double fallback){return x.is_object()&&x.contains(k)&&x[k].is_number()?x[k].get<double>():fallback;}
std::string word(const Json& x,const char* k){return x.is_object()&&x.contains(k)&&x[k].is_string()?x[k].get<std::string>():"";}
Json object(const Json& x,const char* k){return x.is_object()&&x.contains(k)&&x[k].is_object()?x[k]:Json::object();}
double clamp(double x,double a,double b){return std::clamp(x,a,b);}
double smooth(double x,double a,double b){double t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
double height(const Json& avatar){return clamp(value(avatar,"heightCm",180)/180,.78,1.22);}
std::pair<double,double> torso(const Json& a,double y){
 double h=height(a),ch=clamp(value(a,"chestCm",96)/96,.72,1.42),wa=clamp(value(a,"waistCm",78)/78,.68,1.5),hip=clamp(value(a,"hipCm",94)/94,.72,1.42);y/=h;
 if(y>=1.45){double bulge=std::max(0.,1-std::abs(y-1.57)/.18);return {(.19+.05*bulge)*ch,(.13+.012*bulge)*ch};}
 if(y>=1.08){double t=clamp((y-1.08)/.5,0,1);return {(.155*wa)*(1-t)+(.19*ch)*t,(.105*wa)*(1-t)+(.13*ch)*t};}
 double t=clamp((y-.6)/.48,0,1);return {(.20*hip)*(1-t)+(.155*wa)*t,(.14*hip)*(1-t)+(.105*wa)*t};
}
Json placement(const Json& piece,Point2 p,double minX,double maxX,double minY,double maxY,const Json& avatar){
 auto a=object(piece,"arrangement3d");auto wrap=word(a,"wrap");
 double h=height(avatar),flip=a.value("flip",false)?-1:1;
 double worldY=(value(a,"y",0)+maxY*.01)*h-(maxY-p.y)*.01;
 if(wrap=="front"||wrap=="back"){
   auto r=torso(avatar,worldY);double x=value(a,"x",0)+(p.x-(minX+maxX)*.5)*.01*flip;
   double nx=clamp(x/(r.first+.018),-.999,.999);
   double easing=std::max(.006,.018+value(a,"surfaceOffsetM"));
   double surface=(r.second+easing)*std::sqrt(std::max(0.,1-nx*nx))*(1-smooth(worldY/h,1.54,1.685));
   return Json::array({x,worldY,(wrap=="back"?-1:1)*surface});
 }
 if(wrap=="left-leg-front"||wrap=="left-leg-back"||wrap=="right-leg-front"||wrap=="right-leg-back"){
  constexpr double pi=3.14159265358979323846;
  double side=wrap.rfind("left-",0)==0?-1:1,front=wrap.find("-front")!=std::string::npos?1:-1;
  double t=clamp((p.x-minX)/std::max(1e-5,maxX-minX),0,1);
  double baseY=worldY/h,yn=(baseY-.24)/.48,factor=std::sqrt(std::max(.08,1-yn*yn));
  double radiusX=.09*factor+.012,radiusZ=.10*factor+.012;
  double legAngle=front>0?(side<0?(-pi*.5+pi*t):(pi*.5-pi*t)):(side<0?(-pi*.5-pi*t):(pi*.5+pi*t));
  double legX=side*.105+std::sin(legAngle)*radiusX,legZ=std::cos(legAngle)*radiusZ;
  auto radii=torso(avatar,worldY);
  double hipAngle=front>0?(side<0?(-pi*.5+pi*.5*t):(pi*.5-pi*.5*t)):(side<0?(-pi*.5-pi*.5*t):(pi*.5+pi*.5*t));
  double hipX=std::sin(hipAngle)*(radii.first+.014),hipZ=std::cos(hipAngle)*(radii.second+.014);
  double blend=smooth(worldY,.54*h,.74*h);
  return Json::array({legX*(1-blend)+hipX*blend,worldY,legZ*(1-blend)+hipZ*blend});
 }
 if(wrap=="left-arm"||wrap=="right-arm"){
  constexpr double pi=3.14159265358979323846;
  double center=(minX+maxX)*.5,half=std::max(1.,(maxX-minX)*.5),u=clamp((p.x-center)/half*flip,-1,1),angle=u*pi;
  double side=wrap=="left-arm"?-1:1,rad=std::max(.05,.066+value(a,"surfaceOffsetM")),cx=value(a,"x")+side*std::cos(angle)*rad,cz=value(a,"z")+std::sin(angle)*rad;
  double cap=smooth(clamp((p.y-minY)/std::max(1.,maxY-minY),0,1),.78,1)*(1-std::min(1.,std::abs(u)));
  double x=cx*(1-cap)+side*.205*cap,z=cz*(1-cap),y=worldY;
  double bi=clamp(value(avatar,"bicepCm",32),20,60),armrad=.065*bi/32,armLen=clamp(value(avatar,"armLengthCm",72*h),42,86)*.005;
  double rot=side*clamp(value(avatar,"armAngleDeg",6),0,80)*pi/180;
  double axisX=-std::sin(rot),axisY=std::cos(rot),jointX=side*(clamp(value(avatar,"shoulderWidthCm",46),34,62)*.005+armrad*.26),jointY=1.54*h;
  double originX=jointX-axisX*armLen,originY=jointY-axisY*armLen,theta=rot*(1-cap);
  double dx=x-originX,dy=y-originY;return Json::array({originX+dx*std::cos(theta)-dy*std::sin(theta),originY+dx*std::sin(theta)+dy*std::cos(theta),z});
 }
 return Json::array({value(a,"x")+p.x*.01*flip,value(a,"y")+p.y*.01,value(a,"z")});
}
}
Json buildClothMeshingPipeline(const Json& project){
 if(!project.is_object()||!project.contains("pieces")||!project["pieces"].is_array())throw std::invalid_argument("project pieces must be array");
 Json result=Json::array();auto sim=object(project,"simulation"),avatar=object(project,"avatar");
 int segments=(int)clamp(value(sim,"curveSegments",2),2,4);
 int resolution=(int)value(sim,"resolution",1);
 Json seams=project.value("seams",Json::array());
 for(const auto& piece:project["pieces"]){if(piece.value("active3d",true)==false)continue;
  int localRes=piece.contains("simulationResolution")&&piece["simulationResolution"].is_number()?piece["simulationResolution"].get<int>():resolution;
  if(piece.contains("internalLines")&&piece["internalLines"].is_array())for(const auto& line:piece["internalLines"])if(line.is_object()&& (word(line,"type")=="fold"||word(line,"type")=="dart"||word(line,"type")=="pleat"))localRes=std::max(2,localRes);
  auto mesh=exactMesh(piece,segments,localRes);
  double minX=1e20,minY=1e20,maxX=-1e20,maxY=-1e20;
  for(auto& v:mesh.points){minX=std::min(minX,v.x);maxX=std::max(maxX,v.x);minY=std::min(minY,v.y);maxY=std::max(maxY,v.y);}
  Json flat=Json::array(),positions=Json::array(),faces=Json::array(),boundaries=Json::array();
  for(auto& v:mesh.points){flat.push_back({{"x",v.x},{"y",v.y}});positions.push_back(placement(piece,{v.x,v.y},minX,maxX,minY,maxY,avatar));}
  for(auto& f:mesh.faces)faces.push_back(Json::array({f[0],f[1],f[2]}));
  for(auto& edge:mesh.edges){Json indices=Json::array();for(auto idx:edge)indices.push_back(idx);boundaries.push_back(indices);}
  result.push_back({{"id",piece.value("id",std::string())},{"flatVertices",flat},{"faces",faces},{"positions",positions},{"boundaryIndices",boundaries}});
 }
 return Json{{"pieces",result},{"parityScope","native triangulation and initial avatar placement; seam constraints not constructed"}};
}
}
