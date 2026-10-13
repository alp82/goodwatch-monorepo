import ev, numpy as np, sys
from ev import *
print(f"{'name':46s} mae   macro rho   bad  auc   | skill rho_others")
base = preds(out='cont', v='A'); print(line('A cont (baseline)', base), flush=True)
def go(name, ref=None, **kw):
    P = preds(**kw); print(line(name, P), flush=True)
    if ref is not None: print('   ' + cline('vs ref', compare(ref, P, B=200)), flush=True)
    return P
for out in ('cont', 'round'):
    ref = preds(out=out, v='A')
    for v in ('A', 'Ao', 'Ac', 'Am', 'F', 'Fm', 'T', 'Tm', 'FT', 'FTm'): go(f'{out} {v}', None if v == 'A' else ref, out=out, v=v)
    for v in ('A', 'Am', 'Tm'):
        r2 = preds(out=out, v=v)
        for lin in ('half', 'L2', 'MK', 'stack', 'L2+Ren+Rtags', 'MK+Ren+Rtags'): go(f'{out} {v}+{lin}', r2, out=out, v=v, lin=lin)
        go(f'{out} {v}+fr', r2, out=out, v=v, fr=True)
