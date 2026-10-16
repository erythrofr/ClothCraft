#!/usr/bin/env bash
# Reproducible, fail-closed Garment Studio native C++ integration gates.
# This script does not modify saved garment projects, commit, or deploy anything.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

python3 -m cmake -S native_cpp -B native_cpp/build-cmake -DGARMENT_BUILD_QT=OFF
python3 -m cmake --build native_cpp/build-cmake -j4
python3 -c 'import cmake,os,subprocess;raise SystemExit(subprocess.call([os.path.join(cmake.CMAKE_BIN_DIR,"ctest"),"--test-dir","native_cpp/build-cmake","--output-on-failure"]))'

# These exercise the integrated CLI, beyond per-module parity runners.
node scripts/check-native-cpp-new-cli-operations.mjs
node scripts/check-native-cpp-assembled-cli.mjs
node scripts/check-native-cpp-native-payload-cli.mjs
node scripts/check-native-cpp-marker-cli.mjs
node scripts/check-native-cpp-material-workspace-cli.mjs
node scripts/check-native-cpp-clo-menus.mjs
node scripts/check-native-cpp-service-cli.mjs
node scripts/check-native-cpp-ppf-cli.mjs
node scripts/check-native-cpp-zozo-reference-dress.mjs
node scripts/check-native-cpp-zozo-reference-corruption.mjs
node scripts/check-native-cpp-seam-assembly-parity-bridge.mjs
node scripts/check-native-cpp-seam-cli.mjs
node scripts/check-native-cpp-seam-inspect-direct-cli.mjs
node scripts/check-native-cpp-self-collision-real-fixtures.mjs
node scripts/check-native-cpp-avatar-contact-kernel.mjs
node scripts/check-native-cpp-seam-advanced-parity.mjs
node scripts/check-native-cpp-fabric-pbr-image-generator.mjs
node scripts/check-native-cpp-fabric-pbr-source-image.mjs --decode-only
node scripts/check-native-cpp-cloth-solver-step-extended.mjs
node scripts/check-native-cpp-authored-simulation-builder.mjs
node scripts/check-native-cpp-optimized-authored-snapshot.mjs
node scripts/check-native-cpp-optimized-payload-cli.mjs
node scripts/check-native-cpp-cloth-solver-step-contacts.mjs
node scripts/check-native-cpp-native-backend-session.mjs
node scripts/check-native-cpp-factory24-cli.mjs
node scripts/check-native-cpp-ppf-direct-cli.mjs

# All inventoried mappings must have their independently executable parity
# scripts pass. Export-count coverage is NOT weighted whole-app completion.
node scripts/check-native-cpp-conversion-coverage.mjs --run-parity
node native_cpp/scripts/conversion-progress.mjs

if [[ "${GARMENT_REQUIRE_FULL_CONVERSION:-0}" == "1" ]]; then
  node native_cpp/scripts/conversion-progress.mjs --require-complete
fi

if [[ "${GARMENT_VERIFY_QT:-0}" == "1" ]]; then
  QT_ROOT="${GARMENT_QT_ROOT:-$ROOT/native_cpp/.qt-sdk-worker1/6.8.3/macos}"
  if [[ ! -f "$QT_ROOT/lib/cmake/Qt6/Qt6Config.cmake" ]]; then
    echo "No Qt6 C++ developer SDK at $QT_ROOT" >&2
    exit 2
  fi
  python3 -m cmake -S native_cpp -B native_cpp/build-qt-current \
    -DCMAKE_PREFIX_PATH="$QT_ROOT" -DGARMENT_BUILD_QT=ON -DGARMENT_REQUIRE_QT=ON
  python3 -m cmake --build native_cpp/build-qt-current --target GarmentStudioQt -j4
  QT_QPA_PLATFORM=offscreen \
    native_cpp/build-qt-current/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt --smoke-test
  QT_QPA_PLATFORM=offscreen \
    native_cpp/build-qt-current/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt --zozo-preview-smoke
fi

echo "Native migration gates passed. Physical fit, CCD and factory certification remain separate acceptance gates."
