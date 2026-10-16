"""Automated fit preflight and garment sizing for an imported T-shirt shell.

This adjusts an already assembled shirt mesh around a body. It does not
manufacture missing sleeves, sew disconnected panels or guarantee a valid drape.
Run within Blender: blender -b scene.blend --python auto_fit_tee.py -- --output fit.json
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def bounds(obj):
    pts = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return ([min(p[i] for p in pts) for i in range(3)],
            [max(p[i] for p in pts) for i in range(3)])


def torso_sections(body, low_fraction=.48, high_fraction=.78, bands=12):
    """Cross-sectional torso envelope; excludes hands/arms using central X quantiles.

    Assumes an upright Z-up, front-facing mannequin in meters. This is a
    sizing estimate, not anatomical segmentation or a verified chest girth.
    """
    from mathutils import Vector
    points=[body.matrix_world @ vertex.co for vertex in body.data.vertices]
    if len(points)<100:
        raise ValueError('Body mesh too sparse for torso fitting')
    zmin=min(p.z for p in points)
    zmax=max(p.z for p in points)
    height=zmax-zmin
    if height<=0: raise ValueError('Degenerate body height')
    data=[]
    for i in range(bands):
        z=zmin+height*(low_fraction+(high_fraction-low_fraction)*(i+.5)/bands)
        band=[p for p in points if abs(p.z-z)<height*.012]
        if len(band)<12: continue
        xs=sorted(p.x for p in band)
        middle=(xs[int(len(xs)*.2)]+xs[int(len(xs)*.8)])/2
        # Trim the extreme side points, which can be arm/hand geometry.
        central=[p for p in band if abs(p.x-middle)<=height*.20]
        if len(central)<12:continue
        ys=sorted(p.y for p in central)
        core_x=sorted(p.x for p in central)
        data.append({'z':z,'width':core_x[int(len(core_x)*.95)]-core_x[int(len(core_x)*.05)],
                     'depth':ys[int(len(ys)*.95)]-ys[int(len(ys)*.05)],
                     'samples':len(central)})
    if len(data)<3:raise ValueError('Insufficient torso cross-sections; check pose and mesh')
    return data


def fit(body, garment, ease, clearance, max_scale, torso_only=False):
    bl, bh = bounds(body)
    gl, gh = bounds(garment)
    sections=torso_sections(body) if torso_only else []
    body_w = max(s['width'] for s in sections) if torso_only else bh[0]-bl[0]
    body_d = max(s['depth'] for s in sections) if torso_only else bh[1]-bl[1]
    cloth_w, cloth_d = gh[0]-gl[0], gh[1]-gl[1]
    if min(body_w, body_d, cloth_w, cloth_d) <= 1e-7:
        raise ValueError('Degenerate body or garment bounding box')
    # Horizontal ease is a conservative prefit. The final sizing requires
    # torso cross-sections, neck clearance and sleeve opening checks.
    sx = max(1.0, (body_w+2*ease+2*clearance)/cloth_w)
    sy = max(1.0, (body_d+2*ease+2*clearance)/cloth_d)
    if max(sx, sy) > max_scale:
        raise ValueError(f'Required expansion {max(sx,sy):.3f} exceeds safety limit {max_scale:.3f}')
    before_scale=garment.scale.copy()
    before_location=garment.location.copy()
    garment.scale.x *= sx
    garment.scale.y *= sy
    bpy.context.view_layer.update()
    gl, gh = bounds(garment)
    bc = Vector(((bl[0]+bh[0])/2,(bl[1]+bh[1])/2,0))
    gc = Vector(((gl[0]+gh[0])/2,(gl[1]+gh[1])/2,0))
    garment.location += bc-gc
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    pairs = BVHTree.FromObject(garment, graph).overlap(BVHTree.FromObject(body, graph))
    # Preserve source shape and working projects if an unsafe pose is found.
    if pairs:
        garment.scale=before_scale
        garment.location=before_location
        bpy.context.view_layer.update()
    return {'scaleX':sx,'scaleY':sy,'bodyWidthM':body_w,'bodyDepthM':body_d,
            'sizingMethod':'torso-section-quantiles' if torso_only else 'whole-body-bounds',
            'torsoSections':sections,
            'easeM':ease,'clearanceM':clearance,'initialSurfaceIntersectionPairs':len(pairs),
            'readyForPpf':len(pairs)==0,'rolledBack':bool(pairs)}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--body',default='PPF_Body')
    p.add_argument('--garment',default='PPF_Garment')
    p.add_argument('--ease-cm',type=float,default=4)
    p.add_argument('--clearance-mm',type=float,default=8)
    p.add_argument('--max-scale',type=float,default=1.3)
    p.add_argument('--torso-only',action='store_true',help='Estimate torso bounds using cross-sectional body vertices, excluding arm extremes')
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--save-blend',type=Path)
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.ease_cm<0 or args.clearance_mm<0 or args.max_scale<1:
        raise ValueError('Ease and clearance must be nonnegative; max scale >= 1')
    body=bpy.data.objects.get(args.body)
    cloth=bpy.data.objects.get(args.garment)
    if not body or not cloth or body.type!='MESH' or cloth.type!='MESH':
        raise ValueError('Named body and garment must be mesh objects')
    report=fit(body,cloth,args.ease_cm/100,args.clearance_mm/1000,args.max_scale,args.torso_only)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2))
    print('AUTO_FIT_PREFLIGHT',json.dumps(report))
    if not report['readyForPpf']:
        raise RuntimeError('Initial body/garment intersections remain: do not run PPF until repaired')
    if args.save_blend:
        args.save_blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save_blend))


if __name__=='__main__':
    main()
