"""Render raw reference output in a separate background Blender scene."""
import argparse,json,sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--run-report',required=True);p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
run=json.loads(Path(a.run_report).read_text());assert run['ok'], 'Reference must complete before rendering final'
session=Path(run['sessionPath'])
files=sorted((session/'output').glob('vert_*.bin'),key=lambda f:int(f.stem.split('_')[1]))
verts=np.fromfile(files[-1],dtype='<f4').reshape(-1,3)
verts=verts[:,[0,2,1]].copy();verts[:,1]*=-1
faces=np.fromfile(session/'bin/tri.bin',dtype='<u8').reshape(-1,3)
pins=np.fromfile(session/'bin/pin-ind-0.bin',dtype='<u8')
mask=np.zeros(len(verts),dtype=bool);mask[pins]=True
body=np.all(mask[faces],axis=1)
bpy.ops.wm.read_factory_settings(use_empty=True)
for name,selected,color in [('Upstream dress',~body,(.22,.09,.44,1)),('Pinned animated body',body,(.55,.56,.58,1))]:
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts.tolist(),[],faces[selected].tolist());mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    material=bpy.data.materials.new(name);material.diffuse_color=color;material.use_nodes=True
    material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
    material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.7
    obj.data.materials.append(material)
    for poly in mesh.polygons:poly.use_smooth=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Reference neutral world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.14,.17,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
center=Vector(((verts.min(axis=0)+verts.max(axis=0))/2).tolist());extent=float(np.max(np.ptp(verts,axis=0)))
for name,offset,energy in [('Key',(2,-3,4),500),('Fill',(-3,-1,2),300),('Rim',(1,3,3),450)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=3
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=center+Vector(offset)
    obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Camera');camera.type='ORTHO';camera.ortho_scale=extent*1.25
obj=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(obj);scene.camera=obj
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
for label,direction in [('front',(0,-4,1)),('side',(4,0,1)),('back',(0,4,1))]:
    obj.location=center+Vector(direction)*extent
    obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'lastFrame':files[-1].name,'renders':str(out),'source':'raw native output; upstream dress, not Thomas tee'}))
