#include "gltf_export.hpp"
#include "pattern_mesh.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {
constexpr std::size_t kMaxBinaryBytes = 32 * 1024 * 1024;

void byte32(std::string& buffer, std::uint32_t n) {
  for (int k=0;k<4;++k) buffer.push_back(static_cast<char>((n>>(k*8))&0xffu));
}

void float32(std::string& buffer, double number) {
  if (!std::isfinite(number) || std::abs(number)>1e7)
    throw std::invalid_argument("invalid glTF coordinate");
  const float cast=static_cast<float>(number);
  if (!std::isfinite(cast)) throw std::invalid_argument("invalid glTF float32 conversion");
  std::uint32_t bits=0;
  static_assert(sizeof(float)==sizeof(std::uint32_t),"32-bit float required");
  std::memcpy(&bits,&cast,sizeof(float));
  byte32(buffer,bits);
}

std::string base64(const std::string& data) {
  static constexpr char table[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  output.reserve(((data.size()+2)/3)*4);
  for (std::size_t i=0;i<data.size();i+=3) {
    const auto a=static_cast<unsigned char>(data[i]);
    const auto b=i+1<data.size()?static_cast<unsigned char>(data[i+1]):0;
    const auto c=i+2<data.size()?static_cast<unsigned char>(data[i+2]):0;
    output.push_back(table[a>>2]);
    output.push_back(table[((a&3u)<<4)|(b>>4)]);
    output.push_back(i+1<data.size()?table[((b&15u)<<2)|(c>>6)]:'=');
    output.push_back(i+2<data.size()?table[c&63u]:'=');
  }
  return output;
}

double finite(const Json& data,const char* key,double fallback) {
  if(!data.is_object() || !data.contains(key) || data.at(key).is_null()) return fallback;
  const auto& value=data.at(key);
  if(!value.is_number()) throw std::invalid_argument(std::string("fabric ")+key+" must be numeric");
  const auto n=value.get<double>();
  if(!std::isfinite(n)) throw std::invalid_argument(std::string("fabric ")+key+" must be finite");
  return n;
}

double clamp01(double n) {return std::max(0.,std::min(1.,n));}

int hexDigit(char c) {
  if(c>='0'&&c<='9')return c-'0';
  if(c>='a'&&c<='f')return c-'a'+10;
  if(c>='A'&&c<='F')return c-'A'+10;
  return -1;
}
std::array<double,3> color(const Json& fabric) {
  if (!fabric.is_object() || !fabric.contains("color") || !fabric["color"].is_string())
    return {1.,1.,1.};
  const auto hex=fabric.at("color").get<std::string>();
  if(hex.size()!=7 || hex[0]!='#') return {1.,1.,1.};
  std::array<double,3> rgb{};
  for(int i=0;i<3;++i) {
    const int h=hexDigit(hex[1+i*2]),l=hexDigit(hex[2+i*2]);
    if(h<0 || l<0) return {1.,1.,1.};
    const double c=(h*16+l)/255.;
    // glTF 2.0 baseColorFactor values are linear light, while CSS colors are sRGB.
    rgb[i]=c<=.04045?c/12.92:std::pow((c+.055)/1.055,2.4);
  }
  return rgb;
}

Json material(const std::string& id,const Json& fabric) {
  const auto c=color(fabric);
  const double opacity=clamp01(finite(fabric,"opacity",1.));
  const double metallic=clamp01(finite(fabric,"metalness",0.));
  const double roughness=clamp01(finite(fabric,"roughness",.82));
  const auto name=fabric.is_object() && fabric.contains("name") && fabric["name"].is_string()
    ? fabric["name"].get<std::string>() : id;
  return {{"name",name},{"doubleSided",true},
    {"alphaMode",opacity<.999?"BLEND":"OPAQUE"},
    {"pbrMetallicRoughness",{
      {"baseColorFactor",Json::array({c[0],c[1],c[2],opacity})},
      {"metallicFactor",metallic},{"roughnessFactor",roughness}}},
    {"extras",{{"fabricId",id},{"source","native Garment Studio fabric"},
      {"opacity",opacity},{"grainAligned",true},
      {"textureMapsDeferred",fabric.is_object() && fabric.contains("texture") &&
         fabric.at("texture").is_object() && !fabric.at("texture").empty()}}}};
}

std::size_t addBufferView(Json& root,std::size_t offset,std::size_t length,int target) {
  const std::size_t index=root["bufferViews"].size();
  root["bufferViews"].push_back({{"buffer",0},{"byteOffset",offset},
    {"byteLength",length},{"target",target}});
  return index;
}

std::size_t addAccessor(Json& root,std::size_t view,std::size_t count,
                         int componentType,const std::string& type,
                         const Json& minimum=nullptr,const Json& maximum=nullptr) {
  const std::size_t index=root["accessors"].size();
  Json entry={{"bufferView",view},{"componentType",componentType},
              {"count",count},{"type",type}};
  if(!minimum.is_null()) entry["min"]=minimum;
  if(!maximum.is_null()) entry["max"]=maximum;
  root["accessors"].push_back(entry);
  return index;
}
} // namespace

std::string exportFlatPatternGltf(const Document& document,int segmentsPerCurve,int resolution) {
  if(!document.validate().ok()) throw std::invalid_argument("cannot export invalid project");
  if(segmentsPerCurve<2 || segmentsPerCurve>64 || resolution<0 || resolution>3)
    throw std::invalid_argument("invalid glTF tessellation settings");
  const auto meshes=buildProjectPatternMeshes(document.data(),segmentsPerCurve,resolution);
  if(meshes.empty()) throw std::invalid_argument("no active garment panels for glTF export");
  if(meshes.size()>512) throw std::invalid_argument("too many garment panels for glTF export");
  Json root={{"asset",{{"version","2.0"},{"generator","SAMPL3D native C++ rest-mesh exporter"}}},
    {"scene",0},{"scenes",Json::array({{{"nodes",Json::array()}}})},
    {"nodes",Json::array()},{"meshes",Json::array()},{"materials",Json::array()},
    {"buffers",Json::array()},{"bufferViews",Json::array()},{"accessors",Json::array()},
    {"extras",{{"coordinateUnits","metres"},{"sourcePatternUnits","cm"},
      {"restState",true},{"fitAccepted",false},{"physicsSimulated",false},
      {"warning","Flat pattern interchange only; not a sewn garment or body-fitted simulation."}}}};
  const auto& source=document.data();
  const Json fabrics=source.value("fabrics",Json::object());
  std::map<std::string,std::size_t> matIndices;
  std::string bytes;
  double horizontalShift=0;
  for(const auto& mesh:meshes) {
    if(mesh.vertices.empty() || mesh.triangles.empty())
      throw std::invalid_argument("empty garment panel mesh");
    auto found=std::find_if(source.at("pieces").begin(),source.at("pieces").end(),
      [&](const Json& p){return p.at("id").get<std::string>()==mesh.pieceId;});
    if(found==source.at("pieces").end()) throw std::invalid_argument("mesh is missing its source piece");
    const std::string fabricId=found->value("fabricId",std::string("main"));
    std::size_t materialIndex=0;
    auto materialIt=matIndices.find(fabricId);
    if(materialIt==matIndices.end()) {
      const Json fabric=fabrics.is_object()&&fabrics.contains(fabricId)
        ? fabrics.at(fabricId):Json::object();
      materialIndex=root["materials"].size();
      root["materials"].push_back(material(fabricId,fabric));
      matIndices.emplace(fabricId,materialIndex);
    } else materialIndex=materialIt->second;
    double minX=mesh.vertices.front().positionCm.x;
    double maxX=minX;
    for(const auto& vertex:mesh.vertices) {
      minX=std::min(minX,vertex.positionCm.x);
      maxX=std::max(maxX,vertex.positionCm.x);
    }
    const auto positionOffset=bytes.size();
    std::array<double,3> bmin{1e100,1e100,1e100},bmax{-1e100,-1e100,-1e100};
    for(const auto& vertex:mesh.vertices) {
      // Metres, Y-up, flat pattern XY -> glTF XZ. Z negative so +Y drafting
      // points toward model-space negative Z; preserve signed planar area.
      const std::array<double,3> p{(vertex.positionCm.x-minX+horizontalShift)/100.,
                                    0.,-vertex.positionCm.y/100.};
      for(int j=0;j<3;++j) {
        bmin[j]=std::min(bmin[j],p[j]);bmax[j]=std::max(bmax[j],p[j]);
        float32(bytes,p[j]);
      }
    }
    const auto positionView=addBufferView(root,positionOffset,
      bytes.size()-positionOffset,34962);
    const auto positionAccessor=addAccessor(root,positionView,mesh.vertices.size(),
      5126,"VEC3",Json::array({bmin[0],bmin[1],bmin[2]}),
      Json::array({bmax[0],bmax[1],bmax[2]}));
    const auto uvOffset=bytes.size();
    for(const auto& vertex:mesh.vertices) {
      float32(bytes,vertex.uv.x);
      float32(bytes,vertex.uv.y);
    }
    const auto uvView=addBufferView(root,uvOffset,bytes.size()-uvOffset,34962);
    const auto uvAccessor=addAccessor(root,uvView,mesh.vertices.size(),5126,"VEC2");
    const auto indexOffset=bytes.size();
    for(const auto& triangle:mesh.triangles)
      for(const auto index:triangle) {
        if(index>=mesh.vertices.size() || index>UINT32_MAX)
          throw std::invalid_argument("invalid glTF triangle index");
        byte32(bytes,static_cast<std::uint32_t>(index));
      }
    const auto indexView=addBufferView(root,indexOffset,bytes.size()-indexOffset,34963);
    // glTF index min/max are optional. Omitting them avoids falsely assuming
    // every subdivided vertex is used by at least one triangle.
    const auto indexAccessor=addAccessor(root,indexView,mesh.triangles.size()*3,
      5125,"SCALAR");
    if(bytes.size()>kMaxBinaryBytes) throw std::invalid_argument("glTF geometry exceeds 32 MiB limit");
    Json extras={{"sourcePieceId",mesh.pieceId},{"fabricId",fabricId},
      {"grainDirection",{{"x",mesh.grainDirection.x},{"y",mesh.grainDirection.y}}},
      {"seamEdgeIds",Json::array()}};
    for(const auto& edge:mesh.edges)
      if(!edge.seamId.empty())
        extras["seamEdgeIds"].push_back({{"sourceEdge",edge.sourceEdge},
          {"seamIds",edge.seamId},{"boundaryVertexIndices",edge.boundaryIndices}});
    const std::size_t meshIndex=root["meshes"].size();
    root["meshes"].push_back({{"name",mesh.pieceId},
      {"primitives",Json::array({{{"attributes",{{"POSITION",positionAccessor},
                                      {"TEXCOORD_0",uvAccessor}}},
        {"indices",indexAccessor},{"material",materialIndex},{"mode",4}}})},
      {"extras",extras}});
    const std::size_t nodeIndex=root["nodes"].size();
    root["nodes"].push_back({{"mesh",meshIndex},{"name",mesh.pieceId}});
    root["scenes"][0]["nodes"].push_back(nodeIndex);
    horizontalShift+=(maxX-minX)+10.;
  }
  root["buffers"].push_back({{"byteLength",bytes.size()},
    {"uri","data:application/octet-stream;base64,"+base64(bytes)}});
  return root.dump(2);
}

} // namespace garment
