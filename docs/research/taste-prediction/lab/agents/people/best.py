"""people: boosted trees on attributes + title facts (the baseline), with
  1. more structured facts (runtime, popularity, vote counts, user vs critic scores, age certificate, animation method, sequel keyword,
     suitability_* and context_is_* flags),
  2. the public-score columns constrained to be non-decreasing, and half the columns sampled per split (steadier on small members),
  3. a second, tiny linear stage on the trees' out-of-fold errors: sequel keyword, years since the first film of the franchise, and the
     member's own shrunk franchise effect (leave-one-out, so a title never sees its own rating).
Everything fitted on ratings is fitted here from tr_idx/tr_y only. No caches are needed; pf.py and pf2.py build rating-free features."""
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
import pf, pf2
_C = {}
def _static(D):
    if not _C:
        S = pf.static(D); S2 = pf2.static2(D); E = S['extra']; EN = S['extra_names']; nb = S['base'].shape[1]
        X = np.hstack([S['base'], E]); mc = np.zeros(X.shape[1], int); mc[74:80] = 1
        for k in ('gw_user', 'gw_official', 'mc_user'): mc[nb + EN.index(k)] = 1
        _C.update(X=X, mc=mc, seq=np.c_[E[:, EN.index('kw_sequel')], np.nan_to_num(S2['fr'][:, 2]) / 10.0], series=S['G']['series'])
    return _C
def _series_effect(G, tr_idx, r, rows, own, k=1.0):
    s = pf.te_fit(G, tr_idx, r); out = np.zeros(len(rows))
    for a, i in enumerate(rows):
        for e, w in G[i]:
            v = s.get(e)
            if v is None: continue
            sr, n = v
            if own is not None: sr -= own[a]; n -= 1
            if n > 0: out[a] = sr / (n + k)
    return out
def predict(D, user, tr_idx, tr_y, te_idx, inner=4, alpha=30.0):
    C = _static(D); X = C['X']; tr_idx = np.asarray(tr_idx); te_idx = np.asarray(te_idx); tr_y = np.asarray(tr_y, dtype=float)
    oof = np.zeros(len(tr_idx))
    for a, b in KFold(inner, shuffle=True, random_state=0).split(tr_idx):
        oof[b] = _fit(C, X[tr_idx[a]], tr_y[a]).predict(X[tr_idx[b]])
    pte = _fit(C, X[tr_idx], tr_y).predict(X[te_idx])
    r = tr_y - oof
    w = np.sqrt(alpha)          # the franchise effect is already shrunk, so it gets a light penalty (1) while the two sequel facts get alpha
    A = np.c_[C['seq'][tr_idx], w * _series_effect(C['series'], tr_idx, r, tr_idx, r)]
    B = np.c_[C['seq'][te_idx], w * _series_effect(C['series'], tr_idx, r, te_idx, None)]
    return np.clip(pte + Ridge(alpha=alpha).fit(A, r).predict(B), 1, 10)
def _fit(C, X, y): return pf.gbm(monotonic_cst=C['mc'], max_features=0.5, max_iter=200).fit(X, y)
