#include "dxf_export.hpp"
#include "cutting_geometry.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace garment {
namespace {

double number(const Json& value, const char* label) {
  if (!value.is_number() || !std::isfinite(value.get<double>()))
    throw std::invalid_argument(std::string("non-finite DXF coordinate: ") + label);
  return value.get<double>();
}

Point2 point(const Json& value) { return {number(value.at("x"), "x"), number(value.at("y"), "y")}; }

std::string safeLayer(const std::string& value) {
  std::string result;
  for (char c : value) {
    if (result.size() >= 48) break;
    result += (c >= 'a' && c <= 'z') ? char(c - 'a' + 'A') :
              ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-') ? c : '_';
  }
  return result.empty() ? "PATTERN" : result;
}

void pair(std::ostringstream& out, int code, const std::string& value) {
  out << code << "\n" << value << "\n";
}
void pair(std::ostringstream& out, int code, double value) {
  if (!std::isfinite(value)) throw std::invalid_argument("non-finite DXF geometry");
  out << code << "\n" << value << "\n";
}

} // namespace

std::string exportCuttingDxf(const Document& document, int samplesPerCurve, bool withSeamAllowances) {
  if (samplesPerCurve < 4 || samplesPerCurve > 256)
    throw std::invalid_argument("DXF curve sampling must be between 4 and 256");
  if (!document.validate().ok()) throw std::invalid_argument("cannot export invalid garment");
  std::ostringstream out;
  out << std::setprecision(14);
  pair(out, 0, "SECTION"); pair(out, 2, "HEADER");
  pair(out, 9, "$INSUNITS"); pair(out, 70, "4"); // millimetres
  pair(out, 0, "ENDSEC");
  pair(out, 0, "SECTION"); pair(out, 2, "ENTITIES");
  double xOffsetCm = 0;
  for (const auto& piece : document.data().at("pieces")) {
    const auto& points = piece.at("points");
    if (points.size() < 3) throw std::invalid_argument("pattern needs three points");
    std::vector<Point2> outline;
    if (withSeamAllowances) {
      outline=sampleCutBoundary(piece,samplesPerCurve);
    } else for (std::size_t i = 0; i < points.size(); ++i) {
      auto a = point(points[i]);
      auto b = point(points[(i + 1) % points.size()]);
      outline.push_back(a);
      if (piece.contains("curves") && piece.at("curves").is_object()) {
        const auto key = std::to_string(i);
        if (piece.at("curves").contains(key) && !piece.at("curves").at(key).is_null()) {
          const auto& control = piece.at("curves").at(key);
          Point2 c{number(control.at("cx"), "cx"), number(control.at("cy"), "cy")};
          for (int j = 1; j < samplesPerCurve; ++j) {
            const double t = double(j) / samplesPerCurve, s = 1.0 - t;
            outline.push_back({s*s*a.x + 2*s*t*c.x + t*t*b.x,
                               s*s*a.y + 2*s*t*c.y + t*t*b.y});
          }
        }
      }
    }
    const auto minmax = std::minmax_element(outline.begin(), outline.end(),
      [](const Point2& a, const Point2& b){ return a.x < b.x; });
    const double minX = minmax.first->x, maxX = minmax.second->x;
    const std::string layer = "CUT_" + safeLayer(piece.value("name",piece.at("id").get<std::string>()));
    pair(out, 0, "POLYLINE"); pair(out, 8, layer); pair(out, 66, "1"); pair(out, 70, "1");
    for (const auto& vertex : outline) {
      pair(out, 0, "VERTEX"); pair(out, 8, layer);
      pair(out, 10, (vertex.x - minX + xOffsetCm) * 10.0);
      pair(out, 20, vertex.y * 10.0);
      pair(out, 30, "0");
    }
    pair(out, 0, "SEQEND"); pair(out, 8, layer);
    xOffsetCm += maxX - minX + 10.0;
  }
  pair(out, 0, "ENDSEC"); pair(out, 0, "EOF");
  return out.str();
}

}  // namespace garment
