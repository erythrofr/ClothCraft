"""Second S01-only authored geometry pass. Run with Blender -b --python this file."""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/stage-refined-blender-sources/EXO_STAGE_S01_REFINED.blend'
OUT = ROOT / 'public/stage-scenes/S01.glb'
bpy.ops.wm.open_mainfile(filepath=str(SRC))
if bpy.context.scene.get('s01_showroom_pass_v2') or any(o.name.startswith('S01 botanical 0 sculpted leaf') for o in bpy.data.objects):
    raise RuntimeError('S01 second showroom pass already applied; reopen pristine refined scene before regenerating')
before = [o for o in bpy.data.objects if o.type == 'MESH']
before_polys = sum(len(o.data.polygons) for o in before)
for obj in list(bpy.data.objects):
    if obj.type == 'MESH' and (obj.name.startswith(('Foliage volume','Garden planter','Shooting plinth','Studio daylight reflector white card'))):
        bpy.data.objects.remove(obj, do_unlink=True)

def mat(name, rgb, rough=.7, metal=0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    return m

terracotta = mat('S01 smoked ceramic pot', (.17,.185,.17),.69)
darksoil = mat('S01 organic soil',(.08,.071,.053),.98)
stem = mat('S01 leaf stems',(.12,.20,.11),.84)
leaf_a = mat('S01 foliage waxy deep green',(.105,.23,.125),.66)
leaf_b = mat('S01 foliage sage',(.19,.33,.17),.7)
leaf_c = mat('S01 foliage olive',(.25,.34,.19),.76)
brass = mat('S01 satin bronze fixtures',(.40,.30,.18),.38,.73)
charcoal = mat('S01 anodized aluminum',(.105,.112,.118),.47,.61)
fabric = mat('S01 acoustic ivory textile panels',(.47,.45,.41),.95)
diffuser = mat('S01 frosted lamp lens',(.72,.70,.64),.58)
wood = mat('S01 walnut slatted panel',(.26,.19,.14),.75)
stone = mat('S01 warm limestone skirting',(.42,.405,.37),.85)

def mesh(name, verts, faces, material):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    for f in obj.data.polygons: f.use_smooth=True
    return obj

def cube(name, loc, size, material, bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob=bpy.context.object
    ob.name=name
    ob.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(material)
    if bevel:
        m=ob.modifiers.new('Soft manufactured radii','BEVEL')
        m.width=bevel
        m.segments=2
        ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return ob

def cylinder(name, loc, radius, depth, material, verts=16, radius_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=radius,radius2=radius if radius_top is None else radius_top,depth=depth,location=loc)
    obj=bpy.context.object
    obj.name=name
    obj.data.materials.append(material)
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def connector(name, start, end, radius, material):
    a,b=Vector(start),Vector(end)
    midpoint=(a+b)*.5
    ob=cylinder(name,midpoint,radius,(b-a).length,material,10)
    ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return ob

def leaf(name, base, tip, width, material):
    a,b=Vector(base),Vector(tip)
    direction=(b-a).normalized()
    perpendicular=direction.cross(Vector((0,0,1)))
    if perpendicular.length<.15: perpendicular=direction.cross(Vector((1,0,0)))
    perpendicular.normalize()
    length=(b-a).length
    middle=a+(b-a)*.55 + Vector((0,0,.045))
    verts=[tuple(a),tuple(a+(b-a)*.21+perpendicular*width*.54),
      tuple(middle+perpendicular*width),tuple(a+(b-a)*.83+perpendicular*width*.46),
      tuple(b),tuple(a+(b-a)*.83-perpendicular*width*.46),
      tuple(middle-perpendicular*width),tuple(a+(b-a)*.21-perpendicular*width*.54),
      tuple(middle+Vector((0,0,.035)))]
    faces=[(0,1,8),(1,2,8),(2,3,8),(3,4,8),(4,5,8),(5,6,8),(6,7,8),(7,0,8)]
    ob=mesh(name,verts,faces,material)
    ob.modifiers.new('Leaf double sided solidity','SOLIDIFY').thickness=.006
    return ob

def plant(index,x,y,scale,seed):
    rng=random.Random(seed)
    radius=.31*scale
    cylinder(f'S01 planter {index} ceramic vessel',(x,y,.32*scale),radius,.64*scale,terracotta,32,radius_top=radius*1.1)
    cylinder(f'S01 planter {index} interior soil',(x,y,.632*scale),radius*.96,.014,darksoil,32)
    cylinder(f'S01 planter {index} rolled rim',(x,y,.64*scale),radius*1.12,.043*scale,terracotta,32)
    for branch in range(9):
        theta=2*math.pi*branch/9+rng.uniform(-.12,.12)
        r=rng.uniform(.23,.58)*scale
        h=rng.uniform(1.35,2.15)*scale
        start=(x+r*.13*math.cos(theta),y+r*.13*math.sin(theta),.65*scale)
        end=(x+r*math.cos(theta),y+r*math.sin(theta),h)
        connector(f'S01 botanical {index} branching stem',start,end,.012*scale,stem)
        for rank in range(5):
            zfrac=.23+rank*.155
            anchor=Vector(start).lerp(Vector(end),zfrac)
            leaf_theta=theta+(-1 if rank%2 else 1)*.89
            radial=.38*scale+rng.uniform(-.07,.11)*scale
            leaf_tip=anchor+Vector((math.cos(leaf_theta)*radial,math.sin(leaf_theta)*radial,(rank*.045+.08)*scale))
            material=[leaf_a,leaf_b,leaf_c][(rank+branch)%3]
            leaf(f'S01 botanical {index} sculpted leaf',anchor,leaf_tip,.11*scale,material)

# Fewer focal plants, physically separated from the center garment position.
for i,(x,y,size) in enumerate([(-3.83,2.05,1.05),(3.75,2.55,1.16),(-3.65,-.95,.87),(3.65,-1.0,.93)]):
    plant(i,x,y,size,1901+i)

# Architectural wall junction, shallow slatted walnut bays, and framed acoustic felt.
for x in (-4.83,4.83):
    cube('S01 sidewall continuous skirting',(x,0,.16),(.085,7.8,.29),stone,.018)
    cube('S01 sidewall bronze top reveal',(x,0,.32),(.026,7.8,.018),brass,.004)
cube('S01 rear continuous toe reveal',(0,3.74,.16),(8.8,.09,.32),stone,.012)
for x in (-3.5,3.5):
    cube('S01 walnut feature backing',(x,3.70,2.25),(1.65,.1,3.70),charcoal,.013)
    for k in range(10):
        offset=(k-4.5)*.154
        cube('S01 individual walnut fluted stile',(x+offset,3.59,2.26),(.085,.095,3.6),wood,.018)
for x in (-2.35,2.35):
    cube('S01 framed wool acoustic backdrop',(x,3.57,2.57),(1.12,.10,3.2),fabric,.027)
    for z in (1.05,4.08):
        cube('S01 acoustic surround bronze header',(x,3.51,z),(1.16,.05,.028),brass,.005)

# Ceiling fixtures are solid track housings with modeled downward lenses.
for x in (-2.75,0,2.75):
    cube('S01 architectural linear ceiling track',(x,-.15,4.84),(.115,6.7,.11),charcoal,.018)
    for y in (-2.5,-.9,.8,2.35):
        cylinder('S01 aimable spot fixture',(x,y,4.67),.14,.24,charcoal,24,radius_top=.105)
        cylinder('S01 recessed lens diffuser',(x,y,4.535),.102,.014,diffuser,24)
        cylinder('S01 spot fixture bronze reveal',(x,y,4.575),.125,.028,brass,24)
for y in (-3.67,3.71):
    cube('S01 precise floor perimeter expansion reveal',(0,y,.015),(9.14,.012,.006),charcoal,.001)
for x in (-4.59,4.59):
    cube('S01 precise floor side expansion reveal',(x,0,.015),(.012,7.4,.006),charcoal,.001)

meshes=[o for o in bpy.data.objects if o.type=='MESH' and not o.hide_render]
bpy.context.scene['s01_showroom_pass_v2'] = True
print('S01_DELTA',json.dumps({'before_meshes':len(before),'before_polygons':before_polys,'after_meshes':len(meshes),'after_polygons':sum(len(o.data.polygons) for o in meshes),'plants':4,'sculpted_leaves':sum('sculpted leaf' in o.name for o in meshes)}),flush=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SRC),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_lights=False,export_cameras=False,export_animations=False)
print('S01_GLB_BYTES',OUT.stat().st_size,flush=True)
manifest_path=ROOT/'public/stage-scenes/manifest.json'
manifest=json.loads(manifest_path.read_text())
record=next(s for s in manifest['stages'] if s['id']=='S01')
record.update(bytes=OUT.stat().st_size,meshes=len(meshes),polygons=sum(len(o.data.polygons) for o in meshes),
              materials=len({m.name for ob in meshes for m in ob.data.materials if m}),
              provenance='EXO-authored S01 refined showroom pass; source original retained',status='ready')
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
