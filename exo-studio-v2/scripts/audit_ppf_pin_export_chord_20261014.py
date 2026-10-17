"""Measure pinned-body exact-time correction used by the PPF frame exporter.

At a simulation step straddling an output frame, PPF output interpolates FREE
cloth positions but evaluates the prescribed (pinned) body's exact scripted
pose at frame time. This computes the difference between the exact pin pose
and the *body chord* between its scripted positions at the solver step ends.

The chord difference is NOT a penetration-depth measurement or a proof of
cause. It is geometric evidence about why interpolated cloth and exact-time
body can diverge, particularly around pin-animation keyframe boundaries.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np


def distribution(values):
    if not len(values):return None
    values=np.asarray(values,dtype=np.float64)*1000
    return {'medianMm':round(float(np.median(values)),6),
            'p95Mm':round(float(np.percentile(values,95)),6),
            'maxMm':round(float(np.max(values)),6)}


def pin_pose(t, pinTargets, policy):
    # All study times are after the original t=0.5 pin-animation start.
    if t<.5:raise ValueError('this study needs time >= 0.5 seconds')
    progress=(t-.5)/.025
    k=int(np.floor(progress))
    if k<=0:raise ValueError('study pin target history begins at op 1')
    if k>=len(pinTargets):return pinTargets[-1]
    alpha=np.clip(progress-k,0,1)
    if policy=='smooth':alpha=alpha*alpha*(3-2*alpha)
    elif policy!='linear':raise ValueError('unknown interpolation policy')
    return pinTargets[k-1]+alpha*(pinTargets[k]-pinTargets[k-1])


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--interpolation-audit',type=Path,required=True)
    p.add_argument('--runs',type=Path,nargs='+',required=True)
    p.add_argument('--frame',type=int,default=90)
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    timing=json.loads(args.interpolation_audit.read_text())
    results={}
    for source in args.runs:
        run=json.loads(source.read_text())
        policy=run.get('policy','linear')
        session=Path(run['sessionPath'])
        arr=timing['sessions'][policy]['samples']
        entry=next(x for x in arr if x['frame']==args.frame)
        if not entry['isInterpolatedFreeCloth']:
            raise ValueError('Frame is not a bracketed/interpolated result')
        fps=timing['sessions'][policy]['outputFPS']
        start=entry['solverStepStartSeconds']
        end=entry['solverStepEndSeconds']
        alpha=(args.frame/fps-start)/(end-start)
        pinIndices=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
        faces=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
        original=np.fromfile(session/'output'/f'vert_{args.frame}.bin',dtype='<f4').reshape(-1,3)
        targets=[np.fromfile(session/'bin'/f'pin-0-op-{k}.bin',dtype='<f8').reshape(-1,3)
                 for k in range(120)]
        if any(target.shape!=(len(pinIndices),3) for target in targets):
            raise ValueError('pinned body target arrays inconsistent')
        pinA,pinB=pin_pose(start,targets,policy),pin_pose(end,targets,policy)
        exact=pin_pose(args.frame/fps,targets,policy)
        chord=pinA+alpha*(pinB-pinA)
        bodyCorrection=np.linalg.norm(chord-exact,axis=1)
        # Compute correction restricted to bodies actually intersecting the
        # selected exported cloth triangles; use saved external Rust audit IDs.
        hitRows=[]
        if policy=='linear':
            evidence=json.loads(Path('logs/ppf-upstream-motion-contact-localization-20261014.json').read_text())
            hitRows=next(x for x in evidence['frameRows'] if x['frame']==args.frame)['sampleIntersectingTrianglePairs']
        elif policy=='smooth':
            evidence=json.loads(Path('logs/ppf-upstream-smooth96-ab-audit-20261014.json').read_text())
            hitRows=evidence['perFrame'][args.frame]['sampleContactTrianglePairs']
        vIndices=np.unique(faces[[b for a,b in hitRows]].reshape(-1)) if hitRows else np.array([],dtype=int)
        inverse={int(v):i for i,v in enumerate(pinIndices)}
        selected=[inverse[int(v)] for v in vIndices if int(v) in inverse]
        actual=original[pinIndices].astype('f8')
        # The study's original body transform is -0.78 + seeded jitter in Y;
        # avoid confusing pose alignment with the chord mismatch.
        translated=exact+np.array([0.,-.78+run['jitter'],0.]) if policy=='linear' else \
            exact+np.array([0.,-.78+run['randomJitter'],0.])
        actualError=np.linalg.norm(actual-translated,axis=1)
        results[policy]={
            'frame':args.frame,'timeSeconds':args.frame/fps,
            'simulationBracketSeconds':[start,end],
            'outputFractionWithinBracket':round(float(alpha),8),
            'allPinnedBodyChordMismatch':distribution(bodyCorrection),
            'intersectingBodyVertexChordMismatch':distribution(bodyCorrection[selected]),
            'exactPinnedBodyOutputResidual':distribution(actualError),
            'involvedPinnedBodyVertices':len(selected),
            'numberOfBodyTrianglePairsSampled':len(hitRows),
        }
    out={'schema':'garment-studio.ppf-pin-frame-chord-audit.v1',
         'scope':'Exact scripted pin frame pose vs lerped scripted pin chord; NOT penetration depth or causal proof',
         'fullPhysicalFitVerified':False,'results':results}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out,indent=2))


if __name__=='__main__':main()
