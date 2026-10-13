import ev, numpy as np, sys
from ev import *
seeds = (0,1,2,3); y = D.of(OWN)[1]
def show(name, **kw):
    a = np.mean([ev._m(run(OWN, s, **kw), y) for s in seeds], 0)
    print(f"{name:44s} {a[0]:.3f} {a[1]:.3f} {a[2]:.3f} {a[3]:.3f} {a[4]:.2f}", flush=True)
for v, kw in (('A', {}), ('Tm+fr', dict(v='Tm', fr=True)), ('FTm+fr', dict(v='FTm', fr=True))):
    show(v + ' cont', out='cont', **kw); show(v + ' round', out='round', **kw)
    for dv in ('A', 'F', 'T', 'FT'):
        for parts in ('tlp', 'tp', 'lp', 'p', 'tl'):
            show(f'{v} shape dv={dv} parts={parts} a=.5', out='shape', dv=dv, parts=parts, **kw)
    for a in (0, .25, .5, .75, 1):
        show(f'{v} shape dv=T a={a}', out='shape', dv='T', alpha=a, **kw)
