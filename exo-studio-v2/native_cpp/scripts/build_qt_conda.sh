#!/bin/bash
# Scoped Qt6 developer-SDK build. Never replaces the running Swift/React app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
QT_ROOT="${QT6_ROOT:-$ROOT/native_cpp/.qt-conda}"
BUILD="${QT_BUILD_DIR:-$ROOT/native_cpp/build-qt-conda}"
QT_CONFIG="$QT_ROOT/lib/cmake/Qt6/Qt6Config.cmake"

if [[ ! -f "$QT_CONFIG" ]]; then
  echo "Qt6 C++ SDK is missing: $QT_CONFIG" >&2
  echo 'Install an isolated Qt6 SDK before attempting the native Qt desktop build.' >&2
  exit 2
fi
if command -v cmake >/dev/null 2>&1; then
  CMAKE=(cmake)
elif python3 -m cmake --version >/dev/null 2>&1; then
  CMAKE=(python3 -m cmake)
else
  echo 'CMake >=3.20 is required.' >&2
  exit 2
fi

"${CMAKE[@]}" -S "$ROOT/native_cpp" -B "$BUILD" -DGARMENT_BUILD_QT=ON \
  -DCMAKE_PREFIX_PATH="$QT_ROOT" -DCMAKE_BUILD_TYPE=RelWithDebInfo
"${CMAKE[@]}" --build "$BUILD" --parallel 4

APP="$BUILD/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt"
if [[ ! -x "$APP" ]]; then
  echo 'Qt configuration completed without building GarmentStudioQt; failing instead of claiming native desktop success.' >&2
  exit 3
fi

if command -v ctest >/dev/null 2>&1; then
  ctest --test-dir "$BUILD" --output-on-failure
else
  PY_CMAKE_DIR="$(python3 - <<'PY'
try:
 import cmake
 print(cmake.CMAKE_BIN_DIR)
except ImportError:
 print('')
PY
)"
  if [[ -x "$PY_CMAKE_DIR/ctest" ]]; then
    "$PY_CMAKE_DIR/ctest" --test-dir "$BUILD" --output-on-failure
  else
    echo 'Qt app compiled but CTest was unavailable; unit test gate not satisfied.' >&2
    exit 4
  fi
fi

echo "Native Qt6 desktop compiled and CTest passed: $APP"
python3 "$ROOT/native_cpp/scripts/smoke_qt.py" "$APP" "$QT_ROOT" \
  "$ROOT/native_cpp/examples/sample-tee.json"
echo 'The app is a staged developer build. It has NOT been installed over the current Garment Studio app or physically validated for cloth fitting.'
