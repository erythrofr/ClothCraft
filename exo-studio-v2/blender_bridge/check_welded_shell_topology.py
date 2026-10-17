"""Check XPBD->Blender weld topology; requires no Blender runtime.

Example:
python3 blender_bridge/check_welded_shell_topology.py project.json payload.json result.json --expected-boundary-loops 3 --output report.json
"""

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

from ppf_shell import build_welded_shell


def inspect_shell(shell):
    use = Counter(
        tuple(sorted((a, b)))
        for face in shell['faces']
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0]))
    )
    adjacency = defaultdict(set)
    for (a, b), count in use.items():
        if count == 1:
            adjacency[a].add(b)
            adjacency[b].add(a)

    components = []
    seen = set()
    for start in adjacency:
        if start in seen:
            continue
        pending = [start]
        seen.add(start)
        vertices = []
        while pending:
            vertex = pending.pop()
            vertices.append(vertex)
            for other in adjacency[vertex]:
                if other not in seen:
                    seen.add(other)
                    pending.append(other)
        heights = [shell['vertices'][v][1] for v in vertices]
        components.append({
            'vertices': len(vertices),
            'heightMinM': round(min(heights), 4),
            'heightMaxM': round(max(heights), 4),
            'closedBoundaryLoop': all(len(adjacency[v]) == 2 for v in vertices),
        })
    components.sort(key=lambda item: -item['heightMaxM'])

    return {
        'faces': len(shell['faces']),
        'vertices': len(shell['vertices']),
        'weldedSeamConstraints': shell['weldConstraintCount'],
        'removedDegenerateFaces': shell['degenerateFacesRemoved'],
        'removedDuplicateFaces': shell['duplicateFacesRemoved'],
        'removedDanglingSeamSpikeFaces': shell['danglingSeamSpikeFacesRemoved'],
        'nonmanifoldEdges': sum(count > 2 for count in use.values()),
        'boundaryLoops': len(components),
        'openBoundaryVertices': sum(len(neighbors) != 2 for neighbors in adjacency.values()),
        'boundaryComponents': components,
        'weldReady': shell['ready'],
        'weldErrors': shell['errors'],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('project')
    parser.add_argument('payload')
    parser.add_argument('result')
    parser.add_argument('--expected-boundary-loops', type=int, default=3)
    parser.add_argument('--output')
    args = parser.parse_args()

    inputs = [json.loads(Path(name).read_text()) for name in (args.project, args.payload, args.result)]
    shell = build_welded_shell(*inputs)
    qa = inspect_shell(shell)
    qa['topologyPassed'] = (
        qa['weldReady'] and qa['nonmanifoldEdges'] == 0
        and qa['boundaryLoops'] == args.expected_boundary_loops
        and qa['openBoundaryVertices'] == 0
    )
    qa['onBodyDrapeValidated'] = False  # topology alone cannot prove fit / collision
    if args.output:
        Path(args.output).write_text(json.dumps(qa, indent=2) + '\n')
    print(json.dumps(qa, indent=2))
    if not qa['topologyPassed']:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
