#include "project_geometry.hpp"
#include <algorithm>
#include <cmath>
#include <functional>
#include <numeric>
#include <stdexcept>
#include <vector>
namespace garment::project_geometry {
namespace {
Json get(const Json& p,const std::string& k){return p.is_object()&&p.contains(k)?p[k]:Json();}
Json arr(const Json& p,const std::string& k){auto j=get(p,k);return j.is_array()?j:Json::array();}
bool truth(const Json& j){return !j.is_null()&&j!=false&&j!=0&&j!="";}
double num(const Json& j,double fallback=0){if(j.is_null())return fallback;if(j.is_number())return j.get<double>();if(j.is_boolean())return j.get<bool>()?1:0;if(j.is_string()){try{return std::stod(j.get<std::string>());}catch(...){return NAN;}}return NAN;}
double clamp(double x,double lo,double hi){return std::max(lo,std::min(hi,x));}
struct P {double x,y;};
P pt(const Json& j){return {num(get(j,"x")),num(get(j,"y"))};}
Json as(P p){return Json{{"x",p.x},{"y",p.y}};}
P sub(P a,P b){return {a.x-b.x,a.y-b.y};}
P normal(P a){double l=std::hypot(a.x,a.y);if(l==0)l=1;return {a.x/l,a.y/l};}
double cross(P a,P b){return a.x*b.y-a.y*b.x;}
Json curve(const Json& piece,int i){return get(get(piece,"curves"),std::to_string(i));}
Json pieceFor(const Json& project,const Json& id){for(const auto& p:arr(project,"pieces"))if(get(p,"id")==id)return p;return nullptr;}
double arc(P a,P c,P b,double start=0,double end=1){
 auto speed=[&](double t){return std::hypot(2*((1-t)*(c.x-a.x)+t*(b.x-c.x)),2*((1-t)*(c.y-a.y)+t*(b.y-c.y)));};
 auto sim=[](double l,double r,double fl,double fm,double fr){return (r-l)*(fl+4*fm+fr)/6;};
 std::function<double(double,double,double,double,double,double,double,int)> recurse;
 recurse=[&](double l,double r,double fl,double fm,double fr,double whole,double tol,int depth){
  double m=(l+r)/2,f1=speed((l+m)/2),f2=speed((m+r)/2),left=sim(l,m,fl,f1,fm),right=sim(m,r,fm,f2,fr);
  if(depth>=20||std::abs(left+right-whole)<=15*tol)return left+right+(left+right-whole)/15;
  return recurse(l,m,fl,f1,fm,left,tol/2,depth+1)+recurse(m,r,fm,f2,fr,right,tol/2,depth+1);
 };
 if(std::abs(end-start)<=1e-10)return 0;
 double lo=clamp(std::min(start,end),0,1),hi=clamp(std::max(start,end),0,1),fl=speed(lo),fr=speed(hi),fm=speed((lo+hi)/2);
 return recurse(lo,hi,fl,fm,fr,sim(lo,hi,fl,fm,fr),1e-7,0);
}
Json endpointRange(const Json& e){double a=clamp(num(get(e,"startT"),0),0,1),b=clamp(num(get(e,"endT"),1),0,1);return Json{{"start",std::min(a,b)},{"end",std::max(a,b)}};}
Json normalized(const Json& path){if(path.size()<2)return path;P first=pt(path[0]),last=pt(path[path.size()-1]);double theta=std::atan2(last.y-first.y,last.x-first.x),c=std::cos(theta),s=std::sin(theta);Json out=Json::array();for(const auto& j:path){P p=sub(pt(j),first);out.push_back(as({p.x*c+p.y*s,-p.x*s+p.y*c}));}return out;}
}
double polygonArea(const Json& points){if(!points.is_array()||points.size()<3)return 0;double sum=0;for(size_t i=0;i<points.size();i++)sum+=cross(pt(points[i]),pt(points[(i+1)%points.size()]));return std::abs(sum)/2;}
Json sampleEdge(const Json& piece,int index,int segments){
 Json points=arr(piece,"points");if(index<0||index>=static_cast<int>(points.size()))return Json::array();
 Json a=points[index],b=points[(index+1)%points.size()],c=curve(piece,index);
 if(!truth(c))return Json::array({a,b});
 Json result=Json::array();P pa=pt(a),pb=pt(b),pc{num(get(c,"cx")),num(get(c,"cy"))};
 for(int s=0;s<=std::max(2,segments);s++){double t=double(s)/std::max(2,segments),u=1-t;result.push_back(as({u*u*pa.x+2*u*t*pc.x+t*t*pb.x,u*u*pa.y+2*u*t*pc.y+t*t*pb.y}));}return result;
}
Json samplePieceBoundary(const Json& piece,int segments){Json points=Json::array(),edges=Json::array(),vertices=arr(piece,"points");for(size_t i=0;i<vertices.size();i++){Json edge=sampleEdge(piece,i,segments);edges.push_back(edge);for(size_t j=0;j+1<edge.size();j++)points.push_back(edge[j]);}return Json{{"points",points},{"edgePaths",edges}};}
double getEdgeSeamAllowance(const Json& piece,int index){auto obj=get(piece,"edgeSeamAllowances");auto override=get(obj,std::to_string(index));if(!override.is_null()&&std::isfinite(num(override)))return std::max(0.,num(override));return std::max(0.,num(get(piece,"seamAllowance"))); }
Json seamAllowanceBoundary(const Json& piece,int segments){
 Json verts=arr(piece,"points");if(verts.size()<3)return Json::array();
 Json sampled=Json::array();std::vector<double> allowances;
 for(size_t i=0;i<verts.size();i++){auto path=sampleEdge(piece,i,std::max(2,segments));double amount=getEdgeSeamAllowance(piece,i);for(size_t k=0;k+1<path.size();k++){sampled.push_back(path[k]);allowances.push_back(amount);}}
 if(sampled.size()<3||std::all_of(allowances.begin(),allowances.end(),[](double x){return x<=0;}))return sampled;
 double signedArea=0;for(size_t i=0;i<sampled.size();i++)signedArea+=cross(pt(sampled[i]),pt(sampled[(i+1)%sampled.size()]));bool ccw=signedArea>0;
 Json result=Json::array();int n=sampled.size();
 for(int i=0;i<n;i++){
  P p=pt(sampled[i]),prev=pt(sampled[(i+n-1)%n]),next=pt(sampled[(i+1)%n]);P inc=normal(sub(p,prev)),out=normal(sub(next,p));
  P ni=ccw?P{inc.y,-inc.x}:P{-inc.y,inc.x},no=ccw?P{out.y,-out.x}:P{-out.y,out.x};
  double ai=allowances[(i+n-1)%n],ao=allowances[i];P a{p.x+ni.x*ai,p.y+ni.y*ai},b{p.x+no.x*ao,p.y+no.y*ao};
  double determinant=cross(inc,out);P r;
  if(std::abs(determinant)<1e-7)r={p.x+(ni.x*ai+no.x*ao)*.5,p.y+(ni.y*ai+no.y*ao)*.5};
  else{P delta=sub(b,a);double t=cross(delta,out)/determinant;r={a.x+inc.x*t,a.y+inc.y*t};}
  P diff=sub(r,p);double length=std::hypot(diff.x,diff.y),limit=std::max({ai,ao,.001})*3.5;
  if(length>limit)r={p.x+diff.x/length*limit,p.y+diff.y/length*limit};result.push_back(as(r));
 }
 return result;
}
double pieceArea(const Json& piece){return polygonArea(samplePieceBoundary(piece,12)["points"]);}
double projectArea(const Json& project){double total=0;for(const auto& p:arr(project,"pieces"))total+=pieceArea(p);return total;}
double edgeLength(const Json& piece,int index){Json points=arr(piece,"points");if(index<0||index>=static_cast<int>(points.size()))return 0;P a=pt(points[index]),b=pt(points[(index+1)%points.size()]);Json c=curve(piece,index);return truth(c)?arc(a,{num(get(c,"cx")),num(get(c,"cy"))},b):std::hypot(b.x-a.x,b.y-a.y);}
double edgeRangeLength(const Json& piece,int index,double start,double end){return edgeLength(piece,index)*std::abs(clamp(end,0,1)-clamp(start,0,1));}
Json edgePointAt(const Json& piece,int index,double fraction,int){
 Json points=arr(piece,"points");if(index<0||index>=static_cast<int>(points.size()))return nullptr;
 P a=pt(points[index]),b=pt(points[(index+1)%points.size()]);Json cv=curve(piece,index);double t=clamp(fraction,0,1);
 if(truth(cv)){
  P c{num(get(cv,"cx")),num(get(cv,"cy"))};double total=arc(a,c,b);if(total<1e-10)return Json{{"point",points[index]},{"tangent",as({1,0})},{"fraction",t}};
  double lo=0,hi=1,target=t*total;for(int i=0;i<30;i++){double mid=(lo+hi)/2;if(arc(a,c,b,0,mid)<target)lo=mid;else hi=mid;}
  t=fraction==0?0:fraction==1?1:(lo+hi)/2;double u=1-t;P p{u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y};
  P tangent=normal({2*((1-t)*(c.x-a.x)+t*(b.x-c.x)),2*((1-t)*(c.y-a.y)+t*(b.y-c.y))});
  return Json{{"point",as(p)},{"tangent",as(tangent)},{"normal",as({-tangent.y,tangent.x})},{"fraction",fraction},{"parameter",t}};
 }
 double length=std::hypot(b.x-a.x,b.y-a.y);if(!length)length=1;return Json{{"point",as({a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t})},{"tangent",as({(b.x-a.x)/length,(b.y-a.y)/length})},{"normal",as({-(b.y-a.y)/length,(b.x-a.x)/length})},{"fraction",t}};
}
Json facingGeometryForEdge(const Json& piece,int index,double width){
 Json points=arr(piece,"points");if(points.size()<3||index<0||index>=static_cast<int>(points.size()))return nullptr;
 width=clamp(width==0?5:width,.8,20);P center{0,0};for(const auto& p:points){center.x+=pt(p).x;center.y+=pt(p).y;}center.x/=points.size();center.y/=points.size();
 auto inward=[&](double t){auto located=edgePointAt(piece,index,t);P n=pt(located["normal"]),p=pt(located["point"]);if(n.x*(center.x-p.x)+n.y*(center.y-p.y)<0)n={-n.x,-n.y};return n;};
 P a=pt(points[index]),b=pt(points[(index+1)%points.size()]),n1=inward(.015),n2=inward(.985),mid=inward(.5);
 Json curves=Json::object(),source=curve(piece,index);if(truth(source)){curves["0"]=source;curves["2"]={{"cx",num(get(source,"cx"))+mid.x*width},{"cy",num(get(source,"cy"))+mid.y*width}};}
 return Json{{"points",Json::array({points[index],points[(index+1)%points.size()],as({b.x+n2.x*width,b.y+n2.y*width}),as({a.x+n1.x*width,a.y+n1.y*width})})},{"curves",curves},{"widthCm",width}};
}
double closestEdgeFraction(const Json& piece,int index,const Json& point,int segments){
 Json path=sampleEdge(piece,index,std::max(10,segments));if(path.size()<2)return .5;std::vector<double> lens;double total=0;for(size_t i=0;i+1<path.size();i++){P d=sub(pt(path[i+1]),pt(path[i]));double l=std::hypot(d.x,d.y);lens.push_back(l);total+=l;}
 double best=INFINITY,along=total*.5,walked=0;P target=pt(point);
 for(size_t i=0;i<lens.size();i++){P a=pt(path[i]),b=pt(path[i+1]),d=sub(b,a),v=sub(target,a);double denom=d.x*d.x+d.y*d.y,t=denom>0?clamp((v.x*d.x+v.y*d.y)/denom,0,1):0;double dist=std::hypot(target.x-a.x-d.x*t,target.y-a.y-d.y*t);if(dist<best){best=dist;along=walked+lens[i]*t;}walked+=lens[i];}return total>0?along/total:.5;
}
Json seamLengthReport(const Json& project,const Json& seam){
 Json a=get(seam,"a"),b=get(seam,"b"),ra=endpointRange(a),rb=endpointRange(b);
 double la=edgeRangeLength(pieceFor(project,get(a,"pieceId")),(int)num(get(a,"edgeIndex")),ra["start"],ra["end"]),lb=edgeRangeLength(pieceFor(project,get(b,"pieceId")),(int)num(get(b,"edgeIndex")),rb["start"],rb["end"]);
 double diff=std::abs(la-lb),avg=(la+lb)/2,pct=avg>0?diff/avg*100:0;return Json{{"lengthA",la},{"lengthB",lb},{"difference",diff},{"mismatchPercent",pct},{"status",pct<=2?"good":pct<=6?"warning":"error"}};
}
Json seamWalkReport(const Json& project,const Json& seam,int sampleCount){
 Json a=get(seam,"a"),b=get(seam,"b"),pa=pieceFor(project,get(a,"pieceId")),pb=pieceFor(project,get(b,"pieceId"));if(pa.is_null()||pb.is_null())return nullptr;
 Json ra=endpointRange(a),rb=endpointRange(b);int ea=(int)num(get(a,"edgeIndex")),eb=(int)num(get(b,"edgeIndex"));
 double la=edgeRangeLength(pa,ea,ra["start"],ra["end"]),lb=edgeRangeLength(pb,eb,rb["start"],rb["end"]);
 int count=std::max(5,std::min(81,sampleCount));Json sa=Json::array(),sb=Json::array();
 for(int i=0;i<count;i++){double f=double(i)/(count-1),fa=num(ra["start"])+(num(ra["end"])-num(ra["start"]))*f,fb=truth(get(seam,"reverseB"))?num(rb["end"])-(num(rb["end"])-num(rb["start"]))*f:num(rb["start"])+(num(rb["end"])-num(rb["start"]))*f;
  Json qa=edgePointAt(pa,ea,fa),qb=edgePointAt(pb,eb,fb);if(qa.is_null()||qb.is_null())continue;sa.push_back(qa["point"]);sb.push_back(qb["point"]);
 }
 if(sa.size()<2||sb.size()<2)return nullptr;Json pathA=normalized(sa),nb=normalized(sb);double direct=0,reflected=0;
 for(size_t i=0;i<nb.size();i++){P p=pt(pathA[i]),q=pt(nb[i]);direct+=std::hypot(p.x-q.x,p.y-q.y);reflected+=std::hypot(p.x-q.x,p.y+q.y);}
 bool reflect=reflected<direct;Json pathB=Json::array(),samples=Json::array();double totalDev=0,maxDev=0;
 for(size_t i=0;i<nb.size();i++){P q=pt(nb[i]);if(reflect)q.y=-q.y;pathB.push_back(as(q));}
 for(size_t i=0;i<pathA.size();i++){P p=pt(pathA[i]),q=pt(pathB[i]);double dev=std::hypot(p.x-q.x,p.y-q.y),f=double(i)/(pathA.size()-1);totalDev+=dev;maxDev=std::max(maxDev,dev);samples.push_back(Json{{"fraction",f},{"distanceA",la*f},{"distanceB",lb*f},{"cumulativeDeltaCm",(la-lb)*f},{"shapeDeviationCm",dev}});}
 double diff=std::abs(la-lb),avg=(la+lb)/2;return Json{{"seamId",get(seam,"id")},{"name",truth(get(seam,"name"))?get(seam,"name"):get(seam,"id")},{"pieceAId",get(pa,"id")},{"pieceBId",get(pb,"id")},{"edgeA",get(a,"edgeIndex")},{"edgeB",get(b,"edgeIndex")},{"lengthA",la},{"lengthB",lb},{"difference",diff},{"mismatchPercent",avg>0?diff/avg*100:0},{"pathA",pathA},{"pathB",pathB},{"reflectB",reflect},{"averageShapeDeviationCm",totalDev/pathA.size()},{"maxShapeDeviationCm",maxDev},{"samples",samples}};
}
}
