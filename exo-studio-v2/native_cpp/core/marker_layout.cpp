#include "marker_layout.hpp"

#include "cutting_geometry.hpp"
#include "grading.hpp"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <limits>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace garment {
namespace {

constexpr double kPi = 3.14159265358979323846;

double finiteNumber(const Json& value, const char* label) {
  if (!value.is_number()) throw std::invalid_argument(std::string(label) + " must be numeric");
  double result=value.get<double>();
  if (!std::isfinite(result) || std::abs(result)>100000)
    throw std::invalid_argument(std::string(label) + " must be a finite length or angle");
  return result;
}

double setting(const Json& object, const char* key, double fallback) {
  if (!object.is_object() || !object.contains(key) || object.at(key).is_null()) return fallback;
  return finiteNumber(object.at(key),key);
}

double normalizedRotation(double angle) {
  double result=std::fmod(angle,360.);
  if (result>180.) result-=360.;
  if (result<=-180.) result+=360.;
  return result;
}

double polygonArea(const std::vector<Point2>& polygon) {
  if (polygon.size()<3) return 0;
  double twice=0;
  for (std::size_t i=0;i<polygon.size();++i) {
    const auto& a=polygon[i], &b=polygon[(i+1)%polygon.size()];
    twice+=a.x*b.y-b.x*a.y;
  }
  return std::abs(twice)/2;
}

Json pointsToJson(const std::vector<Point2>& points) {
  Json output=Json::array();
  for (const auto& point:points) output.push_back({{"x",point.x},{"y",point.y}});
  return output;
}

struct Box {
  std::vector<Point2> sampled;
  double minX=0,maxX=0,minY=0,maxY=0;
  double width=0,height=0;
};

Box rotatedBounds(const Json& piece,double angle) {
  Box box;
  const auto cut=sampleCutBoundary(piece,10);
  const double radians=angle*kPi/180.;
  const double c=std::cos(radians),s=std::sin(radians);
  box.minX=box.minY=std::numeric_limits<double>::infinity();
  box.maxX=box.maxY=-std::numeric_limits<double>::infinity();
  for (const auto& p:cut) {
    const Point2 rotated{p.x*c-p.y*s,p.x*s+p.y*c};
    box.sampled.push_back(rotated);
    box.minX=std::min(box.minX,rotated.x);box.maxX=std::max(box.maxX,rotated.x);
    box.minY=std::min(box.minY,rotated.y);box.maxY=std::max(box.maxY,rotated.y);
  }
  box.width=box.maxX-box.minX;
  box.height=box.maxY-box.minY;
  return box;
}

struct Option {
  Box box;
  double rotationDeg=0;
  bool crossGrain=false;
};

std::vector<Option> orientations(const Json& piece) {
  double base=normalizedRotation(-setting(piece,"grainAngleDeg",0));
  const bool cross=piece.contains("marker") && piece.at("marker").is_object() &&
                   piece.at("marker").value("allowCrossGrain",false);
  std::vector<Option> options;
  std::set<double> seen;
  for (int index=0;index<(cross?2:1);++index) {
    const double rotation=normalizedRotation(base+(index?90.:0.));
    const double key=std::round(rotation*1000)/1000;
    if (!seen.insert(key).second) continue;
    options.push_back({rotatedBounds(piece,rotation),rotation,index>0});
  }
  return options;
}

int cutQuantity(const Json& piece) {
  const double value=setting(piece,"cutQuantity",1);
  // Same 1..99 input bounds as the JS marker, with explicit finite validation.
  return std::max(1,std::min(99,static_cast<int>(std::floor((value==0?1:value)+.5))));
}

struct Entry {
  const Json* piece=nullptr;
  std::string id;
  std::string name;
  int instance=0;
  double area=0;
  std::vector<Option> options;
};

struct Placed {
  double x=0,y=0,width=0,height=0;
  double area=0;
  Json value;
};

bool overlaps(double x,double y,double width,double height,const Placed& other,double gap) {
  return !(x+width+gap<=other.x || other.x+other.width+gap<=x ||
           y+height+gap<=other.y || other.y+other.height+gap<=y);
}

Json buildMarkerForFabric(const Document& document, const std::string& fabricId,
                          double width,double gap) {
  if (!(width>0) || width>100000 || gap<0 || gap>100000 || !std::isfinite(gap))
    throw std::invalid_argument("marker fabric width must be positive and gap nonnegative");
  std::vector<Entry> entries;
  for (const auto& piece:document.data().at("pieces")) {
    auto assigned=piece.value("fabricId",std::string("main"));
    if (assigned.empty()) assigned="main"; // JS piece.fabricId || 'main'
    if (assigned!=fabricId) continue;
    const auto options=orientations(piece);
    if (options.empty()) continue;
    const auto area=polygonArea(sampleCutBoundary(piece,12));
    const auto id=piece.at("id").get<std::string>();
    const auto name=piece.value("name",id);
    const int copies=cutQuantity(piece);
    for (int i=0;i<copies;++i)
      entries.push_back({&piece,id,name,i,area,options});
  }
  std::stable_sort(entries.begin(),entries.end(),[](const Entry& a,const Entry& b) {
    if (std::abs(b.area-a.area)>1e-6) return a.area>b.area;
    auto longest=[](const Entry& e) {
      double length=0;
      for (const auto& option:e.options)
        length=std::max(length,std::max(option.box.width,option.box.height));
      return length;
    };
    return longest(a)>longest(b);
  });

  std::vector<Placed> placements;
  Json unplaced=Json::array();
  for (const auto& entry:entries) {
    std::set<double> xs={0},ys={0};
    double existingLength=0;
    for (const auto& p:placements) {
      xs.insert(p.x+p.width+gap);
      ys.insert(p.y+p.height+gap);
      existingLength=std::max(existingLength,p.y+p.height);
    }
    double bestScore=std::numeric_limits<double>::infinity();
    const Option* best=nullptr;
    double bestX=0,bestY=0;
    for (const auto& option:entry.options) {
      for (const double y:ys) for (const double x:xs) {
        if (x+option.box.width>width+1e-6) continue;
        bool blocked=false;
        for (const auto& previous:placements)
          if (overlaps(x,y,option.box.width,option.box.height,previous,gap)) {blocked=true;break;}
        if (blocked) continue;
        const double resultingLength=std::max(existingLength,y+option.box.height);
        const double rightWaste=width-(x+option.box.width);
        const double score=resultingLength*1e6+y*1e4+rightWaste*10+x;
        if (score<bestScore) {best=&option;bestScore=score;bestX=x;bestY=y;}
      }
    }
    if (!best) {
      double minWidth=std::numeric_limits<double>::infinity();
      for (const auto& option:entry.options) minWidth=std::min(minWidth,option.box.width);
      unplaced.push_back({{"pieceId",entry.id},{"instance",entry.instance},
                           {"name",entry.name},{"minimumWidthCm",minWidth},
                           {"reason",minWidth>width?"too-wide":"no-space"}});
      continue;
    }
    std::vector<Point2> outline;
    outline.reserve(best->box.sampled.size());
    for (const auto& point:best->box.sampled)
      outline.push_back({bestX+point.x-best->box.minX,bestY+point.y-best->box.minY});
    Json data={{"pieceId",entry.id},{"instance",entry.instance},{"name",entry.name},
               {"x",bestX},{"y",bestY},{"width",best->box.width},
               {"height",best->box.height},{"rotationDeg",best->rotationDeg},
               {"rotated",best->crossGrain},{"crossGrain",best->crossGrain},
               {"area",entry.area},{"outline",pointsToJson(outline)}};
    placements.push_back({bestX,bestY,best->box.width,best->box.height,entry.area,std::move(data)});
  }
  double length=0,usedArea=0;
  Json placementJson=Json::array();
  for (const auto& p:placements) {
    length=std::max(length,p.y+p.height);
    usedArea+=p.area;
    placementJson.push_back(p.value);
  }
  const double markerArea=width*std::max(length,.001);
  return {{"fabricId",fabricId},{"width",width},{"length",length},{"gap",gap},
          {"placements",placementJson},{"efficiency",markerArea>0?usedArea/markerArea:0},
          {"unusedPieces",unplaced.size()},{"requestedPieces",entries.size()},
          {"unplaced",unplaced}};
}

} // namespace

Json buildFabricMarkers(const Document& document) {
  const auto& source=document.data();
  const Json settings=source.value("markerSettings",Json::object());
  const double commonWidth=setting(settings,"fabricWidthCm",150);
  const double gap=setting(settings,"gapCm",1.5);
  const Json overrides=settings.is_object() ? settings.value("fabricWidthsCm",Json::object()) : Json::object();
  std::vector<std::string> fabrics;
  for (const auto& piece:source.at("pieces")) {
    auto id=piece.value("fabricId",std::string("main"));
    if (id.empty()) id="main"; // Preserve the JS marker fabric fallback.
    if (std::find(fabrics.begin(),fabrics.end(),id)==fabrics.end()) fabrics.push_back(id);
  }
  Json result=Json::object();
  for (const auto& fabricId:fabrics) {
    double width=commonWidth;
    if (overrides.is_object()) {
      auto it=overrides.find(fabricId);
      if (it!=overrides.end() && !it->is_null()) width=finiteNumber(it.value(),"fabricWidthsCm");
    }
    result[fabricId]=buildMarkerForFabric(document,fabricId,width,gap);
  }
  return result;
}

Json buildMarkerSizeRun(const Document& document) {
  const auto graded=gradeSizeRun(document);
  Json result=Json::object();
  for (auto it=graded.begin();it!=graded.end();++it) {
    Document sizeDocument(it.value());
    result[it.key()]=buildFabricMarkers(sizeDocument);
  }
  return result;
}

} // namespace garment
