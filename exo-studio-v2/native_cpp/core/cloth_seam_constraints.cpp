#include "cloth_seam_constraints.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>
#include <functional>
namespace garment {
namespace {
Json get(const Json& j,const char* k,Json fallback=nullptr){return j.is_object()&&j.contains(k)&&!j[k].is_null()?j[k]:fallback;}
double num(const Json& j,double def=0){return j.is_number()?j.get<double>():def;}
double n(const Json& j,const char* k,double d=0){return num(get(j,k),d);}
std::string s(const Json& j,const char* k){auto v=get(j,k);return v.is_string()?v.get<std::string>():"";}
Json array(const Json& j,const char* k){auto v=get(j,k);return v.is_array()?v:Json::array();}
Json object(const Json& j,const char* k){auto v=get(j,k);return v.is_object()?v:Json::object();}
double clamp(double v,double lo,double hi){return std::clamp(v,lo,hi);}
double distance(const Json& a,const Json& b){double sum=0;for(int i=0;i<3;i++){double d=num(a[i])-num(b[i]);sum+=d*d;}return std::sqrt(sum);}
struct XY {double x,y;};
XY xy(const Json& j){return {n(j,"x"),n(j,"y")};}
double length(XY a,XY b){return std::hypot(b.x-a.x,b.y-a.y);}
XY bezier(XY a,XY c,XY b,double t){double u=1-t;return {u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y};}
XY derivative(XY a,XY c,XY b,double t){return {2*((1-t)*(c.x-a.x)+t*(b.x-c.x)),2*((1-t)*(c.y-a.y)+t*(b.y-c.y))};}
double arc(XY a,XY c,XY b,double start=0,double end=1,double tolerance=1e-7){
 double lo=clamp(std::min(start,end),0,1),hi=clamp(std::max(start,end),0,1);if(std::abs(hi-lo)<=1e-9)return 0;
 auto speed=[&](double t){auto d=derivative(a,c,b,t);return std::hypot(d.x,d.y);};
 auto simpson=[](double x,double y,double fx,double fm,double fy){return (y-x)*(fx+4*fm+fy)/6;};
 std::function<double(double,double,double,double,double,double,double,int)> recurse;
 recurse=[&](double x,double y,double fx,double fm,double fy,double integral,double error,int depth){
  double center=(x+y)/2,leftMid=(x+center)/2,rightMid=(center+y)/2,flm=speed(leftMid),frm=speed(rightMid);
  double left=simpson(x,center,fx,flm,fm),right=simpson(center,y,fm,frm,fy);
  if(depth>=20||std::abs(left+right-integral)<=error*15)return left+right+(left+right-integral)/15;
  return recurse(x,center,fx,flm,fm,left,error/2,depth+1)+recurse(center,y,fm,frm,fy,right,error/2,depth+1);
 };
 double fx=speed(lo),fy=speed(hi),fm=speed((lo+hi)/2);
 return recurse(lo,hi,fx,fm,fy,simpson(lo,hi,fx,fm,fy),std::max(1e-11,tolerance),0);
}
Json edgePoints(const Json& piece,int edgeIndex){auto points=array(piece,"points");if(edgeIndex<0||edgeIndex>=int(points.size()))return nullptr;
 auto a=points[edgeIndex],b=points[(edgeIndex+1)%points.size()],curves=object(piece,"curves");auto key=std::to_string(edgeIndex);
 return Json{{"a",a},{"b",b},{"curve",get(curves,key.c_str())}};
}
double authoredEdgeLength(const Json& piece,int edgeIndex){auto e=edgePoints(piece,edgeIndex);if(e.is_null())return 0;
 if(e["curve"].is_object()){auto a=xy(e["a"]),b=xy(e["b"]);XY c{n(e["curve"],"cx"),n(e["curve"],"cy")};return arc(a,c,b);}
 return length(xy(e["a"]),xy(e["b"]));
}
XY edgePoint(const Json& piece,int edgeIndex,double fraction){
 auto e=edgePoints(piece,edgeIndex);if(e.is_null())throw std::runtime_error("invalid authored seam edge");
 XY a=xy(e["a"]),b=xy(e["b"]);double t=clamp(fraction,0,1);
 if(!e["curve"].is_object())return {a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t};
 XY c{n(e["curve"],"cx"),n(e["curve"],"cy")};double total=arc(a,c,b),target=t*total,low=0,high=1;
 if(total<1e-9)return a;
 for(int i=0;i<30;i++){double mid=(low+high)/2;if(arc(a,c,b,0,mid)<target)low=mid;else high=mid;}
 return bezier(a,c,b,t==0?0:t==1?1:(low+high)/2);
}
Json surfaceTarget(const Json& piece,XY target){
 auto flat=array(piece,"flatVertices"),faces=array(piece,"faces");
 for(const auto& face:faces){if(!face.is_array()||face.size()!=3)continue;
  size_t ia=face[0].get<size_t>(),ib=face[1].get<size_t>(),ic=face[2].get<size_t>();
  if(std::max({ia,ib,ic})>=flat.size())continue;
  XY a=xy(flat[ia]),b=xy(flat[ib]),c=xy(flat[ic]);
  double v0x=b.x-a.x,v0y=b.y-a.y,v1x=c.x-a.x,v1y=c.y-a.y,v2x=target.x-a.x,v2y=target.y-a.y,den=v0x*v1y-v1x*v0y;
  if(std::abs(den)<=1e-6)continue;double wb=(v2x*v1y-v1x*v2y)/den,wc=(v0x*v2y-v2x*v0y)/den,wa=1-wb-wc;
  if(wa>=-1e-5&&wb>=-1e-5&&wc>=-1e-5&&wa<=1+1e-5&&wb<=1+1e-5&&wc<=1+1e-5){
   wa=std::max(0.,wa);wb=std::max(0.,wb);wc=std::max(0.,wc);double sum=wa+wb+wc;if(sum==0)sum=1;
   return Json{{"indices",Json::array({ia,ib,ic})},{"weights",Json::array({wa/sum,wb/sum,wc/sum})}};
  }
 }
 double best=1e300;Json candidate=nullptr;std::set<std::pair<size_t,size_t>> seen;
 for(const auto& face:faces){if(!face.is_array()||face.size()!=3)continue;
  for(int side=0;side<3;side++){size_t ia=face[side].get<size_t>(),ib=face[(side+1)%3].get<size_t>();if(ia>=flat.size()||ib>=flat.size())continue;
   if(!seen.insert(std::minmax(ia,ib)).second)continue;auto a=xy(flat[ia]),b=xy(flat[ib]);
   double dx=b.x-a.x,dy=b.y-a.y,ls=dx*dx+dy*dy;if(ls<=1e-6)continue;
   double t=clamp(((target.x-a.x)*dx+(target.y-a.y)*dy)/ls,0,1),x=a.x+dx*t,y=a.y+dy*t,d=(target.x-x)*(target.x-x)+(target.y-y)*(target.y-y);
   if(d<best){best=d;candidate={{"indices",Json::array({ia,ib})},{"weights",Json::array({1-t,t})}};}
  }
 }
 if(!candidate.is_null())return candidate;
 size_t index=0;best=1e300;for(size_t i=0;i<flat.size();i++){auto p=xy(flat[i]);double d=std::hypot(target.x-p.x,target.y-p.y);if(d<best){best=d;index=i;}}
 return Json{{"indices",Json::array({index})},{"weights",Json::array({1})}};
}
size_t strongest(const Json& target){auto indices=target.at("indices"),weights=target.at("weights");size_t winner=0;double best=-1;for(size_t i=0;i<weights.size();i++){double w=num(weights[i]);if(w>best){best=w;winner=i;}}return indices[winner].get<size_t>();}
Json edge(const Json& piece,const Json& endpoint){auto edges=array(piece,"boundaryIndices");int index=(int)n(endpoint,"edgeIndex",-1);if(index<0||index>=int(edges.size()))return Json::array();Json indices=edges[index];if(indices.size()<2)return indices;
 double start=clamp(n(endpoint,"startT",0),0,1),end=clamp(n(endpoint,"endT",1),0,1);if(start>end)std::swap(start,end);
 if(start<=.0001&&end>=.9999)return indices;
 int first=std::lround(start*(indices.size()-1)),last=std::lround(end*(indices.size()-1));first=std::clamp(first,0,int(indices.size()-1));last=std::clamp(last,first,int(indices.size()-1));
 if(first==last){if(last<int(indices.size())-1)last++;else if(first>0)first--;}
 Json out=Json::array();for(int i=first;i<=last;i++)out.push_back(indices[i]);return out;
}
}
Json buildClothSeamConstraints(const Json& project,const Json& mesh){
 std::map<std::string,Json> pieces;
 for(const auto& p:array(mesh,"pieces"))pieces[s(p,"id")]=p;
 std::map<std::string,Json> authored;
 for(const auto& p:array(project,"pieces"))authored[s(p,"id")]=p;
 Json constraints=Json::array(),unsupported=Json::array(),endpoints=Json::array(),anchors=Json::array();auto settings=object(project,"simulation");
 if(get(settings,"autoFitTacks")!=false){
  Json avatar=object(project,"avatar");
  double height=clamp(n(avatar,"heightCm",180)/180,.78,1.22),shoulder=clamp(n(avatar,"shoulderWidthCm",46),34,62)*.005;
  for(const auto& source:array(project,"pieces")){
   auto id=s(source,"id");auto it=pieces.find(id);if(it==pieces.end()||get(source,"frozen3d")==true||!s(source,"fusedToPieceId").empty())continue;
   auto p=it->second,flat=array(p,"flatVertices"),positions=array(p,"positions");if(flat.empty())continue;
   auto wrap=s(object(source,"arrangement3d"),"wrap");
   double maxY=-1e30,minY=1e30,minX=1e30,maxX=-1e30;
   for(const auto& v:flat){maxY=std::max(maxY,n(v,"y"));minY=std::min(minY,n(v,"y"));minX=std::min(minX,n(v,"x"));maxX=std::max(maxX,n(v,"x"));}
   auto append=[&](const std::string& type,size_t idx,const Json& target,double stiffness,const std::string& axes=""){
     Json anchor={{"type",type},{"pieceId",id},{"particleIndex",idx},{"target",target},{"stiffness",stiffness}};
     if(!axes.empty())anchor["axes"]=axes;anchors.push_back(anchor);
   };
   if(wrap=="front"||wrap=="back"){
    double top=-1e30;for(const auto& pos:positions)top=std::max(top,num(pos[1]));
    if(top>=1.42*height){
     if(get(source,"fitShoulderTacks")!=false){
      Json sides=get(source,"fitShoulderSides");if(!sides.is_array()||sides.empty())sides=Json::array({-1,1});
      for(const auto& v:sides){int side=int(num(v));if(side!=-1&&side!=1)continue;double score=1e30;size_t chosen=flat.size();
       for(size_t k=0;k<flat.size();k++){double dx=num(positions[k][0])-n(object(source,"arrangement3d"),"x"),sign=dx>0?1:dx<0?-1:side;
        if(sign!=side)continue;double d=std::abs(n(flat[k],"y")-(maxY-1.5))+std::abs(std::abs(n(flat[k],"x"))-15)*.45;
        if(d<score){score=d;chosen=k;}}
       if(chosen<flat.size())append("fit-anchor",chosen,Json::array({side*std::max(.16,shoulder-.005),1.66*height,0}),.34);
      }
     }
     double neckScore=1e30;size_t neck=flat.size();double center=(minX+maxX)*.5,neckX=n(source,"fitNeckLocalX",center);
     for(size_t k=0;k<flat.size();k++){if(n(flat[k],"y")<maxY-15)continue;
      double d=std::abs(n(flat[k],"x")-neckX)+std::abs(n(flat[k],"y")-(maxY-8))*.03;
      if(d<neckScore){neckScore=d;neck=k;}}
     bool split=wrap=="front"&&(s(source,"generatedRole").rfind("zip-front",0)==0||(get(source,"fitShoulderSides").is_array()&&source["fitShoulderSides"].size()==1));
     if(neck<flat.size()&&!split){double targetY=num(positions[neck][1]);double shoulderY=1.57*height,capY=.15*height,capZ=.135*clamp(n(avatar,"chestCm",96)/96,.72,1.42);
      double ny=clamp((targetY-shoulderY)/capY,-.999,.999),surface=capZ*std::sqrt(std::max(0.,1-ny*ny));
      append("fit-anchor",neck,Json::array({0,targetY,(wrap=="front"?1:-1)*(surface+.01)}),.01,"y");}
    }
   }else if(wrap=="left-arm"||wrap=="right-arm"){
    if(get(source,"fitSleeveApexTack")==false)continue;
    double center=(minX+maxX)*.5,best=1e30;size_t chosen=0;
    for(size_t k=0;k<flat.size();k++){double score=std::abs(n(flat[k],"y")-maxY)*3+std::abs(n(flat[k],"x")-center);if(score<best){best=score;chosen=k;}}
    double sign=wrap=="left-arm"?-1:1;
    append("fit-anchor",chosen,Json::array({sign*std::max(.16,shoulder-.005),1.655*height,0}),.42);
   }else if(wrap=="left-leg-front"||wrap=="left-leg-back"||wrap=="right-leg-front"||wrap=="right-leg-back"||wrap=="lower-front"||wrap=="lower-back"){
    std::vector<size_t> upper;
    for(size_t k=0;k<flat.size();k++)if(n(flat[k],"y")>=maxY-3)upper.push_back(k);
    std::stable_sort(upper.begin(),upper.end(),[&](size_t a,size_t b){return n(flat[a],"x")<n(flat[b],"x");});
    if(!upper.empty()){append("fit-anchor",upper.front(),positions[upper.front()],.28);append("fit-anchor",upper.back(),positions[upper.back()],.28);}
    if(wrap=="lower-front"||wrap=="lower-back")continue;
    std::set<size_t> seenBoundary;std::vector<size_t> boundary;
    auto edges=array(p,"boundaryIndices");
    for(int e:{0,1,3,4})if(e<int(edges.size()))for(const auto& ix:edges[e]){size_t key=ix.get<size_t>();if(seenBoundary.insert(key).second)boundary.push_back(key);}
    for(size_t idx:boundary)if(idx<positions.size()&&num(positions[idx][1])<=.68*height)append("arrangement-guide",idx,positions[idx],.035,"x");
   }
  }
 }
 for(const auto& seam:array(project,"seams")){
  auto a=object(seam,"a"),b=object(seam,"b");auto id=s(seam,"id");auto ia=pieces.find(s(a,"pieceId")),ib=pieces.find(s(b,"pieceId"));if(ia==pieces.end()||ib==pieces.end())continue;
  auto aa=edge(ia->second,a),bb=edge(ib->second,b);
  endpoints.push_back({{"seamId",id},{"aPieceId",ia->first},{"bPieceId",ib->first},{"aIndices",aa},{"bIndices",bb}});
  bool exact=get(seam,"useExactCorrespondence")==true||get(seam,"sourceCloSeamGroup").is_number_integer()||get(settings,"adaptiveCutlineMeshing")==true;
  if(exact){
   auto sourceA=authored.find(ia->first),sourceB=authored.find(ib->first);
   if(sourceA==authored.end()||sourceB==authored.end())continue;
   int edgeA=(int)n(a,"edgeIndex",-1),edgeB=(int)n(b,"edgeIndex",-1);
   double lenA=authoredEdgeLength(sourceA->second,edgeA)*std::abs(clamp(n(a,"endT",1),0,1)-clamp(n(a,"startT",0),0,1));
   double lenB=authoredEdgeLength(sourceB->second,edgeB)*std::abs(clamp(n(b,"endT",1),0,1)-clamp(n(b,"startT",0),0,1));
   if(lenA<=1e-8||lenB<=1e-8)continue;
   int samples=std::clamp((int)std::ceil(std::max(lenA,lenB)),1,25);
   double weight=clamp(std::max(lenA,lenB)/samples,.001,1);
   double startA=clamp(n(a,"startT",0),0,1),endA=clamp(n(a,"endT",1),0,1);
   double startB=clamp(n(b,"startT",0),0,1),endB=clamp(n(b,"endT",1),0,1);
   for(int k=0;k<samples;k++){double progress=(k+.5)/samples;
    auto pointA=edgePoint(sourceA->second,edgeA,startA+(endA-startA)*progress);
    auto pointB=edgePoint(sourceB->second,edgeB,startB+(endB-startB)*(get(seam,"reverseB")==true?1-progress:progress));
    Json aaTarget=surfaceTarget(ia->second,pointA),bbTarget=surfaceTarget(ib->second,pointB);
    if(array(aaTarget,"indices").empty()||array(bbTarget,"indices").empty())continue;
    double stiffness=n(settings,"seamStiffness",.96);if(stiffness==0)stiffness=.96;
    constraints.push_back({{"type","seam-virtual"},{"aPieceId",ia->first},{"bPieceId",ib->first},
     {"aIndex",strongest(aaTarget)},{"bIndex",strongest(bbTarget)},
     {"sourceIndices",aaTarget["indices"]},{"sourceWeights",aaTarget["weights"]},
     {"targetIndices",bbTarget["indices"]},{"targetWeights",bbTarget["weights"]},
     {"progress",progress},{"arclengthWeight",weight},
     {"rest",.008},{"stiffness",stiffness*weight},{"seamId",id},
     {"seamType",s(seam,"type").empty()?"normal":s(seam,"type")},
     {"sourceCloSeamGroup",get(seam,"sourceCloSeamGroup")}});
   }
   continue;
  }
  std::string type=s(seam,"type");if(type.empty())type="normal";
  if(type=="gather"||type=="elastic"||type=="ease"||n(seam,"edgeStability")>0){unsupported.push_back({{"id",id},{"reason","edge-treatment constraints not ported"}});continue;}
  if(aa.empty()||bb.empty())continue;
  const auto& ap=array(ia->second,"positions");const auto& bp=array(ib->second,"positions");
  auto loc=[&](const Json& inds,int k,const Json& positions)->Json{auto ix=inds.at(k).get<size_t>();if(ix>=positions.size())throw std::runtime_error("seam particle index out of range");return positions[ix];};
  double straight=distance(loc(aa,0,ap),loc(bb,0,bp))+distance(loc(aa,int(aa.size()-1),ap),loc(bb,int(bb.size()-1),bp));
  double reversed=distance(loc(aa,0,ap),loc(bb,int(bb.size()-1),bp))+distance(loc(aa,int(aa.size()-1),ap),loc(bb,0,bp));
  bool reverse=get(seam,"reverseB").is_boolean()?seam["reverseB"].get<bool>():reversed<straight;
  int count=(int)std::min(aa.size(),bb.size());
  for(int k=0;k<count;k++){double t=count==1?0:double(k)/(count-1);int ai=std::lround(t*(aa.size()-1)),bi=std::lround((reverse?1-t:t)*(bb.size()-1));
   if(type=="zipper"&&count>1){double open=clamp(n(seam,"openFraction"),0,1);if(open>=.999)continue;
    if(open>0){bool section=s(seam,"openFrom")=="start"?t<=open:t>=1-open;if(section)continue;}}
   double stiffness=n(settings,"seamStiffness",.96);if(stiffness==0)stiffness=.96;if(type=="zipper")stiffness=std::max(.985,stiffness);
   constraints.push_back({{"type","seam"},{"aPieceId",ia->first},{"bPieceId",ib->first},{"aIndex",aa[ai]},{"bIndex",bb[bi]},
    {"rest",type=="zipper"?.003:.008},{"stiffness",stiffness},{"seamId",id},{"seamType",type},{"junctionScale",n(seam,"junctionScale",1)}});
  }
 }
 std::map<std::string,std::set<std::string>> membership;
 for(const auto& c:constraints)for(auto side:{"a","b"}){std::string key=s(c,(std::string(side)+"PieceId").c_str())+":"+std::to_string(c[std::string(side)+"Index"].get<int>());membership[key].insert(s(c,"seamId"));}
 for(auto& c:constraints){std::string ka=s(c,"aPieceId")+":"+std::to_string(c["aIndex"].get<int>()),kb=s(c,"bPieceId")+":"+std::to_string(c["bIndex"].get<int>());
  if(std::max(membership[ka].size(),membership[kb].size())>1&&n(c,"junctionScale",1)<1)c["stiffness"]=num(c["stiffness"])*clamp(n(c,"junctionScale",1),.65,1);
 }
 // Anchors for authored manual pins and automatic fit tacks remain a separate
 // compiler pass. Preserve explicit scope rather than quietly omitting them.
 return Json{{"seamConstraints",constraints},{"seamEndpoints",endpoints},{"anchorConstraints",anchors},
  {"unsupportedSeams",unsupported},{"anchorsImplemented",true},{"fullParity",false},
  {"unported",Json::array({"manual pins","surface attachments","fasteners","fused layers","edge treatment constraints","internal fold/dart/pleat construction","other garment anchor modes","collision exclusion graph"})}};
}
}
