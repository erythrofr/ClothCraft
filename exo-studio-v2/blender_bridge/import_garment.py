import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ppf_shell import build_welded_shell


def parse_args():
    raw = sys.argv
    args = raw[raw.index('--') + 1:] if '--' in raw else []
    parser = argparse.ArgumentParser(description='Import a Garment Studio document into Blender')
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--render')
    parser.add_argument('--simulation-result')
    parser.add_argument('--simulation-payload')
    parser.add_argument('--no-avatar', action='store_true')
    parser.add_argument('--avatar-proxy', action='store_true', help='Use a neutral measurement-driven full-body avatar proxy for fit visualization.')
    parser.add_argument('--render-welded-shell', action='store_true', help='Render the on-body welded XPBD shell when all sewing relationships can be welded.')
    return parser.parse_args(args)


def hex_rgba(value, alpha=1.0):
    value = str(value or '#808080').strip().lstrip('#')
    if len(value) == 3:
        value = ''.join(c * 2 for c in value)
    try:
        r, g, b = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    except Exception:
        r = g = b = 0.5
    # simple display -> linear approximation is fine for bridge preview
    return (r, g, b, alpha)


def ensure_collection(name, parent=None):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
    target_parent = parent or bpy.context.scene.collection
    if collection.name not in target_parent.children:
        target_parent.children.link(collection)
    return collection


def link_only(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)


def quadratic(a, b, c, t):
    mt = 1.0 - t
    return (
        mt * mt * a[0] + 2 * mt * t * c[0] + t * t * b[0],
        mt * mt * a[1] + 2 * mt * t * c[1] + t * t * b[1],
    )


def sampled_boundary(piece, segments=8):
    points = piece.get('points') or []
    curves = piece.get('curves') or {}
    result = []
    for i, a in enumerate(points):
        b = points[(i + 1) % len(points)]
        curve = curves.get(str(i), curves.get(i))
        if curve:
            c = (float(curve.get('cx', 0)), float(curve.get('cy', 0)))
            for step in range(segments):
                result.append(quadratic((a['x'], a['y']), (b['x'], b['y']), c, step / segments))
        else:
            result.append((float(a['x']), float(a['y'])))
    return result


def make_material(name, fabric):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = hex_rgba(fabric.get('color', '#808080'))
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = material.diffuse_color
        bsdf.inputs['Roughness'].default_value = 0.72
        bsdf.inputs['Metallic'].default_value = 0.0
    material['garment_fabric_id'] = fabric.get('id', name)
    for key in ['gsm', 'stretchWarp', 'stretchWeft', 'shrinkWarp', 'shrinkWeft', 'bend', 'damping', 'friction', 'thickness']:
        if key in fabric:
            material[f'garment_{key}'] = fabric[key]
    return material


def make_polygon_object(name, boundary_cm, collection, material=None, vertical=False):
    if vertical:
        vertices = [(x * 0.01, 0.0, y * 0.01) for x, y in boundary_cm]
    else:
        vertices = [(x * 0.01, y * 0.01, 0.0) for x, y in boundary_cm]
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], [list(range(len(vertices)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def make_simulation_object(name, vertices_world, faces, collection, material=None):
    # Garment Studio world: X horizontal, Y vertical, Z depth.
    # Blender world: X horizontal, Y depth, Z vertical.
    vertices = [(float(v[0]), -float(v[2]), float(v[1])) for v in vertices_world]
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], [list(face) for face in faces])
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def arrangement_location(arr):
    # Garment Studio: X horizontal, Y vertical, Z depth. Blender: X, Y depth, Z vertical.
    return (float(arr.get('x', 0)), -float(arr.get('z', 0)), float(arr.get('y', 0)))


def add_custom_metadata(obj, piece):
    obj['garment_piece_id'] = piece.get('id', '')
    obj['garment_piece_name'] = piece.get('name', '')
    obj['garment_fabric_id'] = piece.get('fabricId', 'main')
    obj['garment_layer_index'] = int(piece.get('layerIndex', 0) or 0)
    obj['garment_seam_allowance_cm'] = float(piece.get('seamAllowance', 0) or 0)
    obj['garment_role'] = piece.get('generatedRole', 'shell')
    if piece.get('fusedToPieceId'):
        obj['garment_fused_to_piece_id'] = piece['fusedToPieceId']
    if piece.get('liningForPieceId'):
        obj['garment_lining_for_piece_id'] = piece['liningForPieceId']


def edge_midpoint_cm(piece, edge_index):
    points = piece.get('points') or []
    if not points:
        return (0.0, 0.0)
    i = int(edge_index) % len(points)
    a = points[i]
    b = points[(i + 1) % len(points)]
    curve = (piece.get('curves') or {}).get(str(i))
    if curve:
        return quadratic((a['x'], a['y']), (b['x'], b['y']), (curve['cx'], curve['cy']), 0.5)
    return ((a['x'] + b['x']) * 0.5, (a['y'] + b['y']) * 0.5)


def point_on_3d_piece(obj, point_cm):
    local = Vector((float(point_cm[0]) * 0.01, 0.0, float(point_cm[1]) * 0.01))
    return obj.matrix_world @ local


def make_line(name, a, b, collection, color=(0.25, 0.55, 1.0, 1.0), radius=0.0018):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(1)
    spline.points[0].co = (*a, 1.0)
    spline.points[1].co = (*b, 1.0)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    material = bpy.data.materials.get('Seam_Material') or bpy.data.materials.new('Seam_Material')
    material.diffuse_color = color
    obj.data.materials.append(material)
    return obj


def add_ellipsoid(name, location, scale, collection, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    link_only(obj, collection)
    return obj


def create_avatar_proxy(avatar, collection):
    height_scale = float(avatar.get('heightCm', 180) or 180) / 180.0
    chest_scale = float(avatar.get('chestCm', 96) or 96) / 96.0
    waist_scale = float(avatar.get('waistCm', 78) or 78) / 78.0
    hip_scale = float(avatar.get('hipCm', 94) or 94) / 94.0
    mat = bpy.data.materials.new('Avatar_Material')
    mat.diffuse_color = (0.18, 0.19, 0.21, 1.0)
    torso = add_ellipsoid('Avatar_Torso', (0, 0, 1.12 * height_scale), (0.20 * chest_scale, 0.13, 0.46 * height_scale), collection, mat)
    pelvis = add_ellipsoid('Avatar_Pelvis', (0, 0, 0.76 * height_scale), (0.19 * hip_scale, 0.14, 0.23 * height_scale), collection, mat)
    head = add_ellipsoid('Avatar_Head', (0, 0, 1.83 * height_scale), (0.14, 0.13, 0.18 * height_scale), collection, mat)
    neck = add_ellipsoid('Avatar_Neck', (0, 0, 1.64 * height_scale), (0.075, 0.07, 0.13 * height_scale), collection, mat)
    for side in (-1, 1):
        add_ellipsoid(f'Avatar_Leg_{side}', (0.105 * side, 0, 0.31 * height_scale), (0.085, 0.095, 0.45 * height_scale), collection, mat)
        add_ellipsoid(f'Avatar_Arm_{side}', (0.37 * side * chest_scale, 0, 1.18 * height_scale), (0.065, 0.07, 0.37 * height_scale), collection, mat)
    torso['avatar_waist_scale'] = waist_scale
    return head


def create_detailed_avatar(avatar, collection, source_path, visual_id='makehuman-base'):
    source_path = Path(source_path)
    if not source_path.exists():
        return None

    before = set(bpy.data.objects)
    try:
        if source_path.suffix.lower() in {'.glb', '.gltf'}:
            bpy.ops.import_scene.gltf(filepath=str(source_path))
        else:
            bpy.ops.wm.obj_import(filepath=str(source_path))
    except Exception as exc:
        print(f'WARN detailed avatar import failed: {exc}', file=sys.stderr)
        return None

    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == 'MESH']
    if not meshes:
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
        return None

    root = bpy.data.objects.new('Avatar_Detailed', None)
    collection.objects.link(root)
    for obj in imported:
        link_only(obj, collection)
    imported_set = set(imported)
    for obj in imported:
        # Preserve GLB skinning hierarchy (body -> armature). Only parent the
        # imported roots to our Garment Studio transform root.
        if obj.parent not in imported_set:
            obj.parent = root

    mat = bpy.data.materials.new('Avatar_Detailed_Material')
    mat.diffuse_color = (0.38, 0.39, 0.41, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = mat.diffuse_color
        bsdf.inputs['Roughness'].default_value = 0.7
        bsdf.inputs['Metallic'].default_value = 0.0

    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj['garment_avatar_visual'] = visual_id
        obj['garment_avatar_collision'] = 'analytic-parametric'

    def world_bounds():
        bpy.context.view_layer.update()
        corners = [
            obj.matrix_world @ Vector(corner)
            for obj in meshes
            for corner in obj.bound_box
        ]
        mins = Vector((
            min(point.x for point in corners),
            min(point.y for point in corners),
            min(point.z for point in corners),
        ))
        maxs = Vector((
            max(point.x for point in corners),
            max(point.y for point in corners),
            max(point.z for point in corners),
        ))
        return mins, maxs

    mins, maxs = world_bounds()
    source_height = max(0.001, maxs.z - mins.z)
    target_height = max(1.4, min(2.2, float(avatar.get('heightCm', 180) or 180) / 100.0))
    root.scale = (target_height / source_height,) * 3
    mins, maxs = world_bounds()
    center = (mins + maxs) * 0.5
    root.location.x -= center.x
    root.location.y -= center.y
    root.location.z -= mins.z
    root['garment_avatar_visual'] = visual_id
    root['garment_avatar_collision'] = 'analytic-parametric'
    root['garment_avatar_source'] = str(source_path)
    return root


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def setup_scene(project, render_path=None):
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new('GarmentStudio_World')
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.color = (0.015, 0.015, 0.02)
    scene['garment_project_id'] = project.get('id', '')
    scene['garment_project_name'] = project.get('name', '')
    scene['garment_revision'] = int(project.get('revision', 1) or 1)
    for key, value in (project.get('avatar') or {}).items():
        if isinstance(value, (str, int, float, bool)):
            scene[f'avatar_{key}'] = value
    if render_path:
        scene.render.filepath = str(render_path)


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    render_path = Path(args.render).resolve() if args.render else None
    project = json.loads(input_path.read_text())
    simulation_result = None
    simulation_payload = None
    if args.simulation_result:
        simulation_path = Path(args.simulation_result).resolve()
        simulation_result = json.loads(simulation_path.read_text())
        if simulation_result.get('protocol') != 'garment-studio.native-xpbd-result':
            raise ValueError(f'Unsupported simulation result protocol: {simulation_result.get("protocol")}')
    if args.simulation_payload:
        simulation_payload_path = Path(args.simulation_payload).resolve()
        simulation_payload = json.loads(simulation_payload_path.read_text())

    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene(project, render_path)

    root = ensure_collection('GarmentStudio')
    patterns = ensure_collection('Patterns_2D', root)
    garment = ensure_collection('Garment_3D', root)
    simulation_collection = ensure_collection('Simulation_Result', root) if simulation_result else None
    ppf_collection = ensure_collection('PPF_Final_Shell', root) if simulation_result and simulation_payload else None
    seams_collection = ensure_collection('Sewing_Relationships', root)
    avatar_collection = ensure_collection('Avatar', root)

    fabrics = project.get('fabrics') or {}
    materials = {fid: make_material(f'Fabric_{fid}', {**fabric, 'id': fid}) for fid, fabric in fabrics.items()}
    if 'main' not in materials:
        materials['main'] = make_material('Fabric_main', {'id': 'main', 'color': '#777777'})

    piece_by_id = {}
    object_by_id = {}
    simulated_object_by_id = {}
    simulation_by_id = {piece.get('id'): piece for piece in (simulation_result or {}).get('pieces', [])}
    for index, piece in enumerate(project.get('pieces') or []):
        boundary = sampled_boundary(piece, 10)
        material = materials.get(piece.get('fabricId')) or materials['main']

        layout = piece.get('layout2d') or {}
        boundary_layout = [(x + float(layout.get('x', 0)), y + float(layout.get('y', 0))) for x, y in boundary]
        pattern_obj = make_polygon_object(f'PATTERN_{piece.get("id")}', boundary_layout, patterns, material, vertical=False)
        add_custom_metadata(pattern_obj, piece)
        pattern_obj['garment_view'] = 'pattern_2d'
        pattern_obj.hide_render = True

        garment_obj = make_polygon_object(f'GARMENT_{piece.get("id")}', boundary, garment, material, vertical=True)
        garment_obj.location = arrangement_location(piece.get('arrangement3d') or {})
        if (piece.get('arrangement3d') or {}).get('flip'):
            garment_obj.scale.x *= -1
        add_custom_metadata(garment_obj, piece)
        garment_obj['garment_view'] = 'garment_3d'
        thickness = float((fabrics.get(piece.get('fabricId')) or {}).get('thickness', 0.002) or 0.002)
        solidify = garment_obj.modifiers.new('Fabric Thickness', 'SOLIDIFY')
        solidify.thickness = max(0.0004, min(0.012, thickness))
        solidify.offset = 0.0

        simulated_piece = simulation_by_id.get(piece.get('id'))
        if simulated_piece and simulation_collection:
            garment_obj.hide_render = True
            simulated_obj = make_simulation_object(
                f'SIM_{piece.get("id")}',
                simulated_piece.get('vertices') or [],
                simulated_piece.get('faces') or [],
                simulation_collection,
                material,
            )
            add_custom_metadata(simulated_obj, piece)
            simulated_obj['garment_view'] = 'simulation_result'
            simulated_obj['garment_simulation_backend'] = simulation_result.get('backendId', '')
            simulated_obj['garment_simulation_frames'] = int(simulation_result.get('frames', 0) or 0)
            sim_solidify = simulated_obj.modifiers.new('Fabric Thickness', 'SOLIDIFY')
            sim_solidify.thickness = max(0.0004, min(0.012, thickness))
            sim_solidify.offset = 0.0
            simulated_object_by_id[piece.get('id')] = simulated_obj

        piece_by_id[piece.get('id')] = piece
        object_by_id[piece.get('id')] = garment_obj

    if simulation_result:
        bpy.context.scene['garment_simulation_backend'] = simulation_result.get('backendId', '')
        bpy.context.scene['garment_simulation_frames'] = int(simulation_result.get('frames', 0) or 0)
        for key, value in (simulation_result.get('stats') or {}).items():
            if isinstance(value, (str, int, float, bool)):
                bpy.context.scene[f'garment_sim_{key}'] = value

    if simulation_result and simulation_payload and ppf_collection:
        shell = build_welded_shell(project, simulation_payload, simulation_result)
        if args.render_welded_shell and not shell['ready']:
            raise RuntimeError(f'Cannot render welded shell: {shell["reason"]} / {shell["errors"]}')
        shell_material = None
        if len(shell['fabrics']) == 1:
            shell_material = materials.get(shell['fabrics'][0]) or materials.get('main')
        shell_obj = make_simulation_object(
            'PPF_Final_Shell',
            shell['vertices'],
            shell['faces'],
            ppf_collection,
            shell_material,
        )
        shell_obj['garment_ppf_ready'] = bool(shell['ready'])
        shell_obj['garment_ppf_source_backend'] = simulation_result.get('backendId', '')
        shell_obj['garment_ppf_weld_constraint_count'] = int(shell['weldConstraintCount'])
        shell_obj['garment_ppf_weldable_seams'] = json.dumps(shell['weldableSeamIds'])
        shell_obj['garment_ppf_unsupported_seams'] = json.dumps(shell['unsupportedSeamIds'])
        shell_obj['garment_ppf_fabrics'] = json.dumps(shell['fabrics'])
        shell_obj['garment_ppf_errors'] = json.dumps(shell['errors'])
        shell_obj['garment_ppf_note'] = shell['reason']
        shell_obj.hide_render = not (args.render_welded_shell and shell['ready'])
        if args.render_welded_shell and shell['ready']:
            for sim_object in simulated_object_by_id.values():
                sim_object.hide_render = True
            for polygon in shell_obj.data.polygons:
                polygon.use_smooth = True
            denim_thickness = float((fabrics.get('main') or {}).get('thickness', 0.0029))
            surface_modifier = shell_obj.modifiers.new('Denim Thickness', 'SOLIDIFY')
            surface_modifier.thickness = max(0.0005, min(0.008, denim_thickness))
        bpy.context.scene['garment_ppf_ready'] = bool(shell['ready'])
        bpy.context.scene['garment_ppf_shell_vertices'] = len(shell['vertices'])
        bpy.context.scene['garment_ppf_shell_faces'] = len(shell['faces'])
        bpy.context.scene['garment_ppf_weld_constraints'] = int(shell['weldConstraintCount'])

    # Build seam relationship lines after transforms are established.
    bpy.context.view_layer.update()
    for seam in project.get('seams') or []:
        a = seam.get('a') or {}
        b = seam.get('b') or {}
        piece_a = piece_by_id.get(a.get('pieceId'))
        piece_b = piece_by_id.get(b.get('pieceId'))
        obj_a = object_by_id.get(a.get('pieceId'))
        obj_b = object_by_id.get(b.get('pieceId'))
        if not (piece_a and piece_b and obj_a and obj_b):
            continue
        pa = point_on_3d_piece(obj_a, edge_midpoint_cm(piece_a, a.get('edgeIndex', 0)))
        pb = point_on_3d_piece(obj_b, edge_midpoint_cm(piece_b, b.get('edgeIndex', 0)))
        seam_obj = make_line(f'SEAM_{seam.get("id")}', pa, pb, seams_collection)
        seam_obj.hide_render = True
        seam_obj['garment_seam_id'] = seam.get('id', '')
        seam_obj['garment_seam_type'] = seam.get('type', 'normal')
        seam_obj['garment_piece_a'] = a.get('pieceId', '')
        seam_obj['garment_piece_b'] = b.get('pieceId', '')
        seam_obj['garment_reverse_b'] = bool(seam.get('reverseB', False))

    if not args.no_avatar:
        avatar = project.get('avatar') or {}
        avatar_model = str(avatar.get('model') or 'makehuman-base')
        asset_root = Path(__file__).resolve().parents[1] / 'public' / 'avatars'
        if avatar_model in {'theo', 'nora'}:
            detailed_avatar_path = asset_root / 'opensew' / f'{avatar_model}.glb'
        else:
            avatar_model = 'makehuman-base'
            detailed_avatar_path = asset_root / 'makehuman-base.obj'
        detailed_avatar = None if args.avatar_proxy else create_detailed_avatar(
            avatar, avatar_collection, detailed_avatar_path, visual_id=avatar_model,
        )
        if detailed_avatar is None:
            create_avatar_proxy(avatar, avatar_collection)
            bpy.context.scene['garment_avatar_visual'] = 'analytic-proxy'
        else:
            bpy.context.scene['garment_avatar_visual'] = avatar_model
        bpy.context.scene['garment_avatar_collision'] = 'analytic-parametric'

    # Floor
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.02))
    floor = bpy.context.object
    floor.name = 'Studio_Floor'
    floor_mat = bpy.data.materials.new('Studio_Floor_Material')
    floor_mat.diffuse_color = (0.03, 0.03, 0.04, 1.0)
    floor.data.materials.append(floor_mat)
    link_only(floor, root)

    # Camera + lights
    bpy.ops.object.light_add(type='AREA', location=(2.2, -2.4, 3.6))
    key = bpy.context.object
    key.name = 'Key_Light'
    key.data.energy = 1100
    key.data.shape = 'DISK'
    key.data.size = 2.5
    look_at(key, (0, 0, 1.0))
    link_only(key, root)

    bpy.ops.object.light_add(type='AREA', location=(-2.0, 1.0, 2.3))
    rim = bpy.context.object
    rim.name = 'Rim_Light'
    rim.data.energy = 700
    rim.data.size = 2.0
    look_at(rim, (0, 0, 1.15))
    link_only(rim, root)

    bpy.ops.object.camera_add(location=(2.8, -4.2, 2.25))
    camera = bpy.context.object
    camera.name = 'GarmentStudio_Camera'
    camera.data.lens = 58
    look_at(camera, (0, 0, 1.05))
    bpy.context.scene.camera = camera
    link_only(camera, root)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path))
    if render_path:
        render_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.render.render(write_still=True)

    print(json.dumps({
        'project': project.get('name'),
        'pieces': len(project.get('pieces') or []),
        'seams': len(project.get('seams') or []),
        'objects': len(bpy.data.objects),
        'materials': len(bpy.data.materials),
        'simulatedPieces': len(simulated_object_by_id),
        'output': str(output_path),
        'render': str(render_path) if render_path else None,
    }))


if __name__ == '__main__':
    main()
