"""Export only the completed 3D jeans placement mesh as an OBJ reference.

This does not transform the OBJ into CLO patterns or simulation data.
Input .blend is supplied as Blender's opening positional argument.
"""
import json
from pathlib import Path
import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0]).expanduser().resolve()
obj = bpy.data.objects.get('501 Straight Jeans | Joined On-Body Envelope')
if not obj or obj.type != 'MESH':
    raise RuntimeError('Jeans envelope mesh missing')
bpy.ops.object.select_all(action='DESELECT')
obj.hide_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.wm.obj_export(filepath=str(out), export_selected_objects=True, export_materials=True)
print(json.dumps({'exportedObj': str(out), 'faces': len(obj.data.polygons),
                  'purpose':'CLO3D arrangement reference only; not a sewn/simulated garment'}))
