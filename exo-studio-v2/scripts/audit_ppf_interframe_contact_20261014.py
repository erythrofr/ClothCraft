"""Dense *sampled* between-frame penetration checks for saved PPF trajectories.

The simulation saves meshes at 60 Hz but contact is evolved by smaller physics
substeps. This read-only diagnostic interpolates the saved vertex positions and
calls the installed upstream Rust triangle intersector at user-chosen fractions
between consecutive frames. It does NOT reconstruct actual physics substeps,
perform swept CCD, or certify safety between samples.

The utility is explicitly conservative about provenance and cannot change or
mark production garments as fitted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np


def sha256(path):
    result=hashlib.sha256()
    with open(path, 'rb') as source:
        for part in iter(lambda:source.read(1<<20),b''):
            result.update(part)
    return result.hexdigest()


def parse_ranges(value):
    ranges=[]
    for item in value.split(','):
        first, last = map(int, item.split(':'))
        if first < 0 or last <= first:
            raise ValueError('Ranges must be inclusive frame intervals: 84:93,170:176')
        ranges.extend(range(first, last))
    return sorted(set(ranges))


def bbox(vertices):
    if vertices is None or not len(vertices):return None
    return {'minM':np.round(vertices.min(axis=0),6).tolist(),
            'maxM':np.round(vertices.max(axis=0),6).tolist(),
            'centerM':np.round(vertices.mean(axis=0),6).tolist()}


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('--runs',type=Path,nargs='+',required=True)
    cli.add_argument('--intervals',default='84:93,170:176')
    cli.add_argument('--substeps',type=int,default=8,
                     help='Number of equal fractions per saved-frame interval, 2..24')
    cli.add_argument('--out',type=Path,required=True)
    args=cli.parse_args()
    if not 2 <= args.substeps <= 24:
        raise ValueError('substeps must be between 2 and 24')
    intervals=parse_ranges(args.intervals)
    if len(intervals)>150:
        raise ValueError('Limit to <=150 frame intervals per invocation')
    all_cases={}
    shared_mesh=None
    for report in args.runs:
        run=json.loads(report.read_text())
        run_name=run.get('policy', 'linear')
        if run_name in all_cases:
            raise ValueError('Duplicate policy label '+run_name)
        session=Path(run['sessionPath'])
        if not session.is_dir():raise FileNotFoundError(session)
        runtime=Path(run['runtime'])
        sys.path.insert(0,str(runtime))
        from frontend._intersection_ import check_self_intersection
        triangles=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
        rest=np.fromfile(session/'bin/vert.bin',dtype='<f8').reshape(-1,3)
        pinned_ind=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
        pinned=np.zeros(len(rest),dtype=bool)
        pinned[pinned_ind]=True
        collider=np.all(pinned[triangles],axis=1)
        if np.any(np.any(pinned[triangles],axis=1) & ~collider):
            raise ValueError('unexpected shared cloth/body triangle')
        hashes={f:sha256(session/'bin'/f) for f in ('tri.bin','vert.bin','pin-ind-0.bin')}
        if shared_mesh is not None and hashes != shared_mesh:
            raise ValueError('A/B runs do not have identical encoded mesh/rest/collider geometry')
        shared_mesh=hashes
        output=session/'output'
        available={int(f.stem.split('_')[-1]) for f in output.glob('vert_*.bin')}
        # Set difference must be evaluated after union: don't accidentally
        # treat an absent first-frame endpoint as if it exists.
        missing=sorted((set(intervals)|{i+1 for i in intervals})-available)
        if missing:
            raise ValueError('Requested frames not saved in '+run_name+': '+str(missing[:10]))

        cache={}
        def load(frame):
            if frame not in cache:
                data=np.fromfile(output/f'vert_{frame}.bin',dtype='<f4').reshape(-1,3).astype(np.float64)
                if data.shape != rest.shape or not np.isfinite(data).all():
                    raise ValueError('Invalid saved frame '+str(frame))
                cache[frame]=data
            return cache[frame]

        rows=[]
        for left in intervals:
            start=load(left)
            stop=load(left+1)
            for fraction in range(args.substeps+1):
                if left != intervals[0] and fraction==0 and left-1 in intervals:
                    continue # adjacent intervals share this endpoint
                alpha=fraction/args.substeps
                mesh=(1-alpha)*start+alpha*stop
                raw=check_self_intersection(mesh,triangles,collider)
                hit=[(int(a),int(b)) if not collider[a] else (int(b),int(a))
                     for a,b in raw if bool(collider[a]) != bool(collider[b])]
                cloth_ids=np.unique(triangles[sorted(set(a for a,_ in hit))].ravel()) if hit else []
                body_ids=np.unique(triangles[sorted(set(b for _,b in hit))].ravel()) if hit else []
                row={
                    'fromFrame':left,'toFrame':left+1,
                    'fraction':round(alpha,6),
                    'estimatedTimeSeconds':round((left+alpha)/60,9),
                    'sampleIsSavedOutput':fraction in (0,args.substeps),
                    'clothBodyIntersectionPairs':len(hit),
                    'otherIntersectionPairs':len(raw)-len(hit),
                    'clothContactBBox':bbox(mesh[cloth_ids]) if len(cloth_ids) else None,
                    'bodyContactBBox':bbox(mesh[body_ids]) if len(body_ids) else None,
                    'samplePairs':hit[:8],
                }
                rows.append(row)
            print(f'{run_name} interval {left}->{left+1}, max crossings '
                  f'{max(r["clothBodyIntersectionPairs"] for r in rows[-(args.substeps+1):])}',flush=True)
        positive=[r for r in rows if r['clothBodyIntersectionPairs']>0]
        positive_inside=[r for r in positive if not r['sampleIsSavedOutput']]
        all_cases[run_name]={
            'experimentSession':run['sessionName'],
            'runReport':str(report),
            'maxSampledBodyIntersectionPairs':max((r['clothBodyIntersectionPairs'] for r in rows),default=0),
            'positiveSamples':len(positive),
            'positiveOnlyBetweenSavedFrames':len(positive_inside),
            'firstPositiveTimeSeconds':positive[0]['estimatedTimeSeconds'] if positive else None,
            'firstPositiveInterframeTimeSeconds':positive_inside[0]['estimatedTimeSeconds'] if positive_inside else None,
            'positiveFrameIntervals':sorted({r['fromFrame'] for r in positive}),
            'samples':rows,
        }
    result={
        'schema':'garment-studio.ppf-interframe-sampling.v1',
        'scope':'Linear interpolation between stored meshes only; NOT actual physics substeps, swept CCD or proof of safe contact',
        'fullPhysicalFitVerified':False,
        'fractionsPerInterval':args.substeps,
        'requestedIntervals':intervals,
        'meshSha256':shared_mesh,
        'experiments':all_cases,
    }
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n')
    print('SUMMARY',json.dumps({k:{kk:vv for kk,vv in x.items() if kk!='samples'}
                                for k,x in all_cases.items()},indent=2))


if __name__=='__main__':
    main()
