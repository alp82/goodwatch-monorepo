import ev, numpy as np
from ev import *
FP = dict(v='Tm', lin='L2+Ren+Rtags', fr=True); W = dict(out='dist', parts='p', strict=True)
def q(P, y):
    n = len(y); ll = -np.log(np.maximum(P[np.arange(n), y.astype(int) - 1], 1e-6)).mean(); C = np.cumsum(P, 1)
    return np.array([ll, ((C - (KS[None, :] >= y[:, None])) ** 2).sum(1).mean(), ((C[:, 4] - (y <= 5)) ** 2).mean()])
def prior(y): b = np.bincount(y.astype(int), minlength=11)[1:] + 0.5; return np.tile(b / b.sum(), (len(y), 1))
y = D.of(OWN)[1]
print('logloss, ranked probability score, brier of P(rating<=5)')
print('owner  member histogram      ', q(prior(y), y).round(4))
print('others member histogram      ', np.mean([q(prior(D.of(u)[1]), D.of(u)[1]) for u in USERS], 0).round(4))
for eps in (0, .03, .1):
    for nm, kw in (('baseline feats', dict(v='A')), ('final', FP)):
        o = np.mean([q(run(OWN, s, eps=eps, **W, **kw), y) for s in range(4)], 0)
        ot = np.mean([np.mean([q(run(u, s, eps=eps, **W, **kw), D.of(u)[1]) for s in range(2)], 0) for u in USERS], 0)
        print(f'eps {eps} {nm:15s} owner', o.round(4), 'others', ot.round(4), flush=True)
print('--- owner: reliability of the risk of disappointment P(rating<=5), 4 split seeds pooled')
R = np.concatenate([run(OWN, s, eps=.03, **W, **FP)[:, :5].sum(1) for s in range(4)]); B = np.tile(y <= 5, 4)
for lo, hi in ((0, .03), (.03, .06), (.06, .1), (.1, .2), (.2, .35), (.35, 1.01)):
    m = (R >= lo) & (R < hi); print(f'risk {lo:.2f}-{hi:.2f}: share of titles {m.mean():.2f}  mean predicted {R[m].mean():.3f}  observed bad {B[m].mean():.3f}  (n={m.sum() // 4} per seed)')
print('--- others pooled (2 seeds)')
R = np.concatenate([run(u, s, eps=.03, **W, **FP)[:, :5].sum(1) for u in USERS for s in range(2)]); B = np.concatenate([D.of(u)[1] <= 5 for u in USERS for s in range(2)])
for lo, hi in ((0, .05), (.05, .1), (.1, .2), (.2, .35), (.35, .5), (.5, 1.01)):
    m = (R >= lo) & (R < hi); print(f'risk {lo:.2f}-{hi:.2f}: share {m.mean():.2f}  predicted {R[m].mean():.3f}  observed {B[m].mean():.3f}')
print('--- owner: does the distribution cover the truth? central interval from the 10th to the 90th percentile of P')
for s in range(1):
    P = run(OWN, s, eps=.03, **W, **FP); C = np.cumsum(P, 1); lo = (C < .1).sum(1) + 1; hi = (C < .9).sum(1) + 1
    print('coverage', ((y >= lo) & (y <= hi)).mean().round(3), 'mean width', (hi - lo + 1).mean().round(2))
    print('P(rating>=8) reliability:', end=' ')
    H = P[:, 7:].sum(1)
    for a, b in ((0, .15), (.15, .3), (.3, .5), (.5, .7), (.7, 1.01)):
        m = (H >= a) & (H < b); print(f'[{a}-{b}) pred {H[m].mean():.2f} obs {(y[m] >= 8).mean():.2f} n={m.sum()}', end='; ')
    print()
