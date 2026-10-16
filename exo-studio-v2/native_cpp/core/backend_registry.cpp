#include "backend_registry.hpp"
#include <stdexcept>

namespace garment {
void BackendRegistry::validate(const SimulationBackend& b) {
  if (b.id.empty()) throw std::runtime_error("Simulation backend requires an id");
  if (!b.create || !b.step) throw std::runtime_error("Simulation backend " + b.id + " must implement create() and step()");
  if (b.asynchronous && !b.stepAsync) throw std::runtime_error("Asynchronous simulation backend " + b.id + " requires stepAsync()");
}

const SimulationBackend& BackendRegistry::registerSimulationBackend(SimulationBackend b) {
  validate(b);
  const std::string id = b.id;
  if (backends_.count(id)) throw std::runtime_error("Simulation backend already registered: " + id);
  order_.push_back(id);
  return backends_.emplace(id, std::move(b)).first->second;
}

const SimulationBackend& BackendRegistry::replaceSimulationBackend(SimulationBackend b) {
  validate(b);
  const std::string id = b.id;
  if (!backends_.count(id)) order_.push_back(id);
  return backends_.insert_or_assign(id, std::move(b)).first->second;
}

const SimulationBackend* BackendRegistry::getSimulationBackend(const std::string& id) const {
  auto it = backends_.find(id);
  return it == backends_.end() ? nullptr : &it->second;
}

Json BackendRegistry::listSimulationBackends() const {
  Json entries = Json::array();
  for (const auto& id : order_) {
    const auto& b = backends_.at(id);
    const auto& m = b.metadata;
    auto value = [&](const char* key, const Json& fallback) -> Json {
      if (!m.is_object() || !m.contains(key) || m[key].is_null() || m[key] == false || m[key] == "") return fallback;
      return m[key];
    };
    entries.push_back({{"id", b.id}, {"label", value("label", b.id)}, {"kind", value("kind", "unknown")},
      {"maturity", value("maturity", "experimental")}, {"capabilities", value("capabilities", Json::object())}});
  }
  return entries;
}

SimulationSession BackendRegistry::createSimulationSession(const Json& project, const std::string& backendId) const {
  const auto* backend = getSimulationBackend(backendId);
  if (!backend) throw std::runtime_error("Unknown simulation backend: " + backendId);
  return {backend, backend->create(project)};
}
}
