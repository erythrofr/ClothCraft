#include "staging_geometry.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <stdexcept>
namespace garment::staging_geometry {
namespace {
Json get(const Json& j,const char* k){return j.is_object()&&j.contains(k)?j[k]:Json();}
bool truth(const Json& j){return !j.is_null()&&j!=false&&j!=0&&j!="";}
double number(const Json& j){if(j.is_null())return 0;if(j.is_number())return j.get<double>();if(j.is_boolean())return j.get<bool>()?1:0;if(j.is_string()){try{return std::stod(j.get<std::string>());}catch(...){}}return 0;}
double field(const Json& j,const char* k){return number(get(j,k));}
double clamp(double v,double a,double b){return std::max(a,std::min(b,v));}
struct V{double x,y,z;};
V point(const Json& v){return {field(v,"x"),field(v,"y"),field(v,"z")};}
Json out(V v){return Json{{"x",v.x},{"y",v.y},{"z",v.z}};}
V rotate(V v,double ax,double ay,double az){
 // THREE Euler('XYZ'): apply Z, then Y, then X.
 double cx=std::cos(ax),sx=std::sin(ax),cy=std::cos(ay),sy=std::sin(ay),cz=std::cos(az),sz=std::sin(az);
 double x=v.x*cz-v.y*sz,y=v.x*sz+v.y*cz,z=v.z;
 double px=x*cy+z*sy,pz=-x*sy+z*cy;
 return {px,y*cx-pz*sx,y*sx+pz*cx};
}
}
Json stagedPanelPositions(const Json& simPiece,const Json& avatar){
 Json flats=get(simPiece,"flatVertices");if(!flats.is_array()||flats.empty())return Json::array();
 Json piece=get(simPiece,"piece"),arr=get(piece,"arrangement3d");std::string wrap="flat";if(truth(get(arr,"wrap"))&&get(arr,"wrap").is_string())wrap=get(arr,"wrap").get<std::string>();
 double scale=clamp(number(truth(get(avatar,"heightCm"))?get(avatar,"heightCm"):Json(180))/180.,.6,1.5);
 double minX=INFINITY,maxX=-INFINITY,minY=INFINITY;
 for(const auto& p:flats){minX=std::min(minX,field(p,"x"));maxX=std::max(maxX,field(p,"x"));minY=std::min(minY,field(p,"y"));}
 double center=(minX+maxX)*.5,flip=truth(get(arr,"flip"))?-1:1,side=wrap.rfind("left-",0)==0?-1:1;
 double xOffset=field(arr,"x"),yOffset=field(arr,"y"),zOffset=field(arr,"z");
 bool front=wrap=="front"||wrap=="lower-front",back=wrap=="back"||wrap=="lower-back",arm=wrap=="left-arm"||wrap=="right-arm";
 bool leg=wrap=="left-leg-front"||wrap=="left-leg-back"||wrap=="right-leg-front"||wrap=="right-leg-back";
 bool hood=wrap=="hood-left"||wrap=="hood-right",ring=wrap=="neck"||wrap=="waist-band"||wrap=="left-wrist"||wrap=="right-wrist";
 double half=std::max(.01,(maxX-minX)*.005);std::vector<V> positions;positions.reserve(flats.size());
 for(const auto& p:flats){
  double lx=(field(p,"x")-center)*.01*flip,ly=(field(p,"y")-minY)*.01;
  V v{xOffset+lx,yOffset*scale+ly,zOffset};
  if(front||back){double arc=.105*std::pow(std::min(1.,std::abs(lx)/half),1.6),direction=front?1:-1;v.z=direction*(.235*scale-arc)+(zOffset-direction*.245);}
  else if(arm){bool left=wrap=="left-arm";v.x=(left?-.59:.59)*scale+(xOffset-(left?-.285:.285))+lx;v.z=.045*scale+zOffset-.065*std::pow(std::min(1.,std::abs(lx)/half),1.5);}
  else if(leg){v.x=side*.21*scale+(xOffset-side*.15)+lx;double direction=wrap.size()>=6&&wrap.substr(wrap.size()-6)=="-front"?1:-1;v.z=direction*(.245*scale-.055*std::pow(std::min(1.,std::abs(lx)/half),1.5))+(zOffset-direction*.14);}
  else if(hood){v.x=side*.33*scale+xOffset+lx;v.y=1.59*scale+ly-.10;v.z=-.34*scale+zOffset;}
  else if(ring){double stage=wrap=="left-wrist"?-.73:wrap=="right-wrist"?.73:0;v.x=stage*scale+xOffset+lx;v.y=(wrap=="neck"?1.54:wrap=="waist-band"?.86:1.)*scale+ly;v.z=.48*scale+zOffset;}
  v.x+=field(arr,"stagingOffsetX");v.y+=field(arr,"stagingOffsetY");v.z+=field(arr,"stagingOffsetZ");positions.push_back(v);
 }
 double ax=field(arr,"stagingRotationX")*M_PI/180,ay=field(arr,"stagingRotationY")*M_PI/180,az=field(arr,"stagingRotationZ")*M_PI/180;
 if(std::abs(ax)+std::abs(ay)+std::abs(az)>1e-6){
  V centroid{0,0,0};for(auto v:positions){centroid.x+=v.x;centroid.y+=v.y;centroid.z+=v.z;}
  centroid.x/=positions.size();centroid.y/=positions.size();centroid.z/=positions.size();
  for(auto& v:positions){V delta{v.x-centroid.x,v.y-centroid.y,v.z-centroid.z};V r=rotate(delta,ax,ay,az);v={r.x+centroid.x,r.y+centroid.y,r.z+centroid.z};}
 }
 Json results=Json::array();for(auto v:positions)results.push_back(out(v));return results;
}
Json setStagedGeometry(const Json& geometry,const Json& positions,const Json& fittedPositions,double fitBlend){
 Json result=geometry;Json attr=get(get(result,"attributes"),"position");
 if(!attr.is_object()||!positions.is_array()||!get(attr,"count").is_number()||number(get(attr,"count"))!=positions.size())return Json{{"success",false},{"geometry",geometry}};
 double t=clamp(fitBlend,0,1);Json values=Json::array();
 for(size_t i=0;i<positions.size();i++){
  V a=point(positions[i]);Json fitted=fittedPositions.is_array()&&i<fittedPositions.size()&&truth(fittedPositions[i])?fittedPositions[i]:positions[i];V b=point(fitted);
  values.push_back(a.x+(b.x-a.x)*t);values.push_back(a.y+(b.y-a.y)*t);values.push_back(a.z+(b.z-a.z)*t);
 }
 result["attributes"]["position"]["array"]=values;
 result["attributes"]["position"]["needsUpdate"]=true;
 result["computedVertexNormals"]=true;result["computedBoundingSphere"]=true;
 return Json{{"success",true},{"geometry",result}};
}
}
