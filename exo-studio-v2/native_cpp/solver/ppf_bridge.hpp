#pragma once

#include "nlohmann/json.hpp"

namespace garment {

// Native transport boundary for ZOZO's Rust PPF solver. This does NOT port
// its physics to C++ or claim a result was physically verified.
class PpfBridge {
 public:
  using Json = nlohmann::json;
  static Json validateInitialShell(const Json& payload, const Json& independentlyMeasuredDeformation);
  // Consumes independent audit reports, not a solver-success flag.
  static Json evaluateFitEvidence(const Json& evidence);
  static Json makeJobEnvelope(const Json& project, int frames = 10);
  static constexpr const char* kServiceUrl = "http://127.0.0.1:5192";
};

} // namespace garment
