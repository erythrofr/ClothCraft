#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
ARCH="${1:-$(uname -m)}"
case "$ARCH" in arm64|x86_64) ;; *) echo "Unsupported macOS architecture: $ARCH" >&2; exit 2 ;; esac
APP="build/${ARCH}/GarmentStudioNative.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/fixtures" "$APP/Contents/Resources/assets" "$APP/Contents/Resources/solved" "$APP/Contents/Resources/web"
xcrun swiftc -O -target "${ARCH}-apple-macos13.0" -framework AppKit -framework SceneKit -framework WebKit GarmentStudioNative.swift NativeSolver.swift NativeGarmentGeometry.swift NativeWebWorkspace.swift -o "$APP/Contents/MacOS/GarmentStudioNative"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>GarmentStudioNative</string><key>CFBundleIdentifier</key><string>com.mikristian.garmentstudio.nativepreview</string><key>CFBundleName</key><string>Garment Studio Native</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>0.1.0</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
for fixture in tee-quality.native-sim.json hoodie-quality.native-sim.json pants.native-sim.json zip-hoodie-quality.native-sim.json; do
  cp "../native_backend/fixtures/$fixture" "$APP/Contents/Resources/fixtures/$fixture"
done
if [[ "${INCLUDE_FULL_WORKSPACE:-1}" == "1" ]]; then
  if [[ ! -s ../dist/index.html ]]; then
    echo "Missing Vite output; run npm run build at repo root" >&2
    exit 1
  fi
  rsync -a --delete --exclude='clo-thomas.glb' ../dist/ "$APP/Contents/Resources/web/"
  if [[ "${INCLUDE_PRIVATE_THOMAS:-0}" == "1" && -f ../dist/avatars/clo-thomas.glb ]]; then
    mkdir -p "$APP/Contents/Resources/web/avatars"
    cp ../dist/avatars/clo-thomas.glb "$APP/Contents/Resources/web/avatars/clo-thomas.glb"
  fi
fi
if [[ "${INCLUDE_PREPARED_SOLVES:-1}" == "1" && -x ../native_backend/bin/garment_xpbd_cli ]]; then
  for fixture in tee-quality.native-sim.json hoodie-quality.native-sim.json pants.native-sim.json zip-hoodie-quality.native-sim.json; do
    result="$APP/Contents/Resources/solved/${fixture%.json}.result.json"
    rm -f "$result"
    accepted=0
    for frames in 90 70 60 45 20; do
      if "../native_backend/bin/garment_xpbd_cli" "../native_backend/fixtures/$fixture" "$result" "$frames" >/dev/null 2>&1; then
        accepted=1
        echo "Native XPBD $fixture: finite at $frames frames"
        break
      fi
      rm -f "$result"
    done
    if [[ "$accepted" != "1" ]]; then
      echo "Warning: no finite XPBD preview for $fixture; static preview only" >&2
    fi
  done
fi
# CLO-exported avatar assets are user-owned and may not be redistributed.
# Local private builds may include an explicitly supplied asset.
if [[ "${INCLUDE_PRIVATE_THOMAS:-0}" == "1" && -f assets/clo-thomas.obj ]]; then
  cp assets/clo-thomas.obj "$APP/Contents/Resources/assets/clo-thomas.obj"
fi
codesign --force --deep --sign - "$APP"
echo "Built portable $ARCH app: $(pwd)/$APP"
