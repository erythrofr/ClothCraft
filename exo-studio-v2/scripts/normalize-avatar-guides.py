"""Center front-orthographic Blender renders within a consistent figure frame.

Blender bounds may include skinned-mesh armatures or invisible accessories; this
step uses the actual rendered RGBA figure bounds instead of mesh bounding boxes.
Requires Pillow, already installed on the local Mac. Safe to rerun.
"""
from pathlib import Path
from PIL import Image

GUIDES=Path(__file__).resolve().parents[1]/'public/avatars/guides'
FRAME=(480,680)
for file in sorted(GUIDES.glob('*.png')):
    img=Image.open(file).convert('RGBA')
    region=img.getchannel('A').getbbox()
    if not region:
        raise SystemExit(f'Empty avatar render: {file}')
    crop=img.crop(region)
    ratio=min((FRAME[0]-26)/crop.width,(FRAME[1]-22)/crop.height)
    target=(max(1,round(crop.width*ratio)),max(1,round(crop.height*ratio)))
    crop=crop.resize(target,Image.Resampling.LANCZOS)
    # Use subtle neutral color and alpha; details are still recoverable from
    # original studio lights, without visually competing with pattern pieces.
    output=Image.new('RGBA',FRAME,(0,0,0,0))
    output.alpha_composite(crop,((FRAME[0]-target[0])//2,(FRAME[1]-target[1])//2))
    output.save(file)
    print('normalized',file.name,'source bounds',region,'size',target)
