#!/usr/bin/env python3
"""Visual contact sheet for all 400 EXO fabric specifications.

Uses local CC0 photographed source color scans when available and labels family
proxies/procedurals. This is an artistic colorway preview, NOT a calibrated
spectrophotometric measurement, a lab test or a 3D screenshot.
"""
import io
import json
import math
import pathlib
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPORT = ROOT / 'screenshots' / 'EXO_400_FABRIC_CONTACT_SHEET.jpg'
COMMAND = ['node', '--input-type=module', '-e',
           "import {FABRIC_PRESETS} from './src/data/defaultProject.js';" +
           "console.log(JSON.stringify(Object.values(FABRIC_PRESETS)))"]
FABRICS = json.loads(subprocess.check_output(COMMAND, cwd=ROOT).decode())
assert len(FABRICS) == 400
W, H, COLS = 174, 132, 16
ROWS = math.ceil(len(FABRICS) / COLS)
canvas = Image.new('RGB', (COLS*W, ROWS*H+88), '#20262c')
draw = ImageDraw.Draw(canvas)
FONT_PATH = '/System/Library/Fonts/Supplemental/Arial.ttf'
try:
    title_font = ImageFont.truetype(FONT_PATH, 24)
    label_font = ImageFont.truetype(FONT_PATH, 12)
    small_font = ImageFont.truetype(FONT_PATH, 10)
except OSError:
    title_font = ImageFont.load_default()
    label_font = small_font = title_font
draw.text((18, 12), 'EXO | 400 Fabric Material Colorways', font=title_font, fill='#f3f4f5')
draw.text((18, 51), 'Licensed photographic textile references and generated weave fallbacks. NOT 400 measured fabrics or 400 unique scans.', font=small_font, fill='#b2c2cf')
images = {}


def fabric_color(code):
    code = str(code or '#777777')
    if len(code) == 7 and code.startswith('#'):
        try: return tuple(int(code[i:i+2], 16) for i in (1,3,5))
        except ValueError: pass
    return (128, 128, 128)


def scan_photo(source):
    if source not in images:
        path = ROOT / 'public' / source.lstrip('/')
        if path.exists():
            with Image.open(path) as src:
                images[source] = ImageOps.fit(src.convert('RGB'), (W-12, H-49), method=Image.Resampling.LANCZOS)
        else:
            images[source] = None
    return images[source]


def retint(source, color):
    gray = ImageOps.grayscale(source)
    avg = ImageStat.Stat(gray).mean[0]/255
    mean = max(.06, min(.94, avg))
    out = []
    for channel in color:
        lut = []
        for i in range(256):
            ratio = max(.45, min(1.65, ((i/255+.075)/(mean+.075))**.88))
            lut.append(round(max(0, min(255, channel*ratio))))
        out.append(gray.point(lut))
    return Image.merge('RGB', tuple(out))


def generated(swatch, color, material, index):
    image = Image.new('RGB', swatch, color)
    layer = ImageDraw.Draw(image, 'RGBA')
    family = str(material.get('surfaceFamily') or material.get('name') or '').lower()
    lines = 3 if 'fleece' in family else 6 if 'leather' in family else 8 if 'knit' in family else 14
    if 'mesh' in family or 'tulle' in family:
        for y in range(-5, swatch[1], 7):
            for x in range(-5, swatch[0], 7):
                layer.ellipse((x,y,x+3,y+3), fill=(0,0,0,145))
    elif 'rib' in family or 'corduroy' in family:
        for x in range(0, swatch[0], lines):
            layer.line((x,0,x,swatch[1]), fill=(255,255,255,44), width=2)
            layer.line((x+2,0,x+2,swatch[1]), fill=(0,0,0,55))
    else:
        for x in range(-swatch[1], swatch[0], lines):
            layer.line((x,0,x+swatch[1],swatch[1]),fill=(255,255,255,28))
        for y in range(0,swatch[1],lines):
            layer.line((0,y,swatch[0],y),fill=(0,0,0,40))
    return image


totals = {'construction-reference':0,'family-proxy':0,'procedural':0}
for index, fabric in enumerate(FABRICS):
    x0 = index % COLS * W
    y0 = index // COLS * H + 88
    color=fabric_color(fabric.get('color'))
    scan = fabric.get('texture', {}).get('src')
    info = fabric.get('photoReference') or {}
    photo = scan_photo(scan) if scan else None
    if photo:
        swatch = retint(photo, color)
        kind = info.get('match') or 'family-proxy'
    else:
        swatch = generated((W-12,H-49), color, fabric, index)
        kind = 'procedural'
    totals[kind] += 1
    canvas.paste(swatch,(x0+6,y0+6))
    draw.rectangle((x0+6,y0+H-42,x0+W-6,y0+H-5), fill='#2b333c')
    title = fabric['name'].split(' · ')[0]
    if len(title)>22:title=title[:21]+'…'
    draw.text((x0+8,y0+H-41),title,fill='#f0f2f5',font=label_font)
    label=f"{int(fabric['gsm'])}gsm | {kind.replace('construction-reference','SCAN').replace('family-proxy','PROXY').replace('procedural','PROC')}"
    draw.text((x0+8,y0+H-25),label,fill='#adc0cd',font=small_font)
    draw.text((x0+W-35,y0+8),str(index+1),fill='#ffffff',font=small_font,stroke_width=1,stroke_fill='#263038')
EXPORT.parent.mkdir(parents=True,exist_ok=True)
canvas.save(EXPORT, quality=88, subsampling=0, optimize=True)
print(json.dumps({'output':str(EXPORT),'total':len(FABRICS),'sources':totals,'size':canvas.size}))
