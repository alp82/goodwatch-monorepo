# Detail pass: 3x3 overlapping 16:9 tiles, each re-rendered by the image tool at 1672x941, stitched feathered.
#   python3 detail.py cut <img.png> <tag>     -> <tag>-t<i>-in.png
#   python3 detail.py stitch <tag> <out.png>  -> reads <tag>-t<i>-out.png (falls back to the input tile)
import sys, os
from PIL import Image
import numpy as np
TW, TH = 640, 360
XS, YS = [0, 516, 1032], [0, 290, 581]
K = 1672 / TW
cmd, a, b = sys.argv[1:4]
if cmd == 'cut':
    im = Image.open(a).convert('RGB').resize((1672, 941), Image.LANCZOS)
    i = 0
    for y in YS:
        for x in XS:
            im.crop((x, y, x + TW, y + TH)).resize((1672, 941), Image.LANCZOS).save(f'{b}-t{i}-in.png'); i += 1
else:
    tag, out = a, b
    W, H = round(1672 * K), round(941 * K)
    acc = np.zeros((H, W, 3)); ws = np.zeros((H, W, 1))
    tw, th = 1672, 941
    ovx = round((XS[0] + TW - XS[1]) * K); ovy = round((YS[0] + TH - YS[1]) * K)
    def ramp(n, lo, hi):
        w = np.ones(n)
        if lo: w[:lo] = np.linspace(0.001, 1, lo)
        if hi: w[n - hi:] = np.linspace(1, 0.001, hi)
        return w
    i = 0
    for yi, y in enumerate(YS):
        for xi, x in enumerate(XS):
            p = f'{tag}-t{i}-out.png' if os.path.exists(f'{tag}-t{i}-out.png') else f'{tag}-t{i}-in.png'
            t = np.asarray(Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)).astype(float)
            src = np.asarray(Image.open(f'{tag}-t{i}-in.png').convert('RGB')).astype(float)
            for c in range(3):  # keep the tile's colors on the original's
                t[:, :, c] = (t[:, :, c] - t[:, :, c].mean()) / (t[:, :, c].std() + 1e-6) * src[:, :, c].std() + src[:, :, c].mean()
            wx = ramp(tw, ovx if xi > 0 else 0, ovx if xi < 2 else 0)
            wy = ramp(th, ovy if yi > 0 else 0, ovy if yi < 2 else 0)
            w = (wy[:, None] * wx[None, :])[:, :, None]
            X, Y = round(x * K), round(y * K); h2, w2 = min(th, H - Y), min(tw, W - X)
            acc[Y:Y + h2, X:X + w2] += t[:h2, :w2] * w[:h2, :w2]; ws[Y:Y + h2, X:X + w2] += w[:h2, :w2]
            i += 1
    Image.fromarray((acc / np.maximum(ws, 1e-6)).clip(0, 255).astype(np.uint8)).save(out)
    print(out, W, H)
