"""Store frames: a caption headline over one unretouched native screenshot, on a YepWatch-palette background.

The screenshot is scaled as a whole (never cropped, edited or redrawn); only the frame around it is drawn here.
Usage: python3 scripts/compose-store-gallery.py store/gallery-rethink.json [--only android]
Spec: {"families": {"<family>": {"size": [w, h], "out": "store/assets/<dir>", "frames": [
  {"file": "gallery-01-x.png", "source": "<native png>", "caption": ["Line one", "line *two*"], "bg": "amber", "tilt": 0}]}}}
`*word*` marks the accent color. Writes a contact sheet per family next to the spec's "contactDir".
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

APP = Path(__file__).resolve().parents[1]
BOLD = str(APP / 'assets/Gabarito-Bold.ttf')
INK, AMBER, BLACK = (250, 250, 250), (251, 191, 36), (7, 7, 7)
# Backgrounds from the app palette (glow theme): amber, near-black, red (Nope), green (Yep), warm brown.
BACKGROUNDS = {
    'amber': {'top': (253, 207, 72), 'bottom': (245, 166, 20), 'text': (28, 18, 4), 'accent': (255, 255, 255), 'glow': (255, 236, 170)},
    'night': {'top': (24, 20, 14), 'bottom': (7, 7, 7), 'text': INK, 'accent': AMBER, 'glow': (120, 86, 10)},
    'red': {'top': (153, 27, 27), 'bottom': (69, 10, 10), 'text': INK, 'accent': (254, 202, 202), 'glow': (239, 68, 68)},
    'green': {'top': (21, 128, 61), 'bottom': (5, 46, 22), 'text': INK, 'accent': (187, 247, 208), 'glow': (34, 197, 94)},
    'warm': {'top': (68, 44, 12), 'bottom': (20, 12, 4), 'text': INK, 'accent': AMBER, 'glow': (180, 120, 20)},
}


def gradient(size, top, bottom):
    w, h = size
    column = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        column.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return column.resize((w, h))


def glow(canvas, center, radius, color, strength):
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    d.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color + (strength,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.45))
    canvas.alpha_composite(layer)


def parts(line):
    """'Grab a *couch*' -> [('Grab a ', False), ('couch', True)]"""
    out, accent = [], False
    for i, chunk in enumerate(line.split('*')):
        if chunk:
            out.append((chunk, accent))
        accent = not accent
    return out


def caption(canvas, lines, style, box_top, box_height):
    w = canvas.width
    d = ImageDraw.Draw(canvas)
    size = int(w * 0.105)
    while size > 20:
        font = ImageFont.truetype(BOLD, size)
        widths = [sum(d.textlength(t, font=font) for t, _ in parts(l)) for l in lines]
        line_h = size * 1.08
        if max(widths) <= w * 0.86 and line_h * len(lines) <= box_height * 0.9:
            break
        size -= 2
    y = box_top + (box_height - line_h * len(lines)) / 2
    for line, width in zip(lines, widths):
        x = (w - width) / 2
        for text, accent in parts(line):
            d.text((x, y), text, font=font, fill=style['accent'] if accent else style['text'])
            x += d.textlength(text, font=font)
        y += line_h


def frame(spec, size, source):
    w, h = size
    style = BACKGROUNDS[spec.get('bg', 'night')]
    canvas = gradient(size, style['top'], style['bottom']).convert('RGBA')
    glow(canvas, (int(w * 0.5), int(h * 0.62)), int(w * 0.55), style['glow'], 90)
    shot = Image.open(source).convert('RGB')
    caption_h = int(h * spec.get('captionShare', 0.19))
    margin = int(h * 0.025)
    avail_h = h - caption_h - margin * 2
    avail_w = int(w * (0.86 if w / h < 0.6 else 0.84))
    scale = min(avail_h / shot.height, avail_w / shot.width)
    sw, sh = round(shot.width * scale), round(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    radius = int(sw * (0.075 if w / h < 0.6 else 0.035))
    border = max(4, int(sw * 0.012))
    # Device-like bezel: a dark rim around the rounded screenshot.
    panel = Image.new('RGBA', (sw + border * 2, sh + border * 2), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle([0, 0, panel.width - 1, panel.height - 1], radius=radius + border, fill=(12, 12, 12, 255), outline=(60, 60, 60, 255), width=max(1, border // 3))
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=radius, fill=255)
    panel.paste(shot, (border, border), mask)
    tilt = spec.get('tilt', 0)
    if tilt:
        panel = panel.rotate(tilt, resample=Image.BICUBIC, expand=True)
    x = (w - panel.width) // 2
    y = caption_h + margin + (avail_h + border * 2 - panel.height) // 2
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), (x + int(w * 0.01), y + int(h * 0.012)), panel.split()[3])
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(int(w * 0.02))))
    canvas.alpha_composite(panel, (x, y))
    caption(canvas, spec['caption'], style, margin, caption_h)
    return canvas.convert('RGB')


def contact(paths, target, height=900):
    ims = [Image.open(p).convert('RGB') for p in paths]
    ims = [im.resize((round(im.width * height / im.height), height), Image.LANCZOS) for im in ims]
    gap = 24
    sheet = Image.new('RGB', (sum(i.width for i in ims) + gap * (len(ims) + 1), height + gap * 2), (40, 40, 40))
    x = gap
    for im in ims:
        sheet.paste(im, (x, gap))
        x += im.width + gap
    sheet.save(target, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('spec')
    parser.add_argument('--only', nargs='*')
    options = parser.parse_args()
    spec_path = Path(options.spec).resolve()
    spec = json.loads(spec_path.read_text())
    root = APP
    manifest = {}
    for family, conf in spec['families'].items():
        if options.only and family not in options.only:
            continue
        out = root / conf['out']
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob('gallery-*.png'):
            old.unlink()
        written = []
        for f in conf['frames']:
            source = root / f['source']
            image = frame(f, tuple(conf['size']), source)
            target = out / f['file']
            image.save(target, optimize=True)
            written.append(target)
            manifest.setdefault(family, []).append({'file': str(target.relative_to(root)), 'caption': ' / '.join(f['caption']).replace('*', ''),
                'source': f['source'], 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'size': conf['size']})
        contact_dir = root / spec['contactDir']
        contact_dir.mkdir(parents=True, exist_ok=True)
        contact(written, contact_dir / f'contact-{family}.png')
        print(family, len(written), 'frames')
    (root / spec['contactDir'] / 'frames.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
