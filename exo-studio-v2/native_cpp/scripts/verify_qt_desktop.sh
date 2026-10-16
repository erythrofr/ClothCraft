#!/bin/bash
set -eo pipefail

# A passing CAD-only build is not proof that the native Qt desktop exists.
# This checks in an isolated output directory; it never replaces the installed app.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
BUILD="native_cpp/build-qt-verification"
set -- -S native_cpp -B "$BUILD" -DGARMENT_BUILD_QT=ON -DGARMENT_REQUIRE_QT=ON
if [[ -n "$QT6_ROOT" ]]; then
  set -- "$@" "-DCMAKE_PREFIX_PATH=$QT6_ROOT"
fi
python3 -m cmake "$@"
python3 -m cmake --build "$BUILD" --target GarmentStudioQt --parallel 2
test -x "$BUILD/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt" || {
  echo "ERROR: native Qt app bundle executable missing." >&2
  exit 2
}
python3 -m cmake --build "$BUILD" --parallel 2
APP="$BUILD/GarmentStudioQt.app/Contents/MacOS/GarmentStudioQt"
if [[ -n "${QT6_ROOT:-}" ]]; then
  QT_QPA_PLATFORM=offscreen QT_PLUGIN_PATH="${QT_PLUGIN_PATH:-$QT6_ROOT/plugins}" "$APP" --smoke-test
else
  QT_QPA_PLATFORM=offscreen "$APP" --smoke-test
fi
echo "Qt desktop compiled and launched in an offscreen smoke test. Full simulation, calibrated materials and industrial UX parity remain separate gates."
