"""Audit a bounded A/B PPF run, even when its time limit ends mid-trajectory.

Read-only. Crucially does not count a run with fewer requested frames as a
successful full trajectory, even if the available frames happen to be clear.
Uses original Rust intersection detector and Jarvis's saved linear baseline.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from datetime import datetime
import sys
import numpy as np


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--experiment', type=Path, required=True)
    p.add_argument('--baseline', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a=p.parse_args()
    experiment=json.loads(a.experiment.read_text())
    baseline=json.loads(a.baseline.read_text())
    if experiment.get('schema')!='garment-studio.ppf-pin-policy-experiment.v1':
        raise ValueError('Wrong experiment provenance/schema')
    session=Path(experiment['sessionPath'])
    sys.path.insert(0,experiment['runtime'])
    from frontend._intersection_ import check_self_intersection
    fs=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
    rest=np.fromfile(session/'bin/vert.bin',dtype='<f8').reshape(-1,3)
    pins=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
    pinned=np.zeros(len(rest),dtype=bool);pinned[pins]=True
    body=np.all(pinned[fs],axis=1)
    if np.any(np.any(pinned[fs],axis=1)&~body):
        raise ValueError('unexpected mixed body/cloth faces')
    # Do not let a collision-only experiment mask stretching or failed seams.
    # This reproduces the true upstream saved-mesh strain/stitch calculations
    # independently for every sample using immutable rest topology.
    cloth_triangles=fs[~body]
    rest_triangles=rest[cloth_triangles]
    ru=rest_triangles[:,1]-rest_triangles[:,0]
    rv=rest_triangles[:,2]-rest_triangles[:,0]
    l=np.linalg.norm(ru,axis=1)
    x=np.sum(ru*rv,axis=1)/l
    y=np.sqrt(np.maximum(0,np.sum(rv*rv,axis=1)-x*x))
    if not np.all(l>1e-12) or not np.all(y>1e-12):
        raise ValueError('degenerate rest cloth triangles')
    inverse=np.zeros((len(cloth_triangles),2,2))
    inverse[:,0,0]=1/l
    inverse[:,0,1]=-x/(l*y)
    inverse[:,1,1]=1/y
    stitch_index=np.fromfile(session/'bin/stitch_ind.bin',dtype='<u8').reshape(-1,6)
    stitch_weight=np.fromfile(session/'bin/stitch_w.bin',dtype='<f4').reshape(-1,6)
    if len(stitch_index)!=len(stitch_weight) or not len(stitch_index):
        raise ValueError('invalid 6-index encoded stitches')
    if not np.allclose(stitch_weight[:,:3].sum(axis=1),1) or not np.allclose(stitch_weight[:,3:].sum(axis=1),1):
        raise ValueError('stitch barycentric weights do not sum to unity')
    samples=sorted((session/'output').glob('vert_*.bin'),key=lambda f:int(f.stem.split('_')[-1]))
    indices=[int(f.stem.split('_')[-1]) for f in samples]
    if indices!=list(range(len(indices))):
        raise ValueError('saved A/B output is not contiguous from frame 0')
    baseline_map={r['frame']:r for r in baseline['perFrame']}
    rows=[]
    for f in samples:
        index=int(f.stem.split('_')[-1])
        v=np.fromfile(f,dtype='<f4').reshape(-1,3)
        if v.shape!=rest.shape or not np.isfinite(v).all():
            raise ValueError('nonfinite or incomplete native frame '+str(index))
        hits=check_self_intersection(v,fs,body)
        body_hits=[(int(x),int(y)) if not body[x] else (int(y),int(x))
                   for x,y in hits if bool(body[x]) != bool(body[y])]
        crossing=len(body_hits)
        active=v[cloth_triangles].astype(np.float64)
        edge_matrix=np.stack((active[:,1]-active[:,0],active[:,2]-active[:,0]),axis=2)
        stretches=np.linalg.svd(edge_matrix@inverse,compute_uv=False)
        max_stretch=float(stretches[:,0].max())
        stretched=int(np.sum(stretches[:,0]>1.10001))
        stitched_points=v[stitch_index].astype(np.float64)*stitch_weight[:,:,None]
        gaps=np.linalg.norm(stitched_points[:,:3].sum(axis=1)-stitched_points[:,3:].sum(axis=1),axis=1)*100
        cloth_faces=sorted(set(x for x,_ in body_hits))
        body_faces=sorted(set(y for _,y in body_hits))
        def spatial_bound(ids):
            if not ids:return None
            p=v[np.unique(fs[ids].ravel())]
            return {'minM':np.round(p.min(axis=0),5).tolist(),
                    'maxM':np.round(p.max(axis=0),5).tolist(),
                    'centerM':np.round(p.mean(axis=0),5).tolist()}
        row={'frame':index,'bodyCrossings':crossing,
             'clothSelfCrossings':len(hits)-crossing,
             'maxPrincipalStretch':max_stretch,
             'facesAbove10PercentStretch':stretched,
             'meanSeamGapCm':float(np.mean(gaps)),
             'maxSeamGapCm':float(np.max(gaps)),
             'baselineBodyCrossings':baseline_map[index]['bodyCrossings'] if index in baseline_map else None,
             'uniqueInvolvedClothFaces':len(cloth_faces),
             'uniqueInvolvedBodyFaces':len(body_faces),
             'clothContactAABB':spatial_bound(cloth_faces),
             'bodyContactAABB':spatial_bound(body_faces),
             'sampleContactTrianglePairs':body_hits[:16]}
        rows.append(row)
    output_dir=session/'output'
    finished_path=output_dir/'finished.txt'
    marker_valid=False
    if finished_path.is_file():
        try:
            datetime.fromisoformat(finished_path.read_text().strip())
            marker_valid=True
        except (ValueError, OSError):
            marker_valid=False
    errorlog=session/'error.log'
    solver_stdout=session/'stdout.log'
    finished_log=(solver_stdout.is_file() and 'simulation finished' in
                  '\n'.join(solver_stdout.read_text(errors='replace').splitlines()[-30:]))
    error_free=not errorlog.exists() or errorlog.stat().st_size==0
    native_complete=(marker_valid and finished_log and error_free and
                     len(rows)==experiment['framesRequested']+1)
    pairs=[{'frame':r['frame'],'linear':r['baselineBodyCrossings'],
            'experiment':r['bodyCrossings']}
           for r in rows if r['baselineBodyCrossings']>0 or r['bodyCrossings']>0]
    results={'schema':'garment-studio.ppf-pin-policy-ab-audit.v1',
             'policy':experiment['policy'],'runFinished':experiment.get('ok',False),
             'requestedFrameAdvances':experiment['framesRequested'],
             'framesAudited':len(rows),'lastFrame':rows[-1]['frame'] if rows else None,
             'completeTrajectory':native_complete,
             'nativeCompletionMarkerValid':marker_valid,
             'nativeSolverFinishedInLog':finished_log,
             'nativeSolverErrorLogEmpty':error_free,
             'wrapperCompletionDisagreement':native_complete and not experiment.get('ok',False),
             'allObservedContactFree':all(r['bodyCrossings']==0 and r['clothSelfCrossings']==0 for r in rows),
             'fullPhysicalFitVerified':False,
             'maxObservedBodyCrossings':max((r['bodyCrossings'] for r in rows),default=None),
             'maxPrincipalStretch':max((r['maxPrincipalStretch'] for r in rows),default=None),
             'maxFacesAbove10PercentStretch':max((r['facesAbove10PercentStretch'] for r in rows),default=None),
             'allSavedFacesWithin10PercentStretch':all(r['facesAbove10PercentStretch']==0 for r in rows),
             'finalMeanSeamGapCm':rows[-1]['meanSeamGapCm'] if rows else None,
             'finalMaxSeamGapCm':rows[-1]['maxSeamGapCm'] if rows else None,
             'originalStitchConstraintCount':len(stitch_index),
             'collisionComparisons':pairs,'perFrame':rows,
             'note':'Complete discrete-only trajectory is still not swept-CCD/fit acceptance; partial run must not be labeled a successful comparison'}
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps({k:v for k,v in results.items() if k!='perFrame'},indent=2))


if __name__=='__main__':main()
