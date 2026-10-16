"""Re-render saved body-wrapped 501 Blender fit scene with genuine recovered CLO acidwash atlas.

This is a visual re-render of an earlier body-fit reference; it does not claim
that CLO's garment was sewn, draped or rendered in this invocation.
"""
import argparse
import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

def look_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def make_mat(name, color, rough=0.85, metallic=0):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metallic
    return mat

def make_washed_denim(image):
    mat=make_mat('MIKRISTIAN / Recovered Original Acidwash Denim',(0.036,.039,.045),.94)
    nt=mat.node_tree
    b=nt.nodes.get('Principled BSDF')
    tex=nt.nodes.new('ShaderNodeTexImage')
    tex.name='Original CLO PANTS TEXTURE crop, recovered October 12'
    tex.image=image
    tex.interpolation='Linear'
    tex.extension='REPEAT'
    nt.links.new(nt.nodes.new('ShaderNodeTexCoord').outputs['UV'],tex.inputs['Vector'])
    rgb=nt.nodes.new('ShaderNodeMixRGB')
    rgb.blend_type='MULTIPLY'
    rgb.inputs[0].default_value=.96
    rgb.inputs[2].default_value=(.77,.78,.82,1)
    nt.links.new(tex.outputs['Color'],rgb.inputs[1]);nt.links.new(rgb.outputs['Color'],b.inputs['Base Color'])
    noise=nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=420
    noise.inputs['Detail'].default_value=2
    nt.links.new(nt.nodes['Texture Coordinate'].outputs['UV'],noise.inputs['Vector'])
    bump=nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=.09
    bump.inputs['Distance'].default_value=.00045
    nt.links.new(noise.outputs['Fac'],bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'],b.inputs['Normal'])
    return mat

def apply_uv(mesh):
    uv=mesh.uv_layers.get('Original wash directional projection') or mesh.uv_layers.new(name='Original wash directional projection')
    for face in mesh.polygons:
        for li in face.loop_indices:
            vi=mesh.loops[li].vertex_index
            x,y,z=mesh.vertices[vi].co
            c=(-.112 if x<0 else .112) if z<.81 else 0
            # seam sits on the in/outer leg rather than across the front view
            angle=math.atan2(y, x-c)
            u=((angle+math.pi)/(2*math.pi)+(.1 if x>0 and z<.81 else 0))%1
            v=max(0,min(1,(z-.018)/1.062))
            uv.data[li].uv=(u,v)
    return uv

def curve(name, pts, mat, size=.0019, cyclic=False):
    if len(pts)<2:return
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=size;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for dst,src in zip(s.points,pts):dst.co=(*src,1)
    s.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,c);bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)

def cast_point(garment,x,z,front=True):
    origin=(x,-.7 if front else .7,z)
    direction=(0,1 if front else -1,0)
    hit,loc,normal,index=garment.ray_cast(origin,direction)
    if not hit:return None
    return (loc+normal*.0026)[:]

def add_jeans_stitches(garment, gold):
    # lines are laid directly onto saved fabric mesh using its actual raycast surface
    for side in (-1,1):
        for name, coords, front in [
           ('front-pocket',[(side*(.153-.077*t/38),1.027-.084*math.sin(math.pi*t/76)) for t in range(39)],True),
           ('back-pocket-top',[(side*(.065+.073*t/25),.956) for t in range(26)],False),
           ('back-pocket-left',[(side*.065,.956-.135*t/26) for t in range(27)],False),
           ('back-pocket-right',[(side*.138,.956-.132*t/26) for t in range(27)],False),
           ('back-pocket-bottom',[(side*(.065+.073*t/24),.818-.019*math.sin(math.pi*t/24)) for t in range(25)],False),
           ('back-pocket-arcuate',[(side*(.07+.064*t/30),.904-.027*math.sin(math.pi*t/30)) for t in range(31)],False),
        ]:
            line=[]
            for x,z in coords:
                p=cast_point(garment,x,z,front)
                if p:line.append(p)
            if len(line)>3:
                curve(f'{name} {side:+d} / sewing reference',line,gold,.0014)
    fly=[]
    for i in range(38):
        t=i/37;x=-.005-.028*math.sin(math.pi*t);z=1.018-.21*t
        p=cast_point(garment,x,z,True)
        if p:fly.append(p)
    curve('Curved button fly / gold sewing guide',fly,gold,.0021)

def main(args):
    out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    wash=Path(args.wash).resolve()
    if not wash.exists():raise RuntimeError('Recovered CLO acidwash image missing')
    garment=bpy.data.objects.get('MIKRISTIAN_501_W32L32_Manifold_Fit_Shell')
    if not garment:raise RuntimeError('The archived 501 on-body shell is missing')
    image=bpy.data.images.load(str(wash),check_existing=True)
    denim=make_washed_denim(image)
    apply_uv(garment.data)
    garment.data.materials.clear();garment.data.materials.append(denim)
    for f in garment.data.polygons:f.use_smooth=True
    garment['original_wash_asset']='PANTS TEXTURE.png inside REFERENCE_acidwash_pants_before_sim.zprj / nested ZPAC'
    garment['status']='re-rendered saved W32 L32 on-body static fit shell; not fresh CLO simulation'

    gray=make_mat('Warm grey cotton body / fitting mannequin',(.60,.55,.50),.98)
    for ob in bpy.data.objects:
        if ob.type=='MESH' and 'avatar' in [m.name.lower() for m in ob.data.materials if m]:
            ob.data.materials.clear();ob.data.materials.append(gray)
    gold=make_mat('Antique tobacco contrast stitching',(.66,.40,.17),.78)
    add_jeans_stitches(garment,gold)
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1100
    scene.render.resolution_y=1300
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.render.film_transparent=False
    # Keep the prior original 3D geometry and add balanced light for acidwash fabric.
    for ob in list(bpy.data.objects):
        if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
    for name,pos,energy,size in [
        ('Key softbox',(1.6,-2.2,2.7),900,2.0),
        ('Rim softbox',(-1.8,1.0,2.3),1200,2.2),
        ('Left fill',(-1.7,-2.1,1.7),450,2.6)]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        lamp=bpy.context.object;lamp.name=name;lamp.data.energy=energy;lamp.data.shape='DISK';lamp.data.size=size
        look_at(lamp,(0,0,1.0))
    cam=scene.camera or bpy.data.objects.get('Full body camera')
    if cam is None:
        bpy.ops.object.camera_add();cam=bpy.context.object
        scene.camera=cam
    cam.data.type='ORTHO';cam.data.ortho_scale=2.17
    scene['original_saved_jeans_geometry']=True
    scene['recovered_clo_acidwash_image']=str(wash)
    scene['new_clo_simulation_performed']=False
    shots={}
    for side,xyz in [('front',(0,-3.3,1.11)),('back',(0,3.3,1.11)),('threequarter',(2.35,-2.7,1.25))]:
        cam.location=xyz
        look_at(cam,(0,0,.96))
        path=out / f'501_W32L32_ORIGINAL_ACIDWASH_ON_BODY_{side}.png'
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        shots[side]=str(path)
    blend=out/'501_W32L32_ORIGINAL_ACIDWASH_ON_BODY_RE-RENDER.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    result={'status':'rendered from preserved Blender on-body fit geometry plus original CLO acidwash source',
            'renderImages':shots,'blend':str(blend),'garmentFaces':len(garment.data.polygons),
            'CLOSimulationCompleted':False,'newPhysicsSimulation':False,'sourceAcidwash':str(wash)}
    (out/'501_WashedJeans_Rerender_Report.json').write_text(json.dumps(result,indent=2)+'\n')
    print('RENDERED_501_ACIDWASH='+json.dumps(result))

if __name__=='__main__':
    import sys
    ap=argparse.ArgumentParser()
    ap.add_argument('--wash',required=True);ap.add_argument('--out',required=True)
    a=sys.argv;main(ap.parse_args(a[a.index('--')+1:] if '--' in a else []))
