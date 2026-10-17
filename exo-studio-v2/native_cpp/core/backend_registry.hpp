#pragma once
#include <functional>
#include <map>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

namespace garment {
using Json = nlohmann::json;
using BackendCallback = std::function<Json(const Json&)>;
using StepCallback = std::function<Json(const Json&, double)>;

struct SimulationBackend {
  std::string id;
  Json metadata = Json::object();
  BackendCallback create;
  StepCallback step;
  StepCallback stepAsync;
  bool asynchronous = false;
};

struct SimulationSession {
  const SimulationBackend* backend;
  Json session;
};

class BackendRegistry {
 public:
  // The JS module starts with browser-pbd and native-service. Supply host callbacks
  // for those backends when their implementations exist in the native runtime.
  BackendRegistry() = default;
  const SimulationBackend& registerSimulationBackend(SimulationBackend backend);
  const SimulationBackend& replaceSimulationBackend(SimulationBackend backend);
  const SimulationBackend* getSimulationBackend(const std::string& id = "browser-pbd") const;
  Json listSimulationBackends() const;
  SimulationSession createSimulationSession(const Json& project, const std::string& backendId = "browser-pbd") const;
 private:
  static void validate(const SimulationBackend& backend);
  std::map<std::string, SimulationBackend> backends_;
  std::vector<std::string> order_;
};
}
