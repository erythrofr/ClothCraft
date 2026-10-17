#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
if [[ ! -x "$BLENDER" ]]; then
  echo "Blender unavailable: $BLENDER" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$ROOT"
node scripts/export-ppf-fixture.mjs tee "$TMP/tee.ppf.json" > /dev/null
"$BLENDER" --background --factory-startup --python blender_bridge/ppf_prepare_scene.py -- \
  --input "$TMP/tee.ppf.json" --output "$TMP/configured.blend" --configure-addon > "$TMP/log.txt" 2>&1 || {
  cat "$TMP/log.txt" >&2
  exit 1
}

python3 - "$TMP/log.txt" "$TMP/configured.blend" <<'PY'
import json
import math
import pathlib
import sys

log = pathlib.Path(sys.argv[1]).read_text()
results = []
for line in log.splitlines():
    if line.startswith('{') and '"strainLimitEnabled"' in line:
        results.append(json.loads(line))
assert results, 'Blender did not report the PPF settings'
result = results[-1]
assert pathlib.Path(sys.argv[2]).is_file(), 'Configured scene was not saved'
assert result['configured'] and result['contactEnabled'], result
assert result['avatarGapAbsolute'], 'Avatar gap must not scale with avatar size'
assert result['strainLimitEnabled'], 'PPF strain limiter silently disabled'
assert math.isclose(result['strainLimitPercent'], 5, abs_tol=1e-5), result
assert math.isclose(result['shellContactGapM'], .001, abs_tol=1e-6), result
assert math.isclose(result['avatarContactGapM'], .001, abs_tol=1e-6), result
assert math.isclose(result['shellContactOffsetM'], 0, abs_tol=1e-6), result
assert math.isclose(result['avatarContactOffsetM'], 0, abs_tol=1e-6), result
assert not result['postSnapExactly'], 'Raw PPF frames must remain unmodified'
print(json.dumps({
    'pass': True,
    'clothGapMm': result['shellContactGapM'] * 1000,
    'avatarGapMm': result['avatarContactGapM'] * 1000,
    'avatarGapAbsolute': result['avatarGapAbsolute'],
    'strainLimitEnabled': result['strainLimitEnabled'],
    'strainLimitPercent': result['strainLimitPercent'],
    'scope': 'Solver configuration only; does not verify an accepted physical fit',
}, indent=2))
PY

# Independent body controls must survive scene compilation; previously a
# second assignment silently replaced them with the cloth values.
python3 - "$TMP/tee.ppf.json" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
d = json.loads(p.read_text())
d['scene']['avatarContactGap'] = .003
d['scene']['avatarContactOffset'] = .0005
d['scene']['avatarRepresentation'] = 'pinned-shell'
p.write_text(json.dumps(d))
PY
"$BLENDER" --background --factory-startup --python blender_bridge/ppf_prepare_scene.py -- \
  --input "$TMP/tee.ppf.json" --output "$TMP/pinned.blend" --configure-addon > "$TMP/pinned.log" 2>&1
python3 - "$TMP/pinned.log" <<'PY'
import json, math, pathlib, sys
rows = [json.loads(s) for s in pathlib.Path(sys.argv[1]).read_text().splitlines()
        if s.startswith('{') and '"strainLimitEnabled"' in s]
assert rows, 'Missing pinned-body configuration report'
r = rows[-1]
assert r['avatarRepresentation'] == 'pinned-shell'
assert math.isclose(r['avatarContactGapM'], .003, abs_tol=1e-7), r
assert math.isclose(r['avatarContactOffsetM'], .0005, abs_tol=1e-7), r
assert math.isclose(r['shellContactGapM'], .001, abs_tol=1e-7), r
print('Pinned body configuration and independent avatar gaps passed')
PY
