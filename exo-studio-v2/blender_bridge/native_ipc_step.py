"""Offline native-XPBD + real Thomas swept CCD prototype.

This is an experimental *step acceptance and backtracking* adapter, not a
substitute for a coupled barrier-contact solver. It deliberately fails closed
when the source cloth pose is already intersecting the avatar. Body geometry
is never sent to a remote service or committed to the project repository.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / 'research' / 'oss-runtime' / 'ipctk-py313'))
import ipctk

from check_thomas_ipc_ccd import mesh_from_scene, build_collision_mesh


def cloth_state(payload):
    state = np.asarray([p['position'] for p in payload['particles']], dtype=np.float64)
    # Garment coordinates: X right, Y up, Z depth. Blender: X right, Y depth, Z up.
    return np.column_stack((state[:, 0], -state[:, 2], state[:, 1]))


def to_garment(coords):
    return np.column_stack((coords[:, 0], coords[:, 2], -coords[:, 1]))


def shell_faces(payload):
    result = []
    for piece in payload['pieces']:
        indices = piece['particleIndices']
        result.extend([indices[i] for i in face] for face in piece['faces'])
    return np.asarray(result, dtype=np.int32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--frames', type=int, default=4)
    parser.add_argument('--binary', default=str(ROOT / 'native_backend/bin/garment_xpbd_cli'))
    parser.add_argument('--report', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    payload = json.loads(Path(args.input).read_text())
    if payload['avatar'].get('model') != 'clo-thomas':
        raise ValueError('IPC Thomas mode requires an actual CLO Thomas avatar project')
    body, faces = mesh_from_scene()
    current = cloth_state(payload)
    mesh, start, offset = build_collision_mesh(body, faces, current, shell_faces(payload))
    # A real fit requires a verified nonintersecting initial arrangement. Do
    # not attempt to backtrack through a pre-existing buried mesh.
    body_tree = BVHTree.FromPolygons([Vector(v) for v in body], [tuple(f) for f in faces], all_triangles=True)
    cloth_tree = BVHTree.FromPolygons([Vector(v) for v in current], [tuple(f) for f in shell_faces(payload)], all_triangles=True)
    initial_intersections = bool(body_tree.overlap(cloth_tree))
    if initial_intersections:
        raise RuntimeError('Initial garment is intersecting Thomas; native IPC step cannot certify or recover this pose')
    reports = []
    for frame in range(args.frames):
        temp_input = Path(args.output).with_suffix('.input.json')
        temp_output = Path(args.output).with_suffix('.native.json')
        temp_input.write_text(json.dumps(payload))
        try:
            subprocess.run([args.binary, str(temp_input), str(temp_output), '1'],
                           check=True, capture_output=True, text=True, timeout=60)
            result = json.loads(temp_output.read_text())
        finally:
            temp_input.unlink(missing_ok=True)
            temp_output.unlink(missing_ok=True)
        incoming = np.asarray([p['position'] for p in result['state']['particles']], dtype=np.float64)
        if not np.isfinite(incoming).all():
            raise RuntimeError(f'Native non-finite prediction at frame {frame + 1}')
        proposed = np.column_stack((incoming[:, 0], -incoming[:, 2], incoming[:, 1]))
        target = start.copy()
        target[offset:] = proposed
        safe = bool(ipctk.is_step_collision_free(mesh, start, target))
        fraction = float(ipctk.compute_collision_free_stepsize(mesh, start, target))
        if not np.isfinite(fraction) or fraction < 0 or fraction > 1:
            raise RuntimeError('Invalid IPC safe movement fraction')
        # Backtrack to the last safe interpolated state and cancel the unsafe
        # velocity component. A production cloth solver must also recompute
        # cloth/seam constraints under contact for a physically correct fit.
        applied = max(0, min(1, fraction * 0.95)) if not safe else 1.0
        accepted = current + (proposed - current) * applied
        next_vertices = start.copy()
        next_vertices[offset:] = accepted
        if not ipctk.is_step_collision_free(mesh, start, next_vertices):
            raise RuntimeError(f'Collision remained after IPC backtracking at frame {frame + 1}')
        if ipctk.has_intersections(mesh, next_vertices):
            raise RuntimeError(f'IPC accepted an intersecting frame {frame + 1}')
        new_positions = to_garment(accepted)
        for i, particle in enumerate(payload['particles']):
            old_position = np.asarray(particle['position'], dtype=float)
            particle['position'] = new_positions[i].tolist()
            # Preserve native Verlet velocity only for a complete unblocked
            # step; partial movement sync prevents repeated penetration.
            particle['previous'] = result['state']['particles'][i]['previous'] if safe else particle['position']
        reports.append({'frame': frame + 1, 'predictedSafe': safe,
                        'maxSafeFraction': fraction, 'appliedFraction': applied,
                        'backtracked': not safe})
        current = accepted
        start = next_vertices
    Path(args.output).write_text(json.dumps(payload, indent=2) + '\n')
    seam_pairs = [c for c in payload['constraints'] if c.get('type') == 'seam']
    seams = [float(np.linalg.norm(current[c['a']] - current[c['b']])) for c in seam_pairs]
    report = {'tool': 'IPC Toolkit Python 1.6.0', 'experimental': True,
              'integratedIntoLiveNativeXpbd': False, 'frames': args.frames,
              'bodyTriangles': len(faces), 'clothTriangles': len(shell_faces(payload)),
              'initialIntersections': initial_intersections,
              'meanSeamGapCm': (100 * float(np.mean(seams))) if seams else 0,
              'maxSeamGapCm': (100 * float(np.max(seams))) if seams else 0,
              'allAcceptedStepsCollisionFree': True, 'steps': reports}
    Path(args.report).write_text(json.dumps(report, indent=2) + '\n')
    print('THOMAS_NATIVE_IPC_PROTOTYPE='+json.dumps(report))


if __name__ == '__main__':
    main()
