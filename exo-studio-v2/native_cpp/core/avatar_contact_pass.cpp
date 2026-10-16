#include "avatar_contact_pass.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
namespace garment {
namespace {
Json get(const Json& j,const char* key){return j.is_object()&&j.contains(key)?j[key]:Json();}
double number(const Json& v){if(v.is_null())return 0;if(v.is_number())return v.get<double>();if(v.is_boolean())return v.get<bool>()?1:0;if(v.is_string()){try{size_t end=0;auto s=v.get<std::string>();if(s.empty())return 0;double n=std::stod(s,&end);return end==s.size()?n:std::numeric_limits<double>::quiet_NaN();}catch(...){}}return std::numeric_limits<double>::quiet_NaN();}
bool truth(const Json& j){return !j.is_null()&&j!=false&&j!=0&&j!="";}
}
Json avatarContactParameters(const Json& project,const Json& piece){
 Json fabric=get(piece,"fabric"),thickness=get(fabric,"thickness"),friction=get(fabric,"friction"),margin=get(get(project,"simulation"),"collisionMargin");
 // Nullish coalescing only, preserving explicit zero and negative values.
 double t=thickness.is_null()?.002:number(thickness),f=friction.is_null()?.3:number(friction),base=margin.is_null()?.012:number(margin);
 double layer=number(get(piece,"layerIndex"));if(!truth(get(piece,"layerIndex")))layer=0;
 double offset=layer*std::max(.0025,t*1.15);
 return Json{{"margin",base+t+offset},{"friction",f}};
}
int projectAvatarContacts(Json& simulation,const Json& project,const AvatarContactProjector& projector,const Json& options){
 if(get(get(project,"simulation"),"collisions")==false)return 0;
 bool movable=get(options,"movableOnly")==true;int count=0;
 Json& pieces=simulation.at("pieces");
 auto visit=[&](Json& piece){
  Json parameters=avatarContactParameters(project,piece);
  for(auto& particle:piece.at("particles")){
   if(movable&&!(number(get(particle,"invMass"))>0))continue;
   projector(particle,get(project,"avatar"),parameters["margin"].get<double>(),parameters["friction"].get<double>());
   count++;
  }
 };
 if(pieces.is_array())for(auto& p:pieces)visit(p);
 else if(pieces.is_object())for(auto it=pieces.begin();it!=pieces.end();++it)visit(it.value());
 return count;
}
Json avatarContactCandidates(const Json& simulation,const Json& project,const Json& options){
 Json copy=simulation,events=Json::array();int pieceIndex=0;
 if(get(get(project,"simulation"),"collisions")==false)return Json{{"processed",0},{"events",events}};
 auto handle=[&](const Json& piece,const Json& key){
  Json parameters=avatarContactParameters(project,piece);int particleIndex=0;
  for(const auto& particle:piece.at("particles")){
   if(get(options,"movableOnly")!=true||number(get(particle,"invMass"))>0)
    events.push_back(Json{{"pieceKey",key},{"pieceIndex",pieceIndex},{"particleIndex",particleIndex},{"particle",particle},{"avatar",get(project,"avatar")},{"margin",parameters["margin"]},{"friction",parameters["friction"]}});
   particleIndex++;
  }
  pieceIndex++;
 };
 Json pieces=get(simulation,"pieces");
 if(pieces.is_array()){for(size_t i=0;i<pieces.size();i++)handle(pieces[i],i);}
 else if(pieces.is_object()){for(auto it=pieces.begin();it!=pieces.end();++it)handle(it.value(),it.key());}
 return Json{{"processed",events.size()},{"events",events}};
}
}
