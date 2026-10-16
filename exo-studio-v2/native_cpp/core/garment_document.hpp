#pragma once

#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

#include "nlohmann/json.hpp"

namespace garment {

using Json = nlohmann::json;

// All 2D pattern coordinates and seam allowances in the existing project
// format are centimeters. Never convert these silently into solver metres.
struct Point2 {
  double x = 0;
  double y = 0;
};

struct Validation {
  std::vector<std::string> errors;
  bool ok() const noexcept { return errors.empty(); }
  Json toJson() const;
};

struct Transaction {
  bool changed = false;
  int beforeRevision = 0;
  int afterRevision = 0;
  Json inverseSnapshot;  // complete lossless previous document, for undo
};

class Document {
 public:
  explicit Document(Json initial);
  const Json& data() const noexcept { return data_; }
  Validation validate() const;
  Json summary() const;
  Json edgeInfo(const std::string& pieceId, std::size_t edgeIndex) const;
  Json seamInfo(const std::string& seamId) const;
  Transaction apply(const std::string& operation, const Json& arguments,
                    int expectedRevision = -1);
  void restore(const Json& snapshot);

 private:
  Json data_;
  const Json& piece(const std::string& id) const;
  static Point2 point(const Json& object);
  static double edgeLength(const Json& piece, std::size_t edgeIndex);
  static double seamSpan(const Json& piece, const Json& endpoint);
};

}  // namespace garment
