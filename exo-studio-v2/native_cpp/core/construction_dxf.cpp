#include "construction_dxf.hpp"

#include "cutting_geometry.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <iomanip>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {
constexpr double kPi=3.14159265358979323846;
struct EdgePosition { Point2 point, normal; };

double field(const Json& data,const char* key,double fallback=0) {
  if (!data.is_object() || !data.contains(key) || data.at(key).is_null()) return fallback;
  const auto& item=data.at(key);
  if (!item.is_number()) throw std::invalid_argument(std::string(key)+" must be a number");
  const double value=item.get<double>();
  if (!std::isfinite(value) || std::abs(value)>1e6)
    throw std::invalid_argument(std::string(key)+" must be finite");
  return value;
}

Point2 point(const Json& value) { return {field(value,"x"),field(value,"y")}; }

std::string string(const Json& value,const char* key,const std::string& fallback="") {
  if (!value.is_object() || !value.contains(key) || value.at(key).is_null()) return fallback;
  if (!value.at(key).is_string()) throw std::invalid_argument(std::string(key)+" must be text");
  return value.at(key).get<std::string>();
}

std::string token(std::string value) {
  if (value.empty()) value="PATTERN";
  if(value.size()>48) value.resize(48);
  for (char& c:value)
    if (!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'||c=='-')) c='_';
  std::transform(value.begin(),value.end(),value.begin(),[](unsigned char c){return static_cast<char>(std::toupper(c));});
  return value;
}

void row(std::ostringstream& out,int code,const std::string& value) {
  if (value.find('\n')!=std::string::npos || value.find('\r')!=std::string::npos)
    throw std::invalid_argument("DXF text must not contain line breaks");
  out<<code<<'\n'<<value<<'\n';
}
void row(std::ostringstream& out,int code,double value) {
  if(!std::isfinite(value)) throw std::invalid_argument("non-finite DXF coordinate");
  out<<code<<'\n'<<value<<'\n';
}
void dxfLine(std::ostringstream& out,const std::string& layer,Point2 a,Point2 b) {
  row(out,0,"LINE");row(out,8,layer);
  row(out,10,a.x*10.);row(out,20,a.y*10.);row(out,30,"0");
  row(out,11,b.x*10.);row(out,21,b.y*10.);row(out,31,"0");
}
void dxfPoly(std::ostringstream& out,const std::string& layer,const std::vector<Point2>& outline) {
  row(out,0,"POLYLINE");row(out,8,layer);row(out,66,"1");row(out,70,"1");
  for(const auto& p:outline) {
    row(out,0,"VERTEX");row(out,8,layer);
    row(out,10,p.x*10.);row(out,20,p.y*10.);row(out,30,"0");
  }
  row(out,0,"SEQEND");row(out,8,layer);
}
void dxfText(std::ostringstream& out,const std::string& layer,const Point2& at,const std::string& value) {
  row(out,0,"TEXT");row(out,8,layer);
  row(out,10,at.x*10.);row(out,20,at.y*10.);row(out,30,"0");
  row(out,40,"5");row(out,1,value);
}

Point2 bezier(Point2 a,Point2 c,Point2 b,double t) {
  const double u=1-t;
  return {u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y};
}
Point2 derivative(Point2 a,Point2 c,Point2 b,double t) {
  return {2*((1-t)*(c.x-a.x)+t*(b.x-c.x)),2*((1-t)*(c.y-a.y)+t*(b.y-c.y))};
}

// Numerically integrate the quadratic arc for arc-length-based notch placement,
// matching the browser CAD's definition rather than fraction of Bezier parameter.
double arc(Point2 a,Point2 c,Point2 b,double end) {
  const int steps=100;
  const double h=end/steps;
  double sum=0;
  for(int i=0;i<=steps;++i) {
    const Point2 v=derivative(a,c,b,i*h);
    sum+=(i==0||i==steps?1:(i%2?4:2))*std::hypot(v.x,v.y);
  }
  return sum*h/3;
}

EdgePosition edgePosition(const Json& piece,std::size_t index,double fraction) {
  const auto& points=piece.at("points");
  const Point2 a=point(points.at(index)),b=point(points.at((index+1)%points.size()));
  const double f=std::max(0.,std::min(1.,fraction));
  Point2 v{b.x-a.x,b.y-a.y},located{a.x+v.x*f,a.y+v.y*f};
  const auto curves=piece.value("curves",Json::object());
  const auto it=curves.is_object()?curves.find(std::to_string(index)):curves.end();
  if (it!=curves.end() && !it->is_null()) {
    const Point2 control{field(*it,"cx"),field(*it,"cy")};
    double lo=0.,hi=1.;
    const double target=f*arc(a,control,b,1.);
    for(int n=0;n<30;++n) {
      const double t=(lo+hi)*.5;
      if(arc(a,control,b,t)<target) lo=t; else hi=t;
    }
    const double t=f==0?0:f==1?1:(lo+hi)*.5;
    located=bezier(a,control,b,t);
    v=derivative(a,control,b,t);
  }
  const double length=std::hypot(v.x,v.y);
  if(length<1e-10) v={1.,0.};
  else {v.x/=length;v.y/=length;}
  return {located,{-v.y,v.x}};
}

void notch(std::ostringstream& out,const std::string& layer,const Json& piece,
           std::size_t edge,double t,double depth,double shift) {
  const EdgePosition position=edgePosition(piece,edge,t);
  const Point2& p=position.point,&n=position.normal;
  dxfLine(out,layer,{p.x-n.x*depth*.15+shift,p.y-n.y*depth*.15},
                  {p.x+n.x*depth+shift,p.y+n.y*depth});
}

std::vector<Point2> boundary(const Json& piece) {
  const auto& points=piece.at("points");
  const Json curves=piece.value("curves",Json::object());
  std::vector<Point2> result;
  for(std::size_t i=0;i<points.size();++i) {
    const Point2 a=point(points[i]),b=point(points[(i+1)%points.size()]);
    const auto curve=curves.is_object()?curves.find(std::to_string(i)):curves.end();
    if(curve==curves.end() || curve->is_null()) result.push_back(a);
    else {
      const Point2 c{field(*curve,"cx"),field(*curve,"cy")};
      for(int s=0;s<12;++s) result.push_back(bezier(a,c,b,s/12.));
    }
  }
  return result;
}
} // namespace

std::string exportConstructionDxf(const Document& document,const std::string& size) {
  if (!document.validate().ok()) throw std::invalid_argument("invalid garment for construction DXF");
  if(size.size()>48 || size.find('\n')!=std::string::npos)
    throw std::invalid_argument("invalid DXF size token");
  std::ostringstream out;
  out<<std::setprecision(16);
  row(out,0,"SECTION");row(out,2,"HEADER");
  row(out,9,"$ACADVER");row(out,1,"AC1009");
  row(out,9,"$MEASUREMENT");row(out,70,"1");
  row(out,9,"$INSUNITS");row(out,70,"4");
  row(out,0,"ENDSEC");
  row(out,999,"GARMENT_STUDIO_PROJECT "+string(document.data(),"id","untitled"));
  row(out,999,"GARMENT_STUDIO_SIZE "+size);
  row(out,999,"COORDINATES_MM");
  row(out,0,"SECTION");row(out,2,"ENTITIES");

  std::set<std::string> sewn;
  if(document.data().contains("seams")) for(const auto& seam:document.data().at("seams"))
    for(const char* side:{"a","b"}) {
      if(!seam.contains(side) || !seam.at(side).is_object()) continue;
      const Json& end=seam.at(side);
      if(end.contains("edgeIndex") && end.at("edgeIndex").is_number_integer())
        sewn.insert(string(end,"pieceId")+":"+std::to_string(end.at("edgeIndex").get<int>()));
    }
  double shift=0;
  for(const auto& piece:document.data().at("pieces")) {
    const auto outline=boundary(piece);
    if(outline.size()<3) throw std::invalid_argument("pattern outline has fewer than 3 points");
    const auto [low,high]=std::minmax_element(outline.begin(),outline.end(),
      [](const Point2& a,const Point2& b){return a.x<b.x;});
    const double minX=low->x,maxX=high->x;
    const double offset=shift-minX;
    std::vector<Point2> translated;
    for(const auto& p:outline) translated.push_back({p.x+offset,p.y});
    const std::string name=string(piece,"name",string(piece,"id","PATTERN"));
    const std::string layer=token(name);
    dxfPoly(out,"CUT_"+layer+"_"+token(size),translated);
    bool allow=false;
    for(std::size_t edge=0;edge<piece.at("points").size();++edge) {
      double sa=field(piece,"seamAllowance");
      const Json overrides=piece.value("edgeSeamAllowances",Json::object());
      const auto it=overrides.is_object()?overrides.find(std::to_string(edge)):overrides.end();
      if(it!=overrides.end() && !it->is_null()) sa=it->is_number()?it->get<double>():sa;
      if(sa>0) {allow=true;break;}
    }
    if(allow) {
      std::vector<Point2> cut=sampleCutBoundary(piece,12);
      for(auto& p:cut) p.x+=offset;
      dxfPoly(out,"SA_"+layer,cut);
    }
    std::set<std::size_t> explicitNotch;
    if(piece.contains("notches") && piece.at("notches").is_array()) for(const auto& mark:piece.at("notches")) {
      if(!mark.is_object()) continue;
      const double d=field(mark,"edgeIndex",-1);
      if(d<0 || d>=piece.at("points").size() || std::floor(d)!=d) continue;
      const auto edge=static_cast<std::size_t>(d);
      explicitNotch.insert(edge);
      const Point2 a=point(piece.at("points").at(edge));
      const Point2 b=point(piece.at("points").at((edge+1)%piece.at("points").size()));
      const double length=std::hypot(b.x-a.x,b.y-a.y);
      const double spacing=length>0?std::min(.045,.38/length):.02;
      const double t=field(mark,"t",.5),depth=field(mark,"depthCm",.45);
      if(string(mark,"type")=="double") {
        notch(out,"NOTCH_"+layer,piece,edge,std::max(.01,t-spacing),depth,offset);
        notch(out,"NOTCH_"+layer,piece,edge,std::min(.99,t+spacing),depth,offset);
      } else notch(out,"NOTCH_"+layer,piece,edge,t,depth,offset);
    }
    for(std::size_t edge=0;edge<piece.at("points").size();++edge)
      if(explicitNotch.count(edge)==0 && sewn.count(string(piece,"id")+":"+std::to_string(edge)))
        notch(out,"NOTCH_"+layer,piece,edge,.5,.45,offset);

    if(piece.contains("buttonholes") && piece.at("buttonholes").is_array())
      for(const auto& hole:piece.at("buttonholes")) {
        const double angle=field(hole,"orientationDeg")*kPi/180;
        const double half=std::max(.4,field(hole,"lengthCm",2.4)*.5);
        const Point2 p{field(hole,"x")+offset,field(hole,"y")};
        dxfLine(out,"BUTTONHOLE_"+layer,
          {p.x-std::cos(angle)*half,p.y-std::sin(angle)*half},
          {p.x+std::cos(angle)*half,p.y+std::sin(angle)*half});
      }
    double cx=0,cy=0,minY=outline.front().y,maxY=outline.front().y;
    for(const auto& p:translated) {
      cx+=p.x; cy+=p.y;
      minY=std::min(minY,p.y);maxY=std::max(maxY,p.y);
    }
    cx/=translated.size();cy/=translated.size();
    const double half=std::max(3.,(maxY-minY-12)*.5);
    const double grain=field(piece,"grainAngleDeg")*kPi/180;
    const double dx=std::sin(grain)*half,dy=std::cos(grain)*half;
    dxfLine(out,"GRAIN_"+layer,{cx-dx,cy-dy},{cx+dx,cy+dy});
    dxfText(out,"LABEL_"+layer,{cx,cy},name+" / "+size);
    if(piece.contains("internalLines") && piece.at("internalLines").is_array())
      for(const auto& line:piece.at("internalLines")) {
        if(!line.is_object() || !line.contains("a") || !line.contains("b")) continue;
        const auto a=point(line.at("a")),b=point(line.at("b"));
        auto shifted=[&](Point2 p){p.x+=offset;return p;};
        const std::string kind=string(line,"type","construction");
        const double vx=b.x-a.x,vy=b.y-a.y,length=std::max(1.,std::hypot(vx,vy));
        const double nx=-vy/length,ny=vx/length;
        if(kind=="dart") {
          const double width=field(line,"widthCm",2.5)*.5;
          dxfLine(out,"INTERNAL_DART_"+layer,shifted({a.x+nx*width,a.y+ny*width}),shifted(b));
          dxfLine(out,"INTERNAL_DART_"+layer,shifted({a.x-nx*width,a.y-ny*width}),shifted(b));
          dxfLine(out,"DART_CENTER_"+layer,shifted(a),shifted(b));
        } else if(kind=="pleat") {
          const int count=std::max(1,std::min(16,static_cast<int>(std::floor(field(line,"count",5)+.5))));
          const double spacing=std::max(1.,field(line,"spacingCm",4));
          for(int i=0;i<count;++i) {
            const double delta=(i-(count-1)*.5)*spacing;
            dxfLine(out,"INTERNAL_PLEAT_"+layer,
              shifted({a.x+nx*delta,a.y+ny*delta}),
              shifted({b.x+nx*delta,b.y+ny*delta}));
          }
        } else dxfLine(out,"INTERNAL_"+token(kind)+"_"+layer,shifted(a),shifted(b));
      }
    shift+=(maxX-minX)+10.;
  }
  row(out,0,"ENDSEC");row(out,0,"EOF");
  return out.str();
}

}  // namespace garment
