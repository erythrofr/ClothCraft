#!/usr/bin/env python3
"""Compare the *chrome only* of an owned CLO7 reference and Garment Studio.

This uses an existing, private screenshot of the user's own CLO Academic 7.0
male-T-shirt window.  Our four-panel sample is NOT the same garment as CLO's
seven-object male tee.  The changing pattern/grid field is intentionally
excluded, so the output is a bounded interface comparison, not a claimed
pixel-accurate full CLO3D parity score.

python3 scripts/qa-clo-2d-layout-diff.py --clone replica/clone-screens/S01-whole-app-1440.png --label before
"""

import argparse
import json
import pathlib
import subprocess
import sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
REFERENCE = ROOT / 'research/clo-reference/live-audit-20261014/current-workspace.png'
OUTPUT = ROOT / 'replica/diffs'
REFS = ROOT / 'replica/screens'
WIDTH, HEIGHT = 438, 789
# Public display of the user's saved *CLO 7.0.242* screenshot is 1463x950.
# Measure its specific 2D Pattern Window + right tool columns, with heading.
CLO_PREVIEW = (1463, 950)
CLO_RECT = (720, 96, 1134, 879)
# Garment Studio 1440x900, desktop testSession tee. 2D panel and
# RIGHT palette are adjacent DOM siblings, x688..1126 in this preset.
OUR_RECT = (688, 70, 1126, 859)


def align_screenshot(image, rectangle):
    area = image.crop(rectangle)
    return area.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def cloak_interior(image):
    """Preserve only UI chrome and furniture, never differently drafted pieces."""
    masked = Image.new('RGB', (WIDTH, HEIGHT), (96, 96, 96))
    # Heading: the first 43 px in normalized viewport coordinates.
    masked.paste(image.crop((0, 0, WIDTH, 43)), (0, 0))
    # Upper-left utility strip incl margin; the pattern fill begins much later.
    masked.paste(image.crop((0, 43, 100, 340)), (0, 43))
    # Right-side dual drafting/sewing toolbar plus tool switches.
    masked.paste(image.crop((355, 43, WIDTH, 715)), (355, 43))
    return masked


def run_diff(name, source, target, diff_file):
    command = [
        sys.executable,
        str(ROOT / 'scripts/vendor/replica-skill/imgdiff.py'),
        str(source), str(target),
        '--json', '--width', str(WIDTH),
        '--out', str(diff_file),
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    obj = json.loads(result.stdout)
    return {'name': name, 'score': obj['score'], 'regions': obj.get('regions', [])[:4]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--clone', type=pathlib.Path, required=True)
    parser.add_argument('--label', choices=['before', 'after'], required=True)
    args = parser.parse_args()
    if not REFERENCE.is_file() or not args.clone.is_file():
        parser.error('Missing authentic CLO screenshot or our corresponding desktop capture')
    with Image.open(REFERENCE) as original:
        if original.size != (3024, 1964):
            parser.error(f'Unexpected native CLO screenshot resolution: {original.size}')
        rx, ry = original.width / CLO_PREVIEW[0], original.height / CLO_PREVIEW[1]
        roi = tuple(round(v * (rx if i % 2 == 0 else ry)) for i, v in enumerate(CLO_RECT))
        clo = align_screenshot(original.convert('RGB'), roi)
    with Image.open(args.clone) as own:
        if own.size != (1440, 900):
            parser.error(f'Expected owned 1440x900 desktop capture, received {own.size}')
        ours = align_screenshot(own.convert('RGB'), OUR_RECT)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    REFS.mkdir(parents=True, exist_ok=True)
    target_ref = REFS / 'S01-CLO7-male-tee-2d-reference.png'
    clo.save(target_ref)
    own_path = OUTPUT / f'S01-own-{args.label}-2d-pane.png'
    ours.save(own_path)
    ref_masked = REFS / 'S01-CLO7-chrome-only.png'
    own_masked = OUTPUT / f'S01-own-{args.label}-chrome-only.png'
    cloak_interior(clo).save(ref_masked)
    cloak_interior(ours).save(own_masked)
    result = run_diff('2D tool chrome (non-pattern)', ref_masked, own_masked,
                      OUTPUT / f'S01-CLO7-vs-own-{args.label}-chrome-diff.png')
    report = {
        'reference': {
            'origin': 'local CLO Academic 7.0.242 live Male_T-shirt.zpac screenshot, 2026-10-14',
            'source_document': 'docs/CLO_ACTIVE_TSHIRT_ASSEMBLY_REFERENCE_2026-10-14.md',
            'path': str(REFERENCE.relative_to(ROOT)),
            'source_crop_px': list(roi),
            'version': 'CLO 7.0.242',
        },
        'clone': {
            'origin': 'local isolated Garment Studio Foundation Tee desktop screenshot',
            'source_viewport_px': [1440, 900],
            'source_crop_px': list(OUR_RECT),
            'path': str(args.clone.resolve().relative_to(ROOT)),
        },
        'comparison': {
            'measured_metric': 'replica-skill edge-map structural score of masked 2D interface chrome only',
            'score': result['score'],
            'max_score': 100,
            'regions': result['regions'],
            'normalized_crop_px': [WIDTH, HEIGHT],
            'kept_regions': ['header y0:43', 'left quick tool strip x0:100 y43:340',
                             'right dual rails x355:438 y43:715'],
            'limitations': [
                'Not the same 2D pattern or number of pieces: all garment drawing excluded.',
                'CLO Academic 7 reference is not a 2026.1 toolbar configuration.',
                'Crops are scaled to identical dimensions; small differences in viewport panel width remain.',
                'Edge-map layout metric is diagnostic only, not proof of exact artwork or workflow parity.',
                'The native CLO screenshot is local reference material and must never ship in Garment Studio.',
            ],
        },
    }
    report_path = OUTPUT / f'S01-CLO7-vs-own-{args.label}-layout.json'
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'pass': True, 'label': args.label, 'chromeLayoutScore': result['score'],
                      'report': str(report_path.relative_to(ROOT))}, indent=2))


if __name__ == '__main__':
    main()
