"""Construct a W32/L32 on-body fit reference independent of the cloth solver.

The guide is a sewn-solid visualization, NOT a CLO ZPRJ simulation. The loft
dimensions below are independent measurements inspired by 501 straight jeans.
Use it to check where 2D panels should surround the avatar prior to physics.
"""
import bpy
import bmesh
import math
import sys
from pathlib import Path
from mathutils import Vector

argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT = Path(argv[0]) if argv else Path.home()/'Documents'/'CLO_Automation'/'501_Original_Jeans_W32L32'/'On_Body_Simulation'
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, roughness=.86):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    return m

denim=material('13.5oz Indigo Rigid Denim - fitting study',(0.048,0.088,0.17))
dummy=material('Neutral 180 cm Mens Fitting Avatar',(0.48,0.51,0.54))
floor=material('Slate studio floor',(0.11,0.12,0.13))
gold=material('Warm copper stitch placeholder',(0.51,0.34,0.18))

def make_loft(name, rings, segs=48):
    """rings are (height, cx, rx, rz, cz). Loft each ring in world X/Y/Z."""
    vs=[]
    for h,cx,rx,rz,cz in rings:
        for s in range(segs):
            a=math.tau*s/segs
            vs.append((cx+rx*math.cos(a),cz+rz*math.sin(a),h))
    faces=[]
    faces.append(tuple(reversed(tuple(range(segs)))))
    for row in range(len(rings)-1):
        for s in range(segs):
            a=row*segs+s;b=row*segs+(s+1)%segs
            faces.append((a,b,b+segs,a+segs))
    faces.append(tuple((len(rings)-1)*segs+s for s in range(segs)))
    mesh=bpy.data.meshes.new(name+'_Mesh')
    mesh.from_pydata(vs,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    return obj

# These values reproduce the familiar moderately tapered 501 straight block.
# The knee/opening should not be confused with the waist label dimensions.
pelvis=make_loft('Upper waist and seat union source',[
    (.785,0,.193,.142,0),(.81,0,.195,.143,0),
    (.85,0,.198,.144,0),(.94,0,.185,.132,0),
    (1.035,0,.165,.119,0),(1.080,0,.152,.105,0),
])
legs=[]
for side in (-1,1):
    legs.append(make_loft(('Left' if side<0 else 'Right')+' straight leg union source',[
        (.015,side*.105,.065,.065,0),
        (.080,side*.105,.066,.066,0),
        (.410,side*.111,.071,.071,0),
        (.600,side*.110,.084,.086,0),
        (.785,side*.107,.107,.105,0),
        (.840,side*.105,.109,.106,0),
        (.915,side*.104,.105,.100,0),
    ]))

bpy.ops.object.select_all(action='DESELECT')
for obj in [pelvis,*legs]:obj.select_set(True)
bpy.context.view_layer.objects.active=pelvis
bpy.ops.object.join()
shell=pelvis
shell.name='MIKRISTIAN_501_W32L32_Manifold_Fit_Shell'
# SDF voxel union removes intersections between the pelvis and thigh tubes.
shell.data.remesh_voxel_size=.018
bpy.ops.object.voxel_remesh()

# Cut only the 3 end caps (waist and two hems), leaving a wearable open shell.
bm=bmesh.new();bm.from_mesh(shell.data)
remove=[]
for f in bm.faces:
    h=sum(v.co.z for v in f.verts)/len(f.verts)
    if h > 1.078 or h < .017:
        remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES')
bm.to_mesh(shell.data);bm.free();shell.data.update()

# Gentle knit-free surface cleanup without erasing the leg-opening geometry.
bpy.ops.object.select_all(action='DESELECT')
shell.select_set(True)
bpy.context.view_layer.objects.active=shell
smooth=shell.modifiers.new('Surface continuity', 'SMOOTH')
smooth.factor=.46;smooth.iterations=6
thickness=shell.modifiers.new('Rigid denim shell thickness','SOLIDIFY')
thickness.thickness=.0028;thickness.offset=-1
for p in shell.data.polygons:p.use_smooth=True
shell.data.materials.append(denim)
shell['fitting_status']='VISUAL ARRANGEMENT ONLY - NOT CLO/XPBD DRAPE'
shell['reference_size']='W32 x L32'
shell['target_opening_in']=16
shell['target_knee_in']=17.5
shell['reference_rise_in']=11.25
shell['original_manufacturer_pattern']=False

def ellipsoid(name, loc, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    ob=bpy.context.object;ob.name=name;ob.scale=scale
    ob.data.materials.append(dummy)
    for p in ob.data.polygons:p.use_smooth=True
    return ob

ellipsoid('Male torso', (0,0,1.43),(.235,.145,.40))
ellipsoid('Male neck',(0,0,1.72),(.07,.064,.11))
ellipsoid('Male head',(0,0,1.86),(.10,.115,.135))
ellipsoid('Male pelvis - hidden beneath jeans',(0,0,.93),(.173,.11,.17))
for side in (-1,1):
    ellipsoid(('Left' if side<0 else 'Right')+' arm',(side*.307,0,1.36),(.067,.068,.310))
    ellipsoid(('Left' if side<0 else 'Right')+' hand',(side*.321,0,1.026),(.052,.052,.09))
    # Keep anatomical shins wholly inside the 16-inch hem and 17.5-inch knee.
    # The previous .080 radius exceeded the jeans at mid-calf, causing white
    # mannequin bleed-through that looked like torn fabric.
    ellipsoid(('Left' if side<0 else 'Right')+' leg',(side*.110,0,.49),(.055,.058,.46))
    ellipsoid(('Left' if side<0 else 'Right')+' foot',(side*.110,.07,.052),(.075,.145,.045))

bpy.ops.mesh.primitive_plane_add(size=7,location=(0,0,-.027))
bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(floor)

world=bpy.context.scene.world
if world is None:
    world=bpy.data.worlds.new('Soft neutral studio')
    bpy.context.scene.world=world
world.color=(.13,.13,.13)
bpy.ops.object.light_add(type='AREA',location=(2,-2,3.3))
bpy.context.object.data.energy=900;bpy.context.object.data.size=3
bpy.ops.object.light_add(type='AREA',location=(-2,2,3.3))
bpy.context.object.data.energy=540;bpy.context.object.data.size=3

bpy.ops.object.camera_add(location=(3,-4,2.05))
cam=bpy.context.object;cam.name='Full body camera'
cam.data.lens=49
bpy.context.scene.camera=cam

def aim(pos,target=(0,0,1.0)):
    cam.location=pos
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()

bpy.context.scene.render.engine='BLENDER_EEVEE'
bpy.context.scene.render.resolution_x=900
bpy.context.scene.render.resolution_y=1100
bpy.context.scene.render.resolution_percentage=100

for label,pos in [
    ('FRONT',(.25,-4.2,1.87)),
    ('SIDE',(4.2,-.20,1.83)),
    ('BACK',(-2.25,4.0,1.87)),
]:
    aim(pos)
    bpy.context.scene.render.filepath=str(OUT/('jeans-501-w32l32-arranged-'+label.lower()+'.png'))
    bpy.ops.render.render(write_still=True)

blend=OUT/'jeans-501-w32l32-arranged-fit-reference.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))

# Print bounding-box and manifold-oriented diagnostics, but do not imply a
# collision simulation was performed. This is a visual size/pose target only.
print('ARRANGED_501_REFERENCE='+str(blend))
print('ARRANGED_501_UNION_VERTICES='+str(len(shell.data.vertices)))
print('ARRANGED_501_UNION_FACES='+str(len(shell.data.polygons)))
