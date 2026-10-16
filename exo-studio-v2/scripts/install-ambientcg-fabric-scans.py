#!/usr/bin/env python3
"""Install a curated set of additional CC0 fabric photographs from ambientCG.

This is not a laboratory calibration dataset and asset metadata does not prove
the user's fabric is identical. Hash the exact extracted 1K PBR image bytes.
Repeatable, resumable, with a bounded download list to conserve disk space.
Requires ambientCG's publicly published 1K-JPG material zip files.
"""
import concurrent.futures
import hashlib
import io
import json
import pathlib
import re
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIR = ROOT / 'public' / 'fabric-scans-ambientcg'
OUT = ROOT / 'src' / 'data' / 'ambientcgScans.generated.json'
API = 'https://ambientcg.com/api/v2/full_json?type=Material&limit=150&category={category}&include=downloadData'
USER_AGENT = 'EXOClothStudio-FabricQuality/1.0'

# Curated for textile-scale yarn, polyester, denim, wool, and leather grains.
# Unrelated carpet, stitched pre-finished auto upholstery and patterned
# plastics aren't incorrectly passed off as garment denim/jersey physics.
IDS = [
    'Fabric070','Fabric048','Fabric049','Fabric046','Fabric047',
    'Fabric077','Fabric069','Fabric003','Fabric085','Fabric084',
    'Fabric034','Fabric082A','Fabric036','Fabric019','Fabric032',
    'Fabric078','Fabric061','Fabric062','Fabric066','Fabric081A',
    'Leather039','Leather026','Leather025','Leather038','Leather032',
    'Leather037','Leather028','Leather031','Leather023','Leather024',
]


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent':USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def download(asset):
    asset_id = asset['assetId']
    downloads = asset['downloadFolders']['default']['downloadFiletypeCategories']['zip']['downloads']
    package = next((d for d in downloads if d.get('attribute') == '1K-JPG' and d.get('downloadLink')), None)
    if package is None:
        return asset_id, None, 'No official 1K-JPG PBR archive available'
    folder = DIR / asset_id
    saved = folder / 'manifest.json'
    if saved.is_file():
        m = json.loads(saved.read_text())
        if all((ROOT / 'public' / v['src'].lstrip('/')).exists() and
               hashlib.sha256((ROOT / 'public' / v['src'].lstrip('/')).read_bytes()).hexdigest()==v['sha256']
               for v in m['maps'].values()):
            return asset_id, m, None
    payload = fetch(package['downloadLink'])
    if len(payload) > 22*1024*1024:
        return asset_id, None, '1K download exceeds per-material size ceiling'
    with zipfile.ZipFile(io.BytesIO(payload)) as zipped:
        if len(zipped.namelist()) > 30:
            return asset_id,None,'unexpected files in official 1K archive'
        expected = {
            'color': '_Color.jpg', 'normal':'_NormalGL.jpg', 'roughness':'_Roughness.jpg'
        }
        sources = {}
        for channel,suffix in expected.items():
            found=[path for path in zipped.namelist() if path.endswith(suffix) and '/' not in path]
            if len(found) != 1:
                return asset_id,None,'missing PBR texture channel: '+channel
            item = zipped.getinfo(found[0])
            if item.file_size > 8*1024*1024:
                return asset_id,None,'texture file exceeds per-map size ceiling'
            sources[channel]=zipped.read(item)
    folder.mkdir(parents=True,exist_ok=True)
    maps={}
    for channel,data in sources.items():
        path=folder/(channel+'.jpg')
        tmp=folder/(channel+'.jpg.partial')
        tmp.write_bytes(data)
        tmp.replace(path)
        maps[channel]={
            'src':'/'+str(path.relative_to(ROOT/'public')).replace('\\','/'),
            'sha256':hashlib.sha256(data).hexdigest(),
            'resolution':'1k',
        }
    w,h=asset.get('dimensionX'),asset.get('dimensionY')
    measuredScale=bool(type(w) in (int,float) and type(h) in (int,float) and w>0 and h>0)
    entry={
       'id':asset_id,'source':'ambientCG','name':asset.get('displayName') or asset_id,
       'license':'CC0-1.0','assetUrl':'https://ambientcg.com/a/'+asset_id,
       'authors':'ambientCG',
       'categoryTags':asset.get('tags',[]),
       # ambientCG API dimensions are centimetres, not mm.
       'scanWidthCm':round(w,3) if measuredScale else 20,
       'scanHeightCm':round(h,3) if measuredScale else 20,
       'physicalScaleStatus':'provider-cm-dimensions' if measuredScale else 'unknown-illustrative-20cm',
       'maps':maps,
       'evidence':'CC0 photographic PBR; structural/surface appearance only; NOT tensile, friction or bending data',
    }
    saved.write_text(json.dumps(entry,indent=2)+'\n')
    return asset_id,entry,None


def main():
    catalog={}
    for category in ('Fabric','Leather'):
        result=json.loads(fetch(API.format(category=category)))
        catalog.update((entry['assetId'],entry) for entry in result['foundAssets'])
    missing=sorted(set(IDS)-set(catalog))
    if missing:raise ValueError('Unexpected missing official source IDs: '+','.join(missing))
    DIR.mkdir(exist_ok=True)
    found,skipped={},{}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(download,catalog[id]):id for id in IDS}
        for future in concurrent.futures.as_completed(futures):
            id=futures[future]
            try:
                _,result,error=future.result()
                if error:skipped[id]=error
                else:found[id]=result
                print(('SKIP' if error else 'OK')+' '+id+(' '+error if error else ''),flush=True)
            except Exception as exc:
                skipped[id]=str(exc)
                print('FAIL '+id+' '+str(exc),flush=True)
    OUT.write_text(json.dumps({
        'schemaVersion':1,'license':'CC0-1.0',
        'licenseReference':'https://docs.ambientcg.com/books/website-licensing/page/license-information',
        'assets':dict(sorted(found.items())),'skipped':skipped,
    },indent=2)+'\n')
    print(json.dumps({'downloaded':len(found),'skipped':skipped,'manifest':str(OUT)}))
    if not found:raise SystemExit('No verified source archives installed')


if __name__ == '__main__':main()
