"""Create original, editable fashion stage .blend files from EXO CONNECT research.

Blender 4.3+ headless invocation:
  blender -b --python scripts/build-connect-stages-blender.py -- --all \
    --output-dir docs/research/clo-connect-community/blender-scenes
  blender -b --python scripts/build-connect-stages-blender.py -- --stage R01 --output-dir /tmp

This script uses only Blender primitives, generated materials, area lights and
cameras. No CONNECT geometry or seller photographs are copied or downloaded.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parent.parent
MANIFEST = REPO / "docs/research/clo-connect-community/reference-manifest.json"


def material(name, rgb, metallic=0.0, roughness=0.55, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = (*rgb, 1)
        shader.inputs["Emission Strength"].default_value = emission
    return mat


def collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def rehome(obj, col):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def cube(name, loc, scale, mat, col, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft manufactured edges", 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new("Weighted normals", 'WEIGHTED_NORMAL')
    return rehome(obj, col)


def cylinder(name, loc, radius, depth, mat, col, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Edge highlights", 'BEVEL')
    bevel.width = 0.017
    bevel.segments = 3
    obj.modifiers.new("Weighted normals", 'WEIGHTED_NORMAL')
    return rehome(obj, col)


def sphere(name, loc, scale, mat, col):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return rehome(obj, col)


def area_light(name, loc, target, power, size, color, col):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power
    light.shape = 'DISK'
    light.size = size
    light.color = color
    obj = bpy.data.objects.new(name, light)
    col.objects.link(obj)
    obj.location = loc
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def line_beam(name, start, end, width, mat, col):
    midpoint = (Vector(start) + Vector(end)) * 0.5
    vec = Vector(end) - Vector(start)
    obj = cube(name, midpoint, (width, width, vec.length), mat, col, 0.01)
    obj.rotation_euler = vec.to_track_quat('Z', 'Y').to_euler()
    return obj


def create_environment(item):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    for col in list(bpy.data.collections):
        if col.users == 0:
            bpy.data.collections.remove(col)

    sid = item['id']
    idx = int(sid[1:])
    runway = sid.startswith('R')
    seed = (300 if runway else 600) + idx
    random.seed(seed)
    shell = collection('SET_SHELL')
    props = collection('SET_PROPS')
    lights = collection('SET_LIGHTS')
    cameras = collection('CAMERAS')
    garment = collection('GARMENT_STAGE')

    # Neutral garment clearance: open display volume is x[-.7,.7], y[0,2.1], z[-.45,.45].
    palette = [
        (.36, .34, .35), (.24, .28, .31), (.36, .29, .24),
        (.30, .35, .31), (.35, .29, .35), (.24, .23, .25),
        (.32, .30, .26), (.37, .32, .31),
    ]
    wall_rgb = palette[(idx - 1) % len(palette)]
    if sid == 'S02':
        wall_rgb = (.70, .42, .51)
    if sid in {'S04', 'S13', 'S15'}:
        wall_rgb = (.10, .105, .12)
    if sid == 'S12':
        wall_rgb = (.055, .21, .12)
    wall = material('Mat | architectural walls', wall_rgb, 0.02, .82)
    floor = material('Mat | textured floor', tuple(x * .68 for x in wall_rgb), .08, .62)
    ivory = material('Mat | warm plaster', (.80, .77, .71), 0, .84)
    steel = material('Mat | polished metal', (.68, .71, .74), .92, .21)
    dark = material('Mat | satin charcoal', (.048, .051, .061), .18, .45)
    accent = material('Mat | brass warm accent', (.65, .46, .21), .76, .28)
    led = material('Mat | illuminated strip', (1.0, .86, .65), .0, .3, 2.1)
    glass = material('Mat | mirror', (.7, .74, .79), 1, .03)
    foliage = material('Mat | leaves', (.11, .27, .12), .0, .68)
    water = material('Mat | water surface', (.08, .22, .25), .43, .10)

    # Blender uses Z-up; EXO's Three.js viewport uses Y-up.
    cube('Room floor', (0, 0, -.115), (10, 12, .20), floor, shell, .035)
    cube('Back wall', (0, 4.1, 2.55), (10, .18, 5.4), wall, shell, .03)
    cube('Left wall', (-5, 0, 2.55), (.18, 8.2, 5.4), wall, shell, .02)
    cube('Right wall', (5, 0, 2.55), (.18, 8.2, 5.4), wall, shell, .02)

    if runway:
        deck = dark if sid in {'R01','R04'} else steel if sid == 'R03' else ivory
        if sid == 'R01':
            cylinder('Circular catwalk', (0, 0, .09), 2.05, .18, deck, props)
            cylinder('Inner circular platform', (0, 0, .205), 1.12, .14, dark, props)
        else:
            cube('Long runway catwalk', (0, -.45, .07), (2.1, 7.8, .14), deck, props, .024)
        for side in [-1, 1]:
            for i in range(8):
                x = (2.15 if sid != 'R01' else 2.65) * side
                y = -3.5 + i
                cylinder(f'Runway lamp {side} {i}', (x, y, .12), .075, .22, steel, props, 12)
                sphere(f'Runway diffuser {side} {i}', (x, y, .24), (.13, .13, .13), led, props)
        if sid == 'R02':
            for x in [-4.5, -4.0, 4.0, 4.5]:
                sphere(f'Mountain distant {x}', (x, 3.5, 1.5), (1.7, 1.4, 2.5), wall, props)
        if sid == 'R03':
            for side in [-1, 1]:
                for z in (.7, 1.6, 2.5, 3.5):
                    cube(f'Mirror molding {side} {z}', (side*4.82, 1, z), (.08, 3.7, .045), accent, props)
                    cube(f'Mirror panel {side} {z}', (side*4.74, 1.0, z+.22), (.055, 3.1, .24), glass, props)
        if sid == 'R04':
            for x in [-2.6, 2.6]:
                for h in [.8, 1.7, 2.6, 3.5]:
                    cube('Linear runway lighting', (x, -.8, h), (.04, 7.3, .04), led, props)
    else:
        # Editorial rooms use visibly different set construction, not only recolors.
        if sid in {'S01','S02','S03','S05','S06','S08','S11'}:
            for x in [-2.45, 2.45]:
                cube('Shooting plinth', (x, 1.85, .27), (1.05, 1.3, .54), ivory if idx % 2 else dark, props, .06)
            if sid in {'S01','S02','S03'}:
                cube('Floating seamless backdrop', (0, 3.85, 2.45), (7.8, .13, 4.8), wall, props, .025)
        if sid in {'S04','S13','S15'}:
            for x in [-3.8, -2.45, 2.45, 3.8]:
                cube('Mirrored editorial panel', (x, 3.86, 2.35), (1.12, .075, 4.6), glass, props, .018)
        if sid in {'S05','S06','S07','S08','S11','S14'}:
            for x in [-4.15, 4.15]:
                for z in [1.15, 2.65, 4.1]:
                    line_beam('Industrial strut', (x,-3,z), (x,3.8,z), .07, steel, props)
        if sid in {'S09','S10','S01'}:
            for n in range(9):
                x = random.uniform(-4.1,4.1)
                y = random.uniform(1.7,3.6)
                cylinder('Garden planter', (x,y,.26), .28, .52, dark, props)
                sphere('Foliage volume', (x,y,.85), (.35,.37,.65), foliage, props)
        if sid == 'S10':
            cube('Reflecting pool', (0,2.65,.02), (4.2,1.4,.045), water, props)
        if sid == 'S12':
            for x in [-2.8,-1.4,0,1.4,2.8]:
                cube('Green backlit wall fin', (x,3.62,2.5),(.14,.45,4.65),dark,props)
        if sid in {'S05','S06','S11','S14'}:
            for y in [-3, -1.5,0,1.5,3.0]:
                line_beam('Ceiling photo truss',(-4.4,y,4.7),(4.4,y,4.7),.055,steel,props)
        if sid == 'S10':
            for side in [-1,1]:
                line_beam('Ceremonial entrance', (side*1.95,3.18,0),(side*1.95,3.18,3.3),.15,ivory,props)
            line_beam('Entrance lintel',(-2.0,3.18,3.3),(2.0,3.18,3.3),.17,ivory,props)

    # A fixed real-world origin allows a dressed avatar or garment to be linked
    # into any room without rescaling or rebuilding the location hierarchy.
    marker = bpy.data.objects.new('GARMENT_INSERT_ANCHOR | ground Z=0 | facing camera', None)
    garment.objects.link(marker)
    marker.empty_display_type = 'ARROWS'
    marker.empty_display_size = .38
    marker.location = (0, 0, 0)
    for i, x in enumerate([-2.8, 0, 2.8]):
        area_light('Large studio softbox '+str(i), (x,-3.2,4.5), (0,0,1.2),
                   650 if i == 1 else 420, 3.4 if i == 1 else 2.2,
                   (1.0,.96,.91) if i != 2 else (.81,.89,1.0), lights)
    area_light('Rear contour light', (-1.4,3.2,3.3), (0,0,1.4), 380, 2.3, (.80,.87,1.0), lights)
    camera_data = bpy.data.cameras.new('Editorial main camera')
    cam = bpy.data.objects.new('CAMERA | full look', camera_data)
    cameras.objects.link(cam)
    cam.location = (4.1,-8.9,3.1) if runway else (3.5,-6.8,2.9)
    aim = Vector((0, .7, 1.32)) - cam.location
    cam.rotation_euler = aim.to_track_quat('-Z','Y').to_euler()
    camera_data.lens = 38 if runway else 50
    bpy.context.scene.camera = cam
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 24
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 1600
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.world.color = (.15,.15,.15)
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene['exo_stage_id'] = sid
    bpy.context.scene['exo_stage_name'] = item['title']
    bpy.context.scene['source_reference_url'] = item['url']
    bpy.context.scene['source_is_inspiration_only'] = True
    bpy.context.scene['all_scene_models_are_original'] = True
    return sid


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', default='R01')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--output-dir', default=str(REPO / 'docs/research/clo-connect-community/blender-scenes'))
    values = parser.parse_args(args)
    items = json.loads(MANIFEST.read_text())['items']
    chosen = items if values.all else [x for x in items if x['id'] == values.stage]
    if not chosen:
        raise SystemExit(f'Unknown stage {values.stage}')
    destination = Path(values.output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    for item in chosen:
        stage = create_environment(item)
        filename = destination / f'EXO_STAGE_{stage}.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(filename), compress=True)
        print('EXO_STAGE_SAVED', filename)


if __name__ == '__main__':
    main()
