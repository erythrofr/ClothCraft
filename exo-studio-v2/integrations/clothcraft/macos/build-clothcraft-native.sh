#!/bin/bash
set -euo pipefail

# Build a completely separate native ClothCraft.app without editing upstream.
# It wraps the real Rust/egui desktop binary, not a web browser or EXO.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="${CLOTHCRAFT_SOURCE:-$ROOT/research/oss/clothcraft}"
APP="${CLOTHCRAFT_APP_DEST:-$HOME/Applications/ClothCraft.app}"
BIN="$SRC/target/debug/cloth-fit"
RES="$APP/Contents/Resources"
MAC="$APP/Contents/MacOS"

if [[ ! -x "$BIN" ]]; then
  echo "Native ClothCraft desktop binary not found at $BIN" >&2
  echo "Build it with cargo build --locked -j 2 --bin cloth-fit (desktop feature enabled)." >&2
  exit 1
fi

mkdir -p "$MAC" "$RES/bin" "$RES/assets/makehuman"
cp "$BIN" "$RES/bin/cloth-fit"
cp "$SRC/assets/makehuman/mannequin.obj" "$RES/assets/makehuman/mannequin.obj"
cp "$SRC/assets/makehuman/LICENSE.ASSETS.md" "$RES/assets/makehuman/LICENSE.ASSETS.md"
cp "$SRC/LICENSE" "$RES/LICENSE"
chmod 755 "$RES/bin/cloth-fit"

cat > "$MAC/ClothCraft" <<'LAUNCH'
#!/bin/bash
set -euo pipefail
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
WORK="$HOME/Library/Application Support/ClothCraft/Workspace"
LOGS="$HOME/Library/Logs/ClothCraft"
mkdir -p "$WORK" "$LOGS"
cd "$RES"
export RUST_BACKTRACE=1

# Loading the previous export is opt-in in ClothCraft itself. Reopen a previously
# exported fitting-project.json when available; otherwise start a new mannequin.
if [[ -s "$WORK/fitting-project.json" ]]; then
  exec "$RES/bin/cloth-fit" --steps 0 --view --project "$WORK/fitting-project.json" \
    --output "$WORK" >> "$LOGS/clothcraft.log" 2>&1
fi
exec "$RES/bin/cloth-fit" --steps 0 --view \
  --avatar "$RES/assets/makehuman/mannequin.obj" --output "$WORK" \
  >> "$LOGS/clothcraft.log" 2>&1
LAUNCH
chmod 755 "$MAC/ClothCraft"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.mikristian.clothcraft.local</string>
  <key>CFBundleName</key><string>ClothCraft</string>
  <key>CFBundleDisplayName</key><string>ClothCraft</string>
  <key>CFBundleExecutable</key><string>ClothCraft</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleIconFile</key><string>ClothCraft</string>
</dict></plist>
PLIST

# Use upstream's own logo as the Dock/Finder icon. Regenerate on every rebuild.
ICON="$SRC/assets/branding/clothcraft-icon.png"
if [[ -f "$ICON" ]] && command -v iconutil >/dev/null && command -v sips >/dev/null; then
  ICONSET="$(mktemp -d -t clothcraft-icon).iconset"
  mkdir -p "$ICONSET"
  for size in 16 32 128 256 512; do
    sips -s format png -z "$size" "$size" "$ICON" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    double=$((size*2))
    sips -s format png -z "$double" "$double" "$ICON" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  done
  if ! iconutil -c icns "$ICONSET" -o "$RES/ClothCraft.icns"; then
    echo 'Icon conversion failed; app will still have its native window' >&2
  fi
  rm -rf "$ICONSET"
fi

/usr/bin/plutil -lint "$APP/Contents/Info.plist"
/usr/bin/codesign --force --deep --sign - "$APP"
echo "Ready: $APP"
echo "Workspace: ~/Library/Application Support/ClothCraft/Workspace"
echo "Rust window logs: ~/Library/Logs/ClothCraft/clothcraft.log"
