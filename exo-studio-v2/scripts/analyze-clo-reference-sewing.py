#!/usr/bin/env python3
"""Read-only CLO OBJ + sewing metadata analysis. No proprietary PAC parsing.

Usage: python3 scripts/analyze-clo-reference-sewing.py [export-directory]
The OBJ coordinates are CLO millimetres; this script does not assume that
pre-simulation seam gaps are small or that a CLO reference is a fitted result.
"""
from collections import Counter
from pathlib import Path
import json
import math
import sys
import xml.etree.ElementTree as ET

directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('research/clo-reference/live-audit-20261014/exports')
obj = directory / 'clo-reference-tee-20261014.obj'
xml = directory / 'clo-reference-tee-20261014_meta_data.xml'
vertices = [None]
groups = []
faces = 0
with obj.open() as stream:
    for line in stream:
        if line.startswith('v '):
            vertices.append(tuple(map(float, line.split()[1:4])))
        elif line.startswith('g '):
            groups.append(line.split(maxsplit=1)[1].strip())
        elif line.startswith('f '):
            faces += 1

root = ET.parse(xml).getroot()
meshes = root.findall('.//Mesh')
mesh_ranges = [(int(m.get('MeshStartIndex')), int(m.get('MeshEndIndex'))) for m in meshes]
assert len(mesh_ranges) == len(groups), 'CLO OBJ groups and XML mesh ranges disagree'
assert sorted(i for a, b in mesh_ranges for i in range(a, b + 1)) == list(range(1, len(vertices))), 'CLO mesh ranges do not cover the exact exported vertices'

def mesh_index(vertex):
    return next((i for i, (start, end) in enumerate(mesh_ranges) if start <= vertex <= end), None)

def distance_mm(a, b):
    return math.dist(vertices[a], vertices[b])

pieces = []
for index, ((start, end), name) in enumerate(zip(mesh_ranges, groups)):
    points = vertices[start:end + 1]
    pieces.append({
        'index': index, 'name': name, 'vertexCount': len(points),
        'centroidMm': [round(sum(p[axis] for p in points) / len(points), 3) for axis in range(3)],
        'boundsMm': [[round(min(p[axis] for p in points), 3), round(max(p[axis] for p in points), 3)] for axis in range(3)],
    })

seams = []
for index, pair in enumerate(root.findall('.//SeamLinePair')):
    lines = [[int(i) for i in entry.get('MeshPointIndexes').split('/')] for entry in pair.findall('SeamLine')]
    assert len(lines) == 2 and len(lines[0]) == len(lines[1]), f'sewing pair {index} has unequal mesh sample counts'
    assert all(0 < vertex < len(vertices) for line in lines for vertex in line), f'sewing pair {index} references missing vertex'
    a, b = lines
    piece_a, piece_b = mesh_index(a[0]), mesh_index(b[0])
    assert all(mesh_index(v) == piece_a for v in a) and all(mesh_index(v) == piece_b for v in b), 'sewing pair crosses unexpected mesh group'
    gaps = [distance_mm(x, y) for x, y in zip(a, b)]
    lengths = [sum(distance_mm(line[j], line[j + 1]) for j in range(len(line) - 1)) for line in lines]
    seams.append({
        'index': index, 'pieceA': piece_a, 'pieceB': piece_b, 'samples': len(gaps),
        'meshPointIndexesA': a, 'meshPointIndexesB': b,
        'initialGapMm': {'mean': round(sum(gaps) / len(gaps), 3), 'max': round(max(gaps), 3)},
        'edgeLengthMm': [round(v, 3) for v in lengths],
        'edgeLengthMismatchPercent': round(abs(lengths[0] - lengths[1]) / max(*lengths, 1e-9) * 100, 3),
    })

report = {
    'sourceObj': str(obj), 'sourceXml': str(xml),
    'units': 'millimetres', 'vertexCount': len(vertices) - 1, 'faceCount': faces,
    'pieceCount': len(pieces), 'pieces': pieces,
    'seamPairCount': len(seams), 'seamSampleCount': sum(s['samples'] for s in seams),
    'seams': seams,
    'seamGapSummaryMm': {
        'maximum': round(max(s['initialGapMm']['max'] for s in seams), 3),
        'meanAcrossSamples': round(sum(s['initialGapMm']['mean'] * s['samples'] for s in seams) / sum(s['samples'] for s in seams), 3),
    },
    'notes': [
        'These are actual exported CLO vertex and stitch correspondences, not inferred from screenshot.',
        'The current exported pose has open sewing-line gaps; this is not a ground-truth fitted garment.',
        'CLO sample garment/avatar and Garment Studio Thomas have different geometry and must not share absolute coordinates.',
    ],
}
output = directory.parent / 'clo-sewing-geometry-analysis.json'
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ('pieces', 'seams')}, indent=2))
print('Wrote', output)
