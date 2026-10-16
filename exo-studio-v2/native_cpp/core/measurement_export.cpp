#include "measurement_export.hpp"
#include "grading.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {
struct Pt { double x, y; };
struct Bounds { double minX, maxX, minY, maxY; };

double numeric(const Json& value, const char* label) {
  if (!value.is_number()) throw std::invalid_argument(std::string(label) + " must be numeric");
  const double n=value.get<double>();
  if (!std::isfinite(n)) throw std::invalid_argument(std::string(label) + " must be finite");
  return n;
}

double optional(const Json& obj,const char* key,double fallback) {
  if (!obj.is_object() || !obj.contains(key) || obj.at(key).is_null()) return fallback;
  return numeric(obj.at(key),key);
}

Pt point(const Json& obj) { return {numeric(obj.at("x"),"x"),numeric(obj.at("y"),"y")}; }

std::vector<Pt> sampleBoundary(const Json& piece,int divisions) {
  std::vector<Pt> result;
  const auto& points=piece.at("points");
  const auto curves=piece.value("curves",Json::object());
  if (points.size()<3) throw std::invalid_argument("pattern requires at least three points");
  result.reserve(points.size()*static_cast<std::size_t>(divisions));
  for (std::size_t i=0;i<points.size();++i) {
    const Pt a=point(points[i]), b=point(points[(i+1)%points.size()]);
    const auto key=std::to_string(i);
    const bool curved=curves.is_object() && curves.contains(key) && !curves.at(key).is_null();
    Pt control{};
    if (curved) control={numeric(curves.at(key).at("cx"),"cx"),numeric(curves.at(key).at("cy"),"cy")};
    // JS sampleEdge includes 0..divisions endpoints; samplePieceBoundary
    // removes the last point from each edge to avoid vertex duplication.
    for (int j=0;j<divisions;++j) {
      const double t=static_cast<double>(j)/divisions, u=1.-t;
      if (curved) result.push_back({u*u*a.x+2*u*t*control.x+t*t*b.x,
                                   u*u*a.y+2*u*t*control.y+t*t*b.y});
      else result.push_back({a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t});
    }
  }
  return result;
}

Bounds bounds(const std::vector<Pt>& points) {
  if (points.empty()) throw std::invalid_argument("empty pattern boundary");
  Bounds result{std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity(),
                std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity()};
  for (const auto& p:points) {
    result.minX=std::min(result.minX,p.x); result.maxX=std::max(result.maxX,p.x);
    result.minY=std::min(result.minY,p.y); result.maxY=std::max(result.maxY,p.y);
  }
  return result;
}

double horizontalSpan(const Json& piece,double y) {
  const auto points=sampleBoundary(piece,18);
  std::vector<double> intersections;
  for (std::size_t i=0;i<points.size();++i) {
    const auto& a=points[i]; const auto& b=points[(i+1)%points.size()];
    if (std::abs(a.y-b.y)<1e-6) {
      if (std::abs(y-a.y)<0.2) {intersections.push_back(a.x);intersections.push_back(b.x);}
      continue;
    }
    const double low=std::min(a.y,b.y), high=std::max(a.y,b.y);
    if (y<low || y>high) continue;
    const double t=(y-a.y)/(b.y-a.y);
    intersections.push_back(a.x+(b.x-a.x)*t);
  }
  if (intersections.size()<2) return 0;
  const auto extrema=std::minmax_element(intersections.begin(),intersections.end());
  return *extrema.second-*extrema.first;
}

// Native document edgeInfo uses the same analytic quadratic arc length as JS.
double edgeLength(const Document& doc,const Json& piece,std::size_t edge) {
  return doc.edgeInfo(piece.at("id").get<std::string>(),edge).at("lengthCm").get<double>();
}

Json measured(const char* id,const char* label,double cm,double tolerance) {
  if (!std::isfinite(cm) || !std::isfinite(tolerance))
    throw std::invalid_argument("measurement must be finite");
  // Match JS Number(cm.toFixed(2)) at ordinary CAD precision, eliminating -0.
  double rounded=std::round(cm*100.)/100.;
  if (rounded==0) rounded=0;
  return {{"id",id},{"label",label},{"cm",rounded},{"toleranceCm",tolerance}};
}

std::vector<std::string> sizeNames(const Json& source) {
  const Json grading=source.value("grading",Json::object());
  std::vector<std::string> sizes;
  if (grading.is_object() && grading.contains("sizes") && grading.at("sizes").is_array()) {
    for (const auto& size:grading.at("sizes")) {
      if (!size.is_string()) throw std::invalid_argument("size must be string");
      sizes.push_back(size.get<std::string>());
    }
  } else {
    sizes.push_back(grading.is_object()?grading.value("baseSize",std::string("M")):"M");
  }
  if (sizes.empty()) throw std::invalid_argument("size run is empty");
  return sizes;
}

std::string csvCell(const std::string& raw) {
  std::string escaped="\"";
  for (char ch:raw) { if (ch=='"') escaped+='"'; escaped+=ch; }
  escaped+='"';
  return escaped;
}

std::string csvNumber(const Json& value) {
  if (value.is_null()) return "";
  if (value.is_string()) return value.get<std::string>();
  if (value.is_number()) {
    const double d=value.get<double>();
    if (d==0) return "0";
    std::ostringstream stream;
    stream << std::setprecision(15) << d;
    return stream.str();
  }
  return value.dump();
}
} // namespace

Json measureProject(const Document& document) {
  const Json& project=document.data();
  const Json& pieces=project.at("pieces");
  if (pieces.empty()) return Json::array();
  const Json* front=&pieces.at(0),*sleeve=nullptr;
  for (const auto& piece:pieces) {
    if (piece.at("id")=="front") front=&piece;
    if (piece.at("id")=="sleeve-left") sleeve=&piece;
  }
  const Bounds fb=bounds(sampleBoundary(*front,16));
  const double height=fb.maxY-fb.minY;
  const double chestY=fb.minY+height*0.70;
  const double waistY=fb.minY+height*0.42;
  const double hemY=fb.minY+std::max(0.3,height*0.01);
  const double shoulderY=fb.minY+height*0.955;
  if (front->at("points").size()<3) throw std::invalid_argument("front needs three points");
  Json out=Json::array({
    measured("body-length","Body length",height,0.7),
    measured("chest-half","1/2 chest",horizontalSpan(*front,chestY),0.5),
    measured("waist-half","1/2 waist",horizontalSpan(*front,waistY),0.5),
    measured("hem-half","1/2 hem",horizontalSpan(*front,hemY),0.5),
    measured("across-shoulder","Across shoulder",horizontalSpan(*front,shoulderY),0.5),
    measured("front-armhole","Front armhole",edgeLength(document,*front,1)+edgeLength(document,*front,2),0.4)
  });
  if (sleeve) {
    const Bounds sb=bounds(sampleBoundary(*sleeve,16));
    const double sleeveHeight=sb.maxY-sb.minY;
    out.push_back(measured("sleeve-length","Sleeve length",sleeveHeight,0.7));
    out.push_back(measured("bicep-half","Bicep circumference (sleeve flat)",
      horizontalSpan(*sleeve,sb.maxY-sleeveHeight*0.18),0.5));
    out.push_back(measured("cuff-half","Cuff circumference (sleeve flat)",
      horizontalSpan(*sleeve,sb.minY+0.3),0.4));
  }
  if (project.contains("customMeasurements") && project.at("customMeasurements").is_array()) {
    for (const auto& m:project.at("customMeasurements")) {
      if (!m.is_object() || !m.contains("a") || !m.contains("b") ||
          m.at("a").is_null() || m.at("b").is_null()) continue;
      const Pt a=point(m.at("a")),b=point(m.at("b"));
      const std::string id=m.at("id").get<std::string>();
      const std::string label=m.value("label",std::string("Custom measurement"));
      out.push_back(measured(id.c_str(),label.c_str(),std::hypot(b.x-a.x,b.y-a.y),
                             optional(m,"toleranceCm",0.5)));
    }
  }
  return out;
}

Json buildMeasurementSizeRun(const Document& document) {
  Json run=Json::object();
  for (const auto& size:sizeNames(document.data())) {
    Document graded(gradeProject(document,size));
    run[size]=measureProject(graded);
  }
  return run;
}

std::string measurementRunToCsv(const Document& document) {
  const auto sizes=sizeNames(document.data());
  const Json run=buildMeasurementSizeRun(document);
  const auto& original=run.at(sizes.front());
  std::ostringstream csv;
  csv << "\"POM\",\"Tolerance cm\"";
  for (const auto& size:sizes) csv << ',' << csvCell(size);
  for (const auto& measurement:original) {
    const std::string id=measurement.at("id").get<std::string>();
    csv << '\n' << csvCell(measurement.value("label",id)) << ','
        << csvCell(csvNumber(measurement.value("toleranceCm",Json())));
    for (const auto& size:sizes) {
      Json val;
      for (const auto& item:run.at(size)) if (item.at("id")==id) {val=item.at("cm");break;}
      csv << ',' << csvCell(csvNumber(val));
    }
  }
  return csv.str();
}

} // namespace garment
