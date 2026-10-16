"""Forensic analysis of Jarvis's saved upstream Rust PPF fitting run.

Read-only. Reuses the installed Rust intersection kernel for exact contact pair
indices; reports time-aligned pinned-animation keyframes, body/cloth movement,
and local collision geometry. Does not run the solver or claim swept CCD.

Run with the installed PPF Python 3.12 environment (its frontend imports
pythreejs). Requires only the already-saved session output and metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import cbor2
import numpy as np


def cli():
    parser = argparse.ArgumentParser()
    parser.add_argument('--run-report', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--windows', default='80:95,169:179',
                        help='Inclusive frame intervals, comma-separated, e.g. 80:95,169:179')
    parser.add_argument('--max-sample-pairs', type=int, default=8)
    return parser.parse_args()


def digest(path):
    hashed = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            hashed.update(chunk)
    return hashed.hexdigest()


def distribution(values, scale=1):
    values = np.asarray(values, dtype=np.float64).ravel()
    if not values.size:
        return None
    if not np.isfinite(values).all():
        raise ValueError('nonfinite measured displacement')
    return {'min': round(float(values.min()) * scale, 6),
            'median': round(float(np.median(values)) * scale, 6),
            'p95': round(float(np.percentile(values, 95)) * scale, 6),
            'p99': round(float(np.percentile(values, 99)) * scale, 6),
            'max': round(float(values.max()) * scale, 6)}


def points_summary(points):
    p = np.asarray(points, dtype=np.float64)
    if not len(p):
        return None
    return {'centerM': [round(float(x), 5) for x in p.mean(axis=0)],
            'minM': [round(float(x), 5) for x in p.min(axis=0)],
            'maxM': [round(float(x), 5) for x in p.max(axis=0)]}


def component_sizes(hits, faces):
    """Group colliding cloth faces by shared *cloth* vertex, not screen pixels."""
    parent = {}

    def root(index):
        parent.setdefault(index, index)
        while index != parent[index]:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(a, b):
        a, b = root(a), root(b)
        if a != b:
            parent[b] = a

    cloth_faces = sorted(set(a for a, _ in hits))
    vertex_owner = {}
    for face_index in cloth_faces:
        for vertex in faces[face_index]:
            vertex = int(vertex)
            if vertex in vertex_owner:
                union(face_index, vertex_owner[vertex])
            else:
                vertex_owner[vertex] = face_index
    groups = defaultdict(list)
    for i in cloth_faces:
        groups[root(i)].append(i)
    count_by_face = Counter(int(a) for a, _ in hits)
    return [{'clothTriangleCount': len(group),
             'intersectionPairCount': sum(count_by_face[i] for i in group),
             'sampleClothTriangleIds': group[:10]}
            for group in sorted(groups.values(), key=lambda g: -sum(count_by_face[i] for i in g))]


def main():
    args = cli()
    run = json.loads(args.run_report.read_text())
    if not run.get('ok') or not run.get('sessionPath'):
        raise ValueError('this analyzer needs a finished, saved upstream fitting session')
    session = Path(run['sessionPath']).resolve()
    runtime = Path(run['runtime']).resolve()
    sys.path.insert(0, str(runtime))
    from frontend._intersection_ import check_self_intersection  # original Rust wrapper

    faces = np.fromfile(session / 'bin/tri.bin', dtype='<u8').reshape(-1, 3)
    rest = np.fromfile(session / 'bin/vert.bin', dtype='<f8').reshape(-1, 3)
    pin_indices = np.fromfile(session / 'bin/pin-ind-0.bin', dtype='<u8')
    pinned = np.zeros(len(rest), dtype=bool)
    pinned[pin_indices] = True
    body_face = np.all(pinned[faces], axis=1)
    mixed = np.any(pinned[faces], axis=1) & ~body_face
    if np.any(mixed):
        raise ValueError('contact classification ambiguous: cloth/body mesh shares faces')
    if len(pin_indices) != int(np.count_nonzero(pinned)):
        raise ValueError('duplicate pinned vertex indices')

    op_files = sorted((session / 'bin').glob('pin-0-op-*.bin'),
                      key=lambda f: int(f.stem.split('-')[-1]))
    targets = [np.fromfile(f, dtype='<f8').reshape(-1, 3) for f in op_files]
    if len(targets) < 4 or any(v.shape != (len(pin_indices), 3) for v in targets):
        raise ValueError('invalid pin animation keyframe target shapes')
    keyframes = []
    for k in range(2, len(targets)):
        # For op i, motion is t=.5+i*.025 to .5+(i+1)*.025. At
        # boundary k the incoming target is op k-1 and outgoing is op k.
        velocity_jump = np.linalg.norm((targets[k] - 2 * targets[k - 1] + targets[k - 2]) / .025, axis=1)
        keyframes.append({'operationBoundary': k,
                          'timeSeconds': round(.5 + .025 * k, 6),
                          'velocityDiscontinuityMps': distribution(velocity_jump)})
    rank_values = [v['velocityDiscontinuityMps']['p95'] for v in keyframes]
    for item in keyframes:
        item['p95PercentileAmongBoundaries'] = round(
            100 * sum(x <= item['velocityDiscontinuityMps']['p95'] for x in rank_values) / len(rank_values), 2)

    window = set()
    for span in args.windows.split(','):
        first, last = map(int, span.split(':'))
        if first < 0 or last < first or last > run['requestedFrames']:
            raise ValueError('requested window must be inside the original output frames')
        window.update(range(first, last + 1))
    frame_indices = sorted(window)
    source = session / 'output'
    frames = {}

    def frame(index):
        if index not in frames:
            raw = np.fromfile(source / f'vert_{index}.bin', dtype='<f4').reshape(-1, 3).astype(np.float64)
            if raw.shape != rest.shape or not np.isfinite(raw).all():
                raise ValueError(f'frame {index} is malformed')
            frames[index] = raw
        return frames[index]

    rows = []
    for index in frame_indices:
        v = frame(index)
        previous = frame(index - 1) if index else None
        stats = cbor2.loads((source / f'statistics_{index}.cbor').read_bytes())
        if stats['payload']['solver_frame'] != index:
            raise ValueError('native statistics frame mismatch')
        timestamp = float(stats['payload']['time_seconds'])
        hits = check_self_intersection(v, faces, body_face)
        body_pairs = [(int(a), int(b)) if not body_face[a] else (int(b), int(a))
                      for a, b in hits if bool(body_face[a]) != bool(body_face[b])]
        own_pairs = [pair for pair in hits if bool(body_face[pair[0]]) == bool(body_face[pair[1]])]
        # Collision pair triangles are always cloth first, body second.
        involved_cloth = sorted(set(a for a, _ in body_pairs))
        involved_body = sorted(set(b for _, b in body_pairs))
        cloth_ids = np.unique(faces[involved_cloth].ravel()) if involved_cloth else np.array([], dtype=int)
        body_ids = np.unique(faces[involved_body].ravel()) if involved_body else np.array([], dtype=int)
        # The position of the first contact and 492-pair event is preserved in
        # cloth and skin local coordinate systems, not rendered pixel values.
        all_cloth = v[cloth_ids]
        all_body = v[body_ids]
        dt = timestamp - float(cbor2.loads((source / f'statistics_{index - 1}.cbor').read_bytes())
                                   ['payload']['time_seconds']) if previous is not None else None
        displacement = np.linalg.norm(v - previous, axis=1) if previous is not None else None
        on_key = next((k for k in keyframes if abs(k['timeSeconds'] - timestamp) < 1e-8), None)
        connected_components = component_sizes(body_pairs, faces)
        # The reference body is initially translated by -0.78 plus seeded
        # jitter in the Y direction. Every linear animation segment reaches
        # its PREVIOUS operation target at the exact boundary timestamp.
        # Residuals distinguish a body-target teleport/encoding error from
        # cloth contact failure at a *correctly positioned* prescribed body.
        body_target_error = None
        if on_key is not None:
            k = on_key['operationBoundary']
            expected = targets[k - 1] + np.array([0.0, -.78 + float(run['jitter']), 0.0])
            body_target_error = distribution(np.linalg.norm(v[pin_indices] - expected, axis=1), 1000)
        row = {
            'frame': index, 'timeSeconds': round(timestamp, 8),
            'isPinKeyframeBoundary': on_key is not None,
            'pinnedBodyVelocityJump': on_key,
            'pinVertexTargetDeviationMm': body_target_error,
            'clothBodyIntersectionPairs': len(body_pairs),
            'otherSelfIntersections': len(own_pairs),
            'bodyObjectReportedContactCount': stats['payload']['objects'][1]['contact_count'],
            'clothObjectReportedContactCount': stats['payload']['objects'][0]['contact_count'],
            'bodyObjectSpeedMps': round(float(stats['payload']['objects'][1]['speed']), 6),
            'clothObjectSpeedMps': round(float(stats['payload']['objects'][0]['speed']), 6),
            'uniqueClothTriangles': len(involved_cloth),
            'uniqueBodyTriangles': len(involved_body),
            'clothHitArea': points_summary(all_cloth),
            'bodyHitArea': points_summary(all_body),
            'faceConnectedHotspots': connected_components[:12],
            'faceConnectedComponentCount': len(connected_components),
            'allConnectedComponentPairCount': sum(c['intersectionPairCount'] for c in connected_components),
            'sampleIntersectingTrianglePairs': body_pairs[:args.max_sample_pairs],
            'elapsedSecondsSincePreviousFrame': round(dt, 8) if dt else None,
            'bodyVertexDisplacementMm': distribution(displacement[pinned], 1000) if displacement is not None else None,
            'clothVertexDisplacementMm': distribution(displacement[~pinned], 1000) if displacement is not None else None,
            'affectedBodyVertexDisplacementMm': distribution(displacement[body_ids], 1000) if len(body_ids) and displacement is not None else None,
            'affectedClothVertexDisplacementMm': distribution(displacement[cloth_ids], 1000) if len(cloth_ids) and displacement is not None else None,
        }
        rows.append(row)
        if index % 5 == 0 or body_pairs:
            print(f'frame={index} t={timestamp:.4f}s crossings={len(body_pairs)} '
                  f'keyBoundary={on_key is not None}', flush=True)

    collisions = [r for r in rows if r['clothBodyIntersectionPairs']]
    artifact = {
        'schema': 'garment-studio.ppf-upstream-motion-contact-audit.v1',
        'scope': 'raw-native discrete triangle intersection, pin-animation targets and statistics; not swept CCD',
        'fullPhysicalFitVerified': False,
        'run': {'sessionName': run['sessionName'], 'runCompleted': run['ok'],
                'sessionPath': str(session), 'runtime': str(runtime),
                'pinOperationCount': len(targets),
                'pinVertices': len(pin_indices), 'clothTriangles': int(np.sum(~body_face)),
                'bodyTriangles': int(np.sum(body_face)),
                'meshSha256': {name: digest(session / 'bin' / name)
                               for name in ('tri.bin', 'vert.bin', 'pin-ind-0.bin')},
                'runtimeSolverSha256': digest(runtime / 'target/release/ppf-contact-solver'),
                'originalNotebookSha256': run.get('notebookSha256'),
                'assetSha256': run.get('assetSha256'),
                'solverCommitInNativeLog': '8b965aee02aa161b9c3d6e8f010311071d735710',
                'vertexOrder': 'native solver XYZ, all coordinates metres'},
        'collisionFramesInAnalyzedWindows': [
            {'frame': row['frame'], 'timeSeconds': row['timeSeconds'],
             'pairCount': row['clothBodyIntersectionPairs'],
             'onPinBoundary': row['isPinKeyframeBoundary'],
             'pinVelocityJumpP95Percentile': row['pinnedBodyVelocityJump']['p95PercentileAmongBoundaries']
                 if row['pinnedBodyVelocityJump'] else None}
            for row in collisions],
        'allCollisionsInRequestedWindowsOnPinKeyframes': all(x['isPinKeyframeBoundary'] for x in collisions),
        'keyframeVelocityJumpStats': keyframes,
        'frameRows': rows,
        'interpretation': 'Temporal alignment and velocity discontinuity are diagnostic, not proof of causality; '
                          'a solver or geometry issue may also cause collisions. No full continuous-time CCD was performed.'
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artifact, indent=2) + '\n')
    print('AUDIT_SUMMARY', json.dumps({k: artifact[k] for k in ('collisionFramesInAnalyzedWindows',
                                                                'allCollisionsInRequestedWindowsOnPinKeyframes')}), flush=True)


if __name__ == '__main__':
    main()
