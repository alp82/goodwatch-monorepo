# Local repair. usage:
#   python3 fix.py cut  <img.png> <x> <y> <w> <h> <tag>      -> writes <tag>-in.png (16:9 context crop) + <tag>.json
#   python3 fix.py paste <img.png> <tag> <out.png>           -> pastes <tag>-out.png back, color-matched, feathered
import sys, json
from PIL import Image, ImageFilter
import numpy as np
W, H = 1672, 941
cmd = sys.argv[1]
if cmd == 'cut':
    p, x, y, w, h, tag = sys.argv[2], *map(int, sys.argv[3:7]), sys.argv[7]
    f = float(sys.argv[8]) if len(sys.argv) > 8 else 3.0
    im = Image.open(p).convert('RGB')
    k = im.width / 1672; W, H = im.size
    x, y, w, h = x * k, y * k, w * k, h * k
    cw = max(f * w, f * h * 16 / 9, 420 * k); cw = min(cw, W); ch = cw * 9 / 16
    if ch > H: ch = H; cw = ch * 16 / 9
    cx, cy = x + w / 2, y + h / 2
    x0 = int(min(max(cx - cw / 2, 0), W - cw)); y0 = int(min(max(cy - ch / 2, 0), H - ch))
    box = [x0, y0, int(x0 + cw), int(y0 + ch)]
    im.crop(box).resize((1672, 941), Image.LANCZOS).save(f'{tag}-in.png')
    json.dump({'box': box, 'defect': [int(x), int(y), int(w), int(h)]}, open(f'{tag}.json', 'w'))
    print(tag, box)
else:
    p, tag, out = sys.argv[2], sys.argv[3], sys.argv[4]
    j = json.load(open(f'{tag}.json')); x0, y0, x1, y1 = j['box']; dx, dy, dw, dh = j['defect']
    im = Image.open(p).convert('RGB'); base = np.asarray(im).astype(float)
    patch = np.asarray(Image.open(f'{tag}-out.png').convert('RGB').resize((x1 - x0, y1 - y0), Image.LANCZOS)).astype(float)
    orig = base[y0:y1, x0:x1]
    # Mask: the defect box grown by 35%, feathered.
    m = np.zeros(orig.shape[:2])
    gx, gy = dw * 0.35, dh * 0.35
    mx0, my0 = int(max(dx - gx - x0, 0)), int(max(dy - gy - y0, 0)); mx1, my1 = int(min(dx + dw + gx - x0, x1 - x0)), int(min(dy + dh + gy - y0, y1 - y0))
    m[my0:my1, mx0:mx1] = 1
    feather = max(6, int(min(dw, dh) * 0.15))
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))).astype(float)[:, :, None] / 255
    # Color-match the patch to the original over the area outside the mask (per-channel mean/std).
    ring = m[:, :, 0] < 0.05
    if ring.sum() > 500:
        for c in range(3):
            po, pp = orig[:, :, c][ring], patch[:, :, c][ring]
            patch[:, :, c] = (patch[:, :, c] - pp.mean()) / (pp.std() + 1e-6) * po.std() + po.mean()
    base[y0:y1, x0:x1] = orig * (1 - m) + patch.clip(0, 255) * m
    Image.fromarray(base.astype(np.uint8)).save(out)
    print(out)
