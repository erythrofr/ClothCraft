#!/bin/bash
# Install current Vite UI into EXO ClothCraft Studio V2 without replacing its
# running Rust solver, native executable, or saved user workspace.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio V2.app}"
RES="$APP/Contents/Resources"
[[ -d "$RES/web" ]] || { echo "V2 app web bundle missing: $RES/web" >&2; exit 1; }
BACKUP_ROOT="$HOME/Library/Application Support/EXO-ClothCraft-Studio-V2/Backups"
mkdir -p "$BACKUP_ROOT"
BACKUP="$BACKUP_ROOT/web-before-$(date +%Y%m%d-%H%M%S)"
STAGED_WEB="$(mktemp -d "$RES/.exo-web-staged-XXXXXXXX")"
INSTALLED=0
cleanup(){
  if [[ "$INSTALLED" == 0 && -d "$BACKUP" && ! -d "$RES/web" ]]; then mv "$BACKUP" "$RES/web"; fi
  if [[ -d "$STAGED_WEB" ]]; then rm -rf "$STAGED_WEB"; fi
}
trap cleanup EXIT
cd "$ROOT"
VITE_CLOTHCRAFT_BRIDGE_URL='http://127.0.0.1:5385' npm run build -- --outDir "$STAGED_WEB"
[[ -s "$STAGED_WEB/index.html" ]]
grep -rlqF 'http://127.0.0.1:5385' "$STAGED_WEB/assets" || {
  echo 'V2 web bundle has incorrect Rust bridge URL' >&2; exit 1;
}
[[ -s "$STAGED_WEB/fabric-scans/denim_fabric_06/color.jpg" ]]
[[ -s "$STAGED_WEB/library-3d/MIKRISTIAN_Cathedral_House.glb" ]]
mv "$RES/web" "$BACKUP"
mv "$STAGED_WEB" "$RES/web"
if ! /usr/bin/codesign --force --deep --sign - "$APP" || ! /usr/bin/codesign --verify --deep --strict "$APP"; then
  echo 'Code signing failed; restoring the previous V2 web bundle.' >&2
  mv "$RES/web" "$STAGED_WEB"
  mv "$BACKUP" "$RES/web"
  /usr/bin/codesign --force --deep --sign - "$APP" || true
  exit 1
fi
INSTALLED=1
echo "Installed V2 web UI; previous web bundle retained at $BACKUP"
