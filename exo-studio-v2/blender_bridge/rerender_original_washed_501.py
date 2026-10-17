"""Re-render the *saved* 501 fitted shell with the original CLO acid-wash artwork.

This is a Blender visual material remap using assets extracted from the
user-owned REFERENCE_acidwash_pants_before_sim.zprj. It is NOT a fresh CLO
physics simulation and does not overwrite the ZPRJ or older Blender versions.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


def _interpolate(z, stops):
    if z <= stops[0][0]:
        return stops[0][1]
    for (za, a), (zb, b) in zip(stops, stops[1:]):
        if za <= z <= zb:
            t = (z - za) / (zb - za)
            t = t * t * (3 - 2 * t)
            return a * (1 - t) + b * t
    return stops[-1][1]


def refit_original_501_shell_to_intact_avatar(obj):
    """Correct the measured centerline offset between saved pants and avatar.

    In the saved source, the pant legs lie around x=+/-0.105 m at the hem,
    whereas the avatar legs lie around x=+/-0.214 m. The resulting ~11cm
    displacement exposed both bare avatar legs. Shift the *fabric*, not skin.
    The displacement decays smoothly from hem to high thigh, preserving the
    original pelvis/rise geometry and the source's actual 4791 mesh faces.
    """
    shift_stops = [
        (0.0, .107), (.12, .103), (.3, .083), (.48, .064),
        (.55, .044), (.65, .035), (.72, .021), (.80, .012),
        (.86, .004), (.92, 0.0), (1.1, 0.0),
    ]
    moved = 0
    for v in obj.data.vertices:
        pos = obj.matrix_world @ v.co
        z = pos.z
        if z < .95:
            side = -1 if pos.x < 0 else 1
            xmove = _interpolate(z, shift_stops)
            # Slightly taper the correction near the center-front/crotch.
            if z > .77:
                w = max(.4, min(1, abs(pos.x)/.085))
                xmove *= w
            pos.x += side * xmove
            # Check 3D skin-collision clearance: slightly fuller rigid denim.
            if z < .79:
                center_x = side * (.11 + xmove)
                pos.x += (pos.x-center_x)*.075
                pos.y = pos.y*1.13 - .006
            else:
                pos.y *= 1.035
            moved += 1
        # At the pelvis the source garment was narrower than the avatar's
        # belly (negative Y). Increase the FRONT surface clearance only.
        if z >= .79 and pos.y < 0:
            waist_w = _interpolate(z,[(.79,0.0),(.9,.65),(1.01,1.0),(1.08,1.0)])
            pos.y -= .027*waist_w
        v.co = obj.matrix_world.inverted() @ pos
    obj.data.update()
    obj['geometry_correction']='Adjusted jeans leg centerlines to intact Theo avatar; no cutaway skin'
    obj['refit_vertices']=moved
    return moved


def read_args():
    a=sys.argv[sys.argv.index('--')+1:]
    ap=argparse.ArgumentParser()
    for k in ('source','glb','wash','out'):
        ap.add_argument('--'+k,required=True)
    ap.add_argument('--render-size',type=int,default=960)
    return ap.parse_args(a)


def mat_color(name,rgba,roughness=.75):
    m=bpy.data.materials.new(name);m.diffuse_color=tuple(rgba);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=tuple(rgba)
    p.inputs['Roughness'].default_value=roughness
    return m


def wash_material(washpath):
    mat=mat_color('MIKRISTIAN / ORIGINAL CLO BLACK WHITE ACID WASH',(0.18,0.18,0.19,1),.89)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    shader=nodes.get('Principled BSDF');shader.inputs['Metallic'].default_value=0.0
    img=nodes.new('ShaderNodeTexImage');img.name='SOURCE: CLO PANTS TEXTURE.png washed denim'
    img.image=bpy.data.images.load(washpath, check_existing=True)
    img.interpolation='Linear';img.extension='REPEAT'
    img.location=(-640,180)
    rgb=nodes.new('ShaderNodeMixRGB');rgb.blend_type='MULTIPLY';rgb.inputs[0].default_value=.82
    rgb.inputs[2].default_value=(.34,.335,.34,1)
    rgb.location=(-320,200)
    links.new(img.outputs['Color'],rgb.inputs[1]);links.new(rgb.outputs[0],shader.inputs['Base Color'])
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=290
    noise.inputs['Detail'].default_value=2
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.11
    bump.inputs['Distance'].default_value=.0012
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    return mat


def uv_mapped_wash(obj):
    mesh=obj.data
    uv=mesh.uv_layers.new(name='Recovered CLO Denim UV (independent 3D remap)')
    for poly in mesh.polygons:
        pts=[obj.matrix_world@mesh.vertices[v].co for v in poly.vertices]
        mid=sum(pts,Vector((0,0,0)))/len(pts)
        # Mirror left and right legs on separate original washed CLO artwork
        # sections. No cut-sheet transparent background projects to skin.
        section=(0 if mid.x<0 else 2)+(0 if mid.y<=0 else 1)
        for li in poly.loop_indices:
            v=obj.matrix_world@mesh.vertices[mesh.loops[li].vertex_index].co
            if v.z < .79:
                cx=-.125 if v.x<0 else .125
                ang=math.atan2(v.y,v.x-cx)
                local=(ang+math.pi)/(2*math.pi)
            else:
                # Gentle wrap around the waist, consistent with 4 print panels.
                local=(math.atan2(v.y,v.x)+math.pi)/(2*math.pi)
            uv.data[li].uv=((section+(local*.97)+.01)/4.0,
                            max(.01,min(.99,v.z/1.10)))


def cylinder_stroke(name, xyz, material, thickness=.0013, close=False):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    curve.bevel_depth=thickness;curve.bevel_resolution=2
    segment=curve.splines.new('POLY');segment.points.add(len(xyz)-1)
    for i,p in enumerate(xyz):segment.points[i].co=(*p,1)
    segment.use_cyclic_u=close
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o)
    o.data.materials.append(material);return o


def look_at(o,p):
    o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()


def build():
    a=read_args()
    out=Path(a.out).expanduser().resolve();out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=a.source)
    # Keep the exact previously saved fitted 501 mesh, not the later loose
    # body-placement geometry.
    target=bpy.data.objects.get('MIKRISTIAN_501_W32L32_Manifold_Fit_Shell')
    if target is None:raise RuntimeError('Earlier saved 501 fitted mesh not found in source blend')
    previous=[]
    for o in list(bpy.data.objects):
        if o==target:continue
        if o.type=='MESH' and (o.name.startswith(('Male','Left','Right','Studio floor'))):
            previous.append(o.name)
            bpy.data.objects.remove(o,do_unlink=True)

    bpy.ops.import_scene.gltf(filepath=a.glb)
    body=bpy.data.objects.get('CD_Man_Body')
    if not body:raise RuntimeError('Human body mesh not present in saved avatar glb')
    dummy=bpy.data.objects.get('Icosphere')
    if dummy:bpy.data.objects.remove(dummy,do_unlink=True)
    body.name='Full Human Fitting Avatar - Theo (source asset)'
    # The shipped male avatar is about 1.86 m high, while the W32L32 shell
    # reference is in meters and waist sits at 1.07 m.
    for polygon in body.data.polygons:polygon.use_smooth=True
    # Keep the avatar's entire original body; the old workaround deleted
    # everything below the waist and so never actually solved leg fit.
    original_body_verts = len(body.data.vertices)
    corrected_garment_vertices = refit_original_501_shell_to_intact_avatar(target)
    body.data.materials.clear()
    body.data.materials.append(mat_color('Natural warm mannequin complexion',(0.53,.365,.295,1),.84))
    # Shoes follow the actual avatar's ankle centers, ~+/-0.21m, rather than
    # the incorrectly centered jeans leg positions used by the old render.
    sneaker=mat_color('Offwhite sneaker leather',(.73,.725,.71,1),.77)
    sole=mat_color('Offwhite sneaker sole',(.85,.84,.80,1),.90)
    for side,label in ((-1,'Left'),(1,'Right')):
        for kind,loc,scale,smat in [
            ('Sneaker',(side*.211,-.046,.050),(.089,.151,.056),sneaker),
            ('Rubber Midsole',(side*.211,-.053,.023),(.096,.158,.027),sole),
        ]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc)
            shoe=bpy.context.object;shoe.name=f'{label} {kind}'
            shoe.scale=scale;shoe.data.materials.append(smat)
            for face in shoe.data.polygons:face.use_smooth=True

    garment=wash_material(a.wash)
    target.data.materials.clear();target.data.materials.append(garment)
    uv_mapped_wash(target)
    for poly in target.data.polygons:poly.use_smooth=True
    target['material_source']='Original CLO REFERENCE_acidwash_pants_before_sim.zprj / PANTS TEXTURE.png'
    target['simulation_source']='Saved 501 fitted mesh from jeans-501-w32l32-arranged-fit-reference.blend'
    target['native_clo_worn_simulation_confirmed']=False
    target['sourceAvatarVerticesPreserved']=original_body_verts
    target['refitGarmentVertices']=corrected_garment_vertices

    # Thread colour echoes the preserved original washed CLO jeans' red seams.
    thread=mat_color('Deep Red Selvedge Stitch',(0.46,.062,.048,1))
    hardware=mat_color('Matte smoked metal buttons',(0.21,.205,.20,1),.36)
    # Avoid an unsupported floating elliptical waistband. The original saved
    # CLO cut has specific waist geometry; generic outer rings did not follow
    # that contour and looked visibly detached in the preliminary render.
    # Fly stitch and hardware only on the front negative-Y surface.
    cylinder_stroke('Button fly J seam in red',
         [(.015-.032*math.sin(i*math.pi/60),-.135,1.036-i*.0037) for i in range(34)],thread,.00145)
    for i in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=(0,-.134,1.035-i*.044))
        o=bpy.context.object;o.name='Button Fly Metal %d'%(i+1)
        o.scale=(.004,.0018,.004);o.data.materials.append(hardware)
    for side in (-1,1):
        # Red side stripe / selvedge stitch, inspired by original acidwash.
        pts=[(side*(.242-.025*(j/72)+.004*math.sin(math.pi*j/72)),
              .011, .06+j*.0132) for j in range(72)]
        cylinder_stroke(('Left' if side==-1 else 'Right')+' outer selvedge seam',pts,thread,.0016)

    # Replace the earlier plain studio with a photographic neutral backdrop.
    studio=mat_color('Grey seamless studio',(0.54,.545,.56,1),.9)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.014))
    bpy.context.object.name='Studio Sweep / Floor'
    bpy.context.object.data.materials.append(studio)
    for pos,watts,size in [((2,-3,3.4),1200,2.1),((-2,2,2.9),1500,3.0),((.1,3.3,2.5),500,2.0)]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        l=bpy.context.object;l.data.energy=watts;l.data.shape='DISK';l.data.size=size
        look_at(l,(0,0,1.15))
    world=bpy.context.scene.world
    if world is None:
        world=bpy.data.worlds.new('Acid Wash Studio World');bpy.context.scene.world=world
    world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.28,.3,.33,1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.5

    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=12
    scene.cycles.use_denoising=True
    scene.render.resolution_x=int(a.render_size*.82)
    scene.render.resolution_y=a.render_size
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.view_settings.view_transform='AgX'
    scene['work_product']='Re-render based on earlier saved 501 fitted shell and recovered original acidwash fabric'
    scene['is_original_saved_clo_simulation']=False
    scene['original_clo_reference_preserved']=True
    camera=scene.camera
    if camera is None:
        bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera
    camera.data.type='ORTHO';camera.data.ortho_scale=1.53

    blend=out/'501_Washed_Original_Artwork_OnBody_Rerender.blend'
    outputs={}
    for view,at in [('front',(0,-3.8,.95)),('back',(0,3.8,.95)),('threequarter',(2.4,-3.8,1.06))]:
        camera.location=at;look_at(camera,(0,0,.69))
        scene.render.filepath=str(out/f'501_Acidwashed_OnBody_{view}.png')
        bpy.ops.render.render(write_still=True)
        outputs[view]=scene.render.filepath
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    report={'status':'blender material re-render from saved fitting shell',
            'original_saved_render_preserved':True,
            'baseFittedSource':a.source,'originalCLOFabricArt':a.wash,
            'avatar':'theo.glb / CD_Man_Body (removed Icosphere)',
            'CLOClothSimulationValidated':False,
            'renderedImages':outputs,'blend':str(blend),
            'removedEarlierProxyObjects':previous}
    (out/'RENDER_PROVENANCE.json').write_text(json.dumps(report,indent=2)+'\n')
    print('WASHED_501_RENDER_SUCCESS='+json.dumps(report))


if __name__=='__main__':build()
