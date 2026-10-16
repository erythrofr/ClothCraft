#include "clothcraft_export.hpp"

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {

constexpr double kCmToM = 0.01;

double number(const Json& value, const char* what) {
  if (!value.is_number()) throw std::invalid_argument(std::string(what) + " must be numeric");
  double n = value.get<double>();
  if (!std::isfinite(n)) throw std::invalid_argument(std::string(what) + " must be finite");
  return n;
}

double field(const Json& object, const char* key, double fallback = 0) {
  if (!object.is_object() || !object.contains(key) || object.at(key).is_null()) return fallback;
  return number(object.at(key), key);
}

std::string id(const Json& object, const char* key) {
  if (!object.is_object() || !object.contains(key) || !object.at(key).is_string())
    throw std::invalid_argument(std::string("missing ") + key);
  const auto value = object.at(key).get<std::string>();
  if (value.empty() || value.size() > 80 ||
      !std::all_of(value.begin(), value.end(), [](unsigned char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') ||
               (c >= 'A' && c <= 'Z') || c == '_' || c == '-';
      })) throw std::invalid_argument(std::string(key) + " is not a ClothCraft-compatible ID: " + value);
  return value;
}

std::string edgeName(std::size_t i) { return "edge_" + std::to_string(i); }

Json pt(const Json& p, double minX, double minY) {
  return Json::array({(field(p, "x") - minX) * kCmToM,
                      (field(p, "y") - minY) * kCmToM});
}

double orientedArea(const Json& points) {
  double sum = 0;
  for (std::size_t i = 0; i < points.size(); ++i) {
    const auto& a = points[i];
    const auto& b = points[(i + 1) % points.size()];
    sum += field(a, "x") * field(b, "y") - field(b, "x") * field(a, "y");
  }
  return sum * 0.5;
}

struct PieceInfo { double width = 0; std::size_t edges = 0; };

Json fabricProperties(const Json& source) {
  // Textile stiffness/anisotropy cannot be inferred reliably from GS stretch
  // sliders. Use ClothCraft's documented reference coefficients instead.
  const double gsm = field(source, "gsm", 200);
  const double thickness = field(source, "thickness", 0.001);
  if (gsm <= 0 || thickness <= 0) throw std::invalid_argument("fabric mass/thickness must be positive");
  return { {"warp", 350.0}, {"weft", 180.0}, {"shear", 45.0},
           {"compression_ratio", 0.15}, {"compression_transition", 0.005},
           {"bend_warp", 0.00008}, {"bend_weft", 0.00004},
           {"density", gsm / 1000.0}, {"thickness", thickness} };
}

std::array<double, 2> range(const Json& end) {
  double start = field(end, "startT", 0), finish = field(end, "endT", 1);
  if (start < 0 || start > 1 || finish < 0 || finish > 1 ||
      std::abs(start - finish) < 1e-9)
    throw std::invalid_argument("invalid/zero-length sewn edge range");
  return {std::min(start, finish), std::max(start, finish)};
}

Json boundary(const Json& endpoint, const std::map<std::string, PieceInfo>& pieces) {
  std::string panel = id(endpoint, "pieceId");
  auto found = pieces.find(panel);
  if (found == pieces.end()) throw std::invalid_argument("missing seam pattern: " + panel);
  auto rawIndex = field(endpoint, "edgeIndex", -1);
  if (rawIndex < 0 || rawIndex != std::floor(rawIndex) || rawIndex >= found->second.edges)
    throw std::invalid_argument("invalid seam edge index on " + panel);
  auto span = range(endpoint);
  return { {"panel", panel}, {"side", "top"}, {"edge", edgeName(static_cast<std::size_t>(rawIndex))},
           {"range", Json::array({span[0], span[1]})} };
}

bool hasData(const Json& p, const char* key) {
  if (!p.contains(key) || p.at(key).is_null()) return false;
  const auto& value = p.at(key);
  if (value.is_array() || value.is_object() || value.is_string()) return !value.empty();
  return value.is_number() && number(value, key) != 0;
}

} // namespace

Json exportClothCraftTemplate(const Document& document) {
  const auto& source = document.data();
  const auto validation = document.validate();
  if (!validation.ok()) throw std::invalid_argument("source document is invalid: " + validation.errors.front());
  if (source.value("units", "cm") != "cm")
    throw std::invalid_argument("ClothCraft adapter requires source units=cm");
  const auto& originals = source.at("pieces");
  if (originals.empty() || originals.size() > 128)
    throw std::invalid_argument("ClothCraft supports 1..128 panels");

  std::set<std::string> notices;
  auto note = [&](const std::string& value) { notices.insert(value); };
  note("PREVIEW ONLY: flat separated 3D arrangement; not an avatar fit or simulation-ready assembly");
  note("Uncalibrated material stiffness: ClothCraft reference coefficients used; density/thickness transferred");
  note("Source project remains authoritative; ClothCraft cannot round-trip all production metadata");

  Json out = {{"format", "marvelous-cloth-template"}, {"version", 2},
              {"name", source.value("name", "Garment Studio interchange")},
              {"fabrics", Json::array()}, {"panels", Json::array()}, {"seams", Json::array()}};

  Json fabrics = source.value("fabrics", Json::object());
  if (!fabrics.is_object() || fabrics.empty()) throw std::invalid_argument("no source fabrics to export");
  for (auto it = fabrics.begin(); it != fabrics.end(); ++it) {
    if (!it.value().is_object()) throw std::invalid_argument("fabric must be an object");
    if (it.key().size() > 80 || it.key().empty() ||
        !std::all_of(it.key().begin(), it.key().end(), [](unsigned char c) {
          return std::isalnum(c) || c == '-' || c == '_';
        })) throw std::invalid_argument("invalid ClothCraft fabric id: " + it.key());
    out["fabrics"].push_back({{"id", it.key()},
                              {"name", it.value().value("name", it.key())},
                              {"properties", fabricProperties(it.value())}});
  }

  std::map<std::string, PieceInfo> pieces;
  double cursor = 0;
  for (const auto& p : originals) {
    std::string panelId = id(p, "id");
    const auto& points = p.at("points");
    if (points.size() < 3 || points.size() > 4096)
      throw std::invalid_argument("polygon must have 3..4096 points: " + panelId);
    if (orientedArea(points) < 1e-6)
      throw std::invalid_argument("polygon must have positive (u,v) signed area; reversing would change sewing identities: " + panelId);
    double minX = 1e100, minY = 1e100, maxX = -1e100, maxY = -1e100;
    for (const auto& v : points) {
      const double x = field(v, "x"), y = field(v, "y");
      minX = std::min(minX, x); maxX = std::max(maxX, x);
      minY = std::min(minY, y); maxY = std::max(maxY, y);
    }
    const double width = (maxX - minX) * kCmToM;
    const double height = (maxY - minY) * kCmToM;
    if (width < 0.01 || height < 0.01 || width > 100 || height > 100)
      throw std::invalid_argument("polygon outside ClothCraft dimension bounds: " + panelId);
    Json polygon = {{"points", Json::array()}, {"edges", Json::array()}, {"subdivisions", 2},
                    {"meshing", {{"target_edge_m", 0.03}, {"anisotropy", 1.0},
                                  {"axis_degrees", 0.0}, {"min_angle_degrees", 25.0},
                                  {"max_vertices", 20000}}}};
    for (std::size_t i = 0; i < points.size(); ++i) {
      polygon["points"].push_back(pt(points[i], minX, minY));
      polygon["edges"].push_back(edgeName(i));
    }
    if (p.contains("curves") && p.at("curves").is_object()) {
      Json cubic = Json::object();
      for (auto it = p.at("curves").begin(); it != p.at("curves").end(); ++it) {
        if (it.value().is_null()) continue;
        const auto index = std::stoul(it.key());
        if (index >= points.size()) throw std::invalid_argument("bad curve index");
        const auto& a = points[index];
        const auto& b = points[(index + 1) % points.size()];
        double ax = field(a,"x"), ay = field(a,"y"), bx = field(b,"x"), by = field(b,"y");
        double cx = field(it.value(),"cx"), cy = field(it.value(),"cy");
        auto metric = [&](double x,double y) { return Json::array({(x-minX)*kCmToM,(y-minY)*kCmToM}); };
        cubic[edgeName(index)] = Json::array({metric((ax+2*cx)/3,(ay+2*cy)/3),
                                             metric((bx+2*cx)/3,(by+2*cy)/3)});
      }
      if (!cubic.empty()) polygon["curves"] = cubic;
    }
    auto fabricId = p.value("fabricId", fabrics.begin().key());
    if (!fabrics.contains(fabricId)) throw std::invalid_argument("missing referenced fabric: " + fabricId);
    Json panel = {{"id", panelId}, {"name", p.value("name", panelId)},
                  {"pattern", {{"width", width}, {"height", height}, {"nx", 1}, {"ny", 1}}},
                  {"polygon", polygon}, {"fabric", fabricId},
                  {"grain_degrees", field(p,"grainAngleDeg",0)},
                  {"placement", {{"translation", Json::array({cursor,1.5,0.5})},
                                 {"rotation_degrees", Json::array({0.0,0.0,0.0})}}},
                  {"pins", Json::array()}};
    if (p.contains("layout2d") && p["layout2d"].is_object())
      panel["layout_2d"] = Json::array({(field(p["layout2d"],"x")+minX)*kCmToM,
                                        (field(p["layout2d"],"y")+minY)*kCmToM});
    out["panels"].push_back(panel);
    pieces.emplace(panelId, PieceInfo{width, points.size()});
    cursor += width + 0.1;
    for (const char* key : {"notches","topstitches","bindings","graphics","zippers","buttons",
                            "edgeSeamAllowances","darts","internalLines","folds","holes"}) {
      if (hasData(p,key)) note(std::string("Not represented in ClothCraft v2: ")+key);
    }
    if (field(p,"seamAllowance",0) != 0) note("Not represented in ClothCraft v2: seam allowances");
  }
  if (source.contains("seams")) {
    if (source["seams"].size() > 512) throw std::invalid_argument("ClothCraft supports at most 512 seams");
    for (const auto& s : source.at("seams")) {
      auto a = boundary(s.at("a"), pieces), b = boundary(s.at("b"), pieces);
      auto measured = document.seamInfo(id(s, "id"));
      bool mismatch = measured.at("differenceCm").get<double>() > 1e-8;
      Json seam = {{"id", id(s,"id")}, {"a", a}, {"b", b},
                   {"reverse_b", s.value("reverseB",false)},
                   {"notches", Json::array()}, {"stiffness", 5000.0}, {"allow_ease", mismatch}};
      out["seams"].push_back(seam);
      if (mismatch) note("Unequal sewn-edge lengths: allow_ease set, but ClothCraft has no physical gathering model");
      if (hasData(s,"notches") || hasData(s,"ease") || hasData(s,"gather"))
        note("Not represented in ClothCraft v2: custom seam notch/ease/gather distributions");
    }
  }
  if (hasData(source,"grading") || hasData(source,"sizeGrading") || hasData(source,"sizes"))
    note("Not represented in ClothCraft v2: graded sizes");
  if (hasData(source,"fasteners")) note("Not represented in ClothCraft v2: fasteners");
  if (hasData(source,"avatar")) note("Not represented in ClothCraft template: avatar geometry/measurements");
  Json warnings = Json::array();
  for (auto& notice : notices) warnings.push_back(notice);
  return {{"template", out}, {"warnings", warnings},
          {"sourcePreserved", true}, {"verifiedByRust", false},
          {"fitAccepted", false}, {"mode", "read-only-preview-interchange"}};
}
} // namespace garment
