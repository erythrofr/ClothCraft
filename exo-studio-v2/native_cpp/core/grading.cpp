#include "grading.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {

const std::vector<std::string> kDefaultSizes = {"XS", "S", "M", "L", "XL", "XXL"};

double number(const Json& input, const char* name) {
  if (!input.is_number()) throw std::invalid_argument(std::string(name) + " must be numeric");
  double n = input.get<double>();
  if (!std::isfinite(n) || std::abs(n) > 100000.)
    throw std::invalid_argument(std::string(name) + " must be a finite cm measurement");
  return n;
}

double setting(const Json& object, const char* key, double fallback) {
  if (!object.is_object() || !object.contains(key) || object.at(key).is_null()) return fallback;
  return number(object.at(key), key);
}

std::vector<std::string> sizesFrom(const Json& grading) {
  if (!grading.is_object() || !grading.contains("sizes") || grading.at("sizes").is_null() ||
      (grading.at("sizes").is_array() && grading.at("sizes").empty())) return kDefaultSizes;
  const auto& raw = grading.at("sizes");
  if (!raw.is_array() || raw.size() > 64) throw std::invalid_argument("grading.sizes must be an array of at most 64 distinct sizes");
  std::vector<std::string> sizes;
  for (const auto& value : raw) {
    if (!value.is_string()) throw std::invalid_argument("grading.sizes entries must be strings");
    const auto name = value.get<std::string>();
    if (name.empty() || name.size() > 64 || std::find(sizes.begin(),sizes.end(),name) != sizes.end())
      throw std::invalid_argument("grading sizes must be nonempty and distinct");
    sizes.push_back(name);
  }
  return sizes;
}

int stepFor(const Json& grading, const std::string& size) {
  const auto sizes = sizesFrom(grading);
  const auto base = grading.is_object() ? grading.value("baseSize",std::string("M")) : std::string("M");
  auto baseIt=std::find(sizes.begin(),sizes.end(),base);
  auto sizeIt=std::find(sizes.begin(),sizes.end(),size);
  if (sizeIt == sizes.end()) throw std::invalid_argument("size not found in grading.sizes: " + size);
  if (baseIt == sizes.end()) throw std::invalid_argument("grading.baseSize not found in grading.sizes");
  return static_cast<int>(sizeIt-sizes.begin())-static_cast<int>(baseIt-sizes.begin());
}

struct Bounds {double minX, maxX, minY, maxY;};

Bounds bounds(const Json& piece) {
  const auto& pts = piece.at("points");
  Bounds b{std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity(),
           std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity()};
  for (const auto& p : pts) {
    const double x=number(p.at("x"),"x"), y=number(p.at("y"),"y");
    b.minX=std::min(b.minX,x); b.maxX=std::max(b.maxX,x);
    b.minY=std::min(b.minY,y); b.maxY=std::max(b.maxY,y);
  }
  return b;
}

void scaleXY(Json& pt, double x, double y) {
  if (!pt.is_object()) throw std::invalid_argument("grade point must be an object");
  if (!std::isfinite(x) || !std::isfinite(y) || std::abs(x)>100000 || std::abs(y)>100000)
    throw std::invalid_argument("graded point exceeds finite 100000 cm bounds");
  pt["x"]=x; pt["y"]=y;
}

Json affinePoint(Json p, double sx, double sy) {
  scaleXY(p,number(p.at("x"),"x")*sx,number(p.at("y"),"y")*sy);
  return p;
}

Json generalPoint(Json p, const Bounds& b, int offset, double width, double length) {
  if (!offset) return p;
  const double x=number(p.at("x"),"x"), y=number(p.at("y"),"y");
  const double centerX=(b.minX+b.maxX)*.5;
  const double height=std::max(1.,b.maxY-b.minY);
  const double normalizedY=(y-b.minY)/height;
  const double side=(x>centerX?1.:(x<centerX?-1.:0.));
  double newX=x+side*(width*offset*.5)*(.55+.45*(1.-normalizedY));
  double newY=y-length*offset*(1.-normalizedY);
  if (p.contains("gradeRule") && p.at("gradeRule").is_object() &&
      p.at("gradeRule").value("enabled",false)) {
    const auto& rule=p.at("gradeRule");
    if (rule.contains("dxPerSize") && !rule.at("dxPerSize").is_null())
      newX=x+number(rule.at("dxPerSize"),"dxPerSize")*offset;
    else if (rule.contains("dxPerSize") && rule.at("dxPerSize").is_null()) newX=x;
    if (rule.contains("dyPerSize") && !rule.at("dyPerSize").is_null())
      newY=y+number(rule.at("dyPerSize"),"dyPerSize")*offset;
    else if (rule.contains("dyPerSize") && rule.at("dyPerSize").is_null()) newY=y;
  }
  scaleXY(p,newX,newY);
  return p;
}

template <typename Transform>
void scaleDecorations(Json& piece, const Json& original, const Transform& transform) {
  if (original.contains("curves") && original.at("curves").is_object()) {
    for (auto it=piece["curves"].begin(); it!=piece["curves"].end(); ++it) {
      if (!it.value().is_object()) continue;
      Json ctrl={{"x",it.value().at("cx")},{"y",it.value().at("cy")}};
      ctrl=transform(ctrl);
      it.value()["cx"]=ctrl.at("x"); it.value()["cy"]=ctrl.at("y");
    }
  }
  if (piece.contains("internalLines") && piece.at("internalLines").is_array()) {
    for (auto& line : piece["internalLines"]) {
      if (!line.is_object()) continue;
      for (const char* end : {"a","b"})
        if (line.contains(end) && line.at(end).is_object()) line[end]=transform(line.at(end));
    }
  }
}

// Same adaptive quadratic arc length as JS draftingPrecision.js, used by the
// legacy seam-locked T-shirt curve fitting. Only stitchline geometry changes.
double quadraticLength(const Json& piece, std::size_t edge) {
  const auto& pts=piece.at("points");
  const auto& p=pts.at(edge), &q=pts.at((edge+1)%pts.size());
  const double ax=number(p.at("x"),"x"), ay=number(p.at("y"),"y");
  const double bx=number(q.at("x"),"x"), by=number(q.at("y"),"y");
  const std::string key=std::to_string(edge);
  if (!piece.contains("curves") || !piece.at("curves").is_object() ||
      !piece.at("curves").contains(key) || piece.at("curves").at(key).is_null())
    return std::hypot(bx-ax,by-ay);
  const auto& control=piece.at("curves").at(key);
  const double cx=number(control.at("cx"),"cx"), cy=number(control.at("cy"),"cy");
  auto f=[=](double t){return 2*std::hypot((1-t)*(cx-ax)+t*(bx-cx),(1-t)*(cy-ay)+t*(by-cy));};
  auto simpson=[](double a,double b,double fa,double fm,double fb){return (b-a)*(fa+4*fm+fb)/6;};
  auto recurse=[&](const auto& self,double a,double b,double fa,double fm,double fb,
                   double total,double epsilon,int depth)->double {
    double m=(a+b)*.5, l=(a+m)*.5, r=(m+b)*.5;
    double fl=f(l), fr=f(r);
    double left=simpson(a,m,fa,fl,fm),right=simpson(m,b,fm,fr,fb);
    if (!depth || std::abs(left+right-total)<=15*epsilon)
      return left+right+(left+right-total)/15;
    return self(self,a,m,fa,fl,fm,left,epsilon*.5,depth-1)+
           self(self,m,b,fm,fr,fb,right,epsilon*.5,depth-1);
  };
  const double fa=f(0), fm=f(.5), fb=f(1);
  return recurse(recurse,0,1,fa,fm,fb,simpson(0,1,fa,fm,fb),1e-7,18);
}

void fitGradedSleeveArc(Json& sleeve, int edge, double target, double cxPreferred, double cyPreferred) {
  double bestCost=std::numeric_limits<double>::infinity();
  double bestCx=cxPreferred, bestCy=cyPreferred;
  auto evaluate=[&](double cx,double cy) {
    sleeve["curves"][std::to_string(edge)]={{"cx",cx},{"cy",cy}};
    double difference=quadraticLength(sleeve,static_cast<std::size_t>(edge))-target;
    double cost=std::abs(difference)*400+std::hypot(cx-cxPreferred,cy-cyPreferred)*.07;
    if (cost<bestCost) {bestCost=cost;bestCx=cx;bestCy=cy;}
    return difference;
  };
  for (int col=-7;col<=7;++col) {
    double cx=cxPreferred+col*.35;
    bool hasPrior=false;double oldCy=0, oldDiff=0;
    for (int row=-30;row<=30;++row) {
      double cy=cyPreferred+row*.25;
      double diff=evaluate(cx,cy);
      if (hasPrior && oldDiff*diff<0) {
        double lo=oldCy, hi=cy, flo=oldDiff;
        for (int i=0;i<19;++i) {
          double mid=(lo+hi)*.5, fmid=evaluate(cx,mid);
          if (fmid*flo<=0) hi=mid;
          else {lo=mid;flo=fmid;}
        }
      }
      hasPrior=true;oldCy=cy;oldDiff=diff;
    }
  }
  sleeve["curves"][std::to_string(edge)]={{"cx",bestCx},{"cy",bestCy}};
}

const Json* findPiece(const Json& pieces,const std::string& name) {
  for (const auto& p: pieces)
    if (p.is_object() && p.value("id",std::string())==name) return &p;
  return nullptr;
}

Json* findPiece(Json& pieces,const std::string& name) {
  for (auto& p: pieces)
    if (p.is_object() && p.value("id",std::string())==name) return &p;
  return nullptr;
}

} // namespace

Json gradeProject(const Document& document, const std::string& size) {
  const auto& input=document.data();
  const Json grading=input.value("grading",Json::object());
  const int offset=stepFor(grading,size);
  bool hasExplicitRules=false;
  for (const auto& piece: input.at("pieces"))
    for (const auto& p:piece.at("points"))
      if (p.contains("gradeRule") && p.at("gradeRule").is_object() &&
          p.at("gradeRule").value("enabled",false)) hasExplicitRules=true;
  const Json production=input.value("productionSpec",Json::object());
  const bool special=production.is_object() &&
    production.value("gradingModel",std::string())=="seam-locked-affine-v1" && !hasExplicitRules;
  Json result=input;
  result["previewSize"]=size;
  if (special) {
    const double width=setting(grading,"widthPerSizeCm",3);
    const double length=setting(grading,"lengthPerSizeCm",1.2);
    const double referenceWidth=std::max(1.,setting(production,"referenceHalfChestCm",54));
    const double referenceLength=std::max(1.,setting(production,"referenceBodyLengthCm",71));
    const double sx=1+offset*width/referenceWidth, sy=1+offset*length/referenceLength;
    if (!(sx>.4 && sy>.4)) throw std::invalid_argument("Unsupported T-shirt grading factors");
    for (auto& piece:result["pieces"]) {
      for (auto& p:piece["points"]) p=affinePoint(p,sx,sy);
      scaleDecorations(piece,piece,[&](Json pt){return affinePoint(pt,sx,sy);});
      piece["gradeSize"]=size;
    }
    if (offset) {
      auto* front=findPiece(result["pieces"],"front");
      const auto* sourceSleeve=findPiece(input.at("pieces"),"sleeve-left");
      auto* left=findPiece(result["pieces"],"sleeve-left");
      auto* right=findPiece(result["pieces"],"sleeve-right");
      if (front && left && right && sourceSleeve &&
          left->at("points").size()==7 && right->at("points").size()==7) {
        const double upper=quadraticLength(*front,1), lower=quadraticLength(*front,2);
        const double capRise=(number(sourceSleeve->at("points")[0].at("y"),"y")-
                             number(sourceSleeve->at("points")[1].at("y"),"y"))*sy;
        const double capWidth=std::sqrt(std::max(0.,upper*upper-capRise*capRise))-.2;
        const double underarmWidth=17.25+offset*.5;
        for (auto* sleeve:{left,right}) {
          auto& pts=(*sleeve)["points"];
          pts[1]["x"]=-capWidth;pts[6]["x"]=capWidth;
          pts[2]["x"]=-underarmWidth;pts[5]["x"]=underarmWidth;
          fitGradedSleeveArc(*sleeve,0,upper,-capWidth*.55,23.5*sy);
          fitGradedSleeveArc(*sleeve,1,lower,-underarmWidth+.75,22*sy);
          (*sleeve)["curves"]["6"]={{"cx",-number((*sleeve)["curves"]["0"]["cx"],"cx")},
                                    {"cy",number((*sleeve)["curves"]["0"]["cy"],"cy")}};
          (*sleeve)["curves"]["5"]={{"cx",-number((*sleeve)["curves"]["1"]["cx"],"cx")},
                                    {"cy",number((*sleeve)["curves"]["1"]["cy"],"cy")}};
        }
      }
    }
    if (result.contains("customMeasurements") && result.at("customMeasurements").is_array())
      for (auto& measure:result["customMeasurements"])
        for (const char* end:{"a","b"})
          if (measure.contains(end) && measure.at(end).is_object())
            measure[end]=affinePoint(measure[end],sx,sy);
  } else {
    const double width=setting(grading,"widthPerSizeCm",3);
    const double length=setting(grading,"lengthPerSizeCm",1.2);
    for (auto& piece:result["pieces"]) {
      const Bounds b=bounds(piece);
      if (offset) {
        for (auto& pt:piece["points"]) pt=generalPoint(pt,b,offset,width,length);
        scaleDecorations(piece,piece,[&](Json pt){return generalPoint(pt,b,offset,width,length);});
        piece["gradeSize"]=size;
      }
    }
    if (result.contains("customMeasurements") && result.at("customMeasurements").is_array()) {
      for (auto& measure:result["customMeasurements"]) {
        if (!measure.is_object() || !measure.contains("pieceId") || !measure.at("pieceId").is_string()) continue;
        const Json* source=findPiece(input.at("pieces"),measure.at("pieceId").get<std::string>());
        if (!source) continue;
        const Bounds b=bounds(*source);
        for (const char* end:{"a","b"})
          if (measure.contains(end) && measure.at(end).is_object())
            measure[end]=generalPoint(measure[end],b,offset,width,length);
      }
    }
  }
  // Validate the entire assembled result; copy-on-write guarantees that a bad
  // size/rule never mutates the source or yields a partially generated size.
  Document checked(result);
  return checked.data();
}

Json gradeSizeRun(const Document& document) {
  const auto grading=document.data().value("grading",Json::object());
  Json run=Json::object();
  for (const auto& size:sizesFrom(grading)) run[size]=gradeProject(document,size);
  return run;
}

} // namespace garment
