#include "grading_helpers.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <cstdlib>
namespace garment::grading_helpers {
const Json DEFAULT_SIZES=Json::array({"XS","S","M","L","XL","XXL"});
static double number(const Json& x,double fallback=0){
 if(x.is_null())return 0;
 if(x.is_boolean())return x.get<bool>()?1:0;
 if(x.is_number())return x.get<double>();
 if(x.is_string()){auto s=x.get<std::string>();char* end=nullptr;double value=std::strtod(s.c_str(),&end);return end==s.c_str()?std::numeric_limits<double>::quiet_NaN():value;}
 return fallback;
}
static double field(const Json& x,const char* key,double fallback){return x.is_object()&&x.contains(key)?number(x[key]):fallback;}
int sizeOffset(const Json& grading,const std::string& size){
 Json sizes=grading.is_object()&&grading.value("sizes",Json()).is_array()&&!grading["sizes"].empty()?grading["sizes"]:DEFAULT_SIZES;
 auto base=grading.is_object()&&grading.contains("baseSize")&&grading["baseSize"].is_string()&&!grading["baseSize"].get<std::string>().empty()?grading["baseSize"].get<std::string>():"M";
 auto index=[&](const std::string& key){for(size_t i=0;i<sizes.size();i++)if(sizes[i].is_string()&&sizes[i]==key)return int(i);return 0;};
 return index(size)-index(base);
}
Json gradePointForPiece(const Json& piece,const Json& grading,const std::string& size,const Json& point){
 int offset=sizeOffset(grading,size);if(!offset)return point;
 double minX=INFINITY,maxX=-INFINITY,minY=INFINITY,maxY=-INFINITY;
 for(const auto& p:piece.at("points")){double x=field(p,"x",0),y=field(p,"y",0);minX=std::min(minX,x);maxX=std::max(maxX,x);minY=std::min(minY,y);maxY=std::max(maxY,y);}
 double x=field(point,"x",0),y=field(point,"y",0),center=(minX+maxX)*.5;
 double norm=(y-minY)/std::max(1.,maxY-minY),side=(x>center)-(x<center);
 double width=field(grading,"widthPerSizeCm",3),length=field(grading,"lengthPerSizeCm",1.2);
 double nx=x+side*(width*offset*.5)*(.55+.45*(1-norm)),ny=y-length*offset*(1-norm);
 if(point.contains("gradeRule")&&point["gradeRule"].is_object()&&point["gradeRule"].value("enabled",false)){
  const auto& rule=point["gradeRule"];
  if(rule.contains("dxPerSize")){double dx=number(rule["dxPerSize"]);if(std::isfinite(dx))nx=x+dx*offset;}
  if(rule.contains("dyPerSize")){double dy=number(rule["dyPerSize"]);if(std::isfinite(dy))ny=y+dy*offset;}
 }
 return Json{{"x",nx},{"y",ny}};
}
Json gradePiece(const Json& piece,const Json& grading,const std::string& size){
 Json out=piece;int offset=sizeOffset(grading,size);
 out["points"]=Json::array();
 for(const auto& p:piece.at("points"))out["points"].push_back(gradePointForPiece(piece,grading,size,p));
 if(piece.contains("curves")&&!piece["curves"].is_null()){
  out["curves"]=Json::object();
  for(auto it=piece["curves"].begin();it!=piece["curves"].end();++it){
   if(!offset)out["curves"][it.key()]=it.value();
   else {auto point=gradePointForPiece(piece,grading,size,Json{{"x",it.value().at("cx")},{"y",it.value().at("cy")}});
    out["curves"][it.key()]={{"cx",point["x"]},{"cy",point["y"]}};}
  }
 }else out.erase("curves");
 out["internalLines"]=Json::array();
 for(const auto& line:piece.value("internalLines",Json::array())){
  Json l=line;
  l["a"]=offset?gradePointForPiece(piece,grading,size,line.at("a")):line.at("a");
  l["b"]=offset?gradePointForPiece(piece,grading,size,line.at("b")):line.at("b");
  out["internalLines"].push_back(l);
 }
 if(offset)out["gradeSize"]=size;
 return out;
}
}
