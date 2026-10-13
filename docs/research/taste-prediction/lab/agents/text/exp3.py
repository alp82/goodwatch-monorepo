import numpy as np, scipy.sparse as sp, sys, time
from exp2 import *
from scipy.optimize import nnls
def kridge2(K_tr, t, K_te, alphas=AL):
    m = t.mean(); t = t - m; w, V = np.linalg.eigh(K_tr); Vt = V.T @ t; V2 = V ** 2; best = None
    for a in alphas:
        d = 1 / (w + a); c = V @ (d * Vt); loo = c / (V2 @ d); e = (loo ** 2).mean()
        if best is None or e < best[0]: best = (e, c, loo)
    return K_te @ best[1] + m, t - best[2] + m
def lin2(names):
    names = names if isinstance(names, (list, tuple)) else [names]
    def f(tr, t, te):
        a, b = pos[tr], pos[te]; K = sum(gram(n) for n in names)
        return kridge2(K[np.ix_(a, a)], t, K[np.ix_(b, a)])
    return f
def stack(comps, shrink=0.0, nn=True):
    fs = [lin2(c) for c in comps]
    def f(u, tr, y, te, c):
        m = y.mean(); P = [c['pte'] - m]; O = [c['oof'] - m]
        for g in fs:
            p, o = g(tr, y, te); P.append(p - m); O.append(o - m)
        O = np.array(O).T; P = np.array(P).T
        w = nnls(O, y - m)[0] if nn else np.linalg.lstsq(O, y - m, rcond=None)[0]
        f.w.append(w)
        return m + P @ w
    f.w = []
    return f
if __name__ == '__main__':
    for comps in [[], ['en'], ['tagsvd'], ['en', 'tagsvd'], ['en', 'multi', 'tagsvd', 'tropes', 'misc', 'tfidf_ess'], [('en', 'alltags')], [('en', 'multi', 'tagsvd', 'tfidf_ess', 'alltags')]]:
        f = stack(comps); evaluate(f, f'stack {comps}'); print('   w', np.round(np.mean(f.w[:10], 0), 2), np.round(np.mean(f.w[10:], 0), 2))
