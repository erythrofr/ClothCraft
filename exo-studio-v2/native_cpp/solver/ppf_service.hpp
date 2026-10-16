#pragma once
#include "nlohmann/json.hpp"
#include <string>
namespace garment {
// Transitional loopback transport: C++ -> existing job service -> original
// Rust PPF. No shell commands, remote URLs, redirects or physics fallback.
class PpfService {
 public:
  using Json=nlohmann::json;
  static Json health();
  static Json submit(const Json& project, int frames);
  static Json jobs();
  static Json job(const std::string& id);
  static Json validatedPreview(const std::string& id);
 private:
  static void validateId(const std::string& id);
  static Json request(const std::string& path, const Json* body=nullptr);
};
}
