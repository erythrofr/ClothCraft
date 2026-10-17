"""Generate original EXO hanger studio render thumbnails using Blender.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b -t 2 --python scripts/generate-hanger-assets.py
"""
import bpy
import math
import os
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "public" / "hangers"
OUT.mkdir(parents=True, exist_ok=True)

def material(name, rgb, metallic=0, roughness=.4):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb,1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if name == "wood":
        noise = mat.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value=6
        noise.inputs["Detail"].default_value=3
        tex=mat.node_tree.nodes.new("ShaderNodeTexCoord")
        mapping=mat.node_tree.nodes.new("ShaderNodeVectorMath")
        mapping.operation="MULTIPLY"
        mapping.inputs[1].default_value=(.8,19,2)
        mat.node_tree.links.new(tex.outputs["Generated"],mapping.inputs[0])
        mat.node_tree.links.new(mapping.outputs[0],noise.inputs["Vector"])
        ramp=mat.node_tree.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position=.2
        ramp.color_ramp.elements[0].color=(.12,.042,.014,1)
        ramp.color_ramp.elements[1].position=.8
        ramp.color_ramp.elements[1].color=(.51,.25,.105,1)
        mat.node_tree.links.new(noise.outputs["Fac"],ramp.inputs[0])
        mat.node_tree.links.new(ramp.outputs[0],bsdf.inputs["Base Color"])
    return mat

def curve(name, pts, radius, mat):
    data=bpy.data.curves.new(name,"CURVE")
    data.dimensions="3D"
    data.resolution_u=30
    data.bevel_depth=radius
    data.bevel_resolution=4
    spline=data.splines.new("BEZIER")
    spline.bezier_points.add(len(pts)-1)
    for bp,point in zip(spline.bezier_points,pts):
        bp.co=point
        bp.handle_left_type=bp.handle_right_type="AUTO"
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def carved_wood_shoulder(mat):
    """Solid beveled wooden stock rather than a bent wire shape."""
    outline=[(-.89,-.09),(-.83,.05),(-.37,.42),(-.09,.45),(0,.46),
             (.09,.45),(.37,.42),(.83,.05),(.89,-.09),(.83,-.17),
             (.56,0),(.18,.23),(0,.27),(-.18,.23),(-.56,0),(-.83,-.17)]
    data=bpy.data.curves.new("milled wooden profile","CURVE")
    data.dimensions="2D"
    data.fill_mode="BOTH"
    data.resolution_u=32
    data.extrude=.055
    data.bevel_depth=.014
    data.bevel_resolution=4
    spline=data.splines.new("BEZIER")
    spline.bezier_points.add(len(outline)-1)
    spline.use_cyclic_u=True
    for bp,(x,y) in zip(spline.bezier_points,outline):
        bp.co=(x,y,0)
        bp.handle_left_type=bp.handle_right_type="AUTO"
    obj=bpy.data.objects.new("carved solid wooden hanger",data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)

def create(variant):
    wood=material("wood",(.52,.26,.1),roughness=.32)
    steel=material("brushed nickel",(.67,.72,.77),metallic=.92,roughness=.22)
    chrome=material("chrome",(.78,.82,.87),metallic=1,roughness=.13)
    velvet=material("black velvet",(.018,.024,.032),roughness=.95)
    satin=material("padded black satin",(.08,.085,.10),roughness=.4)
    fabric=velvet if variant=="velvet" else satin
    body={"wood":wood,"chrome":chrome,"velvet":velvet,"padded":satin}[variant]
    shoulder=[(-.9,-.12,0),(-.62,.09,0),(-.28,.36,0),(0,.43,0),(.28,.36,0),(.62,.09,0),(.9,-.12,0)]
    if variant=="wood": carved_wood_shoulder(body)
    else: curve("sculpted shoulders",shoulder, {"chrome":.014,"velvet":.048,"padded":.085}[variant],body)
    curve("crossbar",[(-.85,-.12,0),(-.65,-.45,0),(0,-.47,0),(.65,-.45,0),(.85,-.12,0)],.013 if variant=="chrome" else .029, steel if variant=="chrome" else body)
    if variant=="padded":
        curve("stitched piping",[(x,y,.082) for x,y,_ in shoulder],.009,material("seam",(.23,.23,.26),roughness=.8))
    if variant in {"wood","velvet"}:
        for sign in [-1,1]:
            curve("strap notch",[(sign*.69,.015,.02),(sign*.76,-.015,.02),(sign*.8,.005,.02)],.014,steel if variant=="velvet" else wood)
    curve("hook",[(0,.4,0),(0,.61,0),(.12,.79,0),(.27,.7,0),(.22,.52,0)],.028,steel)
    curve("hook collar",[(0,.42,-.04),(0,.42,.04)],.055,steel)

def setup():
    world=bpy.context.scene.world
    world.color=(.015,.017,.021)
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.samples=24
    scene.render.resolution_x=400
    scene.render.resolution_y=300
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    camera_data=bpy.data.cameras.new("Camera")
    camera=bpy.data.objects.new("Camera",camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location=(0,.08,6)
    target=Vector((0,.08,0))
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
    camera_data.type="ORTHO"
    camera_data.ortho_scale=2.6
    scene.camera=camera
    for name,location,power,size in [("softbox left",(-3,-4,5),750,4),("rim",(3,1,4),950,3)]:
        d=bpy.data.lights.new(name,"AREA")
        d.energy=power
        d.shape="DISK"
        d.size=size
        o=bpy.data.objects.new(name,d)
        bpy.context.collection.objects.link(o)
        o.location=location
        o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat("-Z","Y").to_euler()
    floor_mat=material("dark charcoal backdrop",(.009,.010,.012),roughness=.95)
    nodes=floor_mat.node_tree.nodes
    nodes.clear()
    emission=nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value=(.012,.013,.016,1)
    emission.inputs["Strength"].default_value=1
    output=nodes.new("ShaderNodeOutputMaterial")
    floor_mat.node_tree.links.new(emission.outputs[0],output.inputs["Surface"])
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.76))
    floor=bpy.context.object
    floor.data.materials.append(floor_mat)
    floor.rotation_euler=(0,0,0)
    scene.view_settings.view_transform="AgX"

for variant in [v for v in ["wood","chrome","velvet","padded","trouser-clip"] if not os.environ.get('EXO_HANGER_VARIANT') or os.environ['EXO_HANGER_VARIANT']==v]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablock in bpy.data.materials: bpy.data.materials.remove(datablock)
    setup()
    if variant in {"wood","trouser-clip"}:
        source="innerscene-shoulder-form.glb" if variant=="wood" else "innerscene-clip-rail.glb"
        bpy.ops.import_scene.gltf(filepath=str(OUT/source))
        bpy.context.view_layer.update()
        imports=[obj for obj in bpy.context.scene.objects if obj.type=="MESH" and obj.name!="Plane"]
        if not imports: raise RuntimeError("Imported trouser clip GLB contains no renderable mesh")
        bounds=[obj.matrix_world @ Vector(v) for obj in imports for v in obj.bound_box]
        lo=Vector((min(p.x for p in bounds),min(p.y for p in bounds),min(p.z for p in bounds)))
        hi=Vector((max(p.x for p in bounds),max(p.y for p in bounds),max(p.z for p in bounds)))
        center=(lo+hi)/2
        scale=1.7/max(hi.x-lo.x,.001)
        for obj in bpy.context.scene.objects:
            if obj.name not in {"Camera","Plane","softbox left","rim"} and obj.parent is None:
                obj.location=(obj.location-center)*scale
                obj.scale*=scale
        cam=bpy.context.scene.camera
        cam.location=(0,-6,.45) if variant=="wood" else (1.15,-6,.65)
        cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat("-Z","Y").to_euler()
        cam.data.ortho_scale=1.95 if variant=="wood" else 2.18
        backdrop=bpy.data.objects.get('Plane')
        if backdrop:
            # Imported glTF geometry is Z-up in Blender; put the unlit dark
            # studio backdrop behind the model, facing the portrait camera.
            backdrop.rotation_euler=(math.pi/2,0,0)
            backdrop.location=(0,2,0)
    else: create(variant)
    bpy.context.scene.render.filepath=str(OUT/f"{variant}.png")
    bpy.ops.render.render(write_still=True)
    print("GENERATED",variant,(OUT/f"{variant}.png").stat().st_size)
