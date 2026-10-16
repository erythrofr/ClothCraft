"""Body-mesh / tee-shell PPF Contact Solver workflow using the installed add-on.

Run through Blender, not system Python:

 blender -b --factory-startup --python blender_bridge/ppf_body_tee_pipeline.py -- \
   --body public/avatars/makehuman-base.obj --garment path/to/tee.obj \
   --output blender_bridge/output/tee-on-body.blend --placement front

This prepares an independently editable, PPF-configured .blend. Add --run with
--runtime to invoke the existing PPF Metal runner and export solved .obj.
Placement 'front' guarantees separated bounding boxes for a contact demo, not
wearable shirt fit; 'around' is for an already aligned *closed* garment shell.
We abort if imported surfaces are intersecting at the start.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ppf_headless import ensure_ppf_registered
from ppf_prepare_scene import clear_scene_objects_preserve_addons


def arguments():
    raw = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(description='Configure and optionally solve an imported T-shirt against an imported body mesh using PPF')
    p.add_argument('--body', type=Path, required=True, help='OBJ or GLB body mesh (not CLO .avt)')
    p.add_argument('--garment', type=Path, required=True, help='OBJ or GLB garment mesh; sewn/correctly placed for around mode')
    p.add_argument('--body-name', default='', help='Optional case-insensitive mesh-name substring to exclude accessories and hair')
    p.add_argument('--output', type=Path, required=True, help='Configured .blend or solved .blend when --run')
    p.add_argument('--report', type=Path, help='JSON report path, default <output>.report.json')
    p.add_argument('--placement', choices=['front', 'around'], default='front')
    p.add_argument('--body-height-m', type=float, default=1.80, help='Scale body mesh uniformly to this world height')
    p.add_argument('--garment-scale', type=float, default=1.0)
    p.add_argument('--clearance-m', type=float, default=.03)
    p.add_argument('--pin-group', default='PPF_Shoulder_Pins', help='Vertex group created or reused on tee')
    p.add_argument('--pin-indices', default='', help='Optional comma-separated vertex indices')
    p.add_argument('--auto-pin-top-pct', type=float, default=4.0, help='Only used when pin-indices are not provided and group has no members')
    p.add_argument('--density-kg-m2', type=float, default=.22, help='Cloth surface mass density, e.g. 220gsm = 0.22kg/m²')
    p.add_argument('--young-normalized', type=float, default=5500.0, help='PPF calibrated/normalized Shell Young modulus (NOT direct textbook Pa)')
    p.add_argument('--poisson', type=float, default=.35)
    p.add_argument('--bend', type=float, default=4.3)
    p.add_argument('--friction', type=float, default=.35)
    p.add_argument('--strain-limit-pct', type=float, default=5.0)
    p.add_argument('--frames', type=int, default=10)
    p.add_argument('--run', action='store_true')
    p.add_argument('--runtime', type=Path, default=HERE.parent / 'research/ppf-local/runtime/ppf-contact-solver-2026-09-22-20-52-macos-arm64')
    p.add_argument('--port', type=int, default=19096)
    p.add_argument('--run-timeout', type=int, default=240)
    return p.parse_args(raw)


def load_mesh(path: Path, name: str):
    path = path.resolve()
    if not path.is_file() or path.suffix.lower() not in ('.obj', '.glb'):
        raise ValueError(f'{name} must be an existing .obj or .glb: {path}')
    before = set(bpy.data.objects)
    if path.suffix.lower() == '.obj':
        bpy.ops.wm.obj_import(filepath=str(path))
    else:
        bpy.ops.import_scene.gltf(filepath=str(path))
    result = [obj for obj in bpy.data.objects if obj not in before and obj.type == 'MESH']
    if not result:
        raise ValueError(f'{name} did not import any mesh objects from {path}')
    return result


def bounds(objects):
    coords = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (Vector(tuple(min(p[d] for p in coords) for d in range(3))),
            Vector(tuple(max(p[d] for p in coords) for d in range(3))))


def offset(objects, delta):
    for obj in objects:
        obj.location += delta
    bpy.context.view_layer.update()


def body_normalize(objects, target_height):
    low, high = bounds(objects)
    height = high.z - low.z
    if height < .01:
        raise ValueError(f'Body bounds are degenerate: {low} / {high}')
    factor = target_height / height
    for obj in objects:
        obj.scale *= factor
        obj.location *= factor
    bpy.context.view_layer.update()
    low, high = bounds(objects)
    offset(objects, Vector((-(low.x+high.x)*.5,-(low.y+high.y)*.5,-low.z)))
    return factor


def freeze_imported_body(bodies):
    """Bake a skinned GLB's current rest pose into static vertex geometry.

    PPF STATIC explicitly rejects armature/shape-key deformation unless a
    deformation cache is captured. For a fixed fitting mannequin we want the
    evaluated shape at frame 1, detached from its rig.
    """
    bpy.context.scene.frame_set(1)
    graph=bpy.context.evaluated_depsgraph_get()
    graph.update()
    for obj in bodies:
        transform=obj.matrix_world.copy()
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(graph),preserve_all_data_layers=True,depsgraph=graph)
        obj.parent=None
        obj.matrix_world=transform
        obj.modifiers.clear()
        obj.data=mesh
    bpy.context.view_layer.update()


def join_garment(objects):
    if len(objects) == 1:
        obj = objects[0]
    else:
        bpy.ops.object.select_all(action='DESELECT')
        for item in objects:
            item.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
    obj.name = 'PPF_Garment'
    return obj


def verify_no_initial_intersections(cloth, bodies):
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    cloth_tree = BVHTree.FromObject(cloth, graph)
    by_body = {}
    for body in bodies:
        if body == cloth:
            continue
        overlap = cloth_tree.overlap(BVHTree.FromObject(body, graph))
        if overlap:
            by_body[body.name] = len(overlap)
    return by_body


def count_nonadjacent_cloth_self_intersections(cloth):
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    tree = BVHTree.FromObject(cloth, graph)
    polygons = [set(p.vertices) for p in cloth.data.polygons]
    pairs = set()
    for left, right in tree.overlap(tree):
        if left >= right or left >= len(polygons) or right >= len(polygons):
            continue
        if polygons[left].isdisjoint(polygons[right]):
            pairs.add((left, right))
    return len(pairs)


def configure_pins(obj, args):
    group = obj.vertex_groups.get(args.pin_group) or obj.vertex_groups.new(name=args.pin_group)
    if args.pin_indices.strip():
        ids = [int(i) for i in args.pin_indices.split(',') if i.strip()]
    else:
        ids = []
        for v in obj.data.vertices:
            try:
                if group.weight(v.index) > 0:
                    ids.append(v.index)
            except RuntimeError:
                pass
        if not ids:
            low, high = bounds([obj])
            cutoff = high.z - (high.z - low.z) * args.auto_pin_top_pct / 100
            ids = [v.index for v in obj.data.vertices
                   if (obj.matrix_world @ v.co).z >= cutoff]
    ids = sorted(set(ids))
    if not ids or any(i < 0 or i >= len(obj.data.vertices) for i in ids):
        raise ValueError('No valid shoulder pin indices. Set --pin-indices or choose a nonempty vertex group.')
    group.add(ids,1.0,'REPLACE')
    return ids


def configure_ppf(cloth, bodies, args, pin_ids):
    from bl_ext.user_default.ppf_contact_solver.ops.api import solver
    from bl_ext.user_default.ppf_contact_solver.models.groups import get_addon_data
    solver.clear()
    shell = solver.create_group('Imported T-Shirt SHELL', type='SHELL')
    shell.add(cloth.name)
    static = solver.create_group('Imported Body STATIC', type='STATIC')
    static.add(*[obj.name for obj in bodies])
    shell.param.shell_density = args.density_kg_m2
    shell.param.shell_young_modulus = args.young_normalized
    # This switch is a group RNA property but not exposed by _MaterialParams
    # in the installed add-on facade. The API proxy owns a verified _get_group.
    shell._get_group().young_mod_density_normalized = True
    shell.param.shell_poisson_ratio = args.poisson
    shell.param.bend = args.bend
    shell.param.friction = args.friction
    shell.param.enable_strain_limit = True
    shell.param.strain_limit_percent = args.strain_limit_pct
    shell.create_pin(cloth.name,args.pin_group)
    root = get_addon_data(bpy.context.scene)
    root.state.frame_count = args.frames
    root.state.frame_rate = 60
    root.state.step_size = .004
    root.state.gravity_3d = (0,0,-9.81)
    root.state.disable_contact = False
    root.state.contact_nnz = 4000000
    root.state.line_search_max_t = 1.0
    root.state.air_density = 0
    root.state.wind_strength = 0
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = args.frames
    solver.param.frame_count = args.frames
    solver.param.frame_rate = 60
    solver.param.step_size = .004
    solver.param.gravity = (0,0,-9.81)
    return {'shellGroup':shell.name,'staticGroup':static.name,'pinGroup':args.pin_group,'pins':len(pin_ids)}


def main():
    args=arguments()
    if args.body_height_m <= 0 or args.garment_scale <= 0 or args.density_kg_m2 <= 0:
        raise ValueError('Positive body height, garment scale and fabric density required')
    if not (0 < args.poisson < .5 and 0 < args.strain_limit_pct <= 100 and 1 <= args.frames <= 500):
        raise ValueError('Poisson must be 0..0.5, strain limit 0..100, frames 1..500')
    ensure_ppf_registered()
    clear_scene_objects_preserve_addons()
    all_body=load_mesh(args.body,'Body')
    bodies=[obj for obj in all_body if args.body_name.lower() in obj.name.lower()] if args.body_name else all_body
    if not bodies:
        raise ValueError(f'No body mesh with --body-name {args.body_name!r}')
    # Hide unrelated GLB accessories when a specific body component is chosen.
    for item in all_body:
        if item not in bodies: bpy.data.objects.remove(item,do_unlink=True)
    freeze_imported_body(bodies)
    body_scale=body_normalize(bodies,args.body_height_m)
    garment=join_garment(load_mesh(args.garment,'Garment'))
    garment.scale *= args.garment_scale
    bpy.context.view_layer.update()
    if args.placement == 'front':
        body_low, _ = bounds(bodies)
        cloth_low,cloth_high = bounds([garment])
        # Blender front is the negative Y direction. Separate entire bbox to
        # make the first frame contact-safe; only a front-panel drape demo.
        offset([garment],Vector((-(cloth_low.x+cloth_high.x)/2 - (body_low.x+bounds(bodies)[1].x)/2,
            body_low.y-cloth_high.y-args.clearance_m,
            max(0.0, bounds(bodies)[1].z*.64-(cloth_low.z+cloth_high.z)/2))))
    overlap=verify_no_initial_intersections(garment,bodies)
    if overlap:
        raise RuntimeError('Starting cloth/body surfaces intersect: '+json.dumps(overlap)+'. Move the garment outwards or use --placement front; a contact guarantee requires valid initialization.')
    self_intersections=count_nonadjacent_cloth_self_intersections(garment)
    if self_intersections:
        raise RuntimeError(f'Garment has {self_intersections} nonadjacent self-intersecting triangle pairs BEFORE solving. Repair/snap the sewn mesh and stage it without overlap first.')
    pin_ids=configure_pins(garment,args)
    result=configure_ppf(garment,bodies,args,pin_ids)
    out=args.output.expanduser().resolve()
    out.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.scene['garment_studio_source_body']=str(args.body.resolve())
    bpy.context.scene['garment_studio_source_tee']=str(args.garment.resolve())
    bpy.context.scene['garment_studio_body_fitting_mode']=args.placement
    configured=out.with_name(out.stem+'-configured.blend') if args.run else out
    bpy.ops.wm.save_as_mainfile(filepath=str(configured))
    data={'configured':True,'body':str(args.body.resolve()),'garment':str(args.garment.resolve()),
          'placement':args.placement,'bodyScale':body_scale,
          'bodyMeshes':len(bodies),'garmentVertices':len(garment.data.vertices),
          'garmentFaces':len(garment.data.polygons),'initialIntersections':overlap,
          'initialClothSelfIntersections':self_intersections,
          'densityKgM2':args.density_kg_m2,'youngNormalized':args.young_normalized,
          'poisson':args.poisson,'strainLimitPct':args.strain_limit_pct,
          'configuredBlend':str(configured),**result}
    report=args.report or out.with_suffix('.report.json')
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps(data,indent=2))
    print('PPF_BODY_TEE_CONFIGURED',json.dumps(data))
    if args.run:
        result_report=out.with_name(out.stem+'-solver-report.json')
        command=[bpy.app.binary_path,'-b',str(configured),'--python',
                 str(HERE/'ppf_run_configured.py'),'--',
                 '--runtime',str(args.runtime.resolve()),'--output',str(out),
                 '--report',str(result_report),'--device','GPU','--port',str(args.port),
                 '--run-timeout',str(args.run_timeout)]
        subprocess.run(command,check=True)
        solver_data=json.loads(result_report.read_text()) if result_report.is_file() else {}
        if not solver_data.get('ok') or not out.is_file():
            raise RuntimeError('PPF did not produce a completed solve: '+str(solver_data.get('error','missing output or report')))
        export_cmd=[bpy.app.binary_path,'-b',str(out),'--python',
                    str(HERE/'ppf_export_frame.py'),'--','--output',str(out.with_suffix('.obj'))]
        subprocess.run(export_cmd,check=True)
        data['solvedBlend']=str(out)
        data['solvedObj']=str(out.with_suffix('.obj'))
        data['solverReport']=str(result_report)
        report.write_text(json.dumps(data,indent=2))

if __name__=='__main__':
    main()
