"""Generate original, illustrative garment hardware meshes and studio previews.

Run with Blender 4+: blender -b -t 2 --python scripts/hardware-premium/generate.py
All units are metres, with dimensions based on illustrative preset millimetres.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUTPUT = os.path.join(ROOT, 'public', 'hardware-premium')
os.makedirs(OUTPUT, exist_ok=True)


def finish_material(name, color, metallic, roughness):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return m


def tubing(name, points, radius, mat, closed=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 24
    curve.bevel_depth = radius
    curve.resolution_u = 24
    curve.bevel_resolution = 5
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for knot, p in zip(spline.points, points):
        knot.co = (*p, 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    for f in obj.data.polygons:
        f.use_smooth = True
    return obj


def rounded_frame(name, hw, hh, r, tube, material):
    pts = []
    for cx, cy, start in ((hw-r,hh-r,0),(-hw+r,hh-r,90),(-hw+r,-hh+r,180),(hw-r,-hh+r,270)):
        for n in range(13):
            angle = math.radians(start + 90*n/12)
            pts.append((cx+r*math.cos(angle), cy+r*math.sin(angle), 0))
    return tubing(name, pts, tube, material, True)


def capsule_prong(material):
    # Attached to the centre of the TOP frame at its hinge barrel. The tongue
    # swings towards the opposite bottom rail, as a belt buckle prong should.
    points = [(0, .018, .0012), (0, .013, .0028), (0, .003, .0032),
              (0, -.007, .0024), (0, -.015, .0011)]
    return tubing('Hinged belt prong', points, .0013, material)


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def make_hardware(key):
    dark = finish_material('Blackened brushed steel', (.095,.105,.115), .88, .43)
    steel = finish_material('Satin nickel stainless steel', (.37,.40,.44), .86, .40)
    if key == 'd-ring':
        # 25 mm clear opening, 4 mm rounded wire. Arch and straight retaining bar.
        p = [(-.0145, -.011, 0), (-.0145,.000,0)]
        for i in range(33):
            t = math.pi - math.pi * i / 32
            p.append((.0145*math.cos(t), .000 + .0145*math.sin(t), 0))
        p += [(.0145,-.011,0),(-.0145,-.011,0)]
        tubing('Continuous D-ring forged wire', p, .002, steel)
    elif key == 'slide-adjuster':
        rounded_frame('Rounded outer tri-glide frame', .0155, .0100, .0032, .00165, dark)
        tubing('Raised central webbing friction bar', [(-.014,0,.0012),(.014,0,.0012)], .0016, dark)
    else:
        rounded_frame('Precision cast buckle perimeter', .0215, .0200, .005, .002, dark)
        tubing('Top centre prong hinge barrel', [(-.0035,.018,0),(.0035,.018,0)], .0019, steel)
        capsule_prong(steel)


def setup_studio():
    world = bpy.context.scene.world
    world.color = (.15,.15,.15)
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.24,.28,.35,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    def area(name, location, energy, size):
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        direction = Vector((0,0,0)) - light.location
        light.rotation_euler = direction.to_track_quat('-Z','Y').to_euler()
    area('Wide softbox', (-.06,.07,.12), 3.8, .15)
    area('Right edge kicker', (.065,-.035,.07), 2.5, .09)
    area('Front vertical strip', (.01,-.075,.10), 2.2, .065)
    bpy.ops.object.camera_add(location=(.045,-.065,.112))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = .068
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -.65


for key in ('d-ring','prong-buckle','slide-adjuster'):
    reset()
    make_hardware(key)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUTPUT, key+'.glb'), export_format='GLB', use_selection=True, export_apply=True)
    setup_studio()
    bpy.context.scene.render.filepath = os.path.join(OUTPUT, key+'.png')
    bpy.ops.render.render(write_still=True)
    print('EXO_PREMIUM_ASSET', key, 'mesh_count', len(meshes))
