#include "../core/staging_geometry.hpp"
#include <iostream>
int main(){
 try{
  garment::Json q;std::cin>>q;auto operation=q.value("op",std::string("positions"));garment::Json result;
  if(operation=="positions")result=garment::staging_geometry::stagedPanelPositions(q.at("simPiece"),q.value("avatar",garment::Json::object()));
  else if(operation=="geometry")result=garment::staging_geometry::setStagedGeometry(q.at("geometry"),q.at("positions"),q.value("fitted",garment::Json()),q.value("blend",0.));
  else throw std::runtime_error("unknown operation");
  std::cout<<garment::Json{{"ok",true},{"result",result}}.dump()<<'\n';
 }catch(const std::exception& e){std::cout<<garment::Json{{"ok",false},{"error",e.what()}}.dump()<<'\n';}
}
