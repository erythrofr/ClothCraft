#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
if [[ ! -x "$BLENDER" ]]; then
  echo "Blender bridge check skipped: Blender executable not found at $BLENDER" >&2
  exit 0
fi
cd "$ROOT"
node scripts/export-blender-fixture.mjs tee blender_bridge/fixtures/tee.garment.json >/tmp/garment-studio-blender-fixture.json
"$BLENDER" --background --factory-startup --python blender_bridge/import_garment.py -- \
  --input blender_bridge/fixtures/tee.garment.json \
  --output blender_bridge/output/tee.blend >/tmp/garment-studio-blender-import.log 2>&1
"$BLENDER" --background --factory-startup blender_bridge/output/tee.blend --python blender_bridge/check_blend.py -- 4 14 0

# Regression: the rigged CC0 Theo fitting avatar must survive the same bridge
# while keeping Garment Studio's analytic collision body as the fit reference.
node - <<'NODE'
const fs = require('fs')
const input = 'blender_bridge/fixtures/tee.garment.json'
const output = '/tmp/tee-theo.garment.json'
const project = JSON.parse(fs.readFileSync(input, 'utf8'))
project.avatar = { ...project.avatar, model: 'theo', name: 'Theo Fitting', armAngleDeg: 60 }
fs.writeFileSync(output, JSON.stringify(project, null, 2))
NODE
"$BLENDER" --background --factory-startup --python blender_bridge/import_garment.py -- \
  --input /tmp/tee-theo.garment.json \
  --output blender_bridge/output/tee-theo.blend >/tmp/garment-studio-blender-theo-import.log 2>&1
"$BLENDER" --background --factory-startup blender_bridge/output/tee-theo.blend --python blender_bridge/check_blend.py -- 4 14 0

node scripts/export-native-sim-fixture.mjs tee native_backend/fixtures/tee.native-sim.json >/tmp/garment-studio-native-fixture.json
BIN="$(native_backend/scripts/build_garment_xpbd_cli.sh 2>/dev/null | tail -1)"
"$BIN" native_backend/fixtures/tee.native-sim.json native_backend/output/tee.native-result.json 60 >/tmp/garment-studio-native-solve.json
"$BLENDER" --background --factory-startup --python blender_bridge/import_garment.py -- \
  --input blender_bridge/fixtures/tee.garment.json \
  --simulation-result native_backend/output/tee.native-result.json \
  --simulation-payload native_backend/fixtures/tee.native-sim.json \
  --output blender_bridge/output/tee-native.blend >/tmp/garment-studio-blender-native-import.log 2>&1
"$BLENDER" --background --factory-startup blender_bridge/output/tee-native.blend --python blender_bridge/check_blend.py -- 4 14 4
