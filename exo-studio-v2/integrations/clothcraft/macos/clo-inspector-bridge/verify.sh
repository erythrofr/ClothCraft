#!/bin/bash
set -euo pipefail
APP="$HOME/Applications/EXO CLO Inspector.app"
REPORT="$HOME/Library/Application Support/EXO-CLO-Inspector/latest-status.json"
test -d "$APP" || { echo 'EXO CLO Inspector.app is not installed'; exit 2; }
codesign --verify --strict "$APP"
open -n -a "$APP"
for i in {1..45}; do
  sleep 0.2
  if [[ -s "$REPORT" ]] && [[ $(stat -f '%m' "$REPORT") -ge $(( $(date +%s) - 15 )) ]]; then
    break
  fi
done
test -s "$REPORT" || { echo 'Inspector failed to return a report'; exit 3; }
/usr/bin/python3 - "$REPORT" <<'PY'
import json,sys
from pathlib import Path
report=json.loads(Path(sys.argv[1]).read_text())
print('Signed native helper:',report['identifier'])
print('CLO running PID:',report.get('cloPID'))
print('Accessibility authorized:',report['accessibility'])
print('Screen Recording authorized:',report['screenRecording'])
print('CLO windows:',report['cloWindowCount'])
print('CLO screenshot:',report.get('screenshotPath') or 'unavailable')
for warning in report['warnings']:
    print('Warning:',warning)
if not report['accessibility'] or not report['screenRecording']:
    print('Next step: enable EXO CLO Inspector in macOS Privacy & Security.')
    sys.exit(4)
if report['cloWindowCount']==0 or not report.get('screenshotPath'):
    sys.exit(5)
PY
