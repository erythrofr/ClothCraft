"""Verify jeans cover the intact avatar in front/back and side orthographic tests.

This deliberately tests the FULL imported body, including thighs, not a
previous waist-clipped body that could pass without any real geometry fix.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def hit_distance(obj, origin, direction):
    mat = obj.matrix_world
    inv = mat.inverted()
    hit, point, normal, index = obj.ray_cast(inv @ origin, (inv.to_3x3() @ direction).normalized(), distance=10)
    return (mat @ point - origin).length if hit else None


def scan(body, cloth, axis, direction):
    leaks = []
    occupied = 0
    cloth_hits = 0
    height_bins = {}
    for iz in range(105):
        z = .075 + .98 * iz / 104
        for ip in range(115):
            u = -.36 + .72 * ip / 114
            if axis == 'y':
                origin = Vector((u, -2.0 if direction == 'front' else 2.0, z))
                vec = Vector((0, 1 if direction == 'front' else -1, 0))
            else:
                origin = Vector((-2 if direction == 'left' else 2, u, z))
                vec = Vector((1 if direction == 'left' else -1, 0, 0))
            skin = hit_distance(body, origin, vec)
            garment = hit_distance(cloth, origin, vec)
            if garment is not None:
                cloth_hits += 1
            if skin is None:
                continue
            occupied += 1
            if garment is None or (skin + .001 < garment):
                leaks.append((round(u, 4), round(z, 4),
                              round(garment - skin, 4) if garment is not None else None))
                k = f'{int(z/.1)*10:02d}-{int(z/.1)*10+10:02d}cm'
                height_bins[k] = height_bins.get(k, 0) + 1
    return dict(view=direction, bodyRayHits=occupied, garmentRayHits=cloth_hits,
                bareBodyHits=len(leaks), bareBodyPct=round(100*len(leaks)/max(occupied,1),2),
                leaksByHeight=height_bins, sampleLeaks=leaks[:25])


def main():
    bpy.context.view_layer.update()
    body = bpy.data.objects.get('Full Human Fitting Avatar - Theo (source asset)')
    cloth = bpy.data.objects.get('MIKRISTIAN_501_W32L32_Manifold_Fit_Shell')
    if not body or not cloth:
        raise RuntimeError('Must load the complete intact-avatar fitted-jeans scene')
    report = dict(avatarVertices=len(body.data.vertices),
                  garmentVertices=len(cloth.data.vertices),
                  garmentFaces=len(cloth.data.polygons),
                  views=[scan(body, cloth, 'y', 'front'),scan(body, cloth, 'y', 'back'),
                         scan(body, cloth, 'x', 'left'),scan(body, cloth, 'x', 'right')],
                  garmentFitTestNotNativeClothSimulation=True)
    out=Path(sys.argv[sys.argv.index('--')+1])
    out.write_text(json.dumps(report,indent=2)+'\n')
    print('JEANS_SKIN_RAY_QA='+json.dumps(report))


if __name__=='__main__':main()
