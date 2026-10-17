"""Audit raw native fitting frames; no Blender conversions or output snapping.
Uses upstream Rust intersection kernel (not independent swept CCD).
"""
import argparse
import json
from pathlib import Path
import sys
import tomllib
import numpy as np
p=argparse.ArgumentParser()
p.add_argument('--run-report',required=True)
p.add_argument('--report',required=True)
a=p.parse_args()
run=json.loads(Path(a.run_report).read_text())
sys.path.insert(0,run['runtime'])
from frontend._intersection_ import check_self_intersection
session=Path(run['sessionPath'])
counts=tomllib.loads((session/'info.toml').read_text())['count']
rest=np.fromfile(session/'bin/vert.bin',dtype='<f8').reshape(-1,3)
faces=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
pins=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
body=np.zeros(len(rest),dtype=bool)
body[pins]=True
body_faces=np.all(body[faces],axis=1)
assert not np.any(np.any(body[faces],axis=1) & ~body_faces), 'Mixed cloth/body triangle'
cloth=faces[~body_faces]
r=rest[cloth]
u=r[:,1]-r[:,0]; v=r[:,2]-r[:,0]
l=np.linalg.norm(u,axis=1); x=np.sum(u*v,axis=1)/l
y=np.sqrt(np.maximum(0,np.sum(v*v,axis=1)-x*x))
assert np.all(l>1e-12) and np.all(y>1e-12)
inv=np.zeros((len(cloth),2,2)); inv[:,0,0]=1/l; inv[:,0,1]=-x/(l*y); inv[:,1,1]=1/y
stitch_ind=np.fromfile(session/'bin/stitch_ind.bin',dtype='<u8').reshape(-1,6)
stitch_w=np.fromfile(session/'bin/stitch_w.bin',dtype='<f4').reshape(-1,6)
assert len(stitch_ind)==counts['stitch'] and stitch_w.shape==stitch_ind.shape
assert np.allclose(stitch_w[:,:3].sum(axis=1),1) and np.allclose(stitch_w[:,3:].sum(axis=1),1)
rows=[]
files=sorted((session/'output').glob('vert_*.bin'),key=lambda f:int(f.stem.split('_')[1]))
for f in files:
    index=int(f.stem.split('_')[1])
    frame=np.fromfile(f,dtype='<f4').reshape(-1,3).astype(np.float64)
    assert frame.shape==rest.shape and np.all(np.isfinite(frame))
    hits=check_self_intersection(frame,faces,body_faces)
    body_hits=sum(bool(body_faces[i] or body_faces[j]) for i,j in hits)
    q=frame[cloth]
    ds=np.stack((q[:,1]-q[:,0],q[:,2]-q[:,0]),axis=2)
    singular=np.linalg.svd(ds @ inv,compute_uv=False)
    stretch=singular[:,0]
    points=frame[stitch_ind]*stitch_w[:,:,None]
    gaps=np.linalg.norm(points[:,:3].sum(axis=1)-points[:,3:].sum(axis=1),axis=1)*100
    rows.append({'meanSeamGapCm':float(gaps.mean()),'maxSeamGapCm':float(gaps.max()),'frame':index,'bodyCrossings':body_hits,'clothSelfCrossings':len(hits)-body_hits,
                 'maxPrincipalStretch':float(stretch.max()),'facesAbove10Percent':int(np.sum(stretch>1.10001))})
    if index%20==0: print('audited',index,flush=True)
result={'scope':'raw native discrete contact and principal stretch; upstream intersection kernel, not independent CCD',
        'runCompleted':run.get('ok',False),'framesAudited':len(rows),'requestedFrameAdvances':run['requestedFrames'],
        'expectedNativeSamples':run['requestedFrames']+1,
        'completeNativeTrajectory':run.get('ok',False) and [r['frame'] for r in rows]==list(range(run['requestedFrames']+1)),
        'contiguous': [r['frame'] for r in rows]==list(range(len(rows))),
        'encodedStitches':counts['stitch'],'clothTriangles':len(cloth),'bodyTriangles':int(body_faces.sum()),
        'maxBodyCrossings':max((r['bodyCrossings'] for r in rows),default=None),
        'maxSelfCrossings':max((r['clothSelfCrossings'] for r in rows),default=None),
        'maxPrincipalStretch':max((r['maxPrincipalStretch'] for r in rows),default=None),
        'finalMeanSeamGapCm':rows[-1]['meanSeamGapCm'] if rows else None,
        'finalMaxSeamGapCm':rows[-1]['maxSeamGapCm'] if rows else None,
        'fullPhysicalFitVerified':False,'perFrame':rows}
Path(a.report).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='perFrame'}))
