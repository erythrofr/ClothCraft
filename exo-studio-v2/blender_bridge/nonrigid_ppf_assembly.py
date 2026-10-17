"""Experimental PPF assembly: refined sleeve mesh, developable cone, armhole fit.

Preserves existing sewing IDs and flat pattern dimensions while refining the
mesh before bending. Verifies true Thomas/cloth BVH intersections and <5%
maximum intrinsic edge distortion. Torso shoulder and side seams still require
their own assembly solver; zero intersections at frame zero do NOT certify
the full PPF/IPC trajectory.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree


def cmdline():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--max-stretch', type=float, default=0.05)
    parser.add_argument('--sleeve-subdivisions', type=int, default=1)
    parser.add_argument('--torso-subdivisions', type=int, default=0)
    parser.add_argument('--sleeve-seam-opening-rad', type=float, default=0.08)
    parser.add_argument('--no-seam-alignment', action='store_true')
    return parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def main():
    args=cmdline()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar, collection

    from refine_ppf_sleeves import refine_sleeve_triangles, refine_pattern_triangles
    raw_payload=json.loads(Path(args.input).read_text())
    payload=refine_sleeve_triangles(raw_payload, args.sleeve_subdivisions)
    payload=refine_pattern_triangles(payload, ('front','back'), args.torso_subdivisions)
    base=[Vector(tuple(map(float,v))) for v in payload['shell']['vertices']]
    faces=[tuple(map(int,f)) for f in payload['shell']['faces']]
    pieces={p['id']:list(p['particleIndices']) for p in payload['shell']['pieces']}
    seams=[(int(e['a']),int(e['b'])) for e in payload['shell']['stitchEdges']]
    sleeve_profiles={}
    for sleeve_id in ('sleeve-left','sleeve-right'):
        samples=[]
        for edge in payload['shell']['stitchEdges']:
            seam_name = 'seam-sleeve-l-underarm' if sleeve_id == 'sleeve-left' else 'seam-sleeve-r-underarm'
            if edge.get('seamId') != seam_name:
                continue
            first,second=base[int(edge['a'])],base[int(edge['b'])]
            samples.append(((first.y+second.y)*.5, (first.z+second.z)*.5,
                            abs(first.z-second.z)*.5))
        if not samples:
            raise ValueError(f'Missing physical sleeve tube underarm profile: {sleeve_id}')
        sleeve_profiles[sleeve_id]=sorted(samples)
    owner={vertex:piece for piece,ids in pieces.items() for vertex in ids}
    if len(owner)!=len(base):
        raise RuntimeError('Each nonrigid vertex must belong to exactly one garment piece')

    skin=build_avatar(payload, collection('PPF_Nonrigid_Thomas'))
    graph=bpy.context.evaluated_depsgraph_get()
    body_trees=[BVHTree.FromObject(obj,graph) for obj in skin]

    rest_edges=set()
    for a,b,c in faces:
        for u,v in ((a,b),(b,c),(c,a)):
            if owner[u]!=owner[v]:
                raise RuntimeError('Face contains vertices from different 2D pattern pieces')
            rest_edges.add(tuple(sorted((u,v))))
    rest_lengths={(a,b):(base[a]-base[b]).length for a,b in rest_edges}

    def deformation(vertices):
        ratios=[]
        for (a,b),length in rest_lengths.items():
            if length>1e-8:
                ratios.append((vertices[a]-vertices[b]).length/length)
        return max((abs(ratio-1) for ratio in ratios), default=0)

    def intersections(vertices):
        coords=[Vector((v.x,-v.z,v.y)) for v in vertices]
        tree=BVHTree.FromPolygons(coords,faces,all_triangles=True)
        body=sum(len(tree.overlap(skin_tree)) for skin_tree in body_trees)
        own=0
        seen=set()
        for a,b in tree.overlap(tree):
            if a==b or set(faces[a])&set(faces[b]):
                continue
            pair=tuple(sorted((a,b)))
            if pair not in seen:
                seen.add(pair);own+=1
        return body,own

    def gaps(vertices):
        distances=[(vertices[a]-vertices[b]).length for a,b in seams]
        return (sum(distances)/len(distances),max(distances))

    initial_body,initial_self=intersections(base)
    if initial_body or initial_self:
        raise RuntimeError('Input staging intersects actual Thomas or itself')

    # Isometric cylinder: the x-coordinate becomes arc length, not a linear
    # projection. Unlike scaling to a radius, this preserves lateral lengths
    # locally: d/dx[r*sin(x/r), r*cos(x/r)] has magnitude exactly one.
    def layout(radius, sleeve_pitch, sleeve_roll, sleeve_lift, wrap_fraction, sleeve_inset, back_clearance=0):
        out=[v.copy() for v in base]
        for name in ('front','back'):
            if radius is None: continue
            ids=pieces.get(name,[])
            if not ids: continue
            sign=1 if name=='front' else -1
            x_mid=(min(base[i].x for i in ids)+max(base[i].x for i in ids))*.5
            for i in ids:
                x=base[i].x-x_mid
                # Widening the starting garment may be necessary, but must
                # remain inside the separately checked deformation limit.
                angle=max(-math.pi/2,min(math.pi/2,x/radius))
                out[i].x=radius*math.sin(angle)
                out[i].z=sign*radius*math.cos(angle)-(back_clearance if name=='back' else 0)
        for name in ('sleeve-left','sleeve-right'):
            ids=pieces.get(name,[])
            if not ids:continue
            side=-1 if name=='sleeve-left' else 1
            center=sum((base[i] for i in ids),Vector())/len(ids)
            pitch=math.radians(sleeve_pitch)*side
            roll=math.radians(sleeve_roll)*side
            cp,sp=math.cos(pitch),math.sin(pitch)
            cr,sr=math.cos(roll),math.sin(roll)
            for i in ids:
                p=base[i]-center
                # Rotate the complete sleeve patch, preserving its original
                # triangulated intrinsic lengths before any optional bending.
                y=p.y*cp-p.z*sp
                z=p.y*sp+p.z*cp
                x=p.x*cr-z*sr
                z=p.x*sr+z*cr
                out[i]=Vector((center.x+x-side*sleeve_inset,center.y+sleeve_lift+y,center.z+z))
        # Treat each sleeve as a curved tube section in its local Y-Z plane.
        # Both long underarm edge sets are opposite sides of the same planar
        # 38 cm sleeve width; sewing them through the arm is not an option.
        # Mapping cross-sleeve width to arc length enables a real underarm
        # closure while maintaining the template's sewing topology.
        for name in ('sleeve-left','sleeve-right'):
            ids=pieces.get(name,[])
            if not ids:continue
            side=-1 if name=='sleeve-left' else 1
            profile=sleeve_profiles[name]
            # The drafted sleeve tapers. Mapping every cross section to a
            # differently sized CYLINDER introduces >6% shear even with a
            # fine mesh. A truncated CONE is a developable surface: its
            # unrolling is exactly the original flat tapered sleeve.
            # Flat polar angle alpha becomes azimuth alpha / cone_opening.
            zcenter=sum(item[1] for item in profile)/len(profile)
            taper=(profile[-1][2]-profile[0][2])/(profile[-1][0]-profile[0][0])
            if taper<=0:
                raise ValueError(f'Unsupported sleeve taper for conical assembly: {name}: {taper}')
            apex=profile[0][0]-profile[0][2]/taper
            # Keep a small gap at the unfinished underarm sewline. Exact
            # coincident edges trigger false-positive BVH self-intersections
            # before PPF activates the stitch constraints.
            opening=math.atan(taper)/(math.pi-args.sleeve_seam_opening_rad)
            reference_radius=opening*(sum(item[0] for item in profile)/len(profile)-apex)
            axial_scale=math.sqrt(1-opening*opening)
            for i in ids:
                longitudinal=base[i].y-apex
                transverse=base[i].z-zcenter
                rho=math.hypot(longitudinal,transverse)
                azimuth=math.atan2(transverse,longitudinal)/opening
                r=opening*rho
                influence=wrap_fraction
                original=out[i].copy()
                tube=Vector((original.x+side*(reference_radius-r*math.cos(azimuth)),
                             original.y+(apex+axial_scale*rho-base[i].y),
                             zcenter+r*math.sin(azimuth)))
                out[i]=original.lerp(tube,influence)
        return out

    baseline=gaps(base)
    seam_groups={}
    for edge in payload['shell']['stitchEdges']:
        seam_groups.setdefault(edge.get('seamId','unnamed'),[]).append((int(edge['a']),int(edge['b'])))
    def seam_group_report(vertices):
        return {name:{'pairs':len(pairs),
                      'meanGapCm':round(100*sum((vertices[a]-vertices[b]).length for a,b in pairs)/len(pairs),3),
                      'maximumGapCm':round(100*max((vertices[a]-vertices[b]).length for a,b in pairs),3)}
                for name,pairs in seam_groups.items()}
    best=base
    best_values={'radius':None,'sleevePitchDeg':0,'sleeveRollDeg':0,'sleeveLiftM':0}
    best_score=baseline[0]+.2*baseline[1]
    tested=0;safe=0;strain_rejected=0;body_rejected=0;self_rejected=0
    selected_wrap_issues=[]
    radius_diagnostics={}
    torso_collision_locations={}
    torso_clearance_scan=[]
    for trial_radius in ((.20,.21,.22,.23,.24,.25,.26,.28) if args.torso_subdivisions else ()):
        for clearance in (0,.01,.02,.03,.04,.06):
            option=layout(trial_radius,0,0,0,0,0,clearance)
            option_strain=deformation(option)
            body_hits,self_hits=intersections(option)
            option_mean,option_max=gaps(option)
            torso_clearance_scan.append({'radiusM':trial_radius,'backClearanceM':clearance,
                'maxEdgeChange':round(option_strain,4),'bodyHits':body_hits,'selfHits':self_hits,
                'meanGapCm':round(option_mean*100,3),'maxGapCm':round(option_max*100,3)})
    best_unconstrained=None
    # Limited reproducible grid rather than unchecked direct 2D-to-body snap.
    for radius in ((None,.20,.24,.28) if args.torso_subdivisions else (None,)):
        for pitch in (-20,0,20):
            for roll in (-20,0,20):
                for lift in (-.08,0,.08):
                  for wrap_fraction in (0.0,.90,1.0):
                   for sleeve_inset in (-.15,-.10,-.05,0.0,.05,.10):
                    candidate=layout(radius,pitch,roll,lift,wrap_fraction,sleeve_inset)
                    tested+=1
                    strain=deformation(candidate)
                    rad_key='none' if radius is None else str(radius)
                    radial=radius_diagnostics.setdefault(rad_key,{'tested':0,'strainRejected':0,'collisionRejected':0,'safe':0,'minimumStrain':1e3})
                    radial['tested']+=1
                    radial['minimumStrain']=min(radial['minimumStrain'],strain)
                    if wrap_fraction>0 and radius is None and pitch==0 and roll==0 and lift==0 and sleeve_inset==0:
                        before_underarm=[v for k,v in seam_group_report(base).items() if 'underarm' in k]
                        after_underarm=[v for k,v in seam_group_report(candidate).items() if 'underarm' in k]
                        trial={'sleeveWrapFraction':wrap_fraction,'maximumRelativeIntrinsicEdgeChange':round(strain,6),
                               'underarmMeanGapBeforeCm':round(sum(v['meanGapCm'] for v in before_underarm)/len(before_underarm),3),
                               'underarmMeanGapAfterCm':round(sum(v['meanGapCm'] for v in after_underarm)/len(after_underarm),3)}
                        if best_unconstrained is None or trial['underarmMeanGapAfterCm']<best_unconstrained['underarmMeanGapAfterCm']:
                            best_unconstrained=trial
                    if strain>args.max_stretch+1e-8:
                        strain_rejected+=1
                        radial['strainRejected']+=1
                        continue
                    body,self_cross=intersections(candidate)
                    if body or self_cross:
                        if body: body_rejected+=1
                        if self_cross:self_rejected+=1
                        radial['collisionRejected']+=1
                        if radius is not None and pitch==0 and roll==0 and lift==0 and sleeve_inset==0 and wrap_fraction==0.0:
                            cloth_tree=BVHTree.FromPolygons([Vector((v.x,-v.z,v.y)) for v in candidate],faces,all_triangles=True)
                            impacted={}
                            for body_tree in body_trees:
                                for cloth_face,_ in cloth_tree.overlap(body_tree):
                                    piece_name=payload['shell']['facePieceIds'][cloth_face]
                                    entry=impacted.setdefault(piece_name,{'faces':set(),'minHeight':1e3,'maxHeight':0})
                                    entry['faces'].add(cloth_face)
                                    cy=sum(candidate[i].y for i in faces[cloth_face])/3
                                    entry['minHeight']=min(entry['minHeight'],cy)
                                    entry['maxHeight']=max(entry['maxHeight'],cy)
                            torso_collision_locations[str(radius)]={k:{'faces':len(v['faces']),
                                      'heightRangeM':[round(v['minHeight'],3),round(v['maxHeight'],3)]} for k,v in impacted.items()}
                        if radius is None and wrap_fraction==1.0 and pitch==0 and roll==0 and lift==0:
                            selected_wrap_issues.append({'sleeveInsetM':sleeve_inset,'bodyTriangles':body,'selfTriangles':self_cross,'strain':round(strain,4)})
                        continue
                    safe+=1
                    radial['safe']+=1
                    mean,maximum=gaps(candidate)
                    score=mean+.2*maximum
                    if score<best_score:
                        best,best_score=candidate,score
                        best_values={'radius':radius,'sleevePitchDeg':pitch,'sleeveRollDeg':roll,'sleeveLiftM':lift,'sleeveWrapFraction':wrap_fraction,'sleeveInsetM':sleeve_inset}

    # The strict nonrigid candidates can all fail strain or contact. In that
    # case use the prior rigid-piece optimizer's well-defined geometry as an
    # alternate, but never mislabel its result as a nonrigid certified pose.
    fallback_candidate=Path(args.input).with_name('staged.json')
    fallback_selected=False
    if fallback_candidate.exists() and args.sleeve_subdivisions == 0 and args.torso_subdivisions == 0:
        alternate=json.loads(fallback_candidate.read_text())
        other=[Vector(tuple(map(float,v))) for v in alternate['shell']['vertices']]
        other_strain=deformation(other)
        body,self_cross=intersections(other)
        other_mean,other_max=gaps(other)
        if other_strain<=args.max_stretch and body==0 and self_cross==0 and other_mean+.2*other_max<best_score:
            best=other;best_score=other_mean+.2*other_max
            best_values={'fallback':'verified-rigid-assembly'}
            fallback_selected=True

    # The torso and sleeve cap pattern edges are matched by sewing vertex ID.
    # Once the sleeve is developably folded, align it as a rigid object around
    # Thomas using those actual stitch correspondences. Do NOT warp individual
    # vertices to their targets: that would conceal pattern sizing defects.
    alignment_history=[]
    if not args.no_seam_alignment:
        for sleeve_id in ('sleeve-left','sleeve-right'):
            sleeve_indices=pieces[sleeve_id]
            shoulder_pairs=[(a,b) for a,b in seams if
                            (owner[a]==sleeve_id) != (owner[b]==sleeve_id)]
            def alignment_score(vertices):
                ds=sorted(((vertices[a]-vertices[b]).length for a,b in shoulder_pairs),reverse=True)
                return sum(ds)/len(ds)+.15*sum(ds[:max(1,len(ds)//5)])/max(1,len(ds)//5)

            def moved(vertices,axis,distance,rotation=False):
                proposal=[v.copy() for v in vertices]
                if rotation:
                    pivot=sum((vertices[i] for i in sleeve_indices),Vector())/len(sleeve_indices)
                    q=Quaternion(axis,math.radians(distance))
                    for i in sleeve_indices:
                        proposal[i]=pivot+q@(vertices[i]-pivot)
                else:
                    shift=axis*distance
                    for i in sleeve_indices:
                        proposal[i]+=shift
                return proposal

            before=alignment_score(best)
            moves=0
            for shift,angle in ((.12,70),(.08,40),(.04,20),(.02,10),(.01,5),(.005,2.5)):
                # Independent sleeve coordinates allow opposite orientations
                # on left/right instead of the old mirrored one-size grid.
                for _ in range(8):
                    candidate_best=best
                    candidate_score=alignment_score(best)
                    for axis in (Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))):
                        for sign in (-1,1):
                            for rotation,amount in ((False,shift),(True,angle)):
                                proposal=moved(best,axis,amount*sign,rotation)
                                value=alignment_score(proposal)
                                if value+1e-6>=candidate_score:
                                    continue
                                body,self_cross=intersections(proposal)
                                if body or self_cross:
                                    continue
                                candidate_best,candidate_score=proposal,value
                    if candidate_best is best:
                        break
                    best=candidate_best
                    moves+=1
            after=alignment_score(best)
            alignment_history.append({'piece':sleeve_id,'acceptedMoves':moves,
                                      'initialArmholeObjectiveCm':round(before*100,3),
                                      'finalArmholeObjectiveCm':round(after*100,3)})

    mean,maximum=gaps(best)
    strain=deformation(best)
    body,self_cross=intersections(best)
    certified=bool(maximum<=.03 and strain<=args.max_stretch and body==0 and self_cross==0)
    result=json.loads(json.dumps(payload))
    result['shell']['vertices']=[[v.x,v.y,v.z] for v in best]
    result.setdefault('scene',{}).setdefault('staging',{})['nonrigidLayout']={**best_values,'certifiedInitialAssembly':certified}
    report={
        'algorithm':'developable-conical-sleeve-refinement-and-armhole-alignment-v2',
        'realBodyCollisionMesh':payload.get('avatar',{}).get('mode')=='local-thomas-body-mesh',
        'colliderMode':payload.get('avatar',{}).get('mode','garment-studio-proxy'),
        'candidatesTested':tested,'safeCandidates':safe,
        'rejectedStrain':strain_rejected,'rejectedBodyCollision':body_rejected,
        'rejectedSelfCollision':self_rejected,'wrapCollisionExamples':selected_wrap_issues[:10],
        'beforeMeanSeamGapCm':round(baseline[0]*100,3),
        'afterMeanSeamGapCm':round(mean*100,3),
        'beforeMaximumSeamGapCm':round(baseline[1]*100,3),
        'afterMaximumSeamGapCm':round(maximum*100,3),
        'maximumRelativeIntrinsicEdgeChange':round(strain,7),
        'maximumAllowedRelativeEdgeChange':args.max_stretch,
        'bodyIntersectionPairs':body,'selfIntersectionPairs':self_cross,
        'selected':best_values,'fallbackSelected':fallback_selected,
        'seamAlignment':alignment_history,
        'sleeveSubdivisionLevels':args.sleeve_subdivisions,
        'torsoSubdivisionLevels':args.torso_subdivisions,
        'initialMeshVertices':len(raw_payload['shell']['vertices']),
        'refinedMeshVertices':len(payload['shell']['vertices']),
        'geometryPreservedOrWithinLimit':strain<=args.max_stretch,
        'bodyAndSelfIntersectionFreeAtInitialPose':body==0 and self_cross==0,
        'initialAssemblyAccepted':certified,'fullTrajectoryCertified':False,
        'underarmWrappingDiagnostic':best_unconstrained,
        'radiusDiagnostics':radius_diagnostics,
        'torsoCollisionLocations':torso_collision_locations,
        'torsoClearanceScan':torso_clearance_scan,
        'seamGroupsBefore':seam_group_report(base),'seamGroupsAfter':seam_group_report(best),
    }
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
    print('PPF_NONRIGID_ASSEMBLY='+json.dumps(report))


if __name__=='__main__':
    main()
