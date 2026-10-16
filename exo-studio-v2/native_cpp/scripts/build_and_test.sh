#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Reuse a verified isolated Qt6 SDK when present; keep the CAD-only build
# usable on machines without Qt headers. No system-wide SDK installation.
if [[ -z "${QT6_ROOT:-}" ]] &&
   [[ -f "$ROOT/native_cpp/.qt-sdk-worker1/6.8.3/macos/lib/cmake/Qt6/Qt6Config.cmake" ]]; then
  QT6_ROOT="$ROOT/native_cpp/.qt-sdk-worker1/6.8.3/macos"
fi

if command -v cmake >/dev/null 2>&1; then
  CMAKE=(cmake)
elif python3 -m cmake --version >/dev/null 2>&1; then
  CMAKE=(python3 -m cmake)
else
  echo 'CMake is required; use an installed Qt6/CMake SDK.' >&2
  exit 2
fi

ARGS=(-S native_cpp -B native_cpp/build-cmake -DGARMENT_BUILD_QT=ON)
if [[ -n "${QT6_ROOT:-}" ]]; then
  ARGS+=("-DCMAKE_PREFIX_PATH=$QT6_ROOT")
fi
"${CMAKE[@]}" "${ARGS[@]}"
"${CMAKE[@]}" --build native_cpp/build-cmake --parallel 4

PY_CMAKE_BIN="$(python3 - <<'PY'
try:
 import cmake
 print(cmake.CMAKE_BIN_DIR)
except ImportError:
 print('')
PY
)"
if command -v ctest >/dev/null 2>&1; then
  ctest --test-dir native_cpp/build-cmake --output-on-failure
elif [[ -x "$PY_CMAKE_BIN/ctest" ]]; then
  "$PY_CMAKE_BIN/ctest" --test-dir native_cpp/build-cmake --output-on-failure
else
  native_cpp/build-cmake/native_document_tests
  native_cpp/build-cmake/native_ppf_tests
fi

GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-cad.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-dxf-import.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-construction-dxf.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-pattern-mesh.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-flat-obj.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-grading.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-marker.mjs
"${NODE_BIN:-node}" scripts/check-native-cpp-marker-svg.mjs
"${NODE_BIN:-node}" scripts/check-native-cpp-marker-pdf.mjs
"${NODE_BIN:-node}" scripts/check-native-cpp-factory-zip.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-markers.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-fabric-cost.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-bom.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-measurements.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-native-cpp-tech-pack.mjs
GARMENT_CPP_CLI=native_cpp/build-cmake/garment_cad_cli "${NODE_BIN:-node}" scripts/check-clothcraft-interchange.mjs

# Verify binary CLI packaging using an independent Node ZIP/PDF decoder.
node scripts/check-native-cpp-factory-cli.mjs
node scripts/check-native-cpp-gltf.mjs

# Historical real solver artifacts are local-only, not required in a clean checkout.
if [[ -f blender_bridge/output/ppf-fit-tuning-20261013/contact-report.json ]]; then
  python3 scripts/check-native-ppf-fit.py
fi

if [[ -x native_cpp/build-cmake/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt ]]; then
  if [[ -n "${QT6_ROOT:-}" ]]; then
    QT_QPA_PLATFORM=offscreen QT_PLUGIN_PATH="${QT_PLUGIN_PATH:-$QT6_ROOT/plugins}" \
      native_cpp/build-cmake/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt --smoke-test
  else
    QT_QPA_PLATFORM=offscreen \
      native_cpp/build-cmake/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt --smoke-test
  fi
  echo 'Native Qt application compiled and offscreen launch verified: native_cpp/build-cmake/GarmentStudioQt.app'
else
  echo 'Native CAD library passed; Qt desktop not compiled. Use scripts/verify_qt_desktop.sh for a strict GUI gate.'
fi
