#!/bin/bash
# Update only hashed Vite JS/CSS and the entrypoint inside the existing V2 app.
# Large stage/avatar/texture libraries and the native Rust solver are preserved.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio V2.app}"
WEB="$APP/Contents/Resources/web"
BACKUPS="$HOME/Library/Application Support/EXO-ClothCraft-Studio-V2/Backups"
[[ -s "$WEB/index.html" ]] || { echo "Installed V2 web entrypoint missing" >&2; exit 1; }
[[ -s "$ROOT/dist/index.html" ]] || { echo "Run npm run build first" >&2; exit 1; }
grep -rlqF 'http://127.0.0.1:5385' "$ROOT/dist/assets" || {
  echo "Refusing bundle without the V2 native bridge URL" >&2; exit 1;
}
mkdir -p "$BACKUPS"
BACKUP="$(mktemp -d "$BACKUPS/web-assets-incremental-XXXXXXXX")"
cp "$WEB/index.html" "$BACKUP/index.html"
cp -R "$ROOT/dist/assets/." "$WEB/assets/"
TEMP_ENTRY="$(mktemp "$WEB/.index-XXXXXXXX")"
cp "$ROOT/dist/index.html" "$TEMP_ENTRY"
mv "$TEMP_ENTRY" "$WEB/index.html"
if ! /usr/bin/codesign --force --deep --sign - "$APP" ||
   ! /usr/bin/codesign --verify --deep --strict "$APP"; then
  cp "$BACKUP/index.html" "$WEB/index.html"
  /usr/bin/codesign --force --deep --sign - "$APP" || true
  echo "Install failed. Previous entrypoint restored." >&2
  exit 1
fi
echo "Installed incremental V2 web assets. Previous entrypoint: $BACKUP/index.html"
