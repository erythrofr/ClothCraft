"""Experimental contact-aware Jacobi sewing relaxation for initial arrangements.

This is NOT a replacement for the ST-Tech/ZOZO PPF simulator or its IPC CCD
trajectory audit. It only searches for a low-strain, body-clear starting pose
from the existing triangulated 2D panels, using physical stitch correspondences.
"""
import argparse,json,math,sys
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def options():
    p=argparse.ArgumentParser()
    for key in ('input','flat-reference','output','report'):p.add_argument('--'+key,required=True)
    p.add_argument('--steps',type=int,default=250)
    p.add_argument('--max-strain',type=float,default=.05)
    p.add_argument('--sew-step-mm',type=float,default=1.5)
    p.add_argument('--debug',action='store_true')
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

def main():
    args=options()
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar,collection
    payload=json.loads(Path(args.input).read_text())
    reference=json.loads(Path(args.flat_reference).read_text())
    current=np.asarray(payload['shell']['vertices'],dtype=np.float64)
    source=np.asarray(reference['shell']['vertices'],dtype=np.float64)
    if source.shape!=current.shape or payload['shell']['faces']!=reference['shell']['faces']:
        raise ValueError('Reference and initial pose must use the same vertex IDs and triangles')
    faces=np.asarray(payload['shell']['faces'],dtype=np.int64)
    seam_pairs=np.asarray([[e['a'],e['b']] for e in payload['shell']['stitchEdges']],dtype=np.int64)
    seam_groups=defaultdict(list)
    for e in payload['shell']['stitchEdges']:
        seam_groups[e.get('seamId','unnamed')].append((int(e['a']),int(e['b'])))
    owner={v:p['id'] for p in payload['shell']['pieces'] for v in p['particleIndices']}
    unique_edges=np.unique(np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]],axis=0),axis=1),axis=0)
    rest=np.linalg.norm(source[unique_edges[:,0]]-source[unique_edges[:,1]],axis=1)
    if np.any(rest<1e-8): raise RuntimeError('Zero-length manufactured pattern edge')
    original=current.copy()
    body_objects=build_avatar(payload,collection('PPF_XPBD_Assembly_Search'))
    deps=bpy.context.evaluated_depsgraph_get()
    trees=[BVHTree.FromObject(o,deps) for o in body_objects]
    face_tuples=[tuple(x) for x in faces.tolist()]
    vertex_counts=np.zeros(len(current),dtype=np.float64)
    np.add.at(vertex_counts,unique_edges[:,0],1)
    np.add.at(vertex_counts,unique_edges[:,1],1)
    vertex_counts=np.maximum(vertex_counts,1)

    def strain(positions):
        lengths=np.linalg.norm(positions[unique_edges[:,0]]-positions[unique_edges[:,1]],axis=1)
        return float(np.max(np.abs(lengths/rest-1)))
    def gaps(positions):
        d=np.linalg.norm(positions[seam_pairs[:,0]]-positions[seam_pairs[:,1]],axis=1)
        return float(d.mean()),float(d.max())
    def intersections(positions):
        points=[Vector((p[0],-p[2],p[1])) for p in positions]
        surface=BVHTree.FromPolygons(points,face_tuples,all_triangles=True)
        body=sum(len(surface.overlap(t)) for t in trees)
        self_pairs=set()
        for a,b in surface.overlap(surface):
            if a==b or set(face_tuples[a])&set(face_tuples[b]):continue
            self_pairs.add(tuple(sorted((a,b))))
        return body,len(self_pairs)
    def project_lengths(positions,strength=.7):
        d=positions[unique_edges[:,0]]-positions[unique_edges[:,1]]
        length=np.maximum(np.linalg.norm(d,axis=1),1e-8)
        # Enforce only physical stretch/compression limits, not perfect zero
        # strain everywhere. Aggressively resetting all edges to rest caused
        # the previously valid draped mesh to fight sewing and stall even
        # when the seam step approached zero.
        target=np.clip(length,rest*(1-.045),rest*(1+.045))
        correction=(.5*strength*(length-target)/length)[:,None]*d
        accumulated=np.zeros_like(positions)
        np.add.at(accumulated,unique_edges[:,0],-correction)
        np.add.at(accumulated,unique_edges[:,1],correction)
        positions+=accumulated/vertex_counts[:,None]
    def project_body(positions,margin=.003):
        for i,p in enumerate(positions):
            sample=Vector((float(p[0]),-float(p[2]),float(p[1])))
            nearby=[tree.find_nearest(sample) for tree in trees]
            nearby=[a for a in nearby if a[0] is not None]
            if not nearby:continue
            point,normal,_,_=min(nearby,key=lambda k:k[3])
            signed=(sample-point).dot(normal)
            if signed<margin:
                corrected=sample+normal*(margin-signed)
                positions[i]=[corrected.x,corrected.z,-corrected.y]
    def stitch_pull(positions,max_step):
        delta=positions[seam_pairs[:,1]]-positions[seam_pairs[:,0]]
        mag=np.maximum(np.linalg.norm(delta,axis=1),1e-8)
        scale=np.minimum(.5*max_step/mag, .22)
        updates=delta*scale[:,None]
        acc=np.zeros_like(positions)
        cnt=np.zeros(len(positions))
        np.add.at(acc,seam_pairs[:,0],updates)
        np.add.at(acc,seam_pairs[:,1],-updates)
        np.add.at(cnt,seam_pairs[:,0],1)
        np.add.at(cnt,seam_pairs[:,1],1)
        positions+=acc/np.maximum(cnt[:,None],1)

    initial_mean,initial_max=gaps(current)
    initial_strain=strain(current)
    initial_body,initial_self=intersections(current)
    if initial_body or initial_self or initial_strain>args.max_strain:
        raise RuntimeError('Starting pose must be collision-free and within manufactured fabric strain')
    best=current.copy()
    best_objective=initial_mean+.25*initial_max
    progress=[]
    step_size=args.sew_step_mm/1000
    accepted=0
    rejected=0
    for step in range(args.steps):
        proposal=current.copy()
        stitch_pull(proposal,step_size)
        if args.debug and step<2:print('RELAX_DEBUG','step',step,'after-sew-strain',strain(proposal),flush=True)
        for _ in range(8):
            project_lengths(proposal,.85)
        if args.debug and step<2:print('RELAX_DEBUG','after-springs',strain(proposal),flush=True)
        project_body(proposal,.001)
        if args.debug and step<2:print('RELAX_DEBUG','after-contact',strain(proposal),flush=True)
        for _ in range(2):
            project_lengths(proposal,.4)
        maximum_strain=strain(proposal)
        if args.debug and step<2:print('RELAX_DEBUG','after-final-springs',maximum_strain,flush=True)
        # Jacobi structural projection sometimes lowers total spring energy
        # while raising a single highly curved triangle beyond 5%. Search
        # along the displacement from the last valid pose and reject *only*
        # if no step can satisfy strain and collision simultaneously.
        valid_step=False
        for scale in (1,.5,.25,.125,.0625,.03125,.015625,.0078125):
            attempt=current+scale*(proposal-current)
            if strain(attempt)>args.max_strain:continue
            # Every accepted pose must pass actual Thomas/body and cloth
            # triangle intersection tests, not just every fifth iteration.
            body,self_hits=intersections(attempt)
            if body or self_hits:continue
            proposal=attempt
            maximum_strain=strain(proposal)
            valid_step=True
            break
        if not valid_step:
            rejected+=1
            step_size*=.8
            if step_size<.00004:break
            continue
        current=proposal
        accepted+=1
        if step%10==0 or step==args.steps-1:
            mean,maximum=gaps(current)
            objective=mean+.25*maximum
            body,self_hits=intersections(current)
            if not body and not self_hits and maximum_strain<=args.max_strain and objective<best_objective:
                best,best_objective=current.copy(),objective
            progress.append({'step':step,'accepted':accepted,'rejected':rejected,
                             'meanSeamGapCm':round(mean*100,3),
                             'maxSeamGapCm':round(maximum*100,3),
                             'maxEdgeChange':round(maximum_strain,5),
                             'bodyCrossings':body,'selfCrossings':self_hits,
                             'stepMm':round(step_size*1000,4)})
        else:
            mean,maximum=gaps(current)
            objective=mean+.25*maximum
            if objective<best_objective:
                body,self_hits=intersections(current)
                if not body and not self_hits and maximum_strain<=args.max_strain:
                    best,best_objective=current.copy(),objective
    mean,maximum=gaps(best)
    body,self_hits=intersections(best)
    final={
      'algorithm':'length-projected-body-contact-seam-relaxation-v1',
      'stepsAttempted':args.steps,'stepsAccepted':accepted,'stepsRejected':rejected,
      'initialMeanGapCm':round(initial_mean*100,3),
      'finalMeanGapCm':round(mean*100,3),
      'initialMaxGapCm':round(initial_max*100,3),
      'finalMaxGapCm':round(maximum*100,3),
      'initialStrain':round(initial_strain,6),
      'finalMaxEdgeStrain':round(strain(best),6),
      'bodyCrossings':body,'selfCrossings':self_hits,
      'sewPairs':len(seam_pairs),
      'progress':progress,'nearAssembled':maximum<=.03,
      'fullTrajectoryCertified':False,
    }
    new=json.loads(json.dumps(payload))
    new['shell']['vertices']=best.tolist()
    new.setdefault('scene',{}).setdefault('staging',{})['seamRelaxation']={k:v for k,v in final.items() if k!='progress'}
    Path(args.output).write_text(json.dumps(new,indent=2)+'\n')
    Path(args.report).write_text(json.dumps(final,indent=2)+'\n')
    print('PPF_SEAM_RELAXATION',json.dumps({k:v for k,v in final.items() if k!='progress'}),flush=True)

if __name__=='__main__':main()
