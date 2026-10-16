"""Diagnostic only: imported static-body meshes/bounds for accurate cloth collision."""
import bpy,json,sys
from mathutils import Vector
source=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'public/avatars/clo-thomas.glb'
bpy.ops.import_scene.gltf(filepath=source)
scene=[]
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 pts=[obj.matrix_world@Vector(p) for p in obj.bound_box]
 low=[min(p[i] for p in pts) for i in range(3)]
 high=[max(p[i] for p in pts) for i in range(3)]
 scene.append({'name':obj.name,'verts':len(obj.data.vertices),'faces':len(obj.data.polygons),'low':low,'high':high,'dims':[(high[i]-low[i]) for i in range(3)],'mods':[m.type for m in obj.modifiers]})
print('BODY_COLLISION_INSPECTION='+json.dumps(scene))
