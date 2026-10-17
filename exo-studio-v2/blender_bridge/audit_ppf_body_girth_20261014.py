"""Measure closed Thomas skin contours by intersecting triangles at body heights."""
import json,sys,argparse,math
from collections import defaultdict
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from ppf_prepare_scene import build_avatar,collection
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--report',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
payload=json.loads(Path(a.input).read_text())
skin=build_avatar(payload,collection('Thomas_Actual_Skin_Girth'))
v=[];tri=[]
for obj in skin:
 off=len(v)
 v += [obj.matrix_world@q.co for q in obj.data.vertices]
 tri += [tuple(off+i for i in face.vertices) for face in obj.data.polygons]
def loops(level):
 pointids={};coords=[];adj=defaultdict(set);length={}
 def num(p):
  key=(round(p[0],5),round(p[1],5))
  if key not in pointids:pointids[key]=len(coords);coords.append(p)
  return pointids[key]
 for face in tri:
  crossings=[]
  for i,j in ((0,1),(1,2),(2,0)):
   aa,bb=v[face[i]],v[face[j]]
   if (aa.z-level)*(bb.z-level)>=0:continue
   f=(level-aa.z)/(bb.z-aa.z)
   crossings.append((aa.x+(bb.x-aa.x)*f,-(aa.y+(bb.y-aa.y)*f)))
  if len(crossings)!=2:continue
  aa,bb=num(crossings[0]),num(crossings[1])
  if aa==bb:continue
  adj[aa].add(bb);adj[bb].add(aa)
  length[tuple(sorted((aa,bb)))]=math.dist(crossings[0],crossings[1])
 result=[];seen=set()
 for x in adj:
  if x in seen:continue
  stack=[x];seen.add(x);component=set()
  while stack:
   curr=stack.pop();component.add(curr)
   for z in adj[curr]:
    if z not in seen:seen.add(z);stack.append(z)
  points=[coords[n] for n in component]
  circumference=sum(w for (i,j),w in length.items() if i in component and j in component)
  result.append({'perimeterM':round(circumference,4),'centerXM':round(sum(t[0] for t in points)/len(points),3),
                 'xmin':round(min(t[0] for t in points),3),'xmax':round(max(t[0] for t in points),3),
                 'frontZ':round(max(t[1] for t in points),3),'backZ':round(min(t[1] for t in points),3),
                 'vertices':len(component),'closed':all(len(adj[q])==2 for q in component)})
 return sorted(result,key=lambda x:x['perimeterM'],reverse=True)
out={str(level):loops(level) for level in (.99,1.07,1.2,1.3,1.42,1.52,1.6)}
Path(a.report).write_text(json.dumps(out,indent=2)+'\n')
print('ACTUAL_BODY_GIRTH',json.dumps(out),flush=True)
