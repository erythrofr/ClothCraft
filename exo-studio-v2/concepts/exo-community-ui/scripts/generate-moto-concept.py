"""Original Blender EXO architectural moto hoodie concept illustration.
NOT a reconstructed MIKRISTIAN garment, production pattern, validated CLO fit or product photograph.
Uses fresh procedural geometry, no licensed external meshes. Blender 5.x.
"""
import bpy, math, os, sys, random
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1024;scene.render.resolution_y=1280;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
try:scene.view_settings.look='AgX - Medium High Contrast'
except:pass
world=bpy.data.worlds.new('EXO / Black Gallery');world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.005,.005,.005,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3;scene.world=world
# Coordinate space: front faces -Y; garment from z=.1 to 1.5.

def mat(name,color,rough=.88,texture=False,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal
 if texture:
  nois=m.node_tree.nodes.new('ShaderNodeTexNoise');nois.inputs['Scale'].default_value=190;nois.inputs['Detail'].default_value=2.1
  bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.26;bump.inputs['Distance'].default_value=.0014
  m.node_tree.links.new(nois.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],n.inputs['Normal'])
 return m
body=mat('Black washed heavyweight cotton',(.017,.018,.021),.92,True)
padding=mat('Trapunto cushion',(.028,.03,.034),.88,True)
seams=mat('Soft graphite seams',(.045,.05,.055),.8)
zipMat=mat('Antique pewter zipper',(.34,.35,.38),.35,False,.8)
shadow=mat('Rib cuffs and hems',(.012,.014,.016),.95,True)

def mesh(name,verts,faces,material):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 sub=o.modifiers.new('Fabric form smoothing','SUBSURF');sub.levels=1;sub.render_levels=1
 solid=o.modifiers.new('Fabric shell thickness','SOLIDIFY');solid.thickness=.018
 bevel=o.modifiers.new('Soft textile edge','BEVEL');bevel.width=.008;bevel.segments=2
 normal=o.modifiers.new('Weighted shading','WEIGHTED_NORMAL')
 return o
# Oval rings: body tapered through waist, fuller across chest/shoulder.
ring=[(.07,.34,.205),(.15,.385,.21),(.42,.41,.235),(.68,.44,.248),(.95,.48,.25),(1.19,.515,.26),(1.33,.465,.245),(1.42,.23,.18)]
verts=[];n=32
for j,(z,rx,ry) in enumerate(ring):
 for k in range(n):
  a=2*math.pi*k/n
  ripple=.012*math.sin(6*a+j*.74)+.006*math.sin(13*a-j*.9)
  verts.append(((rx+ripple)*math.cos(a),(ry+ripple)*math.sin(a),z+.009*math.sin(4*a+j)))
faces=[]
for j in range(len(ring)-1):
 for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
mesh('Garment / padded body - original procedural concept',verts,faces,body)
# One sleeve: bent, loose, padded volume tapering to cuff.
def make_sleeve(sign):
 centers=[(.465,0,1.255),(.605,0,1.18),(.77,-.01,1.05),(.93,-.012,.89),(1.035,-.015,.70),(1.15,-.018,.56)]
 radii=[.17,.186,.174,.156,.147,.125];N=22;v=[]
 for i,(x,y,z) in enumerate(centers):
  for j in range(N):
   a=2*math.pi*j/N
   # plan sleeve cross-section circular in yz plane, offset slightly by upper arm.
   rad=radii[i]*(1+.06*math.cos(a*5+i*.65))
   v.append((sign*x,y+math.cos(a)*rad,z+math.sin(a)*rad))
 f=[]
 for i in range(len(centers)-1):
  for j in range(N):f.append((i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j))
 mesh('Garment / left sleeve' if sign<0 else 'Garment / right sleeve',v,f,body)
 # Cuff ring mesh as elongated cylinder cone
 bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.117,radius2=.12,depth=.14,location=(sign*1.16,-.015,.54),rotation=(0,math.pi/2,0))
 cuff=bpy.context.object;cuff.name='Knitted cuff';cuff.data.materials.append(shadow)
 cuff.rotation_euler[1]=math.pi/2
 for p in cuff.data.polygons:p.use_smooth=True
make_sleeve(1);make_sleeve(-1)
# Kangaroo pocket: two triangular/quad layered patches at front bottom
for sign in [-1,1]:
 verts=[(sign*.055,-.265,.38),(sign*.31,-.235,.405),(sign*.35,-.222,.19),(sign*.07,-.265,.18)]
 mesh('Kangaroo split pocket',verts,[(0,1,2,3)],padding)
# Vertical front zipper-like metal track.
def curve(name,points,material,bevel=.005):
 cr=bpy.data.curves.new(name,'CURVE');cr.dimensions='3D';cr.resolution_u=20;cr.bevel_depth=bevel;cr.bevel_resolution=3
 p=cr.splines.new('POLY');p.points.add(len(points)-1)
 for i,v in enumerate(points):p.points[i].co=(*v,1)
 ob=bpy.data.objects.new(name,cr);bpy.context.collection.objects.link(ob);ob.data.materials.append(material);return ob
for x in [-.015,.015]:curve('Zipper / brushed metal track',[(x,-.27,.3),(x,-.268,.54),(x,-.26,.75),(x,-.27,1.05),(x,-.2,1.38)],zipMat,.003)
# Rib channels forming architectural vertical contour down panels, low relief.
for sign in [-1,1]:
 for t in [0,1,2]:
  xs=sign*(.135+t*.095)
  points=[]
  for i in range(34):
   z=.44+i*(.83/33)
   rx=.4+(.10*min(1,max(0,(z-.7)/.4)))
   theta=math.acos(min(.97,max(.1,abs(xs)/rx)))
   y=-.225+(.015*math.cos(z*10))
   x=xs+sign*.011*math.sin(z*16+t)
   points.append((x,y-.011,z))
  curve('Trapunto raised seam / architectural',points,seams,.007)
# Continuous hood shell around oval face opening, with extra volume at the rear.
H=64;W=15;v=[]
for i in range(W):
 t=i/(W-1)
 for j in range(H):
  a=2*math.pi*j/H
  oval_x=.286+.052*t
  oval_z=.31+.025*t
  x=oval_x*math.cos(a)
  z=1.59+oval_z*math.sin(a)
  y=-.065 + .33*t + .045*math.sin(a)
  v.append((x,y,z))
f=[]
for i in range(W-1):
 for j in range(H):f.append((i*H+j,i*H+(j+1)%H,(i+1)*H+(j+1)%H,(i+1)*H+j))
mesh('Hood / continuous draped shell',v,f,body)
pts=[(.286*math.cos(2*math.pi*k/96),-.068+.045*math.sin(2*math.pi*k/96),1.59+.31*math.sin(2*math.pi*k/96)) for k in range(97)]
curve('Hood edge / single collar binding',pts,seams,.009)
# Hem trim band circumferential
pts=[((.348)*math.cos(2*math.pi*k/48),(.213)*math.sin(2*math.pi*k/48),.078+.007*math.sin(2*math.pi*k/48)) for k in range(49)]
curve('Rib hem / outline',pts,shadow,.026)
# Studio on true black untextured world, floor not shown.
def light(name,loc,power,size,aim=(0,0,.83)):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(aim)-o.location).to_track_quat('-Z','Y').to_euler()
light('Silk key',(-2.5,-3,3.4),280,2.6)
light('Pearl fill',(2.5,-2.7,2.7),190,2.8)
light('Shoulder rim',(1.1,2.1,2.9),370,2)
light('Side contour',(-2.2,1.1,1.0),170,1.8)
bpy.ops.object.camera_add(location=(2.45,-3.9,1.83));camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=2.16
outdir=os.path.abspath(sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'concepts/exo-community-ui/project-media');os.makedirs(outdir,exist_ok=True)
for suffix,loc,target,scale in [('moto-concept-34.png',(2.4,-3.8,1.9),(0,0,.96),2.2),('moto-concept-front.png',(0,-4.5,1.75),(0,0,.95),2.25),('moto-concept-detail.png',(1.25,-2.7,1.8),(0,0,1.18),1.37)]:
 camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
 scene.render.filepath=os.path.join(outdir,suffix)
 bpy.ops.render.render(write_still=True)
 print('EXO_MOTO_RENDER',scene.render.filepath,os.stat(scene.render.filepath).st_size)
