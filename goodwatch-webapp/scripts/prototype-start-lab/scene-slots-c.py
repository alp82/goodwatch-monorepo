#!/usr/bin/env python3
"""Process batch C chroma scenes; rerun from retained raw PNGs.

Usage: scene-slots-c.py [--source ID GENERATED_PNG] [--id ID]
Without --id, processes all three and builds the index and contact sheet.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2] / 'public/prototype-start-lab/scenes'
SCENES = {
    'nook-stage': ('Extended rainy painted nook', 'eye level, near frontal, wide', 'gouache', 'landscape', 'Calm search wall: x=0.20–0.80, y=0.02–0.24; the window lintel limits the clear zone below y=0.24. Calm card tray rug: x=0.34–0.68, y=0.81–0.95. Sleeping dog on window seat. Best of three attempts: a few leaves slightly intrude on the outer edge of the lowest left case; extracted quad spans this small intrusion.'),
    'nook-stage-portrait': ('Extended rainy painted nook for a phone', 'eye level, frontal', 'gouache', 'portrait', 'Calm search wall: x=0.21–0.79, y=0.02–0.26. Calm card tray rug: x=0.36–0.77, y=0.78–0.97. Side case band begins at y=0.21; window and sleeping dog fill the middle.'),
    'nook-stage-tv': ('Extended rainy painted nook with small side TV', 'eye level, near frontal, wide', 'gouache', 'landscape', 'Calm search wall: x=0.20–0.80, y=0.02–0.24; the window lintel limits the clear zone below y=0.24. Calm card tray rug: x=0.34–0.68, y=0.81–0.95. Small TV on right-side middle-band cabinet. Best of three attempts.'),
}


def key_masks(rgb):
    # OpenCV hue is half the hue in degrees: green 120 -> 60, magenta 300 -> 150.
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    green = cv2.inRange(hsv, (43, 140, 100), (83, 255, 255))
    magenta = cv2.inRange(hsv, (133, 140, 100), (171, 255, 255))
    return green, magenta


def regions(mask):
    kernel = np.ones((3, 3), np.uint8)
    clean = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(clean)
    result = []
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] < mask.size * 0.0005:
            continue
        component = np.uint8(labels == label) * 255
        contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour = max(contours, key=cv2.contourArea)
        filled = np.zeros_like(mask)
        cv2.drawContours(filled, [contour], -1, 255, cv2.FILLED)
        hull = cv2.convexHull(contour)
        perimeter = cv2.arcLength(hull, True)
        quad = None
        for factor in np.linspace(0.001, 0.08, 160):
            approx = cv2.approxPolyDP(hull, factor * perimeter, True)
            if len(approx) == 4:
                quad = approx.reshape(4, 2).astype(float)
                break
        fallback = quad is None
        if fallback:
            quad = cv2.boxPoints(cv2.minAreaRect(hull)).astype(float)
        # These faces are upright; splitting the top/bottom pair avoids sum/diff ties.
        by_y = quad[np.argsort(quad[:, 1])]
        top = by_y[:2][np.argsort(by_y[:2, 0])]
        bottom = by_y[2:][np.argsort(by_y[2:, 0])]
        quad = np.array([top[0], top[1], bottom[1], bottom[0]])
        x, y, w, h = cv2.boundingRect(contour)
        result.append(dict(mask=filled, quad=quad, box=[x, y, w, h], fallback=fallback,
                           area=int(np.count_nonzero(filled))))
    return result


def normalized(region, width, height):
    return {'quad': np.round(region['quad'] / [width, height], 4).tolist(),
            'box': np.round(np.array(region['box']) / [width, height, width, height], 4).tolist()}


def process(scene_id):
    title, perspective, style, orientation, notes = SCENES[scene_id]
    with Image.open(ROOT / 'raw' / f'{scene_id}.png') as source:
        rgb = np.array(source.convert('RGB'))
    height, width = rgb.shape[:2]
    expected = (1024, 1536) if orientation == 'portrait' else (1536, 1024)
    if (width, height) != expected:
        raise ValueError(f'{scene_id}: expected {expected}, got {(width, height)}')
    green, magenta = key_masks(rgb)
    televisions, slots = regions(green), regions(magenta)
    if len(televisions) != (1 if scene_id == 'nook-stage-tv' else 0) or not 12 <= len(slots) <= 18:
        raise ValueError(f'{scene_id}: {len(televisions)} TVs, {len(slots)} slots; review generation')
    tv = televisions[0] if televisions else None
    # Wall frames flank the central window in portrait, and sit to its right in landscape.
    frames = {id(r) for r in slots if 0.18 < (r['box'][0] + r['box'][2] / 2) / width < 0.82}
    slots.sort(key=lambda r: (r['box'][0], r['box'][1]))
    all_regions = ([(tv, (7, 8, 11))] if tv else []) + [(r, (28, 31, 38)) for r in slots]
    output = rgb.copy()
    nearby = np.zeros((height, width), np.uint8)
    for region, color in all_regions:
        expanded = cv2.dilate(region['mask'], np.ones((7, 7), np.uint8))
        output[expanded > 0] = color
        nearby |= cv2.dilate(region['mask'], np.ones((25, 25), np.uint8))
    # Broader, low-value fringe test removes colored antialiasing and key spill near faces.
    hsv = cv2.cvtColor(output, cv2.COLOR_RGB2HSV)
    hue = hsv[:, :, 0]
    fringe = (nearby > 0) & (((hue >= 40) & (hue <= 88)) | ((hue >= 125) & (hue <= 177)))
    hsv[fringe, 1] = 0
    output = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    image = Image.fromarray(output)
    image.save(ROOT / f'{scene_id}.webp', quality=84)
    with tempfile.TemporaryDirectory(dir=ROOT / 'debug') as temp:
        intermediate = Path(temp) / 'processed.png'
        image.save(intermediate)
        subprocess.run(['avifenc', '-q', '60', '--jobs', '2', str(intermediate), str(ROOT / f'{scene_id}.avif')],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    problems = []
    for index, slot in enumerate(slots, 1):
        q = slot['quad']
        edge_width = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2
        edge_height = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
        if edge_width >= edge_height:
            problems.append(f'Slot {index} not portrait-shaped')
        if edge_width < 40:
            problems.append(f'Slot {index} short edge {edge_width:.0f}px (below 40px target)')
    if any(r['fallback'] for r, _ in all_regions):
        problems.append('Some quads used minAreaRect fallback')
    tv_percent = 100 * tv['area'] / (width * height) if tv else None
    if tv and not 2 <= tv_percent <= 4:
        notes += f' TV screen occupies {tv_percent:.2f}% of the image, outside the approximate 2–4% target.'
    if problems:
        notes += ' QC: ' + '; '.join(problems) + '.'
    metadata = dict(id=scene_id, title=title, perspective=perspective, style=style,
                    orientation=orientation, width=width, height=height, tv=normalized(tv, width, height) if tv else None,
                    slots=[dict(kind='frame' if id(r) in frames else 'case-shelf', **normalized(r, width, height)) for r in slots], notes=notes)
    (ROOT / f'{scene_id}.json').write_text(json.dumps(metadata, indent=2) + '\n')
    debug = image.copy()
    draw = ImageDraw.Draw(debug)
    font = ImageFont.truetype('DejaVuSans.ttf', 20)
    for label, region, color in ([('TV', tv, '#00ff00')] if tv else []) + [(str(i), r, '#ff00ff') for i, r in enumerate(slots, 1)]:
        points = [tuple(p) for p in region['quad']]
        draw.line(points + [points[0]], fill=color, width=3)
        x, y = points[0]
        draw.text((x + 4, y + 5), label, font=font, fill=color, stroke_width=2, stroke_fill='#07080b')
    debug.save(ROOT / 'debug' / f'{scene_id}.png')
    tv_label = f'{tv_percent:.2f}%' if tv else 'none'
    print(f'{scene_id}: {len(slots)} slots, TV {tv_label}, '
          f'min slot side {min(min(r["box"][2:]) for r in slots)}px; {problems or "geometry OK"}')



def contact_sheet():
    sheet = Image.new('RGB', (2100, 1100), '#111827')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('DejaVuSans.ttf', 23)
    for index, scene_id in enumerate(SCENES):
        x, y = index * 700, 0
        with Image.open(ROOT / f'{scene_id}.webp') as image:
            image.thumbnail((680, 1020))
            sheet.paste(image, (x + (700 - image.width) // 2, y + 40 + (1020 - image.height) // 2))
        draw.text((x + 16, y + 9), scene_id, font=font, fill='#f59e0b')
    sheet.save(ROOT / 'debug' / 'contact-c.png')
    (ROOT / 'index-c.json').write_text(json.dumps(list(SCENES), indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', nargs=2, action='append', default=[], metavar=('ID', 'PNG'))
    parser.add_argument('--id', choices=SCENES)
    args = parser.parse_args()
    for directory in (ROOT, ROOT / 'raw', ROOT / 'debug'):
        directory.mkdir(parents=True, exist_ok=True)
    for scene_id, source in args.source:
        if scene_id not in SCENES:
            parser.error(f'Unknown scene {scene_id}')
        shutil.copy2(source, ROOT / 'raw' / f'{scene_id}.png')
    for scene_id in ([args.id] if args.id else SCENES):
        process(scene_id)
    if not args.id:
        contact_sheet()


if __name__ == '__main__':
    main()
