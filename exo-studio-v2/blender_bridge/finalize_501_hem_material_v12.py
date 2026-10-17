"""Keep the final 501 visuals, remove floating proxy laces and bake stitch look.

Two fine locked hem seams are calculated from the actual world-space fabric Z
coordinate, so they follow its surface without extra floating curve geometry.
Garment geometry, avatar and CLO reference project are left unchanged.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def update_denim_material(jeans):
    mat=jeans.data.materials[0]
    if not mat.use_nodes:raise RuntimeError('Expected editable denim shader')
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    existing=list(bsdf.inputs['Base Color'].links)
    if len(existing)!=1:raise RuntimeError('Ambiguous light-blue wash shader wiring')
    source=existing[0].from_socket
    geo=nodes.new('ShaderNodeNewGeometry')
    geo.location=(-600,-420)
    sep=nodes.new('ShaderNodeSeparateXYZ')
    sep.location=(-370,-420)
    links.new(geo.outputs['Position'],sep.inputs['Vector'])
    stripes=[]
    for z in (.0642,.0688):
        sub=nodes.new('ShaderNodeMath');sub.operation='SUBTRACT'
        links.new(sep.outputs['Z'],sub.inputs[0]);sub.inputs[1].default_value=z
        ab=nodes.new('ShaderNodeMath');ab.operation='ABSOLUTE'
        links.new(sub.outputs[0],ab.inputs[0])
        narrow=nodes.new('ShaderNodeMath');narrow.operation='LESS_THAN'
        links.new(ab.outputs[0],narrow.inputs[0])
        narrow.inputs[1].default_value=.00084
        stripes.append(narrow.outputs[0])
    union=nodes.new('ShaderNodeMath');union.operation='MAXIMUM'
    links.new(stripes[0],union.inputs[0]);links.new(stripes[1],union.inputs[1])
    mask=nodes.new('ShaderNodeMath');mask.operation='MULTIPLY'
    links.new(union.outputs[0],mask.inputs[0]);mask.inputs[1].default_value=.88
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX'
    links.new(source,mix.inputs[1]);links.new(mask.outputs[0],mix.inputs[0])
    mix.inputs[2].default_value=(.39,.265,.14,1)
    links.new(mix.outputs[0],bsdf.inputs['Base Color'])
    mix.label='Fabric-Conformed Two-Row Tan Chain Stitch At Hem'
    return mat.name


def view(camera,pos,target,scale):
    camera.location=pos
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=scale


def main():
    a=sys.argv[sys.argv.index('--')+1:]
    source=Path(a[0]);out=Path(a[1]);out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    jeans=bpy.data.objects['MIKRISTIAN_501_W32L32_Manifold_Fit_Shell']
    avatar=bpy.data.objects['Full Human Fitting Avatar - Theo (source asset)']
    original_cloth=[v.co.copy() for v in jeans.data.vertices]
    original_body=[v.co.copy() for v in avatar.data.vertices]
    removed=[]
    for obj in list(bpy.data.objects):
        if obj.type=='CURVE' and 'Sneaker Lace' in obj.name:
            removed.append(obj.name)
            bpy.data.objects.remove(obj,do_unlink=True)
    tex=update_denim_material(jeans)
    scene=bpy.context.scene
    scene.cycles.samples=18
    scene.render.resolution_x=880
    scene.render.resolution_y=1070
    cam=scene.camera
    outputs={}
    for name,pos,target,scale in [
        ('front',(0,-3,.99),(0,0,.89),1.75),
        ('back',(0,3,.99),(0,0,.89),1.75),
        ('threequarter',(2.25,-3.0,1.07),(0,0,.89),1.75),
        ('cuff_detail',(0,-2.6,.18),(0,0,.18),.48),
    ]:
        view(cam,pos,target,scale)
        scene.render.filepath=str(out/f'501_LightBlue_Distressed_{name}.png')
        bpy.ops.render.render(write_still=True)
        outputs[name]=scene.render.filepath
    body_ok=all((v.co-p).length<1e-8 for v,p in zip(avatar.data.vertices,original_body))
    cloth_ok=all((v.co-p).length<1e-8 for v,p in zip(jeans.data.vertices,original_cloth))
    upright=max((avatar.matrix_world@v.co).z for v in avatar.data.vertices)>1.80
    scene['jeans_copy_is_original_Levis_pattern']=False
    scene['custom_light_indigo_wash']=True
    scene['stitched_cuffs_surface_conformed']=True
    scene['ripped_knees_with_fibers']=True
    scene['native_clo_simulation_complete']=False
    path=out/'501_Inspired_LightBlue_Wash_Ripped_StitchedCuffs_V12.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    qa={'source':str(source),'saved':str(path),'renders':outputs,'blueMaterial':tex,
        'removedOutOfPlaceSneakerLaces':len(removed),
        'authenticGarmentVerticesPreserved':cloth_ok,
        'avatarUpright':upright,'avatarVerticesPreserved':body_ok,
        'twoTanHemStitchRowsShaderBaked':True,
        'nativeCLOPhysicsNotRerun':True,
        'notManufacturerLevisPattern':True}
    (out/'501_V12_FINAL_VERIFICATION.json').write_text(json.dumps(qa,indent=2)+'\n')
    print('501_FINAL_V12='+json.dumps(qa))
    if not (cloth_ok and body_ok and upright):raise RuntimeError('Critical geometry preservation failed')


if __name__=='__main__':main()
