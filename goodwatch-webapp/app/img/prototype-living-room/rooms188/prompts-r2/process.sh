#!/bin/bash
# usage: process.sh name...   (reads <name>.png, writes rooms188/r2-<name>.webp and updates r2.json)
cd "$(dirname "$0")"
D=/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/living-room/goodwatch-webapp/app/img/prototype-living-room/rooms188
for n in "$@"; do
python3 - "$n" "$D" <<'PY'
import sys, json, os
from PIL import Image, ImageFilter
import numpy as np
n, D = sys.argv[1], sys.argv[2]
im = Image.open(f'{n}.png').convert('RGB')
if im.size != (1672, 941): im = im.resize((1672, 941), Image.LANCZOS)
a = np.asarray(im).astype(int)
m = (a[:,:,1] > 150) & (a[:,:,1] - np.maximum(a[:,:,0], a[:,:,2]) > 60)
ys, xs = np.where(m)
tv = dict(x=int(xs.min()), y=int(ys.min()), w=int(xs.max()-xs.min()+1), h=int(ys.max()-ys.min()+1))
mm = np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
a[mm] = [8, 10, 11]
Image.fromarray(a.astype(np.uint8)).save(f'{n}-black.png')
p = f'{D}/r2.json'
j = json.load(open(p)) if os.path.exists(p) else {}
j[n] = tv
json.dump(j, open(p, 'w'), indent=1)
print(n, tv)
PY
../esr/realesrgan-ncnn-vulkan -i $n-black.png -o $n-hf4.png -n high-fidelity-4x -s 4 >/dev/null 2>&1
magick $n-hf4.png -filter Lanczos -resize 2560x -quality 78 -define webp:method=6 $D/r2-$n.webp
done
