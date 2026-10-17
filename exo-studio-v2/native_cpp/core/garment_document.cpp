#include "garment_document.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <set>
#include <sstream>
#include <utility>

namespace garment {
namespace {

constexpr double kMaxCm = 100000.0;
constexpr double kMinNeighborCm = 0.001;

double finite(const Json& value, const char* field) {
  if (!value.is_number()) throw std::invalid_argument(std::string(field) + " must be numeric");
  const auto number = value.get<double>();
  if (!std::isfinite(number) || std::abs(number) > kMaxCm)
    throw std::invalid_argument(std::string(field) + " must be a finite drafting measurement in cm");
  return number;
}

double coordinate(const Json& obj, const char* field) {
  if (!obj.is_object() || !obj.contains(field))
    throw std::invalid_argument(std::string("missing ") + field);
  return finite(obj.at(field), field);
}

std::size_t positiveIndex(const Json& args, const char* key) {
  if (!args.contains(key) || !args.at(key).is_number_integer())
    throw std::invalid_argument(std::string(key) + " must be an integer");
  const auto value = args.at(key).get<std::int64_t>();
  if (value < 0 || value > 1000000)
    throw std::invalid_argument(std::string(key) + " must be nonnegative");
  return static_cast<std::size_t>(value);
}

std::string nonempty(const Json& obj, const char* field) {
  if (!obj.is_object() || !obj.contains(field) || !obj.at(field).is_string())
    throw std::invalid_argument(std::string(field) + " must be a string");
  auto value = obj.at(field).get<std::string>();
  if (value.empty() || value.size() > 512)
    throw std::invalid_argument(std::string(field) + " must be a nonempty bounded string");
  return value;
}

double distance(Point2 a, Point2 b) {
  return std::hypot(a.x - b.x, a.y - b.y);
}

Point2 requiredPoint(const Json& obj) { return {coordinate(obj, "x"), coordinate(obj, "y")}; }

double clampUnit(double value) { return std::max(0.0, std::min(1.0, value)); }

double curveLength(Point2 a, Point2 c, Point2 b) {
  // Deterministic adaptive integration of the quadratic Bézier derivative.
  // Using only the chord is wrong for armholes and neckline stitching.
  auto speed = [=](double t) {
    return std::hypot((1 - t) * (c.x - a.x) + t * (b.x - c.x),
                      (1 - t) * (c.y - a.y) + t * (b.y - c.y)) * 2;
  };
  auto simpson = [&](double left, double right, double fl, double fm, double fr) {
    return (right - left) * (fl + 4 * fm + fr) / 6;
  };
  const auto recur = [&](const auto& self, double left, double right, double fl,
                         double fm, double fr, double whole, double eps, int depth) -> double {
    double middle = (left + right) * .5;
    double ll = (left + middle) * .5, rr = (middle + right) * .5;
    double fll = speed(ll), frr = speed(rr);
    double lhs = simpson(left, middle, fl, fll, fm);
    double rhs = simpson(middle, right, fm, frr, fr);
    if (depth == 0 || std::abs(lhs + rhs - whole) <= 15 * eps)
      return lhs + rhs + (lhs + rhs - whole) / 15;
    return self(self, left, middle, fl, fll, fm, lhs, eps / 2, depth - 1) +
           self(self, middle, right, fm, frr, fr, rhs, eps / 2, depth - 1);
  };
  double fl = speed(0), fm = speed(.5), fr = speed(1);
  return recur(recur, 0, 1, fl, fm, fr, simpson(0, 1, fl, fm, fr), 1e-8, 18);
}

const Json* curveFor(const Json& piece, std::size_t index) {
  if (!piece.contains("curves") || !piece.at("curves").is_object()) return nullptr;
  const auto& curves = piece.at("curves");
  auto it = curves.find(std::to_string(index));
  return it == curves.end() || it->is_null() ? nullptr : &it.value();
}

const Json* byId(const Json& collection, const std::string& id) {
  if (!collection.is_array()) return nullptr;
  for (const auto& element : collection)
    if (element.is_object() && element.value("id", Json()).is_string() && element.at("id") == id)
      return &element;
  return nullptr;
}

Json* byId(Json& collection, const std::string& id) {
  if (!collection.is_array()) return nullptr;
  for (auto& element : collection)
    if (element.is_object() && element.value("id", Json()).is_string() && element.at("id") == id)
      return &element;
  return nullptr;
}

}  // namespace

Json Validation::toJson() const { return {{"ok", ok()}, {"errors", errors}}; }

Document::Document(Json initial) : data_(std::move(initial)) {
  auto results = validate();
  if (!results.ok()) throw std::invalid_argument("invalid garment document: " + results.errors.front());
}

Point2 Document::point(const Json& obj) { return requiredPoint(obj); }

const Json& Document::piece(const std::string& id) const {
  const auto* found = byId(data_.at("pieces"), id);
  if (!found) throw std::invalid_argument("unknown pattern piece: " + id);
  return *found;
}

double Document::edgeLength(const Json& pattern, std::size_t index) {
  const auto& points = pattern.at("points");
  if (index >= points.size()) throw std::invalid_argument("edgeIndex is out of bounds");
  auto a = point(points[index]), b = point(points[(index + 1) % points.size()]);
  if (const auto* curve = curveFor(pattern, index))
    return curveLength(a, {coordinate(*curve, "cx"), coordinate(*curve, "cy")}, b);
  return distance(a, b);
}

double Document::seamSpan(const Json& pattern, const Json& endpoint) {
  const auto index = positiveIndex(endpoint, "edgeIndex");
  auto start = endpoint.contains("startT") && !endpoint.at("startT").is_null()
                   ? finite(endpoint.at("startT"), "startT") : 0;
  auto end = endpoint.contains("endT") && !endpoint.at("endT").is_null()
                   ? finite(endpoint.at("endT"), "endT") : 1;
  return edgeLength(pattern, index) * std::abs(clampUnit(end) - clampUnit(start));
}

Validation Document::validate() const {
  Validation results;
  auto& errors = results.errors;
  if (!data_.is_object()) { errors.emplace_back("root must be an object"); return results; }
  if (!data_.contains("pieces") || !data_.at("pieces").is_array()) {
    errors.emplace_back("pieces must be an array"); return results;
  }
  if (data_.contains("seams") && !data_.at("seams").is_array())
    errors.emplace_back("seams must be an array");
  std::set<std::string> ids;
  for (const auto& element : data_.at("pieces")) {
    try {
      auto id = nonempty(element, "id");
      if (!ids.insert(id).second) errors.push_back("duplicate piece ID: " + id);
      if (!element.contains("points") || !element.at("points").is_array() || element.at("points").size() < 3) {
        errors.push_back(id + " must contain at least three drafting points"); continue;
      }
      const auto& points = element.at("points");
      if (points.size() > 100000) throw std::invalid_argument("too many drafting points");
      std::vector<Point2> vertices;
      for (const auto& entry : points) vertices.push_back(point(entry));
      for (std::size_t i = 0; i < vertices.size(); ++i)
        if (distance(vertices[i], vertices[(i + 1) % vertices.size()]) < kMinNeighborCm)
          errors.push_back(id + " has adjacent points closer than 0.001 cm at " + std::to_string(i));
      if (element.contains("curves") && !element.at("curves").is_null()) {
        if (!element.at("curves").is_object()) throw std::invalid_argument("curves must be an object");
        for (auto it = element.at("curves").begin(); it != element.at("curves").end(); ++it) {
          if (it.value().is_null()) continue;
          std::size_t consumed = 0, index = 0;
          try { index = std::stoul(it.key(), &consumed); }
          catch (...) { throw std::invalid_argument("curves have nonnumeric edge index " + it.key()); }
          if (consumed != it.key().size() || index >= vertices.size())
            throw std::invalid_argument("curve edge index outside pattern");
          coordinate(it.value(), "cx"); coordinate(it.value(), "cy");
        }
      }
      if (element.contains("edgeSeamAllowances") && !element.at("edgeSeamAllowances").is_null()) {
        if (!element.at("edgeSeamAllowances").is_object()) throw std::invalid_argument("allowances must be an object");
        for (auto it = element.at("edgeSeamAllowances").begin(); it != element.at("edgeSeamAllowances").end(); ++it) {
          std::size_t consumed = 0, index = 0;
          try { index = std::stoul(it.key(), &consumed); }
          catch (...) { throw std::invalid_argument("allowance index not numeric"); }
          if (consumed != it.key().size() || index >= vertices.size() || finite(it.value(), "allowance") < 0)
            throw std::invalid_argument("allowance index/value invalid");
        }
      }
      if (element.contains("seamAllowance") && !element.at("seamAllowance").is_null() &&
          finite(element.at("seamAllowance"), "seamAllowance") < 0)
        throw std::invalid_argument("seam allowance must not be negative");
    } catch (const std::exception& ex) { errors.push_back(std::string("invalid piece: ") + ex.what()); }
  }
  if (data_.contains("seams") && data_.at("seams").is_array()) {
    std::set<std::string> seams;
    for (const auto& s : data_.at("seams")) {
      try {
        auto id = nonempty(s, "id");
        if (!seams.insert(id).second) errors.push_back("duplicate seam ID: " + id);
        for (const auto* end : {"a", "b"}) {
          if (!s.contains(end) || !s.at(end).is_object()) throw std::invalid_argument("seam endpoint missing");
          auto& endpoint = s.at(end);
          auto pieceId = nonempty(endpoint, "pieceId");
          auto* found = byId(data_.at("pieces"), pieceId);
          if (!found) throw std::invalid_argument("seam references unknown pattern: " + pieceId);
          auto index = positiveIndex(endpoint, "edgeIndex");
          if (!found->contains("points") || !found->at("points").is_array() ||
              index >= found->at("points").size())
            throw std::invalid_argument("seam references nonexistent edge");
          for (const char* key : {"startT", "endT"})
            if (endpoint.contains(key) && !endpoint.at(key).is_null())
              if (finite(endpoint.at(key), key) < 0 || finite(endpoint.at(key), key) > 1)
                throw std::invalid_argument("seam interval must stay within 0..1");
        }
      } catch (const std::exception& ex) { errors.push_back(std::string("invalid seam: ") + ex.what()); }
    }
  }
  return results;
}

Json Document::edgeInfo(const std::string& id, std::size_t index) const {
  auto& pattern = piece(id);
  double length = edgeLength(pattern, index);
  double allowance = pattern.value("seamAllowance", 0.0);
  if (pattern.contains("edgeSeamAllowances") && pattern.at("edgeSeamAllowances").is_object()) {
    auto key = std::to_string(index);
    if (pattern.at("edgeSeamAllowances").contains(key))
      allowance = pattern.at("edgeSeamAllowances").at(key).get<double>();
  }
  return {{"pieceId", id}, {"edgeIndex", index}, {"lengthCm", length},
          {"seamAllowanceCm", allowance}, {"isCurve", curveFor(pattern, index) != nullptr}};
}

Json Document::seamInfo(const std::string& id) const {
  if (!data_.contains("seams")) throw std::invalid_argument("no seams in garment");
  auto* s = byId(data_.at("seams"), id);
  if (!s) throw std::invalid_argument("unknown seam: " + id);
  double a = seamSpan(piece(nonempty(s->at("a"), "pieceId")), s->at("a"));
  double b = seamSpan(piece(nonempty(s->at("b"), "pieceId")), s->at("b"));
  double avg = (a + b) * .5;
  double mismatch = avg > 0 ? 100 * std::abs(a - b) / avg : 0;
  return {{"seamId", id}, {"lengthACm", a}, {"lengthBCm", b},
          {"differenceCm", std::abs(a - b)}, {"mismatchPercent", mismatch},
          {"status", mismatch <= 2 ? "good" : mismatch <= 6 ? "warning" : "error"}};
}

Json Document::summary() const {
  Json out = {{"pieceCount", data_.at("pieces").size()},
              {"seamCount", data_.contains("seams") && data_.at("seams").is_array() ? data_.at("seams").size() : 0},
              {"revision", data_.value("revision", 0)}, {"units", data_.value("units", "cm")}};
  Json patterns = Json::array();
  for (const auto& piece : data_.at("pieces")) {
    double perimeter = 0;
    for (std::size_t edge = 0; edge < piece.at("points").size(); ++edge) perimeter += edgeLength(piece, edge);
    patterns.push_back({{"id", piece.at("id")}, {"name", piece.value("name", piece.at("id").get<std::string>())},
                        {"pointCount", piece.at("points").size()}, {"perimeterCm", perimeter}});
  }
  out["patterns"] = patterns;
  return out;
}

Transaction Document::apply(const std::string& operation, const Json& args, int expectedRevision) {
  if (!args.is_object()) throw std::invalid_argument("CAD command arguments must be an object");
  int revision = data_.value("revision", 0);
  if (expectedRevision >= 0 && revision != expectedRevision)
    throw std::invalid_argument("stale edit: expected revision " + std::to_string(expectedRevision) +
                                ", actual " + std::to_string(revision));
  auto before = data_;
  auto next = before; // copy-on-write: invalid changes cannot affect live document
  auto getPiece = [&]() -> Json& {
    auto* result = byId(next["pieces"], nonempty(args, "pieceId"));
    if (!result) throw std::invalid_argument("no such pattern piece");
    return *result;
  };
  if (operation == "move-point") {
    auto& target = getPiece();
    if (target.value("locked", false)) throw std::invalid_argument("pattern is locked");
    auto index = positiveIndex(args, "pointIndex");
    if (index >= target.at("points").size()) throw std::invalid_argument("pointIndex is out of bounds");
    auto newPoint = Point2{coordinate(args, "x"), coordinate(args, "y")};
    auto& points = target["points"];
    auto prev = point(points[(index + points.size() - 1) % points.size()]);
    auto after = point(points[(index + 1) % points.size()]);
    if (distance(newPoint, prev) < kMinNeighborCm || distance(newPoint, after) < kMinNeighborCm)
      throw std::invalid_argument("adjacent pattern points must remain >=0.001 cm apart");
    points[index]["x"] = newPoint.x;
    points[index]["y"] = newPoint.y;
  } else if (operation == "set-curve") {
    auto& target = getPiece();
    if (target.value("locked", false)) throw std::invalid_argument("pattern is locked");
    auto index = positiveIndex(args, "edgeIndex");
    if (index >= target.at("points").size()) throw std::invalid_argument("invalid curve edge");
    if (!target.contains("curves") || target["curves"].is_null()) target["curves"] = Json::object();
    auto key = std::to_string(index);
    // Preserve grading / construction metadata on an existing Bézier handle.
    if (!target["curves"].contains(key) || !target["curves"][key].is_object())
      target["curves"][key] = Json::object();
    target["curves"][key]["cx"] = coordinate(args, "cx");
    target["curves"][key]["cy"] = coordinate(args, "cy");
  } else if (operation == "remove-curve") {
    auto& target = getPiece();
    if (target.value("locked", false)) throw std::invalid_argument("pattern is locked");
    auto index = positiveIndex(args, "edgeIndex");
    if (index >= target.at("points").size()) throw std::invalid_argument("invalid curve edge");
    if (target.contains("curves") && target["curves"].is_object())
      target["curves"].erase(std::to_string(index));
  } else if (operation == "set-edge-allowance") {
    auto& target = getPiece();
    if (target.value("locked", false)) throw std::invalid_argument("pattern is locked");
    auto index = positiveIndex(args, "edgeIndex");
    if (index >= target.at("points").size()) throw std::invalid_argument("invalid seam allowance edge");
    auto value = coordinate(args, "allowanceCm");
    if (value < 0) throw std::invalid_argument("negative seam allowance");
    if (!target.contains("edgeSeamAllowances") || target["edgeSeamAllowances"].is_null())
      target["edgeSeamAllowances"] = Json::object();
    target["edgeSeamAllowances"][std::to_string(index)] = value;
  } else if (operation == "set-layout") {
    auto& target = getPiece();
    if (!target.contains("layout2d") || !target["layout2d"].is_object()) target["layout2d"] = Json::object();
    target["layout2d"]["x"] = coordinate(args, "x");
    target["layout2d"]["y"] = coordinate(args, "y");
  } else if (operation == "rename-piece") {
    getPiece()["name"] = nonempty(args, "name");
  } else if (operation == "split-edge") {
    auto id = nonempty(args, "pieceId");
    auto& target = getPiece();
    if (target.value("locked", false)) throw std::invalid_argument("pattern is locked");
    auto edge = positiveIndex(args, "edgeIndex");
    auto& points = target.at("points");
    if (edge >= points.size()) throw std::invalid_argument("cannot split nonexistent edge");
    if (!args.contains("fraction") || !args.at("fraction").is_number())
      throw std::invalid_argument("split-edge requires a numeric fraction");
    double t = finite(args.at("fraction"), "fraction");
    if (t < .01 || t > .99) throw std::invalid_argument("split fraction must be between 0.01 and 0.99");
    // A single sewn edge cannot safely be replaced with two without also
    // reparameterizing BOTH sides of its stitch graph. Decline rather than
    // break sewing IDs or silently move notches / production instructions.
    if (next.contains("seams") && next["seams"].is_array())
      for (const auto& seam : next["seams"])
        for (auto key : {"a", "b"})
          if (seam.contains(key) && seam[key].value("pieceId", "") == id &&
              static_cast<std::size_t>(seam[key].value("edgeIndex", -1)) == edge)
            throw std::invalid_argument("split-edge would break a sewing relationship; split both paired seam edges in a dedicated transaction");
    for (auto name : {"notches", "topstitches", "bindings", "internalLines", "zippers",
                      "buttons", "buttonholes", "pins", "graphics"})
      if (target.contains(name) && target[name].is_array() && !target[name].empty())
        throw std::invalid_argument(std::string("split-edge requires explicit reconciliation of ") + name);
    auto start = point(points[edge]), end = point(points[(edge + 1) % points.size()]);
    Point2 midway{start.x + (end.x - start.x)*t, start.y + (end.y - start.y)*t};
    Json oldCurves = target.value("curves", Json::object());
    Json oldAllowance = target.value("edgeSeamAllowances", Json::object());
    if (!oldCurves.is_object() || !oldAllowance.is_object())
      throw std::invalid_argument("malformed per-edge properties");
    const auto oldCurve = curveFor(target, edge);
    Json leftCurve, rightCurve;
    if (oldCurve) {
      Point2 handle{coordinate(*oldCurve, "cx"), coordinate(*oldCurve, "cy")};
      Point2 p01{start.x + t*(handle.x-start.x), start.y + t*(handle.y-start.y)};
      Point2 p12{handle.x + t*(end.x-handle.x), handle.y + t*(end.y-handle.y)};
      midway = {p01.x + t*(p12.x-p01.x), p01.y + t*(p12.y-p01.y)};
      leftCurve=*oldCurve; rightCurve=*oldCurve;
      leftCurve["cx"]=p01.x; leftCurve["cy"]=p01.y;
      rightCurve["cx"]=p12.x; rightCurve["cy"]=p12.y;
    }
    Json inserted={{"x",midway.x},{"y",midway.y}};
    if (args.contains("pointId")) {
      auto pointId=nonempty(args,"pointId");
      for (const auto& p:points)
        if (p.value("id", "")==pointId) throw std::invalid_argument("point ID already exists");
      inserted["id"]=pointId;
    }
    points.insert(points.begin() + static_cast<Json::difference_type>(edge + 1), inserted);
    Json replacedCurves=Json::object(), replacedAllowances=Json::object();
    for (auto it=oldCurves.begin();it!=oldCurves.end();++it) {
      const auto index=static_cast<std::size_t>(std::stoul(it.key()));
      if (index == edge) continue;
      replacedCurves[std::to_string(index>edge?index+1:index)]=it.value();
    }
    if (oldCurve) {
      replacedCurves[std::to_string(edge)]=leftCurve;
      replacedCurves[std::to_string(edge+1)]=rightCurve;
    }
    for (auto it=oldAllowance.begin();it!=oldAllowance.end();++it) {
      const auto index=static_cast<std::size_t>(std::stoul(it.key()));
      const auto key=std::to_string(index>edge?index+1:index);
      replacedAllowances[key]=it.value();
      if (index==edge) replacedAllowances[std::to_string(edge+1)]=it.value();
    }
    target["curves"]=replacedCurves;
    target["edgeSeamAllowances"]=replacedAllowances;
    if (next.contains("seams") && next["seams"].is_array())
      for (auto& seam:next["seams"])
        for (auto key:{"a","b"})
          if (seam.contains(key) && seam[key].value("pieceId", "")==id &&
              seam[key].at("edgeIndex").get<std::size_t>() > edge)
            seam[key]["edgeIndex"] = seam[key].at("edgeIndex").get<std::size_t>() + 1;
  } else if (operation == "add-piece") {
    if (!args.contains("piece") || !args.at("piece").is_object())
      throw std::invalid_argument("add-piece needs a pattern object");
    auto id = nonempty(args.at("piece"), "id");
    if (byId(next.at("pieces"), id)) throw std::invalid_argument("pattern ID is already used");
    next["pieces"].push_back(args.at("piece"));
  } else if (operation == "remove-piece") {
    auto id = nonempty(args, "pieceId");
    if (next.contains("seams") && next["seams"].is_array())
      for (const auto& s : next["seams"])
        for (auto key : {"a", "b"})
          if (s.contains(key) && s.at(key).value("pieceId", "") == id)
            throw std::invalid_argument("cannot delete a piece with sewing references");
    auto& pieces = next["pieces"];
    auto found = std::find_if(pieces.begin(), pieces.end(), [&](const Json& p) { return p.value("id", "") == id; });
    if (found == pieces.end()) throw std::invalid_argument("piece not found");
    pieces.erase(found);
  } else if (operation == "add-seam") {
    if (!args.contains("seam") || !args.at("seam").is_object())
      throw std::invalid_argument("add-seam needs a seam object");
    if (!next.contains("seams")) next["seams"] = Json::array();
    auto id = nonempty(args.at("seam"), "id");
    if (byId(next["seams"], id)) throw std::invalid_argument("seam ID is already used");
    next["seams"].push_back(args.at("seam"));
  } else if (operation == "remove-seam") {
    auto id = nonempty(args, "seamId");
    if (!next.contains("seams") || !next["seams"].is_array()) throw std::invalid_argument("no seams in garment");
    auto& seams = next["seams"];
    auto found = std::find_if(seams.begin(), seams.end(), [&](const Json& s) { return s.value("id", "") == id; });
    if (found == seams.end()) throw std::invalid_argument("seam not found");
    seams.erase(found);
  } else {
    throw std::invalid_argument("unknown CAD operation: " + operation);
  }
  Transaction change;
  change.beforeRevision = revision;
  change.afterRevision = revision;
  if (next == before) return change;  // no revision churn on redundant input
  next["revision"] = revision + 1;
  if (args.contains("updatedAt") && args.at("updatedAt").is_string())
    next["updatedAt"] = args.at("updatedAt");
  Document probe(std::move(next)); // atomic all-or-nothing validation
  change.changed = true;
  change.afterRevision = revision + 1;
  change.inverseSnapshot = std::move(before);
  data_ = probe.data_;
  return change;
}

void Document::restore(const Json& snapshot) {
  Document valid(snapshot);
  data_ = valid.data_;
}

}  // namespace garment
