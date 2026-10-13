"""FAILED IDEA kept for the record: best.py's second stage with member-specific person effects (cast, director, writer) added to the franchise effect."""
import numpy as np, best, pf
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
def eff(G, tr_idx, r, rows, own, k=3.0):
    s = pf.te_fit(G, tr_idx, r); out = np.zeros(len(rows))
    for a, i in enumerate(rows):
        num = den = 0.0
        for e, w in G[i]:
            v = s.get(e)
            if v is None: continue
            sr, n = v
            if own is not None: sr -= w * own[a]; n -= w
            if n > 1e-9: num += w * sr / (n + k); den += w
        if den: out[a] = num / den
    return out
def predict(D, user, tr_idx, tr_y, te_idx, alpha=30.0):
    C = best._static(D); X = C['X']; S = pf.static(D); tr_idx = np.asarray(tr_idx); te_idx = np.asarray(te_idx)
    oof = np.zeros(len(tr_idx))
    for a, b in KFold(4, shuffle=True, random_state=0).split(tr_idx): oof[b] = best._fit(C, X[tr_idx[a]], tr_y[a]).predict(X[tr_idx[b]])
    pte = best._fit(C, X[tr_idx], tr_y).predict(X[te_idx]); r = tr_y - oof; w = np.sqrt(alpha)
    A = [C['seq'][tr_idx], w * best._series_effect(C['series'], tr_idx, r, tr_idx, r)[:, None]]; B = [C['seq'][te_idx], w * best._series_effect(C['series'], tr_idx, r, te_idx, None)[:, None]]
    for g in ('cast', 'director', 'writer'):
        A.append(w * eff(S['G'][g], tr_idx, r, tr_idx, r)[:, None]); B.append(w * eff(S['G'][g], tr_idx, r, te_idx, None)[:, None])
    return np.clip(pte + Ridge(alpha=alpha).fit(np.hstack(A), r).predict(np.hstack(B)), 1, 10)
