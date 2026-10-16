"""Generate a safe plan from CLO SDK arrangement inspection JSON.

Read-only: does not open CLO, alter a project, or queue SDK commands.
Run after `node integrations/clo_sdk/cli.mjs arrangements --execute`, using
the resulting `response` object saved as JSON.
"""

import argparse
import json
import re
from pathlib import Path


def tokens(value):
    return set(re.findall(r'[a-z0-9]+', str(value).lower().replace('_', ' ')))


def panel_role(name):
    t = tokens(name)
    left = 'left' in t or 'lf' in t or 'lb' in t
    right = 'right' in t or 'rf' in t or 'rb' in t
    front = 'front' in t or 'lf' in t or 'rf' in t
    back = 'back' in t or 'rear' in t or 'lb' in t or 'rb' in t
    lower = bool(t & {'leg', 'pants', 'trouser', 'jean', 'jeans'})
    if left == right or front == back or not lower:
        return None
    return ('left' if left else 'right') + '-' + ('front' if front else 'back')


def slot_role(fields):
    # A safe mapping requires side, fore/aft, and unmistakable leg reference.
    t = set()
    for value in fields.values():
        t |= tokens(value)
    left = 'left' in t or 'lf' in t or 'lb' in t
    right = 'right' in t or 'rf' in t or 'rb' in t
    front = 'front' in t or 'lf' in t or 'rf' in t
    back = 'back' in t or 'rear' in t or 'lb' in t or 'rb' in t
    leg = bool(t & {'leg', 'thigh', 'pants', 'trousers'})
    if left == right or front == back or not leg:
        return None
    return ('left' if left else 'right') + '-' + ('front' if front else 'back')


def plan(data):
    if 'response' in data and isinstance(data['response'], dict):
        data = data['response']
    if data.get('ok') is not True:
        raise ValueError('No successful native CLO arrangement inspection')
    patterns = data.get('patterns') or []
    slots = data.get('arrangement_list') or []
    expected_roles = {'left-front', 'left-back', 'right-front', 'right-back'}
    pieces_by_role = {}
    slots_by_role = {}
    for p in patterns:
        r = panel_role(p.get('name', ''))
        if r:
            pieces_by_role.setdefault(r, []).append(p)
    for s in slots:
        r = slot_role(s.get('fields') or {})
        if r:
            slots_by_role.setdefault(r, []).append(s)
    ambiguous = {
        r: {'patterns': len(pieces_by_role.get(r, [])), 'positions': len(slots_by_role.get(r, []))}
        for r in sorted(expected_roles)
        if len(pieces_by_role.get(r, [])) != 1 or len(slots_by_role.get(r, [])) != 1
    }
    commands = []
    if not ambiguous:
        for role in sorted(expected_roles):
            p = pieces_by_role[role][0]
            s = slots_by_role[role][0]
            commands.append({'role': role, 'piece': p['index'], 'expected_name': p['name'],
                             'arrangement_point': s['index'], 'position_metadata': s['fields']})
    return {
        'project': data.get('project_path'),
        'safe_to_apply': not bool(ambiguous),
        'reason': 'All four patterns and distinct thigh/front/back placement points are unambiguous' if not ambiguous
                  else 'Manual verification required; no automatic placement permitted',
        'ambiguous_roles': ambiguous,
        'pattern_names': [p.get('name') for p in patterns],
        'total_arrangement_points': len(slots),
        'commands': commands,
        'applied': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('inspection_json')
    parser.add_argument('--out')
    args = parser.parse_args()
    result = plan(json.loads(Path(args.inspection_json).read_text()))
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    if not result['safe_to_apply']:
        raise SystemExit(2)
