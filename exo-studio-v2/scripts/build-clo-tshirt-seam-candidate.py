#!/usr/bin/env python3
"""Segment CLO's true 23 sewing polylines into Garment Studio partial-edge seams.

This is a staged, non-production *candidate*, not a proven simulated garment.
The source 7-piece imported project and the existing working app are untouched.
"""
import bisect
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'research/clo-reference/live-audit-20261014/exports'
PROJECT = SOURCES / 'clo-male-tshirt-7piece.garment.json'
MAPPING = SOURCES / 'clo-male-tshirt-clo-sewing-to-2d-mapping.json'
OUTPUT = SOURCES / 'clo-male-tshirt-sewn-EXPERIMENTAL.garment.json'
REPORT = SOURCES / 'clo-male-tshirt-sewn-EXPERIMENTAL.validation.json'


def setup_piece(piece):
    pts = piece['points']
    cumulative = [0.0]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        length = math.hypot(a['x'] - b['x'], a['y'] - b['y'])
        if length < 1e-6:
            raise ValueError(f'{piece["name"]} has degenerate edge after *candidate-only* cleanup')
        cumulative.append(cumulative[-1] + length)
    return {'prefix': cumulative, 'length': cumulative[-1], 'count': len(pts)}


def perimeter_position(point, model):
    i = point['edgeIndex']
    t = point['edgeT']
    if i >= model['count'] or i < 0 or not (0 <= t <= 1):
        raise ValueError('Bad seam sample edge index/fraction')
    prefix = model['prefix']
    return prefix[i] + t * (prefix[i+1] - prefix[i])


def traced_path(points, model):
    period = model['length']
    sampled = [perimeter_position(p, model) for p in points]
    steps = [(b - a + period * 0.5) % period - period * 0.5
             for a, b in zip(sampled, sampled[1:])]
    nonzero = [s for s in steps if abs(s) > 0.0001]
    if not nonzero:
        raise ValueError('No positive arc length on CLO seam source line')
    sign = 1 if nonzero[0] > 0 else -1
    if any(s * sign <= 0 for s in nonzero):
        raise ValueError('CLO seam trace reverses direction within one group')
    length = sum(abs(s) for s in steps)
    if length <= 0 or length >= period * 0.5:
        raise ValueError('Suspicious self-crossing/full-body seam trace')
    s0 = sampled[0]

    # All exact cutline corners traversed by this seam path are split knots.
    # That allows each generated pair to refer to a single 2D edge on each
    # side, preserving the meaning of startT/endT in the current app schema.
    knots = [0.0, 1.0]
    for v in model['prefix'][:-1]:
        distance = ((v - s0) * sign) % period
        if 1e-6 < distance < length - 1e-6:
            knots.append(distance / length)
    travelled = 0.0
    for step in steps[:-1]:
        travelled += abs(step)
        if 1e-6 < travelled < length - 1e-6:
            knots.append(travelled / length)
    return {'start': s0, 'sign': sign, 'length': length,
            'knots': knots, 'pieceId': points[0]['pieceId']}


def edge_range(path, model, lo, hi):
    period = model['length']
    prefix = model['prefix']
    mid = (path['start'] + path['sign'] * path['length'] * (lo+hi)*0.5) % period
    edge = min(model['count']-1, max(0, bisect.bisect_right(prefix, mid)-1))
    edge_len = prefix[edge+1] - prefix[edge]

    def fraction(u):
        s = (path['start'] + path['sign'] * path['length'] * u) % period
        # Exactly at the polygon's zero/perimeter wrap, an endpoint may be
        # represented as 0 even though the interval occupies the last edge.
        if s < prefix[edge]-period*0.5:
            s += period
        elif s > prefix[edge+1]+period*0.5:
            s -= period
        return max(0.0, min(1.0, (s-prefix[edge])/edge_len))

    t0, t1 = fraction(lo), fraction(hi)
    if abs(t1-t0) < 1e-8:
        raise ValueError(f'Zero-length sewing segment {path["pieceId"]} edge {edge}')
    return {'pieceId': path['pieceId'], 'edgeIndex': edge,
            'startT': min(t0, t1), 'endT': max(t0, t1)}


def main():
    project = json.loads(PROJECT.read_text())
    mapping = json.loads(MAPPING.read_text())
    assert len(project['pieces']) == 7 and not project['seams']
    assert mapping['counts']['sourceSeamGroups'] == 23

    # The real CLO ASTM outer-cutline exporter occasionally emits repeated
    # construction/segment-junction points. Keep the exact source unchanged,
    # but remove ONLY zero-length adjacent edges in this experimental copy.
    # Reproject every original source stitch point after that remapping.
    cleanup = {}
    for piece in project['pieces']:
        before = len(piece['points'])
        cleaned = []
        for point in piece['points']:
            if not cleaned or math.hypot(point['x']-cleaned[-1]['x'], point['y']-cleaned[-1]['y']) > 1e-6:
                cleaned.append(point)
        if math.hypot(cleaned[-1]['x']-cleaned[0]['x'], cleaned[-1]['y']-cleaned[0]['y']) <= 1e-6:
            cleaned.pop()
        cleanup[piece['id']] = before-len(cleaned)
        piece['points'] = cleaned

    models = {p['id']: setup_piece(p) for p in project['pieces']}
    pieces = {p['id']: p for p in project['pieces']}

    def reproject(points):
        result = []
        for original in points:
            p = pieces[original['pieceId']]
            x, y = original['patternXcm'], original['patternYcm']
            found = None
            for edge, a in enumerate(p['points']):
                b = p['points'][(edge+1) % len(p['points'])]
                dx, dy = b['x']-a['x'], b['y']-a['y']
                length2 = dx*dx+dy*dy
                t = max(0.0, min(1.0, ((x-a['x'])*dx+(y-a['y'])*dy)/length2))
                error = math.hypot(x-a['x']-dx*t, y-a['y']-dy*t)
                if found is None or error < found[0]:
                    found = (error, edge, t)
            assert found and found[0] <= 0.21, f'Reprojected stitch point too far from clean cutline: {found}'
            result.append({**original, 'edgeIndex': found[1], 'edgeT': found[2],
                           'distanceToCutlineMm': found[0]*10})
        return result
    generated = []
    report_groups = []

    for group in mapping['seams']:
        a = traced_path(reproject(group['pointsA']), models[group['pieceA']])
        b = traced_path(reproject(group['pointsB']), models[group['pieceB']])
        if group['neckEasingOrMismatchNeedsReview']:
            # Keep the original source graph and avoid silently presenting an
            # extreme collar easing as physically accepted sewing.
            pass
        knots = sorted(a['knots'] + b['knots'])
        unique = []
        for u in knots:
            if not unique or u-unique[-1] > 1e-6:
                unique.append(u)
        if unique[-1] != 1.0:
            unique.append(1.0)

        before = len(generated)
        for start, end in zip(unique, unique[1:]):
            # Microscale intervals are below the app's sample resolution.
            if min(a['length'], b['length']) * (end-start) < 0.0005:
                continue
            ea = edge_range(a, models[a['pieceId']], start, end)
            eb = edge_range(b, models[b['pieceId']], start, end)
            generated.append({
                'id': f'{group["id"]}-seg-{len(generated)-before+1:03d}',
                'name': f'CLO {group["id"]} (segment {len(generated)-before+1})',
                'sourceCloSeamGroup': group['sourceSeamIndex'],
                'sourceTraceU': [start, end],
                'reverseB': a['sign'] != b['sign'],
                'a': ea, 'b': eb,
            })

        count = len(generated)-before
        if not count:
            raise ValueError('No valid seam segments generated for ' + group['id'])
        report_groups.append({
            'sourceGroup': group['id'], 'pieceA': a['pieceId'], 'pieceB': b['pieceId'],
            'originalPointPairs': group['stitchPointCorrespondences'],
            'generatedPartialEdgePairs': count,
            'traceLengthAcm': a['length'], 'traceLengthBcm': b['length'],
            'traceReverseB': a['sign'] != b['sign'],
            'needsLengthMismatchReview': group['neckEasingOrMismatchNeedsReview'],
        })

    experimental = {
        **project,
        'id': 'clo-male-tshirt-sewn-EXPERIMENTAL-20261014',
        'name': 'CLO Male T-Shirt — EXPERIMENTAL 23-Group Sewing Transfer',
        'revision': 1,
        'seams': generated,
        'cloReference': {
            **project['cloReference'],
            'sourceStitchMap': MAPPING.name,
            'transferredSewingGroups': 23,
            'transferredPartialEdgeSeams': len(generated),
            'sourceDuplicateCutlineVerticesRemovedForExperiment': cleanup,
            'sewingTransferStatus': 'EXPERIMENTAL: generated partial-edge correspondence; no physical validation',
            'importedSewing': True,
            'sewnFitCertified': False,
            'DO_NOT_DEPLOY_SIMULATION': True,
        },
    }
    if OUTPUT.exists() or REPORT.exists():
        raise FileExistsError('Experiment already exists; refusing to replace another worker\'s output')
    OUTPUT.write_text(json.dumps(experimental, indent=2) + '\n')
    report = {
        'project': str(OUTPUT),
        'unsafeForProductionSimulation': True,
        'sourceGroups': 23,
        'sourceStitchPointPairs': 182,
        'generatedPartialEdgeSeams': len(generated),
        'duplicateCutlineVerticesRemovedForExperiment': cleanup,
        'groupReports': report_groups,
        'nextValidation': 'Native app import, overlapping seam check, sampled mesh consistency, avatar-body contact and cloth solver gates are NOT passed by this mapping',
    }
    REPORT.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'output': str(OUTPUT), 'groups': len(report_groups),
                      'generatedPartialEdgeSeams': len(generated),
                      'lengthMismatchReviewGroups': sum(g['needsLengthMismatchReview'] for g in report_groups)}, indent=2))


if __name__ == '__main__':
    main()
