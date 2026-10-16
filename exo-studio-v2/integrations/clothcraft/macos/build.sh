#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
CLOTHCRAFT_SOURCE="${EXO_CLOTHCRAFT_REPO:-$ROOT/research/oss/clothcraft}"
if [[ ! -f "$CLOTHCRAFT_SOURCE/Cargo.toml" && -f "$ROOT/../Cargo.toml" ]]; then
  CLOTHCRAFT_SOURCE="$(cd "$ROOT/.." && pwd)"
fi
test -f "$CLOTHCRAFT_SOURCE/Cargo.toml" || { echo 'ClothCraft Rust sources missing' >&2; exit 1; }
APP="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO Sample 3D ClothCraft.app}"
RES="$APP/Contents/Resources"
mkdir -p "$RES/bin" "$RES/integrations/clothcraft" "$RES/native_cpp/build-cmake" \
  "$RES/research/oss/clothcraft/target/debug" "$RES/research/oss/clothcraft/assets/makehuman" \
  "$RES/collision-avatars" "$APP/Contents/MacOS"

# Use the exact tested production assets, not a Vite development-server page.
VITE_CLOTHCRAFT_BRIDGE_URL="${EXO_BUILD_BRIDGE_URL:-http://127.0.0.1:5283}" npm run build
rsync -a --delete dist/ "$RES/web/"

# The distributed fork excludes Thomas, including private assets installed
# elsewhere on this computer. Only independently licensed optional avatars
# may be copied into an explicitly local build.
rm -f "$RES/collision-avatars/thomas-body.obj" "$RES/web/avatars/clo-thomas.glb"
if [[ "${EXO_INCLUDE_PERSONAL_AVATARS:-0}" == "1" ]]; then
  AVATAR_ROOT="${EXO_PERSONAL_AVATAR_ROOT:-$ROOT/../garment-studio/public/avatars}"
  mkdir -p "$RES/web/avatars/opensew"
  for character in theo nora; do
    if [[ -s "$AVATAR_ROOT/opensew/$character.glb" ]]; then
      cp "$AVATAR_ROOT/opensew/$character.glb" "$RES/web/avatars/opensew/$character.glb"
    fi
  done
  if [[ -f "$AVATAR_ROOT/opensew/README.md" ]]; then
    cp "$AVATAR_ROOT/opensew/README.md" "$RES/web/avatars/opensew/README.md"
  fi
else
  rm -f "$RES/collision-avatars/thomas-body.obj" "$RES/web/avatars/clo-thomas.glb" \
    "$RES/web/avatars/opensew/theo.glb" "$RES/web/avatars/opensew/nora.glb"
fi
python3 integrations/clothcraft/prepare_avatar_collider.py public/avatars/makehuman-base.obj \
  "$RES/collision-avatars/makehuman-body.obj" --body-name body

NODE_BIN="${EXO_NODE_BIN:-$(command -v node)}"
test -x "$NODE_BIN"
cp "$NODE_BIN" "$RES/bin/node"
chmod 755 "$RES/bin/node"
for file in bridge.mjs server.mjs contact_run.mjs workspace.mjs static.mjs agent-api.mjs; do
  cp "integrations/clothcraft/$file" "$RES/integrations/clothcraft/$file"
done
cp native_cpp/build-cmake/garment_cad_cli "$RES/native_cpp/build-cmake/garment_cad_cli"
for binary in cloth-template cloth-fit exo-session; do
  cp "$CLOTHCRAFT_SOURCE/target/debug/$binary" "$RES/research/oss/clothcraft/target/debug/$binary"
done
cp "$CLOTHCRAFT_SOURCE/Cargo.toml" "$RES/research/oss/clothcraft/Cargo.toml"
cp "$CLOTHCRAFT_SOURCE/LICENSE" "$RES/research/oss/clothcraft/LICENSE"
cp "$CLOTHCRAFT_SOURCE/assets/makehuman/mannequin.obj" "$RES/research/oss/clothcraft/assets/makehuman/mannequin.obj"
cp "$CLOTHCRAFT_SOURCE/assets/makehuman/LICENSE.ASSETS.md" "$RES/research/oss/clothcraft/assets/makehuman/LICENSE.ASSETS.md"

xcrun swiftc -parse-as-library -O -target "arm64-apple-macos13.0" -framework AppKit -framework WebKit \
  "${EXO_DESKTOP_SWIFT_SOURCE:-integrations/clothcraft/macos/EXOClothCraft.swift}" -o "$APP/Contents/MacOS/EXOClothCraft"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.mikristian.exo.clothcraft.personal</string>
  <key>CFBundleName</key><string>EXO Sample 3D ClothCraft</string>
  <key>CFBundleDisplayName</key><string>EXO Sample 3D</string>
  <key>CFBundleExecutable</key><string>EXOClothCraft</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
chmod 755 "$APP/Contents/MacOS/EXOClothCraft" "$RES/native_cpp/build-cmake/garment_cad_cli" \
  "$RES/research/oss/clothcraft/target/debug/cloth-template" "$RES/research/oss/clothcraft/target/debug/cloth-fit"
/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/plutil -lint "$APP/Contents/Info.plist"
echo "Built macOS application: $APP"
