# Lock a candidate's low-frequency color and light to the reference (same composition), keeping all detail.
# usage: python3 gradelock.py <in> <out> [strength 0.8] [blur px at 1672 wide, 70]
# The blanket band (y > 760) and the TV screen are left alone.
import sys
from PIL import Image, ImageFilter
import numpy as np
from labx import rgb2lab, lab2rgb
src = Image.open(sys.argv[1]).convert('RGB'); s = float(sys.argv[3]) if len(sys.argv) > 3 else 0.8
sig = float(sys.argv[4]) if len(sys.argv) > 4 else 70
W, H = src.size; k = W / 1672
ref = Image.open('ref.png').convert('RGB').resize((W, H), Image.LANCZOS)
A = rgb2lab(np.asarray(src).astype(float)); R = rgb2lab(np.asarray(ref).astype(float))
def green(im):
    r = np.asarray(im).astype(int); return (r[:, :, 1] > 150) & (r[:, :, 1] - np.maximum(r[:, :, 0], r[:, :, 2]) > 60)
excl = green(src) | green(ref)
yy = np.arange(H)[:, None] * np.ones((1, W)); excl |= yy > 760 * k
w = (~excl).astype(float)
def blur(x):  # normalized blur that ignores excluded pixels
    n = max(4, int(1672 / sig))
    small = (n, max(3, int(n * H / W)))
    def b(ch): return np.asarray(Image.fromarray(ch.astype(np.float32), 'F').resize(small, Image.BOX).resize((W, H), Image.BICUBIC))
    return b(x * w) / np.maximum(b(w), 1e-3)
D = np.stack([blur(R[..., c]) - blur(A[..., c]) for c in range(3)], -1)
fade = np.clip((760 * k - yy) / (40 * k), 0, 1)[..., None]  # ease out above the blanket band
out = A + D * s * fade
out[green(src)] = A[green(src)]
Image.fromarray(lab2rgb(out).clip(0, 255).astype(np.uint8)).save(sys.argv[2]); print(sys.argv[2])
