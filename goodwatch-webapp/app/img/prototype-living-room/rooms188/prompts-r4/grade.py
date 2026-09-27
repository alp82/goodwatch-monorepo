# Pull a room's color grade toward the reference (Reinhard transfer in Lab, TV excluded), blended by strength.
# usage: python3 grade.py <in> <out> [strength 0..1] [ref.png]
import sys
from PIL import Image
from labx import rgb2lab, lab2rgb
import numpy as np
src = Image.open(sys.argv[1]).convert('RGB'); s = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
ref = Image.open(sys.argv[4] if len(sys.argv) > 4 else 'ref.png').convert('RGB').resize(src.size, Image.LANCZOS)
def lab(im): return rgb2lab(np.asarray(im).astype(float))
def keep(im):
    r = np.asarray(im).astype(int)
    return ~((r[:, :, 1] > 150) & (r[:, :, 1] - np.maximum(r[:, :, 0], r[:, :, 2]) > 60))
A, R = lab(src), lab(ref); ka, kr = keep(src), keep(ref)
out = A.copy()
for c in range(3):
    ms, ss = A[:, :, c][ka].mean(), A[:, :, c][ka].std(); mr, sr = R[:, :, c][kr].mean(), R[:, :, c][kr].std()
    out[:, :, c] = (A[:, :, c] - ms) / (ss + 1e-6) * sr + mr
out = A * (1 - s) + out * s
out[~ka] = A[~ka]
im = Image.fromarray(lab2rgb(out).clip(0, 255).astype(np.uint8))
im.save(sys.argv[2]); print(sys.argv[2])
