"""Safe progressive cylindrical torso bending with independent front/back radii.

Keeps shoulder and side sewing correspondence untouched. This partial-wrap
stage reduces seam distances while minimizing initial Thomas crossings and
5% fabric strain; it never claims a sewn or trajectory-certified garment.
"""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def main():
    p=argparse.ArgumentParser()
    for key in ('input','output','report'):p.add_argument('--'+key,required=True)
    p.add_argument('--max-strain',type=float,default=.05)
    p.add_argument('--max-tries',type=int,default=1600)
    p.add_argument('--minimum-improvement-cm',type=float,default=.1)
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar,collection
    payload=json.loads(Path(args.input).read_text())
    base=[Vector(v) for v in payload['shell']['vertices']]
    faces=[tuple(f) for f in payload['shell']['faces']]
    owners=payload['shell']['facePieceIds']
    ids={item['id']:item['particleIndices'] for item in payload['shell']['pieces']}
    seams=[(int(e['a']),int(e['b']),e.get('seamId','')) for e in payload['shell']['stitchEdges']]
    torso_ids=set(ids['front']+ids['back'])
    edges=set()
    for face,owner in zip(faces,owners):
        if owner not in ('front','back'):continue
        a,b,c=face
        for i,j in ((a,b),(b,c),(c,a)):edges.add(tuple(sorted((i,j))))
    lengths={(a,b):(base[a]-base[b]).length for a,b in edges}
    skin=build_avatar(payload,collection('PPF_Progressive_Torso'))
    deps=bpy.context.evaluated_depsgraph_get()
    skin_trees=[BVHTree.FromObject(ob,deps) for ob in skin]

    def deformation(v):
        return max((abs((v[a]-v[b]).length/l-1) for (a,b),l in lengths.items() if l>1e-8),default=0)
    def contacts(v):
        tree=BVHTree.FromPolygons([Vector((a.x,-a.z,a.y)) for a in v],faces,all_triangles=True)
        body=sum(len(tree.overlap(s)) for s in skin_trees)
        selfhits=set()
        for a,b in tree.overlap(tree):
            if a==b or set(faces[a])&set(faces[b]):continue
            selfhits.add(tuple(sorted((a,b))))
        return body,len(selfhits)
    def gap_report(v):
        values=[(v[a]-v[b]).length for a,b,_ in seams]
        return sum(values)/len(values),max(values)

    def group_report(v):
        out={}
        for a,b,name in seams:out.setdefault(name,[]).append((v[a]-v[b]).length)
        return {k:{'meanCm':round(100*sum(arr)/len(arr),3),'maxCm':round(100*max(arr),3)}
                for k,arr in out.items()}

    # Unrolled x is the panel's arc length; XYZ mapping is mathematically
    # developable for constant radius. Variation with vertical coordinate is
    # rejected whenever intrinsic edge deformation exceeds the true limit.
    mid={name:(max(base[i].x for i in indices)+min(base[i].x for i in indices))*.5
         for name,indices in ids.items() if name in ('front','back')}
    def candidate(front_r,back_r,front_z,back_z,y_shift=0,hem_taper=0):
        v=[a.copy() for a in base]
        for name,r,z in (('front',front_r,front_z),('back',back_r,back_z)):
            sign=1 if name=='front' else -1
            for i in ids[name]:
                ref=base[i]
                # Optional stronger bending below the armhole, where the
                # body cross-section does not include outstretched arms.
                fraction=max(0,min(1,(1.53-ref.y)/.5))
                rr=r/(1+hem_taper*fraction)
                u=ref.x-mid[name]
                theta=u/rr
                v[i]=Vector((mid[name]+rr*math.sin(theta),ref.y+y_shift,
                             z-sign*rr*(1-math.cos(theta))))
        return v

    base_mean,base_max=gap_report(base)
    best=base
    best_score=base_mean+.12*base_max
    selected={'mode':'original'}
    hits=0;rejected_strain=0;rejected_contact=0;tested=0
    safe=0;shortlist=[];contact_examples=[]
    # Inward movement of front is limited by chest skin; the upper back
    # demands its own minimum gap. Optimize both separately.
    for fr in (.28,.32,.38,.45,.55,.8,2.0):
      for br in (.28,.32,.38,.45,.55,.8,2.0):
       for fz in (.11,.135,.16):
        for bz in (-.18,-.16,-.14):
         for shift in (-.12,0,.08):
          for hem in (0.,.15):
           if tested>=args.max_tries:break
           tested+=1
           v=candidate(fr,br,fz,bz,shift,hem)
           relative=deformation(v)
           if relative>args.max_strain:
               rejected_strain+=1
               continue
           body,selfhits=contacts(v)
           if body or selfhits:
               rejected_contact+=1
               if len(contact_examples)<12:
                   contact_examples.append((fr,br,fz,bz,shift,hem,body,selfhits))
               continue
           safe+=1
           mean,maxgap=gap_report(v)
           score=mean+.12*maxgap
           item={'frontRadiusM':fr,'backRadiusM':br,'frontDepthM':fz,
                 'backDepthM':bz,'verticalShiftM':shift,'hemTaper':hem,
                 'meanGapCm':round(mean*100,3),'maxGapCm':round(maxgap*100,3),
                 'edgeChangePercent':round(relative*100,4)}
           shortlist.append(item)
           if score+args.minimum_improvement_cm/100<best_score:
               best,best_score,selected=v,score,item
    final_mean,final_max=gap_report(best)
    body,selfhits=contacts(best)
    report={'algorithm':'progressive-developable-torso-bending-v1',
        'candidatesTested':tested,'safeCandidates':safe,
        'strainRejected':rejected_strain,'contactRejected':rejected_contact,
        'beforeMeanSeamGapCm':round(base_mean*100,3),
        'afterMeanSeamGapCm':round(final_mean*100,3),
        'beforeMaxSeamGapCm':round(base_max*100,3),
        'afterMaxSeamGapCm':round(final_max*100,3),
        'maxRelativeIntrinsicEdgeChange':round(deformation(best),7),
        'bodyIntersectionPairs':body,'selfIntersectionPairs':selfhits,
        'selected':selected,'topSafe':sorted(shortlist,key=lambda q:q['meanGapCm']+.12*q['maxGapCm'])[:15],
        'contactExamples':contact_examples,
        'seamGroupsBefore':group_report(base),'seamGroupsAfter':group_report(best),
        'nearAssembled':final_max<=.03,'fullTrajectoryCertified':False}
    out=json.loads(json.dumps(payload))
    out['shell']['vertices']=[list(a) for a in best]
    out.setdefault('scene',{}).setdefault('staging',{})['progressiveTorsoBend']=selected
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(out,indent=2)+'\n')
    Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
    print('PROGRESSIVE_TORSO',json.dumps({k:v for k,v in report.items() if k not in ('topSafe','contactExamples','seamGroupsBefore','seamGroupsAfter')}),flush=True)

if __name__=='__main__':main()
