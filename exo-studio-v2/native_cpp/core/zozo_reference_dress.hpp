#pragma once

#include "garment_document.hpp"
#include <cstdint>
#include <fstream>
#include <string>
#include <vector>

namespace garment {

// Read-only, on-demand adapter for the original upstream ZOZO dress recording.
// The persisted source is intentionally NOT a certified collision-free fit.
class ZozoReferenceDress {
 public:
  ZozoReferenceDress(const ZozoReferenceDress&) = delete;
  ZozoReferenceDress& operator=(const ZozoReferenceDress&) = delete;
  ZozoReferenceDress(ZozoReferenceDress&&) = default;
  ZozoReferenceDress& operator=(ZozoReferenceDress&&) = default;

  const Json& manifest() const { return manifest_; }
  const Json& meshes() const { return meshes_; }
  std::vector<float> frameVertices(int frame);
  std::vector<std::uint32_t> frameFloat32Bits(int frame,
      const std::vector<std::size_t>& coordinates);

 private:
  friend ZozoReferenceDress loadZozoDressReference(const std::string&);
  explicit ZozoReferenceDress(Json manifest, Json meshes, std::ifstream stream)
      : manifest_(std::move(manifest)), meshes_(std::move(meshes)), binary_(std::move(stream)) {}

  Json manifest_;
  Json meshes_;
  std::ifstream binary_;
};

// directory should be the app's local public/references/zozo-dress copy.
// Unlike the JavaScript fetch/Promise implementation this is synchronous local
// file I/O. No 2D editor/project state is read or changed.
ZozoReferenceDress loadZozoDressReference(const std::string& directory);

} // namespace garment
