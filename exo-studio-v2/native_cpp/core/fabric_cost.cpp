#include "fabric_cost.hpp"

#include "grading.hpp"
#include "marker_layout.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {

double numeric(const Json& source,const char* label) {
  double value=0;
  if (source.is_number()) value=source.get<double>();
  else if (source.is_string()) {
    try {
      std::size_t count=0;
      const auto str=source.get<std::string>();
      value=std::stod(str,&count);
      if (count!=str.size()) throw std::invalid_argument("extra characters");
    } catch (const std::exception&) {
      throw std::invalid_argument(std::string(label)+" is not numeric");
    }
  } else throw std::invalid_argument(std::string(label)+" is not numeric");
  if (!std::isfinite(value)) throw std::invalid_argument(std::string(label)+" is not finite");
  return value;
}

Json supplierPrice(const Json& fabric) {
  if (!fabric.is_object() || !fabric.contains("pricePerMeter") ||
      fabric.at("pricePerMeter").is_null() || fabric.at("pricePerMeter")=="") return nullptr;
  try {
    const auto price=numeric(fabric.at("pricePerMeter"),"pricePerMeter");
    if (price<0) return nullptr;
    return price;
  } catch(const std::exception&) { return nullptr; }
}

double rounded(double value,int digits=4) {
  const double multiplier=std::pow(10.,digits);
  if (!std::isfinite(value)) throw std::invalid_argument("invalid material calculation");
  return std::round(value*multiplier)/multiplier;
}

std::vector<std::string> costSizes(const Json& source) {
  const Json grading=source.value("grading",Json::object());
  if (grading.is_object() && grading.contains("sizes") && grading.at("sizes").is_array() &&
      !grading.at("sizes").empty()) {
    std::vector<std::string> sizes;
    for(const auto& size:grading.at("sizes")) {
      if (!size.is_string()) throw std::invalid_argument("cost sizes must be strings");
      sizes.push_back(size.get<std::string>());
    }
    return sizes;
  }
  return {grading.is_object()?grading.value("baseSize",std::string("M")):std::string("M")};
}

std::string csvCell(const std::string& raw) {
  std::string escaped="\"";
  for(char ch:raw) {if (ch=='"') escaped+='"'; escaped+=ch;}
  return escaped+'"';
}

std::string cell(const Json& v,int decimals=-1) {
  if (v.is_null()) return "";
  if (v.is_string()) return v.get<std::string>();
  if (v.is_number()) {
    std::ostringstream out;
    if (decimals>=0) out << std::fixed << std::setprecision(decimals);
    out << v.get<double>();
    return out.str();
  }
  if (v.is_boolean()) return v.get<bool>()?"true":"false";
  return v.dump();
}

} // namespace

Json buildFabricCostRun(const Document& document) {
  const auto& source=document.data();
  const auto sizes=costSizes(source);
  const Json production=source.value("productionSpec",Json::object());
  const std::string currency=production.is_object()?production.value("currency",std::string("USD")):"USD";
  const Json fabrics=source.value("fabrics",Json::object());
  Json rows=Json::array(),totals=Json::array();
  for (const auto& size:sizes) {
    Document graded(gradeProject(document,size));
    const auto markers=buildFabricMarkers(graded);
    bool ready=!markers.empty();
    double total=0;
    for (auto it=markers.begin();it!=markers.end();++it) {
      const auto& marker=it.value();
      const auto& fabricId=it.key();
      const auto& fabric=(fabrics.is_object() && fabrics.contains(fabricId))?fabrics.at(fabricId):Json::object();
      const auto price=supplierPrice(fabric);
      const bool complete=marker.at("unusedPieces")==0 &&
                           marker.at("placements").size()==marker.at("requestedPieces").get<std::size_t>();
      const double length=marker.at("length").get<double>()/100.;
      const auto status=!complete?"INCOMPLETE_MARKER":price.is_null()?"PRICE_NOT_SET":"ESTIMATED";
      const Json amount=complete && !price.is_null()?Json(rounded(length*price.get<double>())):Json(nullptr);
      rows.push_back({{"size",size},{"fabricId",fabricId},
                      {"material",fabric.is_object()?fabric.value("name",fabricId):fabricId},
                      {"currency",currency},{"widthCm",marker.at("width")},
                      {"lengthMeters",length},{"efficiency",marker.at("efficiency")},
                      {"pricePerMeter",price},{"cutPiecesRequested",marker.at("requestedPieces")},
                      {"cutPiecesPlaced",marker.at("placements").size()},
                      {"complete",complete},{"extendedCost",amount},{"status",status}});
      if (std::string(status)!="ESTIMATED") ready=false;
      else total+=amount.get<double>();
    }
    totals.push_back({{"size",size},{"currency",currency},{"ready",ready},
                      {"materialCost",ready?Json(rounded(total)):Json(nullptr)}});
  }
  return {{"currency",currency},{"rows",rows},{"totals",totals},
          {"basis","one cut-piece set per size; fabric only; excludes waste allowance beyond marker and labor, shipping, dyeing, taxes and trim costs"},
          {"factoryCertified",false}};
}

std::string fabricCostRunToCsv(const Json& report) {
  std::ostringstream csv;
  const std::vector<std::string> headers={
    "Size","Fabric ID","Material","Currency","Fabric width cm","Marker length m",
    "Marker efficiency %","Price per meter","Pieces requested","Pieces placed",
    "Estimated fabric cost","Status"};
  for (std::size_t i=0;i<headers.size();++i) {
    if (i) csv << ',';
    csv << csvCell(headers[i]);
  }
  for (const auto& row:report.at("rows")) {
    const std::vector<std::string> values={
      cell(row.at("size")),cell(row.at("fabricId")),cell(row.at("material")),
      cell(row.at("currency")),cell(row.at("widthCm"),2),cell(row.at("lengthMeters"),4),
      cell(row.at("efficiency").get<double>()*100.0,1),
      cell(row.at("pricePerMeter"),2),cell(row.at("cutPiecesRequested")),
      cell(row.at("cutPiecesPlaced")),cell(row.at("extendedCost"),2),cell(row.at("status"))};
    csv << '\n';
    for (std::size_t i=0;i<values.size();++i) {
      if (i) csv << ',';
      csv << csvCell(values[i]);
    }
  }
  return csv.str();
}

} // namespace garment
