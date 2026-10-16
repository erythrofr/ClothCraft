"""Arc-length matched elliptical torso/shoulder preassembly experiment.

Unlike a circle, an oval can make the torso's side-to-side width large enough
for Thomas while retaining the pattern's fixed flat circumferential length.
The shoulder roll closes the front/back upper seam; every candidate is
screened against exact input triangle lengths and the real skin mesh.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def arguments():
    p=argparse.ArgumentParser()
    p.add_argument('--input',required=True)
    p.add_argument('--output',required=True)
    p.add_argument('--report',required=True)
    p.add_argument('--max-strain',type=float,default=.05)
    p.add_argument('--max-candidates',type=int,default=2000)
    p.add_argument('--torso-subdivisions',type=int,default=1)
    p.add_argument('--diagnose',action='store_true')
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

def main():
    cmd=arguments()
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from refine_ppf_sleeves import refine_pattern_triangles
    from ppf_prepare_scene import build_avatar,collection
    original=json.loads(Path(cmd.input).read_text())
    payload=refine_pattern_triangles(original,('front','back'),cmd.torso_subdivisions)
    vertices=[Vector(v) for v in payload['shell']['vertices']]
    faces=[tuple(f) for f in payload['shell']['faces']]
    piece_ids={item['id']:item['particleIndices'] for item in payload['shell']['pieces']}
    face_owners=payload['shell']['facePieceIds']
    owner={index:name for name,ids in piece_ids.items() for index in ids}
    stitches=[(int(e['a']),int(e['b']),e.get('seamId','')) for e in payload['shell']['stitchEdges']]
    all_pairs=[(a,b) for a,b,_ in stitches]
    side_pairs=[(a,b) for a,b,n in stitches if n.startswith('seam-side-')]
    shoulder_pairs=[(a,b) for a,b,n in stitches if n.startswith('seam-shoulder-')]
    skin=build_avatar(payload,collection('PPF_Torso_Ellipse_Thomas'))
    graph=bpy.context.evaluated_depsgraph_get()
    skin_bvhs=[BVHTree.FromObject(o,graph) for o in skin]
    torso_ids=piece_ids['front']+piece_ids['back']
    top=max(vertices[i].y for i in torso_ids)
    xcenter={name:(max(vertices[i].x for i in piece_ids[name])+min(vertices[i].x for i in piece_ids[name]))*.5
             for name in ('front','back')}
    # Use measured sewing side endpoints as the target flat panel halfwidth.
    side_width=[(vertices[a].y,abs(vertices[a].x-xcenter['front']))
                for a,b in side_pairs if owner[a]=='front']
    width_lo=min(side_width,key=lambda item:item[0])
    width_hi=max(side_width,key=lambda item:item[0])
    width_slope=(width_hi[1]-width_lo[1])/(width_hi[0]-width_lo[0])

    edges=set()
    for a,b,c in faces:
        for i,j in ((a,b),(b,c),(c,a)):
            if owner[i] in ('front','back') and owner[i]==owner[j]:
                edges.add(tuple(sorted((i,j))))
    original_edge_length={(a,b):(vertices[a]-vertices[b]).length for a,b in edges}

    def gaps(v, pp=all_pairs):
        d=[(v[a]-v[b]).length for a,b in pp]
        return sum(d)/len(d),max(d)

    def strain(v):
        return max((abs((v[a]-v[b]).length/ll-1)
                    for (a,b),ll in original_edge_length.items() if ll>1e-9),default=0)

    def collisions(v):
        points=[Vector((p.x,-p.z,p.y)) for p in v]
        bvh=BVHTree.FromPolygons(points,faces,all_triangles=True)
        body_hits=sum(len(bvh.overlap(skin)) for skin in skin_bvhs)
        cloth_self=set()
        for a,b in bvh.overlap(bvh):
            if a==b or set(faces[a])&set(faces[b]):continue
            cloth_self.add(tuple(sorted((a,b))))
        return body_hits,len(cloth_self)

    # Ellipse angle variable phi: X=a*sin(phi), Z=b*cos(phi).
    # Numerically invert geodesic arc length so original 2D x represents
    # pattern arclength, not arbitrary world X.
    def curve_table(halfwidth,b):
        def quarter_length(a):
            n=50
            return sum(math.hypot(a*math.cos((i+.5)*math.pi/(2*n)),
                                  b*math.sin((i+.5)*math.pi/(2*n)))
                       for i in range(n))*math.pi/(2*n)
        lo,hi=.001,max(.35,halfwidth*1.8)
        for _ in range(23):
            mid=(lo+hi)*.5
            if quarter_length(mid)>halfwidth:hi=mid
            else:lo=mid
        a=(lo+hi)*.5
        # Extra arc beyond the side seam supports naturally wide armholes.
        count=80
        step=math.pi/count
        lengths=[0]
        for i in range(count):
            t=(i+.5)*step
            lengths.append(lengths[-1]+math.hypot(a*math.cos(t),b*math.sin(t))*step)
        return a,lengths,step

    def layout(b_front,b_back,roll_span,center_depth,yshift):
        out=[p.copy() for p in vertices]
        cache={}
        for name in ('front','back'):
            sign=1 if name=='front' else -1
            b_max=b_front if name=='front' else b_back
            for i in piece_ids[name]:
                p=vertices[i]
                t=max(0,top-p.y)
                weight=min(1,t/roll_span)
                b=.007+(b_max-.007)*weight
                width=width_lo[1]+width_slope*(p.y-width_lo[0])
                key=(round(width,5),round(b,5))
                if key not in cache:
                    cache[key]=curve_table(width,b)
                a,lengths,step=cache[key]
                u=abs(p.x-xcenter[name])
                lo,hi=0,len(lengths)-1
                while hi-lo>1:
                    mid=(lo+hi)//2
                    if lengths[mid]>u:hi=mid
                    else:lo=mid
                ratio=(u-lengths[lo])/max(1e-9,lengths[hi]-lengths[lo])
                phi=(lo+ratio)*step
                if p.x<xcenter[name]:phi=-phi
                X=a*math.sin(phi)
                Z=center_depth+sign*b*math.cos(phi)
                # Compensate shoulder roll's Z derivative with Y motion.
                db=(b_max-.007)/roll_span if t<roll_span else 0
                ycor=min(t,roll_span)*(1-math.sqrt(max(.1,1-(db*math.cos(phi))**2)))
                Y=p.y+yshift+ycor
                out[i]=Vector((X,Y,Z))
        return out

    baseline=gaps(vertices)
    if cmd.diagnose:
        for bf,bb,span,cz,shift in ((.09,.11,.60,-.05,0),(.09,.11,.3,-.05,0),
                                     (.09,.11,.5,-.05,.06),(.11,.13,.6,-.05,0),
                                     (.13,.15,.6,-.05,0),(.09,.11,.5,-.05,-.06)):
            test=layout(bf,bb,span,cz,shift)
            edge_errors=sorted((abs((test[a]-test[b]).length/ll-1),a,b,
                                 owner[a],(vertices[a]-vertices[b]).length,(test[a]-test[b]).length)
                                for (a,b),ll in original_edge_length.items() if ll>1e-9)
            print('TORSO_DIAG',bf,bb,span,cz,shift,'worst',edge_errors[-4:],
                  'seams',gaps(test,side_pairs),gaps(test,shoulder_pairs),
                  'body',collisions(test),flush=True)
        return
    best=vertices
    best_score=baseline[0]+.28*baseline[1]
    best_params={'mode':'original'}
    tried=0
    failed_strain=0
    failed_contact=0
    safe=0
    contact_samples=[]
    successful=[]
    for bf in (.09,.11,.13,.15):
      for bb in (.11,.13,.15,.17):
       for span in (.30,.4,.50,.60):
        for center_z in (-.07,-.05,-.03):
         for shift in (-.12,-.06,0,.06,.12):
          if tried>=cmd.max_candidates:break
          tried+=1
          candidate=layout(bf,bb,span,center_z,shift)
          local_strain=strain(candidate)
          if local_strain>cmd.max_strain:
              failed_strain+=1
              continue
          body,cloth=collisions(candidate)
          if body or cloth:
              failed_contact+=1
              if len(contact_samples)<30:
                  contact_samples.append(dict(bf=bf,bb=bb,span=span,cz=center_z,
                                              shift=shift,body=body,self=cloth,
                                              strain=round(local_strain,4)))
              continue
          safe+=1
          mean,maxgap=gaps(candidate)
          side=gaps(candidate,side_pairs)
          shoulder=gaps(candidate,shoulder_pairs)
          params={'frontDepth':bf,'backDepth':bb,'shoulderRollSpanM':span,
                  'centerDepthM':center_z,'verticalShiftM':shift,
                  'meanSeamGapCm':round(mean*100,3),
                  'maxSeamGapCm':round(maxgap*100,3),
                  'meanSideGapCm':round(side[0]*100,3),
                  'meanShoulderGapCm':round(shoulder[0]*100,3),
                  'maxRelativeEdgeChange':round(local_strain,6)}
          successful.append(params)
          score=mean+.28*maxgap
          if score<best_score:
              best_score,best,best_params=score,candidate,params
    final=gaps(best)
    body,cloth=collisions(best)
    stats={'method':'arc-length-ellipse-and-shoulder-roll-v1',
           'originalMeshVertices':len(original['shell']['vertices']),
           'newMeshVertices':len(payload['shell']['vertices']),
           'candidates':tried,'strainRejected':failed_strain,
           'collisionRejected':failed_contact,'safeCandidates':safe,
           'beforeMeanGapCm':round(baseline[0]*100,3),
           'afterMeanGapCm':round(final[0]*100,3),
           'afterMaxGapCm':round(final[1]*100,3),
           'sideMeanCm':round(gaps(best,side_pairs)[0]*100,3),
           'shoulderMeanCm':round(gaps(best,shoulder_pairs)[0]*100,3),
           'maxEdgeChange':round(strain(best),6),'bodyHits':body,
           'selfHits':cloth,'selected':best_params,
           'topSafeCandidates':sorted(successful,key=lambda q:q['meanSeamGapCm']+.28*q['maxSeamGapCm'])[:12],
           'collisionSamples':contact_samples,
           'nearAssembled':final[1]<=.03,'fullTrajectoryCertified':False}
    result=json.loads(json.dumps(payload))
    result['shell']['vertices']=[list(p) for p in best]
    result.setdefault('scene',{}).setdefault('staging',{})['ellipticalTorso']=best_params
    Path(cmd.output).parent.mkdir(parents=True,exist_ok=True)
    Path(cmd.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(cmd.report).write_text(json.dumps(stats,indent=2)+'\n')
    print('ELLIPTICAL_TORSO',json.dumps({k:v for k,v in stats.items() if k not in ('topSafeCandidates','collisionSamples')}),flush=True)

if __name__=='__main__':main()
