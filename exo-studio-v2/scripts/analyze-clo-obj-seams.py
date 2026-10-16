"""Read-only analysis of CLO's explicitly exported OBJ + seam metadata XML.

This describes the exported pose, which may be an intermediate CLO arrangement,
not a numerically settled garment. Coordinates are CLO millimetres (Y up).
"""
from __future__ import annotations
import argparse
import collections
import json
import math
import pathlib
import statistics
import xml.etree.ElementTree as ET


def parse_obj(source):
    vertices = []
    groups = collections.OrderedDict()
    current = None
    for line in source.read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == 'v':
            vertices.append(tuple(float(v) for v in fields[1:4]))
        elif fields[0] == 'g':
            current = ' '.join(fields[1:])
            if current in groups:
                raise ValueError('Repeated OBJ group declaration: ' + current)
            groups[current] = {'faces': [], 'ids': set()}
        elif fields[0] == 'f':
            if current is None:
                raise ValueError('OBJ face appears before pattern group')
            indices = [int(v.split('/')[0]) for v in fields[1:]]
            if any(i < 1 or i > len(vertices) for i in indices):
                raise ValueError('Invalid OBJ face vertex index')
            groups[current]['faces'].append(indices)
            groups[current]['ids'].update(indices)
    return vertices, groups


def metrics(obj, meta):
    vertices, groups = parse_obj(obj)
    root = ET.parse(meta).getroot()
    if root.attrib.get('ObjFileName') != obj.name:
        raise ValueError('CLO XML metadata does not belong to this OBJ export')
    owner = {}
    result_groups = []
    for name, data in groups.items():
        coords = [vertices[i - 1] for i in sorted(data['ids'])]
        if any(i in owner for i in data['ids']):
            raise ValueError('Overlapping vertex IDs from supposedly unwelded pattern groups')
        owner.update({i: name for i in data['ids']})
        centroid = [statistics.mean(v[axis] for v in coords) / 10 for axis in range(3)]
        result_groups.append({
            'id': name, 'vertices': len(coords), 'faces': len(data['faces']),
            'centroidCm': [round(x, 3) for x in centroid],
            'boundsCm': [[round(min(v[axis] for v in coords) / 10, 3),
                          round(max(v[axis] for v in coords) / 10, 3)] for axis in range(3)],
        })
    records, gaps = [], []
    for index, pair in enumerate(root.findall('./SeamLinePairList/SeamLinePair')):
        lines = [
            [int(v) for v in item.attrib['MeshPointIndexes'].split('/')]
            for item in pair.findall('SeamLine')
        ]
        if len(lines) != 2 or len(lines[0]) != len(lines[1]):
            raise ValueError(f'Sewing pair {index} has unequal/missing vertex correspondence')
        for side in lines:
            if any(i not in owner for i in side):
                raise ValueError(f'Sewing pair {index} references an unknown OBJ vertex')
            if len({owner[i] for i in side}) != 1:
                raise ValueError(f'Sewing pair {index} unexpectedly spans multiple pattern objects')
        ds = [math.dist(vertices[a - 1], vertices[b - 1]) / 10 for a, b in zip(*lines)]
        gaps.extend(ds)
        records.append({
            'index': index, 'groups': [owner[side[0]] for side in lines],
            'correspondenceCount': len(ds),
            'meanCurrentGapCm': round(statistics.mean(ds), 3),
            'maxCurrentGapCm': round(max(ds), 3),
            'firstPairObjIndex': [side[0] for side in lines],
            'lastPairObjIndex': [side[-1] for side in lines],
            'sourcePointIndices': lines,
        })
    if not gaps:
        raise ValueError('No sewing correspondence in exported CLO XML')
    return {
        'schema': 'garment-studio.clo-observed-assembly.v1',
        'sourceOBJ': obj.name, 'sourceMetadata': meta.name,
        'units': 'centimetres', 'referencePoseOnly': True,
        'notAnAcceptedFittedGarment': True,
        'vertexCount': len(vertices), 'patternGroupCount': len(groups),
        'sewingPairCount': len(records), 'correspondenceCount': len(gaps),
        'meanCurrentGapCm': round(statistics.mean(gaps), 3),
        'p95CurrentGapCm': round(sorted(gaps)[int(.95 * (len(gaps) - 1))], 3),
        'maximumCurrentGapCm': round(max(gaps), 3),
        'patterns': result_groups, 'seamPairs': records,
    }


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('obj', type=pathlib.Path)
    cli.add_argument('xml', type=pathlib.Path)
    cli.add_argument('out', type=pathlib.Path)
    args = cli.parse_args()
    result = metrics(args.obj, args.xml)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('patterns', 'seamPairs')}, indent=2))
