#include "fabric_pbr_pixels.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>

namespace garment {
namespace {
double channelLinear(double channel) {
  const double c=channel/255.;
  return c<=.04045 ? c/12.92 : std::pow((c+.055)/1.055,2.4);
}
double finiteNumber(const Json& v,double fallback) {
  if(v.is_null()) return 0.;
  if(v.is_number())return v.get<double>();
  if(v.is_boolean())return v.get<bool>()?1.:0.;
  if(v.is_string()) {
    try {
      auto str=v.get<std::string>();
      if(str.find_first_not_of(" \t\n\r")==std::string::npos)return 0.;
      std::size_t n=0;
      auto value=std::stod(str,&n);
      return n==str.size()?value:std::numeric_limits<double>::quiet_NaN();
    }catch(...) {return std::numeric_limits<double>::quiet_NaN();}
  }
  return fallback;
}
int clampPixel(double n) {
  // Source JS uses Math.round(...) before writing Uint8ClampedArray.
  if(!std::isfinite(n))return 0;
  return std::clamp(static_cast<int>(std::floor(n+.5)),0,255);
}
}
Json estimateFabricPbrPixels(const Json& imageData,const Json& options) {
  if(!imageData.is_object() || !imageData.contains("width") ||
     !imageData.contains("height") || !imageData.contains("data") ||
     !imageData["width"].is_number_integer() ||
     !imageData["height"].is_number_integer() ||
     !imageData["data"].is_array())
    throw std::invalid_argument("Invalid fabric image pixels");
  const auto width=imageData.at("width").get<long long>();
  const auto height=imageData.at("height").get<long long>();
  if(width<2||height<2||width>8192||height>8192 ||
     static_cast<std::uint64_t>(width)*static_cast<std::uint64_t>(height)>16000000ULL ||
     imageData.at("data").size()<static_cast<std::size_t>(width*height*4))
    throw std::invalid_argument("Invalid fabric image pixels");
  const auto& pixels=imageData.at("data");
  const int w=static_cast<int>(width),h=static_cast<int>(height);
  std::vector<float> luminance(static_cast<std::size_t>(w)*h);
  for(std::size_t i=0;i<luminance.size();++i) {
    const std::size_t offset=i*4;
    double rgb[3]{};
    for(int channel=0;channel<3;++channel) {
      if(!pixels[offset+channel].is_number())
        throw std::invalid_argument("Invalid fabric image pixels");
      rgb[channel]=channelLinear(pixels[offset+channel].get<double>());
    }
    luminance[i]=static_cast<float>(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]);
  }
  const auto sample=[&](int x,int y)->double {
    x=std::clamp(x,0,w-1);
    y=std::clamp(y,0,h-1);
    return luminance[static_cast<std::size_t>(y)*w+x];
  };
  double gain=2;
  if(options.is_object()&&options.contains("normalStrength")) {
    const double raw=finiteNumber(options.at("normalStrength"),2.);
    gain=std::isnan(raw)||raw==0?2.:std::clamp(raw,.1,8.);
  }
  Json normal=Json::array(),roughness=Json::array();
  for(int y=0;y<h;++y)for(int x=0;x<w;++x) {
    const double dx=(sample(x+1,y)-sample(x-1,y))*.5*gain;
    const double dy=(sample(x,y+1)-sample(x,y-1))*.5*gain;
    const double reciprocal=1./std::hypot(dx,dy,1.);
    normal.push_back(clampPixel((1-dx*reciprocal)*127.5));
    normal.push_back(clampPixel((1-dy*reciprocal)*127.5));
    normal.push_back(clampPixel((1+reciprocal)*127.5));
    normal.push_back(255);
    double average=0,squared=0;
    for(int by=-1;by<=1;++by)for(int bx=-1;bx<=1;++bx) {
      const double value=sample(x+bx,y+by);
      average+=value;
      squared+=value*value;
    }
    average/=9.;
    const double variance=std::sqrt(std::max(0.,squared/9.-average*average));
    const int r=clampPixel(std::clamp(198.+150.*variance,173.,245.));
    roughness.push_back(r);roughness.push_back(r);roughness.push_back(r);roughness.push_back(255);
  }
  return {{"width",w},{"height",h},{"normal",std::move(normal)},{"roughness",std::move(roughness)},
    {"kind","estimated-from-albedo"}};
}
}
