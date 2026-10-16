"""Independent Blender BVH + float64 strict edge/triangle crossing spot checks."""
import argparse,json,sys
from pathlib import Path
import numpy as np
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser();p.add_argument('--run-report',required=True);p.add_argument('--audit',required=True);p.add_argument('--report',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
run=json.loads(Path(a.run_report).read_text());audit=json.loads(Path(a.audit).read_text())
session=Path(run['sessionPath']);sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'blender_bridge'))
from audit_ppf_native_geometry import strict_crossing
faces=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
pins=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
vert_count=(session/'bin/vert.bin').stat().st_size//24
body=np.zeros(vert_count,dtype=bool);body[pins]=True
mask=np.all(body[faces],axis=1);bf=faces[mask];cf=faces[~mask]
first=next(r['frame'] for r in audit['perFrame'] if r['bodyCrossings'])
worst=max(audit['perFrame'],key=lambda r:r['bodyCrossings'])['frame']
rows=[]
for i in sorted(set([0,first-1,first,worst,audit['perFrame'][-1]['frame']])):
    v=np.fromfile(session/f'output/vert_{i}.bin',dtype='<f4').reshape(-1,3).astype(np.float64)
    bt=BVHTree.FromPolygons(v.tolist(),bf.tolist(),all_triangles=True)
    ct=BVHTree.FromPolygons(v.tolist(),cf.tolist(),all_triangles=True)
    hits=ct.overlap(bt)
    strict=sum(strict_crossing(v[cf[x]],v[bf[y]]) for x,y in hits)
    rows.append({'frame':i,'bvhPairs':len(hits),'strictBodyCrossings':strict,'upstreamKernelPairs':audit['perFrame'][i]['bodyCrossings']})
result={'scope':'independent discrete spot check, not all-frame CCD','frames':rows,'fullPhysicalFitVerified':False}
Path(a.report).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
