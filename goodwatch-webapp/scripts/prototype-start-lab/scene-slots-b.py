#!/usr/bin/env python3
"""Process batch B chroma scenes; rerun from retained raw PNGs.

Usage: scene-slots-b.py [--source ID GENERATED_PNG] [--id ID]
Without --id, processes all eight and builds the index and contact sheet.
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
    'iso-cutaway': ('Isometric living room cutaway', 'isometric cutaway, elevated', '3d-diorama', 'landscape', 'Calm central background above y=0.21; wall edges enter the upper third. Best of three attempts: materials remain more realistic than clay, and the projection is shallower than true isometric.'),
    'iso-cutaway-portrait': ('Clay living room for a phone', 'isometric cutaway, elevated', '3d-diorama', 'portrait', 'Dark background above and below the centered clay room. Warmer, lighter walls than the landscape companion.'),
    'pixel-iso': ('Rainy pixel living room', 'isometric cutaway, elevated', 'pixel-art', 'landscape', 'Sleeping cat on sofa. Calm central background above y=0.16; upper-third wall edges and posters reduce text space. Pixel stair steps are approximated by four-corner quads.'),
    'pixel-iso-portrait': ('Rainy pixel room for a phone', 'isometric cutaway, elevated', 'pixel-art', 'portrait', 'Dark background above and below. Sleeping cat on sofa. Pixel stair steps are approximated by four-corner quads.'),
    'miniature': ('Handmade miniature living room', 'elevated, about 45 degrees', 'photo', 'landscape', 'Tilt-shift blur at perimeter and foreground; markers in focus. Calm dark strip above y=0.13; posters occupy part of the upper third.'),
    'nook-illustrated': ('Rainy painted watching nook', 'eye level, near frontal', 'gouache', 'landscape', 'Sleeping dog on window seat. Calm central painted wall above y=0.22; shelves and plants enter the upper third at edges.'),
    'flat-vector': ('Geometric amber living room', 'eye level, frontal', 'vector', 'landscape', 'Entire upper 29% is calm dark navy. Twelve slots: four frames and eight shelf cases. TV is deliberately very small.'),
    'papercraft': ('Layered paper living room', 'eye level, near frontal', 'papercraft-photo', 'landscape', 'Calm central dark wall above y=0.20; paper foliage and shelf cases enter upper third at edges.'),
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
    if len(televisions) != 1 or not 6 <= len(slots) <= 14:
        raise ValueError(f'{scene_id}: {len(televisions)} TVs, {len(slots)} slots; review generation')
    tv = televisions[0]
    # In this batch each scene visibly has four large framed posters, all other faces are cases.
    frames = {id(r) for r in sorted(slots, key=lambda r: r['area'], reverse=True)[:4]}
    slots.sort(key=lambda r: (r['box'][0], r['box'][1]))
    all_regions = [(tv, (7, 8, 11))] + [(r, (28, 31, 38)) for r in slots]
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
    tv_percent = 100 * tv['area'] / (width * height)
    if tv_percent < 4:
        notes += f' TV screen occupies {tv_percent:.2f}% of the image, below the approximate 4–12% target.'
    if problems:
        notes += ' QC: ' + '; '.join(problems) + '.'
    metadata = dict(id=scene_id, title=title, perspective=perspective, style=style,
                    orientation=orientation, width=width, height=height, tv=normalized(tv, width, height),
                    slots=[dict(kind='frame' if id(r) in frames else 'case-shelf', **normalized(r, width, height)) for r in slots], notes=notes)
    (ROOT / f'{scene_id}.json').write_text(json.dumps(metadata, indent=2) + '\n')
    debug = image.copy()
    draw = ImageDraw.Draw(debug)
    font = ImageFont.truetype('DejaVuSans.ttf', 20)
    for label, region, color in [('TV', tv, '#00ff00')] + [(str(i), r, '#ff00ff') for i, r in enumerate(slots, 1)]:
        points = [tuple(p) for p in region['quad']]
        draw.line(points + [points[0]], fill=color, width=3)
        x, y = points[0]
        draw.text((x + 4, y + 5), label, font=font, fill=color, stroke_width=2, stroke_fill='#07080b')
    debug.save(ROOT / 'debug' / f'{scene_id}.png')
    print(f'{scene_id}: {len(slots)} slots, TV {100 * tv["area"] / (width * height):.2f}%, '
          f'min slot side {min(min(r["box"][2:]) for r in slots)}px; {problems or "geometry OK"}')


def contact_sheet():
    sheet = Image.new('RGB', (1600, 4 * 560), '#111827')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('DejaVuSans.ttf', 23)
    for index, scene_id in enumerate(SCENES):
        x, y = (index % 2) * 800, (index // 2) * 560
        with Image.open(ROOT / f'{scene_id}.webp') as image:
            image.thumbnail((776, 500))
            sheet.paste(image, (x + (800 - image.width) // 2, y + 40 + (500 - image.height) // 2))
        draw.text((x + 16, y + 9), scene_id, font=font, fill='#f59e0b')
    sheet.save(ROOT / 'debug' / 'contact-b.png')
    (ROOT / 'index-b.json').write_text(json.dumps(list(SCENES), indent=2) + '\n')


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
