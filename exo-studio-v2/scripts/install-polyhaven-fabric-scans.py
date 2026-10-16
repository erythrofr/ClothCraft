#!/usr/bin/env python3
"""Install licensed Poly Haven CC0 reference texture maps (not fabric measurements).

Uses official public API: https://api.polyhaven.com and verified CC0 assets.
Repeatable and resumable, checksum-verifies every download. Images remain
unaltered as originals. Never adds source files without a verified checksum.
    python3 scripts/install-polyhaven-fabric-scans.py

Copyright of source materials: Poly Haven contributors; released CC0.
Poly Haven API terms apply: https://github.com/Poly-Haven/Public-API/blob/master/ToS.md
"""
import concurrent.futures
import hashlib
import json
import os
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'fabric-scans'
OUTPUT = ROOT / 'src' / 'data' / 'polyhavenScans.generated.json'
ASSET_IDS = [
    'bi_stretch', 'brown_leather', 'caban', 'cotton_jersey',
    'crepe_georgette', 'crepe_satin', 'curly_teddy_checkered',
    'curly_teddy_natural', 'denim_fabric', 'denim_fabric_03',
    'denim_fabric_04', 'denim_fabric_05', 'denim_fabric_06',
    'denmin_fabric_02', 'fabric_leather_01', 'fabric_leather_02',
    'faux_fur_geometric', 'floral_jacquard', 'gingham_check',
    'hessian_230', 'hessian_380', 'jersey_melange', 'jogging_melange',
    'knitted_fleece', 'leather_red_02', 'leather_red_03', 'leather_white',
    'polar_fleece', 'poly_wool_herringbone', 'quatrefoil_jacquard_fabric',
    'ribbed_corduroy', 'rough_linen', 'scuba_suede', 'stretch_poplin',
    'terlenka', 'terry_cloth', 'velour_velvet', 'waffle_pique_cotton',
    'wool_boucle',
]
HEADERS = {'User-Agent': 'EXO-ClothStudio-CC0-Asset-Installer/1.0'}


def fetch(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def download(asset_id, channel, entry):
    # Verify the source-specified MD5 even on already-downloaded bytes.
    extension, meta = entry
    file = DEST / asset_id / (channel + '.' + extension)
    file.parent.mkdir(parents=True, exist_ok=True)
    if file.is_file():
        data = file.read_bytes()
        if hashlib.md5(data).hexdigest() == meta['md5']:
            return channel, '/' + str(file.relative_to(ROOT / 'public')).replace(os.sep, '/'), hashlib.sha256(data).hexdigest()
    data = fetch(meta['url'])
    if hashlib.md5(data).hexdigest() != meta['md5']:
        raise RuntimeError(f'Checksum mismatch: {asset_id} {channel}')
    temp = file.with_name(file.name + '.downloading')
    temp.write_bytes(data)
    temp.replace(file)
    return channel, '/' + str(file.relative_to(ROOT / 'public')).replace(os.sep, '/'), hashlib.sha256(data).hexdigest()


def one_asset(asset_id):
    files = json.loads(fetch(f'https://api.polyhaven.com/files/{asset_id}'))
    info = json.loads(fetch(f'https://api.polyhaven.com/info/{asset_id}'))
    def one_channel(options):
        for name in options:
            data = files.get(name, {}).get('1k', {})
            for ext in ('jpg', 'png'):
                item = data.get(ext)
                if item and all(k in item for k in ('url', 'md5', 'size')):
                    return ext, item
        return None
    channels = {
        'color': one_channel(('Diffuse', 'col_01', 'col_1', 'col_02', 'col_2')),
        'normal': one_channel(('nor_gl',)),
        'roughness': one_channel(('Rough',)),
    }
    if not all(channels.values()):
        missing = [name for name, source in channels.items() if not source]
        return asset_id, None, f'official API missing 1k JPG/PNG channels: {missing}'
    downloaded = dict((channel, download(asset_id, channel, pair)) for channel, pair in channels.items())
    dimensions = info.get('dimensions') or [None, None]
    # The Poly Haven API returns nominal texture dimensions in millimeters.
    # Width/height are metadata, not a substitute for a physical scan ruler.
    if not all(isinstance(value, (float, int)) and 1 < value < 10000 for value in dimensions[:2]):
        return asset_id, None, 'invalid provider physical dimensions'
    manifest = {
        'id': asset_id, 'source': 'Poly Haven', 'license': 'CC0-1.0',
        'assetUrl': f'https://polyhaven.com/a/{asset_id}',
        'authors': info.get('authors', {}), 'name': info.get('name', asset_id),
        'categoryTags': info.get('categories', []),
        'scanWidthCm': round(dimensions[0] / 10, 3),
        'scanHeightCm': round(dimensions[1] / 10, 3),
        'maps': {channel: {'src': value[1], 'sha256': value[2], 'resolution': '1k'}
                 for channel, value in downloaded.items()},
        'evidence': 'CC0 photographic appearance reference; NO measured stretch/bending/shear',
    }
    return asset_id, manifest, None


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    success, failed = {}, {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(one_asset, item): item for item in ASSET_IDS}
        for future in concurrent.futures.as_completed(futures):
            asset_id = futures[future]
            try:
                _, result, error = future.result()
                if result is None:
                    failed[asset_id] = error
                    print(f'SKIP {asset_id}: {error}', flush=True)
                else:
                    success[asset_id] = result
                    print(f'OK {asset_id}', flush=True)
            except Exception as exc:
                failed[asset_id] = str(exc)
                print(f'FAIL {asset_id}: {exc}', flush=True)
    output = {
        'schemaVersion': 1,
        'licenseReference': 'https://polyhaven.com/license',
        'scanType': 'shared_CC0_real_photographic_reference_not_individual_fabric_calibration',
        'assets': dict(sorted(success.items())),
        'skipped': dict(sorted(failed.items())),
    }
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'installed': len(success), 'skipped': failed, 'manifest': str(OUTPUT)}))
    if not success:
        raise SystemExit('No legally verified scans installed')


if __name__ == '__main__':
    main()
