#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BLENDER="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
SCENE=blender_bridge/output/jarvis-upstream-fitting-solved.blend
PAYLOAD=blender_bridge/fixtures/jarvis-upstream-fitting.ppf.json
PC2="$(python3 -c 'import json;print(json.load(open("blender_bridge/output/jarvis-upstream-fitting-solve.json"))["pc2"]["path"])')"
test -s "$BLENDER" && test -s "$SCENE" && test -s "$PAYLOAD" && test -s "$PC2"
ORIGINAL_SHA="$(shasum -a 256 "$PC2" "$SCENE")"
TMPDIR_GUARD="$(mktemp -d "${TMPDIR:-/tmp}/gs-thomas-ipc.XXXXXX")"
trap 'rm -rf "$TMPDIR_GUARD"' EXIT

"$BLENDER" --background --python-exit-code 1 "$SCENE" --python blender_bridge/guard_ppf_thomas_trajectory.py -- \
  --payload "$PAYLOAD" --pc2 "$PC2" --output "$TMPDIR_GUARD/guarded.pc2" \
  --report "$TMPDIR_GUARD/guarded.json" --max-steps 4 >"$TMPDIR_GUARD/guard.log" 2>&1

"$BLENDER" --background --python-exit-code 1 "$SCENE" --python blender_bridge/check_thomas_ipc_ccd.py -- \
  --payload "$PAYLOAD" --pc2 "$TMPDIR_GUARD/guarded.pc2" \
  --report "$TMPDIR_GUARD/verified-ipc.json" >"$TMPDIR_GUARD/ipc.log" 2>&1

"$BLENDER" --background --python-exit-code 1 "$SCENE" --python blender_bridge/check_ppf_dynamic_contact.py -- \
  --payload "$PAYLOAD" --pc2 "$TMPDIR_GUARD/guarded.pc2" \
  --report "$TMPDIR_GUARD/verified-dynamic.json" >"$TMPDIR_GUARD/dynamic.log" 2>&1

python3 - "$TMPDIR_GUARD" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
a=json.loads((p/'guarded.json').read_text())
b=json.loads((p/'verified-ipc.json').read_text())
c=json.loads((p/'verified-dynamic.json').read_text())
assert a['frames']==5 and a['guardedTransitions']==2
assert a['physicalFitApproved'] is False and a['clothSelfCcdVerified'] is False
assert b['allTestedStepsCollisionFree'] and b['firstBlockedFrame'] is None
assert c['allFramesSelfIntersectionFree'] and c['allFramesAvatarIntersectionFree']
assert c['allFramesWithinStrainLimit']
print('Verified five-frame prototype:',json.dumps({'sweptBodySafe':True,'sampledSelfSafe':True,'maxPrincipalStretch':c['maxPrincipalStretch']}))
PY

# The full-length simulation must not be declared a success: it stalls under
# collision-constrained step clipping. --python-exit-code makes Blender errors
# propagate to CI, unlike Blender's default background return code.
if "$BLENDER" --background --python-exit-code 1 "$SCENE" --python blender_bridge/guard_ppf_thomas_trajectory.py -- \
  --payload "$PAYLOAD" --pc2 "$PC2" --output "$TMPDIR_GUARD/rejected.pc2" \
  --report "$TMPDIR_GUARD/rejected.json" >"$TMPDIR_GUARD/rejected.log" 2>&1; then
  echo 'ERROR: full source trajectory unexpectedly passed the guarded fit test' >&2
  exit 1
fi
grep -q 'would stall' "$TMPDIR_GUARD/rejected.log"
test ! -e "$TMPDIR_GUARD/rejected.pc2"
test ! -e "$TMPDIR_GUARD/rejected.json"
test "$ORIGINAL_SHA" = "$(shasum -a 256 "$PC2" "$SCENE")"
echo 'PASS: five-frame guard verified; full twelve-frame trajectory rejected; originals unchanged.'
