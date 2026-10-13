import ev, numpy as np, sys
from ev import *
FP = dict(v='Tm', lin='L2+Ren+Rtags', fr=True)
print(f"{'name':46s} mae   macro rho   bad  auc   | skill rho_others")
for parts, dv in (('p', 'A'), ('tlp', 'T')):
    for a in (0, .25, .4, .5, .6, .75, 1):
        print(line(f'FP shape {parts} dv={dv} a={a}', preds(out='shape', dv=dv, parts=parts, alpha=a, **FP)), flush=True)
