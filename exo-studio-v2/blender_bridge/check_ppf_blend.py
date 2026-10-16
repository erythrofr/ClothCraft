import json
import sys
import bpy

expected_vertices = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 0
expected_faces = int(sys.argv[sys.argv.index('--') + 2]) if '--' in sys.argv else 0
expected_stitches = int(sys.argv[sys.argv.index('--') + 3]) if '--' in sys.argv else 0
obj = bpy.data.objects.get('PPF_Garment')
avatar = bpy.data.collections.get('PPF_Avatar')
if obj is None:
    raise SystemExit('PPF_Garment missing')
face_edges = set()
for poly in obj.data.polygons:
    verts = list(poly.vertices)
    for i in range(len(verts)):
        a, b = verts[i], verts[(i + 1) % len(verts)]
        face_edges.add(tuple(sorted((a, b))))
pure_edges = []
for edge in obj.data.edges:
    key = tuple(sorted(edge.vertices))
    if key not in face_edges:
        pure_edges.append(key)
result = {
    'vertices': len(obj.data.vertices),
    'faces': len(obj.data.polygons),
    'pureLooseEdges': len(pure_edges),
    'stitchMetadata': int(obj.get('garment_studio_stitch_edge_count', 0)),
    'avatarObjects': len(avatar.objects) if avatar else 0,
    'configured': bool(bpy.context.scene.get('garment_studio_ppf_configured', False)),
}
result['passed'] = (
    result['vertices'] == expected_vertices and
    result['faces'] == expected_faces and
    result['pureLooseEdges'] == expected_stitches and
    result['stitchMetadata'] == expected_stitches and
    result['avatarObjects'] >= 7
)
print(json.dumps(result))
if not result['passed']:
    raise SystemExit(1)
