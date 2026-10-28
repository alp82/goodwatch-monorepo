#!/usr/bin/env python3
"""Process round 12 organized shelves; rerun from retained raw PNGs.

Usage: scene-slots-r12.py [--source ID GENERATED_PNG] [--id ID] [--focus-only]
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
SCENES = {'nook-r9-classic': ('Classic rainy window seat',
                     'eye level, near frontal',
                     'gouache',
                     'landscape',
                     'Calm search and mood-chip wall target: x=0.20–0.80, y=0.00–0.32. Calm results-card '
                     'rug: x=0.25–0.75, y=0.82–0.96. Window seat, three distinct cushions, rust throw and '
                     'short lamp cabinet. No candles, lanterns, tea lights or TV. Selected attempt 3 of at '
                     'most 3. Visual QC: Clear wall ends near y=0.27 rather than target 0.32; attempt limit '
                     'reached. Two different plants. Seat spans about 44% width. Focus includes sleeping dog '
                     'and its complete seat (including cushions, base and throw), or complete small round '
                     'rug; excludes adjacent furnishings.'),
 'nook-r9-classic-portrait': ('Classic rainy window seat for a phone',
                              'eye level, near frontal',
                              'gouache',
                              'portrait',
                              'Calm search and mood-chip wall target: x=0.22–0.78, y=0.00–0.30. Calm '
                              'results-card rug: x=0.25–0.75, y=0.82–0.96. Compact window seat and short '
                              'lamp cabinet. No candles, lanterns, tea lights or TV. Selected attempt 3 of '
                              'at most 3. Visual QC: Clear wall reaches y=0.30. Two distinct plants. '
                              'Thirteen slots; all measured short edges exceed 40px. Focus includes '
                              'sleeping dog and its complete seat (including cushions, base and throw), or '
                              'complete small round rug; excludes adjacent furnishings.'),
 'nook-r9-reading': ('Rainy reading armchair',
                     'eye level, near frontal',
                     'gouache',
                     'landscape',
                     'Calm search and mood-chip wall target: x=0.20–0.80, y=0.00–0.32. Calm results-card '
                     'rug: x=0.25–0.75, y=0.82–0.96. Indigo armchair, brass floor lamp, side table, '
                     'footstool and dog on a round rug. No candles, lanterns, tea lights or TV. Selected '
                     'attempt 3 of at most 3. Visual QC: Clear wall ends near y=0.24; dog extends to y=0.78, '
                     'below target 0.72. Attempt limit reached. Two different plants. Similar patterned '
                     'ceramic cups remain on opposite shelves. Focus includes sleeping dog and its complete '
                     'seat (including cushions, base and throw), or complete small round rug; excludes '
                     'adjacent furnishings.'),
 'nook-r9-reading-portrait': ('Rainy reading armchair for a phone',
                              'eye level, near frontal',
                              'gouache',
                              'portrait',
                              'Calm search and mood-chip wall target: x=0.22–0.78, y=0.00–0.30. Calm '
                              'results-card rug: x=0.25–0.75, y=0.82–0.96. Indigo armchair, brass floor '
                              'lamp, side table, footstool and dog on a round rug. No candles, lanterns, tea '
                              'lights or TV. Selected attempt 3 of at most 3. Visual QC: Clear wall reaches '
                              'y=0.32; dog ends near y=0.69. Two distinct plants. No material layout issues. '
                              'Focus includes sleeping dog and its complete seat (including cushions, base '
                              'and throw), or complete small round rug; excludes adjacent furnishings.'),
 'nook-r9-bay': ('Small oak bay bench',
                 'eye level, near frontal',
                 'gouache',
                 'landscape',
                 'Calm search and mood-chip wall target: x=0.20–0.80, y=0.00–0.32. Calm results-card rug: '
                 'x=0.25–0.75, y=0.82–0.96. Shallow rainy bay bench, tied curtains, three cushions and one '
                 'cream throw. No candles, lanterns, tea lights or TV. Selected attempt 2 of at most 3. '
                 'Visual QC: Curtain tops begin near y=0.30, about 0.02 short of target. Two distinct sill '
                 'plants. Bench spans about 44% width. A blue bird ornament and wooden bird differ in '
                 'material but repeat the bird motif. Focus includes sleeping dog and its complete seat '
                 '(including cushions, base and throw), or complete small round rug; excludes adjacent '
                 'furnishings.'),
 'nook-r9-bay-portrait': ('Small oak bay bench for a phone',
                          'eye level, near frontal',
                          'gouache',
                          'portrait',
                          'Calm search and mood-chip wall target: x=0.22–0.78, y=0.00–0.30. Calm '
                          'results-card rug: x=0.25–0.75, y=0.82–0.96. Compact rainy bay bench, tied '
                          'curtains, three cushions and one cream throw. No candles, lanterns, tea lights or '
                          'TV. Selected attempt 3 of at most 3. Visual QC: Curtain tops begin near y=0.297. '
                          'Bench spans about 44% width. Two distinct plants on sill. Small dried sprig '
                          'remains on outer shelf. Focus includes sleeping dog and its complete seat '
                          '(including cushions, base and throw), or complete small round rug; excludes '
                          'adjacent furnishings.'),
 'nook-r9-sofa': ('Linen two-seat sofa',
                  'eye level, near frontal',
                  'gouache',
                  'landscape',
                  'Calm search and mood-chip wall target: x=0.20–0.80, y=0.00–0.32. Calm results-card rug: '
                  'x=0.25–0.75, y=0.82–0.96. Compact two-seat linen sofa, wall reading lamp, side table and '
                  'rust throw. No candles, lanterns, tea lights or TV. Selected attempt 2 of at most 3. '
                  'Visual QC: Clear wall reaches y=0.34. Sofa spans about 44% width. Two distinct plants. '
                  'Two differently shaped wooden bowls repeat the bowl motif. Focus includes sleeping dog '
                  'and its complete seat (including cushions, base and throw), or complete small round rug; '
                  'excludes adjacent furnishings.'),
 'nook-r9-sofa-portrait': ('Linen two-seat sofa for a phone',
                           'eye level, near frontal',
                           'gouache',
                           'portrait',
                           'Calm search and mood-chip wall target: x=0.22–0.78, y=0.00–0.30. Calm '
                           'results-card rug: x=0.25–0.75, y=0.82–0.96. Linen loveseat, wall reading lamp, '
                           'side table and rust throw. No candles, lanterns, tea lights or TV. Selected '
                           'attempt 3 of at most 3. Visual QC: Clear wall reaches y=0.38. Sofa remains about '
                           '50% width rather than 45%; attempt limit reached. Two distinct plants. Eleven '
                           'slots. Focus includes sleeping dog and its complete seat (including cushions, '
                           'base and throw), or complete small round rug; excludes adjacent furnishings.')}
ROUND_10 = tuple(f'nook-r9-bay-sofa-{variant}{suffix}'
                 for variant in 'abc' for suffix in ('', '-portrait'))
for variant, material in zip('abc', ('linen', 'velvet', 'leather')):
    for suffix in ('', '-portrait'):
        scene_id = f'nook-r9-bay-sofa-{variant}{suffix}'
        SCENES[scene_id] = (
            f'Bay sofa, {material}' + (' for a phone' if suffix else ''),
            'eye level, near frontal', 'gouache',
            'portrait' if suffix else 'landscape',
            f'Edited the original r9 bay raw image: replace only the bench with a {material} sofa. '
            'Sleeping dog, cushions and cream throw on sofa. No candles, TV or plaid. '
            'Focus surrounds the complete sofa, dog and throw. '
            'Visual QC: room layout and furnishings retained; selected edit attempt 1. '
            'Original slot masks retained and normalized to uniform #FF00FF; '
            'minor generative brush-texture variation remains outside the sofa.')
ROUND_D = ()
ROUND_F = tuple(SCENES)
CALM_TOP = {scene_id: ((0.22, 0, 0.78, 0.30) if scene_id.endswith("-portrait")
                          else (0.20, 0, 0.80, 0.32)) for scene_id in SCENES}
FOCUS = {'nook-r9-classic': (0.1888, 0.5078, 0.4401, 0.3115),
 'nook-r9-classic-portrait': (0.2441, 0.5046, 0.4521, 0.2441),
 'nook-r9-reading': (0.3451, 0.6201, 0.3776, 0.1943),
 'nook-r9-reading-portrait': (0.2637, 0.6081, 0.4785, 0.1146),
 'nook-r9-bay': (0.2826, 0.5234, 0.4368, 0.3057),
 'nook-r9-bay-portrait': (0.2617, 0.5182, 0.4434, 0.222),
 'nook-r9-sofa': (0.2461, 0.5205, 0.4531, 0.3105),
 'nook-r9-sofa-portrait': (0.2334, 0.5417, 0.5059, 0.2305)}
FOCUS.update({
    'nook-r9-bay-sofa-a': (0.2539, 0.5215, 0.4922, 0.3105),
    'nook-r9-bay-sofa-a-portrait': (0.2188, 0.5286, 0.5430, 0.2148),
    'nook-r9-bay-sofa-b': (0.2721, 0.5215, 0.4622, 0.3125),
    'nook-r9-bay-sofa-b-portrait': (0.2148, 0.5273, 0.5430, 0.2188),
    'nook-r9-bay-sofa-c': (0.2578, 0.5215, 0.4863, 0.3125),
    'nook-r9-bay-sofa-c-portrait': (0.2266, 0.5326, 0.5293, 0.2083),
})


# Preserve existing metadata for the four requested reprocesses.
REPROCESS = ('nook-r11-d', 'nook-r11-d-portrait',
             'nook-r9-bay-sofa-a', 'nook-r9-bay-sofa-a-portrait')
ROUND_12 = tuple(f'nook-r12-{v}{suffix}' for v in 'abcdef'
                 for suffix in ('', '-portrait'))
ARRANGEMENTS = {
    'a': 'Left film library; right books and sparse decoration; fairy lights.',
    'b': 'Right film library; left books and decoration; warm LED strips.',
    'c': 'Upper film shelves on both sides; lower books and decoration; fairy lights.',
    'd': 'Lower left film library; upper left and right books and decoration; lamp glow.',
    'e': 'Upper left and lower right film sections; other bays books and decoration; LEDs.',
    'f': 'Lower film shelves on both sides; upper books and decoration; fairy lights.',
}
SCENES = {}
for scene_id in REPROCESS:
    old = json.loads((ROOT / f'{scene_id}.json').read_text())
    SCENES[scene_id] = tuple(old[k].split(' R12 processing:')[0] if k == 'notes' else old[k] for k in ('title', 'perspective', 'style', 'orientation', 'notes'))
    FOCUS[scene_id] = tuple(old['focus'])
for scene_id in ROUND_12:
    portrait = scene_id.endswith('-portrait')
    variant = scene_id.split('-')[2]
    SCENES[scene_id] = (f'Organized bay shelves {variant.upper()}' + (' for a phone' if portrait else ''),
        'eye level, near frontal', 'gouache', 'portrait' if portrait else 'landscape',
        ARRANGEMENTS[variant] + ' Edited r11-d bookcases; grouped spine-out films, face-out cases, '
        'books, decoration and empty space. No TV, candles, plaid, people or readable titles. '
        'Focus surrounds sofa, sleeping dog and throw.')
    FOCUS[scene_id] = FOCUS['nook-r11-d-portrait' if portrait else 'nook-r11-d']
CALM_TOP = {sid: ((0.22, 0, 0.78, 0.29) if sid.endswith('-portrait') else
                  (0.20, 0, 0.80, 0.30)) for sid in SCENES}
ROUND_10 = ROUND_D = ROUND_F = ()


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
    slot_range = (8, 12) if scene_id in ROUND_12 else (12, 12)
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
    if scene_id in ROUND_12:
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
    all_regions = ([(tv, (7, 8, 11))] if tv else []) + [(r, None) for r in slots]
    output = rgb.copy()
    hsv_source = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    # Broad hue catches antialiasing even when R/B are no longer bright.
    pink = cv2.inRange(hsv_source, (140, 90, 0), (165, 255, 255))
    nearby = np.zeros((height, width), np.uint8)
    for region, color in all_regions:
        original = region['mask']
        near = cv2.dilate(original, np.ones((17, 17), np.uint8))
        # Limit broad hue selection to a known slot, never the painted room.
        candidate = original | (pink & near)
        # Grow from the face, excluding disconnected purple brushwork in the rim.
        _, labels = cv2.connectedComponents(candidate)
        touching = np.unique(labels[original > 0])
        wider = np.uint8(np.isin(labels, touching[touching != 0])) * 255
        # A cover is planar: a hull removes tiny brush-texture stair steps in the
        # cleanup silhouette without altering the separately retained quad.
        points = cv2.findNonZero(wider)
        cv2.fillConvexPoly(wider, cv2.convexHull(points), 255)
        expanded = cv2.dilate(wider, np.ones((11, 11), np.uint8))
        ring = cv2.dilate(expanded, np.ones((7, 7), np.uint8)) & ~expanded
        samples = rgb[(ring > 0) & (pink == 0)]
        if color is None:
            if not len(samples):
                raise ValueError(f'{scene_id}: no case-interior sample')
            # Dark local case rim/interior samples exclude warm shelf highlights.
            luminance = samples @ np.array([0.2126, 0.7152, 0.0722])
            dark = samples[luminance <= np.percentile(luminance, 25)]
            color = np.median(dark, axis=0).astype(np.uint8)
        output[expanded > 0] = color
        nearby |= near
    hsv = cv2.cvtColor(output, cv2.COLOR_RGB2HSV)
    fringe = (nearby > 0) & (hsv[:, :, 0] >= 125) & (hsv[:, :, 0] <= 177)
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
        aspect = edge_width / edge_height
        if not 0.62 <= aspect <= 0.82:
            problems.append(f'Slot {index} projected aspect {aspect:.2f} (target about 0.72)')
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
    notes += ' R12 processing: broad local magenta mask, 5px dilation, sampled dark case fill, 8px fringe desaturation; original undilated quads.'
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
          f'min slot side {min(min(r["box"][2:]) for r in slots)}px; {problems or "geometry OK"}')



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
        for scene_id in ([args.id] if args.id else REPROCESS + ROUND_12):
            update_focus(scene_id)
        return
    for directory in (ROOT, ROOT / 'raw', ROOT / 'debug'):
        directory.mkdir(parents=True, exist_ok=True)
    for scene_id, source in args.source:
        if scene_id not in SCENES:
            parser.error(f'Unknown scene {scene_id}')
        shutil.copy2(source, ROOT / 'raw' / f'{scene_id}.png')
    for scene_id in ([args.id] if args.id else REPROCESS + ROUND_12):
        process(scene_id)
    if not args.id:
        contact_sheet(ROUND_12, 'r12')


if __name__ == '__main__':
    main()
