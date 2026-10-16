#include "../core/sewing_construction.hpp"
#include <iostream>
int main(){
 try{
  garment::Json q;std::cin>>q;auto op=q.value("op",std::string("audit"));garment::Json value;
  if(op=="interval")value=garment::seamEndpointInterval(q.value("endpoint",garment::Json()));
  else if(op=="overlap")value=garment::seamEndpointOverlap(q.value("a",garment::Json()),q.value("b",garment::Json()),q.value("epsilon",1e-5));
  else if(op=="validate")value=garment::validateNewSeam(q.at("project"),q.at("seam"),q.value("options",garment::Json::object()));
  else if(op=="audit")value=garment::auditSewingConstruction(q.at("project"),q.value("options",garment::Json::object()));
  else throw std::runtime_error("unknown operation");
  std::cout<<garment::Json{{"ok",true},{"result",value}}.dump()<<std::endl;
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<std::endl;return 1;}
}
