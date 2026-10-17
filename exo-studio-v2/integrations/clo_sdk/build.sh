#!/bin/sh
set -eu
cd "$(dirname "$0")"
SDK="$PWD/vendor/CLO_SDK_v7.0.242/CLOAPIInterface"
APP="/Applications/CLO_Standalone_OnlineAuth.app"
test -f "$SDK/CLOAPIInterface.h" || { echo 'Matching official SDK v4.0.0 missing'; exit 1; }
ACTUAL=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Contents/Info.plist")
test "$ACTUAL" = '7.0.242' || { echo "Refusing to build against installed CLO $ACTUAL"; exit 1; }
mkdir -p build
xcrun clang++ -std=c++14 -arch x86_64 -mmacosx-version-min=11.0 -dynamiclib \
  -fvisibility=hidden -O2 -Wall -Wextra -Wno-unused-parameter -I "$SDK" \
  clo_operator.cpp -L "$APP/Contents/Frameworks" -lCLOAPIInterface \
  -o build/MIKRISTIAN_CLO_Operator.dylib
file build/MIKRISTIAN_CLO_Operator.dylib
nm -gU build/MIKRISTIAN_CLO_Operator.dylib | grep -E 'DoFunction|GetActionName|GetObjectNameTreeToAddAction|GetPositionIndexToAddAction'
