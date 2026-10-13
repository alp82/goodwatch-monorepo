"""Cache every component per (member, split seed, fold) so ingredient combinations can be scored after the fact.
usage: python3 compute.py <part> <nparts>"""
import sys, time, pickle, os, numpy as np
import lib
from lib import *
from harness import Data
import shape, common
from sklearn.kernel_ridge import KernelRidge
D = Data(); F = feats(D)
VARS = {}   # name -> (X, mono or None, colsample)
for nm, fa, te in (('A', 0, 0), ('F', 1, 0), ('T', 0, 1), ('FT', 1, 1)):
    X, mono = matrix(D, bool(fa), bool(te)); VARS[nm] = (X, None, False); VARS[nm + 'm'] = (X, mono, True)
X, mono = matrix(D, True, True); VARS['FTo'] = (X, mono, False); VARS['FTc'] = (X, None, True)
X, mono = matrix(D, False, False); VARS['Ao'] = (X, mono, False); VARS['Ac'] = (X, None, True)
def mk(tr, y, te):
    p, ms, r = common.chain([F['scores'], F['Z']], tr, y, te); w = np.abs(ms[1].coef_); w = w / (np.sqrt((w ** 2).sum()) + 1e-12)
    return p, p + KernelRidge(kernel='rbf', gamma=3.0, alpha=3.0).fit(F['Z'][tr] * w, r).predict(F['Z'][te] * w)
def fold(tr_idx, y, te_idx):
    c = {}; inn = inner(tr_idx)
    for nm, (X, mono, cs) in VARS.items():
        o = np.zeros(len(y))
        for a, b in inn: o[b] = gbm(mono, cs).fit(X[tr_idx[a]], y[a]).predict(X[tr_idx[b]])
        c[nm] = (o, gbm(mono, cs).fit(X[tr_idx], y).predict(X[te_idx]))
    o1 = np.zeros(len(y)); o2 = np.zeros(len(y))
    for a, b in inn: o1[b], o2[b] = mk(tr_idx[a], y[a], tr_idx[b])
    p1, p2 = mk(tr_idx, y, te_idx); c['L2'] = (o1, p1); c['MK'] = (o2, p2)
    for nm in ('lin_facts', 'en', 'tags'):
        p, o = ridge_loo(F[nm][tr_idx], y, F[nm][te_idx]); c['R' + nm] = (o, p)
    for nm, fa, te in (('A', 0, 0), ('FT', 1, 1), ('T', 0, 1), ('F', 1, 0)):
        X, mono = matrix(D, bool(fa), bool(te))
        c['dt_' + nm] = shape.tree_dist(X, tr_idx, y, te_idx, list(mono)); c['dl_' + nm] = shape.logit_dist(X, tr_idx, y, te_idx)
    return c
if __name__ == '__main__':
    part, nparts = int(sys.argv[1]), int(sys.argv[2])
    jobs = [(D.owner, s) for s in range(4)] + [(u, s) for s in range(2) for u in D.users()]
    for j, (u, s) in enumerate(jobs):
        if j % nparts != part: continue
        fn = os.path.join(HERE, 'cache', f'{u[:8]}_{s}.pkl')
        if os.path.exists(fn): continue
        t = time.time(); idx, y, sp = splits(D, u, s)
        out = [dict(tr=tr, te=te, **fold(idx[tr], y[tr], idx[te])) for tr, te in sp]
        pickle.dump(out, open(fn, 'wb')); print(u[:8], s, len(y), round(time.time() - t), flush=True)
