#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
RUNTIME="${PPF_RUNTIME:-$ROOT/research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64}"
TEMPLATE="${PPF_TEMPLATE:-tee}"
PORT="${PPF_PORT:-19140}"
FRAMES="${PPF_FRAMES:-10}"
RUN_TIMEOUT="${PPF_RUN_TIMEOUT:-180}"
MIN_TORSO_DEPTH="${PPF_MIN_TORSO_DEPTH:-0.16}"
MIN_ARM_OFFSET="${PPF_MIN_ARM_OFFSET:-0.51}"
MIN_FREE_KB="${PPF_MIN_FREE_KB:-4194304}"

if [[ ! -x "$BLENDER" ]]; then
  echo "PPF Metal check skipped: Blender not found at $BLENDER" >&2
  exit 0
fi
if [[ ! -x "$RUNTIME/target/release/ppf-cts-server" || ! -x "$RUNTIME/target/release/ppf-contact-solver" ]]; then
  echo "PPF Metal check skipped: runtime not found at $RUNTIME" >&2
  exit 0
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "PPF Metal check skipped: macOS required" >&2
  exit 0
fi
if pgrep -f 'ppf-cts-server|ppf-contact-solver|Blender.*ppf_run_configured.py' >/dev/null 2>&1; then
  echo "PPF Metal check refused: another PPF test/solver is already active. Stop it before running this isolated regression." >&2
  exit 3
fi

FREE_KB=$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')
if [[ -z "$FREE_KB" || "$FREE_KB" -lt "$MIN_FREE_KB" ]]; then
  echo "PPF Metal check refused: only ${FREE_KB:-unknown} KiB free; require at least $MIN_FREE_KB KiB (default 4 GiB)." >&2
  exit 4
fi

PPF_PROJECT_ROOT="$RUNTIME/local/share/ppf-cts/git-main"
cleanup_ppf_test_sessions() {
  # A Blender-side failure can occur after it spawned the native server but
  # before it had a chance to disconnect. This test owns the selected port and
  # refuses concurrent PPF work at startup, so it is safe to reap that port and
  # any matching solver child here.
  pkill -f "ppf-cts-server --port $PORT" 2>/dev/null || true
  pkill -f 'ppf-contact-solver --path .*garment_studio_ppf_' 2>/dev/null || true
  sleep 0.2
  # This regression refuses to start while any other PPF solve is active, so
  # its project directories are isolated and safe to remove after the result
  # has been copied into blender_bridge/output.
  if ! pgrep -f 'ppf-cts-server|ppf-contact-solver|Blender.*ppf_run_configured.py' >/dev/null 2>&1; then
    rm -rf "$PPF_PROJECT_ROOT"/garment_studio_ppf_* 2>/dev/null || true
  fi
}
trap cleanup_ppf_test_sessions EXIT

mkdir -p blender_bridge/fixtures blender_bridge/output
BASE="blender_bridge/fixtures/${TEMPLATE}-ppf-metal-base.json"
TUNED="blender_bridge/fixtures/${TEMPLATE}-ppf-metal-tuned.json"
CONFIGURED="blender_bridge/output/${TEMPLATE}-ppf-metal-configured.blend"
SOLVED="blender_bridge/output/${TEMPLATE}-ppf-metal-solved.blend"
REPORT="blender_bridge/output/${TEMPLATE}-ppf-metal-report.json"
INTERSECTIONS="blender_bridge/output/${TEMPLATE}-ppf-metal-intersections.json"
SEWING_REPORT="blender_bridge/output/${TEMPLATE}-ppf-metal-sewing-report.json"
CONTACT_REPORT="blender_bridge/output/${TEMPLATE}-ppf-metal-contact-report.json"

node scripts/export-exploded-ppf-fixture.mjs "$TEMPLATE" "$BASE" "$FRAMES" >/tmp/garment-studio-ppf-fixture.json
"$BLENDER" --background --factory-startup --python blender_bridge/tune_ppf_staging.py -- \
  --input "$BASE" --output "$TUNED" \
  --min-torso-depth "$MIN_TORSO_DEPTH" --min-arm-offset "$MIN_ARM_OFFSET" \
  >/tmp/garment-studio-ppf-tune.log 2>&1
"$BLENDER" --background --factory-startup --python blender_bridge/diagnose_ppf_intersections.py -- \
  --input "$TUNED" --report "$INTERSECTIONS" >/tmp/garment-studio-ppf-intersections.log 2>&1
node --input-type=module - <<NODE
import fs from 'node:fs'
const report=JSON.parse(fs.readFileSync('$INTERSECTIONS','utf8'))
if(report.nonAdjacentIntersections!==0) throw new Error('PPF staging still has '+report.nonAdjacentIntersections+' non-adjacent self intersections')
const payload=JSON.parse(fs.readFileSync('$TUNED','utf8'))
if(payload.scene.frameCount<10) throw new Error('PPF frameCount must be >= 10')
const vs=payload.shell.vertices
const ds=(payload.shell.stitchEdges||[]).map(e=>{const a=vs[e.a],b=vs[e.b];return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])})
console.log(JSON.stringify({staging:payload.scene.staging,intersections:report.nonAdjacentIntersections,stitchMeanM:ds.reduce((a,b)=>a+b,0)/Math.max(1,ds.length),stitchMaxM:Math.max(0,...ds),frameCount:payload.scene.frameCount},null,2))
NODE

"$BLENDER" --background --python blender_bridge/ppf_prepare_scene.py -- \
  --input "$TUNED" --output "$CONFIGURED" --configure-addon \
  >/tmp/garment-studio-ppf-prepare.log 2>&1

# The garment self-intersection preflight does not detect cloth penetrating
# avatar colliders. Run the *same* body-contact audit used after solving
# before spending GPU time on an invalid starting configuration.
INITIAL_CONTACT="blender_bridge/output/${TEMPLATE}-ppf-metal-initial-contact.json"
"$BLENDER" --background "$CONFIGURED" --python blender_bridge/check_ppf_dynamic_contact.py -- \
  --payload "$TUNED" --initial-only --report "$INITIAL_CONTACT" \
  >/tmp/garment-studio-ppf-initial-contact.log 2>&1
python3 - "$INITIAL_CONTACT" <<'PY'
import json, sys
r=json.load(open(sys.argv[1]))
frame=r['perFrame'][0]
if frame['avatarTriangleIntersectionPairs'] or frame['clothSelfIntersectionPairs']:
    raise SystemExit('PPF preflight rejected: garment starts with avatar crossings '
        f"{frame['avatarTriangleIntersectionPairs']} or self crossings {frame['clothSelfIntersectionPairs']}; "
        'adjust staging before invoking the expensive Metal solver')
print('PPF preflight: zero avatar and garment triangle crossings at initial pose')
PY

START=$(date +%s)
"$BLENDER" --background "$CONFIGURED" --python blender_bridge/ppf_run_configured.py -- \
  --runtime "$RUNTIME" --output "$SOLVED" --report "$REPORT" --port "$PORT" --device GPU \
  --connect-timeout 90 --build-timeout 180 --run-timeout "$RUN_TIMEOUT" --fetch-timeout 180
END=$(date +%s)

node --input-type=module - <<NODE
import fs from 'node:fs'
const report=JSON.parse(fs.readFileSync('$REPORT','utf8'))
if(!report.ok) throw new Error('PPF Metal report failed: '+JSON.stringify(report))
if(!report.pc2?.finite) throw new Error('PPF PC2 output is not finite')
if(!(report.pc2?.samples>=9)) throw new Error('PPF PC2 output has too few samples: '+report.pc2?.samples)
console.log(JSON.stringify({...report,wallSeconds:${END}-${START}},null,2))
NODE

# A valid PC2 cache is insufficient to demonstrate sewing. Read every actual
# simulated frame and verify that paired seam vertices moved toward one another.
node scripts/analyze-ppf-sewing.mjs "$TUNED" "$REPORT" "$SEWING_REPORT"
PC2_PATH=$(node -p "JSON.parse(require('fs').readFileSync('$REPORT', 'utf8')).pc2.path")
"$BLENDER" --background "$SOLVED" --python blender_bridge/check_ppf_dynamic_contact.py -- \
  --payload "$TUNED" --pc2 "$PC2_PATH" --report "$CONTACT_REPORT"
