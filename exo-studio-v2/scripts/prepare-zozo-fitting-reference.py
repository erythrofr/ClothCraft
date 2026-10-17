#!/usr/bin/env python3
"""Reproduce the exact upstream fitting notebook with local Codim-IPC assets.

Only replace its network-dependent sparse clone with the already downloaded
Codim-IPC path. Physics, stitching, body animation and solver calls stay intact.
This script does not execute the costly 240-frame simulation.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
upstream = root / 'research/oss/ppf-contact-solver/examples/fitting.ipynb'
assets = root / 'research/oss/Codim-IPC'
output = root / 'research/ppf-local/fitting-reproduction/fitting-local.ipynb'
assert (assets / 'Projects/FEMShell/input/dress_knife/stage.obj').is_file()
assert (assets / 'Projects/FEMShell/input/Rumba_Dancing/shell0.obj').is_file()
assert (assets / 'Projects/FEMShell/input/Rumba_Dancing/shell1.obj').is_file()
notebook = json.loads(upstream.read_text())
replaced = 0
for cell in notebook['cells']:
    src = ''.join(cell.get('source', []))
    if 'app.extra.sparse_clone(' not in src:
        continue
    start = src.index('# sparse clone only needed directories from the repository')
    end = src.index('stage_path =', start)
    src = src[:start] + f'# Use the locally installed exact Codim-IPC example assets.\ncodim_ipc_root = {str(assets)!r}\n\n' + src[end:]
    cell['source'] = src.splitlines(keepends=True)
    replaced += 1
assert replaced == 1, 'Upstream notebook clone block changed; manual review required'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(notebook, indent=1) + '\n')
print(json.dumps({'notebook':str(output),'upstream':str(upstream),'bodyFrames':len(list((assets / 'Projects/FEMShell/input/Rumba_Dancing').glob('shell*.obj'))),'sourceCells':len(notebook['cells']),'networkCloneRemoved':True}))
