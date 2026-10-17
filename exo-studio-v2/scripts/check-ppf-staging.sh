#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
FIXTURE="$ROOT/blender_bridge/fixtures/tee-exploded-qa.ppf.json"
REPORT="$ROOT/blender_bridge/output/tee-exploded-qa-intersections.json"

if [[ ! -x "$BLENDER" ]]; then
  echo "PPF staging check skipped: Blender not found at $BLENDER" >&2
  exit 0
fi
cd "$ROOT"
node scripts/export-exploded-ppf-fixture.mjs tee "$FIXTURE" 12 >/dev/null
"$BLENDER" --background --factory-startup --python blender_bridge/diagnose_ppf_intersections.py -- \
  --input "$FIXTURE" --report "$REPORT" >/tmp/garment-studio-ppf-staging.log 2>&1
python3 - "$REPORT" <<'PY'
import json, sys
report=json.load(open(sys.argv[1]))
if report['nonAdjacentIntersections'] != 0:
    raise SystemExit(f"PPF exploded staging has {report['nonAdjacentIntersections']} non-adjacent intersections")
print(json.dumps({
    'vertices': report['vertices'],
    'faces': report['faces'],
    'nonAdjacentIntersections': report['nonAdjacentIntersections'],
    'piecePairs': report['piecePairs'],
}, indent=2))
PY
