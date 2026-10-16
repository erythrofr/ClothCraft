"""Make an anatomically placed 501-style straight jean fitting reference.

This is an independently modelled *body-wrapped 3D placement guide*, NOT a
CLO3D sewn/solved simulation or the official Levi's cutting pattern. It exists
to validate where four panels should wrap, and to keep the placement target
available while the CLO7 login service is unavailable.

Run: Blender --background -t 4 --python this.py -- --out <folder>
"""

import argparse
import json
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


def between(z, samples):
    if z <= samples[0][0]:
        return samples[0][1:]
    for a, b in zip(samples, samples[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            t = t * t * (3 - 2 * t)
            return tuple(v + (w - v) * t for v, w in zip(a[1:], b[1:]))
    return samples[-1][1:]


LEG_SECTIONS = [
    # z, x-centre, x-radius, front/back radius
    (0.035, 0.124, 0.0650, 0.0645),  # 40.7-cm hem perimeter
    (0.440, 0.124, 0.0710, 0.0710),  # 44.6-cm knee perimeter
    (0.640, 0.123, 0.0980, 0.1000),
    (0.765, 0.121, 0.1050, 0.1130),
    (0.805, 0.119, 0.1060, 0.1130),
    # Tuck each leg envelope INSIDE the pelvic volume above the inseam.
    # This hides the previous straight horizontal thigh/cuff artifact.
    (0.920, 0.105, 0.0730, 0.0790),
]
HIP_SECTIONS = [
    (0.735, 0.155, 0.098),
    (0.780, 0.185, 0.123),
    (0.860, 0.202, 0.141),
    (0.970, 0.178, 0.120),
    (1.065, 0.157, 0.104),  # ~82 cm waistband circumference
]


def material(name, color, roughness=0.85):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def ring_mesh(name, sections, formula, radial=96, material_override=None):
    verts = []
    faces = []
    for row, z in enumerate(sections):
        for i in range(radial):
            angle = i * math.tau / radial
            verts.append(formula(z, angle))
            if row:
                j = (i + 1) % radial
                a = (row - 1) * radial + i
                b = (row - 1) * radial + j
                c = row * radial + j
                d = row * radial + i
                faces.append((a, b, c, d))
    # Cap at EACH TUBE'S OWN center. Centering the cap at global x=0 would
    # incorrectly bridge the two leg tubes at the hem/crotch.
    a = len(verts)
    verts.append((sum(verts[i][0] for i in range(radial)) / radial,
                  sum(verts[i][1] for i in range(radial)) / radial, sections[0]))
    b = len(verts)
    first = (len(sections) - 1) * radial
    verts.append((sum(verts[first+i][0] for i in range(radial)) / radial,
                  sum(verts[first+i][1] for i in range(radial)) / radial, sections[-1]))
    for i in range(radial):
        j = (i + 1) % radial
        faces.append((a, j, i))
        last = (len(sections) - 1) * radial
        faces.append((b, last + i, last + j))
    mesh = bpy.data.meshes.new(name + ' Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if material_override:
        mesh.materials.append(material_override)
    return obj


def cylinder_of_leg(side, z, angle):
    c, rx, ry = between(z, LEG_SECTIONS)
    return (side * c + rx * math.cos(angle), ry * math.sin(angle), z)


def cylinder_of_hip(z, angle):
    rx, ry = between(z, HIP_SECTIONS)
    return (rx * math.cos(angle), ry * math.sin(angle), z)


def stroke(name, points, mat, width=0.0018, cyclic=False):
    curve = bpy.data.curves.new(name, type='CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 16
    curve.bevel_depth = width
    curve.bevel_resolution = 2
    spl = curve.splines.new('POLY')
    spl.points.add(len(points) - 1)
    for dst, src in zip(spl.points, points):
        dst.co = (*src, 1)
    spl.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def ellipsoid(name, center, dimensions, mat, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=16, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for f in obj.data.polygons:
        f.use_smooth = True
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def face_y(z, x, front=True, extra=0.002):
    rx, ry = between(z, HIP_SECTIONS)
    ratio = max(-0.999, min(0.999, x / rx))
    return (-1 if front else 1) * (ry * math.sqrt(1 - ratio * ratio) + extra)


def prepare_scene(output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 820
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    if scene.world is None:
        scene.world = bpy.data.worlds.new('501 Fitting Studio World')
    scene.world.color = (0.17, 0.19, 0.22)
    cloth = material('MIKRISTIAN | Rigid Indigo Cotton Denim', (0.031, 0.060, 0.12))
    cotton = material('Warm Gold Jeans Topstitch', (0.73, 0.45, 0.23))
    dark = material('Jean seams dark indigo', (0.017, 0.025, 0.044))
    skin = material('Matte male fitting avatar', (0.67, 0.65, 0.61))
    floor_mat = material('Studio grey', (0.16, 0.17, 0.19))

    # Combine THREE closed design volumes as one envelope. Voxel remesh makes
    # an actual bifurcated leg/crotch surface rather than two overlapping flat
    # sheets from the prior failed XPBD preview.
    legs = []
    zs = [0.035 + (0.920 - 0.035) * i / 65 for i in range(66)]
    for side, name in [(-1, 'Left Leg Envelope'), (1, 'Right Leg Envelope')]:
        legs.append(ring_mesh(name, zs, lambda z, a, s=side: cylinder_of_leg(s, z, a), material_override=cloth))
    waist = ring_mesh('Pelvic Jeans Envelope',
        [0.735 + (1.065 - 0.735) * i / 32 for i in range(33)], cylinder_of_hip, material_override=cloth)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [*legs, waist]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = waist
    bpy.ops.object.join()
    jean = bpy.context.object
    jean.name = '501 Straight Jeans | Joined On-Body Envelope'
    jean.data.remesh_voxel_size = 0.0045
    bpy.ops.object.voxel_remesh()
    smooth = jean.modifiers.new('Subtle Denim Contour Relaxation', 'SMOOTH')
    smooth.factor = 0.55
    smooth.iterations = 3
    for face in jean.data.polygons:
        face.use_smooth = True
    jean['garment_status'] = 'anatomically wrapped 3D placement reference, not a CLO or physics simulation'
    jean['reference_fit'] = '501-inspired W32 L32 regular thigh straight leg'

    # Five-pocket and fly placement guides. These are visual references and
    # not a replacement for independently sewn CLO pocket patterns.
    for z in (1.055, 1.017):
        rx, ry = between(z, HIP_SECTIONS)
        stroke('Waist band perimeter %.3f' % z,
               [(rx * math.cos(a) * 1.014, ry * math.sin(a) * 1.014, z)
                for a in [i * math.tau / 126 for i in range(126)]], cotton, 0.0015, cyclic=True)
    for sign, side in [(-1, 'L'), (1, 'R')]:
        front_rim = []
        for t in range(25):
            f = t / 24
            x = sign * (0.148 - f * 0.066)
            z = 1.005 - 0.065 * math.sin(f * math.pi / 2)
            front_rim.append((x, face_y(z, x, front=True), z))
        stroke(side + ' Five Pocket Curved Mouth', front_rim, cotton, 0.0022)
        for x, z in [(sign * 0.143, 1.0), (sign * 0.084, 0.943)]:
            ellipsoid(side + ' copper rivet', (x, face_y(z, x, True, 0.007), z),
                      (0.004, 0.0023, 0.004), cotton, 12)

        xmid = sign * 0.105
        outline = []
        for ox, z in [(-0.051,0.935),(0.051,0.935),(0.048,0.805),(0,0.779),(-0.048,0.805),(-0.051,0.935)]:
            x = xmid + sign * ox
            outline.append((x, face_y(z,x,False,0.003),z))
        stroke(side + ' Rear Pointed Patch Pocket',outline,cotton,0.0021)
        for shift in [-0.012,0.012]:
            row = []
            for t in range(24):
                f=t/23
                x=xmid+sign*((f-0.5)*0.07)
                z=0.88-0.026*(1-(2*f-1)**2)+shift
                row.append((x,face_y(z,x,False,0.006),z))
            stroke(side+' rear pocket arch stitch '+str(shift),row,cotton,0.00145)

    fly = []
    for t in range(32):
        f=t/31
        z=1.03-f*.208
        x=-0.004-0.026*(1-(2*f-1)**2)
        fly.append((x, face_y(max(0.755,z),x,True,0.005),z))
    stroke('501 button fly J-shaped topstitch guide',fly,cotton,0.0023)

    for z in [0.035,0.057]:
        for side in (-1,1):
            c,rx,ry=between(z,LEG_SECTIONS)
            stroke('Hem fold stitching side %s height %.3f'%(side,z),
                   [(side*c+rx*math.cos(i*math.tau/72),ry*math.sin(i*math.tau/72),z)
                    for i in range(72)], cotton,0.0015,cyclic=True)

    # Neutral male fitting-body proxy: only an anatomical reference, separate
    # from and not pretending to be the proprietary CLO avatar.
    ellipsoid('Avatar Male Torso', (0,0,1.36), (0.206,0.126,0.345),skin)
    ellipsoid('Avatar Male Pelvis', (0,0,0.965), (0.159,0.109,0.187),skin)
    ellipsoid('Avatar Neck',(0,0,1.69),(.062,.063,.095),skin)
    ellipsoid('Avatar Head',(0,0,1.802),(.106,.095,.128),skin)
    for side in (-1,1):
        ellipsoid('Avatar Arm %s'%side,(side*.265,0,1.37),(.07,.075,.30),skin)
        ellipsoid('Avatar Forearm %s'%side,(side*.30,-.01,1.03),(.058,.059,.23),skin)
        ellipsoid('Avatar Leg %s'%side,(side*.124,0,.45),(.060,.060,.44),skin)
        ellipsoid('Avatar Foot %s'%side,(side*.124,-.052,.049),(.092,.150,.047),skin)

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0,0,-.007))
    bpy.context.object.name='Fitting Studio Floor'
    bpy.context.object.data.materials.append(floor_mat)
    for pos,power,area in [((2,-2.5,3.3),860,2.1),((-2,1,2.7),700,2.6)]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        obj=bpy.context.object
        obj.data.energy=power
        obj.data.shape='DISK'
        obj.data.size=area
        look_at(obj,(0,0,1))

    bpy.ops.object.camera_add()
    camera=bpy.context.object
    camera.name='501 Fit Verification Camera'
    scene.camera=camera
    scene['jeans_reference_source'] = 'independently modeled 501 straight silhouette W32L32'
    scene['jeans_fit_verified_in_CLO'] = False
    scene['jeans_cloth_simulated'] = False
    scene['jeans_placement_status'] = 'on-body wrap guide; topology and proportions only'

    output.mkdir(parents=True,exist_ok=True)
    blend=output/'501_W32L32_AnatomicalPlacementReference_V2.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    rendered={}
    for label,position in [('front',(0,-3.05,1.13)),('back',(0,3.05,1.13)),('side',(3.05,-0.08,1.13))]:
        camera.location=position
        look_at(camera,(0,0,.94))
        scene.render.filepath=str(output/f'501_W32L32_BodyPlacement_{label}.png')
        bpy.ops.render.render(write_still=True)
        rendered[label]=scene.render.filepath
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    mesh=jean.data
    bm=bmesh.new();bm.from_mesh(mesh)
    loose=sum(1 for e in bm.edges if len(e.link_faces)==0)
    bad=sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    report={
        'type':'3D anatomical fit/arrangement reference; not native CLO simulation',
        'jeansBodyWrapCompleted':True,
        'CLOSimulationVerified':False,
        'fitLabel':'W32 L32 501-inspired straight leg',
        'frontRiseReferenceCm':28.575,
        'estimatedWaistCircumferenceCm':82.5,
        'kneePerimeterReferenceCm':44.45,
        'legOpeningReferenceCm':40.64,
        'renderedViews':rendered,'blend':str(blend),
        'meshFaces':len(mesh.polygons),'nonManifoldEdges':bad,'looseEdges':loose,
        'manualCloNextStep':'Load 501 native V7 once CLO login works, assign front/back leg arrangement slots using guarded SDK then simulate',
    }
    (output/'501_BodyPlacement_Validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print('501_PLACEMENT_RESULT='+json.dumps(report))


if __name__=='__main__':
    import sys
    a=sys.argv
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',required=True)
    args=parser.parse_args(a[a.index('--')+1:] if '--' in a else [])
    prepare_scene(Path(args.out).expanduser().resolve())
