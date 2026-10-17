"""Read-only correlation of PPF solver-gated steps and emitted video frames.

The solver checks actual converged poses, but `backend.rs::write_frame_outputs`
linearly interpolates free cloth between surrounding steps and evaluates pinned
body positions at the exact output-frame time. The interpolated visible mesh is
NOT the solver's checked pose. This script reconstructs the bounding step and
interpolation fraction from the installed solver's unmodified stdout logs.

Output is timing/algorithm provenance, not proof that interpolation alone
caused penetration, and not a substitute for swept CCD or a physics replay.
"""
from __future__ import annotations

import argparse
import bisect
import json
import math
import re
from pathlib import Path


TIME_RE = re.compile(r'^\* time = ([0-9.eE+-]+)\s*$')
DT_RE = re.compile(r'^\* final_dt: ([0-9.eE+-]+)\s*$')


def parse_steps(text):
    starts = []
    advances = []
    result = []
    for line in text.splitlines():
        step = TIME_RE.match(line.strip())
        dt = DT_RE.match(line.strip())
        if step:
            starts.append(float(step.group(1)))
        if dt:
            advances.append(float(dt.group(1)))
    if len(starts) != len(advances) or not starts:
        raise ValueError(f'unmatched solver time/dt logs ({len(starts)} / {len(advances)})')
    for index, (t, dt) in enumerate(zip(starts, advances)):
        if not math.isfinite(t) or not math.isfinite(dt) or dt <= 0:
            raise ValueError(f'invalid solver step {index}')
        result.append((t, t+dt))
    if any(b[0] < a[0] for a, b in zip(result[:-1], result[1:])):
        raise ValueError('solver steps are not time-ordered')
    return result


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--runs',type=Path,nargs='+',required=True)
    cli.add_argument('--audit',type=Path,required=True,
                     help='Full 60 Hz baseline raw discrete contact audit')
    cli.add_argument('--out',type=Path,required=True)
    cli.add_argument('--frames',default='0,1,87,90,92,93,96,174,180,240')
    args=cli.parse_args()
    baseline=json.loads(args.audit.read_text())
    original={row['frame']:row['bodyCrossings'] for row in baseline['perFrame']}
    selected=sorted(set(int(n) for n in args.frames.split(',')))
    result={'schema':'garment-studio.ppf-frame-interpolation-audit.v1',
            'scope':'Raw Rust step timing versus generated video-frame interpolation, no CCD',
            'fullPhysicalFitVerified':False,'sessions':{}}
    for name in args.runs:
        run=json.loads(name.read_text())
        session=Path(run['sessionPath'])
        log=(session/'stdout.log').read_text(errors='replace')
        steps=parse_steps(log)
        starts=[x[0] for x in steps]
        frame_outputs={int(f.stem.split('_')[-1]) for f in (session/'output').glob('vert_*.bin')}
        fps=60
        params=(session/'param.toml').read_text()
        found=re.search(r'^fps\s*=\s*([0-9.eE+-]+)',params,re.M)
        if found:fps=float(found.group(1))
        table=[]
        for frame in selected:
            if frame not in frame_outputs:continue
            tf=frame/fps
            if frame==0:
                table.append({'frame':frame,'timeSeconds':tf,'frame0RestPose':True,
                              'exportInterpolationAlpha':1.0,'isInterpolatedFreeCloth':False,
                              'originalBaselineBodyCrossings':original.get(frame)})
                continue
            # Log times use rounded textual precision (~5 decimal digits).
            # Find a bracketing step with a tolerance of at most 2e-4 seconds.
            i=max(0, bisect.bisect_right(starts,tf)-1)
            candidates=[j for j in (i-1,i,i+1) if 0<=j<len(steps)]
            plausible=[j for j in candidates if steps[j][0]-2e-4<=tf<=steps[j][1]+2e-4]
            if not plausible:raise ValueError(f'Cannot bracket frame {frame} at t={tf}')
            chosen=min(plausible,key=lambda j:max(0, steps[j][0]-tf, tf-steps[j][1]))
            lo,hi=steps[chosen]
            alpha=max(0.,min(1.,(tf-lo)/(hi-lo)))
            table.append({'frame':frame,'timeSeconds':round(tf,8),
                          'solverStepIndex':chosen,
                          'solverStepStartSeconds':lo,'solverStepEndSeconds':round(hi,9),
                          'solverStepDurationSeconds':round(hi-lo,9),
                          'exportInterpolationAlpha':round(alpha,6),
                          'isInterpolatedFreeCloth':alpha>1e-4 and alpha<1-1e-4,
                          'bodyPosAtExactExportTime':True,
                          'originalBaselineBodyCrossings':original.get(frame)})
        result['sessions'][run.get('policy','linear')]={
            'name':run['sessionName'],
            'reportedRunComplete':run['ok'],
            'loggedSolverSteps':len(steps),
            'terminalIntersectionMessages':log.count('### intersection detected:'),
            'outputFPS':fps,
            'samples':table,
        }
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n')
    print('SUMMARY')
    for policy,items in result['sessions'].items():
        print(policy,'solverSteps',items['loggedSolverSteps'],
              'internalGateDetectedCrossings',items['terminalIntersectionMessages'])
        for sample in items['samples']:
            if sample['frame'] in (87,90,92,93,174):
                print(' frame',sample['frame'],'solver step',sample.get('solverStepIndex'),
                      'alpha',sample['exportInterpolationAlpha'],
                      'output cloth interpolated',sample['isInterpolatedFreeCloth'],
                      'baseline crossings',sample['originalBaselineBodyCrossings'])


if __name__=='__main__':main()
