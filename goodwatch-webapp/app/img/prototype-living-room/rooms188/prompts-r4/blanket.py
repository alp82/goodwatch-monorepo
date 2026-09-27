# Recolor the foreground blanket to a target Lab mean, keeping its texture and shading.
# usage: python3 blanket.py <in> <out> <maxChroma> <minL> [L a b target, default warm dark caramel 27 12 24]
import sys
from PIL import Image, ImageFilter
import numpy as np
from labx import rgb2lab, lab2rgb
im = Image.open(sys.argv[1]).convert('RGB'); a = np.asarray(im).astype(float); H, W = a.shape[:2]; k = W / 1672
mc, ml = float(sys.argv[3]), float(sys.argv[4])
T = np.array([float(x) for x in sys.argv[5:8]]) if len(sys.argv) > 7 else np.array([27.0, 12.0, 24.0])
L = rgb2lab(a); ch = np.hypot(L[..., 1], L[..., 2]); yy = np.arange(H)[:, None] * np.ones((1, W))
m = ((yy > float(__import__("os").environ.get("YMIN", 740)) * k) & (ch < mc) & (L[..., 0] > ml)).astype(np.uint8) * 255
m = np.asarray(Image.fromarray(m).filter(ImageFilter.MedianFilter(11)).filter(ImageFilter.GaussianBlur(2.5 * k))).astype(float) / 255
sel = m > 0.5; mu = L[sel].mean(0); sd = L[sel][:, 0].std()
out = L.copy()
out[..., 0] = (L[..., 0] - mu[0]) * float(__import__("os").environ.get("LC", 0.85)) + T[0]  # keep shading, a little less contrast
out[..., 1] = (L[..., 1] - mu[1]) * 0.6 + T[1]
out[..., 2] = (L[..., 2] - mu[2]) * 0.6 + T[2]
res = L * (1 - m[..., None]) + out * m[..., None]
Image.fromarray(lab2rgb(res).clip(0, 255).astype(np.uint8)).save(sys.argv[2])
print('blanket mean was', mu.round(1), 'now', T, 'pixels', int(sel.sum()))
