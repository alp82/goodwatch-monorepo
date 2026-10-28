#!/usr/bin/env python3
"""Process round 11 Blu-ray shelf edits; rerun from retained raw PNGs.

Usage: scene-slots-r11-1.py [--source ID GENERATED_PNG] [--id ID] [--focus-only]
Without --id, processes all scenes and builds the indexes and contact sheets.
"""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2] / 'public/prototype-start-lab/scenes'
VARIATIONS = {
    'a': 'Fairy lights, alternating face-out positions, cream knit throw, terracotta and small plants.',
    'b': 'Under-shelf LEDs, paired face-out cases, ochre throw, woven charcoal cushions, cream ceramic and record.',
    'c': 'Lamp glow without shelf lights, asymmetrical leaning cases, dusty blue herringbone throw, navy bowl and plant.',
    'd': 'Fairy lights, small disc stacks with propped face-out cases, rust throw, indigo cushions, ochre ceramic and record.',
    'e': 'Under-shelf LEDs, airy mixed-height rows and gaps, staggered face-out cases, sage gray throw, stitched cushions and cream ceramic.',
}
ROUND_11 = tuple(f'nook-r11-{letter}{suffix}' for letter in VARIATIONS
                 for suffix in ('', '-portrait'))
ATTEMPTS = {'nook-r11-a': 3, 'nook-r11-a-portrait': 3,
            'nook-r11-b': 3, 'nook-r11-b-portrait': 3, 'nook-r11-c': 2,
            'nook-r11-c-portrait': 2, 'nook-r11-d': 2, 'nook-r11-d-portrait': 2,
            'nook-r11-e': 2, 'nook-r11-e-portrait': 2}
SCENES = {}
for letter, variation in VARIATIONS.items():
    for suffix in ('', '-portrait'):
        scene_id = f'nook-r11-{letter}{suffix}'
        SCENES[scene_id] = (
            f'Bay sofa, Blu-ray shelves {letter.upper()}' + (' for a phone' if suffix else ''),
            'eye level, near frontal', 'gouache', 'portrait' if suffix else 'landscape',
            'Edited original r9 bay sofa A. Mostly thin spine-out Blu-ray and DVD cases, '
            'with face-out plastic cases whose cover inserts are exact #FF00FF in raw. '
            'No picture frames, TV, candles or plaid. ' + variation + ' '
            'Focus surrounds complete sofa, sleeping dog and throw. '
            f'Visual QC: selected attempt {ATTEMPTS.get(scene_id, 1)} of at most 3; '
            'cover inserts checked on debug overlays inside thin plastic rims.')
ROUND_10 = ()  # Original anchoring must not restore the old shelf layout.
ROUND_D = ()
ROUND_F = ROUND_11
CALM_TOP = {scene_id: ((0.22, 0, 0.78, 0.30) if scene_id.endswith('-portrait')
                      else (0.20, 0, 0.80, 0.30)) for scene_id in SCENES}
FOCUS = {scene_id: ((0.2188, 0.5286, 0.5430, 0.2220) if scene_id.endswith('-portrait')
                   else (0.2539, 0.5215, 0.4922, 0.3105)) for scene_id in SCENES}


def draw_focus(debug, scene_id):
    if scene_id not in FOCUS:
        return
    x, y, w, h = FOCUS[scene_id]
    width, height = debug.size
    draw = ImageDraw.Draw(debug)
    draw.rectangle((x * width, y * height, (x + w) * width, (y + h) * height),
                   outline='#00ffff', width=3)
    draw.text((x * width + 6, y * height + 5), 'Focus',
              font=ImageFont.truetype('DejaVuSans.ttf', 20), fill='#00ffff',
              stroke_width=2, stroke_fill='#07080b')


def write_metadata(path, metadata):
    serialized = json.dumps(metadata, indent=2)
    if 'focus' in metadata:
        # Keep measured precision visible, including trailing zeroes.
        focus = '[' + ', '.join(f'{value:.4f}' for value in metadata['focus']) + ']'
        serialized = re.sub(r'("focus": )\[[^\]]*\]',
                            lambda match: match[1] + focus, serialized)
    path.write_text(serialized + '\n')


def update_focus(scene_id):
    """Add focus without re-encoding images or changing existing metadata."""
    path = ROOT / f'{scene_id}.json'
    metadata = json.loads(path.read_text())
    metadata['focus'] = list(FOCUS[scene_id])
    write_metadata(path, metadata)
    path = ROOT / 'debug' / f'{scene_id}.png'
    with Image.open(path) as source:
        debug = source.convert('RGB')
    draw_focus(debug, scene_id)
    debug.save(path)


def key_masks(rgb):
    # OpenCV hue is half the hue in degrees: green 120 -> 60, magenta 300 -> 150.
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    green = cv2.inRange(hsv, (43, 140, 100), (83, 255, 255))
    magenta = cv2.inRange(hsv, (133, 140, 100), (171, 255, 255))
    # Exclude dark painted spines from bright key faces.
    magenta[(rgb[:, :, 0] < 150) | (rgb[:, :, 2] < 150)] = 0
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
    if scene_id in ROUND_10:
        # Chroma processing: anchor slot faces to the source instead of allowing
        # the editor's one-pixel key-edge variations to change slot geometry.
        original_id = 'nook-r9-bay' + ('-portrait' if orientation == 'portrait' else '')
        with Image.open(ROOT / 'raw' / f'{original_id}.png') as source:
            original = np.array(source.convert('RGB'))
        source_key = key_masks(original)[1] > 0
        edited_key = key_masks(rgb)[1] > 0
        key_pixels = source_key | edited_key
        rgb[key_pixels] = original[key_pixels]
    green, magenta = key_masks(rgb)
    televisions, slots = regions(green), regions(magenta)
    slot_range = (10, 14) if scene_id in ROUND_F else ((6, 8) if scene_id == 'nook-tv-corner' else ((12, 12) if scene_id in CALM_TOP else (12, 18)))
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
    if scene_id in ROUND_D or scene_id in ROUND_F:
        for region in slots:
            rgb[region['mask'] > 0] = (255, 0, 255)
        if tv:
            rgb[tv['mask'] > 0] = (0, 255, 0)
        Image.fromarray(rgb).save(ROOT / 'raw' / f'{scene_id}.png')
    # Wall frames flank the central window in portrait, and sit to its right in landscape.
    frames = set()  # All round 11 covers are shelf cases, verified on overlays.
    if scene_id in CALM_TOP and frames:
        raise ValueError(f'{scene_id}: wall-frame slots must be absent')
    slots.sort(key=lambda r: (r['box'][0], r['box'][1]))
    all_regions = ([(tv, (7, 8, 11))] if tv else []) + [(r, (28, 31, 38)) for r in slots]
    output = rgb.copy()
    nearby = np.zeros((height, width), np.uint8)
    for region, color in all_regions:
        expanded = region['mask']  # Preserve the narrow painted plastic case rim.
        output[expanded > 0] = color
        nearby |= cv2.dilate(region['mask'], np.ones((3, 3), np.uint8))
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
    short_edges = []
    aspect_ratios = []
    for index, slot in enumerate(slots, 1):
        q = slot['quad']
        edge_width = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2
        edge_height = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
        short_edges.append(min(edge_width, edge_height))
        aspect_ratios.append(edge_width / edge_height)
        if edge_width / edge_height < 0.65 or edge_width / edge_height > 0.85:
            problems.append(f'Slot {index} projected aspect {edge_width / edge_height:.2f} (target about 0.75)')
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
    if scene_id in FOCUS:
        metadata['focus'] = list(FOCUS[scene_id])
    write_metadata(ROOT / f'{scene_id}.json', metadata)
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
    draw_focus(debug, scene_id)
    debug.save(ROOT / 'debug' / f'{scene_id}.png')
    tv_label = f'{tv_percent:.2f}%' if tv else 'none'
    print(f'{scene_id}: {len(slots)} slots, TV {tv_label}, '
          f'min slot side {min(short_edges):.1f}px; aspect {min(aspect_ratios):.2f}–{max(aspect_ratios):.2f}; {problems or "geometry OK"}')



def contact_sheet(scene_ids, batch):
    sheet = Image.new('RGB', (1800, 800 * ((len(scene_ids) + 1) // 2)), '#111827')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('DejaVuSans.ttf', 23)
    for index, scene_id in enumerate(scene_ids):
        x, y = (index % 2) * 900, (index // 2) * 800
        with Image.open(ROOT / f'{scene_id}.webp') as image:
            image.thumbnail((880, 740))
            sheet.paste(image, (x + (900 - image.width) // 2, y + 40 + (740 - image.height) // 2))
        draw.text((x + 16, y + 9), scene_id, font=font, fill='#f59e0b')
    sheet.save(ROOT / 'debug' / f'contact-{batch}.png')
    (ROOT / f'index-{batch}.json').write_text(json.dumps(list(scene_ids), indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', nargs=2, action='append', default=[], metavar=('ID', 'PNG'))
    parser.add_argument('--id', choices=SCENES)
    parser.add_argument('--focus-only', action='store_true',
                        help='Update stage focus metadata and overlays only')
    args = parser.parse_args()
    if args.focus_only:
        if args.source or (args.id and args.id not in FOCUS):
            parser.error('--focus-only requires a stage scene and no --source')
        for scene_id in ([args.id] if args.id else ROUND_11):
            update_focus(scene_id)
        return
    for directory in (ROOT, ROOT / 'raw', ROOT / 'debug'):
        directory.mkdir(parents=True, exist_ok=True)
    for scene_id, source in args.source:
        if scene_id not in SCENES:
            parser.error(f'Unknown scene {scene_id}')
        shutil.copy2(source, ROOT / 'raw' / f'{scene_id}.png')
    for scene_id in ([args.id] if args.id else ROUND_11):
        process(scene_id)
    if not args.id:
        contact_sheet(ROUND_11, 'r11-1')


if __name__ == '__main__':
    main()
