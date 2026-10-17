#include "backend_registry.hpp"
#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>
using garment::BackendRegistry;
using garment::Json;
using garment::SimulationBackend;

static SimulationBackend make(const Json& spec) {
  SimulationBackend b;
  b.id = spec.value("id", std::string());
  b.metadata = spec.value("metadata", Json::object());
  b.asynchronous = spec.value("async", false);
  if (spec.value("create", false)) b.create = [id=b.id](const Json& project) { return Json{{"backendId",id},{"project",project},{"frame",0},{"createdAt","2026-10-15T00:00:00.000Z"}}; };
  if (spec.value("step", false)) b.step = [](const Json& state, double) {return state;};
  if (spec.value("stepAsync", false)) b.stepAsync = [](const Json& state, double) {return state;};
  return b;
}

int main() {
  BackendRegistry registry;
  if (std::cin.peek() == EOF) {
    SimulationBackend backend = make({{"id","unit"},{"metadata",{{"label","Unit"}}},{"create",true},{"step",true}});
    registry.registerSimulationBackend(std::move(backend));
    assert(registry.getSimulationBackend("unit") != nullptr);
    assert(registry.listSimulationBackends().size() == 1);
    const auto session = registry.createSimulationSession({{"id","test"}},"unit");
    assert(session.session.at("backendId") == "unit");
    assert(session.session.at("project").at("id") == "test");
    std::cout << "native simulation backend registry test passed\n";
    return 0;
  }
  Json results = Json::array();
  try {
    Json input;
    std::cin >> input;
    for (const auto& action : input.at("actions")) {
      try {
        const std::string op = action.at("op").get<std::string>();
        Json result;
        if (op == "register") {
          const auto& b = registry.registerSimulationBackend(make(action.at("backend")));
          result = b.id;
        } else if (op == "replace") {
          const auto& b = registry.replaceSimulationBackend(make(action.at("backend")));
          result = b.id;
        } else if (op == "get") {
          const auto* b = registry.getSimulationBackend(action.value("id",std::string("browser-pbd")));
          result = b ? Json(b->id) : Json(nullptr);
        } else if (op == "list") {
          result = registry.listSimulationBackends();
        } else if (op == "session") {
          auto s = registry.createSimulationSession(action.value("project",Json::object()),action.value("id",std::string("browser-pbd")));
          result = {{"backend",s.backend->id},{"session",s.session}};
        } else throw std::runtime_error("Unknown test operation");
        results.push_back({{"ok",true},{"result",result}});
      } catch (const std::exception& e) { results.push_back({{"ok",false},{"error",e.what()}}); }
    }
    std::cout << results.dump() << '\n';
  } catch(const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
