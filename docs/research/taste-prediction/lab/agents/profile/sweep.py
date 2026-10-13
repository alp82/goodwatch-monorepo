import sys, json, warnings, numpy as np
warnings.filterwarnings('ignore')
import validate as V, lib
from harness import Data
D = Data(); R = 30
CF = json.load(open(sys.argv[1])); part = int(sys.argv[2])
for i, (nm, cfg) in enumerate(CF.items()):
    if i % 3 != part: continue
    if 'maxn' in cfg: cfg['maxn'] = {**lib.CFG['maxn'], **cfg['maxn']}
    rows, prof = V.run(D, cfg, R); s = V.skill(prof); out = [f'## {nm}: owner mae {s[0]:.3f} skill {s[1]:.3f} others skill {s[2]:.3f}']
    for t in V.TYPES:
        for who in (True, False):
            a = np.array([r[6:] for r in rows if r[4] == t and r[1] == who], float); pp = [e for e in prof if e['owner'] == who]
            per = np.mean([e['count'].get(t, 0) for e in pp])
            if len(a) >= 3: out.append(f"   {t[:9]:9s} {'own' if who else 'oth'} per {per:.2f} sign {np.mean(np.sign(a[:,0])==np.sign(a[:,2])):.0%} ratio {(a[:,0]*a[:,2]).sum()/(a[:,0]**2).sum():.2f} n={len(a)}")
    print('\n'.join(out), flush=True)
