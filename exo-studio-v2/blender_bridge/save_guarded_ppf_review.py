"""Make a distinct local Blender review scene for independently vetted PC2.

Open the existing solved .blend with Blender --background, then run this
script. It never changes that source file or the original PPF cache.
"""
import argparse
import json
import struct
import sys
from pathlib import Path
import bpy


def main():
    parser = argparse.ArgumentParser()
    for name in ('pc2', 'guard-report', 'ipc-report', 'dynamic-report', 'output'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source_blend = Path(bpy.data.filepath).resolve()
    output = Path(args.output).resolve()
    cache = Path(args.pc2).resolve()
    if not source_blend.is_file() or output == source_blend or output.exists():
        raise ValueError('Refuse missing source or existing/overwriting review scene')
    if not cache.is_file():
        raise FileNotFoundError('Guarded cache is missing')

    guard = json.loads(Path(args.guard_report).read_text())
    ipc = json.loads(Path(args.ipc_report).read_text())
    dynamic = json.loads(Path(args.dynamic_report).read_text())
    if not (guard['acceptedTransitionsSweptBodySafe'] and guard['allAcceptedFramesSelfIntersectionFree']
            and guard['physicalFitApproved'] is False
            and ipc['allTestedStepsCollisionFree']
            and dynamic['allFramesWithinStrainLimit']
            and dynamic['allFramesSelfIntersectionFree']
            and dynamic['allFramesAvatarIntersectionFree']):
        raise RuntimeError('Guarded trajectory did not pass independent contact validation')
    with cache.open('rb') as handle:
        magic, version, count, start, rate, samples = struct.unpack('<12sIIffI', handle.read(32))
    if not magic.startswith(b'POINTCACHE2') or version != 1 or samples != guard['frames']:
        raise ValueError('Cache/header/verified report mismatch')

    garment = bpy.data.objects.get('PPF_Garment')
    if garment is None or garment.type != 'MESH' or len(garment.data.vertices) != count:
        raise ValueError('Review scene garment does not match certified cache')
    modifiers = [m for m in garment.modifiers if m.type == 'MESH_CACHE' and m.cache_format == 'PC2']
    if len(modifiers) != 1:
        raise ValueError('Review garment must have exactly one PC2 cache modifier')
    modifiers[0].filepath = str(cache)
    bpy.context.scene.frame_end = bpy.context.scene.frame_start + samples - 1
    bpy.context.scene['garment_studio_research_guard'] = 'IPC swept body + sampled self collision checked'
    bpy.context.scene['garment_studio_guarded_frames'] = samples
    bpy.context.scene['garment_studio_factory_fit_approved'] = False
    bpy.context.scene['garment_studio_guarded_pc2'] = str(cache)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    print('GUARDED_REVIEW=' + json.dumps({'output': str(output), 'frames': samples,
                                         'bodySweptContactPass': True,
                                         'factoryFitApproved': False}))


if __name__ == '__main__':
    main()
