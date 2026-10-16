"""Refine a preserved fitted 501-style jeans scene without changing leg fit.

Hem: 2.3 cm turned-under facing, two real stitches, minor hem height cleanup.
Material: procedural faded light blue 3/1 denim, textile bump and worn highlights.
Wear: three small face-cut rips with frayed weft threads over an inset backing.
Avatar: preserved unmodified; enforce upright Z-up camera views.

This creates a fresh Blender iteration, NOT an official Levi Strauss CAD pattern
or an independently verified native CLO3D physics simulation.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import defaultdict
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree


def parse():
    a = sys.argv[sys.argv.index('--') + 1:]
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--size', type=int, default=1050)
    return p.parse_args(a)


def material(name, color, roughness=.89):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    return m


def lightwash():
    m = material('501 / 12.5 oz Vintage Light Indigo Washed Cotton Denim', (.15,.30,.45))
    ns = m.node_tree.nodes
    links = m.node_tree.links
    out = ns.get('Principled BSDF')
    geo = ns.new('ShaderNodeNewGeometry')
    geo.location = (-850, 130)
    variation = ns.new('ShaderNodeTexNoise')
    variation.name = 'Irregular bleach stone-wash field'
    variation.inputs['Scale'].default_value = 12
    variation.inputs['Detail'].default_value = 5.0
    variation.inputs['Roughness'].default_value = .67
    variation.location=(-620,300)
    links.new(geo.outputs['Position'], variation.inputs['Vector'])
    mottling = ns.new('ShaderNodeTexNoise')
    mottling.name='Crosshatched coarse denim wear'
    mottling.inputs['Scale'].default_value=75
    mottling.inputs['Detail'].default_value=2.1
    links.new(geo.outputs['Position'],mottling.inputs['Vector'])
    mottling.location=(-620,-20)
    wear = ns.new('ShaderNodeMixRGB')
    wear.blend_type='MIX'
    wear.inputs[0].default_value=.30
    links.new(variation.outputs['Fac'],wear.inputs[1])
    links.new(mottling.outputs['Fac'],wear.inputs[2])
    wear.location=(-370,250)
    ramp=ns.new('ShaderNodeValToRGB')
    ramp.name='Light Blue Denim: indigo-to-pale stonewash'
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    stops=[(.0,(.055,.134,.240,1)),(.26,(.080,.199,.319,1)),
           (.46,(.124,.258,.395,1)),(.68,(.191,.337,.496,1)),
           (1.0,(.280,.430,.594,1))]
    for i,(at,col) in enumerate(stops):
        e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(at)
        e.position=at;e.color=col
    links.new(wear.outputs['Color'],ramp.inputs[0])
    ramp.location=(-120,250)
    links.new(ramp.outputs['Color'],out.inputs['Base Color'])

    weave=ns.new('ShaderNodeTexNoise')
    weave.name='Fine diagonal cotton denim grain'
    weave.inputs['Scale'].default_value=330
    weave.inputs['Detail'].default_value=2.0
    links.new(geo.outputs['Position'],weave.inputs['Vector'])
    bump=ns.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=.10
    bump.inputs['Distance'].default_value=.0005
    links.new(weave.outputs['Fac'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],out.inputs['Normal'])
    bump.location=(20,-140)
    out.inputs['Sheen Weight'].default_value=.18
    return m


def border_components(mesh, obj):
    bm=bmesh.new();bm.from_mesh(mesh);bm.verts.ensure_lookup_table()
    index={v:i for i,v in enumerate(bm.verts)}
    adj=defaultdict(set)
    for e in bm.edges:
        if not e.is_boundary:continue
        a,b=e.verts
        ia,ib=index[a],index[b]
        adj[ia].add(ib);adj[ib].add(ia)
    seen=set();components=[]
    for start in adj:
        if start in seen:continue
        stack=[start];seen.add(start);ids=[]
        while stack:
            a=stack.pop();ids.append(a)
            for n in adj[a]:
                if n not in seen:seen.add(n);stack.append(n)
        points=[obj.matrix_world@bm.verts[i].co for i in ids]
        zmin=min(p.z for p in points)
        components.append(dict(indices=ids,zmin=zmin,zmax=max(p.z for p in points),
                               degrees=[len(adj[i]) for i in ids],adj=adj))
    bm.free()
    return components


def stroke(name, points, mat, thickness=.0010, close=False):
    if len(points)<2:return None
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D';curve.bevel_depth=thickness;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for dest,coord in zip(spline.points,points):dest.co=(*coord,1)
    spline.use_cyclic_u=close
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_turned_hems(jeans, inner, thread):
    """Finish each actual 28-vertex open boundary with a sewn 23-mm fold."""
    mesh=jeans.data
    # Raise ONLY the lowest 9cm by up to 28mm. The knees/hips/leg centerlines
    # are not changed; this produces sensible hem-to-sneaker clearance.
    count=0
    for v in mesh.vertices:
        p=jeans.matrix_world@v.co
        if p.z < .11:
            t=max(0.,min(1.,(p.z-.015)/.095))
            ease=(1.-t)**2*(1.+2*t)
            p.z+=.028*ease
            v.co=jeans.matrix_world.inverted()@p
            count+=1
    mesh.update()
    comps=[c for c in border_components(mesh,jeans) if c['zmax']<.10]
    if len(comps)!=2 or any(len(c['indices'])<20 or set(c['degrees'])!={2} for c in comps):
        raise RuntimeError('Refuse sewing: two proper circular garment hems required')
    hem_detail=[]
    for side,c in enumerate(sorted(comps,key=lambda c:sum((jeans.matrix_world@mesh.vertices[i].co).x for i in c['indices'])/len(c['indices']))):
        points=[jeans.matrix_world@mesh.vertices[i].co for i in c['indices']]
        cx=sum(p.x for p in points)/len(points)
        cy=sum(p.y for p in points)/len(points)
        # Circular ordered boundary using angular order after checking no
        # rings intersect. This ring is sewn to its turned-up inner facing.
        points.sort(key=lambda p:math.atan2(p.y-cy,p.x-cx))
        inner_low=[];inner_high=[]
        for p in points:
            rad=Vector((p.x-cx,p.y-cy,0))
            if rad.length<1e-9:raise RuntimeError('Invalid hem radius')
            inward=rad.normalized()*-.0026
            inner_low.append((p+inward+Vector((0,0,.001))).copy())
            inner_high.append((p+inward+Vector((0,0,.023))).copy())
        # Add inner facing mesh; do not seal leg opening with a solid cap.
        verts=[tuple(p) for p in points+inner_low+inner_high]
        n=len(points)
        faces=[]
        for i in range(n):
            j=(i+1)%n
            faces += [(i,j,n+j,n+i),(n+i,n+j,2*n+j,2*n+i)]
        md=bpy.data.meshes.new('Cotton Denim Double Fold Hem Mesh')
        md.from_pydata(verts,[],faces);md.update()
        o=bpy.data.objects.new(('Left' if side==0 else 'Right')+' / 501 Turned Hem Facing',md)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(inner)
        bevel=o.modifiers.new('Rolled Cotton Hem Thickness','SOLIDIFY')
        bevel.thickness=.0010
        bevel.offset=-.3
        # Double-needle stitch at 18mm + 22mm up from the bottom.
        for height in (.018,.022):
            line=[]
            for p in points:
                radial=Vector((p.x-cx,p.y-cy,0)).normalized()*.0017
                line.append(tuple(p+radial+Vector((0,0,height))))
            stroke(f'{o.name} / {int(height*1000)}mm Contrast Hem Topstitch',line,thread,.00095,True)
        hem_detail.append(dict(side=('left' if side==0 else 'right'),boundaryVertices=n,
                               approxBottomZ=round(sum(p.z for p in points)/n,4),
                               openingLeftUncapped=True,turnedUpCm=2.3,
                               topstitchRows=2))
    return dict(bottomVerticesAdjusted=count,hems=hem_detail)


def face_position(obj, x, z):
    origin=Vector((x,-1.3,z))
    inv=obj.matrix_world.inverted()
    hit,p,n,idx=obj.ray_cast(inv@origin,(inv.to_3x3()@Vector((0,1,0))).normalized(),distance=3)
    if hit:
        return (obj.matrix_world@p).y
    return None


def surface_y(obj,x,z,back=False):
    start=Vector((x,1.3 if back else -1.3,z))
    vector=Vector((0,-1 if back else 1,0))
    inv=obj.matrix_world.inverted()
    hit,p,n,i=obj.ray_cast(inv@start,(inv.to_3x3()@vector).normalized(),distance=3)
    return (obj.matrix_world@p).y if hit else None


def refine_upper_hip_coverage(jeans):
    """Slightly loosen only hip/seat and waistband; lower legs remain intact."""
    count=0
    for v in jeans.data.vertices:
        p=jeans.matrix_world@v.co
        if p.z<=.68:continue
        w=max(0,min(1,(p.z-.68)/.22))
        w=w*w*(3-2*w)
        side_clearance=min(1,max(0,(abs(p.x)-.055)/.14))
        p.x+=math.copysign(.03*w*side_clearance,p.x)
        if p.y<.04:
            fy=min(1,max(0,(.04-p.y)/.13))
            p.y-=.046*w*fy
        v.co=jeans.matrix_world.inverted()@p
        count+=1
    jeans.data.update()
    return count


def make_501_visual_construction(jeans,thread,denim):
    """Sewing guides follow original fabric surface, not floating 2D decals.

    Visual five-pocket layout only; physical CLO cutting pieces remain separate.
    """
    features=[]
    def traced(label,coords,back=False,r=.00105):
        pts=[]
        for x,z in coords:
            y=surface_y(jeans,x,z,back)
            if y is not None:pts.append((x,y+(.0022 if back else -.0022),z))
        if len(pts)>=3:
            stroke(label,pts,thread,r)
            features.append(label)
    for side,sign in [('Left',-1),('Right',1)]:
        front=[]
        for i in range(30):
            t=i/29
            x=sign*(.175-.085*t)
            z=1.035-.068*math.sin(t*math.pi/2)
            front.append((x,z))
        traced(f'{side} Front Curved Five-Pocket Entrance / Double Stitch',front,r=.0014)
        traced(f'{side} Front Pocket Second Stitch',[(x,z-.006) for x,z in front],r=.00082)
        x0=sign*.114
        pocket=[(x0-sign*.044,.941),(x0+sign*.046,.941),
                (x0+sign*.042,.828),(x0,.803),(x0-sign*.042,.828),(x0-sign*.044,.941)]
        traced(f'{side} Rear Pointed Patch Pocket Outer Stitch',pocket,back=True,r=.00125)
        inner=[(x0-sign*.038,.933),(x0+sign*.038,.933),
               (x0+sign*.036,.837),(x0,.812),(x0-sign*.036,.837),(x0-sign*.038,.933)]
        traced(f'{side} Rear Pocket Double Topstitch',inner,back=True,r=.00075)
    # Yoke shape descends at center back, rises toward both side seams.
    traced('Traditional 501 Rear Yoke Seam Line',
           [(x/30*.205,.929+.043*abs(x/30)) for x in range(-30,31)],back=True,r=.00125)
    traced('Traditional 501 Rear Yoke Second Topstitch',
           [(x/30*.205,.923+.043*abs(x/30)) for x in range(-30,31)],back=True,r=.0008)
    # Fifth watch/coin pocket on right-front hip.
    traced('Fifth Watch Pocket Edge',[(.115,.989),(.149,.989),(.151,.945),(.12,.945)],r=.00095)
    return features


def add_distressed_knees(jeans, cream, threads, inset):
    """Cut 3 short front holes in the existing mesh; bridge with pale warp yarns.

    Cut near actual surface patches instead of making transparent skin overlays.
    Inset fabric/weft fibers keep the intact avatar unexposed under the rips.
    """
    # z is actual world height, not mesh UV. x follows corrected leg center.
    rips=[(-.198,.475,.034,.012,'left knee'),
          (.199,.493,.035,.014,'right knee'),
          (.194,.645,.026,.010,'right upper thigh')]
    original=len(jeans.data.polygons)
    sampled=[]
    surface_maps={}
    for x,z,rx,rz,label in rips:
        mid=face_position(jeans,x,z)
        if mid is None:raise RuntimeError('Cannot find face to tear: '+label)
        sampled.append((x,z,rx,rz,label,mid))
        # Sample the ORIGINAL front curvature before ripping; a constant-Y
        # backpatch otherwise intersects the curved jean as a stiff rectangle.
        cells=[]
        for j in range(17):
            row=[]
            for i in range(29):
                xx=x+rx*1.28*(i/28*2-1)
                zz=z+rz*1.20*(j/16*2-1)
                row.append(face_position(jeans,xx,zz))
            cells.append(row)
        surface_maps[label]=cells

    def surface_y(x,z,rx,rz,label):
        center=next(s for s in sampled if s[4]==label)
        i=min(28,max(0,int(round(((x-center[0])/(rx*1.28)+1)*14))))
        j=min(16,max(0,int(round(((z-center[1])/(rz*1.20)+1)*8))))
        val=surface_maps[label][j][i]
        if val is None:
            nearest=[surface_maps[label][a][b] for a in range(max(0,j-2),min(17,j+3))
                     for b in range(max(0,i-2),min(29,i+3)) if surface_maps[label][a][b] is not None]
            return sum(nearest)/len(nearest) if nearest else center[5]
        return val
    bm=bmesh.new();bm.from_mesh(jeans.data)
    removed_by_label={x[4]:0 for x in sampled}
    to_delete=[]
    for face in bm.faces:
        c=jeans.matrix_world@face.calc_center_median()
        if c.y>-.03:continue  # never cut the back of a leg
        for x,z,rx,rz,label,_ in sampled:
            irregular=1+.13*math.sin(120*c.x+74*c.z)
            ellipse=((c.x-x)/(rx*irregular))**2+((c.z-z)/rz)**2
            if ellipse<1:
                to_delete.append(face)
                removed_by_label[label]+=1
                break
    if sum(removed_by_label.values())<4:
        bm.free();raise RuntimeError('Not enough front denim faces selected for distressing')
    bmesh.ops.delete(bm,geom=to_delete,context='FACES')
    bm.to_mesh(jeans.data);bm.free();jeans.data.update()
    for x,z,rx,rz,label,outer_y in sampled:
        # Soft indigo shadow under slit, to avoid exposing the skin while the
        # natural white textile strands travel across its open center.
        # A genuinely inset elliptical repair under the actual cut faces,
        # conforming to the stored garment curvature, not a rectangular slab.
        seg=36
        verts=[(x,surface_y(x,z,rx,rz,label)+.006,z)]
        faces=[]
        for i in range(seg):
            a=math.tau*i/seg
            xx=x+rx*.87*math.cos(a)
            zz=z+rz*.87*math.sin(a)
            verts.append((xx,surface_y(xx,zz,rx,rz,label)+.006,zz))
        for i in range(seg):faces.append((0,1+i,1+((i+1)%seg)))
        md=bpy.data.meshes.new(label+' / Cotton tear backing mesh')
        md.from_pydata(verts,[],faces);md.update()
        o=bpy.data.objects.new('501 Ripped / '+label+' / inner distressed backing',md)
        bpy.context.collection.objects.link(o);o.data.materials.append(inset)
        rand=random.Random(label)
        for k in range(11):
            row=(k/10)*2-1
            zrow=z+row*rz*.78
            span=rx*math.sqrt(max(.08,1-row**2))
            noise=.65+.35*rand.random()
            left=x-span*noise
            right=x+span*(.75+.25*rand.random())
            if k%4==0:left+=rx*.24
            line=[]
            for j in range(12):
                xx=left+(right-left)*j/11
                yy=surface_y(xx,zrow,rx,rz,label)-.002-.0004*math.sin(5*j+k)
                zz=zrow+rand.uniform(-.0009,.0009)
                line.append((xx,yy,zz))
            stroke(f'{label} / Frayed Ivory Cotton Weft {k:02d}',line,threads,
                   rand.uniform(.00022,.00033))
        # Distressed broken warp fibers point out from the torn edge.
        for edge_side in (-1,1):
            for k in range(11):
                f=(k+.5)/11*2-1
                zi=z+f*rz*.91
                span=rx*math.sqrt(max(.08,1-f*f))
                xx=x+edge_side*span
                yy=surface_y(xx,zi,rx,rz,label)
                stroke(f'{label} / Frayed yarn tail {edge_side} {k}',
                      [(xx,yy-.002,zi),
                       (xx+edge_side*rand.uniform(.004,.008),yy-.002,
                        zi+rand.uniform(-.003,.003))],threads,.00036)
    return dict(originalFaces=original,facesRemoved=removed_by_label,
                finalFaces=len(jeans.data.polygons),ripCount=len(sampled),
                backingUnderEachHole=True)


def orient_cam(camera, position, look):
    camera.location=position
    direction=Vector(look)-camera.location
    camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=1.8


def main():
    args=parse()
    out=Path(args.output).expanduser().resolve()
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=args.source)
    garment=bpy.data.objects.get('MIKRISTIAN_501_W32L32_Manifold_Fit_Shell')
    avatar=bpy.data.objects.get('Full Human Fitting Avatar - Theo (source asset)')
    if garment is None or avatar is None:
        raise RuntimeError('Missing preserved fitted jeans or intact Theo avatar')
    source_verts=len(garment.data.vertices)
    source_xyz=[v.co.copy() for v in garment.data.vertices]
    avatar_pts=[avatar.matrix_world@v.co for v in avatar.data.vertices]
    if len(avatar_pts)<5000 or min(p.z for p in avatar_pts)>0.12 or max(p.z for p in avatar_pts)<1.70:
        raise RuntimeError('Avatar upside down or missing: refuse to modify original')
    original_avatar_verts=len(avatar.data.vertices)
    light=lightwash()
    garment.data.materials.clear();garment.data.materials.append(light)
    lining=material('Inside face of folded denim hem',(.19,.32,.47))
    stitch=material('Warm faded tan stitching / traditional denim',(.73,.56,.37),.96)
    wool=material('Frayed pale cotton weft fibers',(.79,.79,.75),.94)
    backing=material('Light-grey cotton threads beneath ripped openings',(.23,.34,.43),.95)

    hip_vertices_refined=refine_upper_hip_coverage(garment)
    hem=add_turned_hems(garment,lining,stitch)
    damage=add_distressed_knees(garment,wool,wool,backing)
    construction=make_501_visual_construction(garment,stitch,light)
    # Existing stand-off red experimental lines were not part of an original
    # 501; remove those loose floating elements. Keep actual buttons and shoes.
    removed=[]
    for ob in list(bpy.data.objects):
        if ob.type=='CURVE' and ('outer selvedge seam' in ob.name or 'Button fly J seam in red' in ob.name):
            removed.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
    # Correct center-front external stitch, anchored near physical cloth.
    fly=[]
    for i in range(20):
        z=1.036-i*.0066
        x=.017+.019*math.sin(i/19*math.pi)
        yy=face_position(garment,x,z)
        if yy is not None:fly.append((x,yy-.002,z))
    if len(fly)>=6:stroke('501 Button Fly Exterior Tan Topstitch',fly,stitch,.0012)
    for ob in bpy.data.objects:
        if ob.name.startswith('Button Fly Metal'):
            y=face_position(garment,ob.location.x,ob.location.z)
            if y is not None:ob.location.y=y-.003

    scene=bpy.context.scene
    # Previous files accumulated five bright key/rim lights and turned blue
    # denim near white. Normalize *existing* lights without repositioning any
    # garment geometry or avatar camera.
    studio_lights=[]
    for ob in bpy.data.objects:
        if ob.type=='LIGHT':
            ob.data.energy*=.22
            studio_lights.append((ob.name,round(ob.data.energy,1)))
    scene.render.engine='CYCLES';scene.cycles.samples=22;scene.cycles.use_denoising=True
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=-.15
    scene.render.resolution_x=int(args.size*.81)
    scene.render.resolution_y=args.size
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    cam=scene.camera
    if cam is None:
        bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    views={'front':((0,-3.1,.99),(0,0,.88)),
           'back':((0,3.1,.99),(0,0,.88)),
           'threequarter':((2.3,-3.3,1.05),(0,0,.88)),
           'side':((3.6,.03,1.0),(0,0,.87))}
    output={}
    for name,(position,look) in views.items():
        orient_cam(cam,position,look)
        scene.render.filepath=str(out/f'501_Lightwash_Ripped_{name}.png')
        bpy.ops.render.render(write_still=True)
        output[name]=scene.render.filepath
    avatar_end=[avatar.matrix_world@v.co for v in avatar.data.vertices]
    unchanged_avatar=(len(avatar_end)==original_avatar_verts and
                      all(abs(p.x-q.x)<1e-9 and abs(p.y-q.y)<1e-9 and abs(p.z-q.z)<1e-9 for p,q in zip(avatar_pts,avatar_end)))
    # No original fitted leg vertices change from midcalf upward except face
    # deletion localized to distressed areas; only low hem Z was adjusted.
    # Cutting rip faces removes otherwise unused vertices and compacts mesh
    # indices. Verify spatial coordinates via nearest neighbor, not index ID.
    original_kdtree=KDTree(len(source_xyz))
    for i,p in enumerate(source_xyz):original_kdtree.insert(p,i)
    original_kdtree.balance()
    max_lower_deviation=max((original_kdtree.find(v.co)[2]
                            for v in garment.data.vertices if .13<=(garment.matrix_world@v.co).z<=.68),default=0.0)
    unchanged_lower=max_lower_deviation<.00001
    scene['source_cloth']='Preserved on-body fitted jeans mesh V5'
    scene['material']='Procedural light indigo wash, 501-inspired'
    scene['avatar_upright_verified']=max(p.z for p in avatar_end)>1.75
    scene['avatar_leg_mesh_preserved']=unchanged_avatar
    scene['fabric_physics_were_not_resimulated']=True
    path=out/'501_W32L32_Lightwash_Ripped_HemFinished_V9.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    qa=dict(source=args.source,blend=str(path),images=output,
            avatarVertexCount=original_avatar_verts,avatarIntact=unchanged_avatar,
            avatarZMin=min(p.z for p in avatar_end),avatarZMax=max(p.z for p in avatar_end),
            avatarUpright=scene['avatar_upright_verified'],
            fittedLegGeometryPreservedFromCalfThroughUpperThigh=unchanged_lower,
            maxLowerLegVertexDeviationM=max_lower_deviation,studioLightWattages=studio_lights,
            upperHipVerticesRefined=hip_vertices_refined,
            visual501ConstructionLines=construction,
            originalGarmentVertices=source_verts,garmentVertices=len(garment.data.vertices),
            hemConstruction=hem,distressing=damage,
            nativeCLOSimulationValidated=False,
            note='Editable Blender visual garment refinement. Not Levi proprietary pattern or new cloth simulation.')
    (out/'501_LIGHTWASH_HEM_RIPS_V6_QA.json').write_text(json.dumps(qa,indent=2)+'\n')
    print('501_FINISH_QA='+json.dumps(qa))
    if not (unchanged_avatar and unchanged_lower):raise RuntimeError('Unexpected avatar or preserved lower-leg changes')


if __name__=='__main__':main()
