"""Refine four EXO Blender stages without modifying the original source .blend files.

Run: Blender -b --python scripts/new-stage-refinement-blender.py
Creates editable refined source copies and textured GLBs. Procedural image textures
are generated and embedded in GLB so browser renderers see real texture variation.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / 'docs/research/clo-connect-community/blender-scenes'
OUTPUT = ROOT / 'public/stage-scenes'
SOURCE_COPIES = ROOT / 'docs/stage-refined-blender-sources'
IDS = ('R02', 'R03', 'S01', 'S10')
SOURCE_COPIES.mkdir(parents=True, exist_ok=True)
data = json.loads((OUTPUT / 'manifest.json').read_text())
records = {s['id']: s for s in data['stages']}


def tex(name, base, seed, variant='stone'):
    rng = random.Random(seed)
    n = 256
    image = bpy.data.images.new(name, width=n, height=n, alpha=True)
    pixels = []
    streak = [rng.uniform(-.065, .065) for _ in range(n)]
    grains = [rng.uniform(-.06, .06) for _ in range(n)]
    for y in range(n):
        for x in range(n):
            noise = rng.gauss(0, .023)
            if variant == 'wood':
                t = math.sin((y + 5 * math.sin(x / 19)) * .23) * .065
                t += math.sin(y * 1.13) * .008 + noise * .4
            elif variant == 'concrete':
                t = noise + streak[x] * .44 + grains[y] * .20
            elif variant == 'metal':
                t = streak[x] * .15 + math.sin(x * .66) * .006 + noise * .12
            else:
                t = noise + streak[x] * .3 + grains[y] * .35
                t += math.sin(x * .077 + y * .025) * .013
            pixels.extend((*(max(.015, min(1, c + t)) for c in base), 1))
    image.pixels.foreach_set(pixels)
    image.pack()
    image.file_format = 'PNG'
    return image


def textured_material(name, base, seed, roughness=.77, metallic=0, variant='stone'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    t = nodes.new('ShaderNodeTexImage')
    t.image = tex(name + '_albedo', base, seed, variant)
    m.node_tree.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    return m


def box(name, xyz, size, material, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('Architectural edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj


def enrich(stage):
    stone = textured_material('EXO refined limestone | warm mineral aggregate', (.50,.47,.42), 101, .88)
    concrete = textured_material('EXO refined poured concrete | grain', (.37,.38,.375), 102, .91, variant='concrete')
    dark = textured_material('EXO refined graphite | anodized', (.105,.112,.12), 103, .37, .7, 'metal')
    brass = textured_material('EXO refined brushed brass', (.45,.32,.16), 104, .35, .76, 'metal')
    wood = textured_material('EXO refined oak timber | subtle grain', (.32,.24,.18), 105, .72, variant='wood')
    plaster = textured_material('EXO refined plaster | fine aggregate', (.68,.66,.60), 106, .94)
    for ob in list(bpy.data.objects):
        if ob.type != 'MESH': continue
        n = ob.name.lower()
        if 'floor' in n or 'runway catwalk' in n or 'seamless backdrop' in n:
            ob.data.materials.clear()
            ob.data.materials.append(concrete if stage in ('R02','S01') else stone)
        elif 'back wall' in n or 'left wall' in n or 'right wall' in n:
            ob.data.materials.clear()
            ob.data.materials.append(plaster if stage == 'S01' else concrete)
        elif 'mirror molding' in n or 'entrance lintel' in n:
            ob.data.materials.clear()
            ob.data.materials.append(brass)
    # Tight shallow joints on the vertical back wall; physically modeled, not shader lines.
    for z in (.08, 1.2, 2.35, 3.5, 4.65):
        box('Stone wall horizontal reveal', (0,4.002,z), (9.7,.026,.012),dark,.003)
    for x in (-4.4,-2.2,0,2.2,4.4):
        box('Stone wall vertical reveal', (x,3.999,2.5), (.012,.026,4.9),dark,.002)
    # Perimeter baseboard with visible bronze edge catches.
    for x in (-4.89,4.89):
        box('Inset perimeter skirting', (x,-.3,.12),(.035,7.65,.20),stone)
        box('Skirting brass reveal', (x,-.3,.224),(.018,7.65,.009),brass,.002)
    box('Rear dado skirting', (0,3.968,.10),(9.76,.035,.20),stone)
    # Repeatable measured ceiling details, well outside the avatar display volume.
    for y in (-3.1,-1.3,.5,2.3):
        box('Recessed ceiling lighting housing',(-3.95,y,4.91),(.8,.13,.1),dark)
        box('Recessed ceiling lighting diffuser',(-3.95,y,4.853),(.72,.07,.012),plaster,.001)
        box('Recessed ceiling lighting housing',(3.95,y,4.91),(.8,.13,.1),dark)
        box('Recessed ceiling lighting diffuser',(3.95,y,4.853),(.72,.07,.012),plaster,.001)
    if stage in ('R02','R03'):
        for y in (-3,-1,1,3):
            for side in (-1,1):
                box('Runway inset brass edge tick',(side*1.064,y,.150),(.032,.34,.013),brass,.002)
        for x in (-3.4,3.4):
            box('Gallery grooved wall panel',(x,3.88,2.4),(1.7,.115,4.35),wood if stage=='R02' else dark,.025)
            for dx in (-.65,-.45,-.25,0,.25,.45,.65):
                box('Gallery longitudinal reveal',(x+dx,3.805,2.4),(.01,.022,4.24),brass,.001)
    elif stage == 'S01':
        for x in (-3.4,3.4):
            box('Studio fabric backdrop rail',(x,3.66,4.72),(.9,.25,.09),dark,.015)
            box('Studio daylight reflector frame',(x,2.92,3.65),(.74,.06,1.8),brass,.012)
            box('Studio daylight reflector white card',(x,2.875,3.65),(.67,.016,1.7),plaster,.006)
        for y in (-3.5,-2.5,-1.5,-.5,.5,1.5):
            box('Studio floor expansion line', (0,y,-.009),(8.6,.009,.003),dark,.001)
    elif stage == 'S10':
        for x in (-3.6,-2.4,2.4,3.6):
            box('Garden architectural timber screen',(x,3.45,2.2),(.11,.12,3.9),wood,.016)
        for x in (-2.15,2.15):
            box('Garden pool stone coping',(x,2.65,.077),(.18,1.66,.08),stone,.019)
        for y in (1.82,3.48):
            box('Garden pool end coping',(0,y,.077),(4.5,.18,.08),stone,.019)
    for ob in bpy.data.objects:
        if ob.type=='MESH' and len(ob.data.polygons)>30:
            for poly in ob.data.polygons:
                poly.use_smooth = True if poly.loop_total>4 else poly.use_smooth
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 40
    scene.world.color = (.20,.20,.20)
    scene.render.image_settings.file_format='PNG'
    # A scene camera remains in the editable source .blend; runtime GLBs export mesh only.
    return scene


for stage in IDS:
    src = INPUT / f'EXO_STAGE_{stage}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(src))
    before_meshes = [o for o in bpy.data.objects if o.type=='MESH']
    print('BEFORE',stage,len(before_meshes),sum(len(o.data.polygons) for o in before_meshes),flush=True)
    enrich(stage)
    mesh = [o for o in bpy.data.objects if o.type=='MESH' and not o.hide_render]
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_COPIES / f'EXO_STAGE_{stage}_REFINED.blend'), compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in mesh: ob.select_set(True)
    bpy.context.view_layer.objects.active=mesh[0]
    out = OUTPUT / f'{stage}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,
        export_apply=True,export_yup=True,export_lights=False,export_cameras=False,
        export_animations=False)
    m = records[stage]
    m.update(bytes=out.stat().st_size,meshes=len(mesh),
        polygons=sum(len(o.data.polygons) for o in mesh),
        materials=len({mat.name for ob in mesh for mat in ob.data.materials if mat}),
        source=str((SOURCE_COPIES / f'EXO_STAGE_{stage}_REFINED.blend').relative_to(ROOT)),
        provenance='Refined derivative of EXO original Blender scene; texture images embedded',
        status='ready')
    print('AFTER',stage,m['meshes'],m['polygons'],m['materials'],m['bytes'],flush=True)
(OUTPUT / 'manifest.json').write_text(json.dumps(data,indent=2)+'\n')
