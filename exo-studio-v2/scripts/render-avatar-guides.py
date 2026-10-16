"""Render 2D drafting silhouettes from Garment Studio's installed avatar meshes.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    --python scripts/render-avatar-guides.py

The guide is generated entirely from each installed 3D model, never a generic
human icon.  Outputs are neutral, transparent front orthographic PNGs, used
only as background drafting guides (not collider meshes).
"""
from pathlib import Path
import os
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'clo-thomas': ROOT / 'public/avatars/clo-thomas.glb',
    'theo': ROOT / 'public/avatars/opensew/theo.glb',
    'nora': ROOT / 'public/avatars/opensew/nora.glb',
    'makehuman-base': ROOT / 'public/avatars/makehuman-base.obj',
}
OUTPUT = ROOT / 'public/avatars/guides'
OUTPUT.mkdir(parents=True, exist_ok=True)

def world_bounds(objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return ([min(v[i] for v in corners) for i in range(3)],
            [max(v[i] for v in corners) for i in range(3)])

def render(name, source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix == '.obj':
        bpy.ops.wm.obj_import(filepath=str(source))
    else:
        bpy.ops.import_scene.gltf(filepath=str(source))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not objects:
        raise RuntimeError(f'{name} has no mesh objects')
    for mesh in objects:
        # Neutral grayscale folds and contours are more readable than black
        # cutouts behind selected pattern panels.
        mat = bpy.data.materials.new('Draft Figure Gray')
        mat.diffuse_color = (.51, .56, .62, 1)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (.51, .56, .62, 1)
        bsdf.inputs['Roughness'].default_value = .9
        mesh.data.materials.clear()
        mesh.data.materials.append(mat)
        for polygon in mesh.data.polygons:
            polygon.material_index = 0
    bpy.context.view_layer.update()
    low, high = world_bounds(objects)
    center = Vector([(low[0]+high[0])/2, (low[1]+high[1])/2, (low[2]+high[2])/2])
    height = high[2]-low[2]
    width = high[0]-low[0]
    if height <= 0:
        raise RuntimeError(f'Invalid avatar height: {name}')

    cam_data = bpy.data.cameras.new('2D Figure Orthographic Camera')
    cam = bpy.data.objects.new('2D Figure Orthographic Camera', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = center + Vector([0,-max(height*2,4),0])
    target = center
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = height*1.1
    bpy.context.scene.camera = cam

    def area(location, size, energy):
        data = bpy.data.lights.new('Draft Lighting','AREA')
        obj = bpy.data.objects.new('Draft Lighting',data)
        bpy.context.collection.objects.link(obj)
        obj.location = center + Vector(location)*height
        obj.rotation_euler = (center-obj.location).to_track_quat('-Z','Y').to_euler()
        # MakeHuman OBJ is authored at ~17 source units tall while GLBs are
        # ~2 units; inverse-square light falloff otherwise makes it black.
        data.energy=energy*max(.8,(height/2.0)**2)
        data.shape='DISK'
        data.size=size*height
    area((-1,-2,1),1.2,450)
    area((1,-1.5,0),1.5,230)
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.film_transparent=True
    scene.render.resolution_x=380
    scene.render.resolution_y=760
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='Standard'
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=str(OUTPUT/f'{name}.png')
    scene.camera.data.lens=50
    scene.render.image_settings.color_depth='8'
    bpy.ops.render.render(write_still=True)
    print('AVATAR_GUIDE',name,'vertices',sum(len(obj.data.vertices) for obj in objects),
          'height',round(height,3),'width',round(width,3),'output',scene.render.filepath)

for key, source in SOURCES.items():
    if os.environ.get('GUIDE_MODELS') and key not in os.environ['GUIDE_MODELS'].split(','):
        continue
    if source.is_file():
        try:
            render(key,source)
        except Exception as exc:
            print('AVATAR_GUIDE_ERROR',key,str(exc))
    else:
        print('AVATAR_GUIDE_MISSING',key,str(source))
