#!/bin/bash
# Update ONLY EXO V2's embedded web UI. The installed Swift executable, Rust
# binaries, native workspace and user project files are intentionally retained.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
APP="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio V2.app}"
RES="$APP/Contents/Resources"
EXPECTED_BUNDLE='com.mikristian.exo.clothcraft.workspace.v2'
ACTUAL_BUNDLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist" 2>/dev/null || true)
if [[ "$ACTUAL_BUNDLE" != "$EXPECTED_BUNDLE" || ! -x "$APP/Contents/MacOS/EXOClothCraft" ]];then
  echo 'Refusing web-only installation: EXO V2 application identity not verified' >&2
  exit 1
fi
if [[ ! -s "$RES/integrations/clothcraft/agent-api.mjs" || ! -x "$RES/research/oss/clothcraft/target/debug/exo-session" ]];then
  echo 'Refusing update: installed EXO V2 native service resources missing' >&2
  exit 1
fi

mkdir -p "$ROOT/integrations/clothcraft/output"
BUILD="$(mktemp -d "$ROOT/integrations/clothcraft/output/web-only-v2-XXXXXXXX")"
trap 'rm -rf "$BUILD"' EXIT
echo 'Compiling independent EXO V2 web bundle, keeping the native session unchanged'
VITE_CLOTHCRAFT_BRIDGE_URL=http://127.0.0.1:5385 npm run build -- --outDir "$BUILD"

required_assets=(
  index.html
  stage-scenes/R02.glb
  stage-scenes/R03.glb
  stage-scenes/S01.glb
  stage-scenes/S10.glb
  stage-posters/cathedral.png
  stage-posters/R02.png
  stage-posters/R03.png
  stage-posters/S01.png
  stage-posters/S10.png
  library-3d/MIKRISTIAN_Cathedral_House.glb
  hardware-thumbnails/four-hole-shirt-button.png
  fabric-scans/denim_fabric_06/color.jpg
  fabric-scans/crepe_satin/color.jpg
  avatars/preview/clo-thomas.glb
)
for required in "${required_assets[@]}";do
  if [[ ! -s "$BUILD/$required" ]];then
    echo "Refusing incomplete release, required asset missing: $required" >&2
    exit 1
  fi
done
if ! grep -rlq --fixed-strings 'http://127.0.0.1:5385' "$BUILD/assets" ||
   ! grep -rlq --fixed-strings 'FLAT TEXTURE' "$BUILD/assets" ||
   ! grep -rlq --fixed-strings '3D DRAPE' "$BUILD/assets";then
  echo 'Refusing release: native bridge URL or current flat/draped fabric-preview UI not present' >&2
  exit 1
fi

BACKUP_NAME="${EXO_WEB_BACKUP_NAME:-EXO-V2-web-before-realism-20261017}"
if [[ ! "$BACKUP_NAME" =~ ^[A-Za-z0-9._-]+$ ]];then
  echo 'Refusing invalid backup folder name' >&2
  exit 1
fi
BACKUP="$ROOT/integrations/clothcraft/output/app-backups/$BACKUP_NAME"
if [[ ! -d "$BACKUP" ]];then
  mkdir -p "$BACKUP"
  rsync -a "$RES/web/" "$BACKUP/"
  echo "Preserved old installed web resources: $BACKUP"
fi

echo 'Installing verified web UI without modifying Rust/Swift executables'
rsync -a --delete "$BUILD/" "$RES/web/"
test -s "$RES/web/index.html"
test -s "$RES/web/stage-scenes/R02.glb"
/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/codesign --verify --deep --strict "$APP"
echo 'Verifying signed EXO V2 native bridge and actual 2D pattern editor'
open -a "$APP"
native_smoke_ok=false
for attempt in 1 2; do
  if node scripts/qa-installed-v2-bridge-smoke.mjs;then
    native_smoke_ok=true
    break
  fi
  if [[ "$attempt" == 1 ]];then sleep 3;fi
done
if [[ "$native_smoke_ok" != true ]];then
  echo "Native bridge acceptance failed. Restoring backed-up EXO V2 web resources: $BACKUP" >&2
  rsync -a --delete "$BACKUP/" "$RES/web/"
  /usr/bin/codesign --force --deep --sign - "$APP"
  /usr/bin/codesign --verify --deep --strict "$APP"
  echo 'Restored previous signed web bundle. EXO native binaries were never modified.' >&2
  exit 1
fi
echo "EXO V2 web-only update signed and native-smoke verified: $APP"
