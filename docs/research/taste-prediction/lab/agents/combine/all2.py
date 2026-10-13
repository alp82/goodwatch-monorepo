import ev, numpy as np, sys
from ev import *
FP = dict(v='Tm', lin='L2+Ren+Rtags', fr=True)
print(f"{'name':46s} mae   macro rho   bad  auc   | skill rho_others")
print(line('A cont (baseline)', preds(out='cont', v='A'))); print(line('A round', preds(out='round', v='A')))
print(line('badscores-like: Ao shape tlp dv=A a=.5', preds(out='shape', v='Ao', dv='A', parts='tlp')), flush=True)
print(line('FP cont', preds(out='cont', **FP))); print(line('FP round', preds(out='round', **FP)), flush=True)
for kw, nm in ((dict(v='A'), 'A'), (FP, 'FP')):
    for dv in ('A', 'T'):
        for parts in ('p', 'tp', 'lp', 'tlp'):
            if parts == 'p' and dv == 'T': continue
            print(line(f'{nm} shape {parts} dv={dv} a=.5', preds(out='shape', dv=dv, parts=parts, **kw)), flush=True)
