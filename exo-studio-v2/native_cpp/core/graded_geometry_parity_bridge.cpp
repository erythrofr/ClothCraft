#include "graded_geometry_parity_bridge.hpp"
#include "grading.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace garment::graded_geometry_parity_bridge {
namespace {
double value(const Json& j,const char* k,double fallback){return j.is_object()&&j.contains(k)&&j[k].is_number()?j[k].get<double>():fallback;}
Json transform(const Json& input,double center,double minY,double height,double width,int offset,double length){
 Json output=input;
 const double x=value(input,"x",0),y=value(input,"y",0);
 const double halfWidthDelta=(width*offset)*.5;
 const double lengthDelta=length*offset;
 const double side=(x>center?1.:(x<center?-1.:0.));
 const double normalizedY=(y-minY)/height;
 const double widthInfluence=.55+.45*(1-normalizedY);
 const double lengthInfluence=1-normalizedY;
 double xx=x+side*halfWidthDelta*widthInfluence;
 double yy=y-lengthDelta*lengthInfluence;
 const auto rule=input.value("gradeRule",Json::object());
 if(rule.is_object()&&rule.value("enabled",false)){
  if(rule.contains("dxPerSize")&&!rule["dxPerSize"].is_null())xx=x+value(rule,"dxPerSize",0)*offset;
  if(rule.contains("dyPerSize")&&!rule["dyPerSize"].is_null())yy=y+value(rule,"dyPerSize",0)*offset;
 }
 output["x"]=xx;output["y"]=yy;return output;
}
}
Json grade(const Json& project,const std::string& size){
 Json graded=garment::gradeProject(garment::Document(project),size);
 const auto production=project.value("productionSpec",Json::object());
 bool custom=false;for(const auto& piece:project.at("pieces"))for(const auto& pt:piece.at("points"))if(pt.contains("gradeRule")&&pt["gradeRule"].is_object()&&pt["gradeRule"].value("enabled",false))custom=true;
 if(production.is_object()&&production.value("gradingModel",std::string())=="seam-locked-affine-v1"&&!custom)return graded;
 const auto grading=project.value("grading",Json::object());
 auto sizes=grading.value("sizes",Json::array({"XS","S","M","L","XL","XXL"}));
 const auto locate=[&](const std::string& name){for(size_t i=0;i<sizes.size();i++)if(sizes[i]==name)return int(i);return 0;};
 int offset=locate(size)-locate(grading.value("baseSize",std::string("M")));
 for(size_t i=0;i<project["pieces"].size();++i){
  const auto& original=project["pieces"][i];auto& dest=graded["pieces"][i];
  if(!offset){dest.erase("gradeSize");continue;}
  double minX=INFINITY,maxX=-INFINITY,minY=INFINITY,maxY=-INFINITY;
  for(const auto& pt:original.at("points")){auto x=value(pt,"x",0),y=value(pt,"y",0);minX=std::min(x,minX);maxX=std::max(x,maxX);minY=std::min(y,minY);maxY=std::max(y,maxY);}
  const double center=(minX+maxX)*.5,height=std::max(1.,maxY-minY);
  const double width=value(grading,"widthPerSizeCm",3),length=value(grading,"lengthPerSizeCm",1.2);
  auto apply=[&](const Json& p){return transform(p,center,minY,height,width,offset,length);};
  for(size_t j=0;j<original["points"].size();++j)dest["points"][j]=apply(original["points"][j]);
  if(original.contains("curves")&&original["curves"].is_object())for(auto it=original["curves"].begin();it!=original["curves"].end();++it){Json point={{"x",it.value().at("cx")},{"y",it.value().at("cy")}};auto transformed=apply(point);dest["curves"][it.key()]["cx"]=transformed["x"];dest["curves"][it.key()]["cy"]=transformed["y"];}
  if(original.contains("internalLines")&&original["internalLines"].is_array())for(size_t j=0;j<original["internalLines"].size();j++)for(const char* end:{"a","b"})if(original["internalLines"][j].contains(end))dest["internalLines"][j][end]=apply(original["internalLines"][j][end]);
 }
 return graded;
}
}
