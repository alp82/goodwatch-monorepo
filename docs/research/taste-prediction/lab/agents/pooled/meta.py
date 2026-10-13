"""Global boosted trees over (member, title, rating) rows of the OTHER members. The member enters through summary
features computed from a visible history: shrunk mean, shrunk spread, number of ratings, and one "similarity to what
you rated high" score (title features . rating-weighted mean of the history's titles).
Training rows are built the way prediction works: each other member's ratings are split at random into a history of
random size (3 .. n-1, log-uniform) and targets; summaries come from the history only, several splits per member.
(A leave-one-out summary leaks: the row's rating can be decoded from the leave-one-out mean. First version did that: owner mae 2.26.)"""
import numpy as np, pool
from sklearn.ensemble import HistGradientBoostingRegressor
_C = {}
def _summ(X, idx, y, gm, gs):
    n = len(y); b = (y.sum() + 3 * gm) / (n + 3); s = np.sqrt((np.sum((y - b) ** 2) + 5 * gs ** 2) / (n + 5))
    return b, s, np.log1p(n), ((y - b)[:, None] * X[idx]).sum(0) / (n + 10.0)
def _feat(X, te, b, s, ln, v, extra=None):
    k = len(te); return np.c_[X[te], np.full(k, b), np.full(k, s), np.full(k, ln), X[te] @ v]
def fit(D, user, depth=4, iters=300, reps=3):
    key = (user, depth, iters, reps)
    if key in _C: return _C[key]
    X = pool.feats(D, 'all')[0]; ou, oi, oy = D.others(user); gm = oy.mean(); gs = oy.std(); rs = np.random.RandomState(0)
    F = []; Y = []
    for u in np.unique(ou):
        m = ou == u; idx, y = oi[m], oy[m]; n = len(y)
        if n < 5: continue
        for _ in range(reps):
            h = int(np.exp(rs.uniform(np.log(3), np.log(n - 1)))); perm = rs.permutation(n); hi, ta = perm[:h], perm[h:h + 150]
            F.append(_feat(X, idx[ta], *_summ(X, idx[hi], y[hi], gm, gs))); Y.append(y[ta])
    M = HistGradientBoostingRegressor(max_depth=depth, max_iter=iters, learning_rate=0.05, min_samples_leaf=20, l2_regularization=1.0, random_state=0).fit(np.vstack(F), np.concatenate(Y))
    _C[key] = (M, X, gm, gs); return _C[key]
def predict(D, user, tr_idx, tr_y, te_idx, **kw):
    M, X, gm, gs = fit(D, user, **kw); y = np.asarray(tr_y, float)
    return M.predict(_feat(X, te_idx, *_summ(X, tr_idx, y, gm, gs)))
