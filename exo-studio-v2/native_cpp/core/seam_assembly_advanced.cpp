#include "seam_assembly_advanced.hpp"
#include "avatar_physics.hpp"
#include "native_seam_assembly.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace garment::seam_assembly_advanced {
namespace {

struct Edge {std::size_t a=0,b=0;double rest=0;};
using Vec3=std::array<double,3>;
double number(const Json& value){return value.is_number()?value.get<double>():0.;}
double value(const Json& j,const char* key,double fallback) {
  if(!j.is_object()||!j.contains(key)||j[key].is_null())return fallback;
  if(j[key].is_number())return j[key].get<double>();
  if(j[key].is_boolean())return j[key].get<bool>()?1.:0.;
  if(j[key].is_string())try{return std::stod(j[key].get<std::string>());}catch(...){}
  return fallback;
}
bool flag(const Json& j,const char* key) {
  return j.is_object()&&j.contains(key)&&j[key].is_boolean()&&j[key].get<bool>();
}
std::size_t indexOf(const Json& v,const std::size_t size){
  if(!v.is_number_integer())throw std::invalid_argument("noninteger advanced seam particle index");
  const auto index=v.get<long long>();
  if(index<0||static_cast<std::size_t>(index)>=size)
    throw std::invalid_argument("advanced seam particle index out of range");
  return static_cast<std::size_t>(index);
}
double hypot3(const double x,const double y,const double z) {
  return std::hypot(x,y,z);
}
double clearanceAt(const std::vector<double>& positions,const std::size_t id,
                   const Json& avatar,const Json& hint,
                   const double dx=0,const double dy=0,const double dz=0){
  const auto k=id*3;
  return avatar_physics::avatarClearance(
    Json{{"x",positions.at(k)+dx},{"y",positions.at(k+1)+dy},
         {"z",positions.at(k+2)+dz}},avatar,hint);
}
double jsonClearance(const Json& position,const Json& avatar,const Json& hint) {
  return avatar_physics::avatarClearance(
      Json{{"x",position.at(0)},{"y",position.at(1)},{"z",position.at(2)}},
      avatar,hint);
}

class AdvancedStage {
 public:
  AdvancedStage(const Json& input,const Json& opts):source(input),options(opts),
    avatar(input.at("avatar")),output(input) {
    const auto& particles=source.at("particles");
    n=particles.size();
    positions.reserve(n*3);mass.reserve(n);hints.reserve(n);
    for(const auto& p:particles) {
      const auto& pos=p.at("position");
      for(int axis=0;axis<3;++axis)positions.push_back(number(pos.at(axis)));
      mass.push_back(std::max(0.,value(p,"invMass",0)));
      Json hint=Json::object();
      for(auto key:{"wrapMode","seamIds","collisionSideZ"})
        if(p.contains(key))hint[key]=p.at(key);
      hint["patternV"]=0.;
      hints.push_back(std::move(hint));
    }
    initial=positions;
    shifts.resize(n*3);weights.resize(n);
    const auto& pieces=source.at("pieces");
    std::set<std::pair<std::size_t,std::size_t>> seen;
    for(const auto& piece:pieces){
      const auto& ids=piece.at("particleIndices");
      const auto& flat=piece.at("flatVerticesM");
      double minimum=INFINITY,maximum=-INFINITY;
      for(const auto& xy:flat){const double y=number(xy.at(1));minimum=std::min(minimum,y);maximum=std::max(maximum,y);}
      const double span=std::max(1e-7,maximum-minimum);
      for(std::size_t i=0;i<ids.size();++i){
        auto particle=indexOf(ids.at(i),n);
        hints[particle]["patternV"]=(number(flat.at(i).at(1))-minimum)/span;
      }
      for(const auto& face:piece.at("faces")) {
        for(int edge=0;edge<3;++edge){
          const auto a=indexOf(face.at(edge),ids.size());
          const auto b=indexOf(face.at((edge+1)%3),ids.size());
          const auto ia=indexOf(ids.at(a),n),ib=indexOf(ids.at(b),n);
          if(!seen.insert(std::minmax(ia,ib)).second)continue;
          const double dx=number(flat.at(a).at(0))-number(flat.at(b).at(0));
          const double dy=number(flat.at(a).at(1))-number(flat.at(b).at(1));
          const double rest=std::hypot(dx,dy);
          if(rest>1e-7)restEdges.push_back({ia,ib,rest});
        }
      }
    }
    for(const auto& c:source.at("constraints"))
      if(c.value("type",std::string())=="seam")
        seams.push_back({indexOf(c.at("a"),n),indexOf(c.at("b"),n),0});
    if(source.contains("virtualSeams")&&source["virtualSeams"].is_array())
      virtualSeams=source["virtualSeams"];
    iterations=std::clamp(static_cast<int>(std::floor(value(options,"iterations",90))),0,1000);
    // JS skips negative pass counts in Gauss-Seidel mode, but multiplies the
    // raw pass count into joint seam stiffness. Preserve both behaviors.
    seamPasses=value(options,"seamPasses",2);
    seamStiffness=value(options,"seamStiffness",.3);
    restStiffness=value(options,"restStiffness",.7);
    positionStiffness=value(options,"positionStiffness",.002);
    maxMove=value(options,"maxMoveM",.012);
    contactMargin=value(options,"contactMarginM",.004);
    jointWeight=value(options,"jointContactWeight",.3);
  }

  Json run(){
    const auto contact=flag(options,"contactConstrained");
    const auto joint=flag(options,"jointConstraintMode");
    for(int iteration=0;iteration<iterations;++iteration){
      if(joint){jointIteration();continue;}
      const bool reverse=(iteration%2)==1;
      for(int pass=0;pass<seamPasses;++pass){
        for(std::size_t i=0;i<seams.size();++i){
          const auto& edge=seams[reverse?seams.size()-1-i:i];
          projectDistance(edge.a,edge.b,0,seamStiffness);
        }
        for(std::size_t i=0;i<virtualSeams.size();++i){
          projectVirtualSeam(virtualSeams[reverse?virtualSeams.size()-1-i:i],false);
        }
      }
      for(std::size_t i=0;i<restEdges.size();++i){
        const auto& edge=restEdges[reverse?restEdges.size()-1-i:i];
        projectDistance(edge.a,edge.b,edge.rest,restStiffness);
      }
      if(contact)projectBody();
      if(positionStiffness>0)
        for(std::size_t i=0;i<positions.size();++i)
          if(mass[i/3]>0)positions[i]+=(initial[i]-positions[i])*positionStiffness;
    }
    for(std::size_t i=0;i<n;++i){
      Json pos=Json::array();
      for(int axis=0;axis<3;++axis){
        const double coordinate=positions[i*3+axis];
        if(!std::isfinite(coordinate))
          throw std::invalid_argument("Seam assembly made invalid particle "+std::to_string(i));
        pos.push_back(coordinate);
      }
      output["particles"][i]["position"]=pos;
      output["particles"][i]["previous"]=pos;
    }
    // Reuse the original well-tested metric/clearance inspection, without
    // iterating the already computed advanced pose again.
    const auto old=native_seam_assembly::assembleNativeSeams(
      source,Json{{"iterations",0}},jsonClearance);
    const auto finished=native_seam_assembly::assembleNativeSeams(
      output,Json{{"iterations",0}},jsonClearance);
    const Json before=old.at("initialAssembly"),after=finished.at("initialAssembly");
    output["initialAssembly"]=after;
    output["assemblyExperiment"]=Json{
      {"algorithm","seam-aware-rest-edge-relaxation-v1"},
      {"iterations",iterations},
      {"input",before},{"output",after},
      {"collision",native_seam_assembly::inspectStagedAvatarContact(output,jsonClearance)},
      {"contactConstrained",contact},{"jointConstraintMode",joint},
      {"seamGapImproved",number(after.at("initialSeamGapMaximumMm"))<
       number(before.at("initialSeamGapMaximumMm"))},
      {"restStrainImproved",number(after.at("initialMeshPeakEdgeStrainPercent"))<
       number(before.at("initialMeshPeakEdgeStrainPercent"))},
      {"collisionCertified",false},{"safeToAutoApply",false},
      {"enabledForProduction",false}
    };
    return output;
  }
 private:
  void projectDistance(std::size_t a,std::size_t b,double rest,double stiff){
    const double wa=mass[a],wb=mass[b],both=wa+wb;
    if(both<=0)return;
    const auto ai=a*3,bi=b*3;
    const double dx=positions[bi]-positions[ai];
    const double dy=positions[bi+1]-positions[ai+1];
    const double dz=positions[bi+2]-positions[ai+2];
    const double length=hypot3(dx,dy,dz);
    if(!(length>1e-10))return;
    const double error=(length-rest)/length;
    const double factor=std::max(wa/both,wb/both);
    const double correction=std::clamp(length*error*stiff,
      -maxMove/factor,maxMove/factor)/length;
    const double mx=dx*correction,my=dy*correction,mz=dz*correction;
    positions[ai]+=mx*(wa/both);
    positions[ai+1]+=my*(wa/both);
    positions[ai+2]+=mz*(wa/both);
    positions[bi]-=mx*(wb/both);
    positions[bi+1]-=my*(wb/both);
    positions[bi+2]-=mz*(wb/both);
  }
  struct VirtualGradient {
    std::size_t i;
    double weight;
  };
  void projectVirtualSeam(const Json& seam,bool accumulate){
    Vec3 a{},b{};
    std::vector<VirtualGradient> gradients;
    for(int side=0;side<2;++side){
      const auto& ids=seam.at(side?"targetIndices":"sourceIndices");
      const auto& ws=seam.at(side?"targetWeights":"sourceWeights");
      for(std::size_t i=0;i<ids.size();++i){
        auto idx=indexOf(ids[i],n);
        double weight=number(ws.at(i));
        for(int axis=0;axis<3;++axis)
          (side?b:a)[axis]+=positions[idx*3+axis]*weight;
        const auto it=std::find_if(gradients.begin(),gradients.end(),
          [idx](const VirtualGradient& g){return g.i==idx;});
        if(it==gradients.end())gradients.push_back({idx,(side?-1:1)*weight});
        else it->weight+=(side?-1:1)*weight;
      }
    }
    const double dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
    const double length=hypot3(dx,dy,dz);
    if(length<=1e-10)return;
    double denom=0;
    for(const auto& gradient:gradients)
      denom+=mass[gradient.i]*gradient.weight*gradient.weight;
    if(denom<=1e-10)return;
    const double scalar=(length-value(seam,"rest",.008))/length*seamStiffness/denom;
    for(const auto& gradient:gradients){
      const auto index=gradient.i;
      if(mass[index]<=0)continue;
      const double raw=scalar*mass[index]*gradient.weight;
      const double scale=std::min(1.,maxMove/std::max(1e-10,std::abs(raw)*length));
      const auto k=index*3;
      if(accumulate){
        shifts[k]+=dx*raw*scale;
        shifts[k+1]+=dy*raw*scale;
        shifts[k+2]+=dz*raw*scale;
        weights[index]+=std::abs(gradient.weight);
      }else{
        positions[k]+=dx*raw*scale;
        positions[k+1]+=dy*raw*scale;
        positions[k+2]+=dz*raw*scale;
      }
    }
  }
  Vec3 gradient(std::size_t i,const double original) const {
    constexpr double epsilon=.0006;
    const auto& hint=hints[i];
    return {{
      (clearanceAt(positions,i,avatar,hint,epsilon,0,0)-original)/epsilon,
      (clearanceAt(positions,i,avatar,hint,0,epsilon,0)-original)/epsilon,
      (clearanceAt(positions,i,avatar,hint,0,0,epsilon)-original)/epsilon
    }};
  }
  void projectBody(){
    for(std::size_t i=0;i<n;++i){
      if(mass[i]<=0)continue;
      const double clearance=clearanceAt(positions,i,avatar,hints[i]);
      if(clearance>=contactMargin)continue;
      auto grad=gradient(i,clearance);
      const double norm=hypot3(grad[0],grad[1],grad[2]);
      if(norm<1e-7)continue;
      const double move=std::min(maxMove,contactMargin-clearance)/norm;
      for(int axis=0;axis<3;++axis)positions[i*3+axis]+=grad[axis]*move;
    }
  }
  void accumulateEdge(std::size_t a,std::size_t b,double rest,double stiff){
    const double wa=mass[a],wb=mass[b],total=wa+wb;
    if(total<=0)return;
    const auto ai=a*3,bi=b*3;
    const double dx=positions[bi]-positions[ai];
    const double dy=positions[bi+1]-positions[ai+1];
    const double dz=positions[bi+2]-positions[ai+2];
    const double length=hypot3(dx,dy,dz);
    if(length<1e-10)return;
    const double move=std::clamp((length-rest)*stiff,-maxMove,maxMove)/length;
    const double fa=wa/total,fb=wb/total;
    shifts[ai]+=dx*move*fa;
    shifts[ai+1]+=dy*move*fa;
    shifts[ai+2]+=dz*move*fa;
    shifts[bi]-=dx*move*fb;
    shifts[bi+1]-=dy*move*fb;
    shifts[bi+2]-=dz*move*fb;
    weights[a]+=fa;weights[b]+=fb;
  }
  void jointIteration(){
    std::fill(shifts.begin(),shifts.end(),0.);
    std::fill(weights.begin(),weights.end(),0.);
    for(const auto& seam:seams)
      accumulateEdge(seam.a,seam.b,0,seamStiffness*seamPasses);
    for(const auto& seam:virtualSeams)projectVirtualSeam(seam,true);
    for(const auto& edge:restEdges)
      accumulateEdge(edge.a,edge.b,edge.rest,restStiffness);
    for(std::size_t i=0;i<n;++i){
      if(mass[i]<=0)continue;
      const double clearance=clearanceAt(positions,i,avatar,hints[i]);
      if(clearance>=contactMargin)continue;
      const auto grad=gradient(i,clearance);
      const double norm=hypot3(grad[0],grad[1],grad[2]);
      if(norm<1e-7)continue;
      const double d=std::min(maxMove,contactMargin-clearance)*jointWeight/norm;
      for(int axis=0;axis<3;++axis)shifts[i*3+axis]+=grad[axis]*d;
      weights[i]+=jointWeight;
    }
    for(std::size_t i=0;i<n;++i){
      if(mass[i]<=0)continue;
      const auto denominator=std::max(1.,weights[i]);
      for(int axis=0;axis<3;++axis)
        positions[i*3+axis]+=shifts[i*3+axis]/denominator;
    }
  }

  const Json& source;
  const Json& options;
  const Json& avatar;
  Json output;
  std::size_t n=0;
  std::vector<double> positions,initial,mass,shifts,weights;
  std::vector<Json> hints;
  std::vector<Edge> restEdges,seams;
  Json virtualSeams=Json::array();
  int iterations=0;
  double seamPasses=2,seamStiffness=.3,restStiffness=.7,
    positionStiffness=.002,maxMove=.012,contactMargin=.004,jointWeight=.3;
};
}
Json assembleNativeSeams(const Json& payload,const Json& options){
  return AdvancedStage(payload,options).run();
}
}
