import bpy
from pathlib import Path
root=Path(__file__).resolve().parent.parent
src=root/'public/avatars/clo-thomas.glb'
dst=root/'native_app/assets/clo-thomas.obj'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(src))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
print('Imported meshes:',[(o.name,len(o.data.vertices)) for o in meshes])
# Existing GLB was filtered to avatar nodes; no clothing should be included.
for o in bpy.context.scene.objects:o.select_set(o.type=='MESH' and (o.name.startswith(('body_mesh','hair_mesh','shoes_','eye_','eyelash_','tooth_mesh'))))
if meshes:
 bpy.context.view_layer.objects.active=meshes[0]
 bpy.ops.wm.obj_export(filepath=str(dst),export_selected_objects=True,export_materials=False,apply_modifiers=True)
 print('EXPORTED',dst,dst.stat().st_size)
