"""Search piece-preserving near-body transforms with real Thomas BVH guards.

Experimental: moves whole triangulated pattern pieces rigidly; it NEVER warps
fabric just to reduce a stitch gap. Reject any body/cloth triangle overlap or
cloth self intersection. A low-gap result still requires PPF+IPC trajectory QA.
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
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--iterations', type=int, default=3)
    parser.add_argument('--max-shift-cm', type=float, default=12.0)
    return parser.parse_args(argv)


def main():
    args = arguments()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    source = json.loads(Path(args.input).read_text())
    positions = [Vector(v) for v in source['shell']['vertices']]
    faces = [tuple(face) for face in source['shell']['faces']]
    face_pieces = source['shell'].get('facePieceIds')
    if len(face_pieces or []) != len(faces):
        raise ValueError('Missing per-face pattern ownership mapping')
    pieces = {p['id']:list(p['particleIndices']) for p in source['shell']['pieces']}
    stitches = source['shell']['stitchEdges']
    if not stitches:
        raise ValueError('Missing physical seam matches')

    from ppf_prepare_scene import build_avatar, collection
    body_objects = build_avatar(source, collection('PPF_Assembly_Body'))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    body_trees = [BVHTree.FromObject(obj, depsgraph) for obj in body_objects]

    def stats(vertices):
        gaps = [(vertices[s['a']]-vertices[s['b']]).length for s in stitches]
        return (sum(gaps)/len(gaps),max(gaps))

    def score_function(vertices):
        gaps = sorted(((vertices[s['a']]-vertices[s['b']]).length for s in stitches), reverse=True)
        if not gaps:
            return 0.0
        # Prioritise the large armhole/underarm gaps rather than letting
        # dozens of already-close edges drown out a 38 cm sewing defect.
        largest = gaps[:max(1, len(gaps)//5)]
        return sum(gaps)/len(gaps) + .8 * sum(largest)/len(largest) + .1*gaps[0]

    def valid(vertices):
        blender_vertices = [Vector((v.x,-v.z,v.y)) for v in vertices]
        tree = BVHTree.FromPolygons(blender_vertices,faces,all_triangles=True)
        if any(tree.overlap(body) for body in body_trees):
            return False
        seen = set()
        for a,b in tree.overlap(tree):
            if a == b or set(faces[a]) & set(faces[b]):
                continue
            key = tuple(sorted((a,b)))
            if key not in seen:
                seen.add(key)
                return False
        return True

    if not valid(positions):
        raise RuntimeError('Initial pose is intersecting Thomas or itself; refusing to optimize unsafe input')

    initial = stats(positions)
    history = []
    max_shift = min(.25,max(0,args.max_shift_cm/100))
    # Each candidate translates a complete piece, preserving all intrinsic
    # edge lengths and rest strain. A bounded discrete coordinate search is
    # safer than seam-wise vertex snapping (which changes pattern geometry).
    for iteration in range(max(0,args.iterations)):
        accepted = 0
        for piece_id in ('front','back','sleeve-left','sleeve-right'):
            if piece_id not in pieces:
                continue
            current = stats(positions)
            best = positions
            best_score = score_function(positions)
            ids = pieces[piece_id]
            for direction in (Vector((1,0,0)),Vector((-1,0,0)),Vector((0,1,0)),Vector((0,-1,0)),Vector((0,0,1)),Vector((0,0,-1))):
                for distance in (.005,.015,.03,.06,max_shift):
                    if distance > max_shift + 1e-9:
                        continue
                    offset = direction * distance
                    candidate = [v.copy() for v in positions]
                    for index in ids:
                        candidate[index] += offset
                    score = stats(candidate)
                    target = score_function(candidate)
                    if target + 1e-7 >= best_score or not valid(candidate):
                        continue
                    best,best_score = candidate,target
            if best is not positions:
                positions = best
                accepted += 1
        history.append({'iteration':iteration+1,'movesAccepted':accepted,
                        'meanGapCm':round(stats(positions)[0]*100,3),
                        'maximumGapCm':round(stats(positions)[1]*100,3)})
        if accepted == 0:
            break

    final = stats(positions)
    assert valid(positions), 'Final body intersection detected'
    result = json.loads(json.dumps(source))
    result['shell']['vertices'] = [list(v) for v in positions]
    result.setdefault('scene',{}).setdefault('staging',{})['assemblyPass'] = 'rigid-piece-body-BVH-v1'
    report = {'algorithm':'rigid-piece-translation-search-v1',
              'fabricRestGeometryPreserved':True,'bodyAndSelfIntersectionFreeAtInitialPose':True,
              'beforeMeanGapCm':round(initial[0]*100,3),'afterMeanGapCm':round(final[0]*100,3),
              'beforeMaximumGapCm':round(initial[1]*100,3),'afterMaximumGapCm':round(final[1]*100,3),
              'history':history,'nearAssembled':final[1] <= .03,
              'fullTrajectoryCertified':False}
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
    print('PPF_NEAR_BODY_ASSEMBLY='+json.dumps(report))


if __name__ == '__main__':
    main()
