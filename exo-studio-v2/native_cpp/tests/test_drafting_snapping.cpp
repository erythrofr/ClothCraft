#include "drafting_snapping.hpp"
#include <cassert>
#include <cmath>
#include <functional>
#include <iostream>

using garment::Json;
static bool close(double a,double b,double tol=1e-8) {return std::abs(a-b)<tol;}
static bool rejects(const std::function<void()>& f) {
  try {f();} catch (const std::exception&) {return true;} return false;
}
int main() {
  const Json piece={{"id","front"},{"layout2d",{{"x",100},{"y",20}}},
    {"points",Json::array({{{"x",0},{"y",0}},{{"x",10},{"y",0}},
                            {{"x",10},{"y",10}},{{"x",0},{"y",10}}})},
    {"curves",{{"1",{{"cx",13},{"cy",5}}}}}};
  Json grid=garment::snapDraftGrid({{"x",13.23},{"y",-6.62}},.25);
  assert(close(grid["x"],13.25)&&close(grid["y"],-6.5));
  Json tie=garment::snapDraftGrid({{"x",-0.5},{"y",0.5}});
  assert(close(tie["x"],0)&&close(tie["y"],1));
  assert(rejects([]{garment::snapDraftGrid({{"x",1},{"y",2}},0);}));
  auto seg=garment::nearestOnDraftSegment({{"x",12},{"y",4}},{{"x",0},{"y",0}},{{"x",10},{"y",0}});
  assert(close(seg["x"],10)&&close(seg["y"],0)&&close(seg["t"],1));
  assert(garment::snapDraftPattern({{"x",92},{"y",1}},Json::array({piece})).is_null());
  auto corner=garment::snapDraftPattern({{"x",100.2},{"y",19.85}},Json::array({piece}),{{"toleranceCm",0.5}});
  assert(corner["kind"]=="vertex"&&corner["pointIndex"]==0);
  auto edge=garment::snapDraftPattern({{"x",105},{"y",19.5}},Json::array({piece}));
  assert(edge["kind"]=="edge"&&edge["edgeIndex"]==0&&close(edge["y"],20));
  auto curve=garment::snapDraftPattern({{"x",112.46},{"y",15.2}},Json::array({piece}));
  assert(curve["kind"]=="edge"&&curve["edgeIndex"]==1);
  auto exclude=garment::snapDraftPattern({{"x",100.01},{"y",19.99}},Json::array({piece}),
    {{"allowEdges",false},{"toleranceCm",0.5},{"excludedPoint",{{"pieceId","front"},{"pointIndex",0}}}});
  assert(exclude.is_null());
  auto guide=garment::constrainDraftAxis({{"x",0},{"y",0}},{{"x",5},{"y",4}});
  assert(close(guide["x"],4.5)&&close(guide["y"],4.5));
  assert(rejects([]{garment::constrainDraftAxis({{"x",0},{"y",0}},{{"x",1},{"y",2}},41);}));
  std::cout<<"native 2D drafting snapping passed\n";
}
