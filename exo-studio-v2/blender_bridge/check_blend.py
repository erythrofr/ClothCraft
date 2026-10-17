import json
import sys
import bpy

expected_pieces = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 0
expected_seams = int(sys.argv[sys.argv.index('--') + 2]) if '--' in sys.argv else 0
expected_simulated = int(sys.argv[sys.argv.index('--') + 3]) if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 3 else 0
patterns = bpy.data.collections.get('Patterns_2D')
garment = bpy.data.collections.get('Garment_3D')
seams = bpy.data.collections.get('Sewing_Relationships')
simulated = bpy.data.collections.get('Simulation_Result')
avatar = bpy.data.collections.get('Avatar')
actual_patterns = len(patterns.objects) if patterns else 0
actual_garment = len(garment.objects) if garment else 0
actual_seams = len(seams.objects) if seams else 0
actual_simulated = len(simulated.objects) if simulated else 0
avatar_meshes = [obj for obj in avatar.objects if obj.type == 'MESH'] if avatar else []
expected_avatar_visual = bpy.context.scene.get('avatar_model') or 'makehuman-base'
piece_metadata_ok = bool(garment) and all(obj.get('garment_piece_id') for obj in garment.objects)
seam_metadata_ok = bool(seams) and all(obj.get('garment_seam_id') for obj in seams.objects)
avatar_metadata_ok = (
    bool(avatar_meshes) and
    bpy.context.scene.get('garment_avatar_visual') == expected_avatar_visual and
    bpy.context.scene.get('garment_avatar_collision') == 'analytic-parametric' and
    any(obj.get('garment_avatar_visual') == expected_avatar_visual for obj in avatar_meshes)
)
simulation_metadata_ok = expected_simulated == 0 or (
    bool(simulated) and
    all(obj.get('garment_piece_id') for obj in simulated.objects) and
    all(obj.get('garment_simulation_backend') == 'native-pbd-xpbd' for obj in simulated.objects) and
    bpy.context.scene.get('garment_simulation_backend') == 'native-pbd-xpbd'
)
passed = (
    actual_patterns == expected_pieces and
    actual_garment == expected_pieces and
    actual_seams == expected_seams and
    actual_simulated == expected_simulated and
    piece_metadata_ok and seam_metadata_ok and avatar_metadata_ok and simulation_metadata_ok
)
print(json.dumps({
    'patterns': actual_patterns,
    'garmentPieces': actual_garment,
    'seams': actual_seams,
    'simulatedPieces': actual_simulated,
    'pieceMetadata': piece_metadata_ok,
    'seamMetadata': seam_metadata_ok,
    'avatarMeshes': len(avatar_meshes),
    'expectedAvatarVisual': expected_avatar_visual,
    'avatarVisual': bpy.context.scene.get('garment_avatar_visual'),
    'avatarCollision': bpy.context.scene.get('garment_avatar_collision'),
    'avatarMetadata': avatar_metadata_ok,
    'simulationMetadata': simulation_metadata_ok,
    'passed': passed,
}))
if not passed:
    raise SystemExit(1)
