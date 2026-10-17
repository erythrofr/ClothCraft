#!/usr/bin/env python3
"""Normalize a CLO-exported DXF-ASTM tee into one editable cut contour per block.

Non-destructive: reads CLO's real ASTM blocks, keeps its authoritative layer-1
cutline vertices in millimeters, and generates a separate plain DXF that
Garment Studio's current generic importer understands. Sewing topology is NOT
invented; original OBJ/XML sewing metadata stays alongside the source file.
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path

ROLE = {
    '37_M': 'Front',
    '7_M': 'Back',
    '36_M': 'Right Sleeve',
    '39_M': 'Left Sleeve',
    'Pattern2D_768516_M': 'Neck Piece A',
    'Pattern2D_768527_M': 'Neck Piece B',
    'Pattern2D_768528_M': 'Neck Piece C',
}


def entries(path):
    lines = path.read_text(encoding='utf-8-sig').splitlines()
    if len(lines) % 2:
        raise ValueError('Malformed DXF group code pairs')
    return [(int(lines[i].strip()), lines[i + 1].strip()) for i in range(0, len(lines), 2)]


def attributes(pairs):
    return {key: value for key, value in pairs}


def extract_blocks(pairs):
    block = None
    section = None
    blocks = {}
    i = 0
    while i < len(pairs):
        code, value = pairs[i]
        if code == 0 and value == 'SECTION':
            section = next((v for k, v in pairs[i+1:i+6] if k == 2), '')
        elif code == 0 and value == 'ENDSEC':
            section = None
        elif section == 'BLOCKS' and code == 0 and value == 'BLOCK':
            block = next((v for k, v in pairs[i+1:i+16] if k == 2), None)
            if block in blocks:
                raise ValueError('Duplicate block '+str(block))
            blocks[block] = []
        elif section == 'BLOCKS' and code == 0 and value == 'ENDBLK':
            block = None
        elif section == 'BLOCKS' and block and code == 0 and value == 'POLYLINE':
            header = []
            i += 1
            while i < len(pairs) and pairs[i][0] != 0:
                header.append(pairs[i]); i += 1
            props = attributes(header)
            points = []
            while i < len(pairs):
                child = pairs[i]
                if child == (0, 'SEQEND'):
                    i += 1
                    while i < len(pairs) and pairs[i][0] != 0:
                        i += 1
                    break
                if child != (0, 'VERTEX'):
                    raise ValueError(f'Unexpected polyline child: {child}')
                i += 1
                vert = []
                while i < len(pairs) and pairs[i][0] != 0:
                    vert.append(pairs[i]); i += 1
                fields = attributes(vert)
                if 10 not in fields or 20 not in fields:
                    raise ValueError('Vertex missing XY')
                pt = (float(fields[10]), float(fields[20]))
                if not all(math.isfinite(v) for v in pt):
                    raise ValueError('Nonfinite vertex')
                points.append(pt)
            blocks[block].append({'layer': props.get(8, ''),
                                  'closed': bool(int(props.get(70, '0')) & 1),
                                  'points': points})
            continue
        i += 1
    return blocks


def polygon_area(points):
    return abs(sum(x * points[(i+1) % len(points)][1] -
                   points[(i+1) % len(points)][0] * y
                   for i, (x, y) in enumerate(points))) / 2


def write_dxf(contours, dest):
    out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009',
           '9', '$INSUNITS', '70', '4', '9', '$MEASUREMENT', '70', '1',
           '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES']
    for c in contours:
        layer = 'CUT_' + c['role'].upper().replace(' ', '_') + '_BASE'
        out += ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1']
        for x, y in c['points']:
            out += ['0', 'VERTEX', '8', layer, '10', f'{x:.6f}',
                    '20', f'{y:.6f}', '30', '0']
        out += ['0', 'SEQEND', '8', layer]
    out += ['0', 'ENDSEC', '0', 'EOF']
    dest.write_text('\n'.join(out) + '\n')


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: convert-clo-astm-tshirt.py SOURCE.dxf DEST.dxf')
    source, dest = map(Path, sys.argv[1:])
    blocks = extract_blocks(entries(source))
    if set(blocks) != set(ROLE):
        raise ValueError('Unexpected CLO pattern identities: '+str(set(blocks) ^ set(ROLE)))
    contours = []
    for block_id, role in ROLE.items():
        layer1 = [p for p in blocks[block_id] if p['layer'] == '1' and p['closed']]
        if len(layer1) != 1:
            raise ValueError(f'Expected exactly one authoritative cutline in {block_id}')
        points = layer1[0]['points']
        if len(points) >= 2 and points[0] == points[-1]:
            points = points[:-1]
        if len(points) < 3 or polygon_area(points) < 10:
            raise ValueError('Invalid cut outline '+block_id)
        contours.append({'blockId': block_id, 'role': role,
                         'pointCount': len(points), 'areaCm2': polygon_area(points)/100,
                         'points': points})
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        raise FileExistsError('Refusing to overwrite existing normalized reference')
    write_dxf(contours, dest)
    report = {'source': str(source), 'normalized': str(dest),
              'units': 'mm', 'trueCloCutContours': len(contours),
              'patternSummary': [{k:v for k,v in x.items() if k!='points'} for x in contours],
              'notes': 'Only one closed authoritative layer-1 contour per CLO ASTM block. Preserve original DXF for construction lines and original OBJ/XML for sewing correspondences; normalized DXF does not itself import stitches.'}
    dest.with_suffix('.manifest.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
