#include "marker_pdf.hpp"
#include "cutting_geometry.hpp"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace garment {
namespace {
constexpr double kPt = 72. / 2.54;
double value(const Json& j, const char* k, double fallback=0) {
  if (!j.is_object() || !j.contains(k) || j[k].is_null()) return fallback;
  if (j[k].is_number()) return j[k].get<double>();
  if (j[k].is_string()) {
    try { return std::stod(j[k].get<std::string>()); } catch (...) { return NAN; }
  }
  return NAN;
}
std::string string(const Json& j, const char* key, const std::string& fallback="") {
  if (j.is_object() && j.contains(key) && j[key].is_string()) return j[key].get<std::string>();
  return fallback;
}
std::string n(double v) {
  if (!std::isfinite(v)) throw std::invalid_argument("nonfinite PDF coordinate");
  v=std::round(v*10000.)/10000.;
  if (v==0) return "0";
  std::ostringstream o; o << std::fixed << std::setprecision(4) << v;
  std::string s=o.str();
  while (s.find('.')!=std::string::npos && s.back()=='0') s.pop_back();
  if (s.back()=='.') s.pop_back();
  return s;
}
std::string ascii(const std::string& input) {
  std::string s;
  for (unsigned char c:input) s.push_back(c>=32 && c<=126 ? static_cast<char>(c) : '?');
  return s;
}
std::string escape(const std::string& input) {
  std::string out;
  for (char c:ascii(input)) {
    if (c=='\\' || c=='(' || c==')') out.push_back('\\');
    out.push_back(c);
  }
  return out;
}
struct P { double x,y; };
P point(const Json& j) { return {value(j,"x",NAN),value(j,"y",NAN)}; }
P transform(P p,double rot,double minX,double minY,double x,double y) {
  return {x+p.x*std::cos(rot)-p.y*std::sin(rot)-minX,
          y+p.x*std::sin(rot)+p.y*std::cos(rot)-minY};
}
P quad(P a,P c,P b,double t) {
  const double u=1-t;
  return {u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y};
}
std::vector<P> sampledBoundary(const Json& piece,int steps) {
  std::vector<P> result;
  if (!piece.contains("points")||!piece["points"].is_array()) return result;
  auto& pts=piece["points"];
  for (std::size_t i=0;i<pts.size();++i) {
    auto a=point(pts[i]),b=point(pts[(i+1)%pts.size()]);
    const auto& curves=piece.value("curves",Json::object());
    const auto key=std::to_string(i);
    if (curves.is_object() && curves.contains(key) && curves[key].is_object()) {
      P c=point(Json{{"x",value(curves[key],"cx")},{"y",value(curves[key],"cy")}});
      for (int j=0;j<steps;++j) result.push_back(quad(a,c,b,static_cast<double>(j)/steps));
    } else result.push_back(a);
  }
  return result;
}
std::string line(P a,P b,double start,double height) {
  return n(a.x*kPt)+" "+n((height-(a.y-start))*kPt)+" m "+
         n(b.x*kPt)+" "+n((height-(b.y-start))*kPt)+" l S\n";
}
const Json* pieceFor(const Json& project,const std::string& id) {
  if (!project.is_object()||!project.contains("pieces")||!project["pieces"].is_array()) return nullptr;
  for (const auto& p:project["pieces"]) if (string(p,"id")==id) return &p;
  return nullptr;
}
struct Overlay { P grainA,grainB; std::vector<std::pair<P,P>> notches; };
std::vector<Overlay> overlays(const Json& marker,const Json& project) {
  std::vector<Overlay> out;
  if (!project.is_object()) return out;
  for (const auto& placement:marker.at("placements")) {
    const Json* p=pieceFor(project,string(placement,"pieceId"));
    if (!p || !p->contains("points") || !(*p)["points"].is_array() || (*p)["points"].size()<3) continue;
    const auto boundary=sampledBoundary(*p,10);
    if (boundary.empty()) continue;
    const double deg=value(placement,"rotationDeg")*3.14159265358979323846/180.;
    const auto cut=sampleCutBoundary(*p,10);
    if (cut.empty()) continue;
    double rawMinX=std::numeric_limits<double>::infinity(),rawMinY=rawMinX;
    for (auto pt:cut) {
      rawMinX=std::min(rawMinX,pt.x*std::cos(deg)-pt.y*std::sin(deg));
      rawMinY=std::min(rawMinY,pt.x*std::sin(deg)+pt.y*std::cos(deg));
    }
    P centroid{0,0};double lowY=boundary.front().y,highY=lowY;
    for (auto pt:boundary) {
      centroid.x+=pt.x;centroid.y+=pt.y;
      lowY=std::min(lowY,pt.y); highY=std::max(highY,pt.y);
    }
    centroid.x/=boundary.size();centroid.y/=boundary.size();
    const auto half=std::max(2.,(highY-lowY)*.28);
    const auto grain=value(*p,"grainAngleDeg")*3.14159265358979323846/180.;
    P delta{std::sin(grain)*half,std::cos(grain)*half};
    auto t=[&](P pt){return transform(pt,deg,rawMinX,rawMinY,value(placement,"x"),value(placement,"y"));};
    Overlay o{t({centroid.x-delta.x,centroid.y-delta.y}),t({centroid.x+delta.x,centroid.y+delta.y}),{}};
    if (p->contains("notches") && (*p)["notches"].is_array()) {
      const auto& pts=(*p)["points"];
      for (const auto& notch:(*p)["notches"]) {
        const double edge=value(notch,"edgeIndex",NAN);
        if (!std::isfinite(edge)||edge<0||std::floor(edge)!=edge||edge>=pts.size()) continue;
        const auto i=static_cast<std::size_t>(edge);
        auto a=point(pts[i]),b=point(pts[(i+1)%pts.size()]);
        auto curve= p->value("curves",Json::object());
        const std::string key=std::to_string(i);
        bool curved=curve.is_object()&&curve.contains(key)&&curve[key].is_object();
        P control=curved?P{value(curve[key],"cx"),value(curve[key],"cy")}:a;
        double edgeLen=0;
        P prev=a;
        const int slices=curved?256:1;
        for (int k=1;k<=slices;++k) {
          P now=curved?quad(a,control,b,static_cast<double>(k)/slices):b;
          edgeLen+=std::hypot(now.x-prev.x,now.y-prev.y);prev=now;
        }
        const double gap=std::min(.045,.38/std::max(.1,edgeLen));
        const double target=value(notch,"t",.5),depth=value(notch,"depthCm",.45);
        const auto type=string(notch,"type");
        std::vector<double> fractions=type=="double"?std::vector<double>{target-gap,target+gap}:std::vector<double>{target};
        for (auto fraction:fractions) {
          fraction=std::clamp(fraction,0.,1.);
          double at=fraction;
          if (curved) {
            double total=0;P last=a;
            for (int k=1;k<=256;++k) {
              const double next=static_cast<double>(k)/256;
              P current=quad(a,control,b,next);
              const double distance=std::hypot(current.x-last.x,current.y-last.y);
              if (total+distance>=fraction*edgeLen) {
                at=(k-1+(distance>0?(fraction*edgeLen-total)/distance:0))/256.;
                break;
              }
              total+=distance;last=current;
            }
          }
          const P center=curved?quad(a,control,b,at):P{a.x+(b.x-a.x)*at,a.y+(b.y-a.y)*at};
          P tangent=curved?P{2*(1-at)*(control.x-a.x)+2*at*(b.x-control.x),
                               2*(1-at)*(control.y-a.y)+2*at*(b.y-control.y)}:P{b.x-a.x,b.y-a.y};
          const double mag=std::hypot(tangent.x,tangent.y);
          if (mag<=0) continue;
          P normal{-tangent.y/mag,tangent.x/mag};
          o.notches.emplace_back(t({center.x-normal.x*depth*.15,center.y-normal.y*depth*.15}),
                                 t({center.x+normal.x*depth,center.y+normal.y*depth}));
        }
      }
    }
    out.push_back(std::move(o));
  }
  return out;
}
}
std::string markerToPdf(const Json& marker,const std::string& size,double pageLengthCm,const Json& project) {
  const double width=value(marker,"width",NAN),length=value(marker,"length",NAN);
  if (!std::isfinite(width)||width<=0||!std::isfinite(length)||length<=0)
    throw std::invalid_argument("Cannot print an empty or invalid marker");
  const double maxPage=std::min(400.,std::max(10.,std::isfinite(pageLengthCm)&&pageLengthCm!=0?pageLengthCm:400.));
  const auto count=static_cast<std::size_t>(std::ceil(length/maxPage));
  if (count>100000) throw std::invalid_argument("too many marker PDF pages");
  const auto overlay=overlays(marker,project);
  std::vector<std::string> objects(4+count*2);
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  objects[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  std::string refs;
  const Json empty=Json::array();
  const Json& placements=marker.contains("placements")&&marker["placements"].is_array()?marker["placements"]:empty;
  for (std::size_t index=0;index<count;++index) {
    const double start=index*maxPage,end=std::min(length,start+maxPage);
    const double h=std::max(1.,end-start),wpt=width*kPt,hpt=h*kPt;
    std::string content="q\n0 0 "+n(wpt)+" "+n(hpt)+" re W n\n0 G\n0.45 w\n0 0 "+n(wpt)+" "+n(hpt)+" re S\n";
    for (const auto& placement:placements) {
      const auto& outline=placement.contains("outline") && placement["outline"].is_array()?placement["outline"]:empty;
      if (outline.size()<3 || value(placement,"y")+value(placement,"height")<start || value(placement,"y")>end) continue;
      for (std::size_t j=0;j<outline.size();++j) {
        const auto p=point(outline[j]);
        content+=n(p.x*kPt)+" "+n((h-(p.y-start))*kPt)+(j?" l\n":" m\n");
      }
      content+="h S\n";
      if (value(placement,"y")+1.5>=start && value(placement,"y")+1.5<=end) {
        content+="BT /F1 9 Tf "+n((value(placement,"x")+.5)*kPt)+" "+
          n((h-(value(placement,"y")+1.5-start))*kPt)+" Td ("+
          escape(string(placement,"name")+" / "+size+" / "+n(value(placement,"instance")+1))+") Tj ET\n";
      }
    }
    for (const auto& o:overlay) {
      content+="[4 3] 0 d 0.5 w\n"+line(o.grainA,o.grainB,start,h)+"[] 0 d\n";
      for (const auto& notch:o.notches) content+=line(notch.first,notch.second,start,h);
    }
    content+="Q\n";
    const std::size_t pageNum=4+index*2;
    refs+=std::to_string(pageNum)+" 0 R"+(index+1<count?" ":"");
    objects[pageNum]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+n(wpt)+" "+n(hpt)+
      "] /Resources << /Font << /F1 3 0 R >> >> /Contents "+std::to_string(pageNum+1)+" 0 R >>";
    objects[pageNum+1]="<< /Length "+std::to_string(content.size())+" >>\nstream\n"+content+"endstream";
  }
  objects[2]="<< /Type /Pages /Kids ["+refs+"] /Count "+std::to_string(count)+" >>";
  std::string pdf="%PDF-1.4\n%Garment Studio marker plot\n";
  std::vector<std::size_t> offsets(objects.size());
  for (std::size_t i=1;i<objects.size();++i) {
    offsets[i]=pdf.size();
    pdf+=std::to_string(i)+" 0 obj\n"+objects[i]+"\nendobj\n";
  }
  const auto xref=pdf.size();
  pdf+="xref\n0 "+std::to_string(objects.size())+"\n0000000000 65535 f \n";
  for (std::size_t i=1;i<objects.size();++i) {
    std::ostringstream o; o<<std::setfill('0')<<std::setw(10)<<offsets[i];
    pdf+=o.str()+" 00000 n \n";
  }
  pdf+="trailer\n<< /Size "+std::to_string(objects.size())+" /Root 1 0 R >>\nstartxref\n"+
    std::to_string(xref)+"\n%%EOF\n";
  return pdf;
}
}
