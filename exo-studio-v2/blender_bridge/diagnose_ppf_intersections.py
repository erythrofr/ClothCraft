import argparse, json, sys
from collections import Counter, defaultdict
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

raw=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser(); p.add_argument('--input',required=True); p.add_argument('--report'); args=p.parse_args(raw)
payload=json.loads(Path(args.input).read_text())
verts=[Vector((float(v[0]),float(v[1]),float(v[2]))) for v in payload['shell']['vertices']]
faces=[tuple(map(int,f)) for f in payload['shell']['faces']]
pieces=payload['shell'].get('facePieceIds') or ['unknown']*len(faces)
if len(pieces)!=len(faces): pieces=['unknown']*len(faces)

tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
pairs=tree.overlap(tree)
seen=set(); true=[]; adjacent=[]
for a,b in pairs:
    if a==b: continue
    key=(min(a,b),max(a,b))
    if key in seen: continue
    seen.add(key)
    shared=set(faces[a]) & set(faces[b])
    if shared:
        adjacent.append((a,b,len(shared)))
    else:
        true.append((a,b))

pair_counts=Counter()
face_counts=Counter()
regions=[]
for a,b in true:
    pa,pb=pieces[a],pieces[b]
    pair_counts[tuple(sorted((pa,pb)))] += 1
    face_counts[a]+=1; face_counts[b]+=1
for face_i,count in face_counts.most_common(30):
    f=faces[face_i]
    c=sum((verts[i] for i in f), Vector((0,0,0)))/3
    regions.append({'face':face_i,'piece':pieces[face_i],'count':count,'centroid':[round(c.x,4),round(c.y,4),round(c.z,4)],'verts':list(f)})

report={
 'vertices':len(verts),'faces':len(faces),'bvhPairs':len(seen),'nonAdjacentIntersections':len(true),'adjacentOverlapPairs':len(adjacent),
 'piecePairs':[{'pieces':list(k),'count':v} for k,v in pair_counts.most_common()],
 'hotFaces':regions,
}
print(json.dumps(report,indent=2))
if args.report: Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
