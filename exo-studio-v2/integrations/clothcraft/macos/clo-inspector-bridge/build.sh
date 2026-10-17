#!/bin/bash
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
# Refuse to touch a previously authorized binary unless the caller provides
# a stable developer identity before compilation or replacing any files.
if [[ -z "${EXO_INSPECTOR_SIGN_IDENTITY:-}" ]]; then
  echo "Set EXO_INSPECTOR_SIGN_IDENTITY to the authorized Apple Development signing identity" >&2
  exit 4
fi
APP="$HOME/Applications/EXO CLO Inspector.app"
BIN="$APP/Contents/MacOS/EXOCLOInspector"
mkdir -p "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>EXO CLO Inspector</string>
  <key>CFBundleDisplayName</key><string>EXO CLO Inspector</string>
  <key>CFBundleIdentifier</key><string>com.mikristian.exo.cloinspector</string>
  <key>CFBundleExecutable</key><string>EXOCLOInspector</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
xcrun swiftc -O -parse-as-library -o "$BIN" "$BASE/main.swift" -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit -framework ImageIO -framework UniformTypeIdentifiers
# Require a real stable signing identity. Ad-hoc signatures are the type
# whose designated requirement is tied to the executable's code hash; using
# them here would recreate the original TCC invalidation risk on rebuilds.
# Never change the signing identity after the user grants macOS TCC access.
codesign --force --options runtime --timestamp=none -s "$EXO_INSPECTOR_SIGN_IDENTITY" "$APP"
codesign --verify --strict --verbose=2 "$APP"
echo "$APP"
