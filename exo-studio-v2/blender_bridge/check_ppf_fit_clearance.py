"""Measure body proximity and shoulder settling on PPF's raw PC2 animation.

These are unsigned nearest-surface clearances, NOT contact certification or
proof that the garment is outside the skin. Pair with the independent triangle
crossing and IPC swept-contact audits before accepting a fit.
"""

import argparse
import json
from pathlib import Path
import statistics
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_ppf_dynamic_contact import read_frames, solver_to_blender, tree_for_object


def summary(values):
    if not values:
        return {'samples': 0, 'meanCm': None, 'p90Cm': None, 'maximumCm': None}
    values = sorted(values)
    return {'samples': len(values), 'meanCm': round(statistics.mean(values) * 100, 3),
            'p90Cm': round(values[min(len(values) - 1, int(len(values) * 0.9))] * 100, 3),
            'maximumCm': round(values[-1] * 100, 3)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--payload', required=True)
    parser.add_argument('--pc2', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--max-frames', type=int, default=0)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    payload = json.loads(Path(args.payload).read_text())
    body = [obj for obj in bpy.data.objects if obj.name == 'PPF_Avatar_ThomasBody' and obj.type == 'MESH']
    if len(body) != 1:
        raise RuntimeError('Expected one real Thomas-body collision object')
    tree = tree_for_object(body[0])
    vertex_count = len(payload['shell']['vertices'])
    torso = []
    shoulder = []
    for piece in payload['shell']['pieces']:
        if piece['id'] not in ('front', 'back'):
            continue
        indices = piece['particleIndices']
        torso.extend(indices)
        heights = [(i, solver_to_blender(payload['shell']['vertices'][i]).z) for i in indices]
        heights.sort(key=lambda pair: pair[1], reverse=True)
        shoulder.extend(i for i, _ in heights[:max(2, len(heights) // 8)])
    if not torso or not shoulder:
        raise RuntimeError('No torso or shoulder vertex mapping in PPF payload')
    entries = []
    for frame, positions in read_frames(args.pc2, vertex_count):
        if args.max_frames > 0 and frame >= args.max_frames:
            break
        distances = {}
        for name, indices in (('torso', torso), ('shoulder', shoulder)):
            gaps = []
            for index in indices:
                nearest = tree.find_nearest(positions[index])
                if nearest is not None:
                    gaps.append(float(nearest[3]))
            distances[name] = summary(gaps)
        entries.append({'frame': frame, **distances})
    result = {
        'mode': 'unsigned-posed-Thomas-skin-clearance',
        'note': 'Does not prove non-penetration; crossing and swept CCD audits required',
        'framesMeasured': len(entries), 'torsoVertices': len(torso),
        'shoulderVertices': len(shoulder), 'initial': entries[0],
        'final': entries[-1], 'perFrame': entries,
    }
    output = Path(args.report)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print('PPF_FIT_CLEARANCE', json.dumps({k: result[k] for k in ('framesMeasured', 'initial', 'final')}))


if __name__ == '__main__':
    main()
