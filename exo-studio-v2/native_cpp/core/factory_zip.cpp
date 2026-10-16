#include "factory_zip.hpp"
#include "dxf_export.hpp"
#include "construction_dxf.hpp"
#include "grading.hpp"
#include "marker_layout.hpp"
#include "marker_svg.hpp"
#include "marker_pdf.hpp"
#include "bom_export.hpp"
#include "fabric_cost.hpp"
#include "production_preflight.hpp"
#include "measurement_export.hpp"
#include "tech_pack_export.hpp"
#include <algorithm>
#include <cctype>
#include <cstdint>
#include <limits>
#include <set>
#include <stdexcept>

namespace garment {
namespace {
void le16(std::string& out,std::uint16_t n) { out.push_back(char(n));out.push_back(char(n>>8)); }
void le32(std::string& out,std::uint32_t n) { le16(out,std::uint16_t(n));le16(out,std::uint16_t(n>>16)); }
std::uint32_t checked32(std::size_t n) {
  if(n>std::numeric_limits<std::uint32_t>::max()) throw std::invalid_argument("ZIP32 size exceeded");
  return static_cast<std::uint32_t>(n);
}
std::uint32_t crc32(const std::string& data) {
  std::uint32_t crc=0xffffffffu;
  for(unsigned char c:data) {
    crc^=c;
    for(int j=0;j<8;++j) crc=(crc>>1)^(0xedb88320u & (0u-(crc&1u)));
  }
  return ~crc;
}
void validatePath(const std::string& path) {
  if(path.empty() || path.size()>65535 || path[0]=='/' || path.back()=='/' ||
     path.find('\\')!=std::string::npos || path.find(':')!=std::string::npos)
    throw std::invalid_argument("Unsafe ZIP path");
  std::size_t pos=0;
  while(pos<path.size()) {
    const auto end=path.find('/',pos);
    const auto segment=path.substr(pos,end==std::string::npos?std::string::npos:end-pos);
    if(segment.empty() || segment=="." || segment=="..") throw std::invalid_argument("ZIP path traversal");
    pos=end==std::string::npos?path.size():end+1;
  }
  for(unsigned char c:path) if(c<32 || c==127 || c>=128) throw std::invalid_argument("ZIP path must be printable ASCII");
}
std::string safeSlug(const std::string& raw) {
  std::string out;
  for(unsigned char c:raw) {
    if(std::isalnum(c) && c<128) out+=char(std::tolower(c));
    else if(!out.empty() && out.back()!='-') out+='-';
  }
  while(!out.empty() && out.back()=='-') out.pop_back();
  if(out.empty()) out="item";
  if(out.size()>80) out.resize(80);
  return out;
}
}
std::string buildStoredZip(const std::vector<FactoryZipEntry>& entries) {
  if(entries.size()>65535) throw std::invalid_argument("ZIP32 entry count exceeded");
  std::set<std::string> seen;
  std::string bytes, central;
  for(const auto& entry:entries) {
    validatePath(entry.path);
    if(!seen.insert(entry.path).second) throw std::invalid_argument("Duplicate ZIP path");
    const auto offset=checked32(bytes.size()),length=checked32(entry.bytes.size());
    const auto nameLength=static_cast<std::uint16_t>(entry.path.size());
    const auto crc=crc32(entry.bytes);
    le32(bytes,0x04034b50u);le16(bytes,20);le16(bytes,0);le16(bytes,0);
    le16(bytes,0);le16(bytes,0);le32(bytes,crc);
    le32(bytes,length);le32(bytes,length);le16(bytes,nameLength);le16(bytes,0);
    bytes+=entry.path;bytes+=entry.bytes;
    checked32(bytes.size());
    le32(central,0x02014b50u);le16(central,20);le16(central,20);
    le16(central,0);le16(central,0);le16(central,0);le16(central,0);
    le32(central,crc);le32(central,length);le32(central,length);
    le16(central,nameLength);le16(central,0);le16(central,0);
    le16(central,0);le16(central,0);le32(central,0);le32(central,offset);
    central+=entry.path;
    checked32(central.size());
  }
  const auto centerOffset=checked32(bytes.size());
  const auto centerLength=checked32(central.size());
  if(static_cast<std::uint64_t>(centerOffset)+centerLength+22>std::numeric_limits<std::uint32_t>::max())
    throw std::invalid_argument("ZIP32 archive too large");
  bytes+=central;
  le32(bytes,0x06054b50u);le16(bytes,0);le16(bytes,0);
  le16(bytes,static_cast<std::uint16_t>(entries.size()));
  le16(bytes,static_cast<std::uint16_t>(entries.size()));
  le32(bytes,centerLength);le32(bytes,centerOffset);le16(bytes,0);
  return bytes;
}

std::string buildNativeFactoryZip(const Document& document) {
  const auto& source=document.data();
  const auto sizes=gradeSizeRun(document);
  if(!sizes.is_object() || sizes.empty()) throw std::invalid_argument("No garment sizes configured");
  std::vector<FactoryZipEntry> entries;
  auto add=[&](std::string path,std::string contents) {entries.push_back({std::move(path),std::move(contents)});};
  add("bom.xml",exportBomXml(document));
  add("fabric-costing.csv",fabricCostRunToCsv(buildFabricCostRun(document)));
  add("production-preflight.json",inspectProduction(source,true).dump(2)+"\n");
  add("tech-pack.json",buildTechPack(document).dump(2)+"\n");
  add("pom-spec.csv",measurementRunToCsv(document));
  add("garment-source.json",source.dump(2)+"\n");
  add("size-run.json",sizes.dump(2)+"\n");
  Json manifest={{"schema","garment-studio.native-factory-package.v1"},{"zipMethod","store"},
                 {"units","cm"},{"certified",false},{"factoryCertified",false},{"files",Json::array()}};
  std::set<std::string> usedPaths={"bom.xml","fabric-costing.csv","production-preflight.json",
    "tech-pack.json","pom-spec.csv","garment-source.json","size-run.json",
    "README.txt","manifest.json"};
  for(auto it=sizes.begin();it!=sizes.end();++it) {
    const auto size=it.key();
    Document graded(it.value());
    const auto sizeSlug=safeSlug(size);
    std::string dxfPath="patterns/"+sizeSlug+".dxf";
    if(!usedPaths.insert(dxfPath).second) throw std::invalid_argument("Size path collision");
    add(dxfPath,exportConstructionDxf(graded,size));
    const auto markers=buildFabricMarkers(graded);
    for(auto mi=markers.begin();mi!=markers.end();++mi) {
      const auto path="markers/"+sizeSlug+"/"+safeSlug(mi.key())+".svg";
      if(!usedPaths.insert(path).second) throw std::invalid_argument("Marker path collision");
      std::string name=mi.key();
      if(source.contains("fabrics") && source.at("fabrics").is_object()) {
        auto fi=source.at("fabrics").find(mi.key());
        if(fi!=source.at("fabrics").end() && fi->is_object() && fi->contains("name") && (*fi)["name"].is_string())
          name=(*fi)["name"].get<std::string>();
      }
      add(path,markerToSvg(mi.value(),size,name,graded.data()));
      const auto& marker=mi.value();
      if(marker.contains("placements") && marker.at("placements").is_array() &&
         !marker.at("placements").empty() &&
         marker.contains("length") && marker.at("length").is_number() &&
         marker.at("length").get<double>()>0) {
        const auto pdfPath="markers/"+sizeSlug+"/"+safeSlug(mi.key())+".pdf";
        if(!usedPaths.insert(pdfPath).second) throw std::invalid_argument("Marker PDF path collision");
        add(pdfPath,markerToPdf(marker,size,400,graded.data()));
      }
    }
  }
  add("README.txt","GARMENT STUDIO NATIVE FACTORY PACKAGE\nDevelopment exports; not certified for factory cutting or production.\n"
      "Contents: patterns/<size>.dxf (construction annotations in mm); markers/<size>/<fabric>.svg (true-size cm);\n"
      "markers/<size>/<fabric>.pdf (true-size 72/2.54 pt per cm; at most 400 cm long per page; print at 100%).\n"
      "PDF is generated only when the fabric marker has placed pieces; missing PDFs indicate an empty layout.\n"
      "bom.xml (open schema); fabric-costing.csv (estimates); production-preflight.json (development checks);\n"
      "tech-pack.json; pom-spec.csv; size-run.json; garment-source.json (editable source metadata).\n"
      "Project source metadata is included; private local texture/image files are not bundled.\n"
      "Review all geometry, grading, grainlines, material costs and production checks before use.\n");
  for(const auto& e:entries) manifest["files"].push_back({{"path",e.path},{"bytes",e.bytes.size()},{"crc32",crc32(e.bytes)}});
  add("manifest.json",manifest.dump(2)+"\n");
  return buildStoredZip(entries);
}
}
