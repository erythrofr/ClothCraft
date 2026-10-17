#include "native_simulation_payload_builder.hpp"
#include <cassert>
#include <iostream>

int main() {
  using garment::Json;
  const Json source={
    {"id","empty-native-solver-fixture"},
    {"pieces",Json::array()},
    {"seams",Json::array()},
    {"fabrics",Json::object()},
    {"avatar",Json::object()},
    {"simulation",Json::object()}
  };
  const auto copy=source;
  const auto payload=garment::buildAuthoredNativeSimulationPayload(source);
  assert(payload.at("particles").empty());
  assert(payload.at("constraints").empty());
  assert(payload.at("fullPayloadParity")==false);
  assert(payload.at("parityUnsupported").is_array());
  assert(source==copy);
  std::cout<<"native solver payload builder empty garment smoke passed\n";
}
