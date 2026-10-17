"""Isolated A/B reproduction of ZOZO PPF pin animation for the dress example.

The original Jarvis 240-frame control uses 120 linear move_to operations.
This script keeps source meshes, materials, pinned body, session parameters,
random body jitter and initial geometry unchanged while testing either:
  smooth: same 120 movement keyframes with upstream 'smooth' interpolation
  still:  keep the original pinned body stationary (negative control)

The script never changes the original completed reference session or Thomas's
garment. Uses the same cross-process lock and a unique session identifier;
timeouts terminate only the process created by this script.

Requires the installed PPF Python 3.12 environment.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import random
import signal
import sys
import time
import uuid
from pathlib import Path


def sha256(path):
    hashed=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            hashed.update(chunk)
    return hashed.hexdigest()


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('--runtime', type=Path, required=True)
    cli.add_argument('--assets', type=Path, required=True)
    cli.add_argument('--report', type=Path, required=True)
    cli.add_argument('--policy', choices=['smooth','stationary'], required=True)
    cli.add_argument('--frames', type=int, default=100)
    cli.add_argument('--timeout', type=float, default=300)
    cli.add_argument('--completion-grace', type=float, default=25,
                     help='Max extra seconds for a run already near its last frame')
    args=cli.parse_args()
    if args.frames<91 or args.frames>240:
        raise ValueError('A/B run should include frame 90 and at most 240 frames')
    if args.timeout<10 or not 0<=args.completion_grace<=60:
        raise ValueError('Timeout must be >=10s and completion grace must be within 0..60s')
    runtime=args.runtime.resolve()
    reportpath=args.report.resolve()
    reportpath.parent.mkdir(parents=True, exist_ok=True)
    report={
        'schema':'garment-studio.ppf-pin-policy-experiment.v1',
        'policy':args.policy,
        'runtime':str(runtime),
        'reference':'Original upstream st-tech/ppf-contact-solver fitting.ipynb',
        'framesRequested':args.frames,
        'fullPhysicalFitVerified':False,
        'ok':False,
        'differencesFromOriginal':[
            'output run length changed from 240 to '+str(args.frames),
            ('per-keyframe smooth interpolation (original uses linear)' if args.policy=='smooth'
             else 'pinned body held stationary (original uses linear motion)')],
    }
    def save():
        reportpath.write_text(json.dumps(report, indent=2)+'\n')
    save()
    child=None
    lock=None
    session=None
    try:
        lock_path=runtime/'local/share/ppf-cts/.garment-studio.lock'
        lock_path.parent.mkdir(parents=True,exist_ok=True)
        lock=lock_path.open('a+')
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        sys.path.insert(0,str(runtime))
        from frontend import App,set_backend
        set_backend('metal')

        stage=args.assets.resolve()/'Projects/FEMShell/input/dress_knife/stage.obj'
        source_dir=args.assets.resolve()/'Projects/FEMShell/input/Rumba_Dancing'
        body0=source_dir/'shell0.obj'
        if not stage.is_file() or not body0.is_file():
            raise FileNotFoundError('Missing upstream Codim-IPC dress/body assets')
        notebook=runtime/'examples/fitting.ipynb'
        report.update(inputSha256={'dress':sha256(stage),'body0':sha256(body0),
                                   'notebook':sha256(notebook)},
                      originalRandomSeed=0)

        session_name=f'gs_ppf_pin_{args.policy}_{uuid.uuid4().hex[:12]}'
        app=App.create(session_name)
        V,F,S=app.extra.load_CIPC_stitch_mesh(str(stage))
        app.asset.add.tri('dress',V,F)
        app.asset.add.stitch('glue',S)
        V,F=app.mesh.load_tri(str(body0))
        app.asset.add.tri('body',V,F)
        scene=app.scene.create()
        dress=scene.add('dress')
        dress.param.set('young-mod',100).set('bend',1.0).set('strain-limit',.1)
        dress.stitch('glue').rotate(-90,'x')
        jitter=.01*random.Random(0).random()
        body=scene.add('body').at(0,-.78+jitter,0)
        pin=body.pin()
        count=1
        while (objpath:=source_dir/f'shell{count}.obj').exists():
            if args.policy=='smooth':
                pos,_=app.mesh.load_tri(str(objpath))
                pin.move_to(pos,.5+.025*(count-1),.5+.025*count,transition='smooth')
            count+=1
        report.update(animationInputMeshes=count,randomJitter=jitter,
                      pinMoveOperations=count-1 if args.policy=='smooth' else 0)
        scene=scene.build()
        session=app.session.create(scene)
        settings=session.param.set('inactive-momentum').set('dt',1e-3).set('frames',args.frames)
        settings.dyn('inactive-momentum').time(.15).hold().change(False)
        settings.dyn('dt').time(.15).hold().change(.01)
        session=session.build()
        report['sessionName']=session_name
        report['sessionPath']=session.info.path
        report['state']='built'
        save()
        session.start(blocking=False)
        child=getattr(session,'_process',None)
        started=time.monotonic()
        last_saved=-1
        while session.is_running() and time.monotonic()-started<args.timeout:
            time.sleep(2)
            output=Path(session.info.path)/'output'
            count_saved=len(list(output.glob('vert_*.bin')))
            if count_saved!=last_saved:
                last_saved=count_saved
                report['nativeSamples']=count_saved
                report['state']='running'
                save()
        output=Path(session.info.path)/'output'
        def native_complete():
            # Explicit completion marker plus every requested binary sample.
            # A wrapper may see a run as active just before the solver writes
            # its final frame, so do not destroy a nearly complete run.
            return (output/'finished.txt').is_file() and all(
                (output/f'vert_{i}.bin').is_file() for i in range(args.frames+1))
        if session.is_running() and not native_complete():
            count_now=len(list(output.glob('vert_*.bin')))
            if count_now>=args.frames-12:
                deadline_grace=time.monotonic()+args.completion_grace
                report['state']='completion-grace'
                report['samplesAtDeadline']=count_now
                save()
                while not native_complete() and time.monotonic()<deadline_grace:
                    if not session.is_running():
                        break
                    time.sleep(.5)
        if session.is_running() and not native_complete():
            if child is not None and child.poll() is None:
                child.terminate()  # only this session's child process
                try: child.wait(timeout=10)
                except Exception:
                    child.kill()
                    child.wait(timeout=10)
            raise TimeoutError(f'Bounded {args.policy} session exceeded {args.timeout}s '
                               f'and {args.completion_grace}s of eligible completion grace; raw samples preserved')
        if native_complete() and child is not None and child.poll() is None:
            # Solver sometimes reports its completion just before process exit.
            try: child.wait(timeout=5)
            except Exception: pass
        report['nativeCompletionMarkerVerified']=native_complete()
        report['ok']=bool(native_complete() and (session.finished() or (child is not None and child.poll()==0)))
        report['state']='finished' if report['ok'] else 'solver-not-finished'
        report['nativeSamples']=len(list(output.glob('vert_*.bin')))
        report['wallSeconds']=round(time.monotonic()-started,2)
    except Exception as e:
        report['error']=f'{type(e).__name__}: {e}'
        report['state']='error'
    finally:
        if session is not None and hasattr(session,'info'):
            report['nativeSamples']=len(list((Path(session.info.path)/'output').glob('vert_*.bin')))
        save()
        if lock is not None:
            lock.close()
    print(json.dumps(report),flush=True)
    return 0 if report['ok'] else 1


if __name__=='__main__':
    sys.exit(main())
