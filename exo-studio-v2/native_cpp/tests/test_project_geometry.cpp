#include "../core/project_geometry.hpp"
#include <iostream>
int main(){
 try{garment::Json q;std::cin>>q;using namespace garment::project_geometry;
  std::string op=q.value("op",std::string("pieceArea"));auto piece=q.value("piece",garment::Json::object());auto project=q.value("project",garment::Json::object());int index=q.value("edgeIndex",0),segments=q.value("segments",8);garment::Json result;
  if(op=="polygonArea")result=polygonArea(q.value("points",garment::Json::array()));
  else if(op=="sampleEdge")result=sampleEdge(piece,index,segments);
  else if(op=="samplePieceBoundary")result=samplePieceBoundary(piece,segments);
  else if(op=="getEdgeSeamAllowance")result=getEdgeSeamAllowance(piece,index);
  else if(op=="seamAllowanceBoundary")result=seamAllowanceBoundary(piece,segments);
  else if(op=="pieceArea")result=pieceArea(piece);
  else if(op=="projectArea")result=projectArea(project);
  else if(op=="edgeLength")result=edgeLength(piece,index);
  else if(op=="edgeRangeLength")result=edgeRangeLength(piece,index,q.value("start",0.),q.value("end",1.));
  else if(op=="edgePointAt")result=edgePointAt(piece,index,q.value("fraction",.5),segments);
  else if(op=="facingGeometryForEdge")result=facingGeometryForEdge(piece,index,q.value("width",5.));
  else if(op=="closestEdgeFraction")result=closestEdgeFraction(piece,index,q.at("point"),segments);
  else if(op=="seamLengthReport")result=seamLengthReport(project,q.at("seam"));
  else if(op=="seamWalkReport")result=seamWalkReport(project,q.at("seam"),q.value("sampleCount",25));
  else throw std::runtime_error("unknown operation");
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<std::endl;
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<std::endl;}
}
