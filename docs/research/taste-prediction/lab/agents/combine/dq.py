import ev, numpy as np
from ev import *
FP = dict(v='Tm', lin='L2+Ren+Rtags', fr=True)
def q(P, y):
    yi = y.astype(int) - 1; n = len(y); ll = -np.log(np.maximum(P[np.arange(n), yi], 1e-6)).mean()
    C = np.cumsum(P, 1); T = (KS[None, :] >= y[:, None]).astype(float); rps = ((C - T) ** 2).sum(1).mean()
    pb = C[:, 4]; bad = y <= 5; br = ((pb - bad) ** 2).mean()
    return np.array([ll, rps, br, br / (bad.mean() * (1 - bad.mean()))])
def dq(name, **kw):
    o = np.mean([q(run(OWN, s, out='dist', **kw), D.of(OWN)[1]) for s in range(4)], 0)
    ot = np.mean([np.mean([q(run(u, s, out='dist', **kw), D.of(u)[1]) for s in range(2)], 0) for u in USERS], 0)
    print(f"{name:34s} owner logloss {o[0]:.3f} rps {o[1]:.3f} brier_bad {o[2]:.4f} ({o[3]:.3f} of base) | others logloss {ot[0]:.3f} rps {ot[1]:.3f} brier_bad/base {ot[3]:.3f}", flush=True)
y = D.of(OWN)[1]; base = np.bincount(y.astype(int), minlength=11)[1:] / len(y)
print('owner base-rate dist: ', q(np.tile(base, (len(y), 1)), y))
dq('A tlp dvA (badscores-like)', v='Ao', dv='A', parts='tlp')
for parts, dv in (('p', 'A'), ('tp', 'T'), ('lp', 'T'), ('tlp', 'T'), ('tl', 'T')):
    dq(f'FP {parts} dv={dv}', dv=dv, parts=parts, **FP)
dq('FP p strict', parts='p', strict=True, **FP)
print(line('FP shape p a=.5', preds(out='shape', parts='p', **FP)))
print(line('FP shape p strict tie a=.5', preds(out='shape', parts='p', strict=True, tie=True, **FP)))
print(line('FP shape p tie a=.5', preds(out='shape', parts='p', tie=True, **FP)))
print(line('FP shape tlp dv=T tie a=.5', preds(out='shape', parts='tlp', dv='T', tie=True, **FP)))
