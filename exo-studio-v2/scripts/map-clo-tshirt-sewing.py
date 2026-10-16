#!/usr/bin/env python3
"""Map actual CLO OBJ/XML stitch vertices onto the imported 2D DXF polygons.

Read-only with respect to CLO and the active app. Saves an independent report;
does NOT claim those seams have been activated in the Garment Studio solver.
This is geometric correspondence extraction, not fitting or fabrication.
"""
import bisect
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

FOLDER = Path(__file__).resolve().parents[1] / 'research/clo-reference/live-audit-20261014/exports'
PROJECT = FOLDER / 'clo-male-tshirt-7piece.garment.json'
OBJ = FOLDER / 'clo-reference-tee-20261014.obj'
XML = FOLDER / 'clo-reference-tee-20261014_meta_data.xml'
OUTPUT = FOLDER / 'clo-male-tshirt-clo-sewing-to-2d-mapping.json'

# In CLO's OBJ, the mesh groups (and the XML's corresponding mesh ranges) are
# emitted in a different order than the ASTM block entities. Their shared UV
# and flat-pattern XY bounds establish the actual registration independently.
MESH_TO_PIECE = [
    'clo-neck-a', 'clo-neck-b', 'clo-right-sleeve', 'clo-front',
    'clo-back', 'clo-neck-c', 'clo-left-sleeve',
]


def closest_polygon_edge(p, points):
    px, py = p
    best = None
    for i, (x, y) in enumerate(points):
        ex, ey = points[(i + 1) % len(points)]
        dx, dy = ex - x, ey - y
        length2 = dx * dx + dy * dy
        t = min(1.0, max(0.0, ((px - x) * dx + (py - y) * dy) / length2)) if length2 else 0
        dist2 = (px - x - t * dx) ** 2 + (py - y - t * dy) ** 2
        if best is None or dist2 < best['distanceMm'] ** 2:
            best = {'edgeIndex': i, 'edgeFraction': t, 'distanceMm': math.sqrt(dist2)}
    return best


def main():
    project = json.loads(PROJECT.read_text())
    assert project['seams'] == [], 'Do not overwrite an assembled/sewn project'
    pieces = {p['id']: p for p in project['pieces']}
    assert len(pieces) == 7

    obj_uv = [tuple(map(float, line.split()[1:3])) for line in OBJ.read_text().splitlines() if line.startswith('vt ')]
    xml = ET.parse(XML).getroot()
    mesh_entries = xml.findall('./MeshList/Mesh')
    seam_entries = xml.findall('./SeamLinePairList/SeamLinePair')
    assert len(obj_uv) == 3661 and len(mesh_entries) == 7 and len(seam_entries) == 23

    mesh_ranges = {}
    referenced_vertices = {p: set() for p in pieces}
    for piece_id, entry in zip(MESH_TO_PIECE, mesh_entries):
        first = int(entry.attrib['MeshStartIndex'])
        last = int(entry.attrib['MeshEndIndex'])
        assert 1 <= first <= last <= len(obj_uv)
        mesh_ranges[piece_id] = (first, last)

    raw_seams = []
    for pair in seam_entries:
        lines = []
        for line in pair.findall('SeamLine'):
            ids = [int(idx) for idx in line.attrib['MeshPointIndexes'].split('/')]
            assert len(ids) >= 2
            containing = [piece_id for piece_id, (first, last) in mesh_ranges.items()
                          if all(first <= i <= last for i in ids)]
            assert len(containing) == 1, f'Unexpected cross-piece seam line: {ids}'
            piece_id = containing[0]
            referenced_vertices[piece_id].update(ids)
            lines.append({'pieceId': piece_id, 'vertexIndexes': ids})
        assert len(lines) == 2 and len(lines[0]['vertexIndexes']) == len(lines[1]['vertexIndexes'])
        raw_seams.append(lines)

    registrations = {}
    for piece_id, (first, last) in mesh_ranges.items():
        uv = obj_uv[first-1:last]
        xx = [x for x, _ in uv]
        yy = [y for _, y in uv]
        flat = [(p['x'] * 10, p['y'] * 10) for p in pieces[piece_id]['points']]
        px = [x for x, _ in flat]
        py = [y for _, y in flat]
        candidates = []
        for sign_x in [-1, 1]:
            for sign_y in [-1, 1]:
                def convert(uv_point):
                    u, v = uv_point
                    return ((u - min(xx) if sign_x == 1 else max(xx) - u) + min(px),
                            (v - min(yy) if sign_y == 1 else max(yy) - v) + min(py))
                matched = [closest_polygon_edge(convert(obj_uv[i-1]), flat)
                           for i in sorted(referenced_vertices[piece_id])]
                errors = [p['distanceMm'] for p in matched]
                candidates.append((sum(errors) / len(errors), max(errors), sign_x, sign_y))
        mean_error, max_error, sx, sy = min(candidates)
        registrations[piece_id] = {
            'flipU': sx == -1, 'flipV': sy == -1,
            'objUmin': min(xx), 'objUmax': max(xx),
            'objVmin': min(yy), 'objVmax': max(yy),
            'patternXminMm': min(px), 'patternYminMm': min(py),
            'meanResidualMm': mean_error, 'maxResidualMm': max_error,
            'seamVertexCount': len(referenced_vertices[piece_id]),
        }
        assert max_error <= 2.1, f'{piece_id}: UV-to-cutline registration too poor: {max_error:.3f} mm'

    def stitch_point(vertex_index):
        piece_id = next(p for p, (lo, hi) in mesh_ranges.items() if lo <= vertex_index <= hi)
        reg = registrations[piece_id]
        u, v = obj_uv[vertex_index - 1]
        x = (reg['objUmax'] - u if reg['flipU'] else u - reg['objUmin']) + reg['patternXminMm']
        y = (reg['objVmax'] - v if reg['flipV'] else v - reg['objVmin']) + reg['patternYminMm']
        poly = [(p['x'] * 10, p['y'] * 10) for p in pieces[piece_id]['points']]
        mapped = closest_polygon_edge((x, y), poly)
        assert mapped['distanceMm'] <= 2.1
        return {
            'objVertexIndex': vertex_index, 'pieceId': piece_id,
            'patternXcm': x / 10, 'patternYcm': y / 10,
            'edgeIndex': mapped['edgeIndex'], 'edgeT': mapped['edgeFraction'],
            'distanceToCutlineMm': mapped['distanceMm'],
        }

    groups = []
    all_errors = []
    for number, pair in enumerate(raw_seams, start=1):
        a = [stitch_point(i) for i in pair[0]['vertexIndexes']]
        b = [stitch_point(i) for i in pair[1]['vertexIndexes']]
        all_errors += [p['distanceToCutlineMm'] for p in a + b]
        def sampled_length(points):
            return sum(math.hypot(q['patternXcm'] - p['patternXcm'],
                                  q['patternYcm'] - p['patternYcm'])
                       for p, q in zip(points, points[1:]))
        length_a, length_b = sampled_length(a), sampled_length(b)
        length_mismatch_percent = (200 * abs(length_a-length_b) / (length_a+length_b)
                                   if length_a+length_b else 0)
        groups.append({
            'sourceSeamIndex': number - 1,
            'id': f'clo-sew-{number:02d}',
            'pieceA': a[0]['pieceId'],
            'pieceB': b[0]['pieceId'],
            'stitchPointCorrespondences': len(a),
            'sampledLengthAcm': length_a,
            'sampledLengthBcm': length_b,
            'sampledLengthMismatchPercent': length_mismatch_percent,
            'neckEasingOrMismatchNeedsReview': length_mismatch_percent > 5.0,
            'pointsA': a, 'pointsB': b,
            'samePiece': a[0]['pieceId'] == b[0]['pieceId'],
        })

    assert sum(g['stitchPointCorrespondences'] for g in groups) == 182
    result = {
        'source': 'Official CLO OBJ mesh UV coordinates + exported OBJ seam metadata XML + original CLO ASTM DXF cut contours',
        'project': str(PROJECT.relative_to(PROJECT.parents[3])),
        'appendedToActiveDocument': False,
        'simulationAccepted': False,
        'format': 'sewing-correspondence-2d-v1',
        'units': 'centimeters for pattern XY; millimeters for registration error',
        'counts': {'patternPieces': len(pieces), 'sourceSeamGroups': len(groups),
                   'stitchedPointPairs': sum(g['stitchPointCorrespondences'] for g in groups),
                   'samePieceSeams': sum(g['samePiece'] for g in groups),
                   'groupsWithSampledLengthMismatchOver5Percent': sum(g['neckEasingOrMismatchNeedsReview'] for g in groups)},
        'registration': registrations,
        'maxSampleProjectionErrorMm': max(all_errors),
        'seams': groups,
        'notes': 'Real source correspondence coordinates only. Do not equate individual source stitch pairs to independent full-edge app seams. Some neckline reference pairs show significant 2D sampled-length differences (may be easing/geometry); investigate before physical sewing. Native editing/simulation needs safe segmentation, sewing orientation and mesh-density validation.',
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'output': str(OUTPUT), 'counts': result['counts'],
                      'maxSampleProjectionErrorMm': round(max(all_errors), 5),
                      'registrations': {k: {'flipU': v['flipU'], 'flipV': v['flipV'],
                                             'meanResidualMm': round(v['meanResidualMm'], 5),
                                             'maxResidualMm': round(v['maxResidualMm'], 5)}
                                        for k, v in registrations.items()}}, indent=2))


if __name__ == '__main__':
    main()
