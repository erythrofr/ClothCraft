#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
"$ROOT/native_backend/scripts/build_xpbd_smoke.sh" >/dev/null
PBD="$ROOT/research/oss/PositionBasedDynamics"
BUILD="$ROOT/research/build/pbd-core"
c++ -std=c++17 -O2 -DUSE_DOUBLE \
  -I"$PBD" \
  -I"$PBD/extern/eigen" \
  "$ROOT/native_backend/tests/xpbd_cloth_smoke.cpp" \
  "$BUILD/lib/libPositionBasedDynamics.a" \
  -o "$ROOT/native_backend/bin/xpbd_cloth_smoke"
"$ROOT/native_backend/bin/xpbd_cloth_smoke"
