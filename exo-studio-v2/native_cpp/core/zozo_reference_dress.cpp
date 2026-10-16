#include "zozo_reference_dress.hpp"
#include <array>
#include <cmath>
#include <cstring>
#include <limits>
#include <regex>
#include <stdexcept>

namespace garment {
namespace {
Json readMetadata(const std::string& directory, const char* filename) {
  std::ifstream stream(directory + "/" + filename);
  if (!stream) throw std::runtime_error(
      std::string("Original ZOZO dress reference unavailable (") + filename + ")");
  return Json::parse(stream);
}
std::uint32_t littleU32(const unsigned char* bytes) {
  return std::uint32_t(bytes[0]) |
      (std::uint32_t(bytes[1]) << 8) |
      (std::uint32_t(bytes[2]) << 16) |
      (std::uint32_t(bytes[3]) << 24);
}
void require(const bool condition, const std::string& message) {
  if (!condition) throw std::invalid_argument(message);
}
}

ZozoReferenceDress loadZozoDressReference(const std::string& directory) {
  const auto manifest=readMetadata(directory,"manifest.json");
  const auto meshes=readMetadata(directory,"meshes.json");
  constexpr auto error="Original ZOZO dress provenance or unsafe-fit labels failed validation";
  require(manifest.is_object() && manifest.value("format",std::string()) ==
      "garment-studio.zozo-reference-dress.v1",error);
  require(manifest.value("accepted",true)==false &&
      manifest.value("fullPhysicalFitVerified",true)==false &&
      manifest.value("frames",0)==241 &&
      manifest.value("vertexCount",0)==28467 &&
      manifest.value("bodyVertices",0)==12811 &&
      manifest.value("clothVertices",0)==15656 &&
      manifest.value("stitchConstraints",0)==851 &&
      manifest.contains("audits") && manifest["audits"].is_array() &&
      manifest["audits"].size()==241,error);

  require(meshes.is_object() && meshes.contains("clothPanels") &&
      meshes["clothPanels"].is_array() && meshes["clothPanels"].size()==14 &&
      meshes.contains("bodyIndices") && meshes["bodyIndices"].is_array(),
      "Original ZOZO dress panel mesh metadata is incomplete");
  static const std::regex panelId("^panel[0-9]+$");
  for(const auto& panel:meshes["clothPanels"]) {
    if(!panel.is_object() || !panel.contains("id") || !panel["id"].is_string() ||
       !std::regex_match(panel["id"].get<std::string>(),panelId) ||
       !panel.contains("indices") || !panel["indices"].is_array() ||
       panel["indices"].size()%3)
      throw std::invalid_argument("Invalid original ZOZO dress triangle index");
    for(const auto& index:panel["indices"])
      if(!index.is_number_integer() || index.get<std::int64_t>()<0 ||
          index.get<std::int64_t>()>=15656)
        throw std::invalid_argument("Invalid original ZOZO dress triangle index");
  }
  const auto& bodyIndices=meshes["bodyIndices"];
  require(manifest.contains("bodyTriangles") && manifest["bodyTriangles"].is_number_integer() &&
      bodyIndices.size()==static_cast<std::size_t>(
        manifest["bodyTriangles"].get<int>()*3),
      "Invalid original pinned-body triangle index");
  for(const auto& index:bodyIndices)
    if(!index.is_number_integer() || index.get<std::int64_t>()<15656 ||
        index.get<std::int64_t>()>=28467)
      throw std::invalid_argument("Invalid original pinned-body triangle index");

  std::ifstream stream(directory + "/frames.bin",std::ios::binary);
  if(!stream) throw std::runtime_error(
      "Original ZOZO dress reference unavailable (frames.bin)");
  std::array<unsigned char,28> header{};
  stream.read(reinterpret_cast<char*>(header.data()),header.size());
  const std::uint64_t length=28ULL+241ULL*28467ULL*12ULL;
  stream.seekg(0,std::ios::end);
  const auto actual=stream.tellg();
  require(actual>=0 && static_cast<std::uint64_t>(actual)==length &&
      std::memcmp(header.data(),"GSDRESS1",8)==0 &&
      littleU32(header.data()+8)==1 &&
      littleU32(header.data()+12)==28467 &&
      littleU32(header.data()+16)==241 &&
      littleU32(header.data()+20)==60 &&
      littleU32(header.data()+24)==12811,
      "Original ZOZO dress native trajectory binary is corrupt or incomplete");
  stream.clear();
  return ZozoReferenceDress(manifest,meshes,std::move(stream));
}

std::vector<float> ZozoReferenceDress::frameVertices(const int frame) {
  if(frame<0 || frame>=manifest_.at("frames").get<int>())
    throw std::out_of_range("ZOZO dress frame outside recorded trajectory");
  constexpr std::size_t size=28467ULL*3ULL;
  std::vector<float> xyz(size);
  const auto offset=28ULL+static_cast<std::uint64_t>(frame)*size*sizeof(float);
  binary_.clear();
  binary_.seekg(static_cast<std::streamoff>(offset),std::ios::beg);
  binary_.read(reinterpret_cast<char*>(xyz.data()),
      static_cast<std::streamsize>(size*sizeof(float)));
  if(binary_.gcount()!=static_cast<std::streamsize>(size*sizeof(float)))
    throw std::runtime_error("Original ZOZO dress native trajectory binary is corrupt or incomplete");
  for(const auto value:xyz)if(!std::isfinite(value))
    throw std::runtime_error("Non-finite ZOZO dress frame "+std::to_string(frame));
  return xyz;
}

std::vector<std::uint32_t> ZozoReferenceDress::frameFloat32Bits(
    const int frame, const std::vector<std::size_t>& coordinates) {
  const auto floats=frameVertices(frame);
  std::vector<std::uint32_t> bits;
  bits.reserve(coordinates.size());
  for(const auto coordinate:coordinates) {
    if(coordinate>=floats.size())throw std::out_of_range("ZOZO dress coordinate outside frame");
    std::uint32_t value=0;
    static_assert(sizeof(value)==sizeof(float),"Expected 32-bit float");
    std::memcpy(&value,&floats[coordinate],sizeof(value));
    bits.push_back(value);
  }
  return bits;
}
} // namespace garment
