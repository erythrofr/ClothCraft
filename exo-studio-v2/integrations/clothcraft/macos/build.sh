#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
APP="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO Sample 3D ClothCraft.app}"
RES="$APP/Contents/Resources"
mkdir -p "$RES/bin" "$RES/integrations/clothcraft" "$RES/native_cpp/build-cmake" \
  "$RES/research/oss/clothcraft/target/debug" "$RES/research/oss/clothcraft/assets/makehuman" \
  "$RES/collision-avatars" "$APP/Contents/MacOS"

# Build into a private staging directory. Other EXO development/QA processes
# can concurrently rebuild dist/, so copying shared dist/ could ship a partial
# app or a bundle configured for the developer's 5193 bridge.
STAGED_WEB="$(mktemp -d "$ROOT/integrations/clothcraft/output/release-v2-web-XXXXXXXX")"
trap 'rm -rf "$STAGED_WEB"' EXIT
EXPECTED_BRIDGE="${EXO_BUILD_BRIDGE_URL:-http://127.0.0.1:5283}"
VITE_CLOTHCRAFT_BRIDGE_URL="$EXPECTED_BRIDGE" npm run build -- --outDir "$STAGED_WEB"
test -s "$STAGED_WEB/index.html"
if ! grep -rlq --fixed-strings "$EXPECTED_BRIDGE" "$STAGED_WEB/assets"; then
  echo "Incorrect native bridge URL in staged web app: $EXPECTED_BRIDGE" >&2
  exit 1
fi
rsync -a --delete "$STAGED_WEB/" "$RES/web/"
for required in index.html fabric-scans/denim_fabric_06/color.jpg \
  hardware-thumbnails/four-hole-shirt-button.png \
  library-3d/MIKRISTIAN_Cathedral_House.glb \
  avatars/preview/clo-thomas.glb \
  hangers/wood.png hangers/chrome.png hangers/velvet.png \
  hangers/padded.png hangers/trouser-clip.png \
  hangers/innerscene-shoulder-form.glb hangers/innerscene-clip-rail.glb \
  hardware-premium/d-ring.glb hardware-premium/d-ring.png \
  hardware-premium/prong-buckle.glb hardware-premium/prong-buckle.png \
  hardware-premium/slide-adjuster.glb hardware-premium/slide-adjuster.png; do
  if [[ ! -s "$RES/web/$required" ]]; then
    echo "Incomplete EXO desktop web asset copy: $required" >&2
    exit 1
  fi
done

# Personal offline build only: the user's existing private CLO export and CC0
# MPFB avatars live outside this tracked Git worktree. Never add them to Git
# or the public release. Missing files stay unavailable in the UI.
if [[ "${EXO_INCLUDE_PERSONAL_AVATARS:-1}" == "1" ]]; then
  AVATAR_ROOT="${EXO_PERSONAL_AVATAR_ROOT:-$ROOT/../garment-studio/public/avatars}"
  THOMAS_OBJ="${EXO_PERSONAL_THOMAS_OBJ:-$ROOT/../garment-studio/native_app/assets/clo-thomas.obj}"
  if [[ -s "$AVATAR_ROOT/clo-thomas.glb" ]]; then
    cp "$AVATAR_ROOT/clo-thomas.glb" "$RES/web/avatars/clo-thomas.glb"
    echo "Included local user-owned Thomas avatar in personal .app only"
  else
    echo "Thomas private export unavailable; its UI option will be disabled" >&2
  fi
  mkdir -p "$RES/web/avatars/opensew"
  for character in theo nora; do
    if [[ -s "$AVATAR_ROOT/opensew/$character.glb" ]]; then
      cp "$AVATAR_ROOT/opensew/$character.glb" "$RES/web/avatars/opensew/$character.glb"
    fi
  done
  if [[ -f "$AVATAR_ROOT/opensew/README.md" ]]; then
    cp "$AVATAR_ROOT/opensew/README.md" "$RES/web/avatars/opensew/README.md"
  fi
  if [[ -s "$THOMAS_OBJ" ]]; then
    python3 integrations/clothcraft/prepare_avatar_collider.py "$THOMAS_OBJ" "$RES/collision-avatars/thomas-body.obj"
    echo "Prepared local body-only CLO Thomas collider without committing the source"
  else
    rm -f "$RES/collision-avatars/thomas-body.obj"
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
for file in bridge.mjs server.mjs contact_run.mjs workspace.mjs static.mjs agent-api.mjs mcp-server.mjs; do
  cp "integrations/clothcraft/$file" "$RES/integrations/clothcraft/$file"
done
cp native_cpp/build-cmake/garment_cad_cli "$RES/native_cpp/build-cmake/garment_cad_cli"
for binary in cloth-template cloth-fit exo-session; do
  cp "research/oss/clothcraft/target/debug/$binary" "$RES/research/oss/clothcraft/target/debug/$binary"
done
cp research/oss/clothcraft/Cargo.toml "$RES/research/oss/clothcraft/Cargo.toml"
cp research/oss/clothcraft/LICENSE "$RES/research/oss/clothcraft/LICENSE"
cp research/oss/clothcraft/assets/makehuman/mannequin.obj "$RES/research/oss/clothcraft/assets/makehuman/mannequin.obj"
cp research/oss/clothcraft/assets/makehuman/LICENSE.ASSETS.md "$RES/research/oss/clothcraft/assets/makehuman/LICENSE.ASSETS.md"

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
