#include "tech_pack_export.hpp"
#include "grading.hpp"
#include "marker_layout.hpp"
#include "measurement_export.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {
Json get(const Json& v,const char* name,const Json& fallback=Json()) {
  return v.is_object() && v.contains(name)?v.at(name):fallback;
}
Json getNull(const Json& obj,const char* name) {
  const Json value=get(obj,name);
  if (value.is_null() || (value.is_string() && value.empty())) return nullptr;
  return value;
}
Json getOr(const Json& obj,const char* name,const Json& fallback) {
  const Json val=get(obj,name);
  return val.is_null()?fallback:val;
}
void optionalKey(Json& into,const char* target,const Json& from,const char* source) {
  if (from.is_object() && from.contains(source)) into[target]=from.at(source);
}
double finiteNumber(const Json& val,const char* label) {
  if (!val.is_number()) throw std::invalid_argument(std::string(label)+" must be a number");
  const double d=val.get<double>();
  if (!std::isfinite(d)) throw std::invalid_argument(std::string(label)+" must be finite");
  return d;
}
double number(const Json& val,const char* label,double fallback) {
  if (val.is_null()) return fallback;
  return finiteNumber(val,label);
}
double rounded(double d,int places) {
  const double scale=std::pow(10.,places);
  double value=std::round(d*scale)/scale;
  return value==0?0:value;
}

std::vector<std::string> sizes(const Json& project) {
  const Json grading=project.value("grading",Json::object());
  std::vector<std::string> names;
  if (grading.is_object() && grading.contains("sizes") && grading.at("sizes").is_array())
    for (const auto& size:grading.at("sizes")) names.push_back(size.get<std::string>());
  else names.push_back(grading.is_object()?grading.value("baseSize",std::string("M")):"M");
  if (names.empty()) throw std::invalid_argument("tech pack requires at least one size");
  return names;
}

Json fabricSummary(const Json& fabric) {
  Json out=Json::object();
  for (const char* key:{"id","name","color","gsm","thickness","stretchWarp","stretchWeft",
                         "shrinkWarp","shrinkWeft","bend","friction","damping"})
    optionalKey(out,key,fabric,key);
  for (const auto& entry : std::vector<std::pair<const char*,double>>{
       {"roughness",.82},{"opacity",1},{"displacementMm",0},{"metalness",0},
       {"sheen",.22},{"sheenRoughness",.84},{"normalStrength",1},
       {"fiberAnisotropy",.16},{"fiberAngleDeg",0},{"clearcoat",0},
       {"clearcoatRoughness",.45},{"colorVariation",.25},{"weaveScaleCm",3}})
    out[entry.first]=getOr(fabric,entry.first,entry.second);
  out["surfaceFamily"]=getOr(fabric,"surfaceFamily","auto");
  const Json texture=get(fabric,"texture");
  if (texture.is_object() && !texture.empty()) {
    Json mapped=Json::object();
    for (const auto& pair : std::vector<std::pair<const char*,const char*>>{
         {"colorMap","name"},{"normalMap","normalName"},
         {"roughnessMap","roughnessName"},{"metalnessMap","metalnessName"},
         {"opacityMap","opacityName"},{"displacementMap","displacementName"}})
      mapped[pair.first]=getNull(texture,pair.second);
    mapped["repeatWidthCm"]=getOr(texture,"repeatWidthCm",20);
    mapped["repeatHeightCm"]=getOr(texture,"repeatHeightCm",20);
    mapped["rotationDeg"]=getOr(texture,"rotationDeg",0);
    out["texture"]=mapped;
  } else out["texture"]=nullptr;
  return out;
}

Json patternPiece(const Json& p) {
  Json item=Json::object();
  for (const char* key:{"id","name"}) optionalKey(item,key,p,key);
  item["role"]=getOr(p,"generatedRole","shell");
  for (const auto& pair:std::vector<std::pair<const char*,const char*>>{
    {"liningForPieceId","liningForPieceId"},
    {"interfacingForPieceId","interfacingForPieceId"},
    {"fusedToPieceId","fusedToPieceId"}})
    item[pair.first]=getNull(p,pair.second);
  optionalKey(item,"seamAllowanceCm",p,"seamAllowance");
  item["edgeSeamAllowancesCm"]=getOr(p,"edgeSeamAllowances",Json::object());
  optionalKey(item,"fabricId",p,"fabricId");
  item["notches"]=Json::array();
  const auto notches=getOr(p,"notches",Json::array());
  for (const auto& notch:notches) {
    Json n=Json::object();
    for (const char* key:{"id","edgeIndex"}) optionalKey(n,key,notch,key);
    n["t"]=getOr(notch,"t",0.5);
    n["type"]=getOr(notch,"type","single");
    n["depthCm"]=getOr(notch,"depthCm",0.45);
    n["matchGroupId"]=getNull(notch,"matchGroupId");
    n["matchedSeamId"]=getNull(notch,"matchedSeamId");
    item["notches"].push_back(n);
  }
  item["buttonholes"]=Json::array();
  for (const auto& hole:getOr(p,"buttonholes",Json::array())) {
    Json b=Json::object();
    optionalKey(b,"id",hole,"id");
    for (const auto& pair:std::vector<std::pair<const char*,double>>{
         {"x",0},{"y",0},{"lengthCm",2.4},{"widthCm",0.35},{"orientationDeg",0}})
      b[pair.first]=getOr(hole,pair.first,pair.second);
    b["pairedButtonId"]=getNull(hole,"pairedButtonId");
    item["buttonholes"].push_back(b);
  }
  item["internalLines"]=getOr(p,"internalLines",Json::array());
  item["gradePoints"]=Json::array();
  if (p.contains("points")) {
    std::size_t index=0;
    for (const auto& point:p.at("points")) {
      Json grade={{"pointIndex",index++},{"x",point.at("x")},{"y",point.at("y")},{"rule",nullptr}};
      const auto rule=get(point,"gradeRule");
      if (rule.is_object() && rule.value("enabled",false))
        grade["rule"]={{"dxPerSize",getOr(rule,"dxPerSize",0)},
                       {"dyPerSize",getOr(rule,"dyPerSize",0)}};
      item["gradePoints"].push_back(grade);
    }
  }
  return item;
}

Json markerSummary(const Json& markers,double width,double gap) {
  const Json* first=nullptr;
  if (markers.contains("main")) first=&markers.at("main");
  else if (!markers.empty()) first=&markers.begin().value();
  const Json defaultMarker={{"width",width},{"gap",gap},{"length",0},{"efficiency",0}};
  const Json& marker=first?*first:defaultMarker;
  Json out={{"fabricWidthCm",marker.at("width")},{"gapCm",marker.at("gap")},
            {"markerLengthCm",rounded(finiteNumber(marker.at("length"),"marker length"),2)},
            {"efficiency",rounded(finiteNumber(marker.at("efficiency"),"efficiency"),4)},
            {"byFabric",Json::object()}};
  for (auto it=markers.begin();it!=markers.end();++it) {
    const auto& m=it.value();
    out["byFabric"][it.key()]={{"fabricWidthCm",m.at("width")},{"gapCm",m.at("gap")},
       {"markerLengthCm",rounded(finiteNumber(m.at("length"),"marker length"),2)},
       {"efficiency",rounded(finiteNumber(m.at("efficiency"),"efficiency"),4)},
       {"requestedPieces",m.at("requestedPieces")},{"placedPieces",m.at("placements").size()},
       {"unusedPieces",m.at("unusedPieces")},{"unplaced",m.at("unplaced")}};
  }
  return out;
}
} // namespace

Json buildTechPack(const Document& document) {
  const Json& project=document.data();
  Json output={{"format","garment-studio-tech-pack"},{"version",1}};
  Json projectInfo=Json::object();
  for (const char* key:{"id","name","revision","units"}) optionalKey(projectInfo,key,project,key);
  output["project"]=projectInfo;
  output["productionSpec"]=getNull(project,"productionSpec");
  optionalKey(output,"grading",project,"grading");
  Json avatar=getOr(project,"avatar",Json::object());
  if (!avatar.is_object()) throw std::invalid_argument("avatar must be object");
  const double height=number(get(avatar,"heightCm"),"heightCm",180);
  avatar["armLengthCm"]=number(get(avatar,"armLengthCm"),"armLengthCm",72*height/180);
  output["avatar"]=avatar;
  output["sizeMeasurements"]=buildMeasurementSizeRun(document);
  output["materials"]=Json::array();
  const Json fabrics=getOr(project,"fabrics",Json::object());
  if (!fabrics.is_object()) throw std::invalid_argument("fabrics must be object");
  for (auto it=fabrics.begin();it!=fabrics.end();++it)
    output["materials"].push_back(fabricSummary(it.value()));
  output["patternPieces"]=Json::array();
  for (const auto& p:project.at("pieces")) output["patternPieces"].push_back(patternPiece(p));
  output["customMeasurements"]=Json::array();
  for (const auto& m:getOr(project,"customMeasurements",Json::array())) {
    Json item=Json::object();
    optionalKey(item,"id",m,"id");
    item["label"]=getOr(m,"label","Custom measurement");
    for (const char* key:{"pieceId","a","b"}) optionalKey(item,key,m,key);
    item["toleranceCm"]=getOr(m,"toleranceCm",0.5);
    output["customMeasurements"].push_back(item);
  }
  output["construction"]=Json::array();
  for (const auto& seam:getOr(project,"seams",Json::array())) {
    Json item=Json::object();
    for (const char* key:{"id","name"}) optionalKey(item,key,seam,key);
    item["type"]=getOr(seam,"type","normal");
    optionalKey(item,"from",seam,"a");
    optionalKey(item,"to",seam,"b");
    item["reverseB"]=getOr(seam,"reverseB",false);
    for (const char* key:{"ratio","easeSide","gatherSide","openFraction","openFrom"})
      item[key]=getNull(seam,key);
    output["construction"].push_back(item);
  }
  const Json settings=getOr(project,"markerSettings",Json::object());
  const double width=number(get(settings,"fabricWidthCm"),"fabricWidthCm",150);
  const double gap=number(get(settings,"gapCm"),"gapCm",1.5);
  output["markers"]=Json::object();
  for (const auto& size:sizes(project)) {
    Document sized(gradeProject(document,size));
    output["markers"][size]=markerSummary(buildFabricMarkers(sized),width,gap);
  }
  return output;
}

} // namespace garment
