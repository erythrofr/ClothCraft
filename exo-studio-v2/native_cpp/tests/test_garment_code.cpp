#include "../core/garment_code.hpp"
#include <cassert>
#include <iostream>
int main(){
 if(std::cin.peek()==EOF) {
  const garment::Json project={{"id","demo"},{"pieces",garment::Json::array({
    {{"id","front"},{"name","Front"},{"points",garment::Json::array({
       {{"x",0},{"y",0}},{{"x",8},{"y",0}},{{"x",8},{"y",12}},{{"x",0},{"y",12}}
    })}}})},{"seams",garment::Json::array()}};
  const auto exported=garment::projectToGarmentCode(project);
  assert(exported.at("pattern").at("panels").size()==1);
  assert(exported.at("pattern").at("stitches").empty());
  std::cout<<"native GarmentCode unit tests passed\n";
  return 0;
 }
 try{garment::Json q;std::cin>>q;std::string op=q.value("op",std::string("export"));garment::Json r;if(op=="export")r=garment::projectToGarmentCode(q.at("project"));else if(op=="import")r=garment::garmentCodeToProject(q.at("spec"),q.value("base",garment::Json::object()),q.value("timestamp",std::string()),q.value("ids",std::string()));else if(op=="summary")r=garment::garmentCodeRoundTripSummary(q.at("project"));else throw std::runtime_error("unknown operation");std::cout<<garment::Json{{"ok",true},{"result",r}}.dump()<<'\n';}catch(const std::exception&e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
}
