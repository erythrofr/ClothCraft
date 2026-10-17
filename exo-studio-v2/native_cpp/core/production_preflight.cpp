#include "production_preflight.hpp"
#include "grading.hpp"
#include "marker_layout.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <set>
#include <sstream>
#include <string>
#include <vector>

namespace garment {
namespace {
const Json& field(const Json& j, const char* key) {
  static const Json absent;
  return j.is_object() && j.contains(key) ? j.at(key) : absent;
}
std::string str(const Json& j, const std::string& fallback = "") {
  if (j.is_string()) return j.get<std::string>();
  return fallback;
}
double number(const Json& j, double fallback) {
  if (j.is_null()) return fallback;
  if (j.is_number()) return j.get<double>();
  if (j.is_boolean()) return j.get<bool>() ? 1 : 0;
  if (j.is_string()) {
    try {
      const auto s = j.get<std::string>();
      if (s.empty()) return 0;
      std::size_t consumed = 0;
      const double v = std::stod(s, &consumed);
      return consumed == s.size() ? v : NAN;
    } catch (...) { return NAN; }
  }
  return NAN;
}
bool validPoint(const Json& j) {
  return field(j, "x").is_number() && field(j, "y").is_number() &&
         std::isfinite(number(field(j, "x"), NAN)) &&
         std::isfinite(number(field(j, "y"), NAN));
}
struct Vec { double x, y; };
Vec point(const Json& j) { return {number(field(j, "x"), NAN), number(field(j, "y"), NAN)}; }
double distance(Vec a, Vec b) { return std::hypot(a.x - b.x, a.y - b.y); }
Vec quadratic(Vec a, Vec c, Vec b, double t) {
  const double u = 1 - t;
  return {u*u*a.x+2*u*t*c.x+t*t*b.x, u*u*a.y+2*u*t*c.y+t*t*b.y};
}
std::vector<Vec> edgeSamples(const Json& piece, std::size_t i, int segments) {
  const auto& points = field(piece, "points");
  Vec a = point(points[i]), b = point(points[(i+1)%points.size()]);
  const auto& curves = field(piece, "curves");
  auto key = std::to_string(i);
  if (!curves.is_object() || !curves.contains(key) || !curves[key].is_object())
    return {a,b};
  Vec c{number(field(curves[key], "cx"), NAN), number(field(curves[key], "cy"), NAN)};
  std::vector<Vec> out;
  for (int step=0; step<=segments; ++step)
    out.push_back(quadratic(a,c,b,static_cast<double>(step)/segments));
  return out;
}
// Quadratic length approximation closely tracks the browser implementation.
double edgeLength(const Json& piece, std::size_t i) {
  const auto& curves = field(piece, "curves");
  const auto key = std::to_string(i);
  if (!curves.is_object() || !curves.contains(key)) {
    const auto& pts = piece["points"];
    return distance(point(pts[i]),point(pts[(i+1)%pts.size()]));
  }
  const auto samples = edgeSamples(piece,i,128);
  double total=0;
  for (std::size_t k=1;k<samples.size();++k) total+=distance(samples[k-1],samples[k]);
  return total;
}
std::vector<Vec> boundary(const Json& piece) {
  std::vector<Vec> out;
  const auto& pts=piece["points"];
  for (std::size_t i=0;i<pts.size();++i) {
    auto samples=edgeSamples(piece,i,6);
    out.insert(out.end(),samples.begin(),samples.end()-1);
  }
  return out;
}
double area(const std::vector<Vec>& pts) {
  double sum=0;
  for (std::size_t i=0;i<pts.size();++i) {
    auto a=pts[i], b=pts[(i+1)%pts.size()];
    sum+=a.x*b.y-b.x*a.y;
  }
  return std::abs(sum)*0.5;
}
double orient(Vec a,Vec b,Vec c) { return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
bool crossing(const std::vector<Vec>& p) {
  for (std::size_t i=0;i<p.size();++i)
    for (std::size_t j=i+2;j<p.size();++j) {
      if (i==0 && j==p.size()-1) continue;
      const auto a=p[i], b=p[(i+1)%p.size()], c=p[j], d=p[(j+1)%p.size()];
      if (orient(a,b,c)*orient(a,b,d)<-1e-9 &&
          orient(c,d,a)*orient(c,d,b)<-1e-9) return true;
    }
  return false;
}
const Json* findPiece(const Json& pieces, const std::string& id) {
  for (const auto& p:pieces) if (str(field(p,"id"))==id) return &p;
  return nullptr;
}
bool validIndex(const Json& index, std::size_t max) {
  const double v=number(index,NAN);
  return std::isfinite(v) && std::floor(v)==v && v>=0 && v<max;
}
double seamSpan(const Json& p,const Json& side) {
  const std::size_t edge=static_cast<std::size_t>(number(field(side,"edgeIndex"),0));
  auto clamp=[](double v){ return std::max(0.0,std::min(1.0,v)); };
  return edgeLength(p,edge)*std::abs(clamp(number(field(side,"endT"),1))-
                                      clamp(number(field(side,"startT"),0)));
}
}

Json inspectProduction(const Json& project, bool allSizes) {
  Json issues=Json::array(), sizes=Json::array();
  auto add=[&](const char* severity,const char* code,const std::string& scope,const std::string& message) {
    issues.push_back({{"severity",severity},{"code",code},{"scope",scope},{"message",message}});
  };
  const Json empty=Json::array();
  const Json& pieces=field(project,"pieces").is_array()?field(project,"pieces"):empty;
  const Json& seams=field(project,"seams").is_array()?field(project,"seams"):empty;
  const Json& fabrics=field(project,"fabrics");
  std::set<std::string> ids, validPieces;
  if (pieces.empty()) add("blocker","NO_PATTERNS","Pattern","There are no pattern pieces to manufacture.");
  for (const auto& p:pieces) {
    const std::string id=str(field(p,"id"));
    const std::string display=str(field(p,"name"),id.empty()?"unnamed":id);
    const std::string scope="Pattern · "+(display.empty()?"unnamed":display);
    if (id.empty() || ids.count(id)) add("blocker","DUPLICATE_ID",scope,"Pattern ID is missing or duplicated.");
    ids.insert(id);
    const auto& pts=field(p,"points");
    bool geometry=pts.is_array() && pts.size()>=3;
    if (geometry) for (const auto& pt:pts) if (!validPoint(pt)) geometry=false;
    if (!geometry) {
      add("blocker","INVALID_GEOMETRY",scope,"Pattern has fewer than three valid finite points.");
      continue;
    }
    const double qty=number(field(p,"cutQuantity"),1);
    if (!std::isfinite(qty) || std::floor(qty)!=qty || qty<1 || qty>99)
      add("blocker","CUT_QUANTITY",scope,"Cut quantity must be an integer from 1 to 99.");
    const std::string fabricId=str(field(p,"fabricId"),"main");
    if (!fabrics.is_object() || !fabrics.contains(fabricId) || fabrics[fabricId].is_null() || fabrics[fabricId]==false)
      add("blocker","MISSING_FABRIC",scope,"Fabric '"+fabricId+"' is not present in the material library.");
    const double allowance=number(field(p,"seamAllowance"),0);
    if (!std::isfinite(allowance)||allowance<0)
      add("blocker","SEAM_ALLOWANCE",scope,"Invalid seam allowance.");
    bool invalidEdge=false;
    for (std::size_t i=0;i<pts.size();++i) {
      double length=edgeLength(p,i);
      if (!std::isfinite(length)||length<0.05) invalidEdge=true;
    }
    if (invalidEdge) add("blocker","ZERO_LENGTH_EDGE",scope,"Pattern has an extremely short or invalid edge (under 0.5 mm).");
    const auto outline=boundary(p);
    if (area(outline)<0.1) add("blocker","ZERO_AREA",scope,"Pattern area is too small (under 0.1 cm²).");
    if (crossing(outline)) add("blocker","SELF_INTERSECTION",scope,"Cut outline crosses itself. Repair the drafting topology before production.");
    const auto& notches=field(p,"notches");
    if (notches.is_array()) for (const auto& n:notches) {
      const double t=number(field(n,"t"),0.5);
      if (!validIndex(field(n,"edgeIndex"),pts.size()) || !std::isfinite(t)||t<0||t>1)
        add("warning","NOTCH_INVALID",scope,"A notch has an invalid edge or position and could be dropped by DXF export.");
    }
    validPieces.insert(id);
  }
  for (const auto& seam:seams) {
    const std::string id=str(field(seam,"id"));
    const std::string name=str(field(seam,"name"),id.empty()?"unnamed":id);
    const std::string scope="Seam · "+(name.empty()?"unnamed":name);
    const Json &a=field(seam,"a"), &b=field(seam,"b");
    const Json *pa=findPiece(pieces,str(field(a,"pieceId"))), *pb=findPiece(pieces,str(field(b,"pieceId")));
    const bool valid=pa && pb && validPieces.count(str(field(a,"pieceId"))) &&
      validPieces.count(str(field(b,"pieceId"))) &&
      validIndex(field(a,"edgeIndex"),field(*pa,"points").size()) &&
      validIndex(field(b,"edgeIndex"),field(*pb,"points").size());
    if (!valid) {
      add("blocker","BROKEN_SEAM",scope,"Sewing references a missing pattern or edge.");
      continue;
    }
    const double la=seamSpan(*pa,a), lb=seamSpan(*pb,b), avg=(la+lb)*0.5;
    const double mismatch=avg>0?std::abs(la-lb)/avg*100:0;
    if (!std::isfinite(mismatch)||la<=0||lb<=0)
      add("blocker","INVALID_SEAM_LENGTH",scope,"Seam endpoints have invalid lengths.");
    else if (mismatch>2) {
      std::ostringstream fmt; fmt<<std::fixed<<std::setprecision(1)<<mismatch;
      add("warning","SEAM_MISMATCH",scope,"Edge length mismatch "+fmt.str()+"%. Review ease, gathering and construction.");
    }
  }
  const auto& grading=field(project,"grading");
  const auto& run=field(grading,"sizes");
  if (allSizes && run.is_array() && !run.empty()) sizes=run;
  else {
    auto fallback=str(field(grading,"baseSize"),"M");
    if (!allSizes) fallback=str(field(project,"previewSize"),fallback);
    sizes.push_back(fallback);
  }
  std::set<std::string> seen;
  Json unique=Json::array();
  bool duplicated=false;
  for (const auto& size:sizes) {
    const std::string key=size.dump();
    if (!seen.insert(key).second) duplicated=true;
    else unique.push_back(size);
  }
  if (duplicated) add("blocker","DUPLICATE_SIZE","Grading","Size run contains duplicate size names.");
  Json markerSummary=Json::array();
  bool validGeometry=true;
  for (const auto& issue:issues) {
    if (issue["severity"]!="blocker") continue;
    const auto code=issue["code"].get<std::string>();
    if (code=="NO_PATTERNS" || code=="INVALID_GEOMETRY" || code=="ZERO_LENGTH_EDGE" ||
        code=="ZERO_AREA" || code=="SELF_INTERSECTION") validGeometry=false;
  }
  if (validGeometry) for (const auto& size:unique) {
    const std::string sizeName=str(size);
    try {
      // Construct separately for every size: malformed project data becomes
      // the same per-size generation issue rather than escaping this API.
      Document original(project);
      Document graded(gradeProject(original,sizeName));
      const Json markers=buildFabricMarkers(graded);
      for (auto it=markers.begin();it!=markers.end();++it) {
        const auto& marker=it.value();
        const auto unplaced=marker.at("unusedPieces").get<std::size_t>();
        const double length=number(field(marker,"length"),NAN);
        const double efficiency=number(field(marker,"efficiency"),NAN);
        markerSummary.push_back({{"size",sizeName},{"fabricId",it.key()},
          {"requested",marker.at("requestedPieces")},
          {"placed",marker.at("placements").size()}, {"unplaced",unplaced},
          {"lengthCm",std::isfinite(length)?Json(length):Json(nullptr)},
          {"efficiency",std::isfinite(efficiency)?Json(efficiency):Json(nullptr)}});
        const auto scope=sizeName+" · "+it.key();
        if (unplaced) add("blocker","MARKER_OVERFLOW",scope,
          std::to_string(unplaced)+" cut piece(s) could not fit the configured fabric width ("+
          [&]{ std::ostringstream ss; ss<<marker.at("width").get<double>(); return ss.str(); }()+" cm).");
        if (!std::isfinite(length)||!std::isfinite(efficiency))
          add("blocker","INVALID_MARKER",scope,"Marker layout contains invalid dimensions.");
      }
    } catch (const std::exception& error) {
      add("blocker","MARKER_GENERATION","Size · "+sizeName,
          "Could not generate size marker: "+std::string(error.what()));
    }
  }
  int blockers=0,warnings=0;
  for (const auto& issue:issues) {
    if (issue["severity"]=="blocker") ++blockers;
    else ++warnings;
  }
  return {{"status",blockers?"BLOCKED":warnings?"REVIEW":"STRUCTURAL_CHECK_PASS"},
    {"blockers",blockers},{"warnings",warnings},{"issues",issues},
    {"sizes",unique},{"markerSummary",markerSummary},{"factoryCertified",false}};
}
} // namespace garment
