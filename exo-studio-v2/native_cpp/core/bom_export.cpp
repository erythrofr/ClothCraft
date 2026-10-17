#include "bom_export.hpp"

#include "fabric_cost.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <locale>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace garment {
namespace {
using Attributes = std::vector<std::pair<std::string, std::string>>;

std::string textValue(const Json& value) {
  if (value.is_null()) return "";
  if (value.is_string()) return value.get<std::string>();
  if (value.is_boolean()) return value.get<bool>() ? "true" : "false";
  if (value.is_number()) return value.dump();
  return value.dump();
}

std::string valueOr(const Json& object, const char* key, const std::string& fallback="") {
  if (!object.is_object() || !object.contains(key) || object.at(key).is_null()) return fallback;
  const auto value=textValue(object.at(key));
  return value.empty()?fallback:value;
}

double asNumber(const Json& value, double fallback=0) {
  if (value.is_null()) return fallback;
  try {
    double result=0;
    if (value.is_number()) result=value.get<double>();
    else if (value.is_string()) {
      const auto s=value.get<std::string>();
      if (s.empty()) return 0;
      std::size_t used=0;
      result=std::stod(s,&used);
      if (used!=s.size()) return fallback;
    } else if (value.is_boolean()) result=value.get<bool>()?1.:0.;
    else return fallback;
    return std::isfinite(result)?result:fallback;
  } catch (const std::exception&) { return fallback; }
}

double numeric(const Json& value, const char* name) {
  if (!value.is_number()) throw std::invalid_argument(std::string(name)+" must be numeric");
  const double result=value.get<double>();
  if (!std::isfinite(result)) throw std::invalid_argument(std::string(name)+" must be finite");
  return result;
}

double fieldNumber(const Json& object, const char* key, double fallback=0) {
  return object.is_object() && object.contains(key) && !object.at(key).is_null()
      ? asNumber(object.at(key),fallback):fallback;
}

std::string fixed(double number, int places) {
  if (!std::isfinite(number)) return "";
  std::ostringstream stream;
  stream.imbue(std::locale::classic());
  stream << std::fixed << std::setprecision(places) << number;
  return stream.str();
}

std::string escape(const std::string& input) {
  std::string output;
  for (char ch:input) {
    switch (ch) {
      case '&': output+="&amp;";break;
      case '<': output+="&lt;";break;
      case '>': output+="&gt;";break;
      case '"': output+="&quot;";break;
      case '\'': output+="&apos;";break;
      default:output+=ch;
    }
  }
  return output;
}

std::string element(const std::string& name,const Attributes& attrs,const std::string& content="") {
  std::string result="<"+name;
  for (const auto& attr:attrs) result+=" "+attr.first+"=\""+escape(attr.second)+"\"";
  return result+">"+content+"</"+name+">";
}

int quantity(const Json& piece) {
  const double n=fieldNumber(piece,"cutQuantity",1);
  if (!std::isfinite(n) || n<0 || n>99) throw std::invalid_argument("invalid BOM cut quantity");
  return std::max(1,static_cast<int>(std::floor(n+0.5)));
}

// Stitch-line area uses 12 segments per Bézier edge, exactly as the JS BOM
// exporter's pieceArea(piece) contract. Do not use seam-allowance cut area here.
double stitchArea(const Json& piece) {
  const auto& points=piece.at("points");
  if (!points.is_array() || points.size()<3) return 0;
  const Json curves=piece.value("curves",Json::object());
  std::vector<Point2> sampled;
  for (std::size_t i=0;i<points.size();++i) {
    const auto& a=points[i];
    const auto& b=points[(i+1)%points.size()];
    const Point2 p{numeric(a.at("x"),"x"),numeric(a.at("y"),"y")};
    const Point2 q{numeric(b.at("x"),"x"),numeric(b.at("y"),"y")};
    const auto it=curves.is_object()?curves.find(std::to_string(i)):curves.end();
    if (it==curves.end() || it->is_null()) { sampled.push_back(p);continue; }
    const Point2 c{numeric(it->at("cx"),"cx"),numeric(it->at("cy"),"cy")};
    for (int step=0;step<12;++step) {
      const double t=static_cast<double>(step)/12.,u=1.-t;
      sampled.push_back({u*u*p.x+2*u*t*c.x+t*t*q.x,
                         u*u*p.y+2*u*t*c.y+t*t*q.y});
    }
  }
  double twice=0;
  for (std::size_t i=0;i<sampled.size();++i) {
    const auto& a=sampled[i],&b=sampled[(i+1)%sampled.size()];
    twice+=a.x*b.y-b.x*a.y;
  }
  return std::abs(twice)/2.;
}

std::string costEstimates(const Document& doc,const std::string& currency) {
  std::string result;
  const Json report=buildFabricCostRun(doc);
  for (const auto& row:report.at("rows")) {
    result+=element("EstimatedFabricCost",{
      {"size",textValue(row.at("size"))},{"fabricId",textValue(row.at("fabricId"))},
      {"lengthMeters",fixed(row.at("lengthMeters").get<double>(),4)},
      {"pricePerMeter",row.at("pricePerMeter").is_null()?"":fixed(row.at("pricePerMeter").get<double>(),2)},
      {"currency",currency},
      {"amount",row.at("extendedCost").is_null()?"":fixed(row.at("extendedCost").get<double>(),2)},
      {"status",textValue(row.at("status"))}});
  }
  return result;
}
} // namespace

std::string exportBomXml(const Document& doc) {
  const Json& project=doc.data();
  const auto fabrics=project.value("fabrics",Json::object());
  const auto production=project.value("productionSpec",Json::object());
  const auto grading=project.value("grading",Json::object());
  const std::string currency=valueOr(production,"currency","USD");
  std::string fabricNodes;
  if (fabrics.is_object()) for (auto it=fabrics.begin();it!=fabrics.end();++it) {
    const std::string id=it.key();
    const Json& fabric=it.value();
    int cuts=0;
    double area=0;
    std::string patterns;
    for (const auto& piece:project.at("pieces")) {
      if (valueOr(piece,"fabricId","main")!=id) continue;
      const int qty=quantity(piece);
      cuts+=qty;
      area+=stitchArea(piece)*qty;
      patterns+=element("Pattern",{
        {"id",valueOr(piece,"id")},{"name",valueOr(piece,"name",valueOr(piece,"id"))},
        {"cutQuantity",std::to_string(qty)},
        {"seamAllowanceCm",fixed(fieldNumber(piece,"seamAllowance"),2)}});
    }
    fabricNodes+=element("Fabric",{
      {"id",id},{"name",valueOr(fabric,"name",id)},{"color",valueOr(fabric,"color")},
      {"gsm",valueOr(fabric,"gsm")},
      {"thicknessMm",fixed(fieldNumber(fabric,"thickness")*1000.,2)},
      {"cutQuantityPerGarment",std::to_string(cuts)},{"patternAreaCm2",fixed(area,2)},
      {"pricePerMeter",fabric.contains("pricePerMeter") && !fabric["pricePerMeter"].is_null()
          ? fixed(asNumber(fabric["pricePerMeter"]),2):""},
      {"priceCurrency",currency},
      {"stretchWarpPct",fixed(fieldNumber(fabric,"stretchWarp")*100.,2)},
      {"stretchWeftPct",fixed(fieldNumber(fabric,"stretchWeft")*100.,2)},
      {"shrinkWarpPct",fixed(fieldNumber(fabric,"shrinkWarp")*100.,2)},
      {"shrinkWeftPct",fixed(fieldNumber(fabric,"shrinkWeft")*100.,2)}
    },patterns);
  }
  std::string trims;
  if (project.contains("fasteners") && project["fasteners"].is_array())
    for (const auto& item:project["fasteners"])
      trims+=element("Trim",{{"type",valueOr(item,"type","fastener")},
                            {"id",valueOr(item,"id")},{"quantityPerGarment","1"},
                            {"specification",valueOr(item,"name")}});
  for (const auto& piece:project.at("pieces")) {
    for (const char* kind:{"zippers","buttons","buttonholes","bindings","topstitches"}) {
      if (!piece.contains(kind) || !piece[kind].is_array()) continue;
      for (const auto& item:piece[kind]) {
        trims+=element("Trim",{
          {"type",kind},{"id",valueOr(item,"id")},{"patternId",valueOr(piece,"id")},
          {"quantityPerGarment",std::to_string(quantity(piece))},
          {"description",valueOr(item,"name",valueOr(item,"type"))},
          {"lengthCm",item.contains("lengthCm") && !item["lengthCm"].is_null()?textValue(item["lengthCm"]):""}});
      }
    }
  }
  const std::string costs=element("FabricCostEstimates",
      {{"currency",currency},{"basis","per garment, excludes trims and labor"}},
      costEstimates(doc,currency));
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    element("GarmentStudioBOM",{{"schemaVersion","1.0"},
      {"projectId",valueOr(project,"id")},{"projectName",valueOr(project,"name")},
      {"revision",valueOr(project,"revision","1")},{"baseSize",valueOr(grading,"baseSize","M")},
      {"patternUnits","cm"},{"usageBasis","one finished garment"}},
      element("Fabrics",{},fabricNodes)+element("TrimsAndConstruction",{},trims)+costs)+"\n";
}
} // namespace garment
