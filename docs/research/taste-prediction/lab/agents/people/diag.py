"""Diagnostic: do leave-one-out entity effects on baseline residuals predict a title's own residual?"""
import lab, pf, numpy as np, pickle, os
from harness import cv
from scipy.stats import spearmanr
D = lab.data(); S = pf.static(D)
def basep(D, user, tr_idx, tr_y, te_idx): return pf.gbm().fit(S['base'][tr_idx], tr_y).predict(S['base'][te_idx])
if os.path.exists('oof_base.pkl'): O = pickle.load(open('oof_base.pkl','rb'))
else:
    O = {}
    for u in [D.owner] + D.users():
        p, y = cv(D, basep, u, 10 if u == D.owner else 5); O[u] = (D.of(u)[0], y, p)
    pickle.dump(O, open('oof_base.pkl','wb'))
def loo(group, idx, r, k, neigh=False):
    s = pf.te_fit(group, idx, r, neigh)
    out = np.zeros((len(idx), 2))
    for a, i in enumerate(idx):
        effs = []; ws = []
        if neigh:
            for e, w in group[i]:
                v = s.get(e)
                if v: effs.append(v[0]); ws.append(1.0)
            if effs: out[a] = [np.sum(effs) / (len(effs) + k), len(effs)]
            continue
        for e, w in group[i]:
            v = s[e]; n = v[1] - w
            if n > 1e-9: effs.append((v[0] - w * r[a]) / (n + k)); ws.append(w)
        if effs: out[a] = [np.average(effs, weights=ws), len(effs)]
    return out
print(f"{'group':14s} {'own cover':>9s} {'own r':>7s} {'own slope':>9s} | {'oth cover':>9s} {'oth r':>7s} {'slope':>7s}")
for g in S['G']:
    for k in (1.0, 3.0):
        res = []
        for who in ('owner', 'others'):
            us = [D.owner] if who == 'owner' else D.users()
            f = []; rr = []
            for u in us:
                idx, y, p = O[u]; r = y - p
                o = loo(S['G'][g], idx, r, k, g in pf.NEIGH); m = o[:, 1] > 0
                f.append(o[m, 0]); rr.append(r[m]); 
            f = np.concatenate(f); rr = np.concatenate(rr); n = sum(len(O[u][0]) for u in us)
            c = np.corrcoef(f, rr)[0, 1] if len(f) > 5 and f.std() > 0 else 0; sl = (f * rr).sum() / max((f * f).sum(), 1e-9)
            res.append((len(f) / n, c, sl))
        print(f"{g:14s} k={k:.0f} {res[0][0]:6.2f} {res[0][1]:7.3f} {res[0][2]:9.2f} | {res[1][0]:9.2f} {res[1][1]:7.3f} {res[1][2]:7.2f}", flush=True)
