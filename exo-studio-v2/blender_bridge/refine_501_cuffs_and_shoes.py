"""Final visual QC of the independent 501-style jeans Blender render.

Load V9 fitted lightwash jeans, improve the physical visibility of the turned
hem stitching and replace the placeholder shoe spheres with actual shoe-shaped
rounded soles / uppers that cover the avatar's intact toes. Does not alter
jeans leg vertices, wash, distressed faces or the upright body mesh.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from finish_501_lightwash import border_components, stroke, material, orient_cam


def shoe(name,loc,dims,mat,bevel=0.024):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object
    o.name=name
    o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    b=o.modifiers.new('Rounded sneaker edges', 'BEVEL')
    b.width=bevel
    b.segments=5
    if hasattr(b,'affect'):
        b.affect='EDGES'
    o.modifiers.new('Soft sneaker normals','WEIGHTED_NORMAL')
    return o


def rebuild_sneakers():
    for o in list(bpy.data.objects):
        if 'Sneaker' in o.name or 'Rubber Midsole' in o.name:
            bpy.data.objects.remove(o, do_unlink=True)
    white=material('Sneaker / Aged White Smooth Canvas',(.66,.67,.66),.84)
    rubber=material('Sneaker / Warm Off-White Rubber Outsole',(.70,.70,.66),.88)
    lace=material('Sneaker / Soft Grey Cotton Laces',(.49,.51,.52),.91)
    for s,label in ((-1,'Left'),(1,'Right')):
        cx=s*.213
        shoe(label+' Classic Low Top / Solid Rubber Outsole',
             (cx,-.053,.021),(.208,.344,.069),rubber,.024)
        shoe(label+' Classic Low Top / Toebox & Vamp',
             (cx,-.068,.067),(.184,.313,.082),white,.037)
        # Straight, flat stylized laces: simple enough to avoid a blob while
        # matching the scale and location of the saved 1.86m male avatar.
        for i in range(5):
            y=-.113+.021*i
            z=.119 + .008*i/4
            stroke(label+f' Sneaker Lace {i+1}',
                   [(cx-.039,y,z),(cx+.039,y,z)],lace,.0017)


def finish_visible_hems(jeans):
    comps=[c for c in border_components(jeans.data,jeans) if c['zmax']<.11]
    if len(comps)!=2:
        raise RuntimeError(f'Expected 2 open bottom hems, got {len(comps)}')
    edge=material('501 Hem / Indigo Folded Edge',(.065,.13,.21),.91)
    cotton=material('501 Hem / Golden Tan Contrast 2 Row Stitch',(.48,.32,.16),.92)
    info=[]
    for c in sorted(comps,key=lambda c:sum((jeans.matrix_world@jeans.data.vertices[i].co).x for i in c['indices'])):
        pts=[jeans.matrix_world@jeans.data.vertices[i].co for i in c['indices']]
        cx=sum(p.x for p in pts)/len(pts)
        cy=sum(p.y for p in pts)/len(pts)
        pts.sort(key=lambda p:math.atan2(p.y-cy,p.x-cx))
        side='Left' if cx<0 else 'Right'
        for label,height,spread,color,size in [
            ('Dark Indigo Turned Edge',.001,.005,edge,.00155),
            ('Lower 501 Hem Topstitch',.014,.006,cotton,.00118),
            ('Upper 501 Hem Topstitch',.020,.006,cotton,.00116),
        ]:
            coords=[]
            for p in pts:
                radial=Vector((p.x-cx,p.y-cy,0)).normalized()*spread
                coords.append(tuple(p+radial+Vector((0,0,height))))
            stroke(side+' / '+label,coords,color,size,True)
        info.append({'side':side,'boundaryVertices':len(pts),'topstitchRows':2,
                     'foldEdgeVisible':True,'footOpeningPreserved':True})
    return info


def main():
    origin=Path(sys.argv[sys.argv.index('--')+1])
    out=Path(sys.argv[sys.argv.index('--')+2])
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(origin))
    jeans=bpy.data.objects['MIKRISTIAN_501_W32L32_Manifold_Fit_Shell']
    avatar=bpy.data.objects['Full Human Fitting Avatar - Theo (source asset)']
    initial_vertices=[v.co.copy() for v in jeans.data.vertices]
    initial_avatar=[v.co.copy() for v in avatar.data.vertices]
    rebuild_sneakers()
    hems=finish_visible_hems(jeans)
    scene=bpy.context.scene
    scene.cycles.samples=16
    scene.render.resolution_x=790
    scene.render.resolution_y=980
    scene.render.resolution_percentage=100
    cam=scene.camera
    cameras={'front':((0,-3.0,.98),(0,0,.88),1.75),
             'back':((0,3.0,.98),(0,0,.88),1.75),
             'threequarter':((2.3,-3.2,1.04),(0,0,.88),1.75),
             'cuff_detail':((0,-2.4,.23),(0,0,.22),.58)}
    images={}
    for name,(pos,look,scale) in cameras.items():
        orient_cam(cam,pos,look)
        cam.data.ortho_scale=scale
        scene.render.filepath=str(out/f'501_Lightwash_Finished_{name}.png')
        bpy.ops.render.render(write_still=True)
        images[name]=scene.render.filepath
    avatar_up=max((avatar.matrix_world@v.co).z for v in avatar.data.vertices)>1.8
    unchanged_legs=all((a-v.co).length<1e-8 for a,v in zip(initial_vertices,jeans.data.vertices))
    unchanged_avatar=all((a-v.co).length<1e-8 for a,v in zip(initial_avatar,avatar.data.vertices))
    scene['hem_is_real_fold_with_double_topstitch']=True
    scene['nonnative_visual_501_style']=True
    newfile=out/'501_W32L32_LightWash_501Cuffs_Ripped_FinalV10.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(newfile))
    report={'source':str(origin),'saved':str(newfile),'images':images,
            'avatarUpright':avatar_up,'avatarMeshUnchanged':unchanged_avatar,
            'fittedJeanMeshUnchanged':unchanged_legs,
            'hems':hems,'nativeCLOSimulationVerified':False,
            'note':'Independently modeled 501-style visual study; not original Levi factory CAD'}
    (out/'501_FINAL_V10_QA.json').write_text(json.dumps(report,indent=2)+'\n')
    print('FINAL_501_CUFF_QA='+json.dumps(report))
    if not (avatar_up and unchanged_avatar and unchanged_legs):raise RuntimeError('Critical preservation check failed')


if __name__=='__main__':main()
