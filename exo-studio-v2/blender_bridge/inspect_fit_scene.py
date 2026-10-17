import bpy, json
from mathutils import Vector
out=[]
for obj in bpy.data.objects:
    if obj.type != 'MESH' or obj.hide_render: continue
    bounds=[obj.matrix_world @ Vector(p) for p in obj.bound_box]
    out.append(dict(name=obj.name, parent=obj.parent.name if obj.parent else '',
        collection=[c.name for c in obj.users_collection],
        min=[round(min(v[i] for v in bounds),4) for i in range(3)],
        max=[round(max(v[i] for v in bounds),4) for i in range(3)],
        scale=[round(v,4) for v in obj.scale]))
print('FIT_VISIBLE_MESHES='+json.dumps(out))
