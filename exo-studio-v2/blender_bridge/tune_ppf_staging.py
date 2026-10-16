import argparse, json, math, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

raw=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser(); p.add_argument('--input',required=True); p.add_argument('--output'); p.add_argument('--min-torso-depth',type=float,default=0.10); p.add_argument('--max-torso-depth',type=float,default=0.36); p.add_argument('--min-arm-offset',type=float,default=0.30); p.add_argument('--max-arm-offset',type=float,default=0.72); p.add_argument('--sleeve-y-min',type=float,default=0.20); p.add_argument('--sleeve-y-max',type=float,default=0.45); p.add_argument('--torso-y',type=float,default=0.0,help='Vertical adjustment in metres for front/back torso panels (negative lowers shoulder neckline)'); p.add_argument('--wrap-torso',action='store_true',help='Experimental cylindrical starting pose for the front and back pattern panels; must pass full contact and strain audits'); args=p.parse_args(raw)
payload=json.loads(Path(args.input).read_text())
base=[Vector(tuple(map(float,v))) for v in payload['shell']['vertices']]
faces=[tuple(map(int,f)) for f in payload['shell']['faces']]
piece_indices={piece['id']:list(map(int,piece.get('particleIndices',[]))) for piece in payload['shell'].get('pieces',[])}
stitches=[(int(e['a']),int(e['b']),e.get('seamId')) for e in payload['shell'].get('stitchEdges',[])]

# The Blender PPF avatar proxy uses ellipsoids; the sleeve panels are initially
# flat YZ planes at +/-armOffset.  Reject placements already cutting through
# the arm ellipsoids. These bounds update with the project's avatar body size.
avatar=payload.get('avatar',{}).get('measurements',{})
shoulder_cm=max(34.,min(62.,float(avatar.get('shoulderWidthCm',46.))))
bicep_cm=max(20.,min(60.,float(avatar.get('bicepCm',32.))))
chest_cm=max(70.,min(145.,float(avatar.get('chestCm',96.))))
waist_cm=max(55.,min(145.,float(avatar.get('waistCm',78.))))
hip_cm=max(70.,min(150.,float(avatar.get('hipCm',94.))))
safe_arm_offset=shoulder_cm*0.005+0.18+0.065*(bicep_cm/32.)+0.025
safe_torso_depth=max(0.13*(chest_cm/96.),0.105*(waist_cm/78.),0.14*(hip_cm/94.))+0.02

# buildExplodedPpfPayload defaults used by this fixture.
BASE_TORSO_DEPTH=0.36
BASE_ARM_OFFSET=0.72

def intersection_count(vs):
    tree=BVHTree.FromPolygons(vs,faces,all_triangles=True)
    seen=set(); count=0
    for a,b in tree.overlap(tree):
        if a==b: continue
        key=(min(a,b),max(a,b))
        if key in seen: continue
        seen.add(key)
        if set(faces[a]) & set(faces[b]): continue
        count += 1
    return count

def stitch_metrics(vs):
    ds=[(vs[a]-vs[b]).length for a,b,_ in stitches]
    ds.sort()
    if not ds: return (0.0,0.0,0.0)
    return (sum(ds)/len(ds), ds[-1], ds[min(len(ds)-1, int(len(ds)*0.95))])

def candidate(torso_depth, arm_offset, sleeve_y=0.0, sleeve_z=0.0):
    vs=[v.copy() for v in base]
    front_delta=torso_depth-BASE_TORSO_DEPTH
    back_delta=-(torso_depth-BASE_TORSO_DEPTH)
    for piece_id, sign, z_delta in [('front', 1, front_delta), ('back', -1, back_delta)]:
        ids=piece_indices.get(piece_id,[])
        for idx in ids:
            vs[idx].y += args.torso_y
            if not args.wrap_torso:
                vs[idx].z += z_delta
                continue
            # A curved initial torso reduces the need for loose side seam
            # springs to pull a planar front straight through the avatar.
            # Preserve approximate in-plane arc length by scaling section
            # radii with the drafted width at this local pattern height.
            x=base[idx].x
            half_width=max((abs(base[j].x) for j in ids if abs(base[j].y-base[idx].y)<.025),default=.25)
            half_width=max(.03,half_width)
            scale=half_width/.31
            angle=max(-math.pi/2,min(math.pi/2,x/half_width*math.pi/2))
            vs[idx].x=.265*scale*math.sin(angle)
            vs[idx].z=sign*torso_depth*scale*math.cos(angle)
    left_dx=BASE_ARM_OFFSET-arm_offset
    right_dx=arm_offset-BASE_ARM_OFFSET
    for idx in piece_indices.get('sleeve-left',[]):
        vs[idx].x += left_dx; vs[idx].y += sleeve_y; vs[idx].z += sleeve_z
    for idx in piece_indices.get('sleeve-right',[]):
        vs[idx].x += right_dx; vs[idx].y += sleeve_y; vs[idx].z += sleeve_z
    return vs

rows=[]
# Sleeve panels in the fixture run from about Y=1.00..1.25 m, while the
# front/back armholes live at Y=1.50..1.70 m. Earlier optimizations could
# adjust only torso depth and arm X, making a preventable ~40 cm stitch gap.
# Search shoulder-aligned Y, modest Z shifts and collision-safe arm X too.
# Search only user-authorized clearance bounds. The generated candidate's
# actual Blender body triangles and garment triangles are then tested, rather
# than assuming simple radii guarantee nonpenetration.
for torso_i in range(max(12, int(math.ceil(args.min_torso_depth * 100))), min(36, int(round(args.max_torso_depth * 100))) + 1, 2):
    torso=torso_i/100
    for arm_i in range(max(36, int(math.ceil(args.min_arm_offset * 100))), min(72, int(round(args.max_arm_offset * 100))) + 1, 3):
        arm=arm_i/100
        for sleeve_y_i in range(max(0, int(round(args.sleeve_y_min * 100))), min(55, int(round(args.sleeve_y_max * 100))) + 1, 5):
            sy=sleeve_y_i/100
            for sleeve_z_i in (-8,0,8):
                sz=sleeve_z_i/100
                vs=candidate(torso,arm,sy,sz)
                intersections=intersection_count(vs)
                mean,maxd,p95=stitch_metrics(vs)
                score=(intersections>0, intersections, mean, maxd)
                rows.append((score,torso,arm,sy,sz,mean,maxd,p95,intersections))
rows.sort(key=lambda r:r[0])
if not rows:
    raise RuntimeError(f'No avatar-safe staging candidate: min torso {safe_torso_depth:.3f} m, min arm {safe_arm_offset:.3f} m; widen search bounds')
body_contact_audit = None
# Both mannequin modes must be tested against their REAL Blender STATIC
# triangles. Previously only Thomas used this narrowphase; the default
# analytic-avatar case chose an allegedly 'safe' offset using bounding
# radii, and still started PPF with 20 body/cloth triangle crossings.
# See check_ppf_dynamic_contact.py --initial-only for identical geometry.
import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ppf_prepare_scene import build_avatar, collection
bodies = build_avatar(payload, collection('PPF_Staging_Avatar'))
depsgraph = bpy.context.evaluated_depsgraph_get()
skins = [BVHTree.FromObject(obj, depsgraph) for obj in bodies]
checked = 0
safe_rows = []
for row in rows:
    _, torso, arm, sleeve_y, sleeve_z, *_ = row
    vs = candidate(torso, arm, sleeve_y, sleeve_z)
    cloth_vertices = [Vector((v.x, -v.z, v.y)) for v in vs]
    cloth_tree = BVHTree.FromPolygons(cloth_vertices, faces, all_triangles=True)
    checked += 1
    hits = sum(len(cloth_tree.overlap(skin)) for skin in skins)
    if hits == 0:
        safe_rows.append(row)
        if len(safe_rows) >= 60:
            break
if not safe_rows:
    raise RuntimeError(f'No intersection-free T-shirt placement against Thomas skin after {checked} candidates; adjust the pattern or staging search bounds')
rows = safe_rows
body_contact_audit = {'mode':payload.get('avatar',{}).get('mode','garment-studio-proxy'),'candidatesChecked':checked,'passingCandidates':len(safe_rows),'selectedBodyCrossings':0}
best=rows[0]
out=[]
for _,torso,arm,sy,sz,mean,maxd,p95,intersections in rows[:60]:
    out.append({'intersections':intersections,'torsoDepth':torso,'armOffset':arm,'sleeveY':sy,'sleeveZ':sz,'stitchMeanM':mean,'stitchP95M':p95,'stitchMaxM':maxd})
result={'best':out[0],'top':out,'avatarClearance':{'minTorsoDepthM':safe_torso_depth,'minArmOffsetM':safe_arm_offset,'marginM':0.025},'torsoYOffsetM':args.torso_y,'wrappedTorso':args.wrap_torso,'realBodyContact':body_contact_audit}
print(json.dumps(result,indent=2))
if args.output:
    _,torso,arm,sy,sz,*_=best
    tuned=json.loads(json.dumps(payload))
    vs=candidate(torso,arm,sy,sz)
    tuned['shell']['vertices']=[[v.x,v.y,v.z] for v in vs]
    tuned.setdefault('scene',{})['staging']={'strategy':'optimized-wrapped-torso-v1' if args.wrap_torso else 'optimized-exploded-v2','torsoDepth':torso,'armOffset':arm,'sleeveY':sy,'sleeveZ':sz,'torsoYOffsetM':args.torso_y,'wrappedTorso':args.wrap_torso}
    if body_contact_audit:
        tuned['scene']['staging']['realBodyContact'] = body_contact_audit
    # PPF's strong loose-edge stitch springs can pull separate cloth panels
    # through body colliders if their initial separation is tens of cm.
    # Explicitly mark this pose as requiring an all-frame contact audit;
    # zero intersection at frame zero is NOT a collision-quality guarantee.
    tuned['scene']['staging']['contactValidationRequired']=True
    Path(args.output).write_text(json.dumps(tuned,indent=2)+'\n')
