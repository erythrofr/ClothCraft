#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PBD="$ROOT/research/oss/PositionBasedDynamics"
BUILD="$ROOT/research/build/pbd-core"
CMAKE="$ROOT/research/venvs/pbd-tools/bin/cmake"

if [[ ! -x "$CMAKE" ]]; then
  echo "Missing local CMake at $CMAKE. Create research/venvs/pbd-tools and install cmake first." >&2
  exit 2
fi
mkdir -p "$ROOT/research/build" "$ROOT/native_backend/bin"
ln -sfn "$ROOT" /tmp/garmentstudio
"$CMAKE" -S /tmp/garmentstudio/research/oss/PositionBasedDynamics \
  -B /tmp/garmentstudio/research/build/pbd-core \
  -DPBD_LIBS_ONLY=ON \
  -DCMAKE_BUILD_TYPE=Release \
  -DEIGEN3_INCLUDE_DIR=/tmp/garmentstudio/research/oss/PositionBasedDynamics/extern/eigen >/dev/null
"$CMAKE" --build "$BUILD" --target PositionBasedDynamics -j "${JOBS:-6}" >/dev/null
c++ -std=c++17 -O2 -DUSE_DOUBLE \
  -I"$PBD" \
  -I"$PBD/extern/eigen" \
  "$ROOT/native_backend/tests/xpbd_smoke.cpp" \
  "$BUILD/lib/libPositionBasedDynamics.a" \
  -o "$ROOT/native_backend/bin/xpbd_smoke"
"$ROOT/native_backend/bin/xpbd_smoke"
