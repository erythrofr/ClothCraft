#include "fabric_pbr_image_generator.hpp"
#include "fabric_pbr_pixels.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>
namespace garment {
namespace {
using Bytes=std::vector<uint8_t>;
void be32(Bytes& b,uint32_t v){for(int i=3;i>=0;--i)b.push_back(uint8_t(v>>(8*i)));}
uint32_t crc(const Bytes& b,size_t start,size_t end){
 uint32_t c=0xffffffffu;
 for(size_t i=start;i<end;++i){c^=b[i];for(int j=0;j<8;++j)c=(c>>1)^((c&1)?0xedb88320u:0u);}
 return ~c;
}
void chunk(Bytes& b,const char* type,const Bytes& payload){
 be32(b,uint32_t(payload.size()));const auto start=b.size();
 for(int i=0;i<4;++i)b.push_back(uint8_t(type[i]));
 b.insert(b.end(),payload.begin(),payload.end());be32(b,crc(b,start,b.size()));
}
std::string encodeBase64(const Bytes& b){
 static constexpr char chars[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
 std::string s;s.reserve((b.size()+2)/3*4);
 for(size_t i=0;i<b.size();i+=3){
  const uint32_t v=(uint32_t(b[i])<<16)|(i+1<b.size()?uint32_t(b[i+1])<<8:0)|(i+2<b.size()?b[i+2]:0);
  s.push_back(chars[(v>>18)&63]);s.push_back(chars[(v>>12)&63]);
  s.push_back(i+1<b.size()?chars[(v>>6)&63]:'=');
  s.push_back(i+2<b.size()?chars[v&63]:'=');
 }
 return s;
}
std::string pngDataUrl(const Json& channels,int width,int height){
 Bytes raw;raw.reserve(size_t(height)*(size_t(width)*4+1));
 for(int y=0;y<height;++y){raw.push_back(0);
  for(int x=0;x<width*4;++x)raw.push_back(uint8_t(channels[size_t(y)*width*4+x].get<int>()));
 }
 Bytes deflate{0x78,0x01};
 size_t p=0;
 while(p<raw.size()){
  const size_t n=std::min(size_t(65535),raw.size()-p);
  deflate.push_back(uint8_t(p+n==raw.size()));
  deflate.push_back(uint8_t(n));deflate.push_back(uint8_t(n>>8));
  const uint16_t inv=uint16_t(~uint16_t(n));
  deflate.push_back(uint8_t(inv));deflate.push_back(uint8_t(inv>>8));
  deflate.insert(deflate.end(),raw.begin()+p,raw.begin()+p+n);p+=n;
 }
 uint32_t a=1,b=0;for(uint8_t x:raw){a=(a+x)%65521;b=(b+a)%65521;}
 be32(deflate,(b<<16)|a);
 Bytes png{137,80,78,71,13,10,26,10};
 Bytes ihdr;be32(ihdr,uint32_t(width));be32(ihdr,uint32_t(height));
 ihdr.insert(ihdr.end(),{8,6,0,0,0});chunk(png,"IHDR",ihdr);
 chunk(png,"IDAT",deflate);chunk(png,"IEND",{});
 return "data:image/png;base64,"+encodeBase64(png);
}
double number(const Json& value,double fallback){
 if(value.is_number())return value.get<double>();
 if(value.is_boolean())return value.get<bool>()?1:0;
 if(value.is_null())return 0;
 if(value.is_string()){try{return std::stod(value.get<std::string>());}catch(...){return fallback;}}
 return fallback;
}
}
Json generateFabricPbrFromImagePixels(const Json& pixels,const Json& options){
 if(!pixels.is_object()||!pixels.contains("width")||!pixels.contains("height"))
  throw std::invalid_argument("Invalid fabric image pixels");
 const Json o=options.is_object()?options:Json::object();
 const int w=pixels.at("width").get<int>(),h=pixels.at("height").get<int>();
 if(pixels.contains("sourceWidth")||pixels.contains("sourceHeight")){
  if(!pixels.contains("sourceWidth")||!pixels.contains("sourceHeight"))
   throw std::invalid_argument("Both source dimensions required");
  const double sourceW=number(pixels.at("sourceWidth"),0),sourceH=number(pixels.at("sourceHeight"),0);
  if(sourceW<=0||sourceH<=0)throw std::invalid_argument("Invalid source image dimensions");
  const double maxSize=o.contains("maxSize")?number(o.at("maxSize"),512):512;
  const double factor=std::min(1.,std::max(16.,maxSize==0||std::isnan(maxSize)?512:maxSize)/std::max(sourceW,sourceH));
  const int expectedW=std::max(2,int(std::floor(sourceW*factor+.5)));
  const int expectedH=std::max(2,int(std::floor(sourceH*factor+.5)));
  if(w!=expectedW||h!=expectedH)
   throw std::invalid_argument("Decoded canvas pixels do not match expected resize dimensions");
 }
 const auto generated=estimateFabricPbrPixels(pixels,o);
 return Json{{"normalSrc",pngDataUrl(generated.at("normal"),w,h)},
             {"roughnessSrc",pngDataUrl(generated.at("roughness"),w,h)},
             {"width",w},{"height",h},{"method","estimated-from-albedo"}};
}
}
