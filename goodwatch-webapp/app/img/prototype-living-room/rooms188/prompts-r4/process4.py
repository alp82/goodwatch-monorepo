# usage: python3 process3.py <final.png> <name>  -> rooms188/r3-<name>.webp (2560 px, screen black) + r4.json tv rect
import sys, json, os
from PIL import Image, ImageFilter
import numpy as np
p, n = sys.argv[1], sys.argv[2]
D = '/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/living-room/goodwatch-webapp/app/img/prototype-living-room/rooms188'
im = Image.open(p).convert('RGB').resize((2560, 1441), Image.LANCZOS)
a = np.asarray(im).astype(int)
m = (a[:, :, 1] > 140) & (a[:, :, 1] - np.maximum(a[:, :, 0], a[:, :, 2]) > 55)
# Keep only the biggest green rectangle area (the screen): rows/cols with many green pixels.
rows = np.where(m.sum(1) > 200)[0]; cols = np.where(m.sum(0) > 100)[0]
y0, y1, x0, x1 = rows.min(), rows.max(), cols.min(), cols.max()
scr = np.zeros_like(m); scr[y0:y1 + 1, x0:x1 + 1] = True
mm = np.asarray(Image.fromarray(((m & scr) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
mm[y0:y1 + 1, x0:x1 + 1] = True
a[mm] = [8, 10, 11]
out = Image.fromarray(a.astype(np.uint8))
# no extra sharpening: the detail pass is sharp already
out.save(f'{D}/r4-{n}.webp', quality=80, method=6)
k = 1672 / 2560
tv = dict(x=round(x0 * k), y=round(y0 * k), w=round((x1 - x0 + 1) * k), h=round((y1 - y0 + 1) * k))
jp = f'{D}/r4.json'; j = json.load(open(jp)) if os.path.exists(jp) else {}
j[n] = tv; json.dump(j, open(jp, 'w'), indent=1)
print(n, tv, os.path.getsize(f'{D}/r4-{n}.webp') // 1024, 'KB')
