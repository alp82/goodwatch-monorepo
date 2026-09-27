# Numeric finishing. usage: python3 finish.py <in> <out> [--wall] [--case] [--spines]
import sys
from PIL import Image, ImageFilter
import numpy as np
from labx import rgb2lab, lab2rgb
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size; k = W / 1672
a = np.asarray(im).astype(float); L = rgb2lab(a)
def box(x0, y0, x1, y1, feather=6):
    m = np.zeros((H, W), np.uint8); m[int(y0 * k):int(y1 * k), int(x0 * k):int(x1 * k)] = 255
    return np.asarray(Image.fromarray(m).filter(ImageFilter.GaussianBlur(feather * k))).astype(float) / 255
if '--spines' in sys.argv:  # mute candy-bright spines on the left shelves
    m = box(215, 35, 405, 270); ch = np.hypot(L[..., 1], L[..., 2]); f = np.where(ch > 25, 0.55, 0.85)
    L[..., 1] *= 1 - m * (1 - f); L[..., 2] *= 1 - m * (1 - f)
if '--case' in sys.argv:  # tone down the neon blue case on the table
    m = box(680, 730, 925, 855, 3); blue = (L[..., 2] < -25).astype(float) * m
    L[..., 1] *= 1 - 0.5 * blue; L[..., 2] *= 1 - 0.55 * blue; L[..., 0] -= 6 * blue
out = lab2rgb(L)
if '--wall' in sys.argv:  # smooth the crackle on the teal wall only (low chroma-blue, dark, flat areas)
    wall = ((L[..., 2] < -4) & (L[..., 0] > 8) & (L[..., 0] < 32)).astype(np.uint8) * 255
    wall = np.asarray(Image.fromarray(wall).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(4 * k))).astype(float)[..., None] / 255
    sm = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2 * k))).astype(float)
    out = out * (1 - 0.7 * wall) + sm * 0.7 * wall
# gentle global softening against the detail pass's crunch
soft = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9 * k))).astype(float)
out = out * 0.7 + soft * 0.3
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(sys.argv[2]); print(sys.argv[2])
