"""Prototype closed-side tubular torso arrangement with Thomas BVH guard.

The front/back are independent *unsewn* triangulated pattern pieces. Their
measured side-seam widths define a developable tapered torso cone. This stage
does not weld seam vertices or change sewing correspondence; only physically
acceptable near-isometric, body-clear layouts are returned.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def args():
    a=argparse.ArgumentParser()
    a.add_argument('--input', required=True)
    a.add_argument('--output', required=True)
    a.add_argument('--report', required=True)
    a.add_argument('--max-stretch', type=float, default=.05)
    a.add_argument('--max-tested', type=int, default=500)
    return a.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

def main():
    cmd=args()
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar,collection
    payload=json.loads(Path(cmd.input).read_text())
    vertices=[Vector(v) for v in payload['shell']['vertices']]
    faces=[tuple(f) for f in payload['shell']['faces']]
    face_pieces=payload['shell']['facePieceIds']
    piece_ids={piece['id']:list(piece['particleIndices']) for piece in payload['shell']['pieces']}
    torso_ids=piece_ids['front']+piece_ids['back']
    all_stitches=[(int(e['a']),int(e['b']),e['seamId']) for e in payload['shell']['stitchEdges']]
    identity={i:name for name,ids in piece_ids.items() for i in ids}
    torso_set=set(torso_ids)
    torso_faces=[face for face,owner in zip(faces,face_pieces) if owner in ('front','back')]
    edges=set()
    for a,b,c in torso_faces:
        edges.update((tuple(sorted(x)) for x in ((a,b),(b,c),(c,a))))
    originals={(i,j):(vertices[i]-vertices[j]).length for i,j in edges}
    skin=build_avatar(payload,collection('PPF_Torso_Contact'))
    graph=bpy.context.evaluated_depsgraph_get()
    skin_trees=[BVHTree.FromObject(obj,graph) for obj in skin]

    side_pairs=[(a,b) for a,b,name in all_stitches if name.startswith('seam-side-')]
    upper_pairs=[(a,b) for a,b,name in all_stitches if 'shoulder' in name]
    if len(side_pairs)!=10 or len(upper_pairs)!=10:
        raise ValueError('Expected calibrated Foundation Tee side and shoulder seams')
    width_samples=[]
    for a,b in side_pairs:
        p=vertices[a]
        width_samples.append((p.y,abs(p.x)))
    low=min(width_samples,key=lambda x:x[0])
    high=max(width_samples,key=lambda x:x[0])
    taper=(high[1]-low[1])/(high[0]-low[0])
    if abs(taper)<1e-6:
        raise ValueError('Torso has no measured draft taper')
    apex=low[0]-low[1]/taper
    center_x={name:(min(vertices[i].x for i in ids)+max(vertices[i].x for i in ids))/2
              for name,ids in piece_ids.items() if name in ('front','back')}
    max_y=max(vertices[i].y for i in torso_ids)

    def gaps(positions,pairs):
        values=[(positions[a]-positions[b]).length for a,b in pairs]
        return (sum(values)/len(values),max(values))
    def strain(positions):
        return max((abs((positions[a]-positions[b]).length/length-1)
                    for (a,b),length in originals.items() if length>1e-7),default=0)
    def collisions(positions):
        xyz=[Vector((p.x,-p.z,p.y)) for p in positions]
        tree=BVHTree.FromPolygons(xyz,faces,all_triangles=True)
        hits=sum(len(tree.overlap(skin_tree)) for skin_tree in skin_trees)
        overlapping=set()
        for a,b in tree.overlap(tree):
            if a==b or set(faces[a]) & set(faces[b]): continue
            overlapping.add(tuple(sorted((a,b))))
        return hits,len(overlapping)

    base_seams=gaps(vertices,[(a,b) for a,b,_ in all_stitches])
    q_base=math.atan(taper)
    # Each torso half is a flat polar wedge with arc length from center to
    # either side seam. Form two corresponding half cones with a tiny slit at
    # each side; the stitch springs will close that slit during the PPF solve.
    def wrap(radius_scale, height_shift, seam_angle, shoulder_roll, back_extra):
        result=[p.copy() for p in vertices]
        radial_angle=q_base/(math.pi/2-seam_angle)
        for name in ('front','back'):
            sign=1 if name=='front' else -1
            for i in piece_ids[name]:
                p=vertices[i]
                dx=p.x-center_x[name]
                long=p.y-apex
                rho=math.hypot(long,dx)
                azimuth=math.atan2(dx,long)/radial_angle
                r=radius_scale*radial_angle*rho
                # Stable conical tube with minor outward clearance. Cone
                # angle affects frame heights, so allow a common vertical
                # translation but no local vertex snapping.
                # Critical: never clamp azimuth at +/- pi/2. Clamping
                # collapses the wide upper armhole curves, producing
                # artificial 25%+ fabric compression. The full cone remains
                # developable, even for points temporarily past a side seam.
                alpha=azimuth
                x=r*math.sin(alpha)
                z=sign*r*math.cos(alpha)
                y=apex+math.sqrt(max(1e-8,1-radial_angle**2))*rho+height_shift
                # Shift back surface away from upper-back skin only near the
                # center; preserve geometric seam proximity at torso sides.
                z-=back_extra*(math.cos(alpha)**2) if name=='back' else 0
                # Shoulder seam at y~1.7 can be bent over to match front
                # to back. Smooth roll takes effect only high on the torso.
                roll=max(0,min(1,(p.y-(max_y-.26))/.26))
                z*=1-shoulder_roll*roll
                result[i]=Vector((x,y,z))
        return result

    best=vertices
    best_score=base_seams[0]+.3*base_seams[1]
    best_params={'mode':'original'}
    good=0
    tested=0
    contact_rejects=0
    strain_rejects=0
    candidates=[]
    minimum_strain=100
    lowest_strain_params=None
    collision_samples=[]
    for radius in (.9,1.,1.08):
      for height in (-.23,-.18,-.13,-.08,0.0):
       for seam_gap in (.015,.05,.1):
        for shoulder in (0,.4,.8,1.0):
         for clearance in (0.,.01,.025):
          if tested>=cmd.max_tested:break
          tested+=1
          posed=wrap(radius,height,seam_gap,shoulder,clearance)
          stretch=strain(posed)
          if stretch < minimum_strain:
              minimum_strain=stretch
              lowest_strain_params={'radius':radius,'height':height,'seamGap':seam_gap,
                                    'shoulderRoll':shoulder,'backExtra':clearance}
          if stretch>cmd.max_stretch:
              strain_rejects+=1
              continue
          body,self_hits=collisions(posed)
          if body or self_hits:
              contact_rejects+=1
              collision_samples.append({'radius':radius,'height':height,'seamAngle':seam_gap,
                                        'shoulderRoll':shoulder,'backExtra':clearance,
                                        'body':body,'self':self_hits,
                                        'sideCm':round(gaps(posed,side_pairs)[0]*100,2),
                                        'shoulderCm':round(gaps(posed,upper_pairs)[0]*100,2),
                                        'maxStrain':round(stretch,4)})
              continue
          good+=1
          gs=gaps(posed,[(a,b) for a,b,_ in all_stitches])
          side=gaps(posed,side_pairs)
          shoulders=gaps(posed,upper_pairs)
          value=gs[0]+.3*gs[1]
          item={'radius':radius,'height':height,'sideSlitRad':seam_gap,
              'shoulderRoll':shoulder,'backExtra':clearance,
              'meanGapCm':round(gs[0]*100,3),'maxGapCm':round(gs[1]*100,3),
              'meanSideGapCm':round(side[0]*100,3),
              'meanShoulderGapCm':round(shoulders[0]*100,3),
              'maxStrain':round(stretch,5)}
          candidates.append(item)
          if value+1e-7<best_score:
              best, best_score, best_params=posed,value,item
    final_gaps=gaps(best,[(a,b) for a,b,_ in all_stitches])
    body,self_hits=collisions(best)
    report={'algorithm':'developable-torso-side-cone-and-shoulder-fold-v1',
       'inputVertices':len(vertices),'candidatesTested':tested,'safeCandidates':good,
       'strainRejected':strain_rejects,'collisionRejected':contact_rejects,
       'minimumCandidateStrain':minimum_strain,'minimumStrainParams':lowest_strain_params,
       'collisionSamples':collision_samples[:100],
       'beforeMeanCm':round(base_seams[0]*100,3),
       'afterMeanCm':round(final_gaps[0]*100,3),
       'afterMaxCm':round(final_gaps[1]*100,3),
       'selected':best_params,'maxStrain':round(strain(best),6),
       'bodyIntersectionPairs':body,'selfIntersectionPairs':self_hits,
       'topSafeCandidates':sorted(candidates,key=lambda x:x['meanGapCm']+.3*x['maxGapCm'])[:15],
       'sideSeamMeanCm':round(gaps(best,side_pairs)[0]*100,3),
       'shoulderSeamMeanCm':round(gaps(best,upper_pairs)[0]*100,3),
       'nearAssembled':final_gaps[1]<=.03,'fullTrajectoryCertified':False}
    result=json.loads(json.dumps(payload))
    result['shell']['vertices']=[list(p) for p in best]
    result.setdefault('scene',{}).setdefault('staging',{})['torsoFold']=best_params
    Path(cmd.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(cmd.report).write_text(json.dumps(report,indent=2)+'\n')
    print('TOROSO_ASSEMBLY_RESULT',json.dumps(report),flush=True)

if __name__=='__main__': main()
