#include "grading_helpers.hpp"
#include <cassert>
#include <iostream>
using namespace garment::grading_helpers;
int main(){
 if(std::cin.peek()==EOF) {
  assert(DEFAULT_SIZES.size()==6);
  assert(sizeOffset(Json::object(),"L")==1);
  Json piece={{"points",Json::array({{{"x",0},{"y",0}},{{"x",12},{"y",0}},{{"x",12},{"y",20}},{{"x",0},{"y",20}}})}};
  auto graded=gradePiece(piece,Json::object(),"L");
  assert(graded.at("points").size()==4);
  assert(piece!=graded);
  std::cout<<"native grading helpers test passed\n";
  return 0;
 }
 try{Json request;std::cin>>request;Json results=Json::array();for(const auto& q:request.at("cases")){auto op=q.at("op").get<std::string>();Json g=q.value("grading",Json(nullptr)),value;if(op=="sizes")value=DEFAULT_SIZES;else if(op=="offset")value=sizeOffset(g,q.at("size").get<std::string>());else if(op=="point")value=gradePointForPiece(q.at("piece"),g,q.at("size").get<std::string>(),q.at("point"));else if(op=="piece")value=gradePiece(q.at("piece"),g,q.at("size").get<std::string>());else throw std::runtime_error("Unknown operation");results.push_back(value);}std::cout<<results.dump()<<'\n';}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
