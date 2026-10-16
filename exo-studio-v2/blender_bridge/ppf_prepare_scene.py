import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ppf_headless import ensure_ppf_registered


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description='Build a PPF-ready Blender scene from a Garment Studio PPF payload')
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--configure-addon', action='store_true')
    return parser.parse_args(argv)


def collection(name):
    obj = bpy.data.collections.get(name)
    if obj is None:
        obj = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(obj)
    return obj


def clear_scene_objects_preserve_addons():
    """Clear scene content without replacing bpy.types.Scene.

    PPF registers a PointerProperty on Scene. ``read_factory_settings``
    replaces the Scene datablock in background mode and can leave that
    extension property unavailable for the freshly-created scene, even though
    the add-on module remains enabled. Removing content in place keeps the
    extension registration intact.
    """
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)


def relink(obj, target):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def make_material(name, rgba):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = rgba
    return material


def to_blender(v):
    # Garment Studio: X horizontal, Y vertical, Z depth.
    # Blender: X horizontal, Y depth, Z vertical.
    return (float(v[0]), -float(v[2]), float(v[1]))


def build_shell(payload, target):
    vertices = [to_blender(v) for v in payload['shell']['vertices']]
    faces = [tuple(face) for face in payload['shell']['faces']]
    stitch_edges = [(int(edge['a']), int(edge['b'])) for edge in payload['shell'].get('stitchEdges', [])]
    mesh = bpy.data.meshes.new('PPF_Garment_Mesh')
    mesh.from_pydata(vertices, stitch_edges, faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(payload['shell'].get('objectName', 'PPF_Garment'), mesh)
    target.objects.link(obj)
    obj['garment_studio_ppf_protocol'] = payload['protocol']
    obj['garment_studio_ppf_version'] = int(payload.get('version', 1))
    obj['garment_studio_piece_count'] = len(payload['shell'].get('pieces', []))
    obj['garment_studio_stitch_edge_count'] = len(stitch_edges)
    obj['garment_studio_face_count'] = len(faces)
    obj['garment_studio_source_project'] = payload.get('project', {}).get('name', '')
    mat = make_material('PPF_Garment_Material', (0.62, 0.64, 0.68, 1.0))
    obj.data.materials.append(mat)
    return obj


def add_ellipsoid(name, location, scale, target, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=18, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    relink(obj, target)
    obj['garment_studio_ppf_role'] = 'STATIC_AVATAR'
    return obj


def build_local_thomas_avatar(payload, target):
    """Use the user's posed CLO Thomas *skin mesh*, not overlapping spheres.

    This local-only path never copies a proprietary body into the exported
    payload. Blender resolves the private GLB installed on this workstation,
    evaluates the armature once, and makes an independent static collider.
    Reduced triangles keep PPF contact narrowphase tractable; this remains a
    fidelity tradeoff requiring the frame-by-frame crossing audit.
    """
    path = Path(__file__).resolve().parent.parent / 'public/avatars/clo-thomas.glb'
    if not path.is_file():
        raise FileNotFoundError(f'CLO Thomas collider missing: {path}')
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in existing]
    source = next((obj for obj in imported if obj.name == 'body_mesh' and obj.type == 'MESH'), None)
    if source is None:
        raise RuntimeError('CLO Thomas GLB has no body_mesh. Refusing to mistake hair/shoes/garments for skin.')

    bpy.context.scene.frame_set(1)
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    mesh = bpy.data.meshes.new_from_object(source.evaluated_get(graph), preserve_all_data_layers=False, depsgraph=graph)
    mesh.transform(source.matrix_world)
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    if len(zs) < 500 or max(zs) - min(zs) < 1.0:
        raise ValueError('CLO Thomas body mesh bounds are invalid for metre-scale garment fitting')
    measured_height_m = max(1.45, min(2.15, float(payload.get('avatar', {}).get('measurements', {}).get('heightCm', 180)) / 100))
    scale = measured_height_m / (max(zs) - min(zs))
    center_x = (min(xs) + max(xs)) * .5
    center_depth = (min(ys) + max(ys)) * .5
    sole_z = min(zs)
    for vertex in mesh.vertices:
        vertex.co.x = (vertex.co.x - center_x) * scale
        vertex.co.y = (vertex.co.y - center_depth) * scale
        vertex.co.z = (vertex.co.z - sole_z) * scale

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    collider = bpy.data.objects.new('PPF_Avatar_ThomasBody', mesh)
    target.objects.link(collider)
    # Simplify only the physics collider. The original private 71k-triangle
    # avatar continues to render untouched in Garment Studio.
    original_face_count = len(mesh.polygons)
    max_faces = 18000
    if len(mesh.polygons) > max_faces:
        bpy.ops.object.select_all(action='DESELECT')
        collider.select_set(True)
        bpy.context.view_layer.objects.active = collider
        decimate = collider.modifiers.new('PPF_Static_Body_Decimation', 'DECIMATE')
        decimate.ratio = max(.05, max_faces / len(mesh.polygons))
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    # CLO's exported skin contains a few vertices left isolated by the
    # armature/decimation step. PPF explicitly *rejects* isolated STATIC
    # vertices during transfer, even if Blender displays the mesh normally.
    bm = bmesh.new()
    bm.from_mesh(collider.data)
    bm.verts.ensure_lookup_table()
    loose = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(collider.data)
    bm.free()
    collider.data.update()
    collider['garment_studio_ppf_role'] = 'STATIC_AVATAR'
    collider['garment_studio_body_collision'] = 'evaluated-clo-thomas-skin'
    collider['garment_studio_original_faces'] = original_face_count
    collider['garment_studio_body_scale'] = scale
    print('PPF_THOMAS_STATIC_COLLIDER', json.dumps({
        'object': collider.name, 'vertices': len(collider.data.vertices),
        'faces': len(collider.data.polygons), 'bodyHeightM': measured_height_m,
        'skinOnly': True, 'isolatedVerticesRemoved': len(loose),
    }))
    return [collider]


def build_avatar(payload, target):
    if payload.get('avatar', {}).get('mode') == 'local-thomas-body-mesh':
        return build_local_thomas_avatar(payload, target)
    avatar = payload.get('avatar', {}).get('measurements', {})
    height = max(145.0, min(215.0, float(avatar.get('heightCm', 180.0)))) / 180.0
    chest = max(70.0, min(145.0, float(avatar.get('chestCm', 96.0)))) / 96.0
    waist = max(55.0, min(145.0, float(avatar.get('waistCm', 78.0)))) / 78.0
    hip = max(70.0, min(150.0, float(avatar.get('hipCm', 94.0)))) / 94.0
    shoulder_cm = max(34.0, min(62.0, float(avatar.get('shoulderWidthCm', 46.0))))
    bicep = max(20.0, min(60.0, float(avatar.get('bicepCm', 32.0)))) / 32.0
    material = make_material('PPF_Avatar_Material', (0.18, 0.19, 0.21, 1.0))
    objects = []
    objects.append(add_ellipsoid('PPF_Avatar_Torso', (0, 0, 1.18 * height), (0.19 * chest, 0.13 * chest, 0.42 * height), target, material))
    objects.append(add_ellipsoid('PPF_Avatar_Waist', (0, 0, 0.92 * height), (0.155 * waist, 0.105 * waist, 0.22 * height), target, material))
    objects.append(add_ellipsoid('PPF_Avatar_Pelvis', (0, 0, 0.69 * height), (0.20 * hip, 0.14 * hip, 0.22 * height), target, material))
    objects.append(add_ellipsoid('PPF_Avatar_Neck', (0, 0, 1.70 * height), (0.075, 0.075, 0.14 * height), target, material))
    objects.append(add_ellipsoid('PPF_Avatar_Head', (0, 0, 1.88 * height), (0.15, 0.15, 0.19 * height), target, material))
    shoulder_half = shoulder_cm * 0.005
    arm_radius = 0.065 * bicep
    # The avatar is in a T-pose. Arms must extend horizontally along X.
    # The previous proxy accidentally used the *vertical* Z axis as the
    # long arm axis, creating two tall poles through the sleeves and torso.
    # Keep the old geometry available for A/B solver diagnostics only.
    arm_axis = payload.get('scene', {}).get('avatarArmAxis', 'horizontal')
    for side in (-1, 1):
        arm_scale = (0.36 * height, arm_radius, arm_radius) if arm_axis == 'horizontal' else (arm_radius, arm_radius, 0.36 * height)
        objects.append(add_ellipsoid(f'PPF_Avatar_Arm_{side:+d}', (side * (shoulder_half + 0.18), 0, 1.28 * height), arm_scale, target, material))
        objects.append(add_ellipsoid(f'PPF_Avatar_Leg_{side:+d}', (side * 0.105, 0, 0.28 * height), (0.09, 0.10, 0.48 * height), target, material))
    return objects


def set_if_present(proxy, attr, material, key):
    if key not in material:
        return
    setattr(proxy, attr, material[key])


def configure_ppf_addon(payload, garment_obj, avatar_objects):
    ensure_ppf_registered()
    try:
        from bl_ext.user_default.ppf_contact_solver.ops.api import solver
        from bl_ext.user_default.ppf_contact_solver.models.groups import get_addon_data, iterate_object_groups
    except Exception as exc:
        return {'configured': False, 'reason': f'PPF add-on unavailable: {type(exc).__name__}: {exc}'}

    solver.clear()
    shell_group = solver.create_group('Garment Studio Shell', type='SHELL')
    shell_group.add(garment_obj.name)
    support_config = payload['shell'].get('temporaryShoulderSupports') or {}
    support_report = {'enabled': False, 'count': 0}
    support_ids = support_config.get('indices') or []
    if support_ids:
        if len(set(support_ids)) != len(support_ids) or any(
                not isinstance(i, int) or i < 0 or i >= len(garment_obj.data.vertices)
                for i in support_ids):
            raise ValueError('Temporary shoulder pin indices are invalid')
        release_frames = int(support_config.get('releaseAfterFrames', 0))
        total_frames = int(payload.get('scene', {}).get('frameCount', 60))
        if release_frames < 1 or release_frames >= total_frames:
            raise ValueError('Temporary shoulder pins must release before the final frame')
        group = garment_obj.vertex_groups.new(name='GS_Temporary_Shoulder_Supports')
        group.add(support_ids, 1.0, 'REPLACE')
        strength = float(support_config.get('strength', 1.5))
        if not math.isfinite(strength) or not 0.01 <= strength <= 20:
            raise ValueError('Temporary pin pull strength out of range')
        shell_group.create_pin(garment_obj.name, group.name).pull(strength=strength).unpin(frame=release_frames)
        support_report = {'enabled': True, 'count': len(support_ids),
                          'mode': 'soft-pull', 'strength': strength,
                          'releaseAfterFrames': release_frames}

    piece_fabrics = [piece.get('fabricId') for piece in payload['shell'].get('pieces', [])]
    primary_id = next((fid for fid in piece_fabrics if fid in payload.get('fabrics', {})), None)
    primary = payload.get('fabrics', {}).get(primary_id, {}).get('material', {}) if primary_id else {}
    param = shell_group.param
    set_if_present(param, 'shell_density', primary, 'shellDensity')
    set_if_present(param, 'friction', primary, 'friction')
    set_if_present(param, 'shrink_x', primary, 'shrinkX')
    set_if_present(param, 'shrink_y', primary, 'shrinkY')
    set_if_present(param, 'shell_young_modulus', primary, 'shellYoungModulus')
    set_if_present(param, 'shell_poisson_ratio', primary, 'shellPoissonRatio')
    set_if_present(param, 'bend', primary, 'bend')
    set_if_present(param, 'stitch_stiffness', primary, 'stitchStiffness')
    # Always couple strict contact with a bounded shell strain. Old payloads
    # omitted this field and silently disabled PPF's limiter.
    strain_limit = float(primary.get('strainLimitPercent', 5.0))
    if not math.isfinite(strain_limit) or not 0 < strain_limit <= 100:
        raise ValueError('strainLimitPercent must be in (0, 100]')
    param.enable_strain_limit = True
    param.strain_limit_percent = strain_limit
    if 'contactGap' in primary or 'contactOffset' in primary:
        param.use_group_bounding_box_diagonal = False
        set_if_present(param, 'contact_gap', primary, 'contactGap')
        set_if_present(param, 'contact_offset', primary, 'contactOffset')

    scene = payload.get('scene', {})
    # A historical experimental Thomas fixture omitted this key and silently
    # fell back to STATIC. Upstream fitting examples pin the body as a solver
    # participant. Require the choice to be explicit so results from static
    # and pinned-body contact cannot accidentally be compared as equivalent.
    if payload.get('avatar', {}).get('mode') == 'local-thomas-body-mesh' and 'avatarRepresentation' not in scene:
        raise ValueError('Thomas fit must explicitly select scene.avatarRepresentation (pinned-shell or static)')
    body_representation = scene.get('avatarRepresentation', 'static')
    if body_representation not in ('static', 'pinned-shell'):
        raise ValueError('Unknown PPF avatar representation')
    static_group = solver.create_group('Garment Studio Avatar', type='SHELL' if body_representation == 'pinned-shell' else 'STATIC')
    static_group.add(*[obj.name for obj in avatar_objects])
    if body_representation == 'pinned-shell':
        # Match upstream fitting.ipynb: a prescribed body surface participates
        # in the solved contact namespace. A zero translation operation keeps
        # the fixed mannequin from being optimized back into a STATIC mesh.
        for obj in avatar_objects:
            pins = obj.vertex_groups.new(name='GS_Prescribed_Body')
            pins.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
            static_group.create_pin(obj.name, pins.name).move_by(
                delta=(0, 0, 0), frame_start=1,
                frame_end=max(2, int(scene.get('frameCount', 60))))
    # PPF defaults to a gap proportional to the STATIC object's bounding-box
    # diagonal. For a human-sized collider this is NOT the 1 mm gap set on
    # the cloth. Use explicit metric units on BOTH sides of the contact pair.
    scene = payload.get('scene', {})
    avatar_gap = float(scene.get('avatarContactGap', 0.001))
    avatar_offset = float(scene.get('avatarContactOffset', 0))
    if not math.isfinite(avatar_gap) or not (0.0001 <= avatar_gap <= 0.01):
        raise ValueError('avatarContactGap must be between 0.1 and 10 mm')
    if not math.isfinite(avatar_offset) or not (0 <= avatar_offset <= 0.005):
        raise ValueError('avatarContactOffset must be between 0 and 5 mm')
    static_group.param.use_group_bounding_box_diagonal = False
    static_group.param.contact_gap = avatar_gap
    static_group.param.contact_offset = avatar_offset
    # Preserve PPF's default strict contact policy. Forcing the three hidden
    # intersection-allowance RNA values on both groups was experimentally
    # tested and made the 10-frame Metal solve time out at frame 8. That
    # experimental override is intentionally NOT applied to production jobs.

    frame_count = max(10, int(scene.get('frameCount', 90)))
    frame_rate = max(1, int(scene.get('frameRate', 60)))
    step_size = float(scene.get('stepSize', 0.004))
    gravity = tuple(scene.get('gravity', [0, 0, -9.81]))

    # PPF's encoder reads the canonical root.state object, not only the
    # convenience solver.param proxy. Configure the same fields its upstream
    # macOS-native regression uses so headless runs have a deterministic end
    # frame instead of inheriting whatever was persisted in an older .blend.
    root = get_addon_data(bpy.context.scene)
    root.state.frame_count = frame_count
    root.state.frame_rate = frame_rate
    root.state.step_size = step_size
    # Upstream examples/fitting.ipynb sews without inertial momentum for
    # 0.15 seconds, then releases into gravity-driven dynamics. Opt-in until
    # the on-body trajectory passes the independent fit gates.
    inactive_frames = int(scene.get('inactiveMomentumFrames', 0))
    if inactive_frames < 0 or inactive_frames >= frame_count:
        raise ValueError('Inactive momentum phase must end before the final frame')
    root.state.inactive_momentum_frames = inactive_frames
    root.state.gravity_3d = gravity
    root.state.disable_contact = False
    # The upstream Blender client defaults to snapping loose stitch endpoints
    # together AFTER the native simulation. This edits exported vertex caches
    # without solving contact and strain again. Offline verification must use
    # the raw solver output; display-only seam snapping is not valid evidence
    # of a strain-limited, penetration-free solve.
    root.state.post_snap_exactly = False
    root.state.contact_nnz = int(scene.get('contactNnz', 4000000))
    # PPF divides contact AND strain TOI by this extended horizon.
    # The old value 1 landed exactly on singular barriers; restore the
    # upstream 1.25 safety factor for legacy payloads as well.
    line_search_max_t = float(scene.get('lineSearchMaxT', 1.25))
    if not math.isfinite(line_search_max_t) or line_search_max_t < 1.25:
        line_search_max_t = 1.25
    root.state.line_search_max_t = line_search_max_t
    root.state.air_density = 0.0
    root.state.wind_strength = 0.0
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = frame_count

    # Keep the public API proxy in sync too; this matters for interactive
    # Blender use and makes the saved .blend self-describing in both paths.
    solver.param.gravity = gravity
    solver.param.frame_count = frame_count
    solver.param.frame_rate = frame_rate
    solver.param.step_size = step_size
    solver.param.contact_nnz = int(scene.get('contactNnz', 4000000))
    solver.param.line_search_max_t = line_search_max_t
    return {
        'configured': True,
        'shellGroup': shell_group.name,
        'staticGroup': static_group.name,
        'avatarRepresentation': body_representation,
        'primaryFabric': primary_id,
        'frameCount': int(root.state.frame_count),
        'frameRate': frame_rate,
        'stepSize': step_size,
        'inactiveMomentumFrames': inactive_frames,
        'lineSearchMaxT': line_search_max_t,
        'postSnapExactly': bool(root.state.post_snap_exactly),
        'strainLimitEnabled': bool(param.enable_strain_limit),
        'strainLimitPercent': float(param.strain_limit_percent),
        'shellContactGapM': float(param.contact_gap),
        'shellContactOffsetM': float(param.contact_offset),
        'avatarContactGapM': float(static_group.param.contact_gap),
        'avatarContactOffsetM': float(static_group.param.contact_offset),
        'avatarGapAbsolute': not bool(static_group.param.use_group_bounding_box_diagonal),
        'contactEnabled': not root.state.disable_contact,
        'temporaryShoulderSupports': support_report,
        'gravity': [float(v) for v in gravity],
        'material': {'shellDensity': float(param.shell_density),
                     'shellYoungModulus': float(param.shell_young_modulus),
                     'bend': float(param.bend), 'friction': float(param.friction),
                     'contactGap': float(param.contact_gap),
                     'contactOffset': float(param.contact_offset),
                     'absoluteContactGap': not bool(param.use_group_bounding_box_diagonal)},
        'contactPolicy': {
            group.name: {
                'allowSelfIntersection': bool(group.allow_self_intersection),
                'allowInterObjectIntersection': bool(group.allow_inter_object_intersection),
                'allowInterGroupIntersection': bool(group.allow_inter_group_intersection),
            } for group in iterate_object_groups(bpy.context.scene) if group.active
        },
    }


def main():
    args = parse_args()
    payload = json.loads(Path(args.input).read_text())
    if payload.get('protocol') != 'garment-studio.ppf-shell':
        raise RuntimeError('Not a Garment Studio PPF payload')

    if args.configure_addon:
        ensure_ppf_registered()
        clear_scene_objects_preserve_addons()
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('PPF_World')
    scene.world.color = (0.02, 0.02, 0.025)
    scene['garment_studio_ppf_payload'] = str(Path(args.input).resolve())

    garment_collection = collection('PPF_Garment')
    avatar_collection = collection('PPF_Avatar')
    garment_obj = build_shell(payload, garment_collection)
    avatar_objects = build_avatar(payload, avatar_collection)
    result = {'configured': False, 'reason': 'configuration not requested'}
    if args.configure_addon:
        result = configure_ppf_addon(payload, garment_obj, avatar_objects)
    scene['garment_studio_ppf_configured'] = bool(result.get('configured'))
    scene['garment_studio_ppf_config'] = json.dumps(result)

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(json.dumps({
        'output': str(output),
        'vertices': len(garment_obj.data.vertices),
        'edges': len(garment_obj.data.edges),
        'faces': len(garment_obj.data.polygons),
        'stitchEdges': int(garment_obj['garment_studio_stitch_edge_count']),
        'avatarObjects': len(avatar_objects),
        **result,
    }))


if __name__ == '__main__':
    main()
