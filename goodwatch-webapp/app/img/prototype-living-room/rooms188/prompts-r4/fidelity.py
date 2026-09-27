# Color fidelity vs the reference room. usage: python3 fidelity.py <img> [ref.png]
# Prints the Lab mean difference (Delta E, CIE76) per region; the TV screen is excluded.
import sys
from PIL import Image
from labx import rgb2lab
import numpy as np
REGIONS = {  # in 1672x941 reference coordinates
    'wall': [(400, 0, 520, 480), (1150, 0, 1300, 480)],
    'window/sky': [(0, 0, 60, 420)],
    'lantern': [(10, 220, 140, 500)],
    'left sofa': [(0, 600, 380, 820)],
    'bottom blanket': [(0, 840, 1672, 941)],
    'floor/table': [(420, 640, 1400, 830)],
    'right side': [(1300, 0, 1672, 700)],
}
def L(p):
    im = Image.open(p).convert('RGB').resize((1672, 941), Image.LANCZOS)
    rgb = np.asarray(im).astype(int); a = rgb2lab(rgb.astype(float))
    tv = (rgb[:, :, 1] > 150) & (rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2]) > 60)
    tv |= (rgb.sum(2) < 40)  # painted screen
    return a, tv
def stats(a, tv, boxes):
    m = np.zeros(tv.shape, bool)
    for x0, y0, x1, y1 in boxes: m[y0:y1, x0:x1] = True
    m &= ~tv
    return a[m].mean(0)
a, ta = L(sys.argv[1]); r, tr = L(sys.argv[2] if len(sys.argv) > 2 else 'ref.png')
tot = []
for k, b in REGIONS.items():
    ma, mr = stats(a, ta, b), stats(r, tr, b); d = np.linalg.norm(ma - mr); tot.append(d)
    print(f'{k:15s} dE={d:5.1f}  L {ma[0]:5.1f} vs {mr[0]:5.1f}  a {ma[1]:5.1f} vs {mr[1]:5.1f}  b {ma[2]:5.1f} vs {mr[2]:5.1f}')
print(f'MEAN dE={np.mean(tot):.1f}  (under 6 = same grade; over 10 = visibly different)')
