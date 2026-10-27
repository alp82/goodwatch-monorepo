#!/usr/bin/env python3
"""Extract compositing geometry and export batch A. Run ID SOURCE, or --contact."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2] / 'public/prototype-start-lab/scenes'
SCENES = {
    'sofa-shelves': ('Sofa view of a shelf wall', 'seated, eye level', 'landscape'),
    'sofa-shelves-portrait': ('Sofa shelf wall for a phone', 'seated, eye level', 'portrait'),
    'media-wall-angle': ('Along the wooden media wall', 'three-quarter, eye level', 'landscape'),
    'shelf-closeup': ('A listening corner at night', 'close-up, eye level', 'landscape'),
    'shelf-closeup-portrait': ('A listening corner for a phone', 'close-up, eye level', 'portrait'),
    'coffee-table': ('Movie night on the coffee table', 'top-down flat lay', 'landscape'),
    'coffee-table-portrait': ('Movie night table for a phone', 'top-down flat lay', 'portrait'),
    'projector-loft': ('Projector night in the loft', 'wide, eye level', 'landscape'),
    'retro-den': ('Warm seventies movie den', 'wide, eye level', 'landscape'),
}


def ordered(points):
    points = np.asarray(points, dtype=np.float32).reshape(4, 2)
    # Angle sorting handles rotated table cases without duplicate corner assignment.
    center = points.mean(axis=0)
    points = points[np.argsort(np.arctan2(points[:, 1]-center[1], points[:, 0]-center[0]))]
    start = np.argmin(points.sum(axis=1))
    return np.roll(points, -start, axis=0)


def regions(mask):
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    result = []
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] < mask.size * .0005:
            continue
        component = np.uint8(labels == i) * 255
        contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour = max(contours, key=cv2.contourArea)
        cv2.drawContours(component, [contour], -1, 255, -1)
        hull = cv2.convexHull(contour)
        quad = None
        for fraction in np.linspace(.005, .08, 100):
            approx = cv2.approxPolyDP(hull, fraction * cv2.arcLength(hull, True), True)
            if len(approx) == 4:
                quad = approx.reshape(4, 2)
                break
        fallback = quad is None
        if fallback:
            quad = cv2.boxPoints(cv2.minAreaRect(hull))
        quad = ordered(quad)
        result.append({'mask': component, 'quad': quad, 'box': cv2.boundingRect(contour),
                       'area': int(np.count_nonzero(component)), 'fallback': fallback})
    return result


def process(scene_id, source, extra_note=''):
    title, perspective, orientation = SCENES[scene_id]
    raw = ROOT / 'raw' / f'{scene_id}.png'
    if source.resolve() != raw.resolve():
        shutil.copy2(source, raw)
    original = Image.open(raw).convert('RGB')
    expected = (1536, 1024) if orientation == 'landscape' else (1024, 1536)
    if original.size != expected:
        raise ValueError(f'Expected {expected}, received {original.size}')
    rgb = np.array(original)
    h, w = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    green = cv2.inRange(hsv, (40, 110, 100), (85, 255, 255))
    magenta = cv2.inRange(hsv, (135, 110, 100), (170, 255, 255))
    tvs, slots = regions(green), regions(magenta)
    slots.sort(key=lambda r: (r['box'][0], r['box'][1]))
    issues = []
    if len(tvs) != 1:
        issues.append(f'Detected {len(tvs)} screens; expected one')
    if not 6 <= len(slots) <= 14:
        issues.append(f'Detected {len(slots)} slots; expected 6–14')
    for i, region in enumerate(slots):
        q = region['quad']
        width = (np.linalg.norm(q[1]-q[0])+np.linalg.norm(q[2]-q[3]))/2
        height = (np.linalg.norm(q[3]-q[0])+np.linalg.norm(q[2]-q[1]))/2
        if width >= height or min(width, height) < 40:
            issues.append(f'Slot {i+1} has size {width:.0f}x{height:.0f}px')
    near = np.zeros((h, w), np.uint8)
    filled = np.zeros((h, w), np.uint8)
    for region, color in [(r, (7, 8, 11)) for r in tvs] + [(r, (28, 31, 38)) for r in slots]:
        expanded = cv2.dilate(region['mask'], np.ones((7, 7), np.uint8))
        rgb[expanded > 0] = color
        filled |= expanded
        near |= cv2.dilate(region['mask'], np.ones((25, 25), np.uint8))
    # Neutralize colored antialiasing and spill outside the solid fills.
    key_hue = ((hsv[:, :, 0] >= 40) & (hsv[:, :, 0] <= 85)) | ((hsv[:, :, 0] >= 135) & (hsv[:, :, 0] <= 170))
    fringe = (near > 0) & (filled == 0) & key_hue & (hsv[:, :, 1] > 40)
    # Use luminance, not HSV value, so removing spill does not brighten a halo.
    neutral = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    rgb[fringe] = neutral[fringe, None]
    processed = Image.fromarray(rgb)
    processed.save(ROOT / f'{scene_id}.webp', quality=84)
    intermediate = ROOT / 'debug' / f'{scene_id}-encode.png'
    processed.save(intermediate)
    subprocess.run(['avifenc', '-q', '60', str(intermediate), str(ROOT / f'{scene_id}.avif')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    intermediate.unlink()

    def geometry(region):
        return {'quad': [[round(float(x)/w, 4), round(float(y)/h, 4)] for x, y in region['quad']],
                'box': [round(float(v)/d, 4) for v, d in zip(region['box'], (w, h, w, h))]}

    def kind(region):
        if scene_id.startswith('coffee-table'):
            return 'case-table'
        if scene_id == 'projector-loft':
            return 'frame'
        if scene_id == 'media-wall-angle':
            return 'case-shelf'
        if scene_id == 'shelf-closeup-portrait':
            return 'frame' if region['box'][0] < w * .45 else 'case-shelf'
        if scene_id == 'shelf-closeup':
            return 'frame' if region['box'][1] < h * .40 else 'case-shelf'
        return 'frame' if region['box'][3] / h > .14 else 'case-shelf'

    notes = ['Top third is reserved for overlay text.' if orientation == 'landscape' else 'Phone composition; place UI around the supplied geometry.']
    if scene_id.startswith('coffee-table'):
        notes.append('The tablet screen is the TV target; cases lie face-up on the table.')
    notes.extend(issues)
    if extra_note:
        notes.append(extra_note)
    metadata = {'id': scene_id, 'title': title, 'perspective': perspective, 'style': 'photo',
                'orientation': orientation, 'width': w, 'height': h,
                'tv': geometry(max(tvs, key=lambda r: r['area'])) if tvs else None,
                'slots': [{'kind': kind(r), **geometry(r)} for r in slots], 'notes': ' '.join(notes)}
    (ROOT / f'{scene_id}.json').write_text(json.dumps(metadata, indent=2)+'\n')
    overlay = processed.copy()
    draw = ImageDraw.Draw(overlay)
    for label, region, color in [('TV', r, '#00FF00') for r in tvs] + [(str(i+1), r, '#FF00FF') for i, r in enumerate(slots)]:
        points = [tuple(map(float, p)) for p in region['quad']]
        draw.line(points + points[:1], fill=color, width=3)
        x, y = points[0]
        draw.rectangle((x, y-23, x+38, y), fill='#07080b')
        draw.text((x+3, y-21), label, fill=color, font_size=18)
    overlay.save(ROOT / 'debug' / f'{scene_id}.png')
    area = sum(r['area'] for r in tvs) / (w*h)*100
    print(json.dumps({'id': scene_id, 'slots': len(slots), 'tv_count': len(tvs), 'tv_area_percent': round(area, 2), 'issues': issues}))


def contact():
    ids = [scene_id for scene_id in SCENES if (ROOT / f'{scene_id}.json').exists()]
    (ROOT / 'index-a.json').write_text(json.dumps(ids, indent=2)+'\n')
    sheet = Image.new('RGB', (1200, ((len(ids)+2)//3)*440), '#111827')
    draw = ImageDraw.Draw(sheet)
    for i, scene_id in enumerate(ids):
        picture = Image.open(ROOT / f'{scene_id}.webp')
        picture.thumbnail((390, 400))
        x, y = (i%3)*400, (i//3)*440
        sheet.paste(picture, (x+(400-picture.width)//2, y))
        draw.text((x+10, y+410), scene_id, fill='#f59e0b', font_size=18)
    sheet.save(ROOT / 'debug/contact-a.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('id', nargs='?', choices=SCENES)
    parser.add_argument('source', nargs='?', type=Path)
    parser.add_argument('--note', default='')
    parser.add_argument('--contact', action='store_true')
    args = parser.parse_args()
    if args.contact:
        contact()
    elif args.id and args.source:
        process(args.id, args.source, args.note)
    else:
        parser.error('Supply ID SOURCE or --contact')
