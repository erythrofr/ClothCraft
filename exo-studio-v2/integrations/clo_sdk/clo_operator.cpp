// MIKRISTIAN CLO Operator: menu-invoked bridge for CLO 7.0.242 / SDK 4.0.0.
// Each action must be explicitly queued outside CLO, then manually invoked
// from the CLO plug-in menu. Never runs automatically when a project loads.
#include "CLOAPIInterface.h"
#include <algorithm>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <sys/stat.h>
#include <unistd.h>

namespace {
std::string root() {
  const char* home = std::getenv("HOME");
  return std::string(home ? home : "/tmp") + "/Documents/CLO_Automation/CLO_Operator";
}

std::string escape(const std::string& text) {
  std::string result = "\"";
  for (char c : text) {
    if (c == '\"' || c == '\\') { result += '\\'; result += c; }
    else if (c == '\n') result += "\\n";
    else if (c == '\r') result += "\\r";
    else if (static_cast<unsigned char>(c) < 32) result += ' ';
    else result += c;
  }
  return result + "\"";
}

bool insideAutomation(const std::string& path) {
  const char* home = std::getenv("HOME");
  if (!home || path.empty() || path.find("..") != std::string::npos) return false;
  const std::string prefix = std::string(home) + "/Documents/CLO_Automation/";
  return path.compare(0, prefix.size(), prefix) == 0;
}

bool endsWith(const std::string& text, const std::string& suffix) {
  return text.size() >= suffix.size() && text.compare(text.size()-suffix.size(), suffix.size(), suffix) == 0;
}

void writeResponse(const std::string& id, const std::string& body) {
  // ID is sanitized by the queue CLI and independently checked in this plugin.
  if (id.empty() || id.find_first_not_of("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_") != std::string::npos) return;
  const std::string filename = root() + "/responses/" + id + ".json";
  const std::string temp = filename + ".tmp";
  std::ofstream file(temp, std::ios::binary | std::ios::trunc);
  if (!file.good()) return;
  file << body << '\n';
  file.close();
  std::rename(temp.c_str(), filename.c_str());
}

std::map<std::string, std::string> readRequest() {
  std::map<std::string, std::string> result;
  std::ifstream in(root() + "/pending.job", std::ios::binary);
  std::string line;
  while (std::getline(in, line)) {
    auto pos = line.find('=');
    if (pos != std::string::npos) result[line.substr(0, pos)] = line.substr(pos + 1);
  }
  return result;
}

std::string jsonMap(const std::map<std::string, std::string>& fields) {
  std::ostringstream out;
  out << '{';
  bool first = true;
  for (const auto& kv : fields) {
    if (!first) out << ',';
    first = false;
    out << escape(kv.first) << ':' << escape(kv.second);
  }
  out << '}';
  return out.str();
}

std::string inspectArrangements() {
  if (!PATTERN_API) return "\"ok\":false,\"error\":\"Pattern interface unavailable\"";
  const auto list = PATTERN_API->GetArrangementList();
  const int count = std::max(0, std::min(500, PATTERN_API->GetPatternCount()));
  std::ostringstream out;
  out << "\"ok\":true,\"arrangement_count\":" << list.size() << ",\"arrangement_list\":[";
  for (size_t i=0; i<list.size() && i<200; ++i) {
    if (i) out << ',';
    out << "{\"index\":" << i << ",\"fields\":" << jsonMap(list[i]) << '}';
  }
  out << "],\"patterns\":[";
  for (int i=0; i<count; ++i) {
    if (i) out << ',';
    out << "{\"index\":" << i << ",\"name\":" << escape(PATTERN_API->GetPatternPieceName(i))
        << ",\"arrangement\":" << jsonMap(PATTERN_API->GetArrangementOfPattern(i)) << '}';
  }
  out << ']';
  return out.str();
}

std::string inspect() {
  if (!UTILITY_API || !PATTERN_API) return "\"error\":\"CLO API interfaces unavailable\"";
  std::ostringstream out;
  out << "\"version\":\"" << UTILITY_API->GetMajorVersion() << '.'
      << UTILITY_API->GetMinorVersion() << '.' << UTILITY_API->GetPatchVersion() << "\",";
  out << "\"project_name\":" << escape(UTILITY_API->GetProjectName()) << ',';
  out << "\"project_path\":" << escape(UTILITY_API->GetProjectFilePath()) << ',';
  const int count = std::max(0, std::min(500, PATTERN_API->GetPatternCount()));
  out << "\"pattern_count\":" << count << ",\"pattern_names\":[";
  for (int i = 0; i < count; ++i) {
    if (i) out << ',';
    out << escape(PATTERN_API->GetPatternPieceName(i));
  }
  out << ']';
  return out.str();
}
}

extern "C" {
__attribute__((visibility("default"))) const char* GetActionName() { return "MIKRISTIAN CLO Operator (run queued job)"; }
__attribute__((visibility("default"))) const char* GetObjectNameTreeToAddAction() { return "menu_Setting / menuPlug_In"; }
__attribute__((visibility("default"))) int GetPositionIndexToAddAction() { return 1; }
__attribute__((visibility("default"))) void DoFunctionAfterLoadingCLOFile(const char*) {} // no automatic actions

__attribute__((visibility("default"))) void DoFunction() {
  auto request = readRequest();
  const std::string id = request["id"];
  const std::string action = request["action"];
  if (id.empty()) {
    if (UTILITY_API) UTILITY_API->DisplayMessageBox("MIKRISTIAN CLO Operator: no job queued. Run node integrations/clo_sdk/cli.mjs inspect first.");
    return;
  }
  std::string outcome = "\"ok\":false,\"error\":\"Unsupported command\"";
  try {
    if (!UTILITY_API || !PATTERN_API || !IMPORT_API || !EXPORT_API) {
      outcome = "\"ok\":false,\"error\":\"API interfaces not initialized\"";
    } else if (UTILITY_API->GetMajorVersion() != 7 || UTILITY_API->GetMinorVersion() != 0 || UTILITY_API->GetPatchVersion() != 242) {
      outcome = "\"ok\":false,\"error\":\"This plugin is only compiled/tested for CLO 7.0.242\"";
    } else if (action == "inspect") {
      outcome = "\"ok\":true," + inspect();
    } else if (action == "arrangements") {
      // Nonmutating: the avatar's placement-point names and each pattern's
      // current binding are essential before choosing indexes for jeans.
      outcome = inspectArrangements() + ',' + inspect();
    } else if (action == "arrange") {
      // Set exactly ONE panel per job; caller must inspect the new position
      // before queuing the next. No global/bulk placement to avoid wrong legs.
      const std::string expected = request["expected_project"];
      if (expected.empty() || expected != UTILITY_API->GetProjectFilePath()) {
        outcome = "\"ok\":false,\"error\":\"Project guard mismatch\"," + inspect();
      } else {
        const int piece = std::atoi(request["piece"].c_str());
        const int point = std::atoi(request["point"].c_str());
        const int count = PATTERN_API->GetPatternCount();
        const auto list = PATTERN_API->GetArrangementList();
        if (request["piece"].empty() || request["point"].empty() || piece < 0 || piece >= count || point < 0 || point >= static_cast<int>(list.size())) {
          outcome = "\"ok\":false,\"error\":\"Pattern or arrangement index out of range\"";
        } else if (request["expected_name"].empty() || request["expected_name"] != PATTERN_API->GetPatternPieceName(piece)) {
          outcome = "\"ok\":false,\"error\":\"Pattern name guard mismatch\"";
        } else {
          PATTERN_API->SetArrangement(piece, point);
          outcome = "\"ok\":true,\"pattern_index\":" + std::to_string(piece) +
            ",\"arrangement_index\":" + std::to_string(point) +
            ",\"after\":" + jsonMap(PATTERN_API->GetArrangementOfPattern(piece)) + ',' + inspect();
        }
      }
    } else if (action == "simulate" || action == "export") {
      const std::string expected = request["expected_project"];
      const std::string current = UTILITY_API->GetProjectFilePath();
      if (expected.empty() || expected != current) {
        outcome = "\"ok\":false,\"error\":\"Project guard mismatch; inspect and use its exact path\"," + inspect();
      } else if (action == "simulate") {
        const int steps = std::atoi(request["steps"].c_str());
        if (steps <= 0 || steps > 300) outcome = "\"ok\":false,\"error\":\"Simulation steps must be 1..300\"";
        else {
          const bool success = UTILITY_API->Simulate(static_cast<unsigned int>(steps));
          outcome = std::string("\"ok\":") + (success ? "true" : "false") + ",\"simulation_steps\":" + std::to_string(steps) + ',' + inspect();
        }
      } else {
        const std::string path = request["path"];
        if (!insideAutomation(path) || !endsWith(path, ".zprj")) outcome = "\"ok\":false,\"error\":\"Output must be a new .zprj inside Documents/CLO_Automation\"";
        else if (access(path.c_str(), F_OK) == 0) outcome = "\"ok\":false,\"error\":\"Refusing to overwrite a saved project\"";
        else {
          const auto exported = EXPORT_API->ExportZPrj(path, false);
          outcome = std::string("\"ok\":") + (!exported.empty() ? "true" : "false") + ",\"exported_path\":" + escape(exported) + ',' + inspect();
        }
      }
    } else if (action == "import_dxf") {
      // Imports into the CURRENT session, so only allowed after a precise project guard.
      const std::string path = request["path"];
      const std::string expected = request["expected_project"];
      if (!insideAutomation(path) || !endsWith(path, ".dxf") || access(path.c_str(), R_OK) != 0)
        outcome = "\"ok\":false,\"error\":\"DXF missing or outside allowed folder\"";
      else if (expected.empty() || expected != UTILITY_API->GetProjectFilePath())
        outcome = "\"ok\":false,\"error\":\"Project guard mismatch\"";
      else {
        Marvelous::ImportDxfOption options;
        options.m_bAppend = true; // never replace an existing garment on import
        options.m_bAutoScale = false;
        options.m_Scale = 1.0f; // source DXFs use millimeters
        const bool success = IMPORT_API->ImportDXF(path, options);
        outcome = std::string("\"ok\":") + (success ? "true" : "false") + ",\"imported_path\":" + escape(path) + ',' + inspect();
      }
    }
  } catch (...) {
    outcome = "\"ok\":false,\"error\":\"Exception in CLO SDK call\"";
  }
  writeResponse(id, "{\"id\":" + escape(id) + ",\"action\":" + escape(action) + ',' + outcome + '}');
  std::rename((root() + "/pending.job").c_str(), (root() + "/processed-" + id + ".job").c_str());
}
}
