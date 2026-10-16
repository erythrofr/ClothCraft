#include "cloth_analysis.hpp"
#include "avatar_physics.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>
namespace garment {
namespace {
double num(const Json& j,double fallback=0){return j.is_number()?j.get<double>():fallback;}
double val(const Json& j,const char* k,double fallback=0){return j.is_object()&&j.contains(k)?num(j[k],fallback):fallback;}
Json object(const Json& j,const char* key){return j.is_object()&&j.contains(key)&&j[key].is_object()?j[key]:Json::object();}
Json array(const Json& j,const char* key){return j.is_object()&&j.contains(key)&&j[key].is_array()?j[key]:Json::array();}
double dist(const Json& a,const Json& b){double d=0;for(auto axis:{"x","y","z"}){double x=val(a,axis)-val(b,axis);d+=x*x;}return std::sqrt(d);}
size_t particleIndex(const Json& v,size_t count){if(!v.is_number_integer()||v.get<long long>()<0||(size_t)v.get<long long>()>=count)throw std::invalid_argument("invalid particle reference");return v.get<size_t>();}
double percentile(const std::vector<double>& values,double f){return values.empty()?0:values[std::min(values.size()-1,size_t(std::ceil(values.size()*f)-1))];}
Json vecMix(const Json& particles,const Json& ids,const Json& weights){Json out={{"x",0.0},{"y",0.0},{"z",0.0}};for(size_t i=0;i<ids.size();i++){const auto& pos=particles[particleIndex(ids[i],particles.size())]["position"];for(auto axis:{"x","y","z"})out[axis]=out[axis].get<double>()+val(pos,axis)*num(weights[i]);}return out;}
}
Json refreshClothAnalysis(const Json& input,const Json& project){
 if(!input.is_object()||!project.is_object())throw std::invalid_argument("analysis requires simulation and project JSON objects");
 Json out=input,particles=array(out,"particles"),constraints=array(out,"constraints"),seams=array(out,"seamConstraints");
 for(auto& p:particles){p["strain"]=0.;p["strainSamples"]=0;}
 double total=0,maxStrain=0;size_t samples=0;std::vector<double> strains;
 for(const auto& c:constraints){if(c.value("type",std::string())!="structural"||val(c,"rest")<=1e-6)continue;
  auto ia=particleIndex(c.at("a"),particles.size()),ib=particleIndex(c.at("b"),particles.size());
  double strain=std::abs(dist(particles[ia]["position"],particles[ib]["position"])-val(c,"rest"))/val(c,"rest");
  for(auto ix:{ia,ib}){particles[ix]["strain"]=num(particles[ix]["strain"])+strain;particles[ix]["strainSamples"]=particles[ix]["strainSamples"].get<int>()+1;}
  total+=strain;maxStrain=std::max(maxStrain,strain);samples++;strains.push_back(strain);
 }
 for(auto& p:particles)if(p["strainSamples"].get<int>()>0)p["strain"]=num(p["strain"])/p["strainSamples"].get<int>();
 out["strain"]={{"average",samples?total/samples:0},{"max",maxStrain}};
 Json settings=object(project,"simulation"),avatar=object(project,"avatar");
 double easeTotal=0,pressureTotal=0,pressureMax=0;size_t count=0,contacts=0,tight=0,loose=0;
 for(auto& p:particles){
  Json hint=p;hint["position"]=p.at("position");
  double clearance=avatar_physics::avatarClearance(p.at("position"),avatar,hint);
  double ease=std::max(0.,clearance)*100;
  double scale=std::max(.004,val(settings,"collisionMargin",.012)+val(p,"thickness",.002));
  double penetration=std::min(1.,val(p,"contactDepth")/scale),stretch=std::min(1.,num(p["strain"])/.12);
  double pressure=penetration>0?std::min(1.,penetration*.78+stretch*.22):0;
  p["easeCm"]=ease;p["pressureIndex"]=pressure;
  easeTotal+=ease;pressureTotal+=pressure;pressureMax=std::max(pressureMax,pressure);
  contacts+=(clearance<=.005||pressure>.02);tight+=(ease<1);loose+=(ease>4);count++;
 }
 out["fit"]={{"averageEaseCm",count?easeTotal/count:0},{"averagePressureIndex",count?pressureTotal/count:0},{"maxPressureIndex",pressureMax},
   {"contactRatio",count?double(contacts)/count:0},{"tightRatio",count?double(tight)/count:0},{"looseRatio",count?double(loose)/count:0}};
 std::vector<double> gaps;Json worst=Json::array();
 for(const auto& c:seams){
  if(!c.contains("a")||!c.contains("b"))continue;
  double gap=0;
  if(c.value("type",std::string())=="seam-virtual"&&array(c,"sourceParticles").size()&&array(c,"targetParticles").size()){
   gap=dist(vecMix(particles,c["sourceParticles"],c["sourceWeights"]),vecMix(particles,c["targetParticles"],c["targetWeights"]));
  }else gap=dist(particles[particleIndex(c["a"],particles.size())]["position"],particles[particleIndex(c["b"],particles.size())]["position"]);
  gap*=1000;gaps.push_back(gap);worst.push_back({{"seamId",c.value("seamId",Json(nullptr))},{"gapMm",gap}});
 }
 std::sort(gaps.begin(),gaps.end());std::sort(strains.begin(),strains.end());
 std::stable_sort(worst.begin(),worst.end(),[](const Json& a,const Json& b){return num(a["gapMm"])>num(b["gapMm"]);});
 while(worst.size()>5)worst.erase(worst.end()-1);
 double gapSum=0;for(double v:gaps)gapSum+=v;
 double p95strain=percentile(strains,.95)*100,maxMeasured=percentile(strains,1)*100,maxGap=percentile(gaps,1);
 Json failures=Json::array(),unknown=Json::array();
 if(maxMeasured>15)failures.push_back("excessive-structural-strain");
 if(maxGap>5)failures.push_back("open-sewing-seams");
 unknown.push_back("triangle-ccd-and-entire-trajectory-not-certified");
 unknown.push_back("avatar-intrusion-not-measured");
 out["quality"]={{"structural",{{"samples",strains.size()},{"meanStrainPercent",(samples?total/samples:0)*100},{"p95StrainPercent",p95strain},{"maxStrainPercent",maxMeasured}}},
  {"sewing",{{"pairs",gaps.size()},{"meanGapMm",gapSum/std::max(size_t(1),gaps.size())},{"p95GapMm",percentile(gaps,.95)},{"maxGapMm",maxGap},{"worstSeams",worst}}},
  {"collision",{{"triangleCcdVerified",false},{"allFrameIntersectionFree",nullptr}}},
  {"acceptance",{{"status",failures.empty()?"UNVERIFIED":"FAILED"},{"factoryApproved",false},{"failures",failures},{"unknown",unknown},{"limits",{{"maximumStructuralStrainPercent",15},{"maximumSeamGapMm",5},{"maximumPenetrationMm",.5}}}}}};
 out["particles"]=particles;
 return out;
}
Json measureClothFlatFaces(const Json& pieces){
 if(!pieces.is_array())throw std::invalid_argument("flat face measurement needs array of pieces");
 Json result=Json::array();
 for(const auto& piece:pieces){auto points=array(piece,"flatVertices"),faces=array(piece,"faces");double area=0;Json areas=Json::array();
  for(const auto& face:faces){if(!face.is_array()||face.size()!=3)throw std::invalid_argument("face must have 3 indices");
   auto a=particleIndex(face[0],points.size()),b=particleIndex(face[1],points.size()),c=particleIndex(face[2],points.size());
   double ax=val(points[a],"x"),ay=val(points[a],"y"),bx=val(points[b],"x"),by=val(points[b],"y"),cx=val(points[c],"x"),cy=val(points[c],"y");
   double triangleArea=std::abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))*.5;areas.push_back(triangleArea);area+=triangleArea;
  }
  result.push_back({{"id",piece.value("id",std::string())},{"faceCount",faces.size()},{"areaCm2",area},{"faceAreasCm2",areas}});
 }
 return result;
}
}
