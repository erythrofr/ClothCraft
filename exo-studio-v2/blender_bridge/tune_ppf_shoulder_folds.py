"""Contact-guarded orthogonal shoulder fold on partially bent T-shirt panels.

The garment starts at a validated shallow side bend. Near the neckline the
side bend gradually relaxes and the fabric rolls around a horizontal
shoulder cylinder. This keeps sewing vertex IDs and 2D rest lengths intact.
Rejected candidates cannot enter the PPF production solver.
"""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def main():
    opts=argparse.ArgumentParser()
    for name in ('input','flat-reference','output','report'):
        opts.add_argument('--'+name,required=True)
    opts.add_argument('--max-strain',type=float,default=.05)
    args=opts.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar,collection
    input_payload=json.loads(Path(args.input).read_text())
    reference=json.loads(Path(args.flat_reference).read_text())
    rest=[Vector(x) for x in reference['shell']['vertices']]
    initial=[Vector(x) for x in input_payload['shell']['vertices']]
    if len(rest)!=len(initial) or input_payload['shell']['faces']!=reference['shell']['faces']:
        raise ValueError('Flat and partial-wrap shells do not share mesh topology')
    pieces={p['id']:p['particleIndices'] for p in reference['shell']['pieces']}
    faces=[tuple(f) for f in reference['shell']['faces']]
    piece_by_face=reference['shell']['facePieceIds']
    seams=[(int(e['a']),int(e['b']),e.get('seamId','')) for e in reference['shell']['stitchEdges']]
    seam_pairs=[(a,b) for a,b,_ in seams]
    upper_pairs=[(a,b) for a,b,s in seams if 'shoulder' in s]
    sided_pairs=[(a,b) for a,b,s in seams if s.startswith('seam-side-')]
    edges=set()
    for face,owner in zip(faces,piece_by_face):
        if owner in ('front','back'):
            for a,b in ((face[0],face[1]),(face[1],face[2]),(face[2],face[0])):
                edges.add(tuple(sorted((a,b))))
    lengths={(a,b):(rest[a]-rest[b]).length for a,b in edges}
    skin=build_avatar(input_payload,collection('PPF_Shouldered_Thomas'))
    deps=bpy.context.evaluated_depsgraph_get()
    skin_trees=[BVHTree.FromObject(o,deps) for o in skin]

    def strain(v):
        return max((abs((v[a]-v[b]).length/ll-1)
                    for (a,b),ll in lengths.items() if ll>1e-8),default=0)
    def gap(v,pairs):
        d=[(v[a]-v[b]).length for a,b in pairs]
        return sum(d)/len(d),max(d)
    def check_collision(v):
        bvh=BVHTree.FromPolygons([Vector((x.x,-x.z,x.y)) for x in v],faces,all_triangles=True)
        body=sum(len(bvh.overlap(t)) for t in skin_trees)
        cloth=set()
        for a,b in bvh.overlap(bvh):
            if a==b or set(faces[a])&set(faces[b]):continue
            cloth.add(tuple(sorted((a,b))))
        return body,len(cloth)
    def fold(r, start, fade_low, fade_high, fraction):
        if fade_high<=fade_low:raise ValueError('Bad transverse shoulder transition')
        out=[p.copy() for p in initial]
        for name in ('front','back'):
            sign=1 if name=='front' else -1
            for i in pieces[name]:
                pos=rest[i]
                u=max(0,min(1,(pos.y-fade_low)/(fade_high-fade_low)))
                # Quintic smootherstep avoids stretching at the transition
                # endpoints. Use the originally drafted pattern as the
                # unbent reference; the first stage remains independent.
                weight=fraction*u*u*u*(u*(6*u-15)+10)
                out[i].x=(1-weight)*initial[i].x+weight*rest[i].x
                out[i].z=(1-weight)*initial[i].z+weight*rest[i].z
                t=max(0,pos.y-start)
                sweep=t/r
                if sweep<=math.pi/2:
                    out[i].y=start+r*math.sin(sweep) if t else pos.y
                    dz=r*(1-math.cos(sweep))
                else:
                    out[i].y=start+r
                    dz=r+(t-r*math.pi/2)
                out[i].z-=sign*dz
        return out

    orig_gap=gap(initial,seam_pairs)
    best=initial
    best_score=orig_gap[0]+.14*orig_gap[1]
    selected={'mode':'original'}
    tried=0; strain_rejected=0; contact_rejected=0;safe=0
    accepted=[]
    diagnostics=[]
    minimum_strain=1e3
    minimum_strain_args=None
    for radius in (.24,.30,.36,.42,.50,.65,.8):
      for start in (1.49,1.52,1.55,1.58,1.61,1.64):
       for fade_lo in (1.20,1.35):
        for fade_hi in (1.68,1.78):
         for fraction in (0.,.25,.5,.75):
          tried+=1
          proposal=fold(radius,start,fade_lo,fade_hi,fraction)
          stretch=strain(proposal)
          if stretch<minimum_strain:
              minimum_strain=stretch
              minimum_strain_args=(radius,start,fade_lo,fade_hi,fraction)
          if stretch>args.max_strain:
              strain_rejected+=1
              continue
          body,selfhits=check_collision(proposal)
          if body or selfhits:
              contact_rejected+=1
              if len(diagnostics)<12:
                  diagnostics.append({'r':radius,'start':start,'fade':[fade_lo,fade_hi],
                                      'fraction':fraction,'body':body,'self':selfhits,'strain':round(stretch,4)})
              continue
          safe+=1
          mean,maximum=gap(proposal,seam_pairs)
          sh=gap(proposal,upper_pairs)
          si=gap(proposal,sided_pairs)
          item={'radius':radius,'foldStart':start,'fadeLow':fade_lo,
                'fadeHigh':fade_hi,'unbendFraction':fraction,
                'meanGapCm':round(mean*100,3),
                'maximumGapCm':round(maximum*100,3),
                'shoulderMeanCm':round(sh[0]*100,3),
                'sideMeanCm':round(si[0]*100,3),
                'strain':round(stretch,6)}
          accepted.append(item)
          score=mean+.14*maximum
          if score+1e-7<best_score:
              best,best_score,selected=proposal,score,item
    summary=gap(best,seam_pairs)
    body,selfhits=check_collision(best)
    result=json.loads(json.dumps(input_payload))
    result['shell']['vertices']=[list(p) for p in best]
    result.setdefault('scene',{}).setdefault('staging',{})['shoulderFold']=selected
    report={'algorithm':'shoulder-cylindrical-fold-and-lateral-relaxation-v1',
           'tested':tried,'safe':safe,'strainRejected':strain_rejected,
           'collisionRejected':contact_rejected,
           'beforeMeanCm':round(orig_gap[0]*100,3),
           'afterMeanCm':round(summary[0]*100,3),
           'afterMaxCm':round(summary[1]*100,3),
           'shoulderMeanCm':round(gap(best,upper_pairs)[0]*100,3),
           'sideMeanCm':round(gap(best,sided_pairs)[0]*100,3),
           'maximumEdgeChange':round(strain(best),7),
           'bodyHits':body,'selfHits':selfhits,
           'minimumCandidateStrain':round(minimum_strain,6),
           'minimumStrainArgs':minimum_strain_args,
           'selected':selected,'topSafe':sorted(accepted,key=lambda x:x['meanGapCm']+.14*x['maximumGapCm'])[:15],
           'collisionSamples':diagnostics,
           'nearAssembled':summary[1]<=.03,'fullTrajectoryCertified':False}
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
    print('SHOULDER_FOLD',json.dumps({k:v for k,v in report.items() if k not in ('topSafe','collisionSamples')}),flush=True)

if __name__=='__main__':main()
