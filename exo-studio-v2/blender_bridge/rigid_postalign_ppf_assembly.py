"""Contact-constrained seam-alignment of independently bent garment pieces.

Only rigid-body translations and rotations of complete triangulated pieces:
these preserve each panel's manufactured intrinsic geometry. Every accepted
step is screened against the actual local Thomas skin and garment self BVHs.
Outputs remain experimental until separate PPF and IPC trajectory acceptance.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree


def parse():
    parser = argparse.ArgumentParser()
    for name in ('input', 'flat-reference', 'output', 'report'):
        parser.add_argument('--'+name, required=True)
    parser.add_argument('--max-edge-change', type=float, default=.05)
    parser.add_argument('--rounds', type=int, default=4)
    parser.add_argument('--worst-seam-weight', type=float, default=.23)
    return parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def main():
    args=parse()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar, collection

    payload=json.loads(Path(args.input).read_text())
    flat=json.loads(Path(args.flat_reference).read_text())
    vertices=[Vector(v) for v in payload['shell']['vertices']]
    rest=[Vector(v) for v in flat['shell']['vertices']]
    faces=[tuple(f) for f in payload['shell']['faces']]
    if len(vertices)!=len(rest) or faces != [tuple(f) for f in flat['shell']['faces']]:
        raise ValueError('Rigid optimizer requires flat/rest topology matching the input pose')
    pieces={p['id']:list(p['particleIndices']) for p in payload['shell']['pieces']}
    sewing=[(int(e['a']),int(e['b']),e.get('seamId','unnamed')) for e in payload['shell']['stitchEdges']]
    edges=set()
    for a,b,c in faces:
        for u,v in ((a,b),(b,c),(c,a)):
            edges.add(tuple(sorted((u,v))))
    edge_rest={(a,b):(rest[a]-rest[b]).length for a,b in edges}
    skin=build_avatar(payload, collection('Rigid_Postalign_Thomas'))
    deps=bpy.context.evaluated_depsgraph_get()
    body_bvhs=[BVHTree.FromObject(o, deps) for o in skin]
    face_sets=[set(f) for f in faces]

    def gap_stats(verts):
        distances=[(verts[a]-verts[b]).length for a,b,_ in sewing]
        groups={}
        for (a,b,name),d in zip(sewing,distances):
            groups.setdefault(name,[]).append(d)
        return {
            'meanCm':round(100*sum(distances)/len(distances),3),
            'maximumCm':round(100*max(distances),3),
            'groups':{name:{'meanCm':round(100*sum(ds)/len(ds),3),
                            'maximumCm':round(100*max(ds),3)} for name,ds in groups.items()},
        }

    def objective(verts):
        ds=[(verts[a]-verts[b]).length for a,b,_ in sewing]
        mean=sum(ds)/len(ds)
        # Give more weight to the worst seam and shoulder joins, which limit
        # whether a future full PPF solve can begin at all.
        top=sum(sorted(ds,reverse=True)[:max(1,len(ds)//10)]) / max(1,len(ds)//10)
        return mean + args.worst_seam_weight*max(ds) + .1*top

    def strain(verts):
        return max((abs((verts[a]-verts[b]).length/r-1) for (a,b),r in edge_rest.items()
                    if r>1e-8),default=0.0)

    def bvh_contacts(verts):
        points=[Vector((p.x,-p.z,p.y)) for p in verts]
        garment=BVHTree.FromPolygons(points,faces,all_triangles=True)
        body=sum(len(garment.overlap(b)) for b in body_bvhs)
        self_intersections=set()
        for a,b in garment.overlap(garment):
            if a==b or face_sets[a]&face_sets[b]:
                continue
            self_intersections.add(tuple(sorted((a,b))))
        return body,len(self_intersections)

    def skin_inward(verts,indices):
        # BVH intersection alone does not catch completely enclosed panels.
        # Deny proposals that move a vertex appreciably behind the nearest
        # *oriented* skin face. Preserve the more complete final preflight.
        for i in indices:
            p=verts[i]
            world=Vector((p.x,-p.z,p.y))
            close=[t.find_nearest(world) for t in body_bvhs]
            close=[r for r in close if r[0] is not None]
            if not close:continue
            nearest,normal,_,_=min(close,key=lambda item:item[3])
            if (world-nearest).dot(normal)<-.002:
                return True
        return False

    body_start,self_start=bvh_contacts(vertices)
    if body_start or self_start or strain(vertices)>args.max_edge_change or skin_inward(vertices,range(len(vertices))):
        raise RuntimeError('Rigid optimizer requires validated zero-contact starting geometry and strain')
    before=gap_stats(vertices)
    best=vertices
    best_objective=objective(best)
    accepted=[]
    proposed=0
    strain_fail=0
    body_fail=0
    self_fail=0
    inward_fail=0
    moves=0

    def moved(source,name,axis,amount,rotation):
        result=[p.copy() for p in source]
        ids=pieces[name]
        if rotation:
            # Around individual current piece centre; preserves all triangle
            # rest edge lengths exactly.
            origin=sum((source[i] for i in ids),Vector())/len(ids)
            q=Quaternion(axis,math.radians(amount))
            for i in ids:
                result[i]=origin+q@(source[i]-origin)
        else:
            displacement=axis*amount
            for i in ids:result[i]+=displacement
        return result

    # Work from moderate shifts down to millimetres. Each move gets a full
    # garment BVH contact test; no cloth vertex snapping is permitted.
    schedule=((.04,18),(.02,9),(.01,4.5),(.005,2),(.002,1),(.001,.5))
    for round_id in range(args.rounds):
        changed=False
        for shift,angle in schedule:
            for name in ('front','back','sleeve-left','sleeve-right'):
                for _ in range(4):
                    winner=None
                    winner_score=best_objective
                    for axis in (Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))):
                        for direction in (-1,1):
                            for rotation,amount in ((False,shift),(True,angle)):
                                proposed+=1
                                attempt=moved(best,name,axis,direction*amount,rotation)
                                score=objective(attempt)
                                if score>=winner_score-1e-7:
                                    continue
                                if strain(attempt)>args.max_edge_change:
                                    strain_fail+=1
                                    continue
                                body,self_hits=bvh_contacts(attempt)
                                if body:
                                    body_fail+=1
                                    continue
                                if self_hits:
                                    self_fail+=1
                                    continue
                                if skin_inward(attempt,pieces[name]):
                                    inward_fail+=1
                                    continue
                                winner=attempt
                                winner_score=score
                    if winner is None:
                        break
                    best=winner
                    best_objective=winner_score
                    changed=True
                    moves+=1
                    if moves%10==0:
                        accepted.append({'move':moves,'round':round_id,'piece':name,
                                         'meanSeamGapCm':gap_stats(best)['meanCm'],
                                         'maximumSeamGapCm':gap_stats(best)['maximumCm']})
        if not changed:
            break
    after=gap_stats(best)
    body_end,self_end=bvh_contacts(best)
    deform=strain(best)
    result=json.loads(json.dumps(payload))
    result['shell']['vertices']=[list(p) for p in best]
    result.setdefault('scene',{}).setdefault('staging',{})['rigidPostalignment']={
        'acceptedMoves':moves,'maximumEdgeChange':deform}
    report={
        'algorithm':'contact-constrained-four-piece-rigid-seam-postalignment-v1',
        'inputMeanGapCm':before['meanCm'],'inputMaximumGapCm':before['maximumCm'],
        'outputMeanGapCm':after['meanCm'],'outputMaximumGapCm':after['maximumCm'],
        'maximumIntrinsicEdgeChange':round(deform,7),
        'bodyIntersectionPairs':body_end,'selfIntersectionPairs':self_end,
        'signedSkinClear':not skin_inward(best,range(len(best))),
        'proposals':proposed,'acceptedMoves':moves,
        'worstSeamWeight':args.worst_seam_weight,
        'rejectedForStrain':strain_fail,'rejectedForBody':body_fail,
        'rejectedForSelf':self_fail,'rejectedForBehindSkin':inward_fail,
        'beforeSeamGroups':before['groups'],'afterSeamGroups':after['groups'],
        'progress':accepted,
        'initialAssemblyAccepted':after['maximumCm']<=3 and deform<=args.max_edge_change and
                                  not body_end and not self_end,
        'fullTrajectoryCertified':False,
    }
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
    print('RIGID_POSTALIGN',json.dumps({k:v for k,v in report.items()
                                      if k not in ('beforeSeamGroups','afterSeamGroups','progress')}),flush=True)

if __name__=='__main__':
    main()
