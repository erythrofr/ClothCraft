#!/usr/bin/env python3
"""Make an offline, body-only Thomas OBJ for personal Rust contact tests.

Uses the user's existing private Blender OBJ; outputs are never checked into Git.
Normals/meshes for shoes, hair, eyes and accessories are intentionally excluded.
Global normalization matches EXO's visible GLB: whole-model height and center.
"""
import argparse
from pathlib import Path


def convert(source: Path, destination: Path, body_name: str = 'body_mesh') -> dict:
    vertices, faces = [], []
    section = ''
    lo = [float('inf')] * 3
    hi = [float('-inf')] * 3
    with source.open(encoding='utf-8', errors='replace') as lines:
        for line in lines:
            if line.startswith(('o ', 'g ')):
                section = line[2:].strip()
            elif line.startswith('v '):
                p = [float(v) for v in line.split()[1:4]]
                if len(p) != 3 or not all(abs(v) < 1e5 for v in p):
                    raise ValueError('Invalid private avatar position')
                vertices.append(p)
                for axis in range(3):
                    lo[axis] = min(lo[axis], p[axis])
                    hi[axis] = max(hi[axis], p[axis])
            elif line.startswith('f ') and section == body_name:
                face = [int(token.split('/')[0]) for token in line.split()[1:]]
                if len(face) < 3 or min(face) < 1:
                    raise ValueError('Body-only collider requires positive OBJ face IDs')
                for i in range(1, len(face) - 1):
                    faces.append([face[0], face[i], face[i + 1]])
    if not vertices or len(faces) < 20:
        raise ValueError(f'{body_name!r} surface not present in original private OBJ')
    indices = sorted({i for face in faces for i in face})
    if indices[-1] > len(vertices):
        raise ValueError('Body mesh references a non-existent vertex')
    height = hi[1] - lo[1]
    if not 0.5 < height < 50.0:
        raise ValueError(f'Unexpected avatar height {height} m')
    scale = 1.8 / height
    remap = {original: new for new, original in enumerate(indices, 1)}
    center_x = (hi[0] + lo[0]) / 2
    center_z = (hi[2] + lo[2]) / 2
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('w', encoding='utf-8') as target:
        target.write('# Personal body-only collision reference; not for redistribution\no body_mesh\n')
        for i in indices:
            x, y, z = vertices[i - 1]
            target.write(f'v {(x-center_x)*scale:.9f} {(y-lo[1])*scale:.9f} {(z-center_z)*scale:.9f}\n')
        for face in faces:
            target.write('f ' + ' '.join(str(remap[i]) for i in face) + '\n')
    return {'originalHeightM': height, 'normalizedHeightM': 1.8,
            'bodyVertices': len(indices), 'bodyTriangles': len(faces)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--body-name', default='body_mesh')
    args = parser.parse_args()
    print(convert(args.source, args.destination, args.body_name))
