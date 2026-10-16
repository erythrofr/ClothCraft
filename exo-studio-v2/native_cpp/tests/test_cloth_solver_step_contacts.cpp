#include "cloth_solver_step_contacts.hpp"
#include <iostream>
using garment::Json;
int main(){Json input;std::cin>>input;Json answers=Json::array();
 for(const auto& q:input.at("cases"))try{answers.push_back(Json{{"ok",true},{"result",garment::cloth_solver_step_contacts::step(q.at("snapshot"),q.at("project"),q.value("dt",1./60.),q.value("frames",1))}});}
 catch(const std::exception& e){answers.push_back(Json{{"ok",false},{"error",e.what()}});}
 std::cout<<answers.dump()<<'\n';
}
