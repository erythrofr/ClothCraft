#!/usr/bin/env python3
"""Reproducible, indicative optical checks for locally installed CC0 fabric maps.

All distribution statistics use a maximum 256px-wide RGB thumbnail for speed;
SHA256 covers the full original bytes. Flags identify review candidates, not faults.
"""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/reports/EXO_400_SCAN_IMAGE_METRICS.json'
SETS = ('public/fabric-scans', 'public/fabric-scans-ambientcg')
KINDS = ('color', 'normal', 'roughness')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def measure(path, kind):
    with Image.open(path) as im:
        original_size = list(im.size)
        im = ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail((256, 256), Image.Resampling.BILINEAR)
        a = np.asarray(im, dtype=np.float32) / 255
    mean = np.mean(a, axis=(0, 1))
    std = np.std(a, axis=(0, 1))
    gray = np.mean(a, axis=2)
    # Compare opposite borders against ordinary adjacent-pixel differences.
    # This is deliberately a heuristic: JPEG, anisotropy and lighting can bias it.
    edge_x = float(np.mean(np.abs(a[:, 0] - a[:, -1])))
    edge_y = float(np.mean(np.abs(a[0] - a[-1])))
    dx = float(np.mean(np.abs(a[:, 1:] - a[:, :-1])))
    dy = float(np.mean(np.abs(a[1:] - a[:-1])))
    row = np.mean(gray, axis=1)
    col = np.mean(gray, axis=0)
    # Low frequency periodic directional bands have elevated axis mean spread.
    # Report rather than deciding stripes are definitely a defect.
    stripe_x = float(np.std(col) / (np.std(gray) + 1e-6))
    stripe_y = float(np.std(row) / (np.std(gray) + 1e-6))
    flags = []
    if float(np.max(std)) < 0.012:
        flags.append('near_flat_rgb')
    if max(edge_x / (dx + 1e-4), edge_y / (dy + 1e-4)) > 8 and max(edge_x, edge_y) > .025:
        flags.append('possible_tile_edge_mismatch')
    if max(stripe_x, stripe_y) > .8 and float(np.std(gray)) > .03:
        flags.append('directional_banding_candidate')
    result = {
        'path': str(path.relative_to(ROOT)), 'sha256': sha256(path),
        'bytes': path.stat().st_size, 'dimensions': original_size,
        'sample_dimensions': [int(a.shape[1]), int(a.shape[0])],
        'rgb_mean': [round(float(v), 5) for v in mean],
        'rgb_std': [round(float(v), 5) for v in std],
        'gray_p01_p50_p99': [round(float(v), 5) for v in np.percentile(gray, [1, 50, 99])],
        'edge_difference_x_y': [round(edge_x, 5), round(edge_y, 5)],
        'neighbor_difference_x_y': [round(dx, 5), round(dy, 5)],
        'edge_to_neighbor_ratio_x_y': [round(edge_x / (dx + 1e-4), 3), round(edge_y / (dy + 1e-4), 3)],
        'directional_mean_spread_x_y': [round(stripe_x, 4), round(stripe_y, 4)],
    }
    if kind == 'normal':
        # Tangent-space normals conventionally encode (0.5, 0.5, 1) for flat.
        vec = a * 2 - 1
        lengths = np.linalg.norm(vec, axis=2)
        blue_below_half = float(np.mean(a[:, :, 2] < .5))
        result['normal_vector_length_mean_p01_p99'] = [round(float(v), 4) for v in (np.mean(lengths), *np.percentile(lengths, [1, 99]))]
        result['blue_below_half_fraction'] = round(blue_below_half, 5)
        if blue_below_half > .05:
            flags.append('unusual_normal_blue_orientation')
        if float(np.mean(np.abs(lengths - 1))) > .15:
            flags.append('normal_vector_length_review')
    if kind == 'roughness':
        channel_spread = float(np.max(np.max(a, axis=(0, 1)) - np.min(a, axis=(0, 1))))
        result['sample_dynamic_range'] = round(channel_spread, 5)
        result['channel_mean_spread'] = round(float(np.ptp(mean)), 5)
        if channel_spread < .035:
            flags.append('near_constant_roughness')
        if float(np.ptp(mean)) > .08:
            flags.append('roughness_rgb_channel_disagreement')
    result['flags'] = flags
    return result


def main():
    sources = {}
    issues = []
    for base in SETS:
        for folder in sorted((ROOT / base).iterdir()):
            if not folder.is_dir():
                continue
            present = {kind: folder / (kind + '.jpg') for kind in KINDS}
            if not any(p.exists() for p in present.values()):
                continue
            key = str(folder.relative_to(ROOT))
            maps = {}
            for kind, path in present.items():
                if path.is_file():
                    maps[kind] = measure(path, kind)
                    for flag in maps[kind]['flags']:
                        issues.append({'source': key, 'map': kind, 'flag': flag, 'path': maps[kind]['path'], 'sha256': maps[kind]['sha256']})
            sources[key] = {'maps': maps, 'missing_maps': [k for k in KINDS if k not in maps]}
    counts = Counter(item['flag'] for item in issues)
    summary = {'source_count': len(sources), 'map_count': sum(len(v['maps']) for v in sources.values()), 'map_types': dict(Counter(k for s in sources.values() for k in s['maps'])), 'flag_counts': dict(sorted(counts.items())), 'missing_map_sources': [k for k, v in sources.items() if v['missing_maps']]}
    report = {'schema_version': 1, 'generated_utc': datetime.now(timezone.utc).isoformat(), 'method': 'Pillow RGB 256x256 maximum bilinear thumbnail; full file streaming SHA256; values in normalized 0..1; directional and edge flags are review heuristics only; no scanner/color calibration or physical fabric validation', 'summary': summary, 'sources': sources, 'flagged_maps': issues}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(summary, indent=2))
    print(f'Wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
