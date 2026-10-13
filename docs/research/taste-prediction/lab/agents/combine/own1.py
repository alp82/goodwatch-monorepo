import ev, numpy as np, sys
from ev import *
seeds = tuple(int(x) for x in sys.argv[1].split(','))
y = D.of(OWN)[1]
def P(**kw): return [run(OWN, s, **kw) for s in seeds]
def show(name, **kw):
    r = []
    for out in ('cont', 'round', 'shape'):
        p = P(out=out, **kw); r.append(np.mean([ev._m(q, y) for q in p], 0))
    print(f"{name:34s} " + ' | '.join(f"{a[0]:.3f} {a[1]:.3f} {a[2]:.3f} {a[3]:.3f}" for a in r), flush=True)
print('name: cont | round | shape(a=.5, dist feats A)  each: mae macro rho auc')
for v in ('A', 'Ao', 'Ac', 'Am', 'F', 'Fm', 'T', 'Tm', 'FT', 'FTo', 'FTc', 'FTm'): show('trees ' + v, v=v)
for v in ('A', 'Am', 'FTm', 'T'):
    for lin in ('half', 'L2', 'MK', 'stack', 'L2+Ren+Rtags'): show(f'{v} + {lin}', v=v, lin=lin)
    show(f'{v} + fr', v=v, fr=True); show(f'{v} + stack + fr', v=v, lin='stack', fr=True)
