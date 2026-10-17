"""Export user-owned EXO Blender rooms as GLB, with measured scene metadata."""
import bpy
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root / 'docs/research/clo-connect-community/blender-scenes'
destination = root / 'public/stage-scenes'
destination.mkdir(parents=True, exist_ok=True)
records = []

for path in sorted(source.glob('EXO_STAGE_*.blend')):
    name = path.stem
    stage_id = name.removeprefix('EXO_STAGE_')
    try:
        bpy.ops.wm.open_mainfile(filepath=str(path))
        mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
        polygons = sum(len(o.data.polygons) for o in mesh_objects)
        materials = len({m.name for o in mesh_objects for m in o.data.materials if m})
        lights = sum(o.type == 'LIGHT' for o in bpy.data.objects)
        if len(mesh_objects) < 5 or polygons < 50:
            raise ValueError(f'insufficient geometry: {len(mesh_objects)} meshes, {polygons} polygons')
        bpy.ops.object.select_all(action='DESELECT')
        for obj in mesh_objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_objects[0]
        target = destination / f'{stage_id}.glb'
        bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
            export_apply=True, export_yup=True, export_lights=False, export_cameras=False,
            export_animations=False)
        records.append(dict(id=stage_id, file=f'/stage-scenes/{stage_id}.glb',
            bytes=target.stat().st_size, meshes=len(mesh_objects), polygons=polygons,
            materials=materials, lights=lights, status='ready',
            source=str(path.relative_to(root)), provenance='EXO original Blender scene'))
        print('EXPORTED', stage_id, len(mesh_objects), polygons, target.stat().st_size, flush=True)
    except Exception as exc:
        records.append(dict(id=stage_id, status='unavailable', error=str(exc), source=str(path.relative_to(root))))
        print('FAILED', stage_id, exc, flush=True)

(destination / 'manifest.json').write_text(json.dumps(dict(schemaVersion=1, stages=records), indent=2) + '\n')
print('MANIFEST', len(records), sum(r['status'] == 'ready' for r in records), flush=True)
