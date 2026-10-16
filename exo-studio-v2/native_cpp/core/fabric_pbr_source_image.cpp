#include "fabric_pbr_source_image.hpp"
#include "fabric_pbr_image_generator.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>
#ifdef __APPLE__
#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ImageIO/ImageIO.h>
#endif

namespace garment {
namespace {
std::vector<unsigned char> decode64(const std::string& s) {
 std::vector<unsigned char> out; out.reserve(s.size()*3/4);
 int acc=0,bits=-8; bool padding=false;
 for(char c:s){
  int v=-1;
  if(c>='A'&&c<='Z')v=c-'A'; else if(c>='a'&&c<='z')v=c-'a'+26;
  else if(c>='0'&&c<='9')v=c-'0'+52; else if(c=='+')v=62; else if(c=='/')v=63;
  else if(c=='='){padding=true;continue;}
  if(v<0||padding)throw std::invalid_argument("Invalid image data URL base64");
  acc=(acc<<6)|v;bits+=6;
  if(bits>=0){out.push_back(static_cast<unsigned char>((acc>>bits)&255));bits-=8;}
 }
 if(out.empty()||s.size()%4!=0)throw std::invalid_argument("Invalid image data URL base64");
 return out;
}
double optionNumber(const Json& options,const char* key,double fallback){
 if(!options.is_object()||!options.contains(key))return fallback;
 const auto& v=options.at(key);
 if(v.is_number())return v.get<double>();
 if(v.is_boolean())return v.get<bool>()?1:0;
 if(v.is_null())return 0;
 if(v.is_string())try{return std::stod(v.get<std::string>());}catch(...){}
 return fallback;
}
}
Json decodeFabricImageSourcePixels(const std::string& source,const Json& options){
 if(source.rfind("data:image/",0)!=0)throw std::invalid_argument("Requires an imported fabric image");
 const auto comma=source.find(',');
 if(comma==std::string::npos||source.substr(0,comma).find(";base64")==std::string::npos)
  throw std::invalid_argument("Unsupported fabric image data URL encoding");
 const auto bytes=decode64(source.substr(comma+1));
#ifdef __APPLE__
 CFDataRef data=CFDataCreate(kCFAllocatorDefault,bytes.data(),static_cast<CFIndex>(bytes.size()));
 if(!data)throw std::runtime_error("Image data allocation failed");
 CGImageSourceRef src=CGImageSourceCreateWithData(data,nullptr);
 CFRelease(data);
 if(!src)throw std::invalid_argument("Fabric image decode failed");
 CGImageRef image=CGImageSourceCreateImageAtIndex(src,0,nullptr);
 CFRelease(src);
 if(!image)throw std::invalid_argument("Fabric image decode failed");
 const size_t sw=CGImageGetWidth(image),sh=CGImageGetHeight(image);
 if(!sw||!sh||sw>100000||sh>100000){CGImageRelease(image);throw std::invalid_argument("Invalid source image dimensions");}
 double maxSize=optionNumber(options,"maxSize",512);
 if(!std::isfinite(maxSize)||maxSize==0)maxSize=512;
 const double factor=std::min(1.,std::max(16.,maxSize)/double(std::max(sw,sh)));
 const size_t w=std::max<size_t>(2,std::floor(sw*factor+.5)),h=std::max<size_t>(2,std::floor(sh*factor+.5));
 if(w>8192||h>8192||w*h>16777216){CGImageRelease(image);throw std::invalid_argument("Fabric image dimensions too large");}
 std::vector<uint8_t> rgba(w*h*4,0);
 CGColorSpaceRef cs=CGColorSpaceCreateDeviceRGB();
 CGContextRef ctx=CGBitmapContextCreate(rgba.data(),w,h,8,w*4,cs,kCGImageAlphaPremultipliedLast|kCGBitmapByteOrder32Big);
 CGColorSpaceRelease(cs);
 if(!ctx){CGImageRelease(image);throw std::runtime_error("Canvas pixel processing unavailable");}
 CGContextSetBlendMode(ctx,kCGBlendModeCopy);
 CGContextSetInterpolationQuality(ctx,kCGInterpolationMedium);
 CGContextDrawImage(ctx,CGRectMake(0,0,w,h),image);
 CGContextRelease(ctx);CGImageRelease(image);
 // Canvas getImageData exposes unpremultiplied RGBA pixels.
 Json pixels=Json::array();
 for(size_t i=0;i<rgba.size();i+=4){
  const int a=rgba[i+3];
  for(int c=0;c<3;++c) pixels.push_back(a?std::min(255,int(std::floor(double(rgba[i+c])*255/a+.5))):0);
  pixels.push_back(a);
 }
 return Json{{"width",w},{"height",h},{"data",std::move(pixels)}};
#else
 (void)bytes;(void)options;
 throw std::runtime_error("Image source decoding requires macOS ImageIO");
#endif
}
Json generateFabricPbrFromImageSource(const std::string& source,const Json& options){
 return generateFabricPbrFromImagePixels(decodeFabricImageSourcePixels(source,options),options);
}
}
