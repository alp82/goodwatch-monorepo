#!/usr/bin/env python3
"""Process batch C chroma scenes; rerun from retained raw PNGs.

Usage: scene-slots-c.py [--source ID GENERATED_PNG] [--id ID]
Without --id, processes all scenes and builds the indexes and contact sheets.
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
    'nook-stage': ('Extended rainy painted nook', 'eye level, near frontal, wide', 'gouache', 'landscape', 'Calm search wall: x=0.18–0.82, y=0.00–0.36. Calm mood-chip wall right of window: x=0.50–0.85, y=0.39–0.55; four wall frames removed, leaving plain painted deep blue wall. Calm card tray rug: x=0.24–0.70, y=0.82–0.94. Lowered rainy window and sleeping dog on window seat. Two plants, two shaded electric lamps, outer shelf fairy lights; no candles, lanterns, baskets or TV. Accepted attempt 2 of 3; round 5 localized wall-frame edit.'),
    'nook-stage-portrait': ('Extended rainy painted nook for a phone', 'eye level, frontal', 'gouache', 'portrait', 'Calm search wall: x=0.20–0.80, y=0.00–0.34. Calm mood-chip walls flanking window: x=0.18–0.28 and x=0.72–0.82, y=0.35–0.54; four wall frames removed, leaving plain painted deep blue wall. Calm card tray rug: x=0.27–0.74, y=0.79–0.94. Lowered rainy window and sleeping dog on window seat. Two plants, two shaded electric lamps, outer shelf fairy lights; no candles, lanterns, baskets or TV. Accepted attempt 2 of 3; round 5 localized wall-frame edit.'),
    'nook-stage-tv': ('Extended rainy painted nook with small side TV', 'eye level, near frontal, wide', 'gouache', 'landscape', 'Calm search wall: x=0.20–0.80, y=0.02–0.24; the window lintel limits the clear zone below y=0.24. Calm card tray rug: x=0.34–0.68, y=0.81–0.95. Small TV on right-side middle-band cabinet. Best of three attempts.'),
    'nook-tv-corner': ('Painted TV corner', 'eye level, near frontal', 'gouache', 'landscape', 'Other side of the same room: low media console, record player, records, plaid reading armchair and floor lamp. Calm rug: x=0.25–0.70, y=0.73–0.90. No reserved search wall zone. One plant; no window seat, dog, tall bookshelves, candles, lanterns or baskets. Accepted attempt 2 of 3.'),
}
ROUND_D = ('nook-stage', 'nook-stage-portrait', 'nook-tv-corner')
CALM_TOP = {'nook-stage': (0.18, 0.0, 0.82, 0.36),
            'nook-stage-portrait': (0.20, 0.0, 0.80, 0.34)}


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
    slot_range = (6, 8) if scene_id == 'nook-tv-corner' else ((12, 12) if scene_id in CALM_TOP else (12, 18))
    if len(televisions) != (1 if scene_id in ('nook-stage-tv', 'nook-tv-corner') else 0) or not slot_range[0] <= len(slots) <= slot_range[1]:
        raise ValueError(f'{scene_id}: {len(televisions)} TVs, {len(slots)} slots; review generation')
    tv = televisions[0] if televisions else None
    if scene_id in CALM_TOP:
        x0, y0, x1, y1 = CALM_TOP[scene_id]
        crop = magenta[int(y0 * height):int(y1 * height), int(x0 * width):int(x1 * width)]
        if np.any(crop):
            raise ValueError(f'{scene_id}: chroma slot intrudes into calm top zone')
    # Generated faces are almost pure keys. Normalize the retained raw masks so
    # they are uniform exact chroma colors, while preserving the painted room.
    if scene_id in ROUND_D:
        for region in slots:
            rgb[region['mask'] > 0] = (255, 0, 255)
        if tv:
            rgb[tv['mask'] > 0] = (0, 255, 0)
        Image.fromarray(rgb).save(ROOT / 'raw' / f'{scene_id}.png')
    # Wall frames flank the central window in portrait, and sit to its right in landscape.
    frames = {id(r) for r in slots if 0.18 < (r['box'][0] + r['box'][2] / 2) / width < 0.82}
    if scene_id in CALM_TOP and frames:
        raise ValueError(f'{scene_id}: wall-frame slots must be absent')
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
    tv_range = (6, 10) if scene_id == 'nook-tv-corner' else (2, 4)
    if tv and not tv_range[0] <= tv_percent <= tv_range[1]:
        if scene_id == 'nook-tv-corner':
            raise ValueError(f'{scene_id}: TV area {tv_percent:.2f}% outside {tv_range}')
        notes += f' TV screen occupies {tv_percent:.2f}% of the image, outside the approximate 2–4% target.'
    if tv and scene_id == 'nook-tv-corner':
        notes += f' TV screen area: {tv_percent:.2f}% of the image.'
    if problems:
        notes += ' QC: ' + '; '.join(problems) + '.'
    metadata = dict(id=scene_id, title=title, perspective=perspective, style=style,
                    orientation=orientation, width=width, height=height, tv=normalized(tv, width, height) if tv else None,
                    slots=[dict(kind='frame' if id(r) in frames else 'case-shelf', **normalized(r, width, height)) for r in slots], notes=notes)
    (ROOT / f'{scene_id}.json').write_text(json.dumps(metadata, indent=2) + '\n')
    debug = image.copy()
    draw = ImageDraw.Draw(debug)
    font = ImageFont.truetype('DejaVuSans.ttf', 20)
    if scene_id in CALM_TOP:
        x0, y0, x1, y1 = CALM_TOP[scene_id]
        draw.rectangle((x0 * width, y0 * height, x1 * width, y1 * height), outline='#38bdf8', width=3)
        draw.text((x0 * width + 8, 8), 'Calm top', font=font, fill='#38bdf8')
    for label, region, color in ([('TV', tv, '#00ff00')] if tv else []) + [(str(i), r, '#ff00ff') for i, r in enumerate(slots, 1)]:
        points = [tuple(p) for p in region['quad']]
        draw.line(points + [points[0]], fill=color, width=3)
        x, y = points[0]
        draw.text((x + 4, y + 5), label, font=font, fill=color, stroke_width=2, stroke_fill='#07080b')
    debug.save(ROOT / 'debug' / f'{scene_id}.png')
    tv_label = f'{tv_percent:.2f}%' if tv else 'none'
    print(f'{scene_id}: {len(slots)} slots, TV {tv_label}, '
          f'min slot side {min(min(r["box"][2:]) for r in slots)}px; {problems or "geometry OK"}')



def contact_sheet(scene_ids, batch):
    sheet = Image.new('RGB', (2100, 1100), '#111827')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('DejaVuSans.ttf', 23)
    for index, scene_id in enumerate(scene_ids):
        x, y = index * 700, 0
        with Image.open(ROOT / f'{scene_id}.webp') as image:
            image.thumbnail((680, 1020))
            sheet.paste(image, (x + (700 - image.width) // 2, y + 40 + (1020 - image.height) // 2))
        draw.text((x + 16, y + 9), scene_id, font=font, fill='#f59e0b')
    sheet.save(ROOT / 'debug' / f'contact-{batch}.png')
    (ROOT / f'index-{batch}.json').write_text(json.dumps(list(scene_ids), indent=2) + '\n')


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
        contact_sheet(('nook-stage', 'nook-stage-portrait', 'nook-stage-tv'), 'c')
        contact_sheet(ROUND_D, 'd')


if __name__ == '__main__':
    main()
