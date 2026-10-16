"""Export last fetched PPF PC2 frame as a standalone Blender OBJ garment."""
import argparse
from pathlib import Path
import sys

import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from ppf_run_configured import mesh_cache_path,read_pc2,solver_to_blender

raw=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument('--output',required=True)
args=p.parse_args(raw)
obj=bpy.data.objects.get('PPF_Garment')
if obj is None: raise RuntimeError('PPF_Garment object missing from solved .blend')
cache_path=mesh_cache_path(obj)
if not cache_path or not Path(cache_path).is_file():
    raise RuntimeError(f'No saved PPF point cache found: {cache_path}')
pc2=read_pc2(cache_path)
if pc2['vertices']!=len(obj.data.vertices):
    raise RuntimeError('PC2 and garment vertex counts disagree')
last=solver_to_blender(pc2['array'][-1])
obj.data.vertices.foreach_set('co',last.astype('float32').reshape(-1))
obj.data.update()
for mod in list(obj.modifiers):
    if mod.type=='MESH_CACHE':obj.modifiers.remove(mod)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active=obj
out=Path(args.output).resolve()
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.obj_export(filepath=str(out),export_selected_objects=True)
print('PPF_EXPORTED_OBJ',str(out),len(obj.data.vertices),len(obj.data.polygons))
