#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
arch="${1:-$(uname -m)}"
app="build/$arch/GarmentStudioNative.app"
[[ -x "$app/Contents/MacOS/GarmentStudioNative" ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist")" == 'GarmentStudioNative' ]]
for fixture in tee-quality.native-sim.json hoodie-quality.native-sim.json pants.native-sim.json zip-hoodie-quality.native-sim.json; do
  [[ -s "$app/Contents/Resources/fixtures/$fixture" ]]
  /usr/bin/plutil -lint -s "$app/Contents/Info.plist"
  if [[ -d "$app/Contents/Resources/solved" ]]; then
    result="$app/Contents/Resources/solved/${fixture%.json}.result.json"
    if [[ -f "$result" ]]; then
      node -e 'const r=require(process.argv[1]);if(r.protocol!=="garment-studio.native-xpbd-result"||r.stats?.finite!==true||!Array.isArray(r.state?.particles)||r.state.particles.some(p=>!p.position.every(Number.isFinite)))process.exit(1)' "$PWD/$result"
    fi
  fi
done
[[ -s "$app/Contents/Resources/web/index.html" ]] || { echo "FAIL: offline full 3D/2D workspace is missing" >&2; exit 1; }
[[ -d "$app/Contents/Resources/web/assets" ]] || { echo "FAIL: offline JS/CSS assets missing" >&2; exit 1; }
file "$app/Contents/MacOS/GarmentStudioNative"
echo "PASS: self-contained $arch garment bundle with four fixtures and full 2D/3D workspace"
