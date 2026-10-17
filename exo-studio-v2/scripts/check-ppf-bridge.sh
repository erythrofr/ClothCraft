#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
if [[ ! -x "$BLENDER" ]]; then
  echo "PPF bridge check skipped: Blender not found at $BLENDER" >&2
  exit 0
fi
cd "$ROOT"
node scripts/check-ppf-payload.mjs >/tmp/garment-studio-ppf-payload.json
node scripts/export-ppf-fixture.mjs tee blender_bridge/fixtures/tee.ppf.json >/tmp/garment-studio-ppf-fixture.json
"$BLENDER" --background --factory-startup --python blender_bridge/ppf_prepare_scene.py -- \
  --input blender_bridge/fixtures/tee.ppf.json \
  --output blender_bridge/output/tee-ppf.blend >/tmp/garment-studio-ppf-blender.log 2>&1
"$BLENDER" --background --factory-startup blender_bridge/output/tee-ppf.blend \
  --python blender_bridge/check_ppf_blend.py -- 500 768 98
