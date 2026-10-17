"""Experimental contact-aware harmonic seam placement for CLO-referenced PPF tee.

This is an *initial pose* optimizer, not the ZOZO dynamics solver. It diffuses
sewing-edge motions over whole panels to avoid locally stretching triangles;
every stored iterate must pass intrinsic edge strain and actual Thomas/cloth
BVH overlap tests. Never modifies/restitches the original pattern topology.
"""

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def args():
    p = argparse.ArgumentParser()
    for name in ('input', 'flat-reference', 'output', 'report'):
        p.add_argument('--' + name, required=True)
    p.add_argument('--steps', type=int, default=180)
    p.add_argument('--step-mm', type=float, default=2.0)
    p.add_argument('--smooth-iterations', type=int, default=24)
    p.add_argument('--max-strain', type=float, default=.05)
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def main():
    config = args()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from ppf_prepare_scene import build_avatar, collection

    original = json.loads(Path(config.input).read_text())
    rest_document = json.loads(Path(config.flat_reference).read_text())
    source = np.asarray(rest_document['shell']['vertices'], dtype=np.float64)
    current = np.asarray(original['shell']['vertices'], dtype=np.float64)
    if source.shape != current.shape or original['shell']['faces'] != rest_document['shell']['faces']:
        raise ValueError('Rest garment and posed input must have identical triangle topology')
    faces = np.asarray(original['shell']['faces'], dtype=np.int64)
    seams = original['shell']['stitchEdges']
    seam_pairs = np.asarray([(e['a'], e['b']) for e in seams], dtype=np.int64)
    edges = np.unique(np.sort(np.concatenate([faces[:, (0, 1)], faces[:, (1, 2)], faces[:, (2, 0)]]), axis=1), axis=0)
    rest_lengths = np.linalg.norm(source[edges[:, 0]] - source[edges[:, 1]], axis=1)
    if np.any(rest_lengths <= 1e-9):
        raise ValueError('Invalid zero-length rest triangle edge')
    pieces = {piece['id']:list(piece['particleIndices']) for piece in original['shell']['pieces']}
    vertex_piece = {}
    for name, indices in pieces.items():
        for i in indices:
            if i in vertex_piece: raise ValueError('Overlapping piece vertex ownership')
            vertex_piece[i] = name
    if len(vertex_piece) != len(source): raise ValueError('Orphaned pattern vertices')
    neighbors = [[] for _ in source]
    for a, b in edges:
        a, b = int(a), int(b)
        neighbors[a].append(b)
        neighbors[b].append(a)
    neighbor_max = max(len(n) for n in neighbors)
    adjacency = np.zeros((len(source), neighbor_max), dtype=np.int64)
    degree = np.array([len(n) for n in neighbors], dtype=np.float64)
    for i, items in enumerate(neighbors):
        adjacency[i, :len(items)] = items
        adjacency[i, len(items):] = i
    degree[degree == 0] = 1
    skin_objects = build_avatar(original, collection('GS_CLO_Harmonic_Assembly'))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    body_trees = [BVHTree.FromObject(obj, depsgraph) for obj in skin_objects]
    triangle_set = [set(f.tolist()) for f in faces]
    triangle_list = [tuple(f.tolist()) for f in faces]

    def edge_strain(v):
        return float(np.max(np.abs(np.linalg.norm(v[edges[:, 0]] - v[edges[:, 1]], axis=1) / rest_lengths - 1)))

    def seam_errors(v):
        delta = v[seam_pairs[:, 0]] - v[seam_pairs[:, 1]]
        distances = np.linalg.norm(delta, axis=1)
        return float(np.mean(distances)), float(np.max(distances))

    def collisions(v):
        cloth = BVHTree.FromPolygons([Vector((float(p[0]), -float(p[2]), float(p[1]))) for p in v], triangle_list, all_triangles=True)
        body = sum(len(cloth.overlap(t)) for t in body_trees)
        intersections = set()
        for a, b in cloth.overlap(cloth):
            if a == b or triangle_set[a] & triangle_set[b]: continue
            intersections.add(tuple(sorted((a, b))))
        return body, len(intersections)

    def skin_normal(p):
        world = Vector((float(p[0]), -float(p[2]), float(p[1])))
        nearest = [tree.find_nearest(world) for tree in body_trees]
        nearest = [entry for entry in nearest if entry[0] is not None]
        if not nearest: return None, 1.0
        spot, normal, _, dist = min(nearest, key=lambda entry: entry[3])
        return np.array([normal.x, normal.z, -normal.y], dtype=np.float64), float((world - spot).dot(normal))

    before = seam_errors(current)
    before_strain = edge_strain(current)
    before_body, before_self = collisions(current)
    if before_body or before_self or before_strain > config.max_strain:
        raise ValueError('Input pose must be collision-free and satisfy rest-length strain limit')
    best = current.copy()
    best_score = before[0] + .6 * before[1]
    attempts = accepted = rejected_strain = rejected_contacts = 0
    current_step = config.step_mm / 1000
    progress = []
    for step in range(config.steps):
        # Move paired garment edges toward each other, distributing the same
        # motion across each independent panel with a harmonic field. No
        # source mesh positions or rest lengths are altered.
        delta = current[seam_pairs[:, 1]] - current[seam_pairs[:, 0]]
        distance = np.maximum(np.linalg.norm(delta, axis=1), 1e-9)
        command = delta * np.minimum(.5 * current_step / distance, .18)[:, None]
        controls = np.zeros_like(current)
        counts = np.zeros(len(current))
        np.add.at(controls, seam_pairs[:, 0], command)
        np.add.at(controls, seam_pairs[:, 1], -command)
        np.add.at(counts, seam_pairs[:, 0], 1)
        np.add.at(counts, seam_pairs[:, 1], 1)
        used = counts > 0
        controls[used] /= counts[used, None]
        # Tangential motion around skin is preferable to sewing through skin.
        # Keep the normal component only when moving outwards or farther than
        # 4 cm from skin, so exterior slit closure needn't be blocked.
        for idx in np.flatnonzero(used):
            normal, signed = skin_normal(current[idx])
            if normal is None or signed > .04: continue
            dot = np.dot(controls[idx], normal)
            if dot < 0:
                controls[idx] -= .9 * dot * normal
        # Jacobi harmonic extension: the seam vertices remain controls while
        # the rest of a panel follows smoothly (unlike moving only border
        # points, which can violate 5% manufacturing strain immediately).
        field = controls.copy()
        anchors = used.copy()
        for _ in range(config.smooth_iterations):
            neighborhood = field[adjacency].sum(axis=1) - (neighbor_max - degree)[:, None] * field
            updated = neighborhood / degree[:, None]
            field[~anchors] = .28 * field[~anchors] + .72 * updated[~anchors]
            field[anchors] = controls[anchors]
        # Screen the actual moved mesh, not merely a spring-energy surrogate.
        # A rejected candidate has no side effects and never becomes output.
        proposed = False
        for ratio in (1, .5, .25, .125, .0625, .03125, .015625, .0078125):
            attempts += 1
            candidate = current + ratio * field
            distortion = edge_strain(candidate)
            if distortion > config.max_strain:
                rejected_strain += 1
                continue
            body, own = collisions(candidate)
            if body or own:
                rejected_contacts += 1
                continue
            next_mean, next_max = seam_errors(candidate)
            previous_mean, previous_max = seam_errors(current)
            if next_mean + .6 * next_max >= previous_mean + .6 * previous_max - 1e-9:
                continue
            current = candidate
            proposed = True
            if next_mean + .6 * next_max < best_score:
                best = current.copy()
                best_score = next_mean + .6 * next_max
            break
        if not proposed:
            current_step *= .77
            if current_step < .000025: break
        elif step % 20 == 0:
            mean, maximum = seam_errors(current)
            progress.append({'step':step,'meanGapCm':round(100*mean,3),'maximumGapCm':round(100*maximum,3),'maxEdgeStrain':round(edge_strain(current),6)})
    after = seam_errors(best)
    body, own = collisions(best)
    last_strain = edge_strain(best)
    result = json.loads(json.dumps(original))
    result['shell']['vertices'] = best.tolist()
    report = {
        'algorithm':'harmonic-contact-safe-seam-diffusion-v1',
        'sourcePose':config.input,
        'stepsAttempted':step+1, 'candidateAttempts':attempts,
        'beforeMeanGapCm':round(100*before[0],3),
        'beforeMaxGapCm':round(100*before[1],3),
        'afterMeanGapCm':round(100*after[0],3),
        'afterMaxGapCm':round(100*after[1],3),
        'maxEdgeStrain':round(last_strain,7),
        'bodyIntersectionPairs':body,'selfIntersectionPairs':own,
        'rejectedStrain':rejected_strain,'rejectedContact':rejected_contacts,
        'sewPairs':len(seams),'progress':progress,
        'nearAssembled':after[1] <= .03,'fullTrajectoryCertified':False,
    }
    result.setdefault('scene',{}).setdefault('staging',{})['harmonicCloContactPlacement'] = {
        k:v for k,v in report.items() if k != 'progress'
    }
    Path(config.output).parent.mkdir(parents=True, exist_ok=True)
    Path(config.output).write_text(json.dumps(result, indent=2)+'\n')
    Path(config.report).write_text(json.dumps(report, indent=2)+'\n')
    print('CLO_HARMONIC_SEAM_PLACEMENT', json.dumps({k:v for k,v in report.items() if k != 'progress'}), flush=True)


if __name__ == '__main__':
    main()
