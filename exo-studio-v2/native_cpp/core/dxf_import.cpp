#include "dxf_import.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <map>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace garment {
namespace {

struct Pair {int code; std::string value;};
struct Entity {
  std::string type, layer;
  std::vector<Point2> points;
  Point2 a, b;
  bool closed=false;
};

std::string token(const std::string& s) {
  std::string out;
  for (auto ch:s) {
    const auto c=static_cast<unsigned char>(ch);
    out+=std::isalnum(c) || c=='_' || c=='-' ? static_cast<char>(std::toupper(c)):'_';
    if (out.size()==48) break;
  }
  return out.empty()?"PATTERN":out;
}

std::string trim(std::string s) {
  const auto first=s.find_first_not_of(" \t\r\n");
  if (first==std::string::npos) return "";
  const auto last=s.find_last_not_of(" \t\r\n");
  return s.substr(first,last-first+1);
}

std::string upper(std::string s) {
  for (char& c:s) c=static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
  return s;
}

bool begins(const std::string& s,const char* prefix) {
  return upper(s).rfind(prefix,0)==0;
}

bool ignoredLayer(const std::string& layer) {
  for (const char* prefix:{"SA_","NOTCH_","GRAIN_","LABEL_","INTERNAL_","DART_","DART_CENTER"})
    if (begins(layer,prefix)) return true;
  return false;
}

std::vector<Pair> parsePairs(const std::string& source) {
  if (source.size()>24*1024*1024) throw std::invalid_argument("DXF exceeds 24 MiB safety limit");
  std::vector<Pair> pairs;
  std::size_t cursor=0;
  auto next=[&](std::string& line)->bool {
    if (cursor>=source.size()) return false;
    auto end=source.find('\n',cursor);
    if (end==std::string::npos) end=source.size();
    line=trim(source.substr(cursor,end-cursor));
    cursor=end==source.size()?source.size():end+1;
    return true;
  };
  std::string code,value;
  while (next(code) && next(value)) {
    int c=0;
    try {
      std::size_t used=0;
      c=std::stoi(code,&used);
      if (used!=code.size()) continue;
    } catch(const std::exception&) {continue;}
    pairs.push_back({c,std::move(value)});
    if (pairs.size()>2000000) throw std::invalid_argument("DXF contains too many code pairs");
  }
  return pairs;
}

double parseDouble(const std::string& text) {
  if (text.empty()) return std::numeric_limits<double>::quiet_NaN();
  std::size_t used=0;
  try {
    const double result=std::stod(text,&used);
    if (used==text.size() && std::isfinite(result) && std::abs(result)<1e9) return result;
  } catch (const std::exception&) {}
  return std::numeric_limits<double>::quiet_NaN();
}

int parseInt(const std::string& text,int fallback=0) {
  try { std::size_t used=0;const int n=std::stoi(text,&used); if(used==text.size()) return n;}
  catch (const std::exception&) {}
  return fallback;
}

std::string first(const std::vector<Pair>& data,int code,const std::string& fallback="") {
  for (const auto& entry:data) if(entry.code==code) return entry.value;
  return fallback;
}

bool getPoint(const std::vector<Pair>& data,int cx,int cy,Point2& out) {
  const auto x=parseDouble(first(data,cx)),y=parseDouble(first(data,cy));
  if (!std::isfinite(x) || !std::isfinite(y)) return false;
  out={x,y};return true;
}

double sourceScale(const std::vector<Pair>& pairs) {
  int units=-1,metric=-1;
  for (std::size_t i=0;i<pairs.size();++i) {
    if (pairs[i].code!=9) continue;
    if (pairs[i].value!="$INSUNITS" && pairs[i].value!="$MEASUREMENT") continue;
    int data=-1;
    for (std::size_t k=i+1;k<std::min(pairs.size(),i+5);++k)
      if (pairs[k].code==70) {data=parseInt(pairs[k].value,-1);break;}
    if (pairs[i].value=="$INSUNITS") units=data;
    else metric=data;
  }
  switch(units) {
    case 1:return 2.54;
    case 2:return 30.48;
    case 4:return .1;
    case 5:return 1.;
    case 6:return 100.;
    default:return metric==0?2.54:.1;
  }
}

std::vector<Entity> collectEntities(const std::vector<Pair>& pairs) {
  std::vector<Entity> entities;
  std::size_t i=0;
  while (i<pairs.size()) {
    if (pairs[i].code!=0) {++i;continue;}
    const std::string type=upper(pairs[i].value);
    ++i;
    std::vector<Pair> properties;
    while(i<pairs.size() && pairs[i].code!=0) properties.push_back(pairs[i++]);
    if (type=="POLYLINE") {
      Entity e;
      e.type=type;
      e.layer=first(properties,8,"0");
      e.closed=(parseInt(first(properties,70))&1)!=0;
      while (i<pairs.size() && pairs[i].code==0 && upper(pairs[i].value)=="VERTEX") {
        ++i;
        std::vector<Pair> vertex;
        while (i<pairs.size() && pairs[i].code!=0) vertex.push_back(pairs[i++]);
        Point2 p;
        if (getPoint(vertex,10,20,p)) e.points.push_back(p);
        if (e.points.size()>100000) throw std::invalid_argument("DXF polyline exceeds vertex limit");
      }
      if (i<pairs.size() && pairs[i].code==0 && upper(pairs[i].value)=="SEQEND") {
        ++i;
        while (i<pairs.size() && pairs[i].code!=0) ++i;
      }
      entities.push_back(std::move(e));
    } else if (type=="LWPOLYLINE") {
      Entity e;
      e.type=type;
      e.layer=first(properties,8,"0");
      e.closed=(parseInt(first(properties,70))&1)!=0;
      double pendingX=std::numeric_limits<double>::quiet_NaN();
      for (const auto& data:properties) {
        if (data.code==10) pendingX=parseDouble(data.value);
        if (data.code==20 && std::isfinite(pendingX)) {
          const double y=parseDouble(data.value);
          if (std::isfinite(y)) e.points.push_back({pendingX,y});
          pendingX=std::numeric_limits<double>::quiet_NaN();
        }
      }
      if (e.points.size()>100000) throw std::invalid_argument("DXF polyline exceeds vertex limit");
      entities.push_back(std::move(e));
    } else if (type=="LINE") {
      Entity e;e.type=type;e.layer=first(properties,8,"0");
      if (getPoint(properties,10,20,e.a) && getPoint(properties,11,21,e.b)) entities.push_back(std::move(e));
    } else if (type=="TEXT" || type=="MTEXT") {
      Entity e;e.type=type;e.layer=first(properties,8,"0");
      entities.push_back(std::move(e));
    }
    if (entities.size()>100000) throw std::invalid_argument("DXF contains too many entities");
  }
  return entities;
}

double distance(const Point2& a,const Point2& b) {return std::hypot(a.x-b.x,a.y-b.y);}

std::vector<Entity> closedOutlines(const std::vector<Entity>& entities) {
  std::vector<Entity> closed;
  std::map<std::string,std::vector<Entity>> lineGroups;
  for (const auto& e:entities) {
    if ((e.type=="POLYLINE" || e.type=="LWPOLYLINE") && e.closed &&
        e.points.size()>=3 && !ignoredLayer(e.layer)) closed.push_back(e);
    if (e.type=="LINE" && !ignoredLayer(e.layer)) lineGroups[e.layer].push_back(e);
  }
  for (auto& kv:lineGroups) {
    auto& lines=kv.second;
    while (!lines.empty()) {
      auto seed=lines.front();lines.erase(lines.begin());
      std::vector<Point2> points={seed.a,seed.b};
      int guard=0;
      while (!lines.empty() && guard++<10000) {
        const auto end=points.back();
        auto it=std::find_if(lines.begin(),lines.end(),[&](const Entity& e){
          return distance(e.a,end)<=.75 || distance(e.b,end)<=.75;
        });
        if (it==lines.end()) break;
        const auto a=it->a,b=it->b;
        points.push_back(distance(a,end)<=.75?b:a);
        lines.erase(it);
        if (points.size()>=4 && distance(points.front(),points.back())<=.75) break;
      }
      if (points.size()>=4 && distance(points.front(),points.back())<=.75) {
        points.pop_back();
        Entity e;e.type="LINE_LOOP";e.layer=kv.first;e.closed=true;e.points=std::move(points);
        closed.push_back(std::move(e));
      }
    }
  }
  return closed;
}

std::string title(const std::string& layer,std::size_t index) {
  auto s=layer;
  if (begins(s,"CUT_")) s=s.substr(4);
  for (const char* ending:{"_XXL","_XL","_BASE","_XS","_S","_M","_L"}) {
    const auto len=std::strlen(ending);
    if (s.size()>=len && upper(s.substr(s.size()-len))==ending) {s.resize(s.size()-len);break;}
  }
  for (char& c:s) if (c=='_'||c=='-') c=' ';
  s=trim(s);
  if (s.empty() || s=="0") return "Imported Pattern "+std::to_string(index+1);
  bool boundary=true;
  for (char& c:s) {
    const auto byte=static_cast<unsigned char>(c);
    if (boundary && std::isalpha(byte)) c=static_cast<char>(std::toupper(byte));
    boundary=std::isspace(byte)!=0;
  }
  return s;
}

} // namespace

Json importDxfPatterns(const std::string& text,double overrideScaleCm) {
  const auto pairs=parsePairs(text);
  const auto entities=collectEntities(pairs);
  const double scale=overrideScaleCm>0?overrideScaleCm:sourceScale(pairs);
  if (!std::isfinite(scale) || scale<=0 || scale>1000)
    throw std::invalid_argument("invalid DXF unit scale");
  const auto closed=closedOutlines(entities);
  if (closed.empty()) throw std::invalid_argument("No closed pattern outlines were found in the DXF.");
  if (closed.size()>512) throw std::invalid_argument("DXF exceeds the 512 pattern limit");
  Json pieces=Json::array();
  struct Origin {double minX=0,minY=0,width=0;std::string layer,sourceToken;};
  std::vector<Origin> origins;
  double cursorX=58,cursorY=120,rowHeight=0;
  for (std::size_t i=0;i<closed.size();++i) {
    const auto& e=closed[i];
    double minX=std::numeric_limits<double>::infinity();
    double maxX=-minX,minY=minX,maxY=-minX;
    for (const auto& p:e.points) {
      minX=std::min(minX,p.x*scale);maxX=std::max(maxX,p.x*scale);
      minY=std::min(minY,p.y*scale);maxY=std::max(maxY,p.y*scale);
    }
    const auto centerX=(minX+maxX)*.5;
    const auto width=maxX-minX,height=maxY-minY;
    Json points=Json::array();
    for (const auto& p:e.points) points.push_back({{"x",p.x*scale-centerX},{"y",p.y*scale-minY}});
    if (cursorX+width*.5>310) {cursorX=58;cursorY+=rowHeight+32;rowHeight=0;}
    const auto name=title(e.layer,i);
    const auto id="imported-"+std::to_string(i+1);
    std::string sourceToken=e.layer;
    if (begins(sourceToken,"CUT_")) sourceToken=sourceToken.substr(4);
    if (auto pos=sourceToken.find_last_of('_');pos!=std::string::npos)
      sourceToken.resize(pos);
    origins.push_back({minX,minY,width,e.layer,sourceToken});
    pieces.push_back({{"id",id},{"name",name},{"sourceLayer",e.layer},
      {"points",points},{"curves",Json::object()},
      {"internalLines",Json::array()},{"notches",Json::array()},
      {"buttonholes",Json::array()},
      {"layout2d",{{"x",cursorX+width*.5},{"y",cursorY}}},
      {"arrangement3d",{{"x",(static_cast<int>(i)%3-1)*.7},
                         {"y",.75+static_cast<int>(i/3)*.12},{"z",-.65},{"flip",false}}},
      {"grainAngleDeg",0},{"seamAllowance",1},{"fabricId","main"},{"locked",false}});
    cursorX+=width+24;
    rowHeight=std::max(rowHeight,height);
  }
  // Reconstruct supported drafting annotations from the accompanying R12
  // layers. This does NOT reconstruct a native ASTM sewing graph.
  const auto findForLayer=[&](const std::string& layer,const std::string& prefix)->int {
    auto wanted=layer;
    if (begins(wanted,prefix.c_str())) wanted=wanted.substr(prefix.size());
    const auto key=token(wanted);
    for (std::size_t i=0;i<origins.size();++i) {
      const auto& origin=origins[i];
      const auto candidateName=token(pieces[i].at("name").get<std::string>());
      if (token(origin.sourceToken)==key || candidateName==key ||
          token(origin.layer).find(key)!=std::string::npos ||
          key.find(candidateName)!=std::string::npos) return static_cast<int>(i);
    }
    return -1;
  };
  for (const auto& entity:entities) {
    if (entity.type!="LINE") continue;
    const auto layer=upper(entity.layer);
    const bool notch=begins(layer,"NOTCH_");
    const bool buttonhole=begins(layer,"BUTTONHOLE_");
    const bool grain=begins(layer,"GRAIN_");
    const bool internal=begins(layer,"INTERNAL_") || begins(layer,"DART_");
    if (!notch && !buttonhole && !grain && !internal) continue;
    int index=-1;
    if (notch) index=findForLayer(layer,"NOTCH_");
    if (buttonhole) index=findForLayer(layer,"BUTTONHOLE_");
    if (grain) index=findForLayer(layer,"GRAIN_");
    if (internal) {
      for (std::size_t i=0;i<origins.size();++i)
        if (token(layer).find(token(pieces[i].at("name").get<std::string>()))!=std::string::npos) {
          index=static_cast<int>(i);break;
        }
    }
    if (index<0) continue;
    auto& piece=pieces[static_cast<std::size_t>(index)];
    const auto& origin=origins[static_cast<std::size_t>(index)];
    auto local=[&](const Point2& p)->Point2 {
      return {p.x*scale-(origin.minX+origin.width*.5),p.y*scale-origin.minY};
    };
    if (grain) {
      piece["grainAngleDeg"]=std::atan2(entity.b.x-entity.a.x,entity.b.y-entity.a.y)*180./3.14159265358979323846;
      continue;
    }
    if (buttonhole) {
      const auto a=local(entity.a),b=local(entity.b);
      const auto dx=b.x-a.x,dy=b.y-a.y;
      piece["buttonholes"].push_back({
        {"id","import-buttonhole-"+std::to_string(piece["buttonholes"].size()+1)},
        {"x",(a.x+b.x)*.5},{"y",(a.y+b.y)*.5},
        {"lengthCm",std::hypot(dx,dy)},{"widthCm",.35},
        {"orientationDeg",std::atan2(dy,dx)*180./3.14159265358979323846},
        {"color","#575757"}});
    } else if (notch) {
      const auto middle=local({(entity.a.x+entity.b.x)*.5,(entity.a.y+entity.b.y)*.5});
      const auto& pts=piece.at("points");
      double closest=std::numeric_limits<double>::infinity(),nearestT=0;
      std::size_t edgeIndex=0;
      for (std::size_t edge=0;edge<pts.size();++edge) {
        const auto& p=pts[edge],&q=pts[(edge+1)%pts.size()];
        Point2 a{p.at("x").get<double>(),p.at("y").get<double>()};
        Point2 b{q.at("x").get<double>(),q.at("y").get<double>()};
        const auto dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
        const auto t=std::max(0.,std::min(1.,((middle.x-a.x)*dx+(middle.y-a.y)*dy)/(len>0?len:1.)));
        const double d=std::hypot(middle.x-(a.x+dx*t),middle.y-(a.y+dy*t));
        if (d<closest) {closest=d;nearestT=t;edgeIndex=edge;}
      }
      if (closest<1.5) {
        bool duplicate=false;
        for (auto& mark:piece["notches"]) {
          if (mark.at("edgeIndex").get<std::size_t>()==edgeIndex &&
              std::abs(mark.at("t").get<double>()-nearestT)<.08) {
            mark["type"]="double";duplicate=true;break;
          }
        }
        if (!duplicate) piece["notches"].push_back({
          {"id","import-notch-"+std::to_string(piece["notches"].size()+1)},
          {"edgeIndex",edgeIndex},{"t",nearestT},{"type","single"},{"depthCm",.45}});
      }
    } else if (internal) {
      const auto type=layer.find("DART")!=std::string::npos?"dart":
        layer.find("FOLD")!=std::string::npos?"fold":"construction";
      const auto a=local(entity.a),b=local(entity.b);
      Json line={{"id","import-internal-"+std::to_string(piece["internalLines"].size()+1)},
                 {"name",std::string("Imported ")+type},{"type",type},
                 {"a",{{"x",a.x},{"y",a.y}}},{"b",{{"x",b.x},{"y",b.y}}}};
      if (std::string(type)=="dart") line["widthCm"]=2.5;
      if (std::string(type)=="fold") line["foldAngleDeg"]=135;
      piece["internalLines"].push_back(std::move(line));
    }
  }
  return {{"pieces",pieces},{"scaleToCm",scale},{"entityCount",entities.size()},
          {"scope","DXF closed outlines and associated drafting marks; ASTM blocks and sewing graph not reconstructed"}};
}

} // namespace garment
