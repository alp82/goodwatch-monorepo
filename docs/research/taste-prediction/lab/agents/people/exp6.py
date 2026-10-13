import lab, pf, pf2, stage, exp2, exp4, numpy as np
from harness import cv, metrics
D = lab.data()
def per_user(pred):
    out = []
    for u in D.users():
        p, y = cv(D, pred, u, 5); out.append(metrics(p, y)['mae'] / np.abs(y - y.mean()).mean())
    return np.array(out)
b = per_user(exp2.mk(()))
for nm, f in [('seq kw+yrs', exp4.mk([0, 2], alpha=30.0)), ('series TE', exp4.mk([], groups=('series',))), ('series TE + seq', exp4.mk([0, 2], groups=('series',), alpha=30.0)), ('family TE', exp4.mk([], groups=('family',))),
              ('series+family', exp4.mk([], groups=('series','family'))), ('cast TE', exp4.mk([], groups=('cast',), k=3.0)), ('series + cast', exp4.mk([], groups=('series', 'cast'), k=3.0)), ('writer', exp4.mk([], groups=('writer',), k=3.0)), ('lead', exp4.mk([], groups=('lead',), k=3.0)),
              ('series k1 galpha.3', exp4.mk([], groups=('series',), k=1.0, galpha=0.3)), ('series k1 galpha 3', exp4.mk([], groups=('series',), k=1.0, galpha=3.0)), ('series k.5', exp4.mk([], groups=('series',), k=0.5))]:
    a = per_user(f); d = b - a
    print(f'{nm:24s} skill gain mean {d.mean():+.4f} median {np.median(d):+.4f} users better {(d > 0).sum()}/{len(d)} worse {(d < 0).sum()}  t={d.mean() / (d.std(ddof=1) / np.sqrt(len(d))):.2f}')
