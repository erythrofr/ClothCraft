"""Rebuild R03 as an editable architectural mirror runway.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/refine-r03-mirror-runway.py
Uses authored mesh and material data only. Existing stage source is preserved.
"""
import bpy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/stage-refined-blender-sources/EXO_STAGE_R03_REFINED.blend'
DST = ROOT / 'docs/stage-refined-blender-sources/EXO_STAGE_R03_MIRROR_RUNWAY.blend'
GLB = ROOT / 'public/stage-scenes/R03.glb'
REPORT = ROOT / 'docs/qa-stage-r03-mirror-runway.json'

bpy.ops.wm.open_mainfile(filepath=str(SRC))
before = [o for o in bpy.data.objects if o.type == 'MESH']
baseline = {'meshes': len(before), 'polygons': sum(len(o.data.polygons) for o in before),
            'materials': len({m.name for o in before for m in o.data.materials if m})}

for ob in list(bpy.data.objects):
    if ob.type != 'MESH':
        continue
    name = ob.name.lower()
    if any(t in name for t in ('runway lamp','runway diffuser','mirror panel','mirror molding',
                              'stone wall horizontal reveal','stone wall vertical reveal',
                              'gallery grooved wall panel','gallery longitudinal reveal',
                              'runway inset brass edge tick')):
        bpy.data.objects.remove(ob, do_unlink=True)

def mat(name, rgb, rough, metallic=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb,1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb,1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*rgb,1)
        p.inputs['Emission Strength'].default_value = emission
    return m

mirror = mat('R03 | polished tinted architectural mirror',(.70,.74,.77),.055,.96)
black = mat('R03 | dark satin metal',(.065,.070,.080),.33,.73)
nickel = mat('R03 | satin brushed nickel',(.47,.49,.50),.29,.86)
limestone = mat('R03 | warm honed limestone',(.43,.405,.365),.78)
charcoal = mat('R03 | runway dark stone',(.105,.106,.109),.52)
diffuser = mat('R03 | recessed opal linear diffuser',(.86,.83,.75),.35,emission=1.3)

def box(name, loc, dims, material, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object
    o.name=name
    o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Machined bevel','BEVEL')
        mod.width=bevel
        mod.segments=2
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

# Tailored architecture. Panels sit just inside the existing shell.
for side in (-1,1):
    x=side*4.855
    box('R03 | continuous lower stone plinth', (x,-.10,.22),(.17,8.1,.44),limestone,.015)
    box('R03 | low shadow reveal', (side*4.754,-.10,.46),(.025,8.0,.012),black,.002)
    for i in range(6):
        y=-3.25+i*1.35
        box('R03 | floor-to-ceiling smoked mirror bay', (side*4.75,y,2.64),(.035,1.20,4.16),mirror,.009)
        box('R03 | mirror perimeter mullion', (side*4.705,y+.632,2.62),(.060,.044,4.32),nickel,.007)
        box('R03 | mirror inset frame upper', (side*4.70,y,4.725),(.06,1.27,.035),black,.003)
        box('R03 | mirror inset frame lower', (side*4.70,y,.537),(.06,1.27,.035),black,.003)
    box('R03 | side soffit', (side*4.35,-.2,5.02),(1.12,8.0,.25),charcoal,.012)
    for y in (-3.5,-1.9,-.3,1.3,2.9):
        box('R03 | inset lighting channel', (side*3.94,y,4.874),(.83,.13,.022),black,.005)
        box('R03 | opal ceiling light', (side*3.94,y,4.859),(.70,.062,.009),diffuser,.002)
    box('R03 | narrow reflected uplight slot',(side*2.30,-.35,.024),(.042,7.7,.020),black,.003)
    box('R03 | narrow reflected uplight diffuser',(side*2.30,-.35,.037),(.019,7.55,.010),diffuser,.002)

# Full central ceiling surface and restrained linear illumination.
box('R03 | inset acoustic ceiling', (0,-.10,5.12),(7.73,8.03,.20),charcoal,.025)
for y in (-3.3,-1.6,.1,1.8,3.4):
    box('R03 | central linear light recess',(0,y,5.01),(2.35,.11,.03),black,.005)
    box('R03 | recessed luminaire diffuser',(0,y,4.99),(2.11,.045,.008),diffuser,.002)
for x in (-3.4,3.4):
    box('R03 | gallery column', (x,3.79,2.52),(.23,.26,4.65),limestone,.02)
    box('R03 | column inlay', (x,3.625,2.52),(.036,.014,4.50),nickel,.003)

box('R03 | rear architectural portal surround', (0,3.86,4.65),(3.50,.27,.25),black,.021)
for x in (-1.77,1.77):
    box('R03 | portal jamb',(x,3.83,2.36),(.20,.30,4.55),black,.018)
    box('R03 | portal metal inset',(x*.944,3.651,2.36),(.021,.015,4.45),nickel,.003)
box('R03 | doorway dark recess', (0,3.68,2.27),(3.22,.025,4.46),black,.006)

# Runway top and perimeter are neutral under garment illumination.
box('R03 | long stone catwalk tread',(0,-.45,.155),(2.02,7.73,.035),charcoal,.015)
for x in (-1.02,1.02):
    box('R03 | fine runway nickel lip',(x,-.45,.149),(.017,7.72,.018),nickel,.003)
for y in (-3.68,3.28):
    box('R03 | perpendicular stone seam',(0,y,.174),(2.00,.012,.003),black,.001)

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.render.image_settings.file_format='PNG'
meshes=[o for o in bpy.data.objects if o.type=='MESH' and not o.hide_render]
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(DST),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
    export_apply=True,export_yup=True,export_lights=False,export_cameras=False,export_animations=False)
after={'meshes':len(meshes),'polygons':sum(len(o.data.polygons) for o in meshes),
       'materials':len({m.name for o in meshes for m in o.data.materials if m}),
       'bytes':GLB.stat().st_size, 'source':str(DST.relative_to(ROOT))}
report={'stage':'R03','before':baseline,'after':after,
        'realism_gap':'Metallic mirror surfaces require environment/reflection probes in the live renderer; GLB alone does not guarantee faithful mirror reflections. Mesh lighting diffusers need runtime lighting for physical illumination.',
        'license':'Self-authored procedural Blender geometry and materials; no third party assets.'}
REPORT.write_text(json.dumps(report,indent=2)+'\n')
print('R03_RESULT',json.dumps(report),flush=True)
