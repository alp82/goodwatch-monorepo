# usage: python3 crops.py name.png  -> name-crops/{full.png, r<row>c<col>.png} (4x3 grid, 20% overlap, 2x zoom)
import sys, os
from PIL import Image
p = sys.argv[1]; n = os.path.splitext(p)[0]
im = Image.open(p).convert('RGB').resize((1672, 941), Image.LANCZOS)
out = f'{n}-crops'; os.makedirs(out, exist_ok=True)
im.resize((1254, 706), Image.LANCZOS).save(f'{out}/full.png')
cw, ch = 500, 380
for r in range(3):
    for c in range(4):
        x = round(c * (1672 - cw) / 3); y = round(r * (941 - ch) / 2)
        im.crop((x, y, x + cw, y + ch)).resize((cw * 2, ch * 2), Image.LANCZOS).save(f'{out}/r{r}c{c}_x{x}_y{y}.png')
print(out)
