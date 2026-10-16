#include "visual_only_fingerprints.hpp"
#include <cassert>
#include <iostream>

int main() {
  using namespace garment::visual_only_fingerprints;
  const auto base=Json::parse(R"({"id":"test","fabrics":{"main":{"thickness":0.002,"roughness":0.7}},"pieces":[]})");
  auto optics=base;
  optics["fabrics"]["main"]["roughness"]=.3;
  auto physical=base;
  physical["fabrics"]["main"]["thickness"]=.006;
  assert(physicsInputFingerprint(base)==physicsInputFingerprint(optics));
  assert(physicsInputFingerprint(base)!=physicsInputFingerprint(physical));
  assert(opticalFabricFingerprint(base)!=opticalFabricFingerprint(optics));
  assert(opticalFabricFingerprint(base)==opticalFabricFingerprint(physical));
  std::cout<<"native optics/physics fingerprint isolation passed\n";
}
