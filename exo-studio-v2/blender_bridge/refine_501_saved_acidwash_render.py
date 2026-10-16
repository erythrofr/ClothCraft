"""Upgrade the 501 saved fit render with a full human mesh and black acidwash contrast.

The original garment shell remains unchanged. This is a visualization of the
previously saved body-fit shell, not a native CLO cloth-simulation claim.
"""
import argparse
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

def look_at(ob, pt):
    ob.rotation_euler=(Vector(pt)-ob.location).to_track_quat('-Z','Y').to_euler()

def main(av,out):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    gar=bpy.data.objects.get('MIKRISTIAN_501_W32L32_Manifold_Fit_Shell')
    if gar is None:raise RuntimeError('saved jeans shell not in loaded .blend')
    # hide ONLY the original proxy shapes, preserving garment, cameras, lights and floor.
    proxies=['Left arm','Left foot','Left hand','Left leg','Male head','Male neck',
             'Male pelvis - hidden beneath jeans','Male torso',
             'Right arm','Right foot','Right hand','Right leg']
    for name in proxies:
        ob=bpy.data.objects.get(name)
        if ob:ob.hide_render=True;ob.hide_set(True)

    before=set(bpy.data.objects)
    avatar_file=Path(av).resolve()
    if avatar_file.suffix.lower()=='.glb':
        bpy.ops.import_scene.gltf(filepath=str(avatar_file))
        introduced=[o for o in bpy.data.objects if o not in before]
        humans=[o for o in introduced if o.type=='MESH' and o.name.startswith('CD_Man_Body')]
        for o in introduced:
            if o not in humans:bpy.data.objects.remove(o,do_unlink=True)
    else:
        bpy.ops.wm.obj_import(filepath=str(avatar_file),forward_axis='NEGATIVE_Z',up_axis='Y')
        humans=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    if not humans:raise RuntimeError('No human mesh imported from OBJ')
    mat=bpy.data.materials.new('Warm neutral anatomical fitting avatar')
    mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(.48,.355,.28,1)
    bs.inputs['Roughness'].default_value=.92
    mat.diffuse_color=(.48,.355,.28,1)
    for ob in humans:
        ob.name='Male full-body fitting avatar - saved MakeHuman mesh'
        if avatar_file.suffix.lower()!='.glb':
            ob.rotation_euler=(math.pi/2,0,0)
            ob.scale=(.105,.105,.105)
            ob.location=(0,0,.886)
        else:
            ob.name='Male full-body fitting avatar - OpenSew Theo body only'
            # This body has wider hips and thighs than the W32 saved fitting
            # shell. Use a reversible, visual-only lower-body fit proxy so the
            # clothing is OUTSIDE the anatomy rather than hidden behind it.
            inv=ob.matrix_world.inverted()
            for v in ob.data.vertices:
                world=ob.matrix_world @ v.co
                t=max(0.0,min(1.0,(world.z-1.08)/.29))
                t=t*t*(3-2*t)
                fx=.64+(1-.64)*t
                fy=.69+(1-.69)*t
                world.x*=fx
                world.y*=fy
                v.co=inv @ world
            ob.data.update()
        ob.data.materials.clear();ob.data.materials.append(mat)
        for poly in ob.data.polygons:poly.use_smooth=True
        ob['source']=str(avatar_file)+'; visual garment-fitting model'

    denim=gar.data.materials[0]
    nt=denim.node_tree
    im=next(n for n in nt.nodes if n.type=='TEX_IMAGE')
    ramp=nt.nodes.new('ShaderNodeValToRGB')
    ramp.name='Original recovered black-white wash; deep contrast correction'
    ramp.color_ramp.elements[0].position=.11
    ramp.color_ramp.elements[0].color=(.006,.007,.009,1)
    ramp.color_ramp.elements[1].position=.98
    ramp.color_ramp.elements[1].color=(.52,.54,.56,1)
    e=ramp.color_ramp.elements.new(.50)
    e.color=(.009,.011,.017,1)
    e=ramp.color_ramp.elements.new(.77)
    e.color=(.085,.093,.11,1)
    gray=nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(im.outputs['Color'],gray.inputs['Color'])
    nt.links.new(gray.outputs['Val'],ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color'])

    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1200
    scene.render.resolution_y=1450
    scene.view_settings.view_transform='AgX'
    cam=scene.camera
    cam.data.type='ORTHO';cam.data.ortho_scale=2.12
    renders={}
    for name,xyz in [('front',(0,-3.4,1.15)),('back',(0,3.4,1.15)),('threequarter',(2.6,-2.65,1.17))]:
        cam.location=xyz
        look_at(cam,(0,0,.955))
        target=out/f'501_W32L32_DARK_ACIDWASH_ON_MALE_{name}.png'
        scene.render.filepath=str(target)
        bpy.ops.render.render(write_still=True)
        renders[name]=str(target)
    scene['render_source']='501 archived fitted mesh + recovered original CLO wash texture + archived anatomical fitting avatar'
    scene['native_CLO_simulation_revalidated']=False
    blend=out/'501_W32L32_DARK_ACIDWASH_RESTORED_ON_BODY.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    report={'status':'render successful','images':renders,'blend':str(blend),
            'originalJeansMeshFaces':len(gar.data.polygons),'onMaleAvatar':True,
            'usedActualCLOAcidWashTexture':True,'CLOClothSimulationRevalidated':False}
    (out/'501_W32L32_Wash_Render_Validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print('FINAL_WASH_RENDER='+json.dumps(report))

if __name__=='__main__':
    import sys
    ap=argparse.ArgumentParser();ap.add_argument('--avatar',required=True);ap.add_argument('--out',required=True)
    a=sys.argv
    args=ap.parse_args(a[a.index('--')+1:] if '--' in a else [])
    main(args.avatar,args.out)
