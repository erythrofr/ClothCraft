"""Headless installed-upstream fitting reproduction; never certifies Thomas fit."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import random
import signal
import sys
import time
import tomllib
import uuid

p = argparse.ArgumentParser()
p.add_argument('--runtime', required=True)
p.add_argument('--assets', required=True)
p.add_argument('--report', required=True)
p.add_argument('--timeout', type=float, default=300)
a = p.parse_args()
runtime = Path(a.runtime).resolve()
report_path = Path(a.report).resolve()
report_path.parent.mkdir(parents=True, exist_ok=True)
report = {'protocol': 'garment-studio.ppf-reference.v1', 'ok': False,
          'fullPhysicalFitVerified': False, 'runtime': str(runtime),
          'reference': 'https://github.com/st-tech/ppf-contact-solver',
          'adaptations': ['local Codim-IPC assets', 'unique session name',
                          'seeded upstream random body jitter', 'no notebook visualization'],
          'requestedFrames': 240}
def save():
    report_path.write_text(json.dumps(report, indent=2) + '\n')
session = None
lock = None
try:
    lock_path = runtime / 'local/share/ppf-cts/.garment-studio.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock = lock_path.open('a+')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    sys.path.insert(0, str(runtime))
    from frontend import App, set_backend
    set_backend('metal')
    notebook = runtime / 'examples/fitting.ipynb'
    report['notebookSha256'] = hashlib.sha256(notebook.read_bytes()).hexdigest()
    assets = Path(a.assets).resolve()
    paths = [assets / 'Projects/FEMShell/input/dress_knife/stage.obj',
             assets / 'Projects/FEMShell/input/Rumba_Dancing/shell0.obj']
    for path in paths:
        if not path.is_file():
            raise RuntimeError('Missing upstream fitting asset: ' + str(path))
    report['assetSha256'] = {str(path.relative_to(assets)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
    name = 'gs_upstream_fitting_' + uuid.uuid4().hex[:12]
    app = App.create(name)
    V, F, S = app.extra.load_CIPC_stitch_mesh(str(paths[0]))
    report.update(clothVertices=len(V), clothFaces=len(F))
    app.asset.add.tri('dress', V, F)
    app.asset.add.stitch('glue', S)
    V, F = app.mesh.load_tri(str(paths[1]))
    app.asset.add.tri('body', V, F)
    scene = app.scene.create()
    dress = scene.add('dress')
    dress.param.set('young-mod', 100).set('bend', 1.0).set('strain-limit', 0.1)
    dress.stitch('glue').rotate(-90, 'x')
    jitter = .01 * random.Random(0).random()
    body = scene.add('body').at(0, -.78 + jitter, 0)
    pin = body.pin()
    frame = 1
    while (path := paths[1].parent / f'shell{frame}.obj').exists():
        V, _ = app.mesh.load_tri(str(path))
        pin.move_to(V, .5 + .025 * (frame - 1), .5 + .025 * frame)
        frame += 1
    report.update(bodyAnimationFrames=frame, jitter=jitter, sessionName=name)
    scene = scene.build()
    session = app.session.create(scene)
    param = session.param.set('inactive-momentum').set('dt', 1e-3).set('frames', 240)
    param.dyn('inactive-momentum').time(.15).hold().change(False)
    param.dyn('dt').time(.15).hold().change(.01)
    session = session.build()
    report['sessionPath'] = session.info.path
    info = tomllib.loads((Path(session.info.path) / 'info.toml').read_text())
    report['stitchPairs'] = info['count']['stitch']
    report['encodedCounts'] = info['count']
    report['phase'] = 'built'
    save()
    session.start(blocking=False)
    deadline = time.monotonic() + a.timeout
    while session.is_running() and time.monotonic() < deadline:
        time.sleep(.5)
    if session.is_running():
        # Only our unique child, never global Utils.terminate().
        proc = session._process
        os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except Exception:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait(timeout=10)
        raise TimeoutError('Reference run exceeded bounded runtime; partial output preserved')
    report['finished'] = bool(session.finished())
    report['ok'] = report['finished']
    report['phase'] = 'finished' if report['ok'] else 'solver-failed'
    output = Path(session.info.path) / 'output'
    report['nativeFrames'] = len(list(output.glob('vert_*.bin')))
except Exception as exc:
    report['error'] = f'{type(exc).__name__}: {exc}'
finally:
    if session is not None and hasattr(session, 'info'):
        session_path = Path(session.info.path)
        report['nativeFrames'] = len(list((session_path / 'output').glob('vert_*.bin')))
        report['phase'] = 'finished' if report['ok'] else 'incomplete'
    save()
    if lock:
        lock.close()
print(json.dumps(report), flush=True)
sys.exit(0 if report['ok'] else 1)
