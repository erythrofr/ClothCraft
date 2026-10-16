from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ppf_shell import build_welded_shell


def clamp(value, low, high):
    return max(low, min(high, float(value)))


def fabric_material(fabric, project):
    override = fabric.get('ppf') or {}
    shrink_warp = clamp(fabric.get('shrinkWarp', 0), 0, 0.45)
    shrink_weft = clamp(fabric.get('shrinkWeft', 0), 0, 0.45)
    out = {
        'shellDensity': max(0.001, float(override.get('shellDensity', float(fabric.get('gsm', 180)) / 1000.0))),
        'friction': clamp(override.get('friction', fabric.get('friction', 0.35)), 0, 4),
        'shrinkX': clamp(override.get('shrinkX', 1 - shrink_warp), 0.2, 2),
        'shrinkY': clamp(override.get('shrinkY', 1 - shrink_weft), 0.2, 2),
    }
    optional = {
        'contactGap': override.get('contactGap', project.get('simulation', {}).get('ppfContactGap')),
        'contactOffset': override.get('contactOffset', project.get('simulation', {}).get('ppfContactOffset')),
        'shellYoungModulus': override.get('shellYoungModulus'),
        'shellPoissonRatio': override.get('shellPoissonRatio'),
        'bend': override.get('bend'),
        'stitchStiffness': override.get('stitchStiffness', project.get('simulation', {}).get('ppfStitchStiffness')),
        'strainLimitPercent': override.get('strainLimitPercent'),
    }
    for key, value in optional.items():
        if value is not None:
            out[key] = float(value)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--native-payload', required=True)
    parser.add_argument('--native-result', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--frames', type=int, default=24)
    parser.add_argument('--frame-rate', type=int, default=60)
    parser.add_argument('--step-size', type=float, default=0.006)
    args = parser.parse_args()

    project = json.loads(Path(args.project).read_text())
    native_payload = json.loads(Path(args.native_payload).read_text())
    native_result = json.loads(Path(args.native_result).read_text())
    shell = build_welded_shell(project, native_payload, native_result)
    if not shell['ready']:
        raise RuntimeError(f"Dressed PPF shell is not ready: {shell['reason']} errors={shell['errors']} unsupported={shell['unsupportedSeamIds']} fabrics={shell['fabrics']}")

    fabrics = project.get('fabrics') or {}
    payload_fabrics = {}
    for fabric_id in shell['fabrics']:
        fabric = fabrics.get(fabric_id, {})
        payload_fabrics[fabric_id] = {
            'id': fabric_id,
            'name': fabric.get('name', fabric_id),
            'material': fabric_material(fabric, project),
        }

    # The ordinary closed seams are now topologically welded, so PPF receives
    # a continuous shell and does not need loose stitch edges for this stage.
    payload = {
        'protocol': 'garment-studio.ppf-shell',
        'version': 2,
        'project': {
            'id': project.get('id'),
            'name': project.get('name', 'Untitled Garment'),
            'revision': int(project.get('revision', 1) or 1),
            'sourceBackend': native_result.get('backendId', ''),
            'sourceFrames': int(native_result.get('frames', 0) or 0),
        },
        'scene': {
            'gravity': [0, 0, -abs(float(project.get('simulation', {}).get('gravity', 9.81)))],
            'frameCount': max(2, args.frames),
            'frameRate': max(1, args.frame_rate),
            'stepSize': args.step_size,
            'contactNnz': int(project.get('simulation', {}).get('ppfContactNnz', 4_000_000)),
            'lineSearchMaxT': float(project.get('simulation', {}).get('ppfLineSearchMaxT', 1)),
        },
        'shell': {
            'objectName': 'PPF_Garment',
            'vertices': shell['vertices'],
            'faces': shell['faces'],
            'stitchEdges': [],
            'facePieceIds': shell['facePieceIds'],
            'pieces': [
                {
                    'id': piece.get('id'),
                    'name': piece.get('name', piece.get('id')),
                    'fabricId': piece.get('fabricId', 'main'),
                    'particleIndices': shell['pieceParticles'].get(piece.get('id'), []),
                }
                for piece in project.get('pieces', [])
            ],
            'welded': True,
            'weldConstraintCount': shell['weldConstraintCount'],
            'degenerateFacesRemoved': shell['degenerateFacesRemoved'],
            'duplicateFacesRemoved': shell['duplicateFacesRemoved'],
        },
        'fabrics': payload_fabrics,
        'avatar': {
            'mode': 'garment-studio-proxy',
            'measurements': dict(project.get('avatar') or {}),
            'objectPrefix': 'PPF_Avatar_',
        },
        'source': {
            'nativePayloadVersion': native_payload.get('version'),
            'nativeBackendId': native_result.get('backendId'),
            'nativeFrames': native_result.get('frames'),
            'originalParticles': len(native_payload.get('particles') or []),
            'weldedVertices': len(shell['vertices']),
            'weldedFaces': len(shell['faces']),
        },
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + '\n')
    print(json.dumps({
        'output': str(output),
        'vertices': len(shell['vertices']),
        'faces': len(shell['faces']),
        'weldConstraints': shell['weldConstraintCount'],
        'degenerateFacesRemoved': shell['degenerateFacesRemoved'],
        'duplicateFacesRemoved': shell['duplicateFacesRemoved'],
        'fabrics': shell['fabrics'],
    }))


if __name__ == '__main__':
    main()
