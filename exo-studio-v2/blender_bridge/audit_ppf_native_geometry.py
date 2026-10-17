"""Compare the native solver's actual body and frames to the Blender cache.

Run in Blender with --session DIR --pc2 FILE --report FILE.
This deliberately audits serialized inputs, not just UI configuration flags.
"""
import argparse
import json
from pathlib import Path
import struct
import sys
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def strict_crossing(a, b):
    # Independent float64 segment/triangle test (Moller-Trumbore). BVH hits
    # alone can include touching surfaces. Require interior segment crossing.
    for source, target in ((a, b), (b, a)):
        e1, e2 = target[1]-target[0], target[2]-target[0]
        for i in range(3):
            start = source[i]
            direction = source[(i+1)%3]-start
            h = np.cross(direction, e2)
            det = np.dot(e1, h)
            if abs(det) < 1e-14:
                continue
            s = start-target[0]
            u = np.dot(s,h)/det
            q = np.cross(s,e1)
            v = np.dot(direction,q)/det
            t = np.dot(e2,q)/det
            if 1e-7 < t < 1-1e-7 and u > 1e-7 and v > 1e-7 and u+v < 1-1e-7:
                return True
    return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--session', required=True, type=Path)
    p.add_argument('--pc2', type=Path)
    p.add_argument('--vertex-map', type=Path, help='JSON array mapping cache indices to native indices')
    p.add_argument('--report', required=True, type=Path)
    a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    def read(name, dtype):
        return np.fromfile(a.session / 'bin' / (name + '.bin'), dtype=dtype).reshape(-1, 3)
    body = read('static_vert', '<f8')
    body_faces = read('static_tri', '<u8')
    faces = read('tri', '<u8')
    body_tree = BVHTree.FromPolygons(body.tolist(), body_faces.tolist(), all_triangles=True)
    samples = 0
    if a.pc2:
        if not a.vertex_map:
            raise ValueError('Cache comparison requires the explicit native vertex map')
        blob = a.pc2.read_bytes()
        _, _, n, _, _, samples = struct.unpack_from('<12sIIffI', blob)
        cache = np.frombuffer(blob, dtype='<f4', offset=32).reshape(samples, n, 3)
        cache = cache[:, :, [0, 2, 1]].copy()
        cache[:, :, 2] *= -1
        mapping = np.array(json.loads(a.vertex_map.read_text()), dtype=int)
        if sorted(mapping.tolist()) != list(range(n)):
            raise ValueError('Expected a bijective shell vertex map')
        cache = cache[:, np.argsort(mapping), :]
    obj = bpy.data.objects['PPF_Avatar_ThomasBody']
    blender_body = np.array([tuple(obj.matrix_world @ v.co) for v in obj.data.vertices])[:, [0, 2, 1]]
    blender_body[:, 2] *= -1
    nearest_errors = [body_tree.find_nearest(tuple(v))[3] for v in blender_body]
    rows = []
    for f in sorted((a.session/'output').glob('vert_*.bin'), key=lambda f:int(f.stem.split('_')[1])):
        index = int(f.stem.split('_')[1])
        native = np.fromfile(f, dtype='<f4').reshape(-1, 3)
        tree = BVHTree.FromPolygons(native.tolist(), faces.tolist(), all_triangles=True)
        hits = tree.overlap(body_tree)
        depths = []
        for vi in set(int(v) for fi, _ in hits for v in faces[fi]):
            co, normal, _, distance = body_tree.find_nearest(tuple(native[vi]))
            if co is not None and np.dot(native[vi]-np.array(co),np.array(normal)) < 0:
                depths.append(distance)
        row = {'frame': index, 'nativeBodyCrossings':len(hits),
               'strictTriangleCrossings':sum(strict_crossing(native[faces[x]],body[body_faces[y]]) for x,y in hits),
               'maxInwardVertexDistanceMm':float(max(depths,default=0)*1000)}
        if index < samples:
            row['cacheMaxErrorM'] = float(np.linalg.norm(native-cache[index],axis=1).max())
            cache_tree = BVHTree.FromPolygons(cache[index].tolist(), faces.tolist(), all_triangles=True)
            row['cacheBodyCrossings'] = len(cache_tree.overlap(body_tree))
        rows.append(row)
    report = {'nativeBodyVertices':len(body), 'nativeBodyFaces':len(body_faces),
              'blenderBodyMaxSurfaceErrorM':float(max(nearest_errors)),
              'nativeBodyBounds':[body.min(axis=0).tolist(),body.max(axis=0).tolist()],
              'blenderBodyBounds':[blender_body.min(axis=0).tolist(),blender_body.max(axis=0).tolist()],
              'frames':rows}
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
