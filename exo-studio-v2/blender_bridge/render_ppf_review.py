"""Render saved simulation geometry without altering its solve or source file."""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]);out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
scene.frame_set(scene.frame_end)
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='OBJECT'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD'
scene.world.color=(.12,.12,.12)
scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
for obj in scene.objects:
 if obj.type=='MESH':
  obj.color=(.22,.48,.65,1) if obj.name.startswith('PPF_Garment') else (.59,.45,.35,1)
cam=bpy.data.objects.new('ReviewCamera',bpy.data.cameras.new('ReviewCamera'))
scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.35
for name,location in [('front',(0,-4,1.25)),('back',(0,4,1.25)),('side',(4,0,1.25))]:
 cam.location=location;cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
