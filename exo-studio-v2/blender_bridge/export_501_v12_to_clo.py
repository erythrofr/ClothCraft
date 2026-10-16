"""Export the saved V12 light-blue ripped 501 on-body mesh for CLO3D.

Blender procedural denim is baked to a source-visible 2K albedo PNG. Export
only garment geometry and construction detailing, NOT the Blender avatar or
floor. The source blend is never modified or overwritten.
"""
import bpy
from pathlib import Path
import sys
import json

args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]).resolve()
out=Path(args[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
jeans=bpy.data.objects['MIKRISTIAN_501_W32L32_Manifold_Fit_Shell']
scn=bpy.context.scene

# Bake precisely the color at each point, including procedural fade, weave,
# and the hem stitch shader, to create a portable CLO-readable image map.
mat=jeans.data.materials[0]
bsdf=mat.node_tree.nodes.get('Principled BSDF')
outnode=mat.node_tree.nodes.get('Material Output')
if not bsdf or not outnode or not bsdf.inputs['Base Color'].is_linked:
    raise RuntimeError('V12 washed denim procedural color chain is missing')
original=bsdf.inputs['Base Color'].links[0].from_socket
em=mat.node_tree.nodes.new('ShaderNodeEmission')
mat.node_tree.links.new(original,em.inputs['Color'])
mat.node_tree.links.new(em.outputs[0],outnode.inputs['Surface'])
img=bpy.data.images.new('501 V12 CLO Baked Indigo Albedo',width=2048,height=2048,alpha=False)
img.generated_color=(.19,.33,.50,1)
image_node=mat.node_tree.nodes.new('ShaderNodeTexImage')
image_node.image=img
mat.node_tree.nodes.active=image_node
image_node.select=True
for n in mat.node_tree.nodes:
    if n != image_node:n.select=False

bpy.ops.object.select_all(action='DESELECT')
jeans.select_set(True)
bpy.context.view_layer.objects.active=jeans
scn.render.engine='CYCLES'
scn.cycles.samples=4
scn.render.bake.margin=8
bpy.ops.object.bake(type='EMIT')
tex=out/'501_V12_LightWash_Ripped_ALBEDO.png'
img.filepath_raw=str(tex)
img.file_format='PNG'
img.save()

# Replace baked material with a minimal image-based Principled graph so
# Blender's OBJ MTL writer exports the map_Kd reference and CLO can read it.
newmat=bpy.data.materials.new('501_Light_Blue_Distressed_Denim_Baked')
newmat.use_nodes=True
shader=newmat.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value=.84
pic=newmat.node_tree.nodes.new('ShaderNodeTexImage')
pic.image=img
newmat.node_tree.links.new(pic.outputs['Color'],shader.inputs['Base Color'])
jeans.data.materials.clear()
jeans.data.materials.append(newmat)

# Important for OBJ to Garment: exclude human, floor, lights and shoes. Keep
# physical ripped backing meshes, cuff facings, pocket/yoke/rip seam curves.
include=[jeans]
for o in bpy.data.objects:
    if o.type == 'MESH' and ('Turned Hem Facing' in o.name or ('501 Ripped' in o.name and 'backing' in o.name)):
        include.append(o)
    elif o.type == 'CURVE' and (
        'Topstitch' in o.name or 'Pocket' in o.name or 'Frayed' in o.name or
        'yarn tail' in o.name or 'Hem' in o.name or 'Yoke' in o.name or 'Button Fly' in o.name
    ):
        include.append(o)

# Convert curves to meshes using evaluated modifiers; strip subsurface details
# if necessary because CLO will load one static mesh for presentation.
bpy.ops.object.select_all(action='DESELECT')
for o in include:o.select_set(True)
bpy.context.view_layer.objects.active=jeans
for o in list(include):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target='MESH')

bpy.ops.object.select_all(action='DESELECT')
for o in include:
    found=bpy.data.objects.get(o.name)
    if found and found.type=='MESH':found.select_set(True)
bpy.context.view_layer.objects.active=jeans

# Unit scale as millimeters with Y up so CLO's mm import shows a wearable
# sized object. OBJ MTL references the baked image next to the OBJ file.
obj=out/'501_LightBlue_Ripped_OnBody_IMPORT_TO_CLO.obj'
bpy.ops.wm.obj_export(filepath=str(obj),export_selected_objects=True,
    export_materials=True,global_scale=1000.0,
    forward_axis='NEGATIVE_Z',up_axis='Y')
manifest={'originalSource':str(source),'obj':str(obj),'albedo':str(tex),
          'mtl':str(obj.with_suffix('.mtl')),
          'garmentMainMesh':jeans.name,'garmentFaces':len(jeans.data.polygons),
          'selectedItems':len(include),'units':'millimeters', 'axis':'Y up',
          'editableInCLO':'OBJ imported as 3D garment; no native sewn flat patterns generated',
          'ripsAndCuffs':'preserved as 3D visual details; physics simulation not tested',
          'originalsUnchanged':True}
(out/'501_CLO_TRANSFER_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('EXPORTED_501_TO_CLO='+json.dumps(manifest))
