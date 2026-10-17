"""Developable ellipse torso wrap for PPF shirt preassembly.

Use the actual draft as arc length around Thomas's measured body, rather than
two loosely staged frontal planes. Numerical arc-length inversion keeps the
pattern approximately isometric. Every accepted output must be body/self
collision-free with <=5% triangle rest-edge strain. The solver still requires
the separate real 3cm stitch-gap gate and dynamic fitting validation.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def parse():
    p=argparse.ArgumentParser()
    for key in ('input','flat-reference','output','report'):
        p.add_argument('--'+key,required=True)
    p.add_argument('--min-clearance',type=float,default=.002)
    p.add_argument('--max-candidates',type=int,default=700)
    p.add_argument('--partial',action='store_true',help='Blend body wrap into existing upper-shoulder/sleeve layout')
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def main():
    c=parse()
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar,collection
    old=json.loads(Path(c.input).read_text())
    flat=json.loads(Path(c.flat_reference).read_text())
    if old['shell']['faces']!=flat['shell']['faces'] or old['shell']['stitchEdges']!=flat['shell']['stitchEdges']:
        raise ValueError('Source topology/sewing does not match 2D rest reference')
    reference=[Vector(v) for v in flat['shell']['vertices']]
    original=[Vector(v) for v in old['shell']['vertices']]
    faces=[tuple(f) for f in old['shell']['faces']]
    sewn=[(int(e['a']),int(e['b']),e.get('seamId','')) for e in old['shell']['stitchEdges']]
    pieces={p['id']:p['particleIndices'] for p in old['shell']['pieces']}
    centers={name:(max(reference[i].x for i in pieces[name])+min(reference[i].x for i in pieces[name]))*.5 for name in ('front','back')}
    edges=set()
    for a,b,d in faces:
        edges.update(tuple(sorted(pair)) for pair in ((a,b),(b,d),(d,a)))
    edge_rest={(a,b):(reference[a]-reference[b]).length for a,b in edges}
    skin=build_avatar(old,collection('PPF_CLO_Elliptical_Thomas'))
    deps=bpy.context.evaluated_depsgraph_get()
    skins=[BVHTree.FromObject(o,deps) for o in skin]
    face_sets=[set(f) for f in faces]
    def frame(v):
        coords=[Vector((p.x,-p.z,p.y)) for p in v]
        tree=BVHTree.FromPolygons(coords,faces,all_triangles=True)
        body=sum(len(tree.overlap(bvh)) for bvh in skins)
        self_hits=set()
        for a,b in tree.overlap(tree):
            if a==b or face_sets[a]&face_sets[b]:continue
            self_hits.add(tuple(sorted((a,b))))
        return body,len(self_hits)
    def strain(v):
        return max((abs((v[a]-v[b]).length/L-1) for (a,b),L in edge_rest.items() if L>1e-9),default=0)
    def seam_stats(v):
        all_ds=[(v[a]-v[b]).length for a,b,_ in sewn]
        grouped={}
        for a,b,name in sewn:
            grouped.setdefault(name,[]).append((v[a]-v[b]).length)
        return (sum(all_ds)/len(all_ds),max(all_ds),
                {name:{'meanCm':round(100*sum(ds)/len(ds),3),'maximumCm':round(100*max(ds),3)} for name,ds in grouped.items()})
    # Arc-length integral of ellipse parameterization X=a*sin(phi),Z=b*cos(phi).
    # Invert it by binary interpolation, including u beyond the side seam.
    def arc_table(a,b):
        n=384
        dphi=math.pi/n
        arc=[0.0]
        for i in range(n):
            theta=(i+.5)*dphi
            ds=math.hypot(a*math.cos(theta),b*math.sin(theta))*dphi
            arc.append(arc[-1]+ds)
        return arc,dphi
    def polar(u,arc,dphi):
        sign=-1 if u<0 else 1
        u=abs(u)
        if u>=arc[-1]:return sign*math.pi
        lo=0;hi=len(arc)-1
        while hi-lo>1:
            mid=(lo+hi)//2
            if arc[mid]>=u:hi=mid
            else:lo=mid
        return sign*(lo+(u-arc[lo])/(arc[hi]-arc[lo]))*dphi
    base_mean,base_max,_=seam_stats(original)
    best=original;best_score=base_mean+.85*base_max
    selected={'mode':'original'}
    inspected=0;rejected_strain=0;rejected_contact=0;rejected_signed=0
    rejected_body=0;rejected_self=0
    smallest_strain=1e6;smallest_strain_params=None
    collision_examples=[]
    passed=[]
    # The actual body torso measures roughly X radius 0.14-0.16m,
    # Z radius 0.10-0.11m at y=1.07..1.30. These candidates add 2-7cm
    # outer air gap rather than trying to fit fabric inside Thomas's skin.
    lateral_choices=(.175,.19,.205,.22) if c.partial else (.165,.175,.185,.195,.205,.215,.23)
    depth_choices=(.13,.145,.16) if c.partial else (.12,.13,.14,.15,.16)
    mid_choices=(-.045,-.035,-.025) if c.partial else (-.055,-.045,-.035,-.025,-.015)
    shift_choices=(0,.012) if c.partial else (-.025,-.012,0,.012,.025)
    split_choices=(0.0,) if c.partial else (0.0,.005,.01)
    blends=((1.12,1.60,.12),(1.20,1.65,.20),(1.3,1.75,.26),
            (1.40,1.75,.34)) if c.partial else ((0,0,1),)
    for lateral in lateral_choices:
      for depth in depth_choices:
       for mid_z in mid_choices:
        for offset_y in shift_choices:
         for split in split_choices:
          for low,high,weight in blends:
           if inspected>=c.max_candidates:break
           inspected+=1
           arc,dphi=arc_table(lateral,depth)
           layout=[p.copy() for p in original]
           for name in ('front','back'):
               direction=1 if name=='front' else -1
               for i in pieces[name]:
                   p=reference[i]
                   phi=polar(p.x-centers[name],arc,dphi)
                   target=Vector((lateral*math.sin(phi),p.y+offset_y,
                                  mid_z+direction*depth*math.cos(phi)+direction*split))
                   blend=weight
                   if c.partial:
                       t=max(0,min(1,(p.y-low)/(high-low)))
                       blend*=1-t*t*t*(t*(6*t-15)+10)
                   layout[i]=original[i].lerp(target,blend)
           st=strain(layout)
           if st<smallest_strain:
               smallest_strain=st
               smallest_strain_params={'a':lateral,'b':depth,'centerZ':mid_z,'yOffset':offset_y,'frontBackOffset':split,
                   'blendLow':low,'blendHigh':high,'blendWeight':weight}
           if st>.05:
               rejected_strain+=1
               continue
           body,own=frame(layout)
           if body or own:
               rejected_contact+=1
               rejected_body+=int(body>0)
               rejected_self+=int(own>0)
               if len(collision_examples)<12:
                   collision_examples.append({'a':lateral,'b':depth,'centerZ':mid_z,'yOffset':offset_y,
                       'gapMaxCm':round(seam_stats(layout)[1]*100,3),'strain':round(st,6),
                       'bodyIntersections':body,'selfIntersections':own})
               continue
           # Triangle overlap cannot detect a whole panel placed inside skin.
           # Reject skin-normal inversions for all moved torso vertices.
           negative=False
           for i in pieces['front']+pieces['back']:
               test=Vector((layout[i].x,-layout[i].z,layout[i].y))
               nearest=[tree.find_nearest(test) for tree in skins]
               nearest=[r for r in nearest if r[0] is not None]
               if nearest:
                   surface,normal,_,_=min(nearest,key=lambda entry:entry[3])
                   if (test-surface).dot(normal)<-c.min_clearance:
                       negative=True;break
           if negative:
               rejected_signed+=1
               continue
           mean,maximum,grp=seam_stats(layout)
           score=mean+.85*maximum
           item={'a':lateral,'b':depth,'centerZ':mid_z,'yOffset':offset_y,'frontBackOffset':split,
                 'blendLow':low,'blendHigh':high,'blendWeight':weight,
                 'meanGapCm':round(100*mean,3),'maxGapCm':round(100*maximum,3),
                 'maxRestStrain':round(st,6),
                 'sideMaxCm':round(max(group['maximumCm'] for k,group in grp.items() if k.startswith('seam-side-')),3),
                 'shoulderMaxCm':round(max(group['maximumCm'] for k,group in grp.items() if k.startswith('seam-shoulder-')),3)}
           passed.append(item)
           if score<best_score:
               best=layout
               best_score=score
               selected=item
    mean,maximum,groups=seam_stats(best)
    body,own=frame(best)
    result=json.loads(json.dumps(old))
    result['shell']['vertices']=[list(v) for v in best]
    result.setdefault('scene',{}).setdefault('staging',{})['ellipseFromThomasGirth']=selected
    report={'algorithm':'developable-elliptical-torso-physical-body-preassembly-v1',
        'inputWorstSeamGapCm':round(100*base_max,3),'inputMeanGapCm':round(100*base_mean,3),
        'outputMeanGapCm':round(100*mean,3),'outputMaximumGapCm':round(100*maximum,3),
        'maximumIntrinsicEdgeChange':round(strain(best),7),
        'bodyIntersectionPairs':body,'selfIntersectionPairs':own,
        'signedSkinClear':selected.get('mode')!='original' or None,
        'tested':inspected,'rejectedStrain':rejected_strain,
        'rejectedContact':rejected_contact,'rejectedBody':rejected_body,
        'rejectedSelf':rejected_self,'rejectedSigned':rejected_signed,
        'minimumCandidateStrain':round(smallest_strain,6),
        'minimumCandidateStrainParameters':smallest_strain_params,
        'collisionExamples':collision_examples,
        'passing':len(passed),'selected':selected,
        'bestCandidates':sorted(passed,key=lambda p:p['meanGapCm']+.85*p['maxGapCm'])[:12],
        'afterSeamGroups':groups,'initialAssemblyAccepted':maximum<=.03,
        'fullTrajectoryCertified':False}
    Path(c.output).parent.mkdir(parents=True,exist_ok=True)
    Path(c.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(c.report).write_text(json.dumps(report,indent=2)+'\n')
    print('ELLIPSE_PREASSEMBLY',json.dumps({k:v for k,v in report.items() if k not in ('bestCandidates','afterSeamGroups')}),flush=True)


if __name__=='__main__':main()
