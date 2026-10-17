"""Correct floating hem stitching on the final 501 lightwash Blender visual.

Stitches are generated from real Z-plane intersections with original denim
mesh instead of offsetting the hem boundary into empty space. Keeps all
garment and avatar geometry, wash, rips, pockets and shoes unchanged.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from finish_501_lightwash import stroke, material, orient_cam, border_components


def slice_contour(jeans,z,side):
    verts=[jeans.matrix_world@v.co for v in jeans.data.vertices]
    found={}
    for poly in jeans.data.polygons:
        edges=list(poly.vertices)
        for i in range(len(edges)):
            p=verts[edges[i]]
            q=verts[edges[(i+1)%len(edges)]]
            if (p.z-z)*(q.z-z)>0 or abs(p.z-q.z)<1e-8:continue
            t=(z-p.z)/(q.z-p.z)
            if t<0 or t>1:continue
            x=p.x+(q.x-p.x)*t
            y=p.y+(q.y-p.y)*t
            if x*side<=0:continue
            found[(round(x,5),round(y,5))]=Vector((x,y,z))
    pts=list(found.values())
    if len(pts)<19:raise RuntimeError(f'Insufficient actual cloth contour samples z={z} side={side}: {len(pts)}')
    cx=sum(p.x for p in pts)/len(pts)
    cy=sum(p.y for p in pts)/len(pts)
    pts.sort(key=lambda p:math.atan2(p.y-cy,p.x-cx))
    return pts,cx,cy


def main():
    a=sys.argv[sys.argv.index('--')+1:]
    source=Path(a[0]);dest=Path(a[1]);dest.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    jeans=bpy.data.objects['MIKRISTIAN_501_W32L32_Manifold_Fit_Shell']
    avatar=bpy.data.objects['Full Human Fitting Avatar - Theo (source asset)']
    body_before=[p.co.copy() for p in avatar.data.vertices]
    cloth_before=[p.co.copy() for p in jeans.data.vertices]
    removed=[]
    for ob in list(bpy.data.objects):
        if ob.type=='CURVE' and any(x in ob.name for x in
            ('Contrast Hem Topstitch','Turned Edge','501 Hem Topstitch','Hem / Golden')):
            removed.append(ob.name)
            bpy.data.objects.remove(ob,do_unlink=True)
    cotton=material('Hem / Washed Tan Lockstitch Thread',(.40,.29,.17),.95)
    shade=material('Hem / Folded Indigo Edge Shading',(.067,.14,.24),.96)
    hems=[]
    for side,label in ((-1,'Left'),(1,'Right')):
        for z,material_use,name,thick in [
            (.046,shade,'Finished Turned Indigo Hem Edge',.0012),
            (.065,cotton,'Traditional Chain Topstitch / Lower',.00112),
            (.069,cotton,'Traditional Chain Topstitch / Upper',.00095),
        ]:
            pts,cx,cy=slice_contour(jeans,z,side)
            on_cloth=[]
            for p in pts:
                rad=Vector((p.x-cx,p.y-cy,0)).normalized()*0.00065
                on_cloth.append(tuple(p+rad))
            stroke(f'{label} / {name} / SurfaceConformed',on_cloth,material_use,thick,True)
            hems.append(dict(side=label,z=round(z,3),sampleCount=len(pts),
                             target='physical denim surface intersection',stitch=name))
    assert all((v.co-p).length<1e-9 for v,p in zip(jeans.data.vertices,cloth_before))
    assert all((v.co-p).length<1e-9 for v,p in zip(avatar.data.vertices,body_before))
    scene=bpy.context.scene
    cam=scene.camera
    scene.render.resolution_x=960;scene.render.resolution_y=1080
    scene.cycles.samples=16
    outimages={}
    for name,position,target,scale in [
        ('cuff_detail',(0,-2.6,.18),(0,0,.18),.47),
        ('front',(0,-3.0,.98),(0,0,.87),1.75),
        ('threequarter',(2.1,-3.2,1.03),(0,0,.87),1.75),
    ]:
        orient_cam(cam,position,target)
        cam.data.ortho_scale=scale
        scene.render.filepath=str(dest/f'501_LightWash_Final_{name}.png')
        bpy.ops.render.render(write_still=True)
        outimages[name]=scene.render.filepath
    output=dest/'501_Levis501_Inspired_LightBlue_Distressed_HemV11.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    report={'source':str(source),'saved':str(output),'images':outimages,
            'clothUnchanged':True,'avatarUnchanged':True,
            'removedFloatingOldStitchCurves':len(removed),
            'newSurfaceMatchedHemCurves':hems,
            'nativeCLOSimulationValidated':False}
    (dest/'HEM_STITCH_SURFACE_VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
    print('HEM_MATCH_QA='+json.dumps(report))


if __name__=='__main__':main()
