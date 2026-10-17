"""Audit garment vertices behind Thomas skin without exporting skin geometry.

Triangle intersections alone cannot detect an entire garment patch enclosed
inside the avatar collider. This uses nearest surface normals as a first
signed-contact diagnostic; definitive inside/outside still needs ray parity
on closed, consistently oriented skin surfaces.
"""
import argparse,json,sys
from collections import defaultdict
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from ppf_prepare_scene import build_avatar,collection

options=argparse.ArgumentParser()
options.add_argument('--input',required=True)
options.add_argument('--report')
options.add_argument('--reject-negative-2mm',action='store_true')
raw=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(raw)==1 and not raw[0].startswith('--'):
    raw=['--input',raw[0]]
args=options.parse_args(raw)
path=Path(args.input)
payload=json.loads(path.read_text())
verts=[Vector((v[0],-v[2],v[1])) for v in payload['shell']['vertices']]
ownership={i:p['id'] for p in payload['shell']['pieces'] for i in p['particleIndices']}
objects=build_avatar(payload,collection('PPF_SIGNED_CONTACT_CHECK'))
dep=bpy.context.evaluated_depsgraph_get()
trees=[BVHTree.FromObject(o,dep) for o in objects]
report=defaultdict(lambda:{'sampled':0,'negative':0,'negativeGreaterThan2mm':0,'minimumSignedDistanceMm':1e6,
                           'nearestDistanceCmSum':0})
for i,v in enumerate(verts):
    hits=[tree.find_nearest(v) for tree in trees]
    hits=[hit for hit in hits if hit[0] is not None]
    if not hits:continue
    point,normal,face_id,distance=min(hits,key=lambda x:x[3])
    signed=(v-point).dot(normal)
    label=ownership.get(i,'unknown')
    q=report[label]
    q['sampled']+=1
    q['negative']+=int(signed<0)
    q['negativeGreaterThan2mm']+=int(signed<-.002)
    q['minimumSignedDistanceMm']=min(q['minimumSignedDistanceMm'],round(1000*signed,3))
    q['nearestDistanceCmSum']+=100*distance
for label,q in report.items():
    q['meanNearestDistanceCm']=round(q['nearestDistanceCmSum']/q['sampled'],3)
    del q['nearestDistanceCmSum']
print('PPF_SIGNED_NEAREST',json.dumps(dict(report)),flush=True)
summary={
    'method':'nearest-oriented-Thomas-skin-face-normal',
    'data':dict(report),
    'nontriviallyNegativeVertices':sum(q['negativeGreaterThan2mm'] for q in report.values()),
    'toleranceMm':-2.0,
    'warning':'Nearest surface normals are an additional contact guard, not a substitute for closed-mesh ray parity or swept IPC CCD',
}
if args.report:
    Path(args.report).write_text(json.dumps(summary,indent=2)+'\n')
if args.reject_negative_2mm and summary['nontriviallyNegativeVertices']:
    raise RuntimeError(f'Initial garment has {summary["nontriviallyNegativeVertices"]} vertices more than 2 mm behind the oriented Thomas skin; fit not safe')
