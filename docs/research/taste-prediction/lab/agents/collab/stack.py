"""Baseline GBM + a small, heavily regularised correction learned from other-people signals.
The correction is a ridge fitted on the baseline's inner out-of-fold residuals (training ratings only)."""
import numpy as np, hashlib
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
import lib, gbm_facts
HP = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3)
_B = {}
def base(D, user, tr_idx, tr_y, te_idx, extra=None):
    """Baseline test prediction and inner out-of-fold prediction for the training rows (cached per split)."""
    k = hashlib.md5(np.concatenate([tr_idx, [-1], te_idx]).tobytes() + user.encode() + str(extra).encode()).hexdigest()
    if k not in _B:
        X = gbm_facts.features(D)
        if extra: X = np.hstack([X] + [e(D, user) for e in extra])
        oof = np.zeros(len(tr_y))
        for a, b in KFold(5, shuffle=True, random_state=1).split(tr_idx):
            oof[b] = HistGradientBoostingRegressor(**HP).fit(X[tr_idx[a]], tr_y[a]).predict(X[tr_idx[b]])
        _B[k] = (HistGradientBoostingRegressor(**HP).fit(X[tr_idx], tr_y).predict(X[te_idx]), oof)
    return _B[k]

def collab(D, user, tr_idx, tr_y, r_tr, rows, which):
    """Columns (0 = no evidence) for the given rows."""
    cols = {}
    O = lib.others_stats(D, user)
    if any(w.startswith('kg') for w in which):
        K = lib.knn_graph_feats(D, tr_idx, tr_y, rows, base=tr_y - r_tr)      # neighbours' residual vs the baseline
        for n, c in zip(lib.KG_NAMES, K.T): cols['kg_' + n] = c
    if any(w.startswith('cf') for w in which):
        C = lib.cf_feats(D, user, tr_idx, tr_y, rows)
        for n, c in zip(lib.CF_NAMES, C.T): cols['cf_' + n] = c
    F = O['F'][rows]
    cols['ost_meanz'] = np.nan_to_num(F[:, 2]); cols['ost_logn'] = F[:, 0]; cols['ost_low'] = np.nan_to_num(F[:, 3]) * (F[:, 0] > 0)
    S = lib.sig_counts(D, user)[rows]
    cols['sig_wish'], cols['sig_skip'], cols['sig_fav'] = S[:, 0], S[:, 1], S[:, 2]
    return np.vstack([cols[w] for w in which]).T

def make(which, alpha=30.0, shrink=1.0, extra=None):
    def predict(D, user, tr_idx, tr_y, te_idx):
        p, oof = base(D, user, tr_idx, tr_y, te_idx, extra); r = tr_y - oof
        A = collab(D, user, tr_idx, tr_y, r, tr_idx, which); B = collab(D, user, tr_idx, tr_y, r, te_idx, which)
        sd = A.std(0) + 1e-9; m = A.mean(0)
        g = Ridge(alpha=alpha).fit((A - m) / sd, r)
        return p + shrink * g.predict((B - m) / sd)
    return predict
