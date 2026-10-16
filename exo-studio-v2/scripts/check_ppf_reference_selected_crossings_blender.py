"""Independent precise Blender BVH + strict float64 triangle crossing QA.

Unlike the earlier first/worst-only reference checker, this explicitly tests
all requested frames, including ones whose upstream Rust scan said zero.
Run under Blender with `-- --run-report ... --audit ... --frames ... --out ...`.
This is a geometric discrete-frame check, not swept CCD.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
from mathutils.bvhtree import BVHTree


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--run-report',type=Path,required=True)
    p.add_argument('--audit',type=Path,required=True)
    p.add_argument('--frames',required=True,help='Comma-separated exact frame indices')
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'blender_bridge'))
    from audit_ppf_native_geometry import strict_crossing
    run=json.loads(args.run_report.read_text())
    evidence=json.loads(args.audit.read_text())
    session=Path(run['sessionPath'])
    faces=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
    verts=np.fromfile(session/'bin/vert.bin',dtype='<f8').reshape(-1,3)
    pinned=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
    fixed=np.zeros(len(verts),dtype=bool)
    fixed[pinned]=True
    body=np.all(fixed[faces],axis=1)
    if np.any(np.any(fixed[faces],axis=1)&~body):
        raise ValueError('mixed-pinned cloth/body triangle found')
    clothfaces=faces[~body]
    bodyfaces=faces[body]
    rows=[]
    for frame in sorted(set(int(x) for x in args.frames.split(','))):
        path=session/'output'/f'vert_{frame}.bin'
        if not path.is_file():
            raise FileNotFoundError(path)
        data=np.fromfile(path,dtype='<f4').reshape(-1,3).astype(np.float64)
        if data.shape!=verts.shape or not np.isfinite(data).all():
            raise ValueError(f'Bad mesh sample {frame}')
        bvhBody=BVHTree.FromPolygons(data.tolist(),bodyfaces.tolist(),all_triangles=True)
        bvhCloth=BVHTree.FromPolygons(data.tolist(),clothfaces.tolist(),all_triangles=True)
        overlaps=bvhCloth.overlap(bvhBody)
        strict_pairs=[(int(i),int(j)) for i,j in overlaps if strict_crossing(data[clothfaces[i]],data[bodyfaces[j]])]
        rust_value=evidence['perFrame'][frame]['bodyCrossings']
        row={'frame':frame,'bvhCandidatePairs':len(overlaps),
             'independentStrictCrossings':len(strict_pairs),
             'rustCheckerCrossings':rust_value,
             'matchesRustChecker':len(strict_pairs)==rust_value,
             'sampleTrianglePairs':strict_pairs[:8]}
        rows.append(row)
        print(f'FRAME {frame}: strict Blender={len(strict_pairs)}, Rust={rust_value}',flush=True)
    report={'schema':'garment-studio.ppf-blender-independent-selected-frames.v1',
            'scope':'Discrete-frame independent Blender BVH + strict crossing; not swept CCD',
            'sourceSession':run['sessionName'],
            'allMatched':all(row['matchesRustChecker'] for row in rows),
            'physicalFitVerified':False,
            'frames':rows}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='frames'}))
    if not report['allMatched']:
        raise RuntimeError('Blender strict and Rust mesh-crossing counts disagree')


if __name__=='__main__':main()
