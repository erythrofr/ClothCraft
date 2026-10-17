#include "marker_svg.hpp"
#include "cutting_geometry.hpp"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>
#include <stdexcept>

namespace garment {
namespace {
constexpr double pi = 3.14159265358979323846;
double numeric(const Json& value, const char* field) {
  if (!value.is_number()) throw std::invalid_argument(std::string("Invalid numeric ")+field);
  const double n=value.get<double>();
  if (!std::isfinite(n) || std::abs(n)>1000000) throw std::invalid_argument(std::string("Nonfinite or oversized ")+field);
  return n;
}
double field(const Json& value,const char* key,double fallback=0) {
  return value.contains(key) && !value.at(key).is_null()?numeric(value.at(key),key):fallback;
}
std::string str(const Json& v,const char* key,const std::string& fallback="") {
  return v.contains(key) && v.at(key).is_string()?v.at(key).get<std::string>():fallback;
}
std::string num(double n) {
  if (!std::isfinite(n)) throw std::invalid_argument("Nonfinite SVG coordinate");
  if (std::abs(n)<0.00005) n=0;
  std::ostringstream out; out.imbue(std::locale::classic());
  out<<std::fixed<<std::setprecision(4)<<n;
  auto result=out.str();
  while(result.find('.')!=std::string::npos && result.back()=='0') result.pop_back();
  if (!result.empty() && result.back()=='.') result.pop_back();
  return result;
}
std::string escape(const std::string& input) {
  std::string out;
  for (unsigned char c:input) {
    switch(c) {
      case '&':out+="&amp;";break; case '<':out+="&lt;";break;
      case '>':out+="&gt;";break; case '"':out+="&quot;";break;
      case '\'':out+="&apos;";break;
      default:
        if (c<0x20 && c!='\n' && c!='\t' && c!='\r') out+="&#"+std::to_string(c)+";";
        else out+=static_cast<char>(c);
    }
  }
  return out;
}
Point2 point(const Json& p) {
  if (!p.is_object()) throw std::invalid_argument("Invalid SVG point");
  return {numeric(p.at("x"),"x"),numeric(p.at("y"),"y")};
}
void line(std::ostringstream& out,Point2 a,Point2 b) {
  out<<"<line x1=\""<<num(a.x)<<"\" y1=\""<<num(a.y)<<"\" x2=\""<<num(b.x)
     <<"\" y2=\""<<num(b.y)<<"\"/>";
}
Point2 onEdge(const Json& piece,std::size_t index,double t) {
  const auto& pts=piece.at("points");
  const auto a=point(pts.at(index)), b=point(pts.at((index+1)%pts.size()));
  const auto curves=piece.value("curves",Json::object());
  const auto key=std::to_string(index);
  if (curves.is_object() && curves.contains(key) && curves.at(key).is_object()) {
    const auto& curve=curves.at(key);
    const double cx=field(curve,"cx"),cy=field(curve,"cy");
    return {(1-t)*(1-t)*a.x+2*(1-t)*t*cx+t*t*b.x,
            (1-t)*(1-t)*a.y+2*(1-t)*t*cy+t*t*b.y};
  }
  return {a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t};
}
double arcLength(Point2 a,Point2 control,Point2 b,double end=1.) {
  auto speed=[&](double t) {return std::hypot(2*((1-t)*(control.x-a.x)+t*(b.x-control.x)),2*((1-t)*(control.y-a.y)+t*(b.y-control.y)));};
  auto simp=[](double x,double y,double fx,double fm,double fy){return (y-x)*(fx+4*fm+fy)/6;};
  auto rec=[&](auto&& self,double x,double y,double fx,double fm,double fy,double sum,double error,int depth)->double {
    const double m=(x+y)/2,fl=speed((x+m)/2),fr=speed((m+y)/2);
    const double left=simp(x,m,fx,fl,fm),right=simp(m,y,fm,fr,fy);
    if(depth>=20 || std::abs(left+right-sum)<=error*15) return left+right+(left+right-sum)/15;
    return self(self,x,m,fx,fl,fm,left,error/2,depth+1)+self(self,m,y,fm,fr,fy,right,error/2,depth+1);
  };
  return rec(rec,0,end,speed(0),speed(end/2),speed(end),simp(0,end,speed(0),speed(end/2),speed(end)),1e-7,0);
}
struct Located { Point2 p; Point2 normal; };
Located locate(const Json& piece,std::size_t edge,double fraction) {
  const auto& pts=piece.at("points");
  const Point2 a=point(pts.at(edge)),b=point(pts.at((edge+1)%pts.size()));
  const auto curves=piece.value("curves",Json::object());
  const std::string key=std::to_string(edge);
  const double f=std::clamp(fraction,0.,1.);
  if(curves.is_object() && curves.contains(key) && curves.at(key).is_object()) {
    const auto& curve=curves.at(key);
    const Point2 control{field(curve,"cx"),field(curve,"cy")};
    const double total=arcLength(a,control,b);
    double low=0,high=1;
    if(total>=1e-9) for(int i=0;i<30;++i) {
      const double mid=(low+high)/2;
      if(arcLength(a,control,b,mid)<f*total) low=mid; else high=mid;
    }
    const double t=f==0?0:f==1?1:(low+high)/2;
    const auto p=onEdge(piece,edge,t);
    const double dx=2*((1-t)*(control.x-a.x)+t*(b.x-control.x));
    const double dy=2*((1-t)*(control.y-a.y)+t*(b.y-control.y));
    const double magnitude=std::hypot(dx,dy);
    const Point2 tangent=magnitude>1e-9?Point2{dx/magnitude,dy/magnitude}:Point2{(b.x-a.x)/total,(b.y-a.y)/total};
    return {p,{-tangent.y,tangent.x}};
  }
  const double length=std::max(1.,std::hypot(b.x-a.x,b.y-a.y));
  return {{a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f},{-(b.y-a.y)/length,(b.x-a.x)/length}};
}
}

std::string markerToSvg(const Json& marker,const std::string& size,
                        const std::string& fabricName,const Json& project) {
  if (!marker.is_object()) throw std::invalid_argument("Invalid marker");
  const double width=field(marker,"width"),length=std::max(1.,field(marker,"length"));
  if (!(width>0) || !(length>0)) throw std::invalid_argument("Invalid marker dimensions");
  const auto placements=marker.value("placements",Json::array());
  if (!placements.is_array()) throw std::invalid_argument("Invalid placements");
  std::ostringstream polygons,labels,grains,notches;
  const std::string chosenFabric=fabricName.empty()?str(marker,"fabricId","Fabric"):fabricName;
  const std::string chosenSize=size;
  for (const auto& place:placements) {
    if (!place.is_object()) throw std::invalid_argument("Invalid placement");
    const double x=field(place,"x"),y=field(place,"y");
    const auto outline=place.value("outline",Json::array());
    if (!outline.is_array() || outline.size()<3) throw std::invalid_argument("Marker outline requires >=3 points");
    polygons<<"<polygon fill=\"none\" stroke=\"#111\" stroke-width=\"0.04\" points=\"";
    bool first=true;
    for (const auto& vertex:outline) {
      const auto p=point(vertex);
      if (!first) polygons<<" ";
      polygons<<num(p.x)<<","<<num(p.y);
      first=false;
    }
    polygons<<"\"/>";
    const double instance=field(place,"instance");
    if (instance<0 || std::floor(instance)!=instance) throw std::invalid_argument("Invalid instance");
    labels<<"<text x=\""<<num(x+.5)<<"\" y=\""<<num(y+1.5)
          <<"\" font-size=\"1.1\" fill=\"#111\">"
          <<escape(str(place,"name")+" "+chosenSize+" #"+num(instance+1))<<"</text>";
    if (!project.is_object() || !project.contains("pieces") || !project.at("pieces").is_array()) continue;
    for (const auto& piece:project.at("pieces")) {
      if (!piece.is_object() || str(piece,"id")!=str(place,"pieceId")) continue;
      if (!piece.contains("points") || !piece.at("points").is_array() || piece.at("points").size()<3) break;
      const double radians=field(place,"rotationDeg")*pi/180.;
      const double c=std::cos(radians),s=std::sin(radians);
      const auto boundary=sampleCutBoundary(piece,10);
      if (boundary.size()<3) break;
      double minX=std::numeric_limits<double>::infinity(),minY=minX;
      for (const auto p:boundary) {
        minX=std::min(minX,p.x*c-p.y*s);
        minY=std::min(minY,p.x*s+p.y*c);
      }
      const auto translate=[&](Point2 p)->Point2 {
        return {x+p.x*c-p.y*s-minX,y+p.x*s+p.y*c-minY};
      };
      std::vector<Point2> sampled;
      const auto& pts=piece.at("points");
      for (std::size_t i=0;i<pts.size();++i) {
        const auto curves=piece.value("curves",Json::object());
        const bool curved=curves.is_object() && curves.contains(std::to_string(i)) && curves.at(std::to_string(i)).is_object();
        for (int j=0;j<(curved?10:1);++j) sampled.push_back(onEdge(piece,i,j/10.));
      }
      double centerX=0,centerY=0,yLow=std::numeric_limits<double>::infinity(),yHigh=-yLow;
      for (const auto p:sampled) {
        centerX+=p.x;centerY+=p.y;yLow=std::min(yLow,p.y);yHigh=std::max(yHigh,p.y);
      }
      centerX/=sampled.size();centerY/=sampled.size();
      const double half=std::max(2.,(yHigh-yLow)*.28);
      const double grainAngle=field(piece,"grainAngleDeg")*pi/180.;
      const double dx=std::sin(grainAngle)*half,dy=std::cos(grainAngle)*half;
      line(grains,translate({centerX-dx,centerY-dy}),translate({centerX+dx,centerY+dy}));
      if (piece.contains("notches") && piece.at("notches").is_array()) {
        for (const auto& notch:piece.at("notches")) {
          const double edge=field(notch,"edgeIndex",-1);
          if (edge<0 || edge>=pts.size() || std::floor(edge)!=edge) continue;
          const std::size_t ei=static_cast<std::size_t>(edge);
          const auto p0=onEdge(piece,ei,0.),p1=onEdge(piece,ei,1.);
          const auto curves=piece.value("curves",Json::object());
          const std::string edgeKey=std::to_string(ei);
          const bool curved=curves.is_object() && curves.contains(edgeKey) && curves.at(edgeKey).is_object();
          const double lengthEdge=curved?arcLength(p0,{field(curves.at(edgeKey),"cx"),field(curves.at(edgeKey),"cy")},p1):std::hypot(p1.x-p0.x,p1.y-p0.y);
          if (lengthEdge<1e-9) continue;
          const double t=field(notch,"t",.5),depth=field(notch,"depthCm",.45);
          const double gap=std::min(.045,.38/std::max(.1,lengthEdge));
          const bool dbl=str(notch,"type")=="double";
          for (int n=0;n<(dbl?2:1);++n) {
            const double fraction=std::clamp(t+(dbl?(n==0?-gap:gap):0.),0.,1.);
            const auto located=locate(piece,ei,fraction);
            const auto origin=located.p;
            const Point2 normal=located.normal;
            line(notches,translate({origin.x-normal.x*depth*.15,origin.y-normal.y*depth*.15}),
                         translate({origin.x+normal.x*depth,origin.y+normal.y*depth}));
          }
        }
      }
      break;
    }
  }
  const auto unused=field(marker,"unusedPieces");
  std::ostringstream svg;
  svg<<"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
     <<"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\""<<num(width)
     <<"cm\" height=\""<<num(length)<<"cm\" viewBox=\"0 0 "<<num(width)<<" "<<num(length)<<"\">"
     <<"<title>"<<escape("Marker "+chosenFabric+" "+chosenSize)<<"</title>"
     <<"<desc>True-size SVG; print at 100%. "<<num(unused)
     <<" unplaced pieces. Cut and annotation groups remain separate.</desc>"
     <<"<rect x=\"0\" y=\"0\" width=\""<<num(width)<<"\" height=\""<<num(length)
     <<"\" fill=\"white\" stroke=\"black\" stroke-width=\"0.05\"/>"
     <<"<g id=\"cut-lines\">"<<polygons.str()<<"</g>"
     <<"<g id=\"grain-lines\" stroke=\"#666\" stroke-width=\"0.035\" stroke-dasharray=\"0.5 0.25\">"<<grains.str()<<"</g>"
     <<"<g id=\"notch-marks\" stroke=\"red\" stroke-width=\"0.045\">"<<notches.str()<<"</g>"
     <<"<g id=\"labels\">"<<labels.str()<<"</g></svg>";
  return svg.str();
}
}
